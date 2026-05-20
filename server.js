
const express = require("express");
const session = require("express-session");
const fs = require("fs");
const path = require("path");
const multer = require("multer");

const app = express();
const PORT = process.env.PORT || 3000;
const DB_PATH = path.join(__dirname, "data", "db.json");
const upload = multer({ storage: multer.memoryStorage() });

app.use(express.json({ limit: "20mb" }));
app.use(express.urlencoded({ extended: true }));

app.use(session({
  secret: process.env.SESSION_SECRET || "vetcore-estoque-secret",
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 1000 * 60 * 60 * 12 }
}));

// IMPORTANTE: serve CSS/JS/HTML da pasta public
app.use(express.static(path.join(__dirname, "public")));

function uid(prefix){ return prefix + "_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2,8); }

function readDB(){
  if(!fs.existsSync(DB_PATH)){
    fs.mkdirSync(path.dirname(DB_PATH), { recursive:true });
    fs.writeFileSync(DB_PATH, JSON.stringify({
      users:[{id:"u_admin",name:"Administrador",username:"admin",password:"123456",role:"admin",supplierId:null,active:true}],
      suppliers:[], categories:[], products:[], stockMoves:[], quotes:[]
    }, null, 2));
  }
  const db = JSON.parse(fs.readFileSync(DB_PATH, "utf8"));
  db.users ||= [];
  db.suppliers ||= [];
  db.categories ||= [];
  db.products ||= [];
  db.stockMoves ||= [];
  db.quotes ||= [];
  return db;
}

function writeDB(db){
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
}

function safeUser(u){
  return {id:u.id,name:u.name,username:u.username,role:u.role,supplierId:u.supplierId||null,active:u.active!==false};
}

function requireLogin(req,res,next){
  if(!req.session.user) return res.status(401).json({error:"Sessão expirada. Faça login novamente."});
  next();
}

function requireAdmin(req,res,next){
  if(!req.session.user || req.session.user.role !== "admin") return res.status(403).json({error:"Acesso negado."});
  next();
}

app.get("/", (req,res)=>res.sendFile(path.join(__dirname, "public", "login.html")));

app.post("/api/login", (req,res)=>{
  const {username,password} = req.body;
  const db = readDB();
  const user = db.users.find(u=>u.username===username && u.password===password && u.active!==false);
  if(!user) return res.status(401).json({error:"Usuário ou senha inválidos."});
  req.session.user = safeUser(user);
  res.json({ok:true,user:req.session.user});
});

app.post("/api/logout", (req,res)=>req.session.destroy(()=>res.json({ok:true})));

app.get("/api/state", requireLogin, (req,res)=>{
  const db = readDB();
  const me = req.session.user;

  if(me.role === "fornecedor"){
    const supplier = db.suppliers.find(s=>s.id===me.supplierId);
    const quotes = db.quotes
      .map(q=>({...q, suppliers:(q.suppliers||[]).filter(s=>s.supplierId===me.supplierId)}))
      .filter(q=>q.suppliers.length);
    return res.json({user:me,supplier,quotes});
  }

  res.json({...db, users: db.users.map(safeUser)});
});

app.post("/api/suppliers", requireAdmin, (req,res)=>{
  const db = readDB();
  const {name,phone,email,username,password} = req.body;
  if(!name) return res.status(400).json({error:"Nome obrigatório."});
  const supplier = {id:uid("sup"), name, phone:phone||"", email:email||""};
  db.suppliers.push(supplier);
  if(username && password){
    if(db.users.some(u=>u.username===username)) return res.status(400).json({error:"Login já existe."});
    db.users.push({id:uid("usr"), name, username, password, role:"fornecedor", supplierId:supplier.id, active:true});
  }
  writeDB(db);
  res.json({ok:true,supplier});
});

app.delete("/api/suppliers/:id", requireAdmin, (req,res)=>{
  const db = readDB();
  db.suppliers = db.suppliers.filter(s=>s.id!==req.params.id);
  db.users = db.users.filter(u=>u.supplierId!==req.params.id);
  writeDB(db);
  res.json({ok:true});
});

app.post("/api/users", requireAdmin, (req,res)=>{
  const db = readDB();
  const {name,username,password,role,supplierId} = req.body;
  if(!name || !username || !password || !role) return res.status(400).json({error:"Preencha nome, login, senha e perfil."});
  if(db.users.some(u=>u.username===username)) return res.status(400).json({error:"Login já existe."});
  if(role==="fornecedor" && !supplierId) return res.status(400).json({error:"Fornecedor obrigatório para esse perfil."});
  const user = {id:uid("usr"), name, username, password, role, supplierId:role==="fornecedor"?supplierId:null, active:true};
  db.users.push(user);
  writeDB(db);
  res.json({ok:true,user:safeUser(user)});
});

app.put("/api/users/:id", requireAdmin, (req,res)=>{
  const db = readDB();
  const user = db.users.find(u=>u.id===req.params.id);
  if(!user) return res.status(404).json({error:"Usuário não encontrado."});

  const {name,username,password,role,supplierId,active} = req.body;

  if(username && username !== user.username && db.users.some(u=>u.username===username && u.id!==user.id)){
    return res.status(400).json({error:"Login já existe."});
  }

  if(name !== undefined) user.name = name;
  if(username !== undefined) user.username = username;
  if(password !== undefined && password !== "") user.password = password;
  if(role !== undefined) user.role = role;
  if(active !== undefined) user.active = !!active;

  if(user.role === "fornecedor"){
    if(!supplierId) return res.status(400).json({error:"Fornecedor obrigatório para esse perfil."});
    user.supplierId = supplierId;
  } else {
    user.supplierId = null;
  }

  writeDB(db);
  res.json({ok:true,user:safeUser(user)});
});

app.delete("/api/users/:id", requireAdmin, (req,res)=>{
  const db = readDB();
  if(req.params.id==="u_admin") return res.status(400).json({error:"Admin inicial não pode ser excluído."});
  db.users = db.users.filter(u=>u.id!==req.params.id);
  writeDB(db);
  res.json({ok:true});
});

app.post("/api/categories", requireAdmin, (req,res)=>{
  const db = readDB();
  const name = (req.body.name||"").trim();
  if(!name) return res.status(400).json({error:"Nome da categoria obrigatório."});
  if(db.categories.some(c=>c.name.toLowerCase()===name.toLowerCase())) return res.status(400).json({error:"Categoria já existe."});
  const category = {id:uid("cat"), name};
  db.categories.push(category);
  writeDB(db);
  res.json({ok:true,category});
});

app.delete("/api/categories/:id", requireAdmin, (req,res)=>{
  const db = readDB();
  if(db.products.some(p=>p.categoryId===req.params.id)) return res.status(400).json({error:"Categoria em uso por produto."});
  db.categories = db.categories.filter(c=>c.id!==req.params.id);
  writeDB(db);
  res.json({ok:true});
});

app.post("/api/products", requireAdmin, (req,res)=>{
  const db = readDB();
  const {name,categoryId,supplierId,stock,minStock,unit,ean} = req.body;
  if(!name) return res.status(400).json({error:"Nome do produto obrigatório."});
  const product = {
    id:uid("prod"),
    name,
    categoryId:categoryId||"",
    supplierId:supplierId||"",
    stock:Number(stock||0),
    minStock:Number(minStock||0),
    unit:unit||"un",
    ean:ean||""
  };
  db.products.push(product);
  writeDB(db);
  res.json({ok:true,product});
});

app.delete("/api/products/:id", requireAdmin, (req,res)=>{
  const db = readDB();
  db.products = db.products.filter(p=>p.id!==req.params.id);
  writeDB(db);
  res.json({ok:true});
});

app.post("/api/stock", requireAdmin, (req,res)=>{
  const db = readDB();
  const {productId,type,quantity,note} = req.body;
  const product = db.products.find(p=>p.id===productId);
  if(!product) return res.status(404).json({error:"Produto não encontrado."});
  const qty = Number(quantity||0);
  if(qty<=0) return res.status(400).json({error:"Quantidade inválida."});
  if(type==="entrada") product.stock += qty;
  else if(type==="saida") product.stock -= qty;
  else return res.status(400).json({error:"Tipo inválido."});
  db.stockMoves.push({id:uid("mov"), productId, type, quantity:qty, note:note||"", date:new Date().toISOString()});
  writeDB(db);
  res.json({ok:true,product});
});

app.post("/api/quotes", requireAdmin, (req,res)=>{
  const db = readDB();
  const {title,productIds,supplierIds} = req.body;
  if(!productIds?.length) return res.status(400).json({error:"Selecione produtos."});
  if(!supplierIds?.length) return res.status(400).json({error:"Selecione fornecedores."});

  const items = productIds.map(pid=>{
    const p = db.products.find(x=>x.id===pid);
    const needed = Math.max(1, Number(p.minStock||0) - Number(p.stock||0));
    return {productId:p.id, name:p.name, quantity:needed, unit:p.unit||"un"};
  });

  const quote = {
    id:uid("cot"),
    title:title||"Cotação",
    status:"aberta",
    createdAt:new Date().toISOString(),
    items,
    suppliers:supplierIds.map(sid=>({supplierId:sid, status:"pendente", respondedAt:null, answers:[]}))
  };

  db.quotes.push(quote);
  writeDB(db);
  res.json({ok:true,quote});
});

app.post("/api/quotes/:quoteId/respond", requireLogin, (req,res)=>{
  const db = readDB();
  const quote = db.quotes.find(q=>q.id===req.params.quoteId);
  if(!quote) return res.status(404).json({error:"Cotação não encontrada."});

  const supplierId = req.session.user.role==="fornecedor" ? req.session.user.supplierId : req.body.supplierId;
  const row = quote.suppliers.find(s=>s.supplierId===supplierId);
  if(!row) return res.status(403).json({error:"Fornecedor não participa desta cotação."});

  row.answers = (req.body.answers||[]).map(a=>({
    productId:a.productId,
    brand:a.brand||"",
    unitPrice:Number(a.unitPrice||0),
    deliveryTime:a.deliveryTime||"",
    paymentCondition:a.paymentCondition||"",
    note:a.note||""
  }));
  row.status = "respondida";
  row.respondedAt = new Date().toISOString();

  writeDB(db);
  res.json({ok:true});
});

app.delete("/api/quotes/:id", requireAdmin, (req,res)=>{
  const db = readDB();
  db.quotes = db.quotes.filter(q=>q.id!==req.params.id);
  writeDB(db);
  res.json({ok:true});
});

app.post("/api/import-nfe", requireAdmin, upload.single("xml"), (req,res)=>{
  const db = readDB();
  const xml = req.file ? req.file.buffer.toString("utf8") : "";
  if(!xml) return res.status(400).json({error:"XML não enviado."});

  const dets = [...xml.matchAll(/<det[\s\S]*?<\/det>/g)].map(m=>m[0]);
  let imported = 0;

  dets.forEach(det=>{
    const name = (det.match(/<xProd>(.*?)<\/xProd>/)?.[1]||"").trim();
    const ean = (det.match(/<cEAN>(.*?)<\/cEAN>/)?.[1]||"").trim();
    const qty = Number((det.match(/<qCom>(.*?)<\/qCom>/)?.[1]||"0").replace(",","."));
    if(!name || !qty) return;

    let product = db.products.find(p=>(ean && p.ean===ean) || p.name.toLowerCase()===name.toLowerCase());
    if(!product){
      product = {id:uid("prod"), name, categoryId:"", supplierId:"", stock:0, minStock:0, unit:"un", ean};
      db.products.push(product);
    }

    product.stock += qty;
    db.stockMoves.push({id:uid("mov"), productId:product.id, type:"entrada", quantity:qty, note:"Entrada via XML NF-e", date:new Date().toISOString()});
    imported++;
  });

  writeDB(db);
  res.json({ok:true,imported});
});

app.listen(PORT, ()=>console.log("VetCore Estoque rodando na porta " + PORT));
