
function openModal(title, html){
  document.getElementById("mt").textContent = title;
  document.getElementById("mb").innerHTML = html;
  document.getElementById("modal").classList.remove("hidden");
}
function closeModal(){document.getElementById("modal").classList.add("hidden")}
function toast(msg){
  const t=document.createElement("div"); t.className="toast"; t.textContent=msg;
  document.body.appendChild(t); setTimeout(()=>t.remove(),2600);
}
function confirmModal(title,msg,onYes){
  openModal(title,`<p>${msg}</p><button id="yesConfirm">Confirmar</button><button class="secondary" onclick="closeModal()">Cancelar</button>`);
  document.getElementById("yesConfirm").onclick=()=>{closeModal();onYes()};
}
document.addEventListener("keydown",e=>{if(e.key==="Escape"&&document.getElementById("modal"))closeModal()});
document.addEventListener("click",e=>{if(e.target?.id==="modal")closeModal()});
