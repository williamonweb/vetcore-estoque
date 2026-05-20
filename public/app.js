const BRL = new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'});
let db = JSON.parse(localStorage.getItem('vetcoreEstoqueCotacao')||'{"produtos":[],"movs":[],"cotacoes":{},"fornecedores":[]}');
db.produtos = db.produtos || []; db.movs = db.movs || []; db.cotacoes = db.cotacoes || {}; db.fornecedores = db.fornecedores || [];
const save=()=>localStorage.setItem('vetcoreEstoqueCotacao',JSON.stringify(db));
const $=id=>document.getElementById(id);
const uid=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,7);
const need=p=>Math.max(0, Number(p.minimo||0)-Number(p.estoque||0));
const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const chaveFornecedor=s=>String(s||'').trim().toLocaleLowerCase('pt-BR').normalize('NFD').replace(/[\u0300-\u036f]/g,'');

function init(){
 document.querySelectorAll('.nav').forEach(b=>b.onclick=()=>show(b.dataset.page,b));
 $('produtoForm').onsubmit=salvarProduto; $('movForm').onsubmit=registrarMov;
 if($('fornecedorForm')) $('fornecedorForm').onsubmit=salvarFornecedor;
 $('buscaProduto').oninput=render; $('importFile').onchange=importar;
 if($('buscaFornecedor')) $('buscaFornecedor').oninput=renderFornecedores;
 if($('xmlNfeFile')) $('xmlNfeFile').onchange=importarXmlNFe;
 $('modalBusca').oninput=renderModalProdutos;
 $('fornecedorMsg').onchange=montarMensagemFornecedor;
 $('cotacaoRespostaFile').onchange=importarRespostaFornecedor;
 render();
}
function show(page,btn){document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));$(page).classList.add('active');document.querySelectorAll('.nav').forEach(n=>n.classList.remove('active'));btn.classList.add('active');$('pageTitle').textContent=btn.textContent;render();}
function salvarProduto(e){e.preventDefault();let id=$('produtoId').value||uid();let antigo=db.produtos.find(p=>p.id===id);let p={id,nome:$('nome').value.trim(),categoria:$('categoria').value.trim(),fornecedor:$('fornecedor').value.trim(),ean:$('ean').value.trim(),estoque:+$('estoque').value||0,minimo:+$('minimo').value||0,valor:+$('valor').value||0,unidade:$('unidade').value,obs:$('obs').value.trim()}; if(antigo) Object.assign(antigo,p); else db.produtos.push(p); save(); limparProduto(); render();}
function limparProduto(){['produtoId','nome','categoria','ean','obs'].forEach(id=>$(id).value='');$('fornecedor').value='';$('estoque').value=0;$('minimo').value=0;$('valor').value=0;$('unidade').value='un';}
function editarProduto(id){let p=db.produtos.find(x=>x.id===id); if(!p)return; for(let k of ['nome','categoria','fornecedor','ean','estoque','minimo','valor','unidade','obs']) $(k).value=p[k]??''; $('produtoId').value=id; document.querySelector('[data-page="produtos"]').click();}
function excluirProduto(id){if(!confirm('Excluir este produto?'))return; db.produtos=db.produtos.filter(p=>p.id!==id); db.movs=db.movs.filter(m=>m.produtoId!==id); delete db.cotacoes[id]; save(); render();}

function abrirBuscaProduto(){ $('produtoModal').classList.add('active'); $('modalBusca').value=''; renderModalProdutos(); setTimeout(()=>$('modalBusca').focus(),50); }
function fecharBuscaProduto(){ $('produtoModal').classList.remove('active'); }
function renderModalProdutos(){
 const q=($('modalBusca').value||'').toLowerCase();
 const lista=db.produtos.filter(p=>[p.nome,p.categoria,p.fornecedor,p.ean].join(' ').toLowerCase().includes(q));
 $('modalProdutosTabela').innerHTML=lista.map(p=>`<tr><td><b>${esc(p.nome)}</b><br><small>${esc(p.categoria||'')} ${p.fornecedor?'- '+esc(p.fornecedor):''}</small></td><td>${p.estoque} ${esc(p.unidade)}</td><td>${esc(p.ean||'-')}</td><td><button class="mini" onclick="selecionarProdutoMov('${p.id}')">Selecionar</button></td></tr>`).join('')||'<tr><td colspan="4">Nenhum produto encontrado.</td></tr>';
}
function selecionarProdutoMov(id){let p=db.produtos.find(x=>x.id===id); if(!p)return; $('movProduto').value=p.id; $('movProdutoNome').value=`${p.nome} — estoque ${p.estoque} ${p.unidade}`; fecharBuscaProduto();}

function registrarMov(e){e.preventDefault();let p=db.produtos.find(x=>x.id===$('movProduto').value); if(!p)return alert('Clique na lupa e selecione um produto.');let qtd=+$('movQtd').value||0;if(qtd<=0)return alert('Informe uma quantidade válida.');let tipo=$('movTipo').value; if(tipo==='saida' && p.estoque-qtd<0 && !confirm('A saída vai deixar estoque negativo. Continuar?'))return; p.estoque += tipo==='entrada'?qtd:-qtd; let v=+$('movValor').value; if(tipo==='entrada'&&v>0)p.valor=v; db.movs.unshift({id:uid(),produtoId:p.id,nome:p.nome,tipo,qtd,obs:$('movObs').value,data:new Date().toLocaleString('pt-BR')}); save(); $('movQtd').value='';$('movValor').value='';$('movObs').value=''; selecionarProdutoMov(p.id); render();}
function gerarCotacao(){db.produtos.filter(p=>need(p)>0).forEach(p=>{db.cotacoes[p.id]=db.cotacoes[p.id]||{f1:p.fornecedor||'',v1:p.valor||0,f2:'',v2:0,f3:'',v3:0};}); save(); render(); alert('Cotação atualizada com os produtos abaixo do estoque mínimo.');}
function setCot(id,key,val){db.cotacoes[id]=db.cotacoes[id]||{}; db.cotacoes[id][key]=key.startsWith('v')?(+val||0):val; save(); renderResumo(); renderCotacaoFinal();}
function cotInfo(p){let c=db.cotacoes[p.id]||{};let arr=[{slot:'1',nome:c.f1||'Fornecedor 1',v:+c.v1||0,marca:c.marca1||'',prazo:c.prazo1||'',entrega:c.entrega1||'',pagamento:c.pagamento1||'',obsFornecedor:c.obsFornecedor1||''},{slot:'2',nome:c.f2||'Fornecedor 2',v:+c.v2||0,marca:c.marca2||'',prazo:c.prazo2||'',entrega:c.entrega2||'',pagamento:c.pagamento2||'',obsFornecedor:c.obsFornecedor2||''},{slot:'3',nome:c.f3||'Fornecedor 3',v:+c.v3||0,marca:c.marca3||'',prazo:c.prazo3||'',entrega:c.entrega3||'',pagamento:c.pagamento3||'',obsFornecedor:c.obsFornecedor3||''}].filter(x=>x.v>0); if(!arr.length)return null; arr.sort((a,b)=>a.v-b.v); return arr[0];}
function melhor(c){let arr=[{nome:c.f1||'Fornecedor 1',v:+c.v1||0},{nome:c.f2||'Fornecedor 2',v:+c.v2||0},{nome:c.f3||'Fornecedor 3',v:+c.v3||0}].filter(x=>x.v>0); if(!arr.length)return '-'; arr.sort((a,b)=>a.v-b.v); return `${esc(arr[0].nome)} - ${BRL.format(arr[0].v)}`;}
function comprasAtuais(){return db.produtos.filter(p=>need(p)>0);}

function salvarFornecedor(e){
 e.preventDefault();
 let id=$('fornecedorId').value||uid();
 let antigo=db.fornecedores.find(f=>f.id===id);
 let f={id,nome:$('fornNome').value.trim(),telefone:$('fornTelefone').value.trim(),contato:$('fornContato').value.trim(),email:$('fornEmail').value.trim(),cidade:$('fornCidade').value.trim(),obs:$('fornObs').value.trim()};
 if(!f.nome) return alert('Informe o nome do fornecedor.');
 if(antigo) Object.assign(antigo,f); else db.fornecedores.push(f);
 save(); limparFornecedor(); render();
}
function limparFornecedor(){['fornecedorId','fornNome','fornTelefone','fornContato','fornEmail','fornCidade','fornObs'].forEach(id=>{if($(id))$(id).value=''});}
function editarFornecedor(id){let f=db.fornecedores.find(x=>x.id===id); if(!f)return; $('fornecedorId').value=f.id; $('fornNome').value=f.nome||''; $('fornTelefone').value=f.telefone||''; $('fornContato').value=f.contato||''; $('fornEmail').value=f.email||''; $('fornCidade').value=f.cidade||''; $('fornObs').value=f.obs||''; document.querySelector('[data-page="fornecedores"]').click();}
function excluirFornecedor(id){let f=db.fornecedores.find(x=>x.id===id); if(!f)return; if(confirm('Excluir fornecedor '+f.nome+'?')){db.fornecedores=db.fornecedores.filter(x=>x.id!==id); save(); render();}}
function renderFornecedorSelect(){
 let atual=$('fornecedor')?.value||'';
 if(!$('fornecedor')) return;
 let nomes=[...new Set([...(db.fornecedores||[]).map(f=>f.nome), ...db.produtos.map(p=>p.fornecedor)].filter(Boolean))].sort((a,b)=>a.localeCompare(b,'pt-BR'));
 $('fornecedor').innerHTML='<option value="">Sem fornecedor</option>'+nomes.map(n=>`<option value="${esc(n)}">${esc(n)}</option>`).join('');
 $('fornecedor').value=atual;
}
function renderFornecedores(){
 if(!$('fornecedoresTabela')) return;
 let q=($('buscaFornecedor')?.value||'').toLowerCase();
 let lista=(db.fornecedores||[]).filter(f=>[f.nome,f.telefone,f.contato,f.email,f.cidade].join(' ').toLowerCase().includes(q));
 $('fornecedoresTabela').innerHTML=lista.map(f=>`<tr><td><b>${esc(f.nome)}</b><br><small>${esc(f.cidade||'')} ${f.obs?'- '+esc(f.obs):''}</small></td><td>${esc(f.telefone||'-')}</td><td>${esc(f.contato||'-')}</td><td>${esc(f.email||'-')}</td><td><button class="mini" onclick="editarFornecedor('${f.id}')">Editar</button><button class="mini danger" onclick="excluirFornecedor('${f.id}')">Excluir</button></td></tr>`).join('')||'<tr><td colspan="5">Nenhum fornecedor cadastrado.</td></tr>';
}

function render(){
 renderFornecedorSelect(); renderFornecedores();
 let q=($('buscaProduto')?.value||'').toLowerCase(); let produtos=db.produtos.filter(p=>[p.nome,p.categoria,p.fornecedor,p.ean].join(' ').toLowerCase().includes(q));
 $('produtosTabela').innerHTML=produtos.map(p=>`<tr><td><b>${esc(p.nome)}</b><br><small>${esc(p.categoria||'')} ${p.ean?'- '+esc(p.ean):''}</small></td><td>${p.estoque} ${esc(p.unidade)}</td><td>${p.minimo} ${esc(p.unidade)}</td><td>${BRL.format(p.valor)}</td><td><span class="tag ${need(p)>0?'low':'ok'}">${need(p)>0?'Comprar':'OK'}</span></td><td><button class="mini" onclick="editarProduto('${p.id}')">Editar</button><button class="mini danger" onclick="excluirProduto('${p.id}')">Excluir</button></td></tr>`).join('')||'<tr><td colspan="6">Nenhum produto cadastrado.</td></tr>';
 $('movTabela').innerHTML=db.movs.slice(0,100).map(m=>`<tr><td>${esc(m.data)}</td><td>${esc(m.nome)}</td><td>${m.tipo==='entrada'?'Entrada':'Saída'}</td><td>${m.qtd}</td><td>${esc(m.obs||'')}</td></tr>`).join('')||'<tr><td colspan="5">Sem movimentações.</td></tr>';
 let compras=comprasAtuais();
 let linhas=compras.map(p=>`<tr><td><b>${esc(p.nome)}</b></td><td>${p.estoque} ${esc(p.unidade)}</td><td>${p.minimo} ${esc(p.unidade)}</td><td>${need(p)} ${esc(p.unidade)}</td><td>${esc(p.fornecedor||'-')}</td><td>${BRL.format(need(p)*(+p.valor||0))}</td></tr>`).join('')||'<tr><td colspan="6">Nenhum item abaixo do mínimo.</td></tr>';
 $('comprasTabela').innerHTML=linhas; $('dashCompras').innerHTML=compras.map(p=>`<tr><td>${esc(p.nome)}</td><td>${p.estoque}</td><td>${p.minimo}</td><td>${need(p)}</td><td>${esc(p.fornecedor||'-')}</td></tr>`).join('')||'<tr><td colspan="5">Tudo em dia.</td></tr>';
 $('cotacaoTabela').innerHTML=compras.map(p=>{let c=db.cotacoes[p.id]||{f1:p.fornecedor||'',v1:p.valor||0};return `<tr><td><b>${esc(p.nome)}</b><br><small>Qtd: ${need(p)} ${esc(p.unidade)}</small></td><td>${need(p)}</td><td><input value="${esc(c.f1||'')}" onchange="setCot('${p.id}','f1',this.value)"></td><td><input type="number" step="0.01" value="${c.v1||0}" onchange="setCot('${p.id}','v1',this.value)"></td><td><input value="${esc(c.f2||'')}" onchange="setCot('${p.id}','f2',this.value)"></td><td><input type="number" step="0.01" value="${c.v2||0}" onchange="setCot('${p.id}','v2',this.value)"></td><td><input value="${esc(c.f3||'')}" onchange="setCot('${p.id}','f3',this.value)"></td><td><input type="number" step="0.01" value="${c.v3||0}" onchange="setCot('${p.id}','v3',this.value)"></td><td>${melhor(c)}</td></tr>`}).join('')||'<tr><td colspan="9">Nenhum produto precisa de cotação.</td></tr>';
 renderCotacaoFinal(); renderResumo();
}
function fornecedoresDoProduto(p){
 let c=db.cotacoes[p.id]||{};
 let nomes=[c.f1,c.f2,c.f3,p.fornecedor].map(x=>(x||'').trim()).filter(Boolean);
 return [...new Set(nomes)];
}
function itensPorFornecedorParaMensagem(){
 let grupos={};
 comprasAtuais().forEach(p=>{
  let qtd=need(p);
  fornecedoresDoProduto(p).forEach(nome=>{
   if(!grupos[nome]) grupos[nome]={fornecedor:nome,itens:[]};
   grupos[nome].itens.push({produto:p.nome,qtd,unidade:p.unidade,obs:p.obs||''});
  });
 });
 return Object.values(grupos).sort((a,b)=>a.fornecedor.localeCompare(b.fornecedor));
}
function itensVencedoresPorFornecedor(){
 let grupos={};
 comprasAtuais().forEach(p=>{
  let m=cotInfo(p); if(!m) return;
  let qtd=need(p), sub=qtd*m.v;
  let fornecedor=(m.nome||'Sem fornecedor').trim();
  let chave=chaveFornecedor(fornecedor);
  if(!grupos[chave]) grupos[chave]={fornecedor,itens:[],total:0};
  grupos[chave].itens.push({produto:p.nome,qtd,unidade:p.unidade,valor:m.v,total:sub,marca:m.marca||'',obs:p.obs||''});
  grupos[chave].total+=sub;
 });
 return Object.values(grupos).sort((a,b)=>a.fornecedor.localeCompare(b.fornecedor));
}
function renderCotacaoFinal(){
 let total=0;
 let linhas=comprasAtuais().map(p=>{let m=cotInfo(p);let qtd=need(p);let sub=m?qtd*m.v:0;total+=sub;return `<tr><td><b>${esc(p.nome)}</b></td><td>${qtd} ${esc(p.unidade)}</td><td>${m?esc(m.nome):'-'}</td><td>${m?BRL.format(m.v):'-'}${m&&m.marca?'<br><small>Marca: '+esc(m.marca)+'</small>':''}${m&&m.prazo?'<br><small>Prazo: '+esc(m.prazo)+'</small>':''}</td><td>${m?BRL.format(sub):'-'}</td></tr>`}).join('')||'<tr><td colspan="5">Nenhum resultado de cotação.</td></tr>';
 $('cotacaoFinalTabela').innerHTML=linhas;
 let grupos=itensVencedoresPorFornecedor();
 $('cotacaoFornecedorTabela').innerHTML=grupos.map(g=>`<tr><td><b>${esc(g.fornecedor)}</b></td><td>${g.itens.map(i=>`${esc(i.produto)} — ${i.qtd} ${esc(i.unidade)}${i.marca?' — Marca: '+esc(i.marca):''} — ${BRL.format(i.valor)} cada`).join('<br>')}<br><small>Total: ${BRL.format(g.total)}</small></td><td><button class="mini" onclick="abrirMensagemGrupoFornecedor('${encodeURIComponent(g.fornecedor)}')">Mensagem WhatsApp</button><button class="mini" onclick="gerarPDFFornecedor('${encodeURIComponent(g.fornecedor)}')">PDF</button></td></tr>`).join('')||'<tr><td colspan="3">Preencha os valores na planilha de cotação para gerar os vencedores agrupados.</td></tr>';
 if($('cotacaoTotalFinal')) $('cotacaoTotalFinal').textContent=BRL.format(total);
}
function renderResumo(){let baixo=comprasAtuais();$('kProdutos').textContent=db.produtos.length;$('kMinimo').textContent=baixo.length;$('kValor').textContent=BRL.format(db.produtos.reduce((s,p)=>s+(+p.estoque||0)*(+p.valor||0),0));$('kCompra').textContent=BRL.format(baixo.reduce((s,p)=>s+need(p)*(+p.valor||0),0));$('resumoRelatorio').innerHTML=`<p><b>Produtos cadastrados:</b> ${db.produtos.length}</p><p><b>Itens abaixo do mínimo:</b> ${baixo.length}</p><p><b>Movimentações registradas:</b> ${db.movs.length}</p>`;}

function fornecedoresDaCotacao(){return itensVencedoresPorFornecedor().map(g=>g.fornecedor);}
function abrirMensagemFornecedor(){let fs=fornecedoresDaCotacao();$('fornecedorMsg').innerHTML='<option value="todos">Todos os itens</option>'+fs.map(f=>`<option value="${esc(f)}">${esc(f)}</option>`).join('');$('mensagemModal').classList.add('active');montarMensagemFornecedor();}
function fecharMensagemFornecedor(){$('mensagemModal').classList.remove('active');}
function textoGrupoFornecedor(g){
 let txt=`Olá! Segue lista dos itens aprovados na cotação\n\n`;
 g.itens.forEach(i=>{txt+=`- ${i.produto}: ${i.qtd} ${i.unidade}${i.marca?` - Marca: ${i.marca}`:''}${i.obs?` (${i.obs})`:''}\n`;});
 txt+='\nPor favor informar valor unitário, prazo de entrega e forma de pagamento. Obrigado!';
 return txt;
}
function montarMensagemFornecedor(){
 let f=$('fornecedorMsg').value;
 if(f==='todos'){
  let txt='Olá! Segue lista dos itens aprovados na cotação\n\n';
  comprasAtuais().forEach(p=>txt+=`- ${p.nome}: ${need(p)} ${p.unidade}\n`);
  txt+='\nPor favor informar valor unitário, prazo de entrega e forma de pagamento. Obrigado!';
  $('mensagemTexto').value=txt; return;
 }
 let g=itensVencedoresPorFornecedor().find(x=>chaveFornecedor(x.fornecedor)===chaveFornecedor(f));
 $('mensagemTexto').value=g?textoGrupoFornecedor(g):'';
}
function copiarMensagem(){navigator.clipboard?.writeText($('mensagemTexto').value);alert('Mensagem copiada.');}
function abrirWhatsApp(){window.open('https://web.whatsapp.com/send?text='+encodeURIComponent($('mensagemTexto').value),'_blank');}
function grupoMensagemFornecedorPorNome(nome){nome=decodeURIComponent(nome);return itensVencedoresPorFornecedor().find(g=>chaveFornecedor(g.fornecedor)===chaveFornecedor(nome));}
function abrirMensagemGrupoFornecedor(nome){
 let g=grupoMensagemFornecedorPorNome(nome); if(!g)return alert('Fornecedor não encontrado.');
 $('fornecedorMsg').innerHTML=`<option value="${esc(g.fornecedor)}">${esc(g.fornecedor)}</option>`;
 $('mensagemTexto').value=textoGrupoFornecedor(g);
 $('mensagemModal').classList.add('active');
}
function grupoFornecedorPorNome(nome){nome=decodeURIComponent(nome);return itensVencedoresPorFornecedor().find(g=>g.fornecedor===nome);}
function textoFornecedorFinal(nome){
 let g=grupoFornecedorPorNome(nome); if(!g)return '';
 let txt=`Olá! Segue pedido conforme cotação aprovada para ${g.fornecedor}:\n\n`;
 g.itens.forEach(i=>{txt+=`- ${i.produto}: ${i.qtd} ${i.unidade}${i.marca?` - Marca: ${i.marca}`:''} x ${BRL.format(i.valor)} = ${BRL.format(i.total)}\n`;});
 txt+=`\nTotal previsto: ${BRL.format(g.total)}\n\nPode confirmar disponibilidade, prazo de entrega e forma de pagamento? Obrigado!`;
 return txt;
}
function mensagemWhatsFornecedor(nome){
 let txt=textoFornecedorFinal(nome); if(!txt)return alert('Fornecedor não encontrado.');
 $('mensagemTexto').value=txt;
 $('mensagemModal').classList.add('active');
}
function gerarPDFSolicitacaoFornecedor(nome){
 let g=grupoMensagemFornecedorPorNome(nome); if(!g)return alert('Fornecedor não encontrado.');
 let data=new Date().toLocaleDateString('pt-BR');
 let rows=g.itens.map(i=>`<tr><td>${esc(i.produto)}</td><td>${i.qtd} ${esc(i.unidade)}</td><td></td><td></td></tr>`).join('');
 let html=`<!doctype html><html><head><meta charset="utf-8"><title>Solicitação de cotação - ${esc(g.fornecedor)}</title><style>body{font-family:Arial,sans-serif;padding:32px;color:#111}header{border-bottom:3px solid #0f766e;margin-bottom:24px;padding-bottom:14px}h1{margin:0;color:#0f766e}table{width:100%;border-collapse:collapse;margin-top:18px}th,td{border:1px solid #ddd;padding:10px;text-align:left}th{background:#f2f7f6}@media print{button{display:none}}</style></head><body><button onclick="window.print()">Imprimir / Salvar PDF</button><header><h1>VetCore - Solicitação de Cotação</h1><p><b>Fornecedor:</b> ${esc(g.fornecedor)}<br><b>Data:</b> ${data}</p></header><table><thead><tr><th>Produto</th><th>Quantidade</th><th>Valor unitário</th><th>Prazo</th></tr></thead><tbody>${rows}</tbody></table><p><b>Observações:</b> favor informar disponibilidade, valor unitário, prazo de entrega e forma de pagamento.</p><script>setTimeout(()=>window.print(),300)<\/script></body></html>`;
 let w=window.open('','_blank'); w.document.write(html); w.document.close();
}
function gerarPDFFornecedor(nome){
 let g=grupoFornecedorPorNome(nome); if(!g)return alert('Fornecedor não encontrado.');
 let data=new Date().toLocaleDateString('pt-BR');
 let rows=g.itens.map(i=>`<tr><td>${esc(i.produto)}</td><td>${i.qtd} ${esc(i.unidade)}</td><td>${esc(i.marca||'-')}</td><td>${BRL.format(i.valor)}</td><td>${BRL.format(i.total)}</td></tr>`).join('');
 let html=`<!doctype html><html><head><meta charset="utf-8"><title>Cotação - ${esc(g.fornecedor)}</title><style>body{font-family:Arial,sans-serif;padding:32px;color:#111}header{border-bottom:3px solid #0f766e;margin-bottom:24px;padding-bottom:14px}h1{margin:0;color:#0f766e}table{width:100%;border-collapse:collapse;margin-top:18px}th,td{border:1px solid #ddd;padding:10px;text-align:left}th{background:#f2f7f6}tfoot th{font-size:18px}.assinatura{margin-top:45px;border-top:1px solid #999;width:280px;text-align:center;padding-top:8px}@media print{button{display:none}}</style></head><body><button onclick="window.print()">Imprimir / Salvar PDF</button><header><h1>VetCore - Cotação aprovada</h1><p><b>Fornecedor:</b> ${esc(g.fornecedor)}<br><b>Data:</b> ${data}</p></header><table><thead><tr><th>Produto</th><th>Quantidade</th><th>Marca</th><th>Valor unit.</th><th>Total</th></tr></thead><tbody>${rows}</tbody><tfoot><tr><th colspan="4">Total previsto</th><th>${BRL.format(g.total)}</th></tr></tfoot></table><p><b>Observações:</b> confirmar disponibilidade, prazo de entrega e forma de pagamento.</p><div class="assinatura">Responsável</div><script>setTimeout(()=>window.print(),300)<\/script></body></html>`;
 let w=window.open('','_blank'); w.document.write(html); w.document.close();
}
function gerarPDFCotacao(){document.querySelector('[data-page="cotacao"]').click();setTimeout(()=>window.print(),100);}
function exportarCotacaoCSV(){let csv='Produto;Quantidade;Unidade;Fornecedor 1;Marca 1;Valor 1;Fornecedor 2;Marca 2;Valor 2;Fornecedor 3;Marca 3;Valor 3;Fornecedor vencedor;Marca vencedora;Valor vencedor;Total\n';comprasAtuais().forEach(p=>{let c=db.cotacoes[p.id]||{};let m=cotInfo(p);let qtd=need(p);csv+=[p.nome,qtd,p.unidade,c.f1||'',c.marca1||'',c.v1||'',c.f2||'',c.marca2||'',c.v2||'',c.f3||'',c.marca3||'',c.v3||'',m?m.nome:'',m?m.marca:'',m?m.v:'',m?m.v*qtd:''].map(x=>`"${String(x).replaceAll('"','""')}"`).join(';')+'\n';});let a=document.createElement('a');a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));a.download='cotacao-vetcore.csv';a.click();}


function exportarArquivoFornecedor(){
 let itens=comprasAtuais();
 if(!itens.length) return alert('Nenhum produto abaixo do mínimo para cotar.');
 let fornecedor=prompt('Nome do fornecedor que vai receber esta cotação:');
 if(!fornecedor) return;
 let pacote={tipo:'vetcore-cotacao-fornecedor',versao:1,fornecedor:fornecedor.trim(),data:new Date().toISOString(),itens:itens.map(p=>({produtoId:p.id,produto:p.nome,qtd:need(p),unidade:p.unidade,obs:p.obs||'',categoria:p.categoria||'',ean:p.ean||''}))};
 let a=document.createElement('a');
 a.href=URL.createObjectURL(new Blob([JSON.stringify(pacote,null,2)],{type:'application/json'}));
 a.download='cotacao-'+fornecedor.trim().replace(/[^a-z0-9]+/gi,'-').toLowerCase()+'.json';
 a.click();
 alert('Arquivo gerado. Envie junto com o arquivo fornecedor.html para o fornecedor preencher offline.');
}
function aplicarRespostaNoSlot(item, fornecedor, valor, marca, prazo, entrega, pagamento, obs){
 db.cotacoes[item.produtoId]=db.cotacoes[item.produtoId]||{};
 let c=db.cotacoes[item.produtoId];
 let slots=['1','2','3'];
 let slot=slots.find(n=>chaveFornecedor(c['f'+n])===chaveFornecedor(fornecedor));
 if(!slot) slot=slots.find(n=>!String(c['f'+n]||'').trim());
 if(!slot) slot='3';
 c['f'+slot]=fornecedor;
 c['v'+slot]=+valor||0;
 c['marca'+slot]=marca||'';
 c['prazo'+slot]=prazo||'';
 c['entrega'+slot]=entrega||'';
 c['pagamento'+slot]=pagamento||'';
 c['obsFornecedor'+slot]=obs||'';
}
function importarRespostaFornecedor(e){
 let f=e.target.files[0]; if(!f) return;
 let r=new FileReader();
 r.onload=()=>{
  try{
   let resp=JSON.parse(r.result);
   if(resp.tipo!=='vetcore-resposta-cotacao' || !Array.isArray(resp.itens)) throw new Error('tipo inválido');
   let fornecedor=(resp.fornecedor||'Fornecedor').trim();
   let total=0;
   resp.itens.forEach(i=>{ if((+i.valor||0)>0){ aplicarRespostaNoSlot(i,fornecedor,i.valor,i.marca,i.prazo,i.entrega,i.pagamento,i.obs); total++; }});
   save(); render(); alert(`Resposta importada: ${fornecedor}\nItens com valor: ${total}`);
  }catch(err){ alert('Arquivo de resposta inválido.'); }
  e.target.value='';
 };
 r.readAsText(f);
}

function imprimirCompras(){document.querySelector('[data-page="compras"]').click(); setTimeout(()=>window.print(),100);}
function backup(){let a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(db,null,2)],{type:'application/json'}));a.download='backup-vetcore-estoque.json';a.click();}
function importar(e){let f=e.target.files[0]; if(!f)return; let r=new FileReader(); r.onload=()=>{try{db=JSON.parse(r.result); if(!db.cotacoes)db.cotacoes={}; if(!db.fornecedores)db.fornecedores=[]; save();render();alert('Backup importado.')}catch{alert('Arquivo inválido.')}}; r.readAsText(f);}
function exportarCSV(){let csv='Produto;Categoria;Fornecedor;Estoque;Minimo;Valor\n'+db.produtos.map(p=>[p.nome,p.categoria,p.fornecedor,p.estoque,p.minimo,p.valor].map(x=>`"${String(x).replaceAll('"','""')}"`).join(';')).join('\n');let a=document.createElement('a');a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));a.download='produtos-vetcore.csv';a.click();}
function limparTudo(){if(confirm('Zerar todos os dados? Faça backup antes.')){db={produtos:[],movs:[],cotacoes:{},fornecedores:[]};save();render();}}
function textoXml(el,tag){let n=el.getElementsByTagName(tag)[0]; return n ? (n.textContent||'').trim() : '';}
function numXml(el,tag){let v=textoXml(el,tag).replace(',','.'); return Number(v)||0;}
function acharProdutoNFe(item){
 let ean=(item.ean||'').trim(); let cod=(item.codigo||'').trim(); let nome=(item.nome||'').trim().toLowerCase();
 return db.produtos.find(p=>(ean && p.ean===ean)||(cod && p.ean===cod)||(p.nome||'').trim().toLowerCase()===nome);
}
function importarXmlNFe(e){
 let f=e.target.files[0]; if(!f) return;
 let r=new FileReader();
 r.onload=()=>{
  try{
   let xml=new DOMParser().parseFromString(r.result,'text/xml');
   if(xml.getElementsByTagName('parsererror').length) throw new Error('XML inválido');
   let emit=xml.getElementsByTagName('emit')[0];
   let fornecedorNf=emit ? textoXml(emit,'xNome') : '';
   if(fornecedorNf && !(db.fornecedores||[]).some(x=>chaveFornecedor(x.nome)===chaveFornecedor(fornecedorNf))){db.fornecedores.push({id:uid(),nome:fornecedorNf,telefone:'',contato:'',email:'',cidade:'',obs:'Importado de XML NF-e'});}
   let dets=[...xml.getElementsByTagName('det')];
   if(!dets.length) return alert('Não encontrei itens nesse XML.');
   let totalItens=0;
   dets.forEach(det=>{
    let prod=det.getElementsByTagName('prod')[0]; if(!prod) return;
    let item={nome:textoXml(prod,'xProd'),codigo:textoXml(prod,'cProd'),ean:textoXml(prod,'cEAN')||textoXml(prod,'cEANTrib'),unidade:textoXml(prod,'uCom')||'un',qtd:numXml(prod,'qCom')||numXml(prod,'qTrib'),valor:numXml(prod,'vUnCom')||numXml(prod,'vUnTrib')};
    if(!item.nome || !item.qtd) return;
    let p=acharProdutoNFe(item);
    if(!p){p={id:uid(),nome:item.nome,categoria:'',fornecedor:fornecedorNf,ean:(item.ean&&item.ean!=='SEM GTIN')?item.ean:item.codigo,estoque:0,minimo:0,valor:item.valor||0,unidade:item.unidade,obs:'Cadastrado via XML NF-e'}; db.produtos.push(p);}
    p.estoque=(+p.estoque||0)+item.qtd;
    if(item.valor) p.valor=item.valor;
    if(fornecedorNf) p.fornecedor=fornecedorNf;
    db.movs.unshift({id:uid(),data:new Date().toLocaleString('pt-BR'),produtoId:p.id,produto:p.nome,tipo:'entrada',qtd:item.qtd,obs:`Entrada automática por XML NF-e${fornecedorNf?' - '+fornecedorNf:''}`});
    totalItens++;
   });
   save(); render(); alert(`XML importado. Entrada registrada em ${totalItens} item(ns).`);
  }catch(err){ alert('Não consegui importar esse XML. Verifique se é XML de NF-e válido.'); }
  e.target.value='';
 };
 r.readAsText(f);
}

init();
