
let state={};
async function api(url,opts={}){const o={...opts};if(o.body && !(o.body instanceof FormData)){o.headers={'Content-Type':'application/json'};}const r=await fetch(url,o);const j=await r.json().catch(()=>({}));if(!r.ok)throw new Error(j.error||'Erro');return j}
async function load(){state=await api('/api/state');renderAll()}
function showPage(id,btn){document.querySelectorAll('.sec').forEach(s=>s.classList.add('hidden'));document.getElementById(id).classList.remove('hidden');document.querySelectorAll('.nav button').forEach(b=>b.classList.remove('active'));btn.classList.add('active');title.textContent=btn.textContent}
function supplierName(id){return state.suppliers.find(s=>s.id===id)?.name||'-'}
function categoryName(idOrText){return state.categories?.find(c=>c.id===idOrText)?.name || idOrText || '-'}
function renderAll(){
  const funcs = [
    renderDashboard,
    renderSuppliers,
    renderUsers,
    renderCategories,
    renderProducts,
    renderMoves,
    renderStockMoves,
    renderQuoteOptions,
    renderQuotes,
    renderQuoteSheet,
    renderResults
  ];

  funcs.forEach(fn=>{
    try{
      if(typeof fn === 'function') fn();
    }catch(e){
      console.error('Erro ao renderizar:', e);
    }
  });
}
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
function renderCategories(){
  if(!document.getElementById('catTable')) return;
  catTable.innerHTML = (state.categories||[]).map(c=>`
    <tr>
      <td>${c.name}</td>
      <td><button class="danger" onclick="delCategory('${c.id}')">Excluir</button></td>
    </tr>
  `).join('') || '<tr><td colspan="2" class="muted">Nenhuma categoria cadastrada.</td></tr>';
}

async function saveCategory(){
  try{
    await api('/api/categories',{method:'POST',body:JSON.stringify({name:catName.value})});
    catName.value='';
    toast('Categoria salva');
    await load();
  }catch(e){openModal('Erro',`<p>${e.message}</p>`)}
}

function openNewCategoryModal(){
  openModal('Nova categoria', `
    <input id="modalCatName" placeholder="Nome da categoria">
    <button onclick="saveCategoryFromModal()">Salvar categoria</button>
  `);
}

async function saveCategoryFromModal(){
  try{
    await api('/api/categories',{method:'POST',body:JSON.stringify({name:modalCatName.value})});
    closeModal();
    toast('Categoria salva');
    await load();
  }catch(e){openModal('Erro',`<p>${e.message}</p>`)}
}

function delCategory(id){
  confirmModal('Excluir categoria','Deseja excluir esta categoria?',async()=>{
    try{
      await api('/api/categories/'+id,{method:'DELETE'});
      await load();
      toast('Categoria excluída');
    }catch(e){openModal('Erro',`<p>${e.message}</p>`)}
  });
}

function renderProducts(){
  if(!document.getElementById('prodTable')) return;

  if(document.getElementById('prodSupplier')){
    prodSupplier.innerHTML='<option value="">Fornecedor padrão</option>'+(state.suppliers||[]).map(s=>`<option value="${s.id}">${s.name}</option>`).join('');
  }

  if(document.getElementById('prodCat')){
    prodCat.innerHTML='<option value="">Selecione a categoria</option>'+(state.categories||[]).map(c=>`<option value="${c.id}">${c.name}</option>`).join('');
  }

  prodTable.innerHTML=(state.products||[]).map(p=>`
    <tr>
      <td>${p.name}</td>
      <td>${categoryName(p.categoryId || p.category)}</td>
      <td>${supplierName(p.supplierId)}</td>
      <td>${p.stock} ${p.unit}</td>
      <td>${p.minStock}</td>
      <td><button class="danger" onclick="delProduct('${p.id}')">Excluir</button></td>
    </tr>
  `).join('')||'<tr><td colspan="6" class="muted">Nenhum produto.</td></tr>';
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
    const text = `${p.name||''} ${categoryName(p.categoryId || p.category)||''} ${p.ean||''}`.toLowerCase();
    return text.includes(term);
  });

  el.innerHTML = filtered.map(p => `
    <tr>
      <td><b>${p.name}</b></td>
      <td>${categoryName(p.categoryId || p.category)}</td>
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


function renderMoves(){
  if(!document.getElementById('moveProduct')) return;
  moveProduct.innerHTML = (state.products || []).map(p=>`<option value="${p.id}">${p.name} — estoque ${p.stock}</option>`).join('');
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


function renderQuoteOptions(){
  // Mantido como compatibilidade: a v19+ usa openNewQuoteModal/renderQuoteSheet.
  return;
}


async function saveProduct(){
  try{
    const body = {
      name: document.getElementById('prodName').value.trim(),
      categoryId: document.getElementById('prodCat').value,
      supplierId: document.getElementById('prodSupplier').value,
      stock: document.getElementById('prodStock').value || 0,
      minStock: document.getElementById('prodMin').value || 0,
      unit: document.getElementById('prodUnit').value || 'un',
      ean: document.getElementById('prodEan').value || ''
    };

    if(!body.name){
      openModal('Atenção','<p>Informe o nome do produto.</p>');
      return;
    }

    await api('/api/products',{
      method:'POST',
      body:JSON.stringify(body)
    });

    ['prodName','prodStock','prodMin','prodEan'].forEach(id=>{
      const el = document.getElementById(id);
      if(el) el.value = '';
    });

    document.getElementById('prodUnit').value = 'un';
    toast('Produto salvo');
    await load();
  }catch(e){
    openModal('Erro',`<p>${e.message}</p>`);
  }
}
