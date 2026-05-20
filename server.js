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
    fs.writeFileSync(USERS_FILE, JSON.stringify([{usuario:'admin', senhaHash:hash, nome:'Administrador'}], null, 2));
  }
}
function users(){ ensureUsers(); return JSON.parse(fs.readFileSync(USERS_FILE,'utf8')); }

app.use(helmet({contentSecurityPolicy:false}));
app.use(express.urlencoded({extended:false}));
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
  req.session.user = {usuario:u.usuario, nome:u.nome || u.usuario};
  res.redirect('/');
});
app.get('/logout', (req,res)=>req.session.destroy(()=>res.redirect('/login')));

app.use(requireLogin, express.static(PUBLIC_DIR));
app.get('*', requireLogin, (req,res)=>res.sendFile(path.join(PUBLIC_DIR,'index.html')));

app.listen(PORT, ()=>console.log(`VetCore Estoque rodando em http://localhost:${PORT}`));
