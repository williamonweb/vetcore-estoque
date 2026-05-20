
let state = {};
let selectedProduct = null;

async function api(url, opts = {}) {
  const o = { ...opts };
  if (o.body && !(o.body instanceof FormData)) o.headers = {"Content-Type":"application/json"};
  const r = await fetch(url, o);
  const j = await r.json().catch(()=>({}));
  if(!r.ok) throw new Error(j.error || "Erro");
  return j;
}

async function load(){
  state = await api("/api/state");
  state.products ||= [];
  state.categories ||= [];
  state.stockMoves ||= [];
  who.textContent = state.user?.name || "Saída de produtos";
  renderStockOuts();
  scanInput.focus();
}

function categoryName(id){
  return state.categories.find(c=>c.id===id)?.name || "-";
}

function productById(id){
  return state.products.find(p=>p.id===id);
}

function selectProduct(id){
  selectedProduct = productById(id);
  closeModal();
  renderSelected();
  beepOk();
  outQty.focus();
}

function renderSelected(){
  if(!selectedProduct){
    selectedProductBox.innerHTML = "Nenhum produto selecionado.";
    return;
  }
  selectedProductBox.innerHTML = `
    <div class="selected-product">
      <h2>${selectedProduct.name}</h2>
      <p><b>Estoque atual:</b> ${selectedProduct.stock} ${selectedProduct.unit || "un"}</p>
      <p><b>Categoria:</b> ${categoryName(selectedProduct.categoryId)}</p>
      <p><b>EAN:</b> ${selectedProduct.ean || "-"}</p>
    </div>
  `;
}

function findByEAN(){
  const code = scanInput.value.trim();
  if(!code){
    beepError();
    scanMsg.textContent = "Digite ou bipe um código.";
    return;
  }

  const p = state.products.find(p => String(p.ean || "").trim() === code || String(p.id) === code);
  if(!p){
    beepError();
    scanMsg.innerHTML = `<span class="bad">Produto não encontrado para o código ${code}.</span>`;
    return;
  }

  selectedProduct = p;
  scanMsg.innerHTML = `<span class="ok">Produto localizado: ${p.name}</span>`;
  scanInput.value = "";
  renderSelected();
  beepOk();
  outQty.focus();
}

scanInput?.addEventListener("keydown", e=>{
  if(e.key === "Enter") findByEAN();
});

async function saveStockOut(){
  try{
    if(!selectedProduct){
      beepError();
      return openModal("Atenção","<p>Selecione um produto primeiro.</p>");
    }

    const qty = Number(outQty.value || 0);
    if(qty <= 0){
      beepError();
      return openModal("Atenção","<p>Informe uma quantidade válida.</p>");
    }

    await api("/api/stock-out",{
      method:"POST",
      body:JSON.stringify({
        productId:selectedProduct.id,
        quantity:qty,
        note:outNote.value || ""
      })
    });

    toast("Saída registrada");
    beepOk();
    selectedProduct = null;
    outQty.value = 1;
    outNote.value = "";
    renderSelected();
    await load();
  }catch(e){
    beepError();
    openModal("Erro",`<p>${e.message}</p>`);
  }
}

function openProductSearch(){
  openModal("Pesquisar produto", `
    <input id="modalProductSearch" placeholder="Buscar por nome, categoria ou EAN" oninput="renderProductSearchList()">
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Produto</th>
            <th>Categoria</th>
            <th>EAN</th>
            <th>Estoque</th>
            <th>Ação</th>
          </tr>
        </thead>
        <tbody id="modalProductList"></tbody>
      </table>
    </div>
  `);
  renderProductSearchList();
  setTimeout(()=>document.getElementById("modalProductSearch")?.focus(), 100);
}

function renderProductSearchList(){
  const term = (document.getElementById("modalProductSearch")?.value || "").toLowerCase().trim();
  const filtered = state.products.filter(p => {
    const text = `${p.name||""} ${categoryName(p.categoryId)||""} ${p.ean||""}`.toLowerCase();
    return text.includes(term);
  });

  modalProductList.innerHTML = filtered.map(p=>`
    <tr>
      <td><b>${p.name}</b></td>
      <td>${categoryName(p.categoryId)}</td>
      <td>${p.ean || "-"}</td>
      <td>${p.stock} ${p.unit || "un"}</td>
      <td><button onclick="selectProduct('${p.id}')">Selecionar</button></td>
    </tr>
  `).join("") || '<tr><td colspan="5" class="muted">Nenhum produto encontrado.</td></tr>';
}

function renderStockOuts(){
  stockOutTable.innerHTML = [...state.stockMoves].reverse().map(m=>{
    const p = productById(m.productId);
    return `
      <tr>
        <td>${m.date ? new Date(m.date).toLocaleString("pt-BR") : "-"}</td>
        <td>${p ? p.name : "-"}</td>
        <td>-${m.quantity}</td>
        <td>${m.userName || "-"}</td>
        <td>${m.note || "-"}</td>
      </tr>
    `;
  }).join("") || '<tr><td colspan="5" class="muted">Nenhuma saída registrada.</td></tr>';
}

function beepOk(){
  beep(880, 100);
}

function beepError(){
  beep(220, 180);
}

function beep(freq, duration){
  try{
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = freq;
    osc.type = "sine";
    gain.gain.value = 0.08;
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    setTimeout(()=>{osc.stop();ctx.close();}, duration);
  }catch(e){}
}

async function logout(){
  await fetch("/api/logout",{method:"POST"});
  location.href="/";
}

load().catch(e=>openModal("Erro",`<p>${e.message}</p>`));
