/* Sección Estadísticas: consulta general o específica y descarga en Excel. */
(function (global) {
  "use strict";

  const MESN = { enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6, julio: 7, agosto: 8, septiembre: 9, setiembre: 9, octubre: 10, noviembre: 11, diciembre: 12 };

  function estState() {
    if (!S.est) {
      S.est = { q: "", a: "", g: "", p: "", sede: "", t: "", mk: "", mot: "", tipo: "", cid: "", desde: "", hasta: "", mes: "", interp: "" };
    }
    return S.est;
  }

  function parsePedido(s) {
    const f = { q: s || "" };
    const t = norm(s);
    if (!t) return f;
    if (/retardo/.test(t)) f.tipo = "retardo";
    else if (/anecdot/.test(t)) f.tipo = "anecdota";
    else if (/arresto/.test(t)) f.tipo = "arresto";
    else if (/inasist|falta/.test(t)) f.tipo = "falta";
    if (/\b2(\/o)?(\.|er|do)?\b/.test(t) || /segundo ano/.test(t)) f.a = "2";
    if (/\b3(\/o)?(\.|er|er)?\b/.test(t) || /tercer ano/.test(t)) f.a = "3";
    if (/\b4(\/o)?(\.|to|to)?\b/.test(t) || /cuarto ano/.test(t)) f.a = "4";
    if (/t\.?s\.?u/.test(t)) f.a = "T";
    if (/2o\.?\s*turno|segundo turno/.test(t)) f.t = "2";
    else if (/1er\.?\s*turno|primer turno/.test(t)) f.t = "1";
    const gm = t.match(/grupo\s+([a-e])/);
    if (gm) f.g = gm[1].toUpperCase();
    Object.keys(MESN).forEach(m => {
      const re = new RegExp("\\b" + m + "\\b");
      const re3 = new RegExp("\\b" + m.slice(0, 3) + "\\.?\\b");
      if (re.test(t) || re3.test(t)) f.mes = String(MESN[m]);
    });
    if (/esta semana|semana actual/.test(t) && typeof monday === "function" && typeof today === "function") {
      f.desde = monday(today());
      f.hasta = typeof addD === "function" ? addD(f.desde, 6) : f.desde;
    }
    if (typeof MOT_ALL !== "undefined") {
      MOT_ALL.forEach(m => {
        if (m.slice(1).some(x => x && t.includes(norm(x)))) f.mot = m[0];
      });
    }
    if (typeof MK !== "undefined") {
      Object.keys(MK).forEach(k => { if (t.includes(norm(MK[k])) || t.includes(norm(k))) f.mk = k; });
    }
    const mat = s.match(/\b([A-Z]-?\d{5,})\b/i);
    if (mat && typeof cads === "function") {
      const m = mat[1].toUpperCase().replace(/^(A|D|C)(\d)/, "$1-$2");
      const c = cads().find(x => (x.mat || "").toUpperCase() === m || (x.mat || "").replace(/-/g, "") === m.replace(/-/g, ""));
      if (c) f.cid = c.id;
    }
    if (typeof cads === "function") {
      const parts = t.split(/[^a-z]+/).filter(w => w.length > 2);
      let best = null, bs = 0;
      cads().forEach(c => {
        const cn = new Set(norm(c.n).split(/[^a-z]+/).filter(Boolean));
        const hit = parts.filter(w => cn.has(w)).length;
        if (hit >= 2 && hit > bs) { bs = hit; best = c; }
      });
      if (best && !f.cid) f.cid = best.id;
    }
    if (typeof pracs === "function") {
      pracs().forEach(p => {
        if (p.sede && t.includes(norm(p.sede))) f.sede = p.sede;
      });
    }
    const iso = s.match(/\d{4}-\d{2}-\d{2}/g);
    if (iso && iso.length === 1) { f.desde = iso[0]; f.hasta = iso[0]; }
    if (iso && iso.length >= 2) { f.desde = iso[0]; f.hasta = iso[1]; }
    const dmy = s.match(/(\d{1,2})\s+de\s+([a-záéíóú]+)/i);
    if (dmy && f.mes) {
      const y = (typeof today === "function" ? today() : "2026-01-01").slice(0, 4);
      const iso1 = y + "-" + String(+f.mes).padStart(2, "0") + "-" + String(+dmy[1]).padStart(2, "0");
      f.desde = f.desde || iso1;
      f.hasta = f.hasta || iso1;
    }
    if (f.mes && !f.desde) {
      const y = (typeof today === "function" ? today() : "2026-01-01").slice(0, 4);
      const m = String(+f.mes).padStart(2, "0");
      f.desde = y + "-" + m + "-01";
      const last = new Date(+y, +f.mes, 0).getDate();
      f.hasta = y + "-" + m + "-" + String(last).padStart(2, "0");
    }
    return f;
  }

  function applyPedido() {
    const E = estState();
    const f = parsePedido(E.q);
    const keys = ["a", "g", "p", "sede", "t", "mk", "mot", "tipo", "cid", "desde", "hasta", "mes"];
    keys.forEach(k => { if (f[k]) E[k] = f[k]; });
    const bits = [];
    if (f.cid && S.cad.get(f.cid)) bits.push("cadete " + S.cad.get(f.cid).n);
    if (f.a) bits.push((typeof ANIO !== "undefined" && ANIO[f.a]) || f.a);
    if (f.g) bits.push("grupo " + f.g);
    if (f.sede) bits.push(f.sede);
    if (f.tipo && typeof TIPO_TXT !== "undefined") bits.push(TIPO_TXT[f.tipo] || f.tipo);
    if (f.mot && typeof MOT_TXT !== "undefined") bits.push(MOT_TXT[f.mot] || f.mot);
    if (f.desde || f.hasta) bits.push((f.desde || "…") + " a " + (f.hasta || "…"));
    E.interp = bits.length ? "Se interpretó: " + bits.join(", ") + "." : (E.q.trim() ? "No se reconocieron filtros en el pedido; se muestran los datos generales. Ajusta los menús si hace falta." : "");
  }

  function inFilter(e, F) {
    const c = S.cad.get(e.c) || {};
    const p = S.prac.get(e.p) || {};
    if (F.tipo && e.t !== F.tipo) return false;
    if (F.mot && (e.m || "") !== F.mot) return false;
    if (F.desde && (e.f || "") < F.desde) return false;
    if (F.hasta && (e.f || "") > F.hasta) return false;
    if (F.a && c.a !== F.a) return false;
    if (F.g && (c.g || "") !== F.g) return false;
    if (F.cid && e.c !== F.cid) return false;
    if (F.p && e.p !== F.p) return false;
    if (F.mk && p.mk !== F.mk) return false;
    if (F.sede && (p.sede || "") !== F.sede) return false;
    if (F.t && (p.turno || "") !== F.t) return false;
    if (F.q && !F.cid) {
      const blob = norm([c.n, c.mat, c.g, p.sede, p.materia, e.x, e.m].join(" "));
      const words = norm(F.q).split(/[^a-z0-9]+/).filter(w => w.length > 2 && !["inasistencias", "inasistencia", "faltas", "falta", "del", "las", "los", "por", "con", "una", "unos"].includes(w));
      if (words.length && !words.some(w => blob.includes(w))) {
        /* don't exclude if the query was only filters we already applied */
        const onlyFilters = words.every(w => /octubre|noviembre|septiembre|agosto|julio|junio|mayo|abril|marzo|febrero|enero|ano|grupo|turno|primer|segundo|tercer|cuarto|servicio|comision|cita|encamado|exceptu/.test(w));
        if (!onlyFilters) return false;
      }
    }
    return true;
  }

  function filtered() {
    const F = estState();
    return evs().filter(e => inFilter(e, F));
  }

  function filteredCads(E) {
    const F = estState();
    const ids = new Set(E.map(e => e.c));
    let list = cads();
    if (F.cid) list = list.filter(c => c.id === F.cid);
    if (F.a) list = list.filter(c => c.a === F.a);
    if (F.g) list = list.filter(c => c.g === F.g);
    if (F.p) list = list.filter(c => Object.values(c.asig || {}).some(a => a.p === F.p));
    if (F.mk) list = list.filter(c => (c.asig || {})[F.mk]);
    if (F.sede || F.t) {
      list = list.filter(c => Object.values(c.asig || {}).some(a => {
        const p = S.prac.get(a.p);
        if (!p) return false;
        if (F.sede && p.sede !== F.sede) return false;
        if (F.t && p.turno !== F.t) return false;
        return true;
      }));
    }
    return list;
  }

  function groupCount(rows, keyFn) {
    const m = new Map();
    rows.forEach(r => {
      const k = keyFn(r);
      if (!m.has(k)) m.set(k, { k, n: 0, h: 0, rows: [] });
      const o = m.get(k);
      o.n += typeof cnt === "function" && r.t === "falta" ? cnt(r) : 1;
      o.h += (r.t === "falta" ? (typeof cnt === "function" ? cnt(r) : 1) * (typeof HD === "function" ? HD() : 5) : 0);
      o.rows.push(r);
    });
    return [...m.values()].sort((a, b) => b.n - a.n);
  }

  function weekKey(iso) {
    if (!iso) return "—";
    const L = monday(iso);
    return L + " / " + addD(L, 6);
  }

  function monthKey(iso) {
    if (!iso) return "—";
    const [y, m] = iso.split("-");
    return (typeof MESES !== "undefined" ? MESES[+m - 1] : m) + " " + y;
  }

  function compute() {
    const E = filtered();
    const C = filteredCads(E);
    const fal = E.filter(e => e.t === "falta");
    const fj = fal.filter(e => e.j);
    const fi = fal.filter(e => !e.j);
    const totF = typeof sumC === "function" ? sumC(fal) : fal.length;
    const totH = totF * (typeof HD === "function" ? HD() : 5);
    const ret = E.filter(e => e.t === "retardo").length;
    const an = E.filter(e => e.t === "anecdota");
    const arr = E.filter(e => e.t === "arresto");
    const hrs = arr.reduce((s, e) => s + (num(e.h) || 0), 0);
    const porAnio = groupCount(fal, e => { const c = S.cad.get(e.c) || {}; return (typeof ANIO !== "undefined" && ANIO[c.a]) || c.a || "—"; });
    const porGrupo = groupCount(fal, e => { const c = S.cad.get(e.c) || {}; return ((typeof ANIO !== "undefined" && ANIO[c.a]) || c.a || "") + " " + (c.g || ""); });
    const porSede = groupCount(E, e => (S.prac.get(e.p) || {}).sede || "—");
    const porPrac = groupCount(E, e => { const p = S.prac.get(e.p); return p ? pracLabel(p, true) : "Sin práctica"; });
    const porMot = groupCount(fal, e => (typeof MOT_TXT !== "undefined" && MOT_TXT[e.m]) || e.m || "Otro");
    const porTipo = groupCount(E, e => (typeof TIPO_TXT !== "undefined" && TIPO_TXT[e.t]) || e.t || "—");
    const porMes = groupCount(E, e => monthKey(e.f)).sort((a, b) => (a.rows[0] && a.rows[0].f || "").localeCompare(b.rows[0] && b.rows[0].f || ""));
    const porSem = groupCount(E, e => weekKey(e.f)).sort((a, b) => String(a.k).localeCompare(String(b.k)));
    const byCad = new Map();
    fal.forEach(e => {
      if (!byCad.has(e.c)) byCad.set(e.c, []);
      byCad.get(e.c).push(e);
    });
    const ranking = [...byCad.entries()].map(([id, L]) => {
      const c = S.cad.get(id) || { n: "—", a: "", g: "", mat: "" };
      const n = typeof sumC === "function" ? sumC(L) : L.length;
      const r = typeof peorRiesgo === "function" ? peorRiesgo(id) : null;
      return { id, c, n, h: n * (typeof HD === "function" ? HD() : 5), r, niv: typeof nivel === "function" ? nivel(r) : "" };
    }).sort((a, b) => (b.r && b.r.pct || 0) - (a.r && a.r.pct || 0) || b.n - a.n);
    const enRiesgo = ranking.filter(x => x.niv === "riesgo");
    const cerca = ranking.filter(x => x.niv === "cerca");
    return {
      E, C, fal, totF, totH,
      fj: typeof sumC === "function" ? sumC(fj) : fj.length,
      fi: typeof sumC === "function" ? sumC(fi) : fi.length,
      ret, anP: an.filter(e => e.pol !== "neg").length, anN: an.filter(e => e.pol === "neg").length,
      arr: arr.length, hrs,
      porAnio, porGrupo, porSede, porPrac, porMot, porTipo, porMes, porSem,
      ranking, enRiesgo, cerca
    };
  }

  function filtroTxt() {
    const F = estState();
    const bits = [];
    if (F.cid && S.cad.get(F.cid)) bits.push(S.cad.get(F.cid).n);
    if (F.a) bits.push((ANIO && ANIO[F.a]) || F.a);
    if (F.g) bits.push("Grupo " + F.g);
    if (F.p && S.prac.get(F.p)) bits.push(pracLabel(S.prac.get(F.p), true));
    if (F.mk && MK[F.mk]) bits.push(MK[F.mk]);
    if (F.sede) bits.push(F.sede);
    if (F.t) bits.push(F.t === "2" ? "2/o. turno" : "1/er. turno");
    if (F.tipo && TIPO_TXT[F.tipo]) bits.push(TIPO_TXT[F.tipo]);
    if (F.mot && MOT_TXT[F.mot]) bits.push(MOT_TXT[F.mot]);
    if (F.desde || F.hasta) bits.push((F.desde || "inicio") + " – " + (F.hasta || "hoy"));
    if (F.q && !bits.length) bits.push("Pedido: " + F.q);
    return bits.length ? bits.join(" · ") : "Todos los registros";
  }

  function barRow(label, n, max, sub) {
    const pc = max ? Math.round(n / max * 100) : 0;
    return `<div class="crow"><span>${esc(label)}${sub ? `<span class="sub">${esc(sub)}</span>` : ""}</span><div class="ebar"><i style="width:${pc}%"></i></div><b>${n}</b></div>`;
  }

  function tableBlock(title, rows, cols) {
    if (!rows.length) return `<section class="box"><h3>${title}</h3><p class="hint">Sin datos con estos filtros.</p></section>`;
    const max = Math.max(...rows.map(r => r.n), 1);
    const tot = rows.reduce((s, r) => s + r.n, 0) || 1;
    return `<section class="box"><h3>${title}</h3>
      ${rows.map(r => barRow(r.k, r.n, max, (r.n / tot * 100).toFixed(1) + " %")).join("")}</section>`;
  }

  function vEst() {
    const F = estState();
    const st = compute();
    const P = pracs();
    const sedes = [...new Set(P.map(p => p.sede).filter(Boolean))].sort();
    const grupos = [...new Set(cads().map(c => c.g).filter(Boolean))].sort();
    const maxBar = Math.max(1, ...[...st.porMot, ...st.porPrac].map(r => r.n));
    VW.innerHTML = `<h2>Estadísticas</h2>
      <p class="lead">Consulta un dato general o uno específico: cadete, grupo, año, práctica, sede, turno, motivo, tipo de novedad, mes o rango de fechas. El resultado se ve aquí y se puede descargar en Excel (Noto Sans 10).</p>
      <section class="box" id="estQ">
        <label class="hint" for="estq">Pedido en texto (opcional)</label>
        <div class="bar" style="margin:6px 0 8px">
          <input class="inp" id="estq" placeholder="Ej. inasistencias de 2/o. año en octubre por comisión" value="${esc(F.q)}" style="flex:1;min-width:200px">
          <button class="btn" type="button" id="estInterp">Interpretar pedido</button>
        </div>
        ${F.interp ? `<p class="hint" id="estInterpMsg">${esc(F.interp)}</p>` : `<p class="hint">Puedes escribir el pedido o usar los filtros.</p>`}
        <div class="g4" style="margin-top:10px">
          <label class="hint">Año<select id="esta"><option value="">Todos</option>${Object.keys(ANIO).map(a => `<option value="${a}" ${F.a===a?"selected":""}>${ANIO[a]}</option>`).join("")}</select></label>
          <label class="hint">Grupo<select id="estg"><option value="">Todos</option>${grupos.map(g => `<option value="${esc(g)}" ${F.g===g?"selected":""}>${esc(g)}</option>`).join("")}</select></label>
          <label class="hint">Práctica<select id="estp"><option value="">Todas</option>${P.map(p => `<option value="${p.id}" ${F.p===p.id?"selected":""}>${esc(pracLabel(p,true))}</option>`).join("")}</select></label>
          <label class="hint">Sede<select id="estse"><option value="">Todas</option>${sedes.map(s => `<option value="${esc(s)}" ${F.sede===s?"selected":""}>${esc(s)}</option>`).join("")}</select></label>
          <label class="hint">Turno<select id="estt"><option value="">Ambos</option><option value="1" ${F.t==="1"?"selected":""}>1/er.</option><option value="2" ${F.t==="2"?"selected":""}>2/o.</option></select></label>
          <label class="hint">Materia<select id="estmk"><option value="">Todas</option>${Object.keys(MK).map(k => `<option value="${k}" ${F.mk===k?"selected":""}>${esc(MK[k])}</option>`).join("")}</select></label>
          <label class="hint">Tipo de novedad<select id="esttipo"><option value="">Todos</option>${(typeof TIPOS!=="undefined"?TIPOS:[]).map(t => `<option value="${t[0]}" ${F.tipo===t[0]?"selected":""}>${t[1]}</option>`).join("")}</select></label>
          <label class="hint">Motivo<select id="estmot"><option value="">Todos</option>${(typeof MOT_ALL!=="undefined"?MOT_ALL:[]).map(m => `<option value="${m[0]}" ${F.mot===m[0]?"selected":""}>${m[1]}</option>`).join("")}</select></label>
          <label class="hint">Desde<input type="date" id="estdd" value="${F.desde||""}"></label>
          <label class="hint">Hasta<input type="date" id="estdh" value="${F.hasta||""}"></label>
          <label class="hint">Semana<select id="estsem"><option value="">Todas</option>${[...new Set(evs().map(e=>e.f&&typeof monday==="function"?monday(e.f):"").filter(Boolean))].sort().map(L=>{const H=addD(L,6);const sel=F.desde===L&&F.hasta===H?"selected":"";return `<option value="${L}/${H}" ${sel}>${typeof fCorta==="function"?fCorta(L):L} – ${typeof fCorta==="function"?fCorta(H):H}</option>`}).join("")}</select></label>
          <label class="hint">Cadete (nombre o matrícula)<input class="inp" id="estcad" list="estcadDL" placeholder="Escribe para buscar" value="${F.cid&&S.cad.get(F.cid)?((S.cad.get(F.cid).n||'')+' '+(S.cad.get(F.cid).mat||'')):""}"></label>
        </div>
        <datalist id="estcadDL">${cads().sort(cmpCad).map(c => `<option value="${esc(c.n)} ${esc(c.mat||"")}" data-id="${c.id}"></option>`).join("")}</datalist>
        <div class="acts" style="justify-content:flex-start;margin-top:12px">
          <button class="btn" type="button" id="estGo">Consultar</button>
          <button class="btn ghost" type="button" id="estClr">Limpiar filtros</button>
          <button class="btn" type="button" id="estXl">Descargar estadística .xlsx</button>
        </div>
      </section>
      <p class="hint" style="margin:8px 0 12px">Filtro activo: <b style="color:var(--ink)">${esc(filtroTxt())}</b></p>
      <div class="tally t-est">
        <div><b>${st.C.length}</b><span>Cadetes en el recorte</span></div>
        <div><b>${st.E.length}</b><span>Novedades (registros)</span></div>
        <div class="t-bad"><b>${st.totF}</b><span>Días de inasistencia</span></div>
        <div class="t-just"><b>${st.fj}</b><span>Justificadas</span></div>
        <div class="t-warn"><b>${st.fi}</b><span>Injustificadas</span></div>
        <div><b>${st.totH}</b><span>Horas de inasistencia</span></div>
        <div><b>${st.ret}</b><span>Retardos</span></div>
        <div><b>${st.anN}</b><span>Anecdotario negativo</span></div>
        <div><b>${st.arr}</b><span>Arrestos (${st.hrs} h)</span></div>
        <div class="t-bad"><b>${st.enRiesgo.length}</b><span>En riesgo (${Math.round((typeof RPCT==="function"?RPCT():0.3)*100)} % o más)</span></div>
        <div class="t-warn"><b>${st.cerca.length}</b><span>Cerca del límite</span></div>
      </div>
      <div class="two" style="align-items:start">
        ${tableBlock("Por motivo de inasistencia", st.porMot)}
        ${tableBlock("Por tipo de novedad", st.porTipo)}
      </div>
      <div class="two" style="align-items:start">
        ${tableBlock("Por sede", st.porSede)}
        ${tableBlock("Por práctica", st.porPrac)}
      </div>
      <div class="two" style="align-items:start">
        ${tableBlock("Por año", st.porAnio)}
        ${tableBlock("Por grupo", st.porGrupo)}
      </div>
      ${tableBlock("Tendencia por mes", st.porMes)}
      ${tableBlock("Tendencia por semana (lunes a domingo)", st.porSem)}
      <section class="box"><h3>Cadetes más cercanos al ${Math.round((typeof RPCT==="function"?RPCT():0.3)*100)} % de inasistencias</h3>
        ${st.ranking.length?`<div class="tl">${st.ranking.slice(0,25).map(x=>`<div class="it" style="grid-template-columns:1fr auto"><span><button class="nameb" data-c="${x.id}">${esc(x.c.n)}</button><span class="sub">${esc((ANIO[x.c.a]||"")+" · Grupo "+(x.c.g||"")+(x.c.mat?" · "+x.c.mat:""))}${x.r?` · ${pctTxt(x.r)}`:""}</span></span><span class="badge ${x.niv==="riesgo"?"b-bad":x.niv==="cerca"?"b-warn":"b-ok"}">${x.n} día${x.n===1?"":"s"} · ${x.h} h</span></div>`).join("")}</div>`:`<p class="hint">Nadie con inasistencias en este recorte.</p>`}
      </section>`;
    bindEst();
  }

  function readForm() {
    const E = estState();
    const val = id => { const el = document.getElementById(id); return el ? el.value : ""; };
    E.q = val("estq");
    E.a = val("esta"); E.g = val("estg"); E.p = val("estp"); E.sede = val("estse");
    E.t = val("estt"); E.mk = val("estmk"); E.tipo = val("esttipo"); E.mot = val("estmot");
    E.desde = val("estdd"); E.hasta = val("estdh");
    const cad = val("estcad").trim();
    if (!cad) E.cid = "";
    else {
      const n = norm(cad);
      const found = cads().find(c => n.includes(norm(c.n)) || (c.mat && n.includes(norm(c.mat).replace(/-/g, ""))));
      E.cid = found ? found.id : E.cid;
    }
  }

  function bindEst() {
    const go = () => { readForm(); render(); };
    const $id = id => document.getElementById(id);
    if ($id("estGo")) $id("estGo").onclick = go;
    ["esta", "estg", "estp", "estse", "estt", "estmk", "esttipo", "estmot", "estdd", "estdh"].forEach(id => {
      const el = $id(id); if (el) el.onchange = go;
    });
    if ($id("estsem")) $id("estsem").onchange = () => {
      const v = $id("estsem").value;
      if (v && v.includes("/")) {
        const a = v.split("/");
        if ($id("estdd")) $id("estdd").value = a[0];
        if ($id("estdh")) $id("estdh").value = a[1];
      }
      go();
    };
    if ($id("estq")) $id("estq").onkeydown = e => { if (e.key === "Enter") { e.preventDefault(); $id("estInterp").click(); } };
    if ($id("estInterp")) $id("estInterp").onclick = () => {
      readForm();
      applyPedido();
      render();
    };
    if ($id("estClr")) $id("estClr").onclick = () => {
      S.est = { q: "", a: "", g: "", p: "", sede: "", t: "", mk: "", mot: "", tipo: "", cid: "", desde: "", hasta: "", mes: "", interp: "" };
      render();
    };
    if ($id("estXl")) $id("estXl").onclick = () => exportEst().catch(e => { console.error(e); toast("No se pudo generar el Excel."); });
    VW.querySelectorAll("[data-c]").forEach(b => b.onclick = () => ficha(b.dataset.c));
  }

  function aoaSheet(X, name, rows, widths, merges) {
    const ws = X.utils.aoa_to_sheet(rows);
    if (widths) ws["!cols"] = widths.map(w => ({ wch: w }));
    if (merges && merges.length) ws["!merges"] = merges;
    if (global.ReplicaPC && ReplicaPC.styleSheet) ReplicaPC.styleSheet(ws);
    return { name: name.slice(0, 31), ws };
  }

  async function exportEst() {
    const btn = document.getElementById("estXl");
    if (btn) { btn.disabled = true; btn.textContent = "Preparando…"; }
    try {
      const X = await loadXLSX();
      const st = compute();
      const wb = X.utils.book_new();
      const titulo = "Estadística de práctica clínica";
      const filtro = filtroTxt();
      const cuando = (typeof fLarga === "function" ? fLarga(today()) : today());
      const resumen = [
        [titulo],
        ["Esc. Mil. Enfría. · Subsección de Práctica Clínica"],
        ["Filtro", filtro],
        ["Fecha de emisión", cuando],
        [],
        ["Indicador", "Valor"],
        ["Cadetes en el recorte", st.C.length],
        ["Novedades (registros)", st.E.length],
        ["Días de inasistencia", st.totF],
        ["Justificadas", st.fj],
        ["Injustificadas", st.fi],
        ["Horas de inasistencia", st.totH],
        ["Retardos", st.ret],
        ["Anecdotario positivo", st.anP],
        ["Anecdotario negativo", st.anN],
        ["Arrestos", st.arr],
        ["Horas de arresto", st.hrs],
        ["En riesgo (" + Math.round((typeof RPCT === "function" ? RPCT() : 0.3) * 100) + " % o más)", st.enRiesgo.length],
        ["Cerca del límite", st.cerca.length]
      ];
      const add = (nm, rows, w, merges) => {
        const s = aoaSheet(X, nm, rows, w, merges);
        X.utils.book_append_sheet(wb, s.ws, s.name);
      };
      add("Resumen", resumen, [44, 70], [{ s: { r: 0, c: 0 }, e: { r: 0, c: 1 } }, { s: { r: 1, c: 0 }, e: { r: 1, c: 1 } }]);
      const brk = (title, rows) => {
        const tot = rows.reduce((s, r) => s + r.n, 0) || 1;
        const aoa = [[title], ["Categoría", "Cantidad", "Porcentaje"], ...rows.map(r => [r.k, r.n, Math.round(r.n / tot * 1000) / 10]), ["Total", tot, 100]];
        return aoa;
      };
      const bw = [44, 12, 12];
      add("Por motivo", brk("Inasistencias por motivo", st.porMot), bw, [{ s: { r: 0, c: 0 }, e: { r: 0, c: 2 } }]);
      add("Por tipo", brk("Novedades por tipo", st.porTipo), bw, [{ s: { r: 0, c: 0 }, e: { r: 0, c: 2 } }]);
      add("Por sede", brk("Novedades por sede", st.porSede), bw, [{ s: { r: 0, c: 0 }, e: { r: 0, c: 2 } }]);
      add("Por práctica", brk("Novedades por práctica", st.porPrac), bw, [{ s: { r: 0, c: 0 }, e: { r: 0, c: 2 } }]);
      add("Por año", brk("Inasistencias por año", st.porAnio), bw, [{ s: { r: 0, c: 0 }, e: { r: 0, c: 2 } }]);
      add("Por grupo", brk("Inasistencias por grupo", st.porGrupo), bw, [{ s: { r: 0, c: 0 }, e: { r: 0, c: 2 } }]);
      add("Por mes", brk("Novedades por mes", st.porMes), bw, [{ s: { r: 0, c: 0 }, e: { r: 0, c: 2 } }]);
      add("Por semana", brk("Novedades por semana", st.porSem), bw, [{ s: { r: 0, c: 0 }, e: { r: 0, c: 2 } }]);
      const rk = [["Cadetes y cercanía al " + Math.round((typeof RPCT === "function" ? RPCT() : 0.3) * 100) + " %"], ["Nombre", "Matrícula", "Año", "Grupo", "Días", "Horas", "% inasistencia", "Horas programadas", "Situación"]];
      st.ranking.forEach(x => {
        rk.push([x.c.n, x.c.mat || "", ANIO[x.c.a] || x.c.a || "", x.c.g || "", x.n, x.h, x.r ? Math.round(x.r.pct * 1000) / 10 : "", x.r ? x.r.tot : "", x.niv === "riesgo" ? "En riesgo" : x.niv === "cerca" ? "Cerca del límite" : ""]);
      });
      add("Cercanía al 30%", rk, [36, 14, 8, 8, 8, 8, 14, 16, 16], [{ s: { r: 0, c: 0 }, e: { r: 0, c: 8 } }]);
      const det = [["Detalle de novedades"], ["Nombre", "Matrícula", "Año", "Grupo", "Fecha", "Tipo", "Motivo", "Días", "J/I", "Reposición", "Práctica", "Sede", "Turno", "Observaciones"]];
      const merges = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 13 } }];
      const sorted = st.E.slice().sort((a, b) => {
        const ca = S.cad.get(a.c) || {}, cb = S.cad.get(b.c) || {};
        return (ca.n || "").localeCompare(cb.n || "", "es") || (a.f || "").localeCompare(b.f || "");
      });
      let i = 2, runStart = 2, lastId = null;
      sorted.forEach((e, idx) => {
        const c = S.cad.get(e.c) || {};
        const p = S.prac.get(e.p) || {};
        det.push([
          c.n || "", c.mat || "", ANIO[c.a] || c.a || "", c.g || "", e.f || "",
          (TIPO_TXT && TIPO_TXT[e.t]) || e.t || "",
          e.t === "falta" ? ((MOT_TXT && MOT_TXT[e.m]) || e.m || "") : "",
          e.t === "falta" ? (typeof cnt === "function" ? cnt(e) : 1) : "",
          e.t === "falta" ? (e.j ? "J" : "I") : "",
          e.t === "falta" ? ((REP_TXT && REP_TXT[e.rep || "pendiente"]) || "") : "",
          p.materia || "", p.sede || "", p.turno === "2" ? "2/o." : (p.turno ? "1/er." : ""),
          e.x || e.por || ""
        ]);
        if (lastId != null && e.c !== lastId && idx > 0) {
          if (i - 1 > runStart) {
            merges.push({ s: { r: runStart, c: 0 }, e: { r: i - 1, c: 0 } });
            merges.push({ s: { r: runStart, c: 1 }, e: { r: i - 1, c: 1 } });
          }
          runStart = i + 0;
        }
        if (lastId !== e.c) runStart = i;
        lastId = e.c;
        i++;
      });
      if (sorted.length && i - 1 > runStart) {
        merges.push({ s: { r: runStart, c: 0 }, e: { r: i - 1, c: 0 } });
        merges.push({ s: { r: runStart, c: 1 }, e: { r: i - 1, c: 1 } });
      }
      add("Detalle", det, [36, 14, 8, 8, 12, 16, 22, 6, 6, 18, 32, 16, 8, 40], merges);
      const out = X.write(wb, { bookType: "xlsx", type: "array" });
      const DL = await window.claude.use("downloads");
      const name = "ESTADISTICA PRACTICA CLINICA " + today() + ".xlsx";
      await DL.save({ filename: name, data: new Blob([out], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }) });
      toast("Estadística lista");
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = "Descargar estadística .xlsx"; }
    }
  }

  global.vEst = vEst;
  global.ReplicaEst = { parsePedido, compute, exportEst, filtroTxt, applyPedido };
})(window);
