
const $=s=>document.querySelector(s), VW=$("#view");
const MESES=["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"];
const MES3=["ene","feb","mar","abr","may","jun","jul","ago","sep","oct","nov","dic"];
const DIAS=["dom","lun","mar","mié","jue","vie","sáb"];
const ANIO={"2":"2/o.","3":"3/er.","4":"4/o.","T":"T.S.U."};
const MK={quir:"Enfermería Quirúrgica",mq:"Médico Quirúrgica",fund:"Fundamentos I",sp:"Salud Pública",psiq:"Enfermería Psiquiátrica",tsu:"Médico Quirúrgica T.S.U."};
const YEAR_MK={"4":["quir","psiq"],"3":["sp","mq"],"2":["fund"]};
// [clave, etiqueta, singular en el parte, plural en el parte]
const MOT=[["servicio","Servicio","servicio","servicios"],["cita","Cita programada","cita programada","citas programadas"],["comision","Comisión","comisión","comisión"],
  ["exceptuacion","Exceptuación","exceptuado","exceptuados"],["encamado","Pelotón de sanidad","encamado en el pelotón de sanidad","encamados en el pelotón de sanidad"]];
// motivos anteriores: se conservan solo para mostrar registros viejos
const MOT_OLD=[["guardia","Guardia","guardia","guardias"],["lab","Laboratorios","laboratorios","laboratorios"],["permiso","Permiso","permiso","permisos"],["arresto","Arresto","arresto","arrestos"],["injust","Sin justificación","falta injustificada","faltas injustificadas"],["otro","Otro","otro","otros"]];
const MOT_ALL=[...MOT,...MOT_OLD];
const motOpts=cur=>[...MOT,...MOT_OLD.filter(m=>m[0]===cur)].map(m=>`<option value="${m[0]}" ${m[0]===cur?"selected":""}>${m[1]}</option>`).join("");
const MOT_TXT=Object.fromEntries(MOT_ALL.map(m=>[m[0],m[1]]));
const TIPOS=[["falta","Inasistencia"],["retardo","Retardo"],["anecdota","Anecdotario"],["arresto","Arresto"]];
const TIPO_TXT=Object.fromEntries(TIPOS);
const REP=[["pendiente","Por reponer"],["solicitada","Reposición solicitada"],["repuesta","Repuesta"],["no","No aplica"]];
const REP_TXT=Object.fromEntries(REP);
const S={cad:new Map(),prac:new Map(),ev:new Map(),par:new Map(),bit:new Map(),
  cfg:{minimo:6,riesgoPct:30,pesos:{inst:40,ti:30,ev:30}},db:null,view:"pan",loaded:0,
  pf:{f:null,t:"1"},cf:{q:"",a:"",g:"",p:"",est:""},nf:{sub:"falta",desde:"",hasta:"",p:"",rep:""},
  wk:null,calf:{mk:"",p:"",ins:""}};
const norm=s=>(s||"").normalize("NFD").replace(/[̀-ͯ]/g,"").toLowerCase();
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const pad=n=>String(n).padStart(2,"0");
const isoOf=d=>`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
const today=()=>isoOf(new Date());
const dOf=iso=>{const [y,m,d]=iso.split("-").map(Number);return new Date(y,m-1,d)};
const dow=iso=>dOf(iso).getDay();
const addD=(iso,n)=>{const d=dOf(iso);d.setDate(d.getDate()+n);return isoOf(d)};
const monday=iso=>{const w=dow(iso);return addD(iso,w===0?-6:1-w)};
const fCorta=iso=>{if(!iso)return "—";const d=dOf(iso);return `${DIAS[d.getDay()]} ${d.getDate()} ${MES3[d.getMonth()]}`};
const fLarga=iso=>{const d=dOf(iso);return `${d.getDate()} de ${MESES[d.getMonth()]} de ${d.getFullYear()}`};
const num=v=>v===""||v==null||isNaN(v)?null:Number(v);
const uid=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,7);
let tT;function toast(m){const t=$("#toast");t.textContent=m;t.classList.add("on");clearTimeout(tT);tT=setTimeout(()=>t.classList.remove("on"),2600)}
function notice(m){const n=$("#notice");n.textContent=m||"";n.hidden=!m}
const yrChip=a=>`<span class="yr y${a}">${ANIO[a]||a}</span>`;

/* ---------- derivados ---------- */
const instr=p=>((p.instructoras&&p.instructoras.length)?p.instructoras:[p.docente]).filter(Boolean);
const pracs=()=>[...S.prac.entries()].map(([id,p])=>({id,...p})).sort((a,b)=>(a.orden??99)-(b.orden??99));
const cads=()=>[...S.cad.entries()].map(([id,c])=>({id,...c}));
const evs=()=>[...S.ev.entries()].map(([id,e])=>({id,...e}));
const activa=(p,f)=>p.ini<=f&&f<=p.fin&&(p.dias||[]).includes(dow(f));
const enPeriodo=(p,f)=>p.ini<=f&&f<=p.fin;
function roster(pid){return cads().filter(c=>Object.values(c.asig||{}).some(a=>a.p===pid)).sort(cmpCad)}
function cmpCad(a,b){return (a.a+a.g).localeCompare(b.a+b.g)||a.n.localeCompare(b.n,"es")}
function efectivo(p){return p.efectivo||roster(p.id).length}
function pracLabel(p,short){if(!p)return "Sin práctica";return short?`${p.sede} · ${MK[p.mk]||p.materia}${p.turno==="2"?" (2/o. turno)":""}`:`${p.materia} · ${p.sede} · ${p.turno==="2"?"2/o.":"1/er."} turno`}
function pracActual(c,f){f=f||today();const L=Object.entries(c.asig||{}).map(([mk,a])=>({mk,...a,pr:S.prac.get(a.p)})).filter(x=>x.pr);
  return L.find(x=>enPeriodo(x.pr,f))||L.filter(x=>x.pr.ini>f).sort((a,b)=>a.pr.ini.localeCompare(b.pr.ini))[0]||L.sort((a,b)=>b.pr.fin.localeCompare(a.pr.fin))[0]||null}
function evDe(cid){return evs().filter(e=>e.c===cid).sort((a,b)=>b.f.localeCompare(a.f))}
const cnt=e=>Math.max(1,Math.round(num(e.d)||1));
const sumC=L=>L.reduce((s,e)=>s+cnt(e),0);
const isoOk=v=>typeof v==="string"&&/^\d{4}-\d{2}-\d{2}$/.test(v);
function stats(cid){const E=evDe(cid);const fal=E.filter(e=>e.t==="falta");
  return {fj:sumC(fal.filter(e=>e.j)),fi:sumC(fal.filter(e=>!e.j)),rep:sumC(fal.filter(e=>(e.rep||"pendiente")==="pendiente")),
    ret:E.filter(e=>e.t==="retardo").length,anP:E.filter(e=>e.t==="anecdota"&&e.pol!=="neg").length,anN:E.filter(e=>e.t==="anecdota"&&e.pol==="neg").length,
    arr:E.filter(e=>e.t==="arresto").length,hrs:E.filter(e=>e.t==="arresto").reduce((s,e)=>s+(num(e.h)||0),0)}}
function califFinal(c){if(!c)return null;const p=S.cfg.pesos||{inst:40,ti:30,ev:30};const v=[["inst",p.inst],["ti",p.ti],["ev",p.ev]];
  if(v.some(([k])=>num(c[k])==null))return null;const tot=v.reduce((s,[,w])=>s+(+w||0),0)||100;
  return Math.round(v.reduce((s,[k,w])=>s+num(c[k])*(+w||0),0)/tot*100)/100}
const DPC=new Map();
const HMAT_DEF={fund:275,mq:200,sp:75,quir:185};
const HD=()=>num(S.cfg.horasDia)??5;
const hMat=mk=>{const h=(S.cfg.horasMateria||{})[mk];return num(h)??HMAT_DEF[mk]??null};
function horasProg(p){if(!p)return 0;return hMat(p.mk)??diasProg(p)*HD()}
function diasProg(p){if(!p)return 0;const k=`${p.ini}|${p.fin}|${(p.dias||[]).join()}`;if(DPC.has(k))return DPC.get(k);
  let n=0,f=p.ini;const dd=p.dias||[];if(p.ini&&p.fin)while(f<=p.fin){if(dd.includes(dow(f)))n++;f=addD(f,1)}DPC.set(k,n);return n}
const RPCT=()=>(num(S.cfg.riesgoPct)??30)/100;
function riesgoDe(cid){const c=S.cad.get(cid);if(!c)return [];const F=evs().filter(e=>e.c===cid&&e.t==="falta");
  return Object.entries(c.asig||{}).map(([mk,a])=>{const p=S.prac.get(a.p);if(!p)return null;const tot=horasProg(p);const n=sumC(F.filter(e=>e.p===a.p));const h=n*HD();return {mk,p:{id:a.p,...p},n,h,tot,pct:tot?h/tot:0}}).filter(Boolean)}
function peorRiesgo(cid){return riesgoDe(cid).sort((a,b)=>b.pct-a.pct)[0]||null}
const nivel=r=>!r||!r.n?"":r.pct>=RPCT()?"riesgo":r.pct>=RPCT()*2/3?"cerca":"";
const pctTxt=r=>`${r.h} h de ${r.tot} h (${(r.pct*100).toFixed(1)} %)`;
function riskBox(){const RS=cads().map(c=>({c,r:peorRiesgo(c.id)})).filter(x=>x.r&&x.r.n);const pc=Math.round(RPCT()*100);
  const enR=RS.filter(x=>nivel(x.r)==="riesgo").sort((a,b)=>b.r.pct-a.r.pct),cer=RS.filter(x=>nivel(x.r)==="cerca").sort((a,b)=>b.r.pct-a.r.pct);
  const item=(x,cl)=>`<div class="it" style="grid-template-columns:1fr auto"><span><button class="nameb" data-c="${x.c.id}">${esc(x.c.n)}</button><span class="sub">${ANIO[x.c.a]} año · Grupo ${esc(x.c.g)} · ${esc(pracLabel(x.r.p,true))}</span><span class="meter" style="--mc:${cl==="b-bad"?"var(--bad)":"var(--warn)"}" role="img" aria-label="${pctTxt(x.r)}"><i style="width:${Math.min(100,x.r.pct/(RPCT()*1.5)*100).toFixed(1)}%"></i><em style="left:${(100/1.5).toFixed(1)}%"></em></span></span><span class="badge ${cl}">${pctTxt(x.r)}</span></div>`;
  return `<section class="box"><h3>Cadetes en riesgo por inasistencias</h3><p class="hint" style="margin:2px 0 8px">En riesgo: ${pc} % o más de inasistencias respecto a las horas efectivas de su práctica (cada día son ${HD()} h). Cerca del límite: desde ${Math.round(pc*2/3)} %.</p>
  ${enR.length||cer.length?`<div class="tl">${enR.map(x=>item(x,"b-bad")).join("")}${cer.map(x=>item(x,"b-warn")).join("")}</div>`:`<p class="hint">Nadie por ahora.</p>`}</section>`}
function parteKey(f,pid){return `${f}_${pid}`}
function parteDe(f,pid){const p=S.prac.get(pid);const d=S.par.get(parteKey(f,pid));const tot=d&&num(d.tot)!=null?num(d.tot):efectivo({id:pid,...p});
  const nov=(d&&d.nov)||[];const aus=nov.reduce((s,n)=>s+(num(n.n)||0),0);return {d,tot,nov,asi:Math.max(0,tot-aus),aus}}
function nominal(f,pid){return evs().filter(e=>e.t==="falta"&&e.f===f&&e.p===pid)}
function novTxt(n){const m=MOT_ALL.find(x=>x[0]===n.m)||MOT_ALL[MOT_ALL.length-1];const k=num(n.n)||0;return `${k} ${n.x||(k>1?m[3]:m[2])}`}

/* ---------- escritura ---------- */
const Q=new Map();let readOnly=false;
function write(key,fn){const p=(Q.get(key)||Promise.resolve()).then(fn).catch(e=>{console.error(e);
  if(e&&(e.code==="not_granted"||e.code==="permission_denied")){readOnly=true;notice("Esta vista es de solo lectura: los cambios no se guardaron.")}
  else toast("No se pudo guardar. Revisa tu conexión e inténtalo otra vez.")});Q.set(key,p);return p}
function put(col,id,data,silent){const M={cadetes:S.cad,practicas:S.prac,eventos:S.ev,partes:S.par,bitacoras:S.bit}[col];if(M)M.set(id,data);
  if(!silent)render();if(!S.db)return Promise.resolve();return write(col+"/"+id,()=>S.db.collection(col).doc(id).set(data))}
function del(col,id){const M={cadetes:S.cad,practicas:S.prac,eventos:S.ev,partes:S.par,bitacoras:S.bit}[col];M&&M.delete(id);render();
  if(!S.db)return;return write(col+"/"+id,()=>S.db.collection(col).doc(id).delete())}
function saveCfg(){render();if(!S.db)return;return write("cfg",()=>S.db.doc("ajustes/general").set({...S.cfg}))}
const clone=o=>JSON.parse(JSON.stringify(o));
function addEv(e){const id=uid();e.at=new Date().toISOString();if(e.t==="falta"&&!e.rep)e.rep="pendiente";return put("eventos",id,e).then(()=>id)}

/* ---------- vistas ---------- */
let lastView=null,enT;
const RED=matchMedia("(prefers-reduced-motion: reduce)").matches;
function render(){
  document.querySelectorAll("nav.tabs button").forEach(b=>b.setAttribute("aria-selected",b.dataset.v===S.view));
  if(S.loaded<2){return}
  if(!S.prac.size&&S.view!=="cfg"&&S.view!=="est"&&S.view!=="bit"){VW.innerHTML=`<div class="empty"><strong>Todavía no hay prácticas cargadas</strong>Esta réplica se publica vacía: los registros se quedan en este dispositivo. En Ajustes puedes importar el concentrado en Excel o un respaldo JSON.<p style="margin:14px 0 0"><button class="btn" type="button" id="goCfg">Ir a Ajustes para importar</button></p></div>`;const g=$("#goCfg");if(g)g.onclick=()=>{S.view="cfg";render()};return}
  ({pan:vPan,par:vPar,cad:vCad,nov:vNov,cal:vCal,est:vEst,bit:vBit,cfg:vCfg})[S.view]();
  readout();
  if(lastView!==S.view){lastView=S.view;if(!RED){VW.classList.remove("enter");void VW.offsetWidth;VW.classList.add("enter");clearTimeout(enT);enT=setTimeout(()=>VW.classList.remove("enter"),900);countUp(VW)}}}
function countUp(root){root.querySelectorAll(".tally b").forEach(b=>{const t=b.textContent.trim();const m=t.match(/^(\d+)(.*)$/);if(!m||+m[1]<2)return;const n=+m[1],suf=m[2],t0=performance.now();
  const f=now=>{const k=Math.min(1,(now-t0)/700);b.textContent=Math.round(n*(1-Math.pow(1-k,3)))+suf;if(k<1)requestAnimationFrame(f)};requestAnimationFrame(f)})}
function readout(){const el=$("#readout");if(!el)return;const fs=[...S.par.values()].map(d=>d.f).sort();const f=fs.pop();if(!f)return;let a=0,t=0;
  [...S.par.values()].filter(d=>d.f===f&&S.prac.has(d.p)).forEach(d=>{const x=parteDe(f,d.p);a+=x.asi;t+=x.tot});const pc=t?a/t*100:0;
  el.innerHTML=`<small>Asistencia · ${fCorta(f)}</small><b class="${pc<90?"lo":""}">${pc.toFixed(1)}<span style="font-size:.45em"> %</span></b><small>${a} de ${t} en práctica</small>`}
function ring(a,t){const pc=t?a/t:0,C=2*Math.PI*26,col=pc>=.95?"var(--ok)":pc>=.85?"var(--warn)":"var(--bad)";
  return `<svg class="ring" viewBox="0 0 64 64" width="64" height="64" role="img" aria-label="${Math.round(pc*100)} % de asistencia"><circle cx="32" cy="32" r="26" fill="none" style="stroke:var(--line)" stroke-width="6"/><circle class="arc" cx="32" cy="32" r="26" fill="none" style="stroke:${col};filter:drop-shadow(0 0 4px ${col})" stroke-width="6" stroke-linecap="round" stroke-dasharray="${(C*pc).toFixed(1)} ${C.toFixed(1)}" transform="rotate(-90 32 32)"/><text x="32" y="36" text-anchor="middle" style="fill:var(--ink);font:13px var(--mono)">${Math.round(pc*100)}%</text></svg>`}
document.querySelectorAll("nav.tabs button").forEach(b=>b.onclick=()=>{S.view=b.dataset.v;render();window.scrollTo(0,0)});

/* Panorama */
function vPan(){const T=today(),L=monday(T),E=evs(),C=cads();
  const sem=E.filter(e=>e.t==="falta"&&e.f>=L&&e.f<=addD(L,6));
  const mes=T.slice(0,7);
  const act=pracs().filter(p=>enPeriodo(p,T));
  const pend=E.filter(e=>e.t==="falta"&&(e.rep||"pendiente")==="pendiente");
  const hoyAct=pracs().filter(p=>activa(p,T));
  const sinParte=hoyAct.filter(p=>!S.par.has(parteKey(T,p.id)));
  const enRiesgo=C.filter(c=>nivel(peorRiesgo(c.id))==="riesgo").length;
  const rows=act.map(p=>{const P=[...S.par.values()].filter(d=>d.p===p.id);let t=0,a=0;P.forEach(d=>{const x=parteDe(d.f,p.id);t+=x.tot;a+=x.asi});
    const F=E.filter(e=>e.t==="falta"&&e.p===p.id);const ult=P.map(d=>d.f).sort().pop();
    return {p,dias:P.length,pct:t?a/t*100:null,fj:sumC(F.filter(e=>e.j)),fi:sumC(F.filter(e=>!e.j)),ult,ef:efectivo(p)}});
  VW.innerHTML=`<h2>Panorama al ${fLarga(T)}</h2>
  ${sinParte.length?`<p class="notice">Falta registrar el parte de hoy de ${sinParte.length} práctica${sinParte.length>1?"s":""}: ${sinParte.map(p=>esc(pracLabel(p,true))).join("; ")}. <button class="lnk" id="goPar">Ir al parte del día</button></p>`:""}
  <section class="tally" aria-label="Resumen">
    <div><b>${C.length}</b><span>Cadetes en el registro</span></div>
    <div class="t-bad"><b>${enRiesgo}</b><span>En riesgo por inasistencias (${Math.round(RPCT()*100)} % o más)</span></div>
    <div class="t-just"><b>${sumC(sem.filter(e=>e.j))}</b><span>Faltas justificadas esta semana</span></div>
    <div class="t-bad"><b>${sumC(sem.filter(e=>!e.j))}</b><span>Faltas injustificadas esta semana</span></div>
    <div class="t-warn"><b>${sumC(pend)*HD()}</b><span>Horas de práctica por reponer</span></div>
    <div><b>${E.filter(e=>e.t==="arresto"&&e.f.startsWith(mes)).length}</b><span>Arrestos en ${MESES[+mes.slice(5)-1]}</span></div>
  </section>
  <div class="tscroll"><table class="tbl"><thead><tr><th>Práctica</th><th>Sede</th><th>Turno</th><th>Instructoras</th><th class="num">Efectivo</th><th class="num">Partes</th><th class="num">Asistencia</th><th class="num">Faltas J</th><th class="num">Faltas I</th><th>Último parte</th></tr></thead>
  <tbody>${rows.length?rows.map(r=>`<tr><td>${yrChip(r.p.anio)} ${esc(MK[r.p.mk]||r.p.materia)}</td><td><b>${esc(r.p.sede)}</b></td><td>${r.p.turno==="2"?"2/o.":"1/er."}</td><td>${instr(r.p).map(esc).join("<br>")}</td><td class="num">${r.ef}</td><td class="num">${r.dias}</td><td class="num ${r.pct!=null&&r.pct<90?"lo":""}">${r.pct==null?"—":r.pct.toFixed(1)+" %"}${r.pct==null?"":`<span class="mini"><i style="width:${Math.min(100,r.pct).toFixed(1)}%"></i></span>`}</td><td class="num">${r.fj}</td><td class="num ${r.fi?"lo":""}">${r.fi}</td><td>${fCorta(r.ult)}</td></tr>`).join(""):`<tr><td colspan="10" class="hint">No hay prácticas en periodo hoy.</td></tr>`}</tbody></table></div>
  <div class="two" style="margin-top:14px">
    ${causas(E.filter(e=>e.t==="falta"),"Motivos de inasistencia en el ciclo")}
    ${riskBox()}</div>`;
  const g=$("#goPar");if(g)g.onclick=()=>{S.view="par";S.pf.f=T;render()};
  VW.querySelectorAll("[data-c]").forEach(b=>b.onclick=()=>ficha(b.dataset.c))}
function causas(F,title){const tot=sumC(F);if(!tot)return `<section class="box"><h3>${title}</h3><p class="hint">Sin inasistencias nominales registradas.</p></section>`;
  const c={};F.forEach(e=>c[e.m||"otro"]=(c[e.m||"otro"]||0)+cnt(e));
  return `<section class="box"><h3>${title}</h3><p class="hint" style="margin:2px 0 8px">${tot} inasistencias con nombre registradas.</p>${MOT_ALL.filter(m=>c[m[0]]).sort((a,b)=>c[b[0]]-c[a[0]]).map(([k,l])=>{const n=c[k],p=Math.round(n*1000/tot)/10;
    return `<div class="crow ${k==="injust"?"inj":""}"><span>${l}</span><div class="track" role="img" aria-label="${l}: ${p}%"><div class="fill" style="width:${p}%"></div></div><b>${n}</b></div>`}).join("")}</section>`}

/* Parte del día */
function vPar(){const f=S.pf.f||(S.pf.f=today()),t=S.pf.t;
  const L=pracs().filter(p=>p.turno===t&&activa(p,f));
  VW.innerHTML=`<h2>Parte del día</h2>
  <p class="lead">Anota las novedades de cada práctica; el conteo de asistentes y el mensaje de WhatsApp se arman solos. Con <b>Lista nominal</b> marcas a cada cadete que faltó y su motivo queda en su expediente.</p>
  <div class="bar"><input type="date" id="pf" value="${f}" aria-label="Fecha"><div class="seg" role="group" aria-label="Turno"><button data-t="1" aria-pressed="${t==="1"}">1/er. turno</button><button data-t="2" aria-pressed="${t==="2"}">2/o. turno</button></div>
  <span class="hint">${fLarga(f)}</span></div>
  ${L.length?`<div class="cards">${L.map(cardParte).join("")}</div>`:`<div class="box empty"><strong>Sin práctica este día</strong>Ninguna práctica del ${t==="1"?"primer":"segundo"} turno sale el ${DIAS[dow(f)]} ${fCorta(f).split(" ").slice(1).join(" ")}.</div>`}
  ${L.length?`<h2>Mensaje para WhatsApp</h2><textarea class="msg" id="wa" aria-label="Mensaje de novedades" readonly>${esc(mensaje(f,t))}</textarea>
  <div class="acts" style="justify-content:flex-start;margin-top:8px"><button class="btn" id="cp">Copiar mensaje</button><span class="hint">Solo incluye las prácticas con parte guardado.</span></div>`:""}`;
  $("#pf").onchange=e=>{if(e.target.value){S.pf.f=e.target.value;render()}};
  VW.querySelectorAll(".seg button").forEach(b=>b.onclick=()=>{S.pf.t=b.dataset.t;render()});
  VW.querySelectorAll(".card").forEach(bindCard);
  const cp=$("#cp");if(cp)cp.onclick=()=>copiar($("#wa"))}
function copiar(ta){const v=ta.value;(navigator.clipboard?navigator.clipboard.writeText(v):Promise.reject()).then(()=>toast("Mensaje copiado")).catch(()=>{ta.focus();ta.select();toast("Selecciona y copia el texto")})}
function cardParte(p){const f=S.pf.f,x=parteDe(f,p.id),nm=nominal(f,p.id),un=p.unidad||"cadetes";
  const dif=nm.length&&nm.length!==x.aus;
  return `<article class="card ${x.d?"done":""}" data-p="${p.id}">
    <div class="hd"><div><div class="mat">${yrChip(p.anio)} ${esc(p.materia)}</div><div class="sede">${esc(p.sede)}</div><div class="doc">${esc(p.docente)}</div></div>${x.d?`<span class="badge b-ok">Guardado</span>`:`<span class="badge b-warn pulse">Sin parte</span>`}</div>
    <div class="count">${ring(x.asi,x.tot)}<div class="cv"><b>${x.asi}/${x.tot}</b><label>Efectivo <input type="number" min="0" inputmode="numeric" class="tot" value="${x.tot}" aria-label="Efectivo"></label></div></div>
    <div class="novs">${x.nov.map((n,i)=>novRow(n,i)).join("")}</div>
    ${dif?`<p class="hint" style="color:var(--warn)">La lista nominal tiene ${nm.length} falta${nm.length>1?"s":""} y el parte ${x.aus}.</p>`:""}
    <div class="links"><button class="lnk addnov">+ Agregar novedad</button>${p.efectivo?"":`<button class="lnk lista">Lista nominal${nm.length?` (${nm.length})`:""}</button>`}${x.d?"":`<button class="lnk sinnov">Sin novedad (${x.tot}/${x.tot})</button>`}</div>
  </article>`}
function novRow(n,i){return `<div class="nov" data-i="${i}"><input type="number" min="1" inputmode="numeric" class="nn" value="${esc(n.n)}" aria-label="Cantidad"><select class="nm" aria-label="Motivo">${motOpts(n.m)}</select><input class="nx" value="${esc(n.x||"")}" placeholder="Detalle (opcional)" aria-label="Detalle"><button class="nd" aria-label="Quitar novedad">×</button></div>`}
let dT={};
function bindCard(el){const pid=el.dataset.p,f=S.pf.f;
  const cur=()=>{const x=parteDe(f,pid);return {f,p:pid,tot:x.tot,nov:clone(x.nov),src:x.d&&x.d.src||"manual"}};
  const save=(d,now)=>{clearTimeout(dT[pid]);const go=()=>put("partes",parteKey(f,pid),d,!now);if(now)go();else dT[pid]=setTimeout(go,500)};
  el.querySelector(".tot").onchange=e=>{const d=cur();d.tot=num(e.target.value)??d.tot;save(d,true)};
  el.querySelector(".addnov").onclick=()=>{const d=cur();d.nov.push({n:1,m:"servicio",x:""});save(d,true)};
  const sn=el.querySelector(".sinnov");if(sn)sn.onclick=()=>save(cur(),true);
  const li=el.querySelector(".lista");if(li)li.onclick=()=>listaNominal(f,pid);
  el.querySelectorAll(".nov").forEach(r=>{const i=+r.dataset.i;
    const upd=()=>{const d=cur();d.nov[i]={n:num(r.querySelector(".nn").value)||1,m:r.querySelector(".nm").value,x:r.querySelector(".nx").value.trim()};
      S.par.set(parteKey(f,pid),d);const x=parteDe(f,pid);el.querySelector(".count b").textContent=`${x.asi}/${x.tot}`;el.querySelector(".ring").outerHTML=ring(x.asi,x.tot);const wa=$("#wa");if(wa)wa.value=mensaje(f,S.pf.t);save(d)};
    r.querySelector(".nn").oninput=upd;r.querySelector(".nm").onchange=upd;r.querySelector(".nx").oninput=upd;
    r.querySelector(".nd").onclick=()=>{const d=cur();d.nov.splice(i,1);save(d,true)}})}
function mensaje(f,t){const L=pracs().filter(p=>p.turno===t&&S.par.has(parteKey(f,p.id)));if(!L.length)return "Todavía no hay partes guardados para este turno.";
  let s=`${t==="1"?"Buenos días":"Buenas tardes"} mi mayor sale la práctica clínica de *${t==="1"?"primer":"segundo"} turno*\n`;
  const mats=[...new Set(L.map(p=>p.materia))];
  mats.forEach(m=>{const G=L.filter(p=>p.materia===m);let tot=0;s+=`\n*${m}*\n`;
    G.forEach(p=>{const x=parteDe(f,p.id);tot+=x.asi;s+=`\n*${p.sede}*\n*${p.docente}*\n${x.asi}/${x.tot}\n`;x.nov.forEach(n=>s+=`(${novTxt(n)})\n`)});
    s+=`\n*Total:*\n${tot} ${G[0].unidad||"cadetes"}\n`});
  return s.trim()}
function listaNominal(f,pid){const p=S.prac.get(pid),R=roster(pid),N=nominal(f,pid);const sel=new Map(N.map(e=>[e.c,e]));
  const body=$("#listaBody");
  const draw=()=>{const n=[...sel.values()].length;
  body.innerHTML=`<h2>Lista nominal · ${esc(p.sede)}</h2><p class="hint">${esc(p.materia)} · ${fLarga(f)}. Elige el motivo de cada cadete que no asistió; quien queda en “Asistió” no genera registro.</p>
  <div class="roster">${R.map(c=>{const e=sel.get(c.id);const m=e?e.m:"";return `<div class="r ${e?(e.m==="injust"?"abs":"jus"):""}"><span>${esc(c.n)}<span class="sub">${ANIO[c.a]} ${esc(c.g)}</span></span>
    <select data-c="${c.id}" aria-label="Situación de ${esc(c.n)}"><option value="">Asistió</option>${motOpts(m)}</select></div>`}).join("")}</div>
  <div class="acts"><span class="sp hint">${n} inasistencia${n===1?"":"s"} · ${R.length-n}/${R.length} asistieron</span><button class="btn ghost" id="lc">Cancelar</button><button class="btn" id="lg">Guardar lista y parte</button></div>`;
  body.querySelectorAll("select[data-c]").forEach(s=>s.onchange=()=>{const c=s.dataset.c;if(!s.value)sel.delete(c);else{const e=sel.get(c)||{f,p:pid,c,t:"falta"};sel.set(c,{...e,m:s.value,j:s.value!=="injust"})}draw()});
  $("#lc").onclick=()=>$("#dLista").close();
  $("#lg").onclick=async()=>{const keep=new Set();
    for(const e of sel.values()){if(e.id){keep.add(e.id);const o=S.ev.get(e.id);if(o&&(o.m!==e.m||o.j!==e.j)){const {id,...b}=e;put("eventos",id,{...o,...b,m:e.m,j:e.j},true)}}else{const {id,...b}=e;keep.add(await addEv(b))}}
    N.filter(e=>!keep.has(e.id)).forEach(e=>{S.ev.delete(e.id);S.db&&write("eventos/"+e.id,()=>S.db.collection("eventos").doc(e.id).delete())});
    const g={};[...sel.values()].forEach(e=>g[e.m]=(g[e.m]||0)+1);const x=parteDe(f,pid);
    put("partes",parteKey(f,pid),{f,p:pid,tot:x.tot,nov:Object.entries(g).map(([m,n])=>({n,m,x:""})),src:"nominal"});
    $("#dLista").close();toast("Lista y parte guardados")}};
  draw();$("#dLista").showModal()}

/* Cadetes */
function vCad(){const F=S.cf,A=cads();
  const grps=[...new Set(A.filter(c=>!F.a||c.a===F.a).map(c=>c.g))].sort();
  const P=pracs().filter(p=>!p.efectivo);
  let L=A.filter(c=>(!F.a||c.a===F.a)&&(!F.g||c.g===F.g)&&(!F.p||Object.values(c.asig||{}).some(a=>a.p===F.p)));
  if(F.q){const q=norm(F.q);L=L.filter(c=>norm(c.n).includes(q)||norm(c.mat).includes(q))}
  const R=L.map(c=>({c,s:stats(c.id),pa:pracActual(c),r:peorRiesgo(c.id)}));
  const est={inj:x=>x.s.fi>0,rep:x=>x.s.rep>0,arr:x=>x.s.arr>0,neg:x=>x.s.anN>0,lim:x=>nivel(x.r)==="riesgo",
    rpb:x=>{const v=x.pa&&califFinal((x.c.cal||{})[x.pa.mk]);return v!=null&&v<S.cfg.minimo}};
  const V=(F.est?R.filter(est[F.est]):R).sort((a,b)=>cmpCad(a.c,b.c));
  VW.innerHTML=`<h2>Cadetes</h2>
  <div class="bar"><input type="search" id="q" placeholder="Buscar por nombre o matrícula" value="${esc(F.q)}" aria-label="Buscar">
  <select id="fa" aria-label="Año"><option value="">Todos los años</option>${["4","3","2"].map(a=>`<option value="${a}" ${F.a===a?"selected":""}>${ANIO[a]} año</option>`).join("")}</select>
  <select id="fg" aria-label="Grupo"><option value="">Todos los grupos</option>${grps.map(g=>`<option ${F.g===g?"selected":""}>${g}</option>`).join("")}</select>
  <select id="fp" aria-label="Práctica"><option value="">Todas las prácticas</option>${P.map(p=>`<option value="${p.id}" ${F.p===p.id?"selected":""}>${esc(pracLabel(p,true))}</option>`).join("")}</select>
  <select id="fe" aria-label="Situación"><option value="">Cualquier situación</option>${[["inj","Con faltas injustificadas"],["lim",`En riesgo por inasistencias (${Math.round(RPCT()*100)} % o más)`],["rep","Con práctica por reponer"],["arr","Con arrestos"],["neg","Con anecdotario negativo"],["rpb","Calificación reprobatoria"]].map(([k,l])=>`<option value="${k}" ${F.est===k?"selected":""}>${l}</option>`).join("")}</select></div>
  <p class="hint" style="margin-bottom:8px">${V.length} de ${A.length} cadetes. Toca un nombre para ver su expediente y registrar novedades.</p>
  <div class="tscroll"><table class="tbl"><thead><tr><th>Cadete</th><th>Práctica actual</th><th class="num">Faltas J</th><th class="num">Faltas I</th><th class="num">% inasist.</th><th class="num">Por reponer</th><th class="num">Retardos</th><th class="num">Anecdotario</th><th class="num">Arrestos</th><th class="num">Calificación</th></tr></thead>
  <tbody>${V.map(({c,s,pa,r})=>{const cf=pa&&califFinal((c.cal||{})[pa.mk]);return `<tr><td>${yrChip(c.a)} <button class="nameb" data-c="${c.id}">${esc(c.n)}</button><span class="sub">Grupo ${esc(c.g)}${c.rol?" · "+esc(c.rol)+" de grupo":""}${c.mat?" · "+esc(c.mat):""}</span></td>
    <td>${pa?esc(pracLabel(pa.pr,true)):`<span class="hint">Sin asignar</span>`}</td>
    <td class="num">${s.fj||""}</td><td class="num ${s.fi?"lo":""}">${s.fi||""}</td><td class="num">${r&&r.n?`<span class="badge ${nivel(r)==="riesgo"?"b-bad":nivel(r)==="cerca"?"b-warn":"b-mut"}" title="${pctTxt(r)}">${(r.pct*100).toFixed(1)} %</span>`:""}</td><td class="num">${s.rep||""}</td><td class="num">${s.ret||""}</td>
    <td class="num">${s.anP?`<span class="badge b-ok">+${s.anP}</span>`:""}${s.anN?`<span class="badge b-bad">−${s.anN}</span>`:""}</td><td class="num ${s.arr?"lo":""}">${s.arr?`${s.arr}<span class="sub">${s.hrs} h</span>`:""}</td>
    <td class="num ${cf!=null&&cf<S.cfg.minimo?"lo":""}">${cf==null?"—":cf.toFixed(1)}</td></tr>`}).join("")||`<tr><td colspan="10" class="hint">Ningún cadete coincide con el filtro.</td></tr>`}</tbody></table></div>`;
  const q=$("#q");q.oninput=e=>{F.q=e.target.value;const pos=e.target.selectionStart;render();const n=$("#q");n.focus();n.setSelectionRange(pos,pos)};
  $("#fa").onchange=e=>{F.a=e.target.value;F.g="";render()};$("#fg").onchange=e=>{F.g=e.target.value;render()};
  $("#fp").onchange=e=>{F.p=e.target.value;render()};$("#fe").onchange=e=>{F.est=e.target.value;render()};
  VW.querySelectorAll("[data-c]").forEach(b=>b.onclick=()=>ficha(b.dataset.c))}

/* Expediente */
let FI=null;
function ficha(cid){FI={cid,t:"falta",conf:null};drawFicha();const d=$("#dFicha");if(!d.open)d.showModal()}
function drawFicha(){const cid=FI.cid,c=S.cad.get(cid);if(!c){$("#dFicha").close();return}
  const s=stats(cid),E=evDe(cid),pa=pracActual({id:cid,...c});
  const mks=[...new Set([...(YEAR_MK[c.a]||[]),...Object.keys(c.asig||{})])];
  const b=$("#fichaBody");
  b.innerHTML=`<div class="acts" style="justify-content:space-between;align-items:flex-start"><div><h2>${esc(c.n)}</h2><p class="hint">${yrChip(c.a)} Grupo ${esc(c.g)}${c.rol?" · "+esc(c.rol)+" de grupo":""} · Matrícula ${esc(c.mat||"sin registrar")}</p></div><button class="btn ghost small" id="fx">Cerrar</button></div>
  <section class="tally" style="grid-template-columns:repeat(3,1fr);margin:0"><div class="t-just"><b>${s.fj}</b><span>Faltas justificadas</span></div><div class="t-bad"><b>${s.fi}</b><span>Faltas injustificadas</span></div><div class="t-warn"><b>${s.rep*HD()} h</b><span>Por reponer</span></div>
  <div><b>${s.ret}</b><span>Retardos</span></div><div><b>${s.anP}/${s.anN}</b><span>Anecdotario + / −</span></div><div class="${s.arr?"t-bad":""}"><b>${s.arr}</b><span>Arrestos (${s.hrs} h)</span></div></section>
  <h3>Registrar</h3>
  <div class="g4"><label>Tipo<select id="et">${TIPOS.map(([k,l])=>`<option value="${k}" ${FI.t===k?"selected":""}>${l}</option>`).join("")}</select></label>
  <label>Fecha<input type="date" id="ef" value="${today()}"></label>
  <label style="grid-column:span 2">Práctica<select id="ep"><option value="">Sin práctica</option>${mks.map(mk=>{const a=(c.asig||{})[mk];const p=a&&S.prac.get(a.p);return p?`<option value="${a.p}" ${pa&&pa.p===a.p?"selected":""}>${esc(pracLabel({id:a.p,...p},true))}</option>`:""}).join("")}</select></label></div>
  <div class="g4">${FI.t==="falta"?`<label>Días<input type="number" id="ed" min="1" value="1" inputmode="numeric"></label><label>Motivo<select id="em">${MOT.map(m=>`<option value="${m[0]}">${m[1]}</option>`).join("")}</select></label><label class="chk" style="align-self:end"><input type="checkbox" id="ej" checked> Justificada</label>`:""}
  ${FI.t==="arresto"?`<label>Horas<input type="number" id="eh" min="0" inputmode="numeric" placeholder="24"></label><label style="grid-column:span 2">Impuesto por<input id="ea" placeholder="Grado y nombre"></label>`:""}
  ${FI.t==="anecdota"?`<label style="grid-column:span 2">Tipo de anotación<select id="eo"><option value="neg">Negativa (llamada de atención)</option><option value="pos">Positiva (felicitación)</option></select></label>`:""}</div>
  <label>${FI.t==="anecdota"?"Hecho observado":FI.t==="arresto"?"Motivo del arresto":"Observaciones"}<textarea id="ex" placeholder="${FI.t==="anecdota"?"Describe la conducta, el lugar y quién la reporta":"Opcional"}"></textarea></label>
  <div class="acts"><button class="btn" id="eg">Guardar en el expediente</button></div>
  <h3>Prácticas asignadas</h3>
  <div class="tscroll" style="border:0"><table class="tbl" style="min-width:560px"><thead><tr><th>Materia</th><th>Campo clínico</th><th class="num">Inasistencia</th><th class="num">Instr.</th><th class="num">Trab. inv.</th><th class="num">Eval.</th><th class="num">Final</th></tr></thead><tbody>
  ${mks.map(mk=>{const a=(c.asig||{})[mk]||{};const cal=(c.cal||{})[mk]||{};const fn=califFinal(cal);return `<tr data-mk="${mk}"><td>${esc(MK[mk]||mk)}</td>
   <td><select class="ap" aria-label="Sede de ${esc(MK[mk])}"><option value="">Sin asignar</option>${pracs().filter(p=>p.mk===mk).map(p=>`<option value="${p.id}" ${a.p===p.id?"selected":""}>${esc(p.sede)}${p.turno==="2"?" 2/o.":""}</option>`).join("")}</select></td>
   <td class="num">${(()=>{const r=riesgoDe(cid).find(x=>x.mk===mk);return r?`<span class="badge ${nivel(r)==="riesgo"?"b-bad":nivel(r)==="cerca"?"b-warn":"b-mut"}">${pctTxt(r)}</span>`:"—"})()}</td>
   ${["inst","ti","ev"].map(k=>`<td class="num"><input type="number" step="0.1" min="0" max="10" class="ac" data-k="${k}" value="${cal[k]??""}" aria-label="${k}"></td>`).join("")}
   <td class="num ${fn!=null&&fn<S.cfg.minimo?"lo":""}">${fn==null?"—":fn.toFixed(1)}</td></tr>`}).join("")}</tbody></table></div>
  <h3>Historial (${E.length})</h3>
  ${E.length?`<div class="tl">${E.map(e=>evItem(e,true)).join("")}</div>`:`<p class="hint">Sin novedades registradas.</p>`}`;
  $("#fx").onclick=()=>$("#dFicha").close();
  $("#et").onchange=e=>{FI.t=e.target.value;drawFicha()};
  const em=$("#em");if(em)em.onchange=()=>{$("#ej").checked=em.value!=="injust"};
  $("#eg").onclick=async()=>{const e={f:$("#ef").value||today(),c:cid,p:$("#ep").value,t:FI.t,x:$("#ex").value.trim()};
    if(FI.t==="falta"){e.m=$("#em").value;e.j=$("#ej").checked;const d=num($("#ed").value);if(d>1)e.d=Math.round(d)}
    if(FI.t==="arresto"){e.h=num($("#eh").value);e.por=$("#ea").value.trim();if(!e.x){toast("Escribe el motivo del arresto");return}}
    if(FI.t==="anecdota"){e.pol=$("#eo").value;if(!e.x){toast("Describe el hecho observado");return}}
    await addEv(e);toast(`${TIPO_TXT[FI.t]} registrado`);drawFicha()};
  b.querySelectorAll("tr[data-mk]").forEach(tr=>{const mk=tr.dataset.mk;
    const save=()=>{const o=clone(S.cad.get(cid));o.asig=o.asig||{};o.cal=o.cal||{};const pv=tr.querySelector(".ap").value;
      if(pv)o.asig[mk]={...(o.asig[mk]||{}),p:pv};else delete o.asig[mk];
      const cal={};tr.querySelectorAll(".ac").forEach(i=>{const v=num(i.value);if(v!=null)cal[i.dataset.k]=Math.min(10,Math.max(0,v))});
      if(Object.keys(cal).length)o.cal[mk]=cal;else delete o.cal[mk];put("cadetes",cid,o,true);render();toast("Guardado")};
    tr.querySelector(".ap").onchange=save;tr.querySelectorAll(".ac").forEach(i=>i.onchange=()=>{save();drawFicha()})});
  bindEvItems(b,drawFicha)}
function evItem(e,inFicha){const p=S.prac.get(e.p);const c=S.cad.get(e.c);
  let what="";if(e.t==="falta")what=`<span class="badge ${e.j?"b-just":"b-bad"}">${e.j?"J":"I"}</span>Inasistencia${cnt(e)>1?` · <b>${cnt(e)} días</b>`:""} · ${esc(MOT_TXT[e.m]||"Otro")}`;
  else if(e.t==="retardo")what=`Retardo`;else if(e.t==="anecdota")what=`<span class="badge ${e.pol==="neg"?"b-bad":"b-ok"}">${e.pol==="neg"?"Negativa":"Positiva"}</span>Anecdotario`;
  else what=`<span class="badge b-bad">${e.h?e.h+" h":"Arresto"}</span>Arresto${e.por?" · "+esc(e.por):""}`;
  return `<div class="it" data-e="${e.id}"><span class="fx">${fCorta(e.f)}</span><span>${inFicha?"":`<button class="nameb" data-c="${e.c}">${esc(c?c.n:"Cadete eliminado")}</button> · `}${what}${p?`<span class="sub">${esc(pracLabel(p,true))}</span>`:""}${e.x?`<span class="sub" style="color:var(--ink)">${esc(e.x)}</span>`:""}</span>
  <span class="acts" style="gap:6px">${e.t==="falta"?`<select class="rp" aria-label="Reposición">${REP.map(([k,l])=>`<option value="${k}" ${(e.rep||"pendiente")===k?"selected":""}>${l}</option>`).join("")}</select>`:""}<button class="btn danger small dl">${FI&&FI.conf===e.id?"¿Eliminar?":"Quitar"}</button></span></div>`}
function bindEvItems(root,redraw){root.querySelectorAll(".it[data-e]").forEach(it=>{const id=it.dataset.e;
  const rp=it.querySelector(".rp");if(rp)rp.onchange=()=>{const o=S.ev.get(id);put("eventos",id,{...o,rep:rp.value},true);toast("Reposición actualizada")};
  it.querySelector(".dl").onclick=()=>{FI=FI||{};if(FI.conf===id){FI.conf=null;del("eventos",id);redraw()}else{FI.conf=id;redraw()}};
  const nb=it.querySelector(".nameb");if(nb)nb.onclick=()=>ficha(nb.dataset.c)})}

/* Novedades */
function vNov(){const F=S.nf;const P=pracs();
  const sub=F.sub;
  VW.innerHTML=`<h2>Novedades</h2><div class="subtabs" role="group" aria-label="Tipo de novedad">${[["falta","Inasistencias"],["semana","Reporte semanal"],["anecdota","Anecdotario"],["arresto","Arrestos"],["retardo","Retardos"]].map(([k,l])=>`<button data-s="${k}" aria-pressed="${sub===k}">${l}</button>`).join("")}</div><div id="novBody"></div>`;
  VW.querySelectorAll(".subtabs button").forEach(b=>b.onclick=()=>{F.sub=b.dataset.s;render()});
  if(sub==="semana")return vSemana();
  let L=evs().filter(e=>e.t===sub&&(!F.desde||e.f>=F.desde)&&(!F.hasta||e.f<=F.hasta)&&(!F.p||e.p===F.p)&&(sub!=="falta"||!F.rep||(e.rep||"pendiente")===F.rep)).sort((a,b)=>b.f.localeCompare(a.f));
  $("#novBody").innerHTML=`${sub==="falta"?riskBox():""}<div class="bar"><label class="hint" for="nd">Desde</label><input type="date" id="nd" value="${F.desde}"><label class="hint" for="nh">Hasta</label><input type="date" id="nh" value="${F.hasta}">
  <select id="np" aria-label="Práctica"><option value="">Todas las prácticas</option>${P.filter(p=>!p.efectivo).map(p=>`<option value="${p.id}" ${F.p===p.id?"selected":""}>${esc(pracLabel(p,true))}</option>`).join("")}</select>
  ${sub==="falta"?`<select id="nr" aria-label="Reposición"><option value="">Cualquier reposición</option>${REP.map(([k,l])=>`<option value="${k}" ${F.rep===k?"selected":""}>${l}</option>`).join("")}</select>`:""}</div>
  <p class="hint" style="margin-bottom:8px">${L.length} registro${L.length===1?"":"s"}${sub==="falta"?` · ${L.filter(e=>e.j).length} justificadas, ${L.filter(e=>!e.j).length} injustificadas`:""}${sub==="arresto"?` · ${L.reduce((s,e)=>s+(num(e.h)||0),0)} horas`:""}. Para agregar uno, abre el expediente del cadete en Cadetes.</p>
  ${L.length?`<div class="tl">${L.map(e=>evItem(e,false)).join("")}</div>`:`<div class="box empty"><strong>Sin registros</strong>Las novedades aparecen aquí al guardar una lista nominal, un expediente o una bitácora.</div>`}`;
  $("#nd").onchange=e=>{F.desde=e.target.value;render()};$("#nh").onchange=e=>{F.hasta=e.target.value;render()};$("#np").onchange=e=>{F.p=e.target.value;render()};
  const nr=$("#nr");if(nr)nr.onchange=e=>{F.rep=e.target.value;render()};
  $("#novBody").querySelectorAll(".box [data-c]").forEach(b=>b.onclick=()=>ficha(b.dataset.c));
  bindEvItems($("#novBody"),render)}
function vSemana(){const L=S.wk||(S.wk=monday(today())),H=addD(L,6);
  const E=evs().filter(e=>e.t==="falta"&&e.f>=L&&e.f<=H);const P=pracs().filter(p=>E.some(e=>e.p===p.id));
  const sinP=E.filter(e=>!S.prac.has(e.p));
  const partes=[...S.par.values()].filter(d=>d.f>=L&&d.f<=H);const cnt=partes.reduce((s,d)=>s+parteDe(d.f,d.p).aus,0);
  $("#novBody").innerHTML=`<div class="bar"><button class="btn ghost small" id="wp">← Semana anterior</button><b>Del ${dOf(L).getDate()} de ${MESES[dOf(L).getMonth()]} al ${fLarga(H)}</b><button class="btn ghost small" id="wn">Semana siguiente →</button></div>
  <p class="lead">Concentrado de inasistencias con nombre de la semana para el reporte del viernes y la solicitud de reposición. Los partes de la semana suman ${cnt} inasistencias; aquí aparecen ${E.length} con nombre${cnt>E.length?`, faltan ${cnt-E.length} por identificar en la lista nominal`:""}.</p>
  ${E.length?`<textarea class="msg" id="rs" readonly aria-label="Reporte semanal">${esc(reporteSemanal(L,H,E))}</textarea>
  <div class="acts" style="justify-content:flex-start;margin:8px 0 14px"><button class="btn" id="rc">Copiar reporte</button><button class="btn ghost" id="rm">Marcar “Por reponer” como solicitadas</button></div>
  ${[...P,...(sinP.length?[{id:"",sede:"Sin práctica",materia:""}]:[])].map(p=>{const X=E.filter(e=>(e.p||"")===p.id).sort((a,b)=>a.f.localeCompare(b.f));return `<h3 style="margin:12px 0 6px">${esc(p.materia?pracLabel(p,true):p.sede)}</h3><div class="tl">${X.map(e=>evItem(e,false)).join("")}</div>`}).join("")}`
  :`<div class="box empty"><strong>Sin inasistencias con nombre esta semana</strong>Usa “Lista nominal” en el parte del día o carga la bitácora de la semana.</div>`}`;
  $("#wp").onclick=()=>{S.wk=addD(L,-7);render()};$("#wn").onclick=()=>{S.wk=addD(L,7);render()};
  const rc=$("#rc");if(rc)rc.onclick=()=>copiar($("#rs"));
  const rm=$("#rm");if(rm)rm.onclick=()=>{E.filter(e=>(e.rep||"pendiente")==="pendiente").forEach(e=>{const {id,...b}=e;put("eventos",id,{...b,rep:"solicitada"},true)});render();toast("Reposiciones marcadas como solicitadas")};
  bindEvItems($("#novBody"),render)}
function reporteSemanal(L,H,E){let s=`REPORTE SEMANAL DE INASISTENCIAS A LA PRÁCTICA CLÍNICA\nSemana del ${dOf(L).getDate()} de ${MESES[dOf(L).getMonth()]} al ${fLarga(H)}\n`;
  const mats=[...new Set(E.map(e=>(S.prac.get(e.p)||{}).materia||"SIN PRÁCTICA"))];
  mats.forEach(m=>{s+=`\n${m}\n`;const X=E.filter(e=>((S.prac.get(e.p)||{}).materia||"SIN PRÁCTICA")===m).sort((a,b)=>{const ca=S.cad.get(a.c)||{},cb=S.cad.get(b.c)||{};return (ca.n||"").localeCompare(cb.n||"","es")||a.f.localeCompare(b.f)});
    const by=new Map();X.forEach(e=>{if(!by.has(e.c))by.set(e.c,[]);by.get(e.c).push(e)});let i=0;
    by.forEach((list,cid)=>{const c=S.cad.get(cid)||{n:"Cadete",a:"",g:""};const p=S.prac.get(list[0].p);i++;
      s+=`${i}. Cad. ${c.n} (${ANIO[c.a]||""} ${c.g}) – ${p?p.sede:""} – ${list.map(e=>`${fCorta(e.f)}: ${(MOT_TXT[e.m]||"otro").toLowerCase()}${cnt(e)>1?` (${cnt(e)} días)`:""} (${e.j?"J":"I"})`).join("; ")}${(()=>{const r=riesgoDe(cid).find(x=>x.p.id===list[0].p);return r&&nivel(r)==="riesgo"?` – EN RIESGO: ${pctTxt(r)}`:""})()}\n`})});
  s+=`\nTotal: ${sumC(E)} inasistencias (${sumC(E.filter(e=>e.j))} justificadas, ${sumC(E.filter(e=>!e.j))} injustificadas). ${sumC(E.filter(e=>(e.rep||"pendiente")!=="no"&&e.rep!=="repuesta"))*HD()} horas por reponer.`;return s}

/* Calificaciones */
function vCal(){const F=S.calf;const mks=[...new Set(pracs().filter(p=>!p.efectivo).map(p=>p.mk))];if(!F.mk)F.mk=mks.find(mk=>pracs().some(p=>p.mk===mk&&enPeriodo(p,today())))||mks[0];
  const P=pracs().filter(p=>p.mk===F.mk);let L=cads().filter(c=>c.asig&&c.asig[F.mk]&&(!F.p||c.asig[F.mk].p===F.p));L.sort(cmpCad);
  const fin=L.map(c=>califFinal((c.cal||{})[F.mk])).filter(v=>v!=null).sort((a,b)=>a-b);
  const avg=fin.length?fin.reduce((a,b)=>a+b,0)/fin.length:null;const med=fin.length?(fin.length%2?fin[(fin.length-1)/2]:(fin[fin.length/2-1]+fin[fin.length/2])/2):null;
  const sd=fin.length>1?Math.sqrt(fin.reduce((s,v)=>s+(v-avg)**2,0)/(fin.length-1)):null;const rep=fin.filter(v=>v<S.cfg.minimo).length;const pw=S.cfg.pesos;
  VW.innerHTML=`<h2>Calificaciones</h2>
  <div class="bar"><select id="cm" aria-label="Materia">${mks.map(mk=>`<option value="${mk}" ${F.mk===mk?"selected":""}>${MK[mk]}</option>`).join("")}</select>
  <select id="cp2" aria-label="Campo clínico"><option value="">Todos los campos clínicos</option>${P.map(p=>`<option value="${p.id}" ${F.p===p.id?"selected":""}>${esc(p.sede)}${p.turno==="2"?" (2/o. turno)":""}</option>`).join("")}</select></div>
  <section class="tally" aria-label="Estadística del grupo"><div><b>${L.length}</b><span>Cadetes</span></div><div><b>${fin.length}</b><span>Con calificación final</span></div><div><b>${avg==null?"—":avg.toFixed(2)}</b><span>Promedio grupal</span></div><div><b>${sd==null?"—":sd.toFixed(2)}</b><span>Desviación estándar</span></div><div><b>${med==null?"—":med.toFixed(2)}</b><span>Mediana</span></div><div class="t-bad"><b>${rep}</b><span>Reprobados${fin.length?` (${(rep/fin.length*100).toFixed(1)} %)`:""}</span></div></section>
  <p class="hint" style="margin-bottom:8px">Final = instrumento ${pw.inst} % + trabajo de investigación ${pw.ti} % + evaluación parcial final ${pw.ev} %. Mínimo aprobatorio ${S.cfg.minimo}. Cambia la ponderación en Ajustes; también puedes cargar la foto de una lista de calificaciones en Bitácoras.</p>
  <div class="tscroll"><table class="tbl" style="min-width:640px"><thead><tr><th>No.</th><th>Cadete</th><th class="num">Instrumento</th><th class="num">Trab. inv.</th><th class="num">Evaluación</th><th class="num">Final</th></tr></thead><tbody>
  ${L.map((c,i)=>{const cal=(c.cal||{})[F.mk]||{};const fn=califFinal(cal);return `<tr data-c="${c.id}"><td class="num">${i+1}</td><td><button class="nameb" data-f="${c.id}">${esc(c.n)}</button><span class="sub">${ANIO[c.a]} ${esc(c.g)} · ${esc((S.prac.get(c.asig[F.mk].p)||{}).sede||"")}</span></td>  ${["inst","ti","ev"].map(k=>`<td class="num"><input type="number" step="0.1" min="0" max="10" inputmode="decimal" data-k="${k}" value="${cal[k]??""}" aria-label="${k} de ${esc(c.n)}"></td>`).join("")}<td class="num fin ${fn!=null&&fn<S.cfg.minimo?"lo":""}">${fn==null?"—":fn.toFixed(1)}</td></tr>`}).join("")||`<tr><td colspan="6" class="hint">Sin cadetes asignados a esta materia.</td></tr>`}</tbody></table></div>`;
  $("#cm").onchange=e=>{F.mk=e.target.value;F.p="";F.ins="";render()};$("#cp2").onchange=e=>{F.p=e.target.value;F.ins="";render()};
  VW.querySelectorAll("[data-f]").forEach(b=>b.onclick=()=>ficha(b.dataset.f));
  VW.querySelectorAll("tr[data-c]").forEach(tr=>tr.querySelectorAll("input").forEach(inp=>inp.onchange=()=>{const cid=tr.dataset.c,o=clone(S.cad.get(cid));o.cal=o.cal||{};const cal=o.cal[F.mk]||{};
    const v=num(inp.value);if(v==null)delete cal[inp.dataset.k];else cal[inp.dataset.k]=Math.min(10,Math.max(0,v));o.cal[F.mk]=cal;put("cadetes",cid,o,true);
    const fn=califFinal(cal),td=tr.querySelector(".fin");td.textContent=fn==null?"—":fn.toFixed(1);td.classList.toggle("lo",fn!=null&&fn<S.cfg.minimo)}))}

/* Bitácoras */
let SAMPLE=null,SAMPLE_LIM=null,ASSETS=null,DL=null;
const IMP={st:"form",f:null,tipo:"nov",mk:"",p:"",files:[],texto:"",res:null,msg:""};
async function shrink(f){if(!/^image\//.test(f.type))return f;try{const bmp=await createImageBitmap(f);const k=Math.min(1,2000/Math.max(bmp.width,bmp.height));
  const c=document.createElement("canvas");c.width=Math.round(bmp.width*k);c.height=Math.round(bmp.height*k);c.getContext("2d").drawImage(bmp,0,0,c.width,c.height);
  return await new Promise(r=>c.toBlob(b=>r(b||f),"image/jpeg",0.85))}catch(e){return f}}
function tokens(s){return norm(s).replace(/[^a-z ]/g," ").split(/\s+/).filter(w=>w.length>2&&!["del","las","los"].includes(w))}
function matchCad(nombre,pool){const q=tokens(nombre);if(q.length<2)return null;let best=null,bs=0,tie=false;
  pool.forEach(c=>{const t=new Set(tokens(c.n));const hit=q.filter(w=>t.has(w)).length;const sc=hit/Math.max(q.length,2);if(hit>=2&&sc>bs){bs=sc;best=c;tie=false}else if(hit>=2&&sc===bs)tie=true});
  return best&&!tie&&bs>=0.6?best.id:null}

/* lectura de archivos adjuntos */
const OKF=/\.(pdf|xlsx|xls|csv|docx|pptx|ppt|jpe?g|png|gif|webp|mp3|wav|m4a|ogg)$/i;
const okFile=f=>/^image\//.test(f.type)||/^audio\//.test(f.type)||OKF.test(f.name);
const kindOf=f=>window.ReplicaReaders?ReplicaReaders.kindOf(f):(/^image\//.test(f.type)?"img":/\.pdf$/i.test(f.name)?"pdf":/\.(xlsx|xls|csv)$/i.test(f.name)?"xls":/\.(pptx|ppt)$/i.test(f.name)?"ppt":/^audio\//.test(f.type)||/\.(mp3|wav)$/i.test(f.name)?"aud":"doc");
function loadScript(src){return new Promise((res,rej)=>{const s=document.createElement("script");s.src=src;s.onload=res;s.onerror=()=>rej(new Error("No se pudo cargar "+src));document.head.appendChild(s)})}
async function loadJSZip(){if(!window.JSZip)await loadScript("vendor/jszip.min.js");return window.JSZip}
async function loadPDF(){if(!window.pdfjsLib){await loadScript("vendor/pdf.min.js");await loadScript("vendor/pdf.worker.min.js");
  window.pdfjsLib.GlobalWorkerOptions.workerSrc="vendor/pdf.worker.min.js"}return window.pdfjsLib}
async function xlsText(f){const X=await loadXLSX();const wb=X.read(await f.arrayBuffer(),{type:"array"});return wb.SheetNames.map(n=>`## Hoja: ${n}\n`+X.utils.sheet_to_csv(wb.Sheets[n],{blankrows:false})).join("\n\n")}
async function docText(f){const Z=await loadJSZip();const z=await Z.loadAsync(await f.arrayBuffer());const x=z.file("word/document.xml");if(!x)throw new Error("docx");
  const xml=await x.async("string");const t=document.createElement("textarea");
  t.innerHTML=xml.replace(/<w:tab\/>/g,"\t").replace(/<\/w:p>/g,"\n").replace(/<\/w:tc>/g," | ").replace(/<[^>]+>/g,"");return t.value.replace(/\n{3,}/g,"\n\n").trim()}
async function pdfRead(f,maxImgs){const L=await loadPDF();const pdf=await L.getDocument({data:new Uint8Array(await f.arrayBuffer())}).promise;let txt="";const imgs=[];
  for(let i=1;i<=pdf.numPages;i++){const pg=await pdf.getPage(i);const tc=await pg.getTextContent();const t=tc.items.map(it=>it.str+(it.hasEOL?"\n":" ")).join("").trim();
    if(t.length>40)txt+=`--- Página ${i} ---\n${t}\n`;else if(imgs.length<maxImgs){const v0=pg.getViewport({scale:1});const k=Math.min(2.5,1800/Math.max(v0.width,v0.height));const v=pg.getViewport({scale:k});
      const c=document.createElement("canvas");c.width=Math.round(v.width);c.height=Math.round(v.height);await pg.render({canvasContext:c.getContext("2d"),viewport:v}).promise;
      imgs.push(await new Promise(r=>c.toBlob(b=>r(b),"image/jpeg",0.85)))}}
  return {txt,imgs,pages:pdf.numPages}}
async function prepararArchivos(canImg){
  const onProgress=(msg,pct)=>{IMP.msg=msg;IMP.pct=pct;const b=$("#impBox");if(b&&IMP.st==="leyendo"){const p=b.querySelector("#impMsgL");const i=b.querySelector("#impBar i");if(p)p.innerHTML="<b>"+esc(msg)+"</b>";if(i)i.style.width=(pct||0)+"%"}};
  if(window.ReplicaReaders&&ReplicaReaders.preparar)return ReplicaReaders.preparar(IMP.files,{onProgress});
  const max=canImg&&SAMPLE_LIM&&SAMPLE_LIM.images?SAMPLE_LIM.images.maxCount:0;let imgs=[],texto="",omit=0;
  for(const f of IMP.files){const k=kindOf(f);
    if(k==="img"){if(imgs.length<max)imgs.push(await shrink(f));else omit++}
    else if(k==="pdf"){const r=await pdfRead(f,max-imgs.length);if(r.txt)texto+=`\n## Archivo PDF: ${f.name}\n${r.txt}`;imgs=imgs.concat(r.imgs);if(!r.txt&&!r.imgs.length)omit++}
    else if(k==="xls")texto+=`\n## Archivo Excel: ${f.name}\n${await xlsText(f)}`;
    else if(k==="ppt"&&window.ReplicaReaders)texto+=`\n## Archivo PowerPoint: ${f.name}\n${await ReplicaReaders.pptText(f)}`;
    else texto+=`\n## Archivo Word: ${f.name}\n${await docText(f)}`}
  return {imgs,texto,omit,notes:[]}}
function vBit(){const f=IMP.f||(IMP.f=monday(today()));const B=[...S.bit.entries()].map(([id,b])=>({id,...b})).sort((a,b)=>(b.f+b.at).localeCompare(a.f+a.at));
  const canImg=!!(SAMPLE&&SAMPLE_LIM&&SAMPLE_LIM.images);
  VW.innerHTML=`<h2>Bitácoras</h2>
  <p class="lead">Carga la bitácora o cualquier archivo de información: PDF, Excel, Word, PowerPoint, fotos (JPG, PNG), audio (MP3, WAV) o pega el texto. Elige la semana que cubre. ${SAMPLE?"La réplica lee el texto en este dispositivo (también de fotos y de PDF escaneados, con reconocimiento óptico; el audio se intenta transcribir). Te muestra cada novedad o calificación antes de guardarla y nada cambia hasta que oprimas <b>Aplicar</b>. El reconocimiento no es perfecto: conviene revisar, sobre todo con fotos borrosas o audios ruidosos.":"En esta vista no hay lectura automática; la foto se guarda en el archivo y capturas los datos en Parte del día."}</p>
  <div id="impBox" class="box"></div>
  <h2>Archivo de bitácoras</h2>
  ${B.length?`<div class="tl">${B.map(b=>`<div class="it" style="grid-template-columns:92px 1fr"><span class="fx">${fCorta(b.f)}</span><span><b>${b.tipo==="cal"?"Calificaciones · "+esc(MK[b.mk]||""):"Novedades del día"}</b>${b.resumen?`<span class="sub">${esc(b.resumen)}</span>`:""}
    ${(b.imgs||[]).length?`<span class="thumbs" style="margin-top:6px">${b.imgs.map(i=>`<a href="${esc(i.url||"/_blob/"+i.id)}" target="_blank" rel="noopener">${!i.k||i.k==="img"?`<img src="${esc(i.url||"/_blob/"+i.id)}" alt="Bitácora del ${fCorta(b.f)}" loading="lazy">`:`<span class="fchip">${({pdf:"PDF",xls:"Excel",doc:"Word"})[i.k]} · ${esc(i.name||"archivo")}</span>`}</a>`).join("")}</span>`:""}
    ${b.texto?`<details><summary class="hint">Texto</summary><pre style="white-space:pre-wrap;font-size:13px;margin:4px 0">${esc(b.texto)}</pre></details>`:""}</span></div>`).join("")}</div>`:`<p class="hint">Aquí quedará cada bitácora que cargues, con su foto, para consultarla después.</p>`}`;
  drawImp(canImg)}
function drawImp(canImg){const box=$("#impBox");if(!box)return;
  if(IMP.st==="leyendo"){box.innerHTML=`<p id="impMsgL"><b>${esc(IMP.msg)}</b></p><div class="ebar" id="impBar" style="max-width:100%;height:8px;margin:10px 0"><i style="width:${IMP.pct||0}%"></i></div><p class="hint">No cierres esta página. La lectura se hace en este dispositivo.</p>`;return}
  if(IMP.st==="rev")return drawRev(box);
  const mks=[...new Set(pracs().filter(p=>!p.efectivo).map(p=>p.mk))];
  box.innerHTML=`<div class="bar" style="margin-bottom:10px"><div class="seg" role="group" aria-label="Contenido"><button data-tp="nov" aria-pressed="${IMP.tipo==="nov"}">Novedades del día</button><button data-tp="cal" aria-pressed="${IMP.tipo==="cal"}">Calificaciones</button></div>
   <label class="hint" for="bf">Semana del</label><input type="date" id="bf" value="${IMP.f}"><span class="hint">${fCorta(IMP.f)} al ${fCorta(addD(IMP.f,6))}</span>
   ${IMP.tipo==="cal"?`<select id="bm" aria-label="Materia">${mks.map(mk=>`<option value="${mk}" ${IMP.mk===mk?"selected":""}>${MK[mk]}</option>`).join("")}</select>`:""}</div>
  <label class="drop" id="drop"><input type="file" id="bfile" multiple accept="image/jpeg,image/png,image/jpg,.jpg,.jpeg,.png,.pdf,.xlsx,.xls,.csv,.docx,.pptx,.ppt,.mp3,.wav,audio/mpeg,audio/wav,audio/*"><b>${IMP.files.length?`${IMP.files.length} archivo${IMP.files.length>1?"s":""} listo${IMP.files.length>1?"s":""}`:"Toca para elegir archivos o arrástralos aquí"}</b><span class="hint">PDF, Excel, Word, PowerPoint, JPG, PNG, MP3 o WAV.${canImg?` Hasta ${SAMPLE_LIM.images.maxCount} fotos o páginas escaneadas por lectura.`:SAMPLE?" Se lee el texto de PDF, Excel, Word, PowerPoint y, con reconocimiento óptico, de fotos y PDF escaneados. El audio se intenta transcribir; si no es posible, se guarda adjunto.":""}</span></label>
  ${IMP.files.length?`<div class="thumbs" style="margin-top:8px" id="th"></div>`:""}
  <label style="display:flex;flex-direction:column;gap:4px;margin-top:10px" class="hint">O pega aquí el texto (mensaje de WhatsApp, nota)<textarea id="btx" class="msg" style="min-height:120px" placeholder="Buenos días mi mayor sale la práctica clínica de primer turno…">${esc(IMP.texto)}</textarea></label>
  <div class="acts" style="margin-top:10px">${IMP.files.length||IMP.texto?`<button class="btn ghost" id="bclr">Limpiar</button>`:""}${SAMPLE?`<button class="btn" id="bread" ${IMP.files.length||IMP.texto.trim()?"":"disabled"}>Leer archivos</button>`:`<button class="btn" id="bsave" ${IMP.files.length||IMP.texto.trim()?"":"disabled"}>Guardar en el archivo</button>`}</div>`;
  box.querySelectorAll("[data-tp]").forEach(b=>b.onclick=()=>{IMP.tipo=b.dataset.tp;drawImp(canImg)});
  $("#bf").onchange=e=>{IMP.f=monday(e.target.value||today());drawImp(canImg)};const bm=$("#bm");if(bm){if(!IMP.mk)IMP.mk=bm.value;bm.onchange=e=>IMP.mk=e.target.value}
  const fi=$("#bfile"),dr=$("#drop");fi.onchange=()=>{const all=[...fi.files];IMP.files=[...IMP.files,...all.filter(okFile)];if(all.some(f=>!okFile(f)))toast("Solo se aceptan PDF, Excel, Word, PowerPoint, JPG, PNG, MP3 o WAV.");drawImp(canImg)};
  dr.ondragover=e=>{e.preventDefault();dr.classList.add("over")};dr.ondragleave=()=>dr.classList.remove("over");
  dr.ondrop=e=>{e.preventDefault();dr.classList.remove("over");const all=[...e.dataTransfer.files];IMP.files=[...IMP.files,...all.filter(okFile)];if(all.some(f=>!okFile(f)))toast("Solo se aceptan PDF, Excel, Word, PowerPoint, JPG, PNG, MP3 o WAV.");drawImp(canImg)};
  const th=$("#th");if(th)IMP.files.forEach(f=>{if(kindOf(f)==="img"){const im=document.createElement("img");im.alt=f.name;im.src=URL.createObjectURL(f);th.appendChild(im)}else{const sp=document.createElement("span");sp.className="fchip";sp.textContent=(window.ReplicaReaders&&ReplicaReaders.CHIP[kindOf(f)]||({pdf:"PDF",xls:"Excel",doc:"Word",ppt:"PowerPoint",aud:"Audio",img:"Imagen"})[kindOf(f)]||"Archivo")+" · "+f.name;th.appendChild(sp)}});
  const tx=$("#btx");tx.oninput=()=>{IMP.texto=tx.value;const b=$("#bread")||$("#bsave");if(b)b.disabled=!(IMP.files.length||IMP.texto.trim())};
  const cl=$("#bclr");if(cl)cl.onclick=()=>{IMP.files=[];IMP.texto="";drawImp(canImg)};
  const rd=$("#bread");if(rd)rd.onclick=leer;const sv=$("#bsave");if(sv)sv.onclick=()=>archivar("Guardada sin lectura automática").then(()=>{IMP.files=[];IMP.texto="";render()})}
function promptNov(){const f=IMP.f,h=addD(f,6);const A=pracs().filter(p=>p.ini<=h&&!p.efectivo);
  const lista=A.map(p=>`- id "${p.id}": ${p.materia} | sede ${p.sede} | ${p.turno==="2"?"segundo":"primer"} turno | del ${p.ini} al ${p.fin} | días ${(p.dias||[]).map(d=>DIAS[d]).join(", ")}\n  cadetes: ${roster(p.id).map(c=>c.n).join("; ")}`).join("\n");
  return `Eres asistente de la encargada de práctica clínica de la Escuela Militar de Enfermería. Lee la BITÁCORA SEMANAL (fotos, archivos y/o texto) de la semana del ${fLarga(f)} al ${fLarga(h)} y extrae, por cadete, las inasistencias, retardos, anotaciones del anecdotario y arrestos.
Prácticas (elige la que corresponda al cadete y a la fecha de cada novedad):
${lista}

Responde SOLO con JSON con esta forma:
{"eventos":[{"nombre":"nombre del cadete como aparece","practica":"id o vacío","fecha":"AAAA-MM-DD o vacío","dias":número de días de inasistencia que cubre este evento,"tipo":"falta|retardo|anecdota|arresto","motivo":"servicio|cita|comision|exceptuacion|encamado o vacío","justificada":true o false,"polaridad":"pos|neg|","horas":número o null,"texto":"servicio o área y detalle breve"}],
"notas":"lo que no pudiste leer, asignar o clasificar, o vacío"}
Motivos de inasistencia (usa solo estos cinco): servicio (servicio, SV, guardia, imaginaria, corneta); cita (cita programada, consulta, laboratorios, estudios); comision (comisión, EMI, escolta, banda, deporte, evento); exceptuacion (exceptuado/a, exceptuación); encamado (pelotón de sanidad, encamado/a, enfermería). Si un motivo no encaja claramente, usa el más cercano y explica en "texto" y en "notas". Todas son justificadas salvo que la bitácora diga explícitamente injustificada o sin motivo.
FECHAS: usa la fecha real de cada inasistencia que aparezca (por ejemplo "22-Oct-2026" = 2026-10-22). Si un cadete faltó varios días con fechas distintas, crea un evento por fecha con "dias" 1. Si solo hay un total sin fechas (por ejemplo "(3)", "3 inasistencias", "exceptuada (4)"), crea un solo evento con "dias" igual a ese número y "fecha" vacía. Si una fecha cae fuera de esta semana, consérvala tal cual.
Solo crea eventos para cadetes nombrados explícitamente; no inventes nombres. Una llamada de atención o felicitación es anecdota (neg o pos). Ya no existe práctica en el Centro Médico Naval: si se menciona Naval, usa la práctica del HCM de la misma materia y turno.`}
function promptCal(){const R=cads().filter(c=>c.asig&&c.asig[IMP.mk]);
  return `Lee la lista de calificaciones de la práctica clínica de ${MK[IMP.mk]} (fotos y/o texto). Columnas habituales: INSTRUMENTO, TRABAJO DE INVESTIGACIÓN, EVALUACIÓN PARCIAL FINAL, escala 0 a 10.
Cadetes posibles: ${R.map(c=>c.n).join("; ")}
Responde SOLO con JSON: {"filas":[{"nombre":"texto","instrumento":número o null,"trabajo":número o null,"evaluacion":número o null}],"notas":"texto o vacío"}. Si una celda es ilegible usa null y explícalo en notas. No inventes cadetes.`}
async function leer(){const canImg=!!(SAMPLE_LIM&&SAMPLE_LIM.images);IMP.st="leyendo";IMP.msg=IMP.files.length?"Se están leyendo los archivos…":"Se está leyendo el texto…";drawImp(canImg);
  try{const opts={modelTier:"complex",cache:false};
    const A=await prepararArchivos(canImg);if(A.imgs&&A.imgs.length)opts.images=A.imgs;
    IMP.extracto=A.texto||"";IMP.notes=A.notes||[];
    if(!(A.imgs&&A.imgs.length)&&!A.texto.trim()&&!IMP.texto.trim()){if((A.notes||[]).length){IMP.res={notas:(A.notes||[]).join("\n"),eventos:[],filas:[],partes:[]};IMP.st="rev";render();return}throw {code:A.omit?"images_unavailable":"empty"};}
    if(A.notes&&A.notes.length)toast(A.notes[0]);
    const base=IMP.tipo==="cal"?promptCal():promptNov();let extra=(IMP.texto.trim()?`\n\nTexto de la bitácora:\n"""\n${IMP.texto.trim()}\n"""`:"")+(A.texto.trim()?`\n\nContenido de los archivos adjuntos:\n"""${A.texto}\n"""`:"")+(A.notes&&A.notes.length?`\n\nNotas de la lectura automática:\n"""\n${A.notes.join("\n")}\n"""`:"");
    const lim=(SAMPLE_LIM&&SAMPLE_LIM.maxPromptBytes||400000)-new TextEncoder().encode(base).length-2000;if(new TextEncoder().encode(extra).length>lim){extra=extra.slice(0,Math.floor(lim/2));toast("El archivo es muy largo; se leyó solo la primera parte.")}
    window.__bitSemana=IMP.f;const r=await SAMPLE.json(base+extra,opts)||{};
    const res={notas:r.notas||"",partes:[],eventos:[],filas:[]};
    if(IMP.tipo==="cal"){const pool=cads().filter(c=>c.asig&&c.asig[IMP.mk]);res.filas=(r.filas||[]).map(x=>({...x,cid:matchCad(x.nombre,pool),ok:true}))}
    else{res.partes=(r.partes||[]).filter(x=>S.prac.has(x.practica)).map(x=>({...x,ok:true}));
      res.eventos=(r.eventos||[]).map(x=>{const cid=x.cid&&S.cad.has(x.cid)?x.cid:(matchCad(x.nombre,cads())||"");return asignarEv({...x,cid})})}
    if((IMP.notes||[]).length)res.notas=((res.notas?res.notas+" ":"")+IMP.notes.join(" ")).trim();IMP.res=res;IMP.st="rev"}
  catch(e){console.error(e);IMP.st="form";toast(e&&e.code==="not_granted"?"No se pudo usar el lector de archivos en esta página.":e&&e.code==="images_unavailable"?"No se pudo leer la imagen o el PDF escaneado. Prueba con una foto más nítida o pega el texto.":e&&e.code==="empty"?"El archivo no tiene texto legible.":e&&/docx/.test(e.message||"")?"El Word no se pudo abrir; guárdalo como .docx e inténtalo otra vez.":e&&e.code==="rate_limited"?"El lector está ocupado; inténtalo en un minuto.":"No se pudo leer la bitácora. Revisa el archivo o pega el texto.")}
  render()}
/* Práctica de cada novedad leída: (a) materia o sede escrita, (b) instructora, (c) por decidir. La fecha solo desempata. */
function asignarEv(x){const ctxA={practicas:pracs(),cadById:S.cad};
  const a=window.ReplicaBit?ReplicaBit.asignar({...x,fecha:isoOk(x.fecha)?x.fecha:""},ctxA):{practica:x.practica&&S.prac.has(x.practica)?x.practica:"",regla:x.practica?"indicada en el texto":"por decidir",candidatos:[],aviso:""};
  return {...x,practica:a.practica,regla:a.regla,candidatos:a.candidatos||[],aviso:a.aviso||"",ok:!!(x.cid&&a.practica)}}
const REGLA_TXT=r=>!r?"":r==="por decidir"?"Por asignar":r==="elegida por ti"?"Elegida por ti":r.replace(/^./,c=>c.toUpperCase());
function drawRev(box){const R=IMP.res,cal=IMP.tipo==="cal";const optsCad=(sel,pool)=>`<option value="">— Elegir cadete —</option>${pool.map(c=>`<option value="${c.id}" ${sel===c.id?"selected":""}>${esc(c.n)} (${ANIO[c.a]} ${esc(c.g)})</option>`).join("")}`;
  const all=cads().sort(cmpCad);
  box.innerHTML=`<h3>Revisa lo que se leyó · ${fLarga(IMP.f)}</h3>${R.notas?`<p class="notice" style="margin-top:8px">${esc(R.notas)}</p>`:""}
  ${cal?`<div class="tscroll" style="margin-top:8px"><table class="tbl" style="min-width:640px"><thead><tr><th class="num">Usar</th><th>Leído</th><th>Cadete</th><th class="num">Instr.</th><th class="num">Trab.</th><th class="num">Eval.</th></tr></thead><tbody>
    ${R.filas.map((x,i)=>`<tr class="${x.cid?"":"unm"}" data-i="${i}"><td class="num"><input type="checkbox" class="ok" ${x.ok&&x.cid?"checked":""} style="width:18px"></td><td>${esc(x.nombre)}</td><td><select class="cs">${optsCad(x.cid,all.filter(c=>c.asig&&c.asig[IMP.mk]))}</select></td>
    ${["instrumento","trabajo","evaluacion"].map(k=>`<td class="num"><input type="number" step="0.1" class="v" data-k="${k}" value="${x[k]??""}"></td>`).join("")}</tr>`).join("")||`<tr><td colspan="6" class="hint">No se encontraron filas.</td></tr>`}</tbody></table></div>`
  :`${R.partes.length?`<h3 style="margin-top:12px;border:0;padding:0">Partes por práctica</h3>`:""}
  ${R.partes.length?`<div class="tscroll" style="margin-top:6px"><table class="tbl" style="min-width:600px"><thead><tr><th class="num">Usar</th><th>Práctica</th><th class="num">Asistieron</th><th class="num">Efectivo</th><th>Novedades</th></tr></thead><tbody>
    ${R.partes.map((x,i)=>{const p=S.prac.get(x.practica);const ya=S.par.has(parteKey(IMP.f,x.practica));return `<tr data-pi="${i}"><td class="num"><input type="checkbox" class="ok" ${x.ok?"checked":""} style="width:18px"></td><td>${esc(pracLabel({id:x.practica,...p},true))}${ya?`<span class="sub" style="color:var(--warn)">Reemplaza el parte ya guardado</span>`:""}</td><td class="num">${x.asistieron??"—"}</td><td class="num"><input type="number" class="tt" value="${x.total??efectivo({id:x.practica,...p})}"></td><td>${(x.novedades||[]).map(n=>esc(novTxt({n:n.n,m:n.motivo,x:n.texto}))).join("<br>")||"Sin novedad"}</td></tr>`}).join("")}</tbody></table></div>`:""}
  ${(()=>{const P=pracs();const pOpts=x=>{const C=(x.candidatos||[]).filter(id=>S.prac.has(id));const R=P.filter(p=>!C.includes(p.id));
      const o=id=>{const p=S.prac.get(id);return `<option value="${id}" ${x.practica===id?"selected":""}>${esc(pracLabel({id,...p},true))}</option>`};
      return `<option value="">— Elegir práctica —</option>${C.length?`<optgroup label="Candidatas">${C.map(o).join("")}</optgroup><optgroup label="Otras prácticas">${R.map(p=>o(p.id)).join("")}</optgroup>`:P.map(p=>o(p.id)).join("")}`};
    const row=(x,i)=>`<tr class="${x.cid&&x.practica?"":"unm"}" data-ei="${i}"><td class="num"><input type="checkbox" class="ok" ${x.ok&&x.cid&&x.practica?"checked":""} ${x.cid&&x.practica?"":"disabled"} style="width:18px" aria-label="Usar"></td><td>${esc(x.leido||x.nombre||"")}</td><td><select class="cs">${optsCad(x.cid,all)}</select></td>
    <td><select class="pr" aria-label="Práctica">${pOpts(x)}</select>${x.aviso?`<span class="sub" style="color:var(--warn)">${esc(x.aviso)}</span>`:""}</td><td><span class="sub" style="margin:0">${esc(REGLA_TXT(x.regla))}</span></td>
    <td><input type="date" class="fe" value="${isoOk(x.fecha)?x.fecha:IMP.f}" style="width:140px"></td><td class="num"><input type="number" class="dd" min="1" value="${Math.max(1,Math.round(num(x.dias)||1))}"></td>
    <td><select class="tp">${TIPOS.map(([k,l])=>`<option value="${k}" ${x.tipo===k?"selected":""}>${l}</option>`).join("")}</select></td>
    <td><select class="mo"><option value="">—</option>${motOpts(x.motivo)}</select></td>
    <td><input type="checkbox" class="jj" ${x.justificada!==false?"checked":""} style="width:18px" aria-label="Justificada"></td><td>${esc([x.servicio&&!String(x.texto||"").includes(x.servicio)?x.servicio:"",x.texto||""].filter(Boolean).join(" · "))}</td></tr>`;
    const head=`<thead><tr><th class="num">Usar</th><th>Leído</th><th>Cadete</th><th>Práctica</th><th>Cómo se asignó</th><th>Fecha</th><th class="num">Días</th><th>Tipo</th><th>Motivo</th><th>J</th><th>Detalle</th></tr></thead>`;
    const pend=R.eventos.map((x,i)=>[x,i]).filter(([x])=>!x.practica||!x.cid),lis=R.eventos.map((x,i)=>[x,i]).filter(([x])=>x.practica&&x.cid);
    const H=(window.__bitEncabezados||[]).filter(h=>h.materia||h.sede||h.docente);
    return `${H.length?`<p class="hint" style="margin-top:10px">Encabezado leído: ${H.map(h=>esc([h.materia&&"Materia: "+h.materia,h.sede&&"Sede: "+h.sede,h.docente&&"Docente: "+h.docente].filter(Boolean).join(" · "))).join(" | ")}</p>`:""}
    <h3 style="margin-top:12px;border:0;padding:0">Pendientes por asignar (${pend.length})</h3>
    ${pend.length?`<p class="hint">La bitácora no dice con certeza a qué práctica van (o falta el cadete). Elige la práctica de cada una; no se guardan hasta que la elijas y oprimas Aplicar.</p>
    <div class="bar" style="margin:6px 0"><label class="hint" for="pall">Todas las pendientes a:</label><select id="pall"><option value="">— Elegir práctica —</option>${P.map(p=>`<option value="${p.id}">${esc(pracLabel(p,true))}</option>`).join("")}</select><button class="btn ghost" type="button" id="pallgo">Asignar</button></div>
    <div class="tscroll"><table class="tbl" style="min-width:1180px">${head}<tbody>${pend.map(([x,i])=>row(x,i)).join("")}</tbody></table></div>`:`<p class="hint">Ninguna.</p>`}
    <h3 style="margin-top:12px;border:0;padding:0">Novedades por cadete (${lis.length})</h3>
    ${lis.length?`<div class="tscroll" style="margin-top:6px"><table class="tbl" style="min-width:1180px">${head}<tbody>${lis.map(([x,i])=>row(x,i)).join("")}</tbody></table></div>`:`<p class="hint">No se nombró a ningún cadete con práctica asignada.</p>`}
    <div class="acts" style="justify-content:flex-start;margin-top:8px"><button class="btn ghost" type="button" id="radd">Agregar renglón</button></div>`})()}`}
  ${IMP.extracto?`<details id="textoLeido" style="margin-top:12px" open><summary>Texto leído en los archivos</summary><pre id="extractoTxt" class="hint" style="white-space:pre-wrap;max-height:240px;overflow:auto;margin-top:8px">${esc(IMP.extracto)}</pre></details>`:""}
  <div class="acts" style="margin-top:12px"><button class="btn ghost" id="rcan">Descartar</button><button class="btn" id="rap">Aplicar y guardar bitácora</button></div>`;
  box.querySelectorAll("tr[data-i]").forEach(tr=>{const x=R.filas[+tr.dataset.i];tr.querySelector(".ok").onchange=e=>x.ok=e.target.checked;tr.querySelector(".cs").onchange=e=>{x.cid=e.target.value;tr.classList.toggle("unm",!x.cid);if(x.cid){x.ok=true;tr.querySelector(".ok").checked=true}};tr.querySelectorAll(".v").forEach(i=>i.onchange=()=>x[i.dataset.k]=num(i.value))});
  box.querySelectorAll("tr[data-pi]").forEach(tr=>{const x=R.partes[+tr.dataset.pi];tr.querySelector(".ok").onchange=e=>x.ok=e.target.checked;tr.querySelector(".tt").onchange=e=>x.total=num(e.target.value)});
  box.querySelectorAll("tr[data-ei]").forEach(tr=>{const i=+tr.dataset.ei,x=R.eventos[i];tr.querySelector(".ok").onchange=e=>x.ok=e.target.checked;
    tr.querySelector(".cs").onchange=e=>{x.cid=e.target.value;if(x.regla!=="elegida por ti"){const y=asignarEv(x);Object.assign(x,y)}x.ok=!!(x.cid&&x.practica);drawRev(box)};
    tr.querySelector(".pr").onchange=e=>{x.practica=e.target.value;x.regla=x.practica?"elegida por ti":"por decidir";x.aviso=x.practica?"":x.aviso;x.ok=!!(x.cid&&x.practica);drawRev(box)};
    tr.querySelector(".fe").onchange=e=>x.fecha=e.target.value;tr.querySelector(".dd").onchange=e=>x.dias=num(e.target.value);tr.querySelector(".tp").onchange=e=>x.tipo=e.target.value;tr.querySelector(".mo").onchange=e=>{x.motivo=e.target.value;if(x.motivo==="injust"){x.justificada=false;tr.querySelector(".jj").checked=false}};tr.querySelector(".jj").onchange=e=>x.justificada=e.target.checked});
  const pg=$("#pallgo");if(pg)pg.onclick=()=>{const v=$("#pall").value;if(!v){toast("Elige la práctica");return}R.eventos.forEach(x=>{if(!x.practica){x.practica=v;x.regla="elegida por ti";x.aviso="";x.ok=!!x.cid}});drawRev(box)};
  const ra=$("#radd");if(ra)ra.onclick=()=>{R.eventos.push({nombre:"",leido:"(agregado a mano)",cid:"",fecha:IMP.f,dias:1,tipo:"falta",motivo:"",justificada:true,texto:"",practica:"",regla:"por decidir",candidatos:[],aviso:"",ok:false});drawRev(box)};
  $("#rcan").onclick=()=>{IMP.st="form";IMP.res=null;render()};
  $("#rap").onclick=aplicar}
async function aplicar(){const R=IMP.res,f=IMP.f;let n=0,pa=0;
  if(IMP.tipo==="cal"){R.filas.filter(x=>x.ok&&x.cid).forEach(x=>{const o=clone(S.cad.get(x.cid));o.cal=o.cal||{};const c=o.cal[IMP.mk]||{};
    [["instrumento","inst"],["trabajo","ti"],["evaluacion","ev"]].forEach(([a,b])=>{const v=num(x[a]);if(v!=null)c[b]=Math.min(10,Math.max(0,v))});o.cal[IMP.mk]=c;put("cadetes",x.cid,o,true);n++})}
  else{R.partes.filter(x=>x.ok).forEach(x=>{const p=S.prac.get(x.practica);let tot=num(x.total)??efectivo({id:x.practica,...p});const nov=(x.novedades||[]).map(v=>({n:num(v.n)||1,m:MOT_TXT[v.motivo]?v.motivo:"otro",x:v.texto||""}));
      if(!nov.length&&num(x.asistieron)!=null&&num(x.asistieron)<tot)nov.push({n:tot-num(x.asistieron),m:"otro",x:"sin motivo en la bitácora"});
      const fp=isoOk(x.fecha)?x.fecha:f;put("partes",parteKey(fp,x.practica),{f:fp,p:x.practica,tot,nov,src:"bitacora"},true);pa++});
    const sinP=R.eventos.filter(x=>x.cid&&!x.practica).length;
    if(sinP&&!confirm(`${sinP} novedad${sinP===1?"":"es"} sigue${sinP===1?"":"n"} sin práctica y no se guardará${sinP===1?"":"n"}. ¿Aplicar las demás?`))return;
    for(const x of R.eventos.filter(x=>x.ok&&x.cid&&x.practica&&S.prac.has(x.practica))){const det=[x.servicio&&!String(x.texto||"").includes(x.servicio)?x.servicio:"",x.texto||""].filter(Boolean).join(" · ");
      const e={f:isoOk(x.fecha)?x.fecha:f,c:x.cid,p:x.practica,t:x.tipo||"falta",x:det,ra:x.regla||""};const dd=Math.round(num(x.dias)||1);if(dd>1)e.d=dd;
      if(e.t==="falta"){e.m=MOT_TXT[x.motivo]?x.motivo:"otro";e.j=x.justificada!==false&&e.m!=="injust"}
      if(e.t==="anecdota")e.pol=x.polaridad==="pos"?"pos":"neg";if(e.t==="arresto")e.h=num(x.horas);
      const dup=evs().some(o=>o.c===e.c&&o.f===e.f&&o.t===e.t&&(o.p||"")===e.p);if(!dup){await addEv(e);n++}}}
  const res=IMP.tipo==="cal"?`${n} calificaciones aplicadas`:`${pa?`${pa} parte${pa===1?"":"s"} y `:""}${n} novedad${n===1?"":"es"} aplicada${n===1?"":"s"}`;
  await archivar(res);IMP.st="form";IMP.res=null;IMP.files=[];IMP.texto="";render();toast(res)}
async function archivar(resumen){const imgs=[];
  if(ASSETS)for(const f of IMP.files){try{const k=kindOf(f);let b=f;if(k==="img")b=await shrink(f);
    const u=await ASSETS.upload(b,{type:f.type||undefined,name:f.name});imgs.push({id:u.id,url:u.url,k,name:f.name})}catch(e){console.warn(e)}}
  else if(IMP.files.length)toast("Esta vista no puede guardar archivos adjuntos; se guardó solo el resumen.");
  const texto=[IMP.texto.trim(),IMP.extracto?("--- Texto leído ---\n"+IMP.extracto):""].filter(Boolean).join("\n\n");
  const d={f:IMP.f,tipo:IMP.tipo,imgs,texto,resumen,at:new Date().toISOString()};if(IMP.tipo==="cal")d.mk=IMP.mk;
  return put("bitacoras",uid(),d,true)}

/* Ajustes y exportación */
function vCfg(){const P=pracs();const c=S.cfg;
  VW.innerHTML=`<h2>Ajustes</h2>
  <section class="box"><h3>Concentrado en Excel</h3><p class="hint" style="margin:4px 0 10px">Un libro con los partes diarios, una hoja por práctica con la asistencia de cada cadete por fecha (A, o el motivo con J o I), inasistencias, anecdotario, arrestos y calificaciones.</p>
  <button class="btn" id="xl" ${DL?"":"disabled"}>Descargar concentrado .xlsx</button>${DL?"":`<p class="hint" style="margin-top:6px">Esta vista no permite descargar archivos.</p>`}</section>
  <section class="box"><h3>Criterios</h3><div class="g4" style="margin-top:8px"><label class="hint">Mínimo aprobatorio<input type="number" step="0.1" id="cmin" value="${c.minimo}" class="inp"></label><label class="hint">En riesgo desde (% de inasistencias)<input type="number" id="clim" min="1" max="100" value="${num(c.riesgoPct)??30}" class="inp"></label><label class="hint">Horas por día de práctica<input type="number" id="chd" min="1" value="${HD()}" class="inp"></label></div>
  <p class="hint" style="margin:10px 0 4px">Horas efectivas por materia (reglamento)</p><div class="g4">${["fund","mq","sp","quir","psiq","tsu"].map(mk=>`<label class="hint">${MK[mk]}<input type="number" class="inp hm" data-mk="${mk}" min="0" value="${hMat(mk)??""}" placeholder="Sin dato: fechas × ${HD()} h"></label>`).join("")}</div>
  <p class="hint" style="margin:10px 0 4px">Ponderación de la calificación final (%)</p><div class="g4"><label class="hint">Instrumento<input type="number" id="pw1" value="${c.pesos.inst}" class="inp"></label><label class="hint">Trabajo de investigación<input type="number" id="pw2" value="${c.pesos.ti}" class="inp"></label><label class="hint">Evaluación parcial final<input type="number" id="pw3" value="${c.pesos.ev}" class="inp"></label></div></section>
  <h2>Prácticas</h2><p class="lead">Edita el docente que aparece en el parte, las instructoras que rotan en cada campo clínico, fechas y días. El cambio se refleja en el parte y en el mensaje de WhatsApp. Para cambiar a un cadete de sede, ábrelo en Cadetes.</p>
  <div class="tscroll"><table class="tbl" style="min-width:1320px"><thead><tr><th>Materia</th><th>Sede</th><th>Turno</th><th>Docente en el parte</th><th>Instructoras (separa con ;)</th><th>Inicio</th><th>Término</th><th>Días</th><th class="num">Efectivo</th></tr></thead><tbody>
  ${P.map(p=>`<tr data-p="${p.id}"><td>${yrChip(p.anio)} ${esc(MK[p.mk]||p.materia)}</td><td><input class="pe" data-k="sede" value="${esc(p.sede)}" style="width:130px;text-align:left"></td><td><select class="pe" data-k="turno"><option value="1" ${p.turno==="1"?"selected":""}>1/er.</option><option value="2" ${p.turno==="2"?"selected":""}>2/o.</option></select></td>
  <td><input class="pe" data-k="docente" value="${esc(p.docente)}" style="width:290px;text-align:left"></td><td><input class="pe" data-k="instructoras" value="${esc(instr(p).join("; "))}" style="width:340px;text-align:left"></td><td><input type="date" class="pe" data-k="ini" value="${p.ini}" style="width:140px"></td><td><input type="date" class="pe" data-k="fin" value="${p.fin}" style="width:140px"></td>
  <td style="white-space:nowrap">${[1,2,3,4,5].map(d=>`<label style="display:inline-flex;gap:2px;margin-right:4px;font-size:13px"><input type="checkbox" class="pd" value="${d}" ${(p.dias||[]).includes(d)?"checked":""} style="width:16px">${DIAS[d]}</label>`).join("")}</td>
  <td class="num">${p.efectivo?`<input type="number" class="pe" data-k="efectivo" value="${p.efectivo}">`:roster(p.id).length}</td></tr>`).join("")}</tbody></table></div>
  <section class="box" style="margin-top:14px"><h3>Agregar práctica</h3><div class="g4" style="margin-top:8px">
   <label class="hint">Materia<select id="nmk" class="inp">${Object.entries(MK).map(([k,l])=>`<option value="${k}">${l}</option>`).join("")}</select></label>
   <label class="hint">Sede<input id="nse" class="inp" placeholder="HCM"></label><label class="hint">Turno<select id="ntu" class="inp"><option value="1">1/er.</option><option value="2">2/o.</option></select></label><label class="hint">Docente<input id="ndo" class="inp"></label></div>
   <div class="acts" style="margin-top:10px"><button class="btn" id="nadd">Agregar</button></div></section>`;
  VW.querySelectorAll(".inp").forEach(i=>{i.style.cssText="padding:8px;border:1px solid var(--line);border-radius:8px;background:var(--paper);width:100%"});
  const sc=()=>{c.minimo=num($("#cmin").value)??6;c.riesgoPct=num($("#clim").value)??30;c.horasDia=num($("#chd").value)??5;c.horasMateria={};VW.querySelectorAll(".hm").forEach(i=>{const v=num(i.value);if(v!=null)c.horasMateria[i.dataset.mk]=v});c.pesos={inst:num($("#pw1").value)??0,ti:num($("#pw2").value)??0,ev:num($("#pw3").value)??0};saveCfg();toast("Criterios guardados")};
  ["#cmin","#clim","#chd","#pw1","#pw2","#pw3"].forEach(s=>$(s).onchange=sc);VW.querySelectorAll(".hm").forEach(i=>i.onchange=sc);
  VW.querySelectorAll("tr[data-p]").forEach(tr=>{const id=tr.dataset.p;const sv=()=>{const o={...S.prac.get(id)};tr.querySelectorAll(".pe").forEach(i=>o[i.dataset.k]=i.dataset.k==="efectivo"?num(i.value):i.dataset.k==="instructoras"?i.value.split(";").map(x=>x.trim()).filter(Boolean):i.value);
    o.dias=[...tr.querySelectorAll(".pd:checked")].map(i=>+i.value);put("practicas",id,o,true);toast("Práctica actualizada")};tr.querySelectorAll("input,select").forEach(i=>i.onchange=sv)});
  $("#nadd").onclick=()=>{const mk=$("#nmk").value,sede=$("#nse").value.trim();if(!sede){toast("Escribe la sede");return}
    const ref=pracs().find(p=>p.mk===mk)||{};const id=mk+"-"+norm(sede).replace(/[^a-z0-9]+/g,"-")+"-"+uid().slice(-4);
    put("practicas",id,{materia:ref.materia||MK[mk].toUpperCase(),mk,sede,turno:$("#ntu").value,docente:$("#ndo").value.trim(),ini:ref.ini||today(),fin:ref.fin||today(),dias:ref.dias||[2,3,4],horario:ref.horario||"",anio:ref.anio||"4",orden:P.length});toast("Práctica agregada")};
  const xl=$("#xl");if(xl)xl.onclick=exportar}
async function loadXLSX(){if(window.XLSX)return window.XLSX;await new Promise((res,rej)=>{const s=document.createElement("script");s.src="vendor/xlsx.bundle.js";s.onload=res;s.onerror=rej;document.head.appendChild(s)});return window.XLSX}
async function exportar(){const b=$("#xl");b.disabled=true;b.textContent="Preparando…";
  try{const X=await loadXLSX();const wb=X.utils.book_new();const add=(name,rows,w)=>{const ws=X.utils.aoa_to_sheet(rows);if(w)ws["!cols"]=w.map(x=>({wch:x}));if(window.ReplicaPC&&ReplicaPC.styleSheet)ReplicaPC.styleSheet(ws);X.utils.book_append_sheet(wb,ws,name.slice(0,31))};
    const P=pracs(),D=[...S.par.values()].sort((a,b)=>a.f.localeCompare(b.f)||(S.prac.get(a.p)||{}).orden-(S.prac.get(b.p)||{}).orden);
    add("Partes",[["Fecha","Turno","Materia","Sede","Docente","Asistieron","Efectivo","Novedades"],...D.map(d=>{const p=S.prac.get(d.p)||{};const x=parteDe(d.f,d.p);return [d.f,p.turno==="2"?"2/o.":"1/er.",p.materia,p.sede,p.docente,x.asi,x.tot,x.nov.map(novTxt).join("; ")]})],[11,7,36,16,44,10,9,50]);
    const E=evs();const used=new Set();
    P.filter(p=>!p.efectivo&&(roster(p.id).length)).forEach(p=>{const fs=D.filter(d=>d.p===p.id).map(d=>d.f);const R=roster(p.id);
      const rows=[[`${p.materia} · ${p.sede} · ${p.turno==="2"?"2/o.":"1/er."} turno`],[`Instructoras: ${instr(p).join("; ")}`],[],["No.","Nombre","Matrícula","Año","Grupo",...fs.map(f=>f.slice(8)+"/"+f.slice(5,7)),"Faltas J","Faltas I","Retardos",`% inasistencia (de ${horasProg(p)} h)`]];
      R.forEach((c,i)=>{const ce=E.filter(e=>e.c===c.id&&e.p===p.id);const cells=fs.map(f=>{const e=ce.find(e=>e.f===f&&e.t==="falta");const r=ce.find(e=>e.f===f&&e.t==="retardo");return e?`${(MOT_TXT[e.m]||"Otro")} (${e.j?"J":"I"})`:r?"R":"A"});
        rows.push([i+1,c.n,c.mat||"",ANIO[c.a],c.g,...cells,sumC(ce.filter(e=>e.t==="falta"&&e.j)),sumC(ce.filter(e=>e.t==="falta"&&!e.j)),ce.filter(e=>e.t==="retardo").length,horasProg(p)?Math.round(sumC(ce.filter(e=>e.t==="falta"))*HD()/horasProg(p)*1000)/10:""])});
      let nm=(MK[p.mk]||p.mk).replace("Enfermería ","").slice(0,14)+" "+p.sede.slice(0,10)+(p.turno==="2"?" V":"");nm=nm.replace(/[\\/?*\[\]:]/g,"");while(used.has(nm))nm+="+";used.add(nm);
      add(nm,rows,[5,36,13,7,6,...fs.map(()=>9),8,8,8,14])});
    const row=e=>{const c=S.cad.get(e.c)||{};const p=S.prac.get(e.p)||{};return [e.f,c.n||"",c.mat||"",ANIO[c.a]||"",c.g||"",p.materia||"",p.sede||""]};
    const F=E.filter(e=>e.t==="falta").sort((a,b)=>a.f.localeCompare(b.f));
    add("Inasistencias",[["Fecha","Nombre","Matrícula","Año","Grupo","Materia","Sede","Días","Motivo","J/I","Reposición","Observaciones"],...F.map(e=>[...row(e),cnt(e),MOT_TXT[e.m]||"Otro",e.j?"J":"I",REP_TXT[e.rep||"pendiente"],e.x||""])],[11,34,13,7,6,34,16,6,26,5,20,40]);
    add("Retardos",[["Fecha","Nombre","Matrícula","Año","Grupo","Materia","Sede","Observaciones"],...E.filter(e=>e.t==="retardo").map(e=>[...row(e),e.x||""])],[11,34,13,7,6,34,16,40]);
    add("Anecdotario",[["Fecha","Nombre","Matrícula","Año","Grupo","Materia","Sede","Tipo","Hecho"],...E.filter(e=>e.t==="anecdota").map(e=>[...row(e),e.pol==="neg"?"Negativa":"Positiva",e.x||""])],[11,34,13,7,6,34,16,10,60]);
    add("Arrestos",[["Fecha","Nombre","Matrícula","Año","Grupo","Materia","Sede","Horas","Impuesto por","Motivo"],...E.filter(e=>e.t==="arresto").map(e=>[...row(e),e.h??"",e.por||"",e.x||""])],[11,34,13,7,6,34,16,7,30,50]);
    Object.keys(MK).filter(mk=>mk!=="tsu").forEach(mk=>{const C=cads().filter(c=>c.asig&&c.asig[mk]).sort(cmpCad);if(!C.length)return;
      add("Calif "+MK[mk].replace("Enfermería ",""),[["No.","Nombre","Matrícula","Año","Grupo","Campo clínico","Instrumento","Trabajo de investigación","Evaluación parcial final","Final"],...C.map((c,i)=>{const k=(c.cal||{})[mk]||{};return [i+1,c.n,c.mat||"",ANIO[c.a],c.g,(S.prac.get(c.asig[mk].p)||{}).sede||"",k.inst??"",k.ti??"",k.ev??"",califFinal(k)??""]})],[5,36,13,7,6,16,11,11,11,8])});
    const out=X.write(wb,{bookType:"xlsx",type:"array"});
    await DL.save({filename:`CONCENTRADO PRACTICA CLINICA ${today()}.xlsx`,data:new Blob([out],{type:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"})});toast("Concentrado listo")}
  catch(e){console.error(e);if(!(e&&e.code==="declined"))toast("No se pudo generar el Excel. Inténtalo otra vez.")}
  b.disabled=false;b.textContent="Descargar concentrado .xlsx"}


/* ---------- monitor: trazo de ECG y reloj ---------- */
(function monitor(){const c=$("#ecg");const ck=$("#clock");
  const tick=()=>{const d=new Date();ck.textContent=`${DIAS[d.getDay()].toUpperCase()} ${pad(d.getDate())} ${MES3[d.getMonth()].toUpperCase()} ${d.getFullYear()} · ${pad(d.getHours())}:${pad(d.getMinutes())}`};tick();setInterval(tick,20000);
  if(!c||!c.getContext)return;const x=c.getContext("2d");const N=720,GAP=26,buf=new Float32Array(N);let head=0,t=0,w=0,h=0,last=0;
  const beat=p=>p<.08?Math.sin(p/.08*Math.PI)*.1:p<.15?0:p<.17?-.14:p<.2?1:p<.23?-.32:p<.32?0:p<.48?Math.sin((p-.32)/.16*Math.PI)*.2:0;
  const fit=()=>{const r=window.devicePixelRatio||1;w=c.clientWidth;h=c.clientHeight;c.width=Math.max(1,w*r);c.height=Math.max(1,h*r);x.setTransform(r,0,0,r,0,0)};fit();addEventListener("resize",fit);
  const push=()=>{t++;buf[head]=beat((t%150)/150);head=(head+1)%N};
  const draw=()=>{x.clearRect(0,0,w,h);const mid=h*.66,amp=h*.5,dx=w/(N-1);x.lineWidth=2;x.lineJoin="round";x.strokeStyle="#39FF88";x.shadowColor="#39FF88";x.shadowBlur=10;
    x.beginPath();let pen=false;for(let i=0;i<N;i++){const gap=(i-head+N)%N<GAP;if(gap){pen=false;continue}const px=i*dx,py=mid-buf[i]*amp;if(!pen){x.moveTo(px,py);pen=true}else x.lineTo(px,py)}x.stroke();
    const hx=((head-1+N)%N)*dx,hy=mid-buf[(head-1+N)%N]*amp;x.fillStyle="#C9FFE0";x.shadowBlur=16;x.beginPath();x.arc(hx,hy,2.6,0,Math.PI*2);x.fill()};
  if(RED){for(let i=0;i<N;i++)push();head=N-GAP;draw();return}
  for(let i=0;i<N*.6;i++)push();
  const loop=now=>{const dt=Math.min(64,now-(last||now));last=now;const k=Math.max(1,Math.round(dt/16*2.2));for(let i=0;i<k;i++)push();if(!document.hidden)draw();requestAnimationFrame(loop)};requestAnimationFrame(loop)})();
/* ---------- arranque ---------- */
(async function boot(){
  const tm=setTimeout(()=>{if(S.loaded<2){notice("No hubo respuesta de la base de datos. Revisa tu conexión y vuelve a abrir la página.");S.loaded=2;render()}},10000);
  const use=window.claude&&window.claude.use;
  if(!use){clearTimeout(tm);notice("No se pudo iniciar el almacenamiento local del seguimiento.");S.loaded=2;render();return}
  const db=await window.claude.use("db");
  if(!db){clearTimeout(tm);notice("No se pudo abrir la base de datos local del seguimiento.");S.loaded=2;render();return}
  S.db=db;
  const sub=(col,M,first)=>db.collection(col).onSnapshot(s=>{M.clear();s.docs.forEach(d=>M.set(d.id,d.data()));if(first){S.loaded++;if(S.loaded>=2)clearTimeout(tm)}
    if($("#dFicha").open&&FI)drawFicha();if(S.view==="par"&&document.activeElement&&document.activeElement.closest&&document.activeElement.closest(".card"))return;render()},e=>{console.error(e);notice("No se pudieron leer los datos: "+(e.message||e.code))});
  sub("practicas",S.prac,true);sub("cadetes",S.cad,true);sub("eventos",S.ev);sub("partes",S.par);sub("bitacoras",S.bit);
  db.doc("ajustes/general").onSnapshot(s=>{if(s.exists)S.cfg={...S.cfg,...s.data()};render()},()=>{});
  Promise.all([window.claude.use("sample"),window.claude.use("assets"),window.claude.use("downloads")]).then(async([s,a,d])=>{SAMPLE=s;ASSETS=a;DL=d;
    if(s){try{SAMPLE_LIM=await s.limits()}catch(e){}}if(S.view==="bit"||S.view==="cfg"||S.view==="est")render()});
})();
