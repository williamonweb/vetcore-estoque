
let state={}; let activeQuoteId=null;
async function api(url,opts={}){const o={...opts}; if(o.body && !(o.body instanceof FormData)) o.headers={"Content-Type":"application/json"}; const r=await fetch(url,o); const j=await r.json().catch(()=>({})); if(!r.ok) throw new Error(j.error||"Erro"); return j;}
async function load(){state=await api("/api/state");["users","suppliers","categories","products","stockMoves","quotes"].forEach(k=>state[k] ||= []);renderAll();}
function showPage(id,btn){document.querySelectorAll(".sec").forEach(s=>s.classList.add("hidden"));document.getElementById(id)?.classList.remove("hidden");document.querySelectorAll(".nav button").forEach(b=>b.classList.remove("active"));btn?.classList.add("active");if(btn&&title)title.textContent=btn.textContent;}
function supplierName(id){return state.suppliers.find(s=>s.id===id)?.name||"-"} function categoryName(id){return state.categories.find(c=>c.id===id)?.name||id||"-"} function productById(id){return state.products.find(p=>p.id===id)}
function renderAll(){[renderDashboard,renderSuppliers,renderUsers,renderCategories,renderProducts,renderMoves,renderStockMoves,renderQuotes,renderQuoteSheet,renderResults].forEach(fn=>{try{fn()}catch(e){console.error(e)}})}
function renderDashboard(){if(!cards)return;cards.innerHTML=`<div class="card"><h2>${state.products.length}</h2><p>Produtos</p></div><div class="card"><h2>${state.suppliers.length}</h2><p>Fornecedores</p></div><div class="card"><h2>${state.quotes.length}</h2><p>Cotações</p></div>`;lowStock.innerHTML=state.products.filter(p=>+p.stock<=+p.minStock).map(p=>`<tr><td>${p.name}</td><td>${p.stock} ${p.unit}</td><td>${p.minStock}</td><td>${Math.max(0,p.minStock-p.stock)} ${p.unit}</td></tr>`).join("")||'<tr><td colspan="4" class="muted">Nenhum produto abaixo do mínimo.</td></tr>'}
function renderSuppliers(){if(!supTable)return;supTable.innerHTML=state.suppliers.map(s=>{const u=state.users.find(u=>u.supplierId===s.id);return`<tr><td>${s.name}</td><td>${s.phone||""}</td><td>${s.email||""}</td><td>${u?u.username:'<span class="warn">sem login</span>'}</td><td><button class="danger" onclick="delSupplier('${s.id}')">Excluir</button></td></tr>`}).join("")||'<tr><td colspan="5" class="muted">Nenhum fornecedor.</td></tr>'}
function renderUsers(){if(!userTable)return;userSupplier.innerHTML='<option value="">Vincular fornecedor</option>'+state.suppliers.map(s=>`<option value="${s.id}">${s.name}</option>`).join("");userTable.innerHTML=state.users.map(u=>`<tr><td>${u.name}</td><td>${u.username}</td><td>${u.role}</td><td>${supplierName(u.supplierId)}</td><td>${u.active===false?'<span class="pill bad">Bloqueado</span>':'<span class="pill ok">Ativo</span>'}</td><td><button class="secondary" onclick="openEditUser('${u.id}')">Editar</button>${u.id==='u_admin'?'':`<button class="danger" onclick="delUser('${u.id}')">Excluir</button>`}</td></tr>`).join("")}
function renderCategories(){if(!catTable)return;catTable.innerHTML=state.categories.map(c=>`<tr><td>${c.name}</td><td><button class="danger" onclick="delCategory('${c.id}')">Excluir</button></td></tr>`).join("")||'<tr><td colspan="2" class="muted">Nenhuma categoria.</td></tr>'}
function renderProducts(){if(!prodTable)return;prodSupplier.innerHTML='<option value="">Fornecedor padrão</option>'+state.suppliers.map(s=>`<option value="${s.id}">${s.name}</option>`).join("");prodCat.innerHTML='<option value="">Selecione a categoria</option>'+state.categories.map(c=>`<option value="${c.id}">${c.name}</option>`).join("");prodTable.innerHTML=state.products.map(p=>`<tr><td>${p.name}</td><td>${categoryName(p.categoryId)}</td><td>${supplierName(p.supplierId)}</td><td>${p.stock} ${p.unit}</td><td>${p.minStock}</td><td><button class="danger" onclick="delProduct('${p.id}')">Excluir</button></td></tr>`).join("")||'<tr><td colspan="6" class="muted">Nenhum produto.</td></tr>'}
function renderMoves(){if(!moveProduct)return;moveProduct.innerHTML=state.products.map(p=>`<option value="${p.id}">${p.name} — estoque ${p.stock}</option>`).join("")}
function renderStockMoves(){if(!stockMovesTable)return;stockMovesTable.innerHTML=[...state.stockMoves].reverse().map(m=>{const p=productById(m.productId);return`<tr><td>${m.date?new Date(m.date).toLocaleString("pt-BR"):"-"}</td><td>${p?p.name:"-"}</td><td><span class="${m.type==="entrada"?"ok":"bad"}">${m.type}</span></td><td>${m.type==="entrada"?"+":"-"}${m.quantity}</td><td>${m.note||"-"}</td></tr>`}).join("")||'<tr><td colspan="5" class="muted">Nenhum lançamento.</td></tr>'}
function compute(q){return(q.items||[]).map(item=>{let offers=[];(q.suppliers||[]).forEach(s=>{const a=(s.answers||[]).find(x=>x.productId===item.productId);if(a&&+a.unitPrice>0)offers.push({...a,supplierId:s.supplierId,total:+a.unitPrice*+item.quantity})});offers.sort((a,b)=>a.unitPrice-b.unitPrice);return{item,winner:offers[0]||null,offers}})}
function currentQuote(){return activeQuoteId&&state.quotes.find(q=>q.id===activeQuoteId)||state.quotes[0]||null}
function selectQuoteSheet(id){activeQuoteId=id;renderQuoteSheet();renderWinnerGroups();renderQuotes()}
function renderQuotes(){if(!quotesList)return;quotesList.innerHTML=state.quotes.map(q=>`<div class="quote-status-row"><div><b>${q.title}</b> <span class="muted">${new Date(q.createdAt).toLocaleString("pt-BR")}</span></div><div>${(q.suppliers||[]).map(s=>`<span class="pill">${supplierName(s.supplierId)}: ${s.status}</span>`).join(" ")}<button class="secondary" onclick="selectQuoteSheet('${q.id}')">Abrir</button><button class="danger" onclick="delQuote('${q.id}')">Excluir</button></div></div>`).join("")||'<p class="muted">Nenhuma cotação.</p>'}
function renderQuoteSheet(){if(!quoteSheetBody)return;const q=currentQuote();quoteTabs.innerHTML=state.quotes.map(x=>`<button class="${q&&q.id===x.id?"active":""}" onclick="selectQuoteSheet('${x.id}')">${x.title}</button>`).join("")||'<span class="muted">Nenhuma cotação.</span>';if(!q){quoteSheetBody.innerHTML='<tr><td colspan="9" class="muted">Crie uma cotação.</td></tr>';return}const wm={};compute(q).forEach(w=>{if(w.winner)wm[w.item.productId]=w.winner});quoteSheetBody.innerHTML=(q.items||[]).flatMap(item=>(q.suppliers||[]).map((s,i)=>{const a=(s.answers||[]).find(x=>x.productId===item.productId)||{};const win=wm[item.productId]&&wm[item.productId].supplierId===s.supplierId;return`<tr class="${win?"winner-row":""}"><td>${i===0?`<b>${item.name}</b><div class="muted">Qtd: ${item.quantity} ${item.unit}</div>`:""}</td><td>${i===0?item.quantity:""}</td><td>${supplierName(s.supplierId)}</td><td>${a.brand||"-"}</td><td>${a.unitPrice?"R$ "+(+a.unitPrice).toFixed(2):"-"}</td><td>${a.deliveryTime||"-"}</td><td>${a.paymentCondition||"-"}</td><td>${a.note||"-"}</td><td>${win?'<span class="pill ok">Vencedor</span>':""}</td></tr>`})).join("")}
function renderResults(){renderWinnerGroups()} function renderWinnerGroups(){if(!quoteWinnerGroups)return;const q=currentQuote();if(!q){quoteWinnerGroups.innerHTML='<tr><td colspan="4" class="muted">Nenhuma cotação.</td></tr>';return}let g={};compute(q).forEach(w=>{if(w.winner){const sid=w.winner.supplierId;g[sid]??={items:[],total:0};g[sid].items.push(`${w.item.name} — ${w.item.quantity} ${w.item.unit} — ${w.winner.brand||"sem marca"} — R$ ${(+w.winner.unitPrice).toFixed(2)}`);g[sid].total+=+w.winner.unitPrice*+w.item.quantity}});quoteWinnerGroups.innerHTML=Object.keys(g).map(sid=>`<tr><td><b>${supplierName(sid)}</b></td><td>${g[sid].items.map(i=>`<div>${i}</div>`).join("")}</td><td><b>R$ ${g[sid].total.toFixed(2)}</b></td><td><button onclick="showWhats('${q.id}','${sid}')">WhatsApp</button></td></tr>`).join("")||'<tr><td colspan="4" class="muted">Aguardando respostas.</td></tr>'}
async function saveSupplier(){try{await api("/api/suppliers",{method:"POST",body:JSON.stringify({name:supName.value,phone:supPhone.value,email:supEmail.value,username:supUser.value,password:supPass.value})});toast("Fornecedor salvo");await load()}catch(e){openModal("Erro",`<p>${e.message}</p>`)}}
async function saveUser(){try{await api("/api/users",{method:"POST",body:JSON.stringify({name:userName.value,username:userLogin.value,password:userPass.value,role:userRole.value,supplierId:userSupplier.value})});toast("Usuário salvo");await load()}catch(e){openModal("Erro",`<p>${e.message}</p>`)}}
function openEditUser(id){const u=state.users.find(x=>x.id===id);const opts=state.suppliers.map(s=>`<option value="${s.id}" ${u.supplierId===s.id?"selected":""}>${s.name}</option>`).join("");openModal("Editar usuário",`<input id="editUserName" value="${u.name}"><input id="editUserLogin" value="${u.username}"><input id="editUserPass" placeholder="Nova senha"><select id="editUserRole"><option value="admin" ${u.role==="admin"?"selected":""}>Admin</option><option value="fornecedor" ${u.role==="fornecedor"?"selected":""}>Fornecedor</option><option value="estoque" ${u.role==="estoque"?"selected":""}>Estoque</option></select><select id="editUserSupplier"><option value="">Sem fornecedor</option>${opts}</select><select id="editUserActive"><option value="true" ${u.active!==false?"selected":""}>Ativo</option><option value="false" ${u.active===false?"selected":""}>Bloqueado</option></select><button onclick="saveEditUser('${id}')">Salvar</button><button class="secondary" onclick="resetUserPassword('${id}')">Resetar senha</button>`)}
async function saveEditUser(id){try{await api("/api/users/"+id,{method:"PUT",body:JSON.stringify({name:editUserName.value,username:editUserLogin.value,password:editUserPass.value,role:editUserRole.value,supplierId:editUserSupplier.value,active:editUserActive.value==="true"})});closeModal();toast("Usuário atualizado");await load()}catch(e){openModal("Erro",`<p>${e.message}</p>`)}}
async function resetUserPassword(id){try{await api("/api/users/"+id,{method:"PUT",body:JSON.stringify({password:"123456"})});closeModal();toast("Senha 123456");await load()}catch(e){openModal("Erro",`<p>${e.message}</p>`)}}
async function saveCategory(){try{await api("/api/categories",{method:"POST",body:JSON.stringify({name:catName.value})});toast("Categoria salva");await load()}catch(e){openModal("Erro",`<p>${e.message}</p>`)}}
function openNewCategoryModal(){openModal("Nova categoria",`<input id="modalCatName" placeholder="Nome"><button onclick="saveCategoryFromModal()">Salvar</button>`)} async function saveCategoryFromModal(){try{await api("/api/categories",{method:"POST",body:JSON.stringify({name:modalCatName.value})});closeModal();toast("Categoria salva");await load()}catch(e){openModal("Erro",`<p>${e.message}</p>`)}}
async function saveProduct(){try{if(!prodName.value.trim())return openModal("Atenção","<p>Informe o produto.</p>");await api("/api/products",{method:"POST",body:JSON.stringify({name:prodName.value.trim(),categoryId:prodCat.value,supplierId:prodSupplier.value,stock:prodStock.value||0,minStock:prodMin.value||0,unit:prodUnit.value||"un",ean:prodEan.value||""})});toast("Produto salvo");await load()}catch(e){openModal("Erro",`<p>${e.message}</p>`)}}
async function saveMove(){try{await api("/api/stock",{method:"POST",body:JSON.stringify({productId:moveProduct.value,type:moveType.value,quantity:moveQty.value,note:moveNote.value})});toast("Movimento lançado");await load()}catch(e){openModal("Erro",`<p>${e.message}</p>`)}}
function openProductSearch(){openModal("Localizar produto",`<input id="modalProductSearch" placeholder="Buscar" oninput="renderModalProductList()"><div class="table-wrap"><table><thead><tr><th>Produto</th><th>Categoria</th><th>Estoque</th><th>Ação</th></tr></thead><tbody id="modalProductList"></tbody></table></div>`);renderModalProductList()} function renderModalProductList(){const term=(modalProductSearch?.value||"").toLowerCase();modalProductList.innerHTML=state.products.filter(p=>`${p.name} ${categoryName(p.categoryId)} ${p.ean}`.toLowerCase().includes(term)).map(p=>`<tr><td>${p.name}</td><td>${categoryName(p.categoryId)}</td><td>${p.stock}</td><td><button onclick="selectProductForMove('${p.id}')">Selecionar</button></td></tr>`).join("")} function selectProductForMove(id){moveProduct.value=id;closeModal();toast("Produto selecionado")}
function openNewQuoteModal(){const ps=state.products.map(p=>`<label class="check-row"><input type="checkbox" name="modalQProd" value="${p.id}"><span><b>${p.name}</b> <span class="muted">(${p.stock}/${p.minStock})</span></span></label>`).join("");const ss=state.suppliers.map(s=>`<label class="check-row"><input type="checkbox" name="modalQSup" value="${s.id}"><span>${s.name}</span></label>`).join("");openModal("Nova cotação",`<input id="modalQuoteTitle" placeholder="Título da cotação"><div class="grid"><div><h3>Produtos</h3><div class="checks">${ps}</div></div><div><h3>Fornecedores</h3><div class="checks">${ss}</div></div></div><button onclick="createQuoteFromModal()">Criar cotação</button>`)}
async function createQuoteFromModal(){try{const productIds=[...document.querySelectorAll("[name=modalQProd]:checked")].map(x=>x.value);const supplierIds=[...document.querySelectorAll("[name=modalQSup]:checked")].map(x=>x.value);const r=await api("/api/quotes",{method:"POST",body:JSON.stringify({title:modalQuoteTitle.value,productIds,supplierIds})});activeQuoteId=r.quote.id;closeModal();toast("Cotação criada");await load()}catch(e){openModal("Erro",`<p>${e.message}</p>`)}}
function showWhats(qid,sid){const q=state.quotes.find(x=>x.id===qid);const wins=compute(q).filter(w=>w.winner?.supplierId===sid);const msg=`Olá! Segue fechamento da cotação ${q.title}:\n\n`+wins.map(w=>`• ${w.item.name} — ${w.item.quantity} ${w.item.unit}\nMarca: ${w.winner.brand||"-"}\nValor unitário: R$ ${(+w.winner.unitPrice).toFixed(2)}\nPrazo: ${w.winner.deliveryTime||"-"}`).join("\n\n");openModal("Mensagem para "+supplierName(sid),`<textarea rows="13" id="wmsg">${msg}</textarea><button onclick="navigator.clipboard.writeText(wmsg.value);toast('Copiado')">Copiar</button>`)}

function getCurrentQuoteOrWarn(){
  const q = currentQuote();
  if(!q){
    openModal("Atenção","<p>Crie ou selecione uma cotação primeiro.</p>");
    return null;
  }
  return q;
}

function openQuoteWhatsModal(){
  const q = getCurrentQuoteOrWarn();
  if(!q) return;

  const suppliers = (q.suppliers||[]).map(s=>{
    const sup = state.suppliers.find(x=>x.id===s.supplierId);
    return sup ? {id:sup.id,name:sup.name,phone:sup.phone||""} : null;
  }).filter(Boolean);

  const options = suppliers.map(s=>`<option value="${s.id}">${s.name}${s.phone ? " - " + s.phone : ""}</option>`).join("");

  openModal("Mensagem WhatsApp para cotação", `
    <label>Fornecedor / destino</label>
    <select id="quoteWhatsSupplier">${options}</select>
    <textarea rows="10" id="quoteWhatsText">${buildQuoteRequestMessage(q, suppliers[0]?.id || "")}</textarea>
    <button onclick="copyQuoteWhatsMessage()">Copiar mensagem</button>
    <button class="secondary" onclick="openQuoteWhatsWeb()">Abrir WhatsApp Web</button>
  `);

  const select = document.getElementById("quoteWhatsSupplier");
  select.onchange = () => {
    document.getElementById("quoteWhatsText").value = buildQuoteRequestMessage(q, select.value);
  };
}

function buildQuoteRequestMessage(q, supplierId){
  const supplier = state.suppliers.find(s=>s.id===supplierId);
  const itens = (q.items||[]).map(item=>`• ${item.name} — ${item.quantity} ${item.unit}`).join("\n");
  return `Olá${supplier ? ", " + supplier.name : ""}! Tudo bem?\n\nPode nos passar cotação dos itens abaixo?\n\n${itens}\n\nFavor informar marca, valor unitário, prazo de entrega e condição de pagamento.\n\nObrigado!`;
}

function copyQuoteWhatsMessage(){
  const txt = document.getElementById("quoteWhatsText").value;
  navigator.clipboard.writeText(txt);
  toast("Mensagem copiada");
}

function openQuoteWhatsWeb(){
  const supplierId = document.getElementById("quoteWhatsSupplier").value;
  const supplier = state.suppliers.find(s=>s.id===supplierId);
  const txt = encodeURIComponent(document.getElementById("quoteWhatsText").value);
  const phone = (supplier?.phone || "").replace(/\D/g,"");
  const url = phone ? `https://wa.me/55${phone}?text=${txt}` : `https://web.whatsapp.com/send?text=${txt}`;
  window.open(url, "_blank");
}

function printCurrentQuote(){
  const q = getCurrentQuoteOrWarn();
  if(!q) return;

  const rows = [];
  (q.items||[]).forEach(item=>{
    (q.suppliers||[]).forEach((s,idx)=>{
      const ans = (s.answers||[]).find(a=>a.productId===item.productId) || {};
      rows.push(`<tr>
        <td>${idx===0 ? item.name : ""}</td>
        <td>${idx===0 ? item.quantity + " " + item.unit : ""}</td>
        <td>${supplierName(s.supplierId)}</td>
        <td>${ans.brand || "-"}</td>
        <td>${ans.unitPrice ? "R$ " + Number(ans.unitPrice).toFixed(2) : "-"}</td>
        <td>${ans.deliveryTime || "-"}</td>
        <td>${ans.paymentCondition || "-"}</td>
        <td>${ans.note || "-"}</td>
      </tr>`);
    });
  });

  const html = `
    <html><head><title>${q.title}</title>
    <style>body{font-family:Arial;padding:30px}table{width:100%;border-collapse:collapse}td,th{border:1px solid #ccc;padding:8px;text-align:left}h1{margin-bottom:5px}</style>
    </head><body>
    <h1>Planilha de Cotação</h1>
    <p>${q.title}</p>
    <table>
      <thead><tr><th>Produto</th><th>Qtd</th><th>Fornecedor</th><th>Marca</th><th>Valor</th><th>Prazo</th><th>Pagamento</th><th>Observação</th></tr></thead>
      <tbody>${rows.join("")}</tbody>
    </table>
    </body></html>
  `;
  const win = window.open("", "_blank");
  win.document.write(html);
  win.document.close();
  win.print();
}

function exportCurrentQuoteCSV(){
  const q = getCurrentQuoteOrWarn();
  if(!q) return;

  const lines = [["Produto","Quantidade","Unidade","Fornecedor","Marca","Valor","Prazo","Pagamento","Observação"]];
  (q.items||[]).forEach(item=>{
    (q.suppliers||[]).forEach(s=>{
      const ans = (s.answers||[]).find(a=>a.productId===item.productId) || {};
      lines.push([
        item.name,
        item.quantity,
        item.unit,
        supplierName(s.supplierId),
        ans.brand || "",
        ans.unitPrice || "",
        ans.deliveryTime || "",
        ans.paymentCondition || "",
        ans.note || ""
      ]);
    });
  });

  const csv = lines.map(row=>row.map(cell=>`"${String(cell).replace(/"/g,'""')}"`).join(";")).join("\n");
  downloadTextFile(`cotacao-${q.title || "arquivo"}.csv`, csv, "text/csv;charset=utf-8");
}

function downloadSupplierQuoteFile(){
  const q = getCurrentQuoteOrWarn();
  if(!q) return;

  const payload = {
    type:"vetcore-cotacao",
    quote:{
      id:q.id,
      title:q.title,
      createdAt:q.createdAt,
      items:q.items,
      suppliers:(q.suppliers||[]).map(s=>({supplierId:s.supplierId,name:supplierName(s.supplierId)}))
    }
  };

  downloadTextFile(`cotacao-${q.title || q.id}.json`, JSON.stringify(payload,null,2), "application/json");
  toast("Arquivo de cotação gerado");
}

function openImportResponseModal(){
  openModal("Importar resposta do fornecedor", `
    <p class="muted">Importe um arquivo JSON de resposta do fornecedor.</p>
    <input type="file" id="supplierResponseFile" accept=".json">
    <button onclick="importSupplierResponseFile()">Importar resposta</button>
  `);
}

function importSupplierResponseFile(){
  const file = document.getElementById("supplierResponseFile").files[0];
  if(!file) return openModal("Atenção","<p>Selecione um arquivo JSON.</p>");

  const reader = new FileReader();
  reader.onload = async () => {
    try{
      const data = JSON.parse(reader.result);
      const qid = data.quoteId || data.quote?.id;
      const supplierId = data.supplierId;
      const answers = data.answers || [];

      if(!qid || !supplierId || !answers.length){
        throw new Error("Arquivo inválido. Precisa conter quoteId, supplierId e answers.");
      }

      await api(`/api/quotes/${qid}/respond`,{
        method:"POST",
        body:JSON.stringify({supplierId,answers})
      });

      closeModal();
      toast("Resposta importada");
      await load();
    }catch(e){
      openModal("Erro",`<p>${e.message}</p>`);
    }
  };
  reader.readAsText(file);
}

function downloadTextFile(filename, content, type="text/plain"){
  const blob = new Blob([content], {type});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.replace(/[\\/:*?"<>|]/g,"-");
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

async function importNfe(){try{const fd=new FormData();fd.append("xml",xmlFile.files[0]);const r=await fetch("/api/import-nfe",{method:"POST",body:fd});const j=await r.json();if(!r.ok)throw new Error(j.error);nfeMsg.textContent=`Importados ${j.imported} itens.`;await load()}catch(e){openModal("Erro",`<p>${e.message}</p>`)}}
function delSupplier(id){confirmModal("Excluir","Excluir fornecedor?",async()=>{await api("/api/suppliers/"+id,{method:"DELETE"});await load()})} function delUser(id){confirmModal("Excluir","Excluir usuário?",async()=>{await api("/api/users/"+id,{method:"DELETE"});await load()})} function delCategory(id){confirmModal("Excluir","Excluir categoria?",async()=>{await api("/api/categories/"+id,{method:"DELETE"});await load()})} function delProduct(id){confirmModal("Excluir","Excluir produto?",async()=>{await api("/api/products/"+id,{method:"DELETE"});await load()})} function delQuote(id){confirmModal("Excluir","Excluir cotação?",async()=>{await api("/api/quotes/"+id,{method:"DELETE"});await load()})}
async function logout(){await fetch("/api/logout",{method:"POST"});location.href="/"}
load().catch(e=>openModal("Erro",`<p>${e.message}</p>`));
