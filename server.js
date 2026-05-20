const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const helmet = require('helmet');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const SESSION_SECRET = process.env.SESSION_SECRET || 'troque-esta-chave-em-producao-vetcore';
const PUBLIC_DIR = path.join(__dirname, 'public');
const USERS_FILE = path.join(__dirname, 'users.json');

function ensureUsers(){
  if(!fs.existsSync(USERS_FILE)){
    const hash = bcrypt.hashSync('123456', 10);
    fs.writeFileSync(USERS_FILE, JSON.stringify([{usuario:'admin', senhaHash:hash, nome:'Administrador', role:'admin'}], null, 2));
  }
}
function users(){ ensureUsers(); return JSON.parse(fs.readFileSync(USERS_FILE,'utf8')); }
function saveUsers(lista){ fs.writeFileSync(USERS_FILE, JSON.stringify(lista, null, 2)); }
function safeUser(u){ return {usuario:u.usuario, nome:u.nome||u.usuario, role:u.role||'admin', fornecedor:u.fornecedor||''}; }
function requireAdminApi(req,res,next){
  if(req.session && req.session.user && req.session.user.role === 'admin') return next();
  return res.status(403).json({erro:'Acesso negado'});
}


app.use(helmet({contentSecurityPolicy:false}));
app.use(express.urlencoded({extended:false}));
app.use(express.json({limit:'2mb'}));
app.use(session({
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly:true, sameSite:'lax', secure:false, maxAge: 1000*60*60*8 }
}));

function requireLogin(req,res,next){
  if(req.session && req.session.user) return next();
  return res.redirect('/login');
}

app.get('/login', (req,res)=>res.sendFile(path.join(PUBLIC_DIR,'login.html')));
app.post('/login', (req,res)=>{
  const {usuario, senha} = req.body;
  const u = users().find(x => x.usuario === usuario);
  if(!u || !bcrypt.compareSync(senha || '', u.senhaHash)) return res.redirect('/login?erro=1');
  req.session.user = {usuario:u.usuario, nome:u.nome || u.usuario, role:u.role || 'admin', fornecedor:u.fornecedor || ''};
  if((u.role || 'admin') === 'fornecedor') return res.redirect('/fornecedor.html');
  res.redirect('/');
});
app.get('/logout', (req,res)=>req.session.destroy(()=>res.redirect('/login')));

app.get('/api/me', requireLogin, (req,res)=>res.json(req.session.user));

app.get('/api/users', requireLogin, requireAdminApi, (req,res)=>{
  res.json(users().map(safeUser));
});

app.post('/api/users', requireLogin, requireAdminApi, (req,res)=>{
  const {usuario, senha, nome, role, fornecedor} = req.body || {};
  const login = String(usuario || '').trim();
  if(!login) return res.status(400).json({erro:'Informe o login.'});
  let lista = users();
  let existente = lista.find(u => u.usuario === login);
  if(existente){
    existente.nome = nome || existente.nome || login;
    existente.role = role || existente.role || 'fornecedor';
    existente.fornecedor = fornecedor || existente.fornecedor || '';
    if(senha) existente.senhaHash = bcrypt.hashSync(String(senha), 10);
    saveUsers(lista);
    return res.json({ok:true, user:safeUser(existente), atualizado:true});
  }
  if(!senha) return res.status(400).json({erro:'Informe uma senha para o novo usuário.'});
  const novo = {usuario:login, senhaHash:bcrypt.hashSync(String(senha),10), nome:nome || login, role:role || 'fornecedor', fornecedor:fornecedor || ''};
  lista.push(novo);
  saveUsers(lista);
  res.json({ok:true, user:safeUser(novo)});
});

app.delete('/api/users/:usuario', requireLogin, requireAdminApi, (req,res)=>{
  const usuario = req.params.usuario;
  if(usuario === 'admin') return res.status(400).json({erro:'O usuário admin não pode ser excluído.'});
  let lista = users();
  const antes = lista.length;
  lista = lista.filter(u => u.usuario !== usuario);
  saveUsers(lista);
  res.json({ok:true, removidos: antes-lista.length});
});

app.use(requireLogin, express.static(PUBLIC_DIR));
app.get('*', requireLogin, (req,res)=>res.sendFile(path.join(PUBLIC_DIR,'index.html')));

app.listen(PORT, ()=>console.log(`VetCore Estoque rodando em http://localhost:${PORT}`));
