
let state={};
async function api(url,opts={}){const o={...opts};if(o.body && !(o.body instanceof FormData)){o.headers={'Content-Type':'application/json'};}const r=await fetch(url,o);const j=await r.json().catch(()=>({}));if(!r.ok)throw new Error(j.error||'Erro');return j}
async function load(){state=await api('/api/state');renderAll()}
function showPage(id,btn){document.querySelectorAll('.sec').forEach(s=>s.classList.add('hidden'));document.getElementById(id).classList.remove('hidden');document.querySelectorAll('.nav button').forEach(b=>b.classList.remove('active'));btn.classList.add('active');title.textContent=btn.textContent}
function supplierName(id){return state.suppliers.find(s=>s.id===id)?.name||'-'}
function renderAll(){renderDashboard();renderSuppliers();renderUsers();renderProducts();renderMoves();renderStockMoves();renderQuoteOptions();renderQuotes();renderResults()}
function renderDashboard(){cards.innerHTML=`<div class="card"><h2>${state.products.length}</h2><p>Produtos</p></div><div class="card"><h2>${state.suppliers.length}</h2><p>Fornecedores</p></div><div class="card"><h2>${state.quotes.length}</h2><p>Cotações</p></div>`;lowStock.innerHTML=state.products.filter(p=>Number(p.stock)<=Number(p.minStock)).map(p=>`<tr><td>${p.name}</td><td>${p.stock} ${p.unit}</td><td>${p.minStock}</td><td>${Math.max(0,p.minStock-p.stock)} ${p.unit}</td></tr>`).join('')||'<tr><td colspan="4" class="muted">Nenhum produto abaixo do mínimo.</td></tr>'}
function renderSuppliers(){supTable.innerHTML=state.suppliers.map(s=>{let u=state.users.find(u=>u.supplierId===s.id);return `<tr><td>${s.name}</td><td>${s.phone||''}</td><td>${s.email||''}</td><td>${u?u.username:'<span class="warn">sem login</span>'}</td><td><button class="danger" onclick="delSupplier('${s.id}')">Excluir</button></td></tr>`}).join('')||'<tr><td colspan="5" class="muted">Nenhum fornecedor.</td></tr>'}
function renderUsers(){
  userSupplier.innerHTML='<option value="">Vincular fornecedor</option>'+state.suppliers.map(s=>`<option value="${s.id}">${s.name}</option>`).join('');
  userTable.innerHTML=state.users.map(u=>{
    const status = u.active === false ? '<span class="pill bad">Bloqueado</span>' : '<span class="pill ok">Ativo</span>';
    const actions = u.id === 'u_admin'
      ? `<button class="secondary" onclick="openEditUser('${u.id}')">Editar</button>`
      : `<button class="secondary" onclick="openEditUser('${u.id}')">Editar</button><button class="danger" onclick="delUser('${u.id}')">Excluir</button>`;
    return `<tr><td>${u.name}</td><td>${u.username}</td><td>${u.role}</td><td>${supplierName(u.supplierId)}</td><td>${status}</td><td>${actions}</td></tr>`;
  }).join('');
}
function renderProducts(){prodSupplier.innerHTML='<option value="">Fornecedor padrão</option>'+state.suppliers.map(s=>`<option value="${s.id}">${s.name}</option>`).join('');prodTable.innerHTML=state.products.map(p=>`<tr><td>${p.name}</td><td>${supplierName(p.supplierId)}</td><td>${p.stock} ${p.unit}</td><td>${p.minStock}</td><td><button class="danger" onclick="delProduct('${p.id}')">Excluir</button></td></tr>`).join('')||'<tr><td colspan="5" class="muted">Nenhum produto.</td></tr>'}
function renderMoves(){moveProduct.innerHTML=state.products.map(p=>`<option value="${p.id}">${p.name} — estoque ${p.stock}</option>`).join('')}
function renderQuoteOptions(){quoteProducts.innerHTML=state.products.map(p=>`<label><input type="checkbox" name="qprod" value="${p.id}"> ${p.name} <span class="muted">(${p.stock}/${p.minStock})</span></label>`).join('')||'<p class="muted">Cadastre produtos.</p>';quoteSuppliers.innerHTML=state.suppliers.map(s=>`<label><input type="checkbox" name="qsup" value="${s.id}"> ${s.name}</label>`).join('')||'<p class="muted">Cadastre fornecedores.</p>'}
function renderQuotes(){quotesList.innerHTML=state.quotes.map(q=>`<div class="card"><h3>${q.title}</h3><p class="muted">${new Date(q.createdAt).toLocaleString('pt-BR')}</p><table><thead><tr><th>Fornecedor</th><th>Status</th><th>Respondido em</th></tr></thead><tbody>${q.suppliers.map(s=>`<tr><td>${supplierName(s.supplierId)}</td><td>${s.status}</td><td>${s.respondedAt?new Date(s.respondedAt).toLocaleString('pt-BR'):'-'}</td></tr>`).join('')}</tbody></table><button class="danger" onclick="delQuote('${q.id}')">Excluir cotação</button></div>`).join('')||'<p class="muted">Nenhuma cotação.</p>'}
function compute(q){return q.items.map(item=>{let offers=[];q.suppliers.forEach(s=>{let a=(s.answers||[]).find(x=>x.productId===item.productId);if(a&&Number(a.unitPrice)>0)offers.push({...a,supplierId:s.supplierId,total:Number(a.unitPrice)*Number(item.quantity)})});offers.sort((a,b)=>a.unitPrice-b.unitPrice);return {item,winner:offers[0]||null,offers}})}
function renderResults(){quoteResults.innerHTML=state.quotes.map(q=>{let rows=compute(q);let grouped={};rows.forEach(w=>{if(w.winner){grouped[w.winner.supplierId]=grouped[w.winner.supplierId]||[];grouped[w.winner.supplierId].push(w)}});return `<div class="card"><h3>${q.title}</h3><table><thead><tr><th>Produto</th><th>Vencedor</th><th>Marca</th><th>Valor</th><th>Prazo</th></tr></thead><tbody>${rows.map(w=>`<tr><td>${w.item.name} — ${w.item.quantity} ${w.item.unit}</td><td>${w.winner?supplierName(w.winner.supplierId):'<span class="warn">Sem resposta</span>'}</td><td>${w.winner?.brand||''}</td><td>${w.winner?'R$ '+Number(w.winner.unitPrice).toFixed(2):''}</td><td>${w.winner?.deliveryTime||''}</td></tr>`).join('')}</tbody></table><h3>WhatsApp agrupado por fornecedor vencedor</h3>${Object.keys(grouped).map(sid=>`<p><b>${supplierName(sid)}</b> — ${grouped[sid].length} item(ns) <button onclick="showWhats('${q.id}','${sid}')">Mensagem WhatsApp</button></p>`).join('')||'<p class="muted">Aguardando respostas.</p>'}</div>`}).join('')}
function showWhats(qid,sid){let q=state.quotes.find(x=>x.id===qid);let wins=compute(q).filter(w=>w.winner?.supplierId===sid);let msg=`Olá! Segue fechamento da cotação ${q.title}:\n\n`+wins.map(w=>`• ${w.item.name} — ${w.item.quantity} ${w.item.unit}\nMarca: ${w.winner.brand||'-'}\nValor unitário: R$ ${Number(w.winner.unitPrice).toFixed(2)}\nPrazo: ${w.winner.deliveryTime||'-'}`).join('\n\n')+`\n\nObrigado!`;openModal('Mensagem para '+supplierName(sid),`<textarea rows="13" id="wmsg">${msg}</textarea><button onclick="navigator.clipboard.writeText(wmsg.value);toast('Mensagem copiada')">Copiar mensagem</button>`)}
async function saveSupplier(){try{await api('/api/suppliers',{method:'POST',body:JSON.stringify({name:supName.value,phone:supPhone.value,email:supEmail.value,username:supUser.value,password:supPass.value})});['supName','supPhone','supEmail','supUser','supPass'].forEach(id=>document.getElementById(id).value='');toast('Fornecedor salvo');await load()}catch(e){openModal('Erro',`<p>${e.message}</p>`)}}
async function saveUser(){try{await api('/api/users',{method:'POST',body:JSON.stringify({name:userName.value,username:userLogin.value,password:userPass.value,role:userRole.value,supplierId:userSupplier.value})});['userName','userLogin','userPass'].forEach(id=>document.getElementById(id).value='');toast('Usuário salvo');await load()}catch(e){openModal('Erro',`<p>${e.message}</p>`)}}
async function saveProduct(){try{await api('/api/products',{method:'POST',body:JSON.stringify({name:prodName.value,category:prodCat.value,supplierId:prodSupplier.value,stock:prodStock.value,minStock:prodMin.value,unit:prodUnit.value,ean:prodEan.value})});['prodName','prodCat','prodStock','prodMin','prodEan'].forEach(id=>document.getElementById(id).value='');toast('Produto salvo');await load()}catch(e){openModal('Erro',`<p>${e.message}</p>`)}}
async function saveMove(){try{await api('/api/stock',{method:'POST',body:JSON.stringify({productId:moveProduct.value,type:moveType.value,quantity:moveQty.value,note:moveNote.value})});moveQty.value=moveNote.value='';toast('Movimento lançado');await load()}catch(e){openModal('Erro',`<p>${e.message}</p>`)}}
async function createQuote(){try{let productIds=[...document.querySelectorAll('[name=qprod]:checked')].map(x=>x.value);let supplierIds=[...document.querySelectorAll('[name=qsup]:checked')].map(x=>x.value);await api('/api/quotes',{method:'POST',body:JSON.stringify({title:quoteTitle.value,productIds,supplierIds})});quoteTitle.value='';toast('Cotação criada');await load()}catch(e){openModal('Erro',`<p>${e.message}</p>`)}}
async function importNfe(){try{let fd=new FormData();fd.append('xml',xmlFile.files[0]);let r=await fetch('/api/import-nfe',{method:'POST',body:fd});let j=await r.json();if(!r.ok)throw new Error(j.error);nfeMsg.textContent=`Importados ${j.imported} itens.`;await load()}catch(e){openModal('Erro',`<p>${e.message}</p>`)}}





function productById(id){
  return state.products.find(p=>p.id===id);
}

function openProductSearch(){
  openModal('Localizar produto', `
    <input id="modalProductSearch" placeholder="Buscar por nome, categoria ou EAN" oninput="renderModalProductList()">
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Produto</th>
            <th>Categoria</th>
            <th>EAN</th>
            <th>Estoque</th>
            <th>Mínimo</th>
            <th>Ação</th>
          </tr>
        </thead>
        <tbody id="modalProductList"></tbody>
      </table>
    </div>
  `);
  renderModalProductList();
}

function renderModalProductList(){
  const el = document.getElementById('modalProductList');
  if(!el) return;

  const term = (document.getElementById('modalProductSearch')?.value || '').toLowerCase().trim();
  const filtered = state.products.filter(p => {
    const text = `${p.name||''} ${p.category||''} ${p.ean||''}`.toLowerCase();
    return text.includes(term);
  });

  el.innerHTML = filtered.map(p => `
    <tr>
      <td><b>${p.name}</b></td>
      <td>${p.category || '-'}</td>
      <td>${p.ean || '-'}</td>
      <td>${p.stock} ${p.unit || 'un'}</td>
      <td>${p.minStock || 0}</td>
      <td><button class="secondary" onclick="selectProductForMove('${p.id}')">Selecionar</button></td>
    </tr>
  `).join('') || '<tr><td colspan="6" class="muted">Nenhum produto encontrado.</td></tr>';
}

function selectProductForMove(id){
  moveProduct.value = id;
  const p = productById(id);
  closeModal();
  toast(`Produto selecionado: ${p ? p.name : ''}`);
  moveQty?.focus();
}

function renderStockMoves(){
  if(!document.getElementById('stockMovesTable')) return;

  const moves = [...(state.stockMoves || [])].reverse();
  stockMovesTable.innerHTML = moves.map(m => {
    const p = productById(m.productId);
    const typeClass = m.type === 'entrada' ? 'ok' : 'bad';
    const signal = m.type === 'entrada' ? '+' : '-';
    return `
      <tr>
        <td>${m.date ? new Date(m.date).toLocaleString('pt-BR') : '-'}</td>
        <td>${p ? p.name : '-'}</td>
        <td><span class="${typeClass}">${m.type}</span></td>
        <td>${signal}${m.quantity}</td>
        <td>${m.note || '-'}</td>
      </tr>
    `;
  }).join('') || '<tr><td colspan="5" class="muted">Nenhum lançamento registrado.</td></tr>';
}

function delSupplier(id){confirmModal('Excluir fornecedor','Deseja excluir este fornecedor e o acesso dele?',async()=>{await api('/api/suppliers/'+id,{method:'DELETE'});await load();toast('Excluído')})}
function delUser(id){confirmModal('Excluir usuário','Deseja excluir este usuário?',async()=>{await api('/api/users/'+id,{method:'DELETE'});await load();toast('Excluído')})}
function delProduct(id){confirmModal('Excluir produto','Deseja excluir este produto?',async()=>{await api('/api/products/'+id,{method:'DELETE'});await load();toast('Excluído')})}
function delQuote(id){confirmModal('Excluir cotação','Deseja excluir esta cotação?',async()=>{await api('/api/quotes/'+id,{method:'DELETE'});await load();toast('Excluída')})}

function openEditUser(id){
  const u = state.users.find(x=>x.id===id);
  if(!u) return openModal('Erro','<p>Usuário não encontrado.</p>');

  const supplierOptions = '<option value="">Sem fornecedor</option>' + state.suppliers.map(s=>`<option value="${s.id}" ${u.supplierId===s.id?'selected':''}>${s.name}</option>`).join('');
  const roleOptions = `<option value="admin" ${u.role==='admin'?'selected':''}>Admin</option><option value="fornecedor" ${u.role==='fornecedor'?'selected':''}>Fornecedor</option>`;
  const activeChecked = u.active === false ? '' : 'checked';

  openModal('Editar usuário', `
    <div class="grid">
      <div><label>Nome</label><input id="editUserName" value="${u.name || ''}"></div>
      <div><label>Login</label><input id="editUserLogin" value="${u.username || ''}"></div>
      <div><label>Nova senha</label><input id="editUserPass" placeholder="Deixe em branco para manter"></div>
      <div><label>Perfil</label><select id="editUserRole">${roleOptions}</select></div>
      <div><label>Fornecedor vinculado</label><select id="editUserSupplier">${supplierOptions}</select></div>
      <div><label>Status</label><select id="editUserActive"><option value="true" ${u.active!==false?'selected':''}>Ativo</option><option value="false" ${u.active===false?'selected':''}>Bloqueado</option></select></div>
    </div>
    <button onclick="saveEditUser('${u.id}')">Salvar alterações</button>
    <button class="secondary" onclick="resetUserPassword('${u.id}')">Resetar senha para 123456</button>
  `);
}

async function saveEditUser(id){
  try{
    const body = {
      name: editUserName.value,
      username: editUserLogin.value,
      password: editUserPass.value,
      role: editUserRole.value,
      supplierId: editUserSupplier.value,
      active: editUserActive.value === 'true'
    };
    await api('/api/users/'+id,{method:'PUT',body:JSON.stringify(body)});
    closeModal();
    toast('Usuário atualizado');
    await load();
  }catch(e){openModal('Erro',`<p>${e.message}</p>`)}
}

async function resetUserPassword(id){
  try{
    await api('/api/users/'+id,{method:'PUT',body:JSON.stringify({password:'123456'})});
    closeModal();
    toast('Senha redefinida para 123456');
    await load();
  }catch(e){openModal('Erro',`<p>${e.message}</p>`)}
}

async function logout(){await fetch('/api/logout',{method:'POST'});location.href='/'}
load().catch(e=>openModal('Erro',`<p>${e.message}</p>`));
