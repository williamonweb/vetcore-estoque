
let state = {};
let activeQuoteId = null;

async function api(url, opts = {}) {
  const o = { ...opts };
  if (o.body && !(o.body instanceof FormData)) {
    o.headers = { "Content-Type": "application/json" };
  }
  const r = await fetch(url, o);
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || "Erro");
  return j;
}

async function load() {
  state = await api("/api/state");
  state.categories = state.categories || [];
  state.products = state.products || [];
  state.suppliers = state.suppliers || [];
  state.users = state.users || [];
  state.stockMoves = state.stockMoves || [];
  state.quotes = state.quotes || [];
  renderAll();
}

function renderAll() {
  [
    renderDashboard, renderSuppliers, renderUsers, renderCategories, renderProducts,
    renderMoves, renderStockMoves, renderQuotes, renderQuoteSheet, renderResults
  ].forEach(fn => {
    try { if (typeof fn === "function") fn(); }
    catch (e) { console.error("Erro ao renderizar:", e); }
  });
}

function showPage(id, btn) {
  document.querySelectorAll(".sec").forEach(s => s.classList.add("hidden"));
  const sec = document.getElementById(id);
  if (sec) sec.classList.remove("hidden");
  document.querySelectorAll(".nav button").forEach(b => b.classList.remove("active"));
  if (btn) {
    btn.classList.add("active");
    if (document.getElementById("title")) title.textContent = btn.textContent;
  }
}

function supplierName(id) {
  return state.suppliers.find(s => s.id === id)?.name || "-";
}

function categoryName(idOrText) {
  return state.categories.find(c => c.id === idOrText)?.name || idOrText || "-";
}

function productById(id) {
  return state.products.find(p => p.id === id);
}

function renderDashboard() {
  if (!document.getElementById("cards")) return;
  cards.innerHTML = `
    <div class="card"><h2>${state.products.length}</h2><p>Produtos</p></div>
    <div class="card"><h2>${state.suppliers.length}</h2><p>Fornecedores</p></div>
    <div class="card"><h2>${state.quotes.length}</h2><p>Cotações</p></div>
  `;
  lowStock.innerHTML = state.products
    .filter(p => Number(p.stock) <= Number(p.minStock))
    .map(p => `<tr><td>${p.name}</td><td>${p.stock} ${p.unit}</td><td>${p.minStock}</td><td>${Math.max(0, p.minStock - p.stock)} ${p.unit}</td></tr>`)
    .join("") || '<tr><td colspan="4" class="muted">Nenhum produto abaixo do mínimo.</td></tr>';
}

function renderSuppliers() {
  if (!document.getElementById("supTable")) return;
  supTable.innerHTML = state.suppliers.map(s => {
    const u = state.users.find(u => u.supplierId === s.id);
    return `<tr><td>${s.name}</td><td>${s.phone || ""}</td><td>${s.email || ""}</td><td>${u ? u.username : '<span class="warn">sem login</span>'}</td><td><button class="danger" onclick="delSupplier('${s.id}')">Excluir</button></td></tr>`;
  }).join("") || '<tr><td colspan="5" class="muted">Nenhum fornecedor.</td></tr>';
}

function renderUsers() {
  if (!document.getElementById("userTable")) return;
  userSupplier.innerHTML = '<option value="">Vincular fornecedor</option>' + state.suppliers.map(s => `<option value="${s.id}">${s.name}</option>`).join("");
  userTable.innerHTML = state.users.map(u => {
    const status = u.active === false ? '<span class="pill bad">Bloqueado</span>' : '<span class="pill ok">Ativo</span>';
    const actions = `<button class="secondary" onclick="openEditUser('${u.id}')">Editar</button>${u.id === "u_admin" ? "" : `<button class="danger" onclick="delUser('${u.id}')">Excluir</button>`}`;
    return `<tr><td>${u.name}</td><td>${u.username}</td><td>${u.role}</td><td>${supplierName(u.supplierId)}</td><td>${status}</td><td>${actions}</td></tr>`;
  }).join("");
}

function renderCategories() {
  if (!document.getElementById("catTable")) return;
  catTable.innerHTML = state.categories.map(c => `<tr><td>${c.name}</td><td><button class="danger" onclick="delCategory('${c.id}')">Excluir</button></td></tr>`).join("") || '<tr><td colspan="2" class="muted">Nenhuma categoria cadastrada.</td></tr>';
}

function renderProducts() {
  if (!document.getElementById("prodTable")) return;
  prodSupplier.innerHTML = '<option value="">Fornecedor padrão</option>' + state.suppliers.map(s => `<option value="${s.id}">${s.name}</option>`).join("");
  prodCat.innerHTML = '<option value="">Selecione a categoria</option>' + state.categories.map(c => `<option value="${c.id}">${c.name}</option>`).join("");
  prodTable.innerHTML = state.products.map(p => `
    <tr>
      <td>${p.name}</td>
      <td>${categoryName(p.categoryId || p.category)}</td>
      <td>${supplierName(p.supplierId)}</td>
      <td>${p.stock} ${p.unit}</td>
      <td>${p.minStock}</td>
      <td><button class="danger" onclick="delProduct('${p.id}')">Excluir</button></td>
    </tr>
  `).join("") || '<tr><td colspan="6" class="muted">Nenhum produto.</td></tr>';
}

function renderMoves() {
  if (!document.getElementById("moveProduct")) return;
  moveProduct.innerHTML = state.products.map(p => `<option value="${p.id}">${p.name} — estoque ${p.stock}</option>`).join("");
}

function renderStockMoves() {
  if (!document.getElementById("stockMovesTable")) return;
  const moves = [...state.stockMoves].reverse();
  stockMovesTable.innerHTML = moves.map(m => {
    const p = productById(m.productId);
    const typeClass = m.type === "entrada" ? "ok" : "bad";
    const signal = m.type === "entrada" ? "+" : "-";
    return `<tr><td>${m.date ? new Date(m.date).toLocaleString("pt-BR") : "-"}</td><td>${p ? p.name : "-"}</td><td><span class="${typeClass}">${m.type}</span></td><td>${signal}${m.quantity}</td><td>${m.note || "-"}</td></tr>`;
  }).join("") || '<tr><td colspan="5" class="muted">Nenhum lançamento registrado.</td></tr>';
}

function compute(q) {
  return (q.items || []).map(item => {
    const offers = [];
    (q.suppliers || []).forEach(s => {
      const a = (s.answers || []).find(x => x.productId === item.productId);
      if (a && Number(a.unitPrice) > 0) offers.push({ ...a, supplierId: s.supplierId, total: Number(a.unitPrice) * Number(item.quantity) });
    });
    offers.sort((a, b) => a.unitPrice - b.unitPrice);
    return { item, winner: offers[0] || null, offers };
  });
}

function currentQuote() {
  if (!state.quotes.length) return null;
  return (activeQuoteId && state.quotes.find(q => q.id === activeQuoteId)) || state.quotes[0];
}

function selectQuoteSheet(id) {
  activeQuoteId = id;
  renderQuoteSheet();
  renderWinnerGroups();
  renderQuotes();
}

function renderQuotes() {
  if (!document.getElementById("quotesList")) return;
  quotesList.innerHTML = state.quotes.map(q => `
    <div class="quote-status-row">
      <div><b>${q.title}</b> <span class="muted">${q.createdAt ? new Date(q.createdAt).toLocaleString("pt-BR") : ""}</span></div>
      <div>
        ${(q.suppliers || []).map(s => `<span class="pill">${supplierName(s.supplierId)}: ${s.status}</span>`).join(" ")}
        <button class="secondary" onclick="selectQuoteSheet('${q.id}')">Abrir</button>
        <button class="danger" onclick="delQuote('${q.id}')">Excluir</button>
      </div>
    </div>
  `).join("") || '<p class="muted">Nenhuma cotação.</p>';
}

function renderQuoteSheet() {
  if (!document.getElementById("quoteSheetBody")) return;
  const q = currentQuote();
  quoteTabs.innerHTML = state.quotes.map(item => `<button class="${q && q.id === item.id ? "active" : ""}" onclick="selectQuoteSheet('${item.id}')">${item.title}</button>`).join("") || '<span class="muted">Nenhuma cotação criada.</span>';
  if (!q) {
    quoteSheetBody.innerHTML = '<tr><td colspan="9" class="muted">Crie uma cotação para visualizar a planilha.</td></tr>';
    return;
  }
  const winnerMap = {};
  compute(q).forEach(w => { if (w.winner) winnerMap[w.item.productId] = w.winner; });
  const rows = [];
  (q.items || []).forEach(item => {
    (q.suppliers || []).forEach((s, idx) => {
      const ans = (s.answers || []).find(a => a.productId === item.productId) || {};
      const isWinner = winnerMap[item.productId] && winnerMap[item.productId].supplierId === s.supplierId;
      rows.push(`
        <tr class="${isWinner ? "winner-row" : ""}">
          <td>${idx === 0 ? `<b>${item.name}</b><div class="muted">Qtd: ${item.quantity} ${item.unit}</div>` : ""}</td>
          <td>${idx === 0 ? item.quantity : ""}</td>
          <td>${supplierName(s.supplierId)}</td>
          <td>${ans.brand || "-"}</td>
          <td>${ans.unitPrice ? "R$ " + Number(ans.unitPrice).toFixed(2) : "-"}</td>
          <td>${ans.deliveryTime || "-"}</td>
          <td>${ans.paymentCondition || "-"}</td>
          <td>${ans.note || "-"}</td>
          <td>${isWinner ? '<span class="pill ok">Vencedor</span>' : ""}</td>
        </tr>
      `);
    });
  });
  quoteSheetBody.innerHTML = rows.join("");
}

function renderResults() {
  renderWinnerGroups();
}

function renderWinnerGroups() {
  if (!document.getElementById("quoteWinnerGroups")) return;
  const q = currentQuote();
  if (!q) {
    quoteWinnerGroups.innerHTML = '<tr><td colspan="4" class="muted">Nenhuma cotação.</td></tr>';
    return;
  }
  const grouped = {};
  compute(q).forEach(w => {
    if (w.winner) {
      const sid = w.winner.supplierId;
      grouped[sid] = grouped[sid] || { items: [], total: 0 };
      grouped[sid].items.push(`${w.item.name} — ${w.item.quantity} ${w.item.unit} — ${w.winner.brand || "sem marca"} — R$ ${Number(w.winner.unitPrice).toFixed(2)}`);
      grouped[sid].total += Number(w.winner.unitPrice) * Number(w.item.quantity);
    }
  });
  quoteWinnerGroups.innerHTML = Object.keys(grouped).map(sid => `
    <tr>
      <td><b>${supplierName(sid)}</b></td>
      <td>${grouped[sid].items.map(i => `<div>${i}</div>`).join("")}</td>
      <td><b>R$ ${grouped[sid].total.toFixed(2)}</b></td>
      <td><button onclick="showWhats('${q.id}','${sid}')">WhatsApp</button><button class="secondary" onclick="printSupplierQuote('${q.id}','${sid}')">PDF</button></td>
    </tr>
  `).join("") || '<tr><td colspan="4" class="muted">Aguardando respostas dos fornecedores.</td></tr>';
}

function renderQuoteOptions() { return; }

async function saveSupplier() {
  try {
    await api("/api/suppliers", { method: "POST", body: JSON.stringify({ name: supName.value, phone: supPhone.value, email: supEmail.value, username: supUser.value, password: supPass.value }) });
    ["supName","supPhone","supEmail","supUser","supPass"].forEach(id => document.getElementById(id).value = "");
    toast("Fornecedor salvo");
    await load();
  } catch (e) { openModal("Erro", `<p>${e.message}</p>`); }
}

async function saveUser() {
  try {
    await api("/api/users", { method: "POST", body: JSON.stringify({ name: userName.value, username: userLogin.value, password: userPass.value, role: userRole.value, supplierId: userSupplier.value }) });
    ["userName","userLogin","userPass"].forEach(id => document.getElementById(id).value = "");
    toast("Usuário salvo");
    await load();
  } catch (e) { openModal("Erro", `<p>${e.message}</p>`); }
}

function openEditUser(id) {
  const u = state.users.find(x => x.id === id);
  if (!u) return openModal("Erro", "<p>Usuário não encontrado.</p>");
  const supplierOptions = '<option value="">Sem fornecedor</option>' + state.suppliers.map(s => `<option value="${s.id}" ${u.supplierId === s.id ? "selected" : ""}>${s.name}</option>`).join("");
  const roleOptions = `<option value="admin" ${u.role === "admin" ? "selected" : ""}>Admin</option><option value="fornecedor" ${u.role === "fornecedor" ? "selected" : ""}>Fornecedor</option>`;
  openModal("Editar usuário", `
    <div class="grid">
      <div><label>Nome</label><input id="editUserName" value="${u.name || ""}"></div>
      <div><label>Login</label><input id="editUserLogin" value="${u.username || ""}"></div>
      <div><label>Nova senha</label><input id="editUserPass" placeholder="Deixe em branco para manter"></div>
      <div><label>Perfil</label><select id="editUserRole">${roleOptions}</select></div>
      <div><label>Fornecedor vinculado</label><select id="editUserSupplier">${supplierOptions}</select></div>
      <div><label>Status</label><select id="editUserActive"><option value="true" ${u.active !== false ? "selected" : ""}>Ativo</option><option value="false" ${u.active === false ? "selected" : ""}>Bloqueado</option></select></div>
    </div>
    <button onclick="saveEditUser('${u.id}')">Salvar alterações</button>
    <button class="secondary" onclick="resetUserPassword('${u.id}')">Resetar senha para 123456</button>
  `);
}

async function saveEditUser(id) {
  try {
    await api("/api/users/" + id, { method: "PUT", body: JSON.stringify({ name: editUserName.value, username: editUserLogin.value, password: editUserPass.value, role: editUserRole.value, supplierId: editUserSupplier.value, active: editUserActive.value === "true" }) });
    closeModal(); toast("Usuário atualizado"); await load();
  } catch (e) { openModal("Erro", `<p>${e.message}</p>`); }
}

async function resetUserPassword(id) {
  try {
    await api("/api/users/" + id, { method: "PUT", body: JSON.stringify({ password: "123456" }) });
    closeModal(); toast("Senha redefinida para 123456"); await load();
  } catch (e) { openModal("Erro", `<p>${e.message}</p>`); }
}

async function saveCategory() {
  try {
    await api("/api/categories", { method: "POST", body: JSON.stringify({ name: catName.value }) });
    catName.value = ""; toast("Categoria salva"); await load();
  } catch (e) { openModal("Erro", `<p>${e.message}</p>`); }
}

function openNewCategoryModal() {
  openModal("Nova categoria", `<input id="modalCatName" placeholder="Nome da categoria"><button onclick="saveCategoryFromModal()">Salvar categoria</button>`);
}

async function saveCategoryFromModal() {
  try {
    await api("/api/categories", { method: "POST", body: JSON.stringify({ name: modalCatName.value }) });
    closeModal(); toast("Categoria salva"); await load();
  } catch (e) { openModal("Erro", `<p>${e.message}</p>`); }
}

async function saveProduct() {
  try {
    const body = { name: prodName.value.trim(), categoryId: prodCat.value, supplierId: prodSupplier.value, stock: prodStock.value || 0, minStock: prodMin.value || 0, unit: prodUnit.value || "un", ean: prodEan.value || "" };
    if (!body.name) return openModal("Atenção", "<p>Informe o nome do produto.</p>");
    await api("/api/products", { method: "POST", body: JSON.stringify(body) });
    ["prodName","prodStock","prodMin","prodEan"].forEach(id => document.getElementById(id).value = "");
    prodUnit.value = "un"; toast("Produto salvo"); await load();
  } catch (e) { openModal("Erro", `<p>${e.message}</p>`); }
}

async function saveMove() {
  try {
    await api("/api/stock", { method: "POST", body: JSON.stringify({ productId: moveProduct.value, type: moveType.value, quantity: moveQty.value, note: moveNote.value }) });
    moveQty.value = ""; moveNote.value = ""; toast("Movimento lançado"); await load();
  } catch (e) { openModal("Erro", `<p>${e.message}</p>`); }
}

function openProductSearch() {
  openModal("Localizar produto", `
    <input id="modalProductSearch" placeholder="Buscar por nome, categoria ou EAN" oninput="renderModalProductList()">
    <div class="table-wrap">
      <table><thead><tr><th>Produto</th><th>Categoria</th><th>EAN</th><th>Estoque</th><th>Mínimo</th><th>Ação</th></tr></thead><tbody id="modalProductList"></tbody></table>
    </div>
  `);
  renderModalProductList();
}

function renderModalProductList() {
  const el = document.getElementById("modalProductList");
  if (!el) return;
  const term = (document.getElementById("modalProductSearch")?.value || "").toLowerCase().trim();
  const filtered = state.products.filter(p => `${p.name||""} ${categoryName(p.categoryId || p.category)||""} ${p.ean||""}`.toLowerCase().includes(term));
  el.innerHTML = filtered.map(p => `<tr><td><b>${p.name}</b></td><td>${categoryName(p.categoryId || p.category)}</td><td>${p.ean || "-"}</td><td>${p.stock} ${p.unit || "un"}</td><td>${p.minStock || 0}</td><td><button class="secondary" onclick="selectProductForMove('${p.id}')">Selecionar</button></td></tr>`).join("") || '<tr><td colspan="6" class="muted">Nenhum produto encontrado.</td></tr>';
}

function selectProductForMove(id) {
  moveProduct.value = id;
  const p = productById(id);
  closeModal();
  toast(`Produto selecionado: ${p ? p.name : ""}`);
  moveQty?.focus();
}

function openNewQuoteModal() {
  const productChecks = state.products.map(p => `<label class="check-row"><input type="checkbox" name="modalQProd" value="${p.id}"><span><b>${p.name}</b> <span class="muted">(${p.stock}/${p.minStock})</span></span></label>`).join("") || '<p class="muted">Cadastre produtos primeiro.</p>';
  const supplierChecks = state.suppliers.map(s => `<label class="check-row"><input type="checkbox" name="modalQSup" value="${s.id}"><span>${s.name}</span></label>`).join("") || '<p class="muted">Cadastre fornecedores primeiro.</p>';
  openModal("Nova cotação", `<input id="modalQuoteTitle" placeholder="Título da cotação"><div class="grid"><div><h3>Produtos</h3><div class="checks">${productChecks}</div></div><div><h3>Fornecedores</h3><div class="checks">${supplierChecks}</div></div></div><button onclick="createQuoteFromModal()">Criar cotação</button>`);
}

async function createQuoteFromModal() {
  try {
    const productIds = [...document.querySelectorAll("[name=modalQProd]:checked")].map(x => x.value);
    const supplierIds = [...document.querySelectorAll("[name=modalQSup]:checked")].map(x => x.value);
    const result = await api("/api/quotes", { method: "POST", body: JSON.stringify({ title: modalQuoteTitle.value, productIds, supplierIds }) });
    activeQuoteId = result.quote.id;
    closeModal(); toast("Cotação criada"); await load();
  } catch (e) { openModal("Erro", `<p>${e.message}</p>`); }
}

async function createQuote() { openNewQuoteModal(); }

function showWhats(qid, sid) {
  const q = state.quotes.find(x => x.id === qid);
  const wins = compute(q).filter(w => w.winner?.supplierId === sid);
  const msg = `Olá! Segue fechamento da cotação ${q.title}:\n\n` + wins.map(w => `• ${w.item.name} — ${w.item.quantity} ${w.item.unit}\nMarca: ${w.winner.brand || "-"}\nValor unitário: R$ ${Number(w.winner.unitPrice).toFixed(2)}\nPrazo: ${w.winner.deliveryTime || "-"}`).join("\n\n") + "\n\nObrigado!";
  openModal("Mensagem para " + supplierName(sid), `<textarea rows="13" id="wmsg">${msg}</textarea><button onclick="navigator.clipboard.writeText(wmsg.value);toast('Mensagem copiada')">Copiar mensagem</button>`);
}

function printSupplierQuote(qid, sid) {
  const q = state.quotes.find(x => x.id === qid);
  const wins = compute(q).filter(w => w.winner?.supplierId === sid);
  const supplier = supplierName(sid);
  const html = `<html><head><title>Cotação ${supplier}</title><style>body{font-family:Arial;padding:30px}table{width:100%;border-collapse:collapse}td,th{border:1px solid #ccc;padding:8px;text-align:left}</style></head><body><h2>Fechamento de Cotação</h2><h3>${supplier}</h3><p>${q.title}</p><table><thead><tr><th>Produto</th><th>Qtd</th><th>Marca</th><th>Valor unit.</th><th>Prazo</th></tr></thead><tbody>${wins.map(w => `<tr><td>${w.item.name}</td><td>${w.item.quantity} ${w.item.unit}</td><td>${w.winner.brand || "-"}</td><td>R$ ${Number(w.winner.unitPrice).toFixed(2)}</td><td>${w.winner.deliveryTime || "-"}</td></tr>`).join("")}</tbody></table></body></html>`;
  const win = window.open("", "_blank");
  win.document.write(html);
  win.document.close();
  win.print();
}

async function importNfe() {
  try {
    const fd = new FormData();
    fd.append("xml", xmlFile.files[0]);
    const r = await fetch("/api/import-nfe", { method: "POST", body: fd });
    const j = await r.json();
    if (!r.ok) throw new Error(j.error);
    nfeMsg.textContent = `Importados ${j.imported} itens.`;
    await load();
  } catch (e) { openModal("Erro", `<p>${e.message}</p>`); }
}

function delSupplier(id){ confirmModal("Excluir fornecedor","Deseja excluir este fornecedor?",async()=>{await api("/api/suppliers/"+id,{method:"DELETE"});await load();toast("Excluído")})}
function delUser(id){ confirmModal("Excluir usuário","Deseja excluir este usuário?",async()=>{await api("/api/users/"+id,{method:"DELETE"});await load();toast("Excluído")})}
function delCategory(id){ confirmModal("Excluir categoria","Deseja excluir esta categoria?",async()=>{try{await api("/api/categories/"+id,{method:"DELETE"});await load();toast("Categoria excluída")}catch(e){openModal("Erro",`<p>${e.message}</p>`)}})}
function delProduct(id){ confirmModal("Excluir produto","Deseja excluir este produto?",async()=>{await api("/api/products/"+id,{method:"DELETE"});await load();toast("Excluído")})}
function delQuote(id){ confirmModal("Excluir cotação","Deseja excluir esta cotação?",async()=>{await api("/api/quotes/"+id,{method:"DELETE"});await load();toast("Excluída")})}

async function logout() {
  await fetch("/api/logout", { method: "POST" });
  location.href = "/";
}

load().catch(e => openModal("Erro", `<p>${e.message}</p>`));
