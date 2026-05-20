
const express = require('express');
const session = require('express-session');
const fs = require('fs');
const path = require('path');
const multer = require('multer');

const app = express();
const PORT = process.env.PORT || 3000;
const DB_PATH = path.join(__dirname, 'data', 'db.json');
const upload = multer({ storage: multer.memoryStorage() });

app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(session({
  secret: process.env.SESSION_SECRET || 'vetcore-estoque-secret',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 1000 * 60 * 60 * 8 }
}));
app.use(express.static(path.join(__dirname, 'public')));

function readDB() {
  if (!fs.existsSync(DB_PATH)) {
    fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
    fs.writeFileSync(DB_PATH, JSON.stringify({ users: [], suppliers: [], products: [], stockMoves: [], quotes: [] }, null, 2));
  }
  return JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
}
function writeDB(db) {
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2,));
}
function uid(prefix) {
  return prefix + '_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
}
function requireLogin(req, res, next) {
  if (!req.session.user) return res.status(401).json({ error: 'Não autenticado' });
  next();
}
function requireAdmin(req, res, next) {
  if (!req.session.user || req.session.user.role !== 'admin') return res.status(403).json({ error: 'Acesso negado' });
  next();
}

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'login.html')));

app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  const db = readDB();
  const user = db.users.find(u => u.username === username && u.password === password);
  if (!user) return res.status(401).json({ error: 'Usuário ou senha inválidos' });
  req.session.user = { id: user.id, name: user.name, username: user.username, role: user.role, supplierId: user.supplierId || null };
  res.json({ ok: true, user: req.session.user });
});

app.post('/api/logout', (req, res) => req.session.destroy(() => res.json({ ok: true })));

app.get('/api/me', requireLogin, (req, res) => res.json(req.session.user));

app.get('/api/state', requireLogin, (req, res) => {
  const db = readDB();
  const user = req.session.user;
  if (user.role === 'fornecedor') {
    const supplier = db.suppliers.find(s => s.id === user.supplierId);
    const quotes = db.quotes
      .map(q => ({
        ...q,
        suppliers: q.suppliers.filter(s => s.supplierId === user.supplierId)
      }))
      .filter(q => q.suppliers.length > 0);
    return res.json({ user, supplier, quotes });
  }
  res.json(db);
});

app.post('/api/suppliers', requireAdmin, (req, res) => {
  const db = readDB();
  const { name, phone, email, username, password } = req.body;
  if (!name) return res.status(400).json({ error: 'Nome obrigatório' });
  const supplier = { id: uid('sup'), name, phone: phone || '', email: email || '' };
  db.suppliers.push(supplier);
  if (username && password) {
    if (db.users.some(u => u.username === username)) return res.status(400).json({ error: 'Login já existe' });
    db.users.push({ id: uid('usr'), name, username, password, role: 'fornecedor', supplierId: supplier.id });
  }
  writeDB(db);
  res.json({ ok: true, supplier });
});

app.put('/api/suppliers/:id', requireAdmin, (req, res) => {
  const db = readDB();
  const supplier = db.suppliers.find(s => s.id === req.params.id);
  if (!supplier) return res.status(404).json({ error: 'Fornecedor não encontrado' });
  Object.assign(supplier, {
    name: req.body.name ?? supplier.name,
    phone: req.body.phone ?? supplier.phone,
    email: req.body.email ?? supplier.email
  });
  const user = db.users.find(u => u.supplierId === supplier.id);
  if (user) {
    if (req.body.username) user.username = req.body.username;
    if (req.body.password) user.password = req.body.password;
    user.name = supplier.name;
  } else if (req.body.username && req.body.password) {
    db.users.push({ id: uid('usr'), name: supplier.name, username: req.body.username, password: req.body.password, role: 'fornecedor', supplierId: supplier.id });
  }
  writeDB(db);
  res.json({ ok: true, supplier });
});

app.post('/api/products', requireAdmin, (req, res) => {
  const db = readDB();
  const { name, category, supplierId, stock, minStock, unit, ean } = req.body;
  if (!name) return res.status(400).json({ error: 'Produto obrigatório' });
  const product = {
    id: uid('prod'), name, category: category || '', supplierId: supplierId || '',
    stock: Number(stock || 0), minStock: Number(minStock || 0), unit: unit || 'un', ean: ean || ''
  };
  db.products.push(product);
  writeDB(db);
  res.json({ ok: true, product });
});

app.post('/api/stock', requireAdmin, (req, res) => {
  const db = readDB();
  const { productId, type, quantity, note } = req.body;
  const product = db.products.find(p => p.id === productId);
  if (!product) return res.status(404).json({ error: 'Produto não encontrado' });
  const qty = Number(quantity || 0);
  if (type === 'entrada') product.stock += qty;
  if (type === 'saida') product.stock -= qty;
  db.stockMoves.push({ id: uid('mov'), productId, type, quantity: qty, note: note || '', date: new Date().toISOString() });
  writeDB(db);
  res.json({ ok: true, product });
});

app.post('/api/quotes', requireAdmin, (req, res) => {
  const db = readDB();
  const { title, productIds, supplierIds } = req.body;
  if (!productIds?.length || !supplierIds?.length) return res.status(400).json({ error: 'Selecione produtos e fornecedores' });
  const items = productIds.map(pid => {
    const p = db.products.find(x => x.id === pid);
    const needed = Math.max(1, Number(p.minStock || 0) - Number(p.stock || 0));
    return { productId: pid, name: p.name, quantity: needed, unit: p.unit || 'un' };
  });
  const quote = {
    id: uid('cot'),
    title: title || 'Cotação',
    status: 'aberta',
    createdAt: new Date().toISOString(),
    items,
    suppliers: supplierIds.map(sid => ({ supplierId: sid, status: 'pendente', respondedAt: null, answers: [] }))
  };
  db.quotes.push(quote);
  writeDB(db);
  res.json({ ok: true, quote });
});

app.post('/api/quotes/:quoteId/respond', requireLogin, (req, res) => {
  const db = readDB();
  const user = req.session.user;
  const quote = db.quotes.find(q => q.id === req.params.quoteId);
  if (!quote) return res.status(404).json({ error: 'Cotação não encontrada' });
  const supplierId = user.role === 'fornecedor' ? user.supplierId : req.body.supplierId;
  const supplierQuote = quote.suppliers.find(s => s.supplierId === supplierId);
  if (!supplierQuote) return res.status(403).json({ error: 'Fornecedor não participa desta cotação' });
  supplierQuote.answers = (req.body.answers || []).map(a => ({
    productId: a.productId,
    brand: a.brand || '',
    unitPrice: Number(a.unitPrice || 0),
    deliveryTime: a.deliveryTime || '',
    paymentCondition: a.paymentCondition || '',
    note: a.note || ''
  }));
  supplierQuote.status = 'respondida';
  supplierQuote.respondedAt = new Date().toISOString();
  writeDB(db);
  res.json({ ok: true, quote });
});

app.post('/api/import-nfe', requireAdmin, upload.single('xml'), (req, res) => {
  const db = readDB();
  const xml = req.file ? req.file.buffer.toString('utf8') : (req.body.xml || '');
  if (!xml) return res.status(400).json({ error: 'XML não enviado' });
  const dets = [...xml.matchAll(/<det[\s\S]*?<\/det>/g)].map(m => m[0]);
  let imported = 0;
  dets.forEach(det => {
    const name = (det.match(/<xProd>(.*?)<\/xProd>/)?.[1] || '').trim();
    const ean = (det.match(/<cEAN>(.*?)<\/cEAN>/)?.[1] || '').trim();
    const qty = Number((det.match(/<qCom>(.*?)<\/qCom>/)?.[1] || '0').replace(',', '.'));
    if (!name || !qty) return;
    let product = db.products.find(p => (ean && p.ean === ean) || p.name.toLowerCase() === name.toLowerCase());
    if (!product) {
      product = { id: uid('prod'), name, category: 'Importado NF-e', supplierId: '', stock: 0, minStock: 0, unit: 'un', ean };
      db.products.push(product);
    }
    product.stock += qty;
    db.stockMoves.push({ id: uid('mov'), productId: product.id, type: 'entrada', quantity: qty, note: 'Entrada via XML NF-e', date: new Date().toISOString() });
    imported++;
  });
  writeDB(db);
  res.json({ ok: true, imported });
});

app.listen(PORT, () => console.log(`VetCore Estoque rodando na porta ${PORT}`));
