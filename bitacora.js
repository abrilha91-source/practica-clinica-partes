/* Lector de bitácoras de inasistencias y asignación de práctica (v1.2).
   Reglas para elegir la práctica de cada novedad:
   (a) materia o sede escrita en la bitácora (encabezado o renglón);
      cada práctica tiene rotación en más de un hospital: se registra en la
      rotación del hospital que indica la bitácora, aunque la lista oficial
      del cadete tenga la otra sede;
   (b) instructora o docente a cargo, cruzada con las prácticas del cadete;
   (c) si sigue habiendo más de una o ninguna, queda «Por asignar» y decide la usuaria.
   La fecha solo desempata entre candidatas de (a) o (b); nunca elige sola. */
(function (G) {
  "use strict";

  const norm = s => String(s == null ? "" : s).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const pad = n => String(n).padStart(2, "0");
  const iso = (y, m, d) => `${y}-${pad(m)}-${pad(d)}`;
  const validDate = (y, m, d) => { const t = new Date(y, m - 1, d); return t.getFullYear() === y && t.getMonth() === m - 1 && t.getDate() === d; };
  const addDays = (s, n) => { const [y, m, d] = s.split("-").map(Number); const t = new Date(y, m - 1, d + n); return iso(t.getFullYear(), t.getMonth() + 1, t.getDate()); };
  const dowOf = s => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d).getDay(); };

  const MESES = { ene: 1, enero: 1, jan: 1, feb: 2, febrero: 2, mar: 3, marzo: 3, abr: 4, abril: 4, apr: 4, may: 5, mayo: 5, jun: 6, junio: 6, jul: 7, julio: 7,
    ago: 8, agosto: 8, aug: 8, sep: 9, sept: 9, set: 9, septiembre: 9, setiembre: 9, oct: 10, octubre: 10, nov: 11, noviembre: 11, dic: 12, diciembre: 12, dec: 12 };
  const DIAS_SEM = { domingo: 0, lunes: 1, martes: 2, miercoles: 3, jueves: 4, viernes: 5, sabado: 6 };

  /* ---------- materia, sede, turno ---------- */
  function mksOf(text) {
    const s = norm(text);
    const out = [];
    if (/psiqui/.test(s)) out.push("psiq");
    if (/salud\s*publica|\bs\.?\s*p\.?\s*(l\.?e\.?m)?\b(?=.*(salud|centro))|centro de salud|\bc\.?\s*s\.?\s*t\.?\s*(iii)?\b/.test(s)) out.push("sp");
    if (/fundamentos/.test(s)) out.push("fund");
    if (/t\.\s*s\.\s*u|\btsu\b|curso intensivo/.test(s)) out.push("tsu");
    else if (/medico\s*-?\s*quirurg|\bm\.?\s*q\.?\b(?=\s|$)/.test(s)) out.push("mq");
    else if (/quirurg/.test(s)) out.push("quir");
    return out;
  }
  const SEDES = [
    ["HCM", /hospital central militar|\bh\.?\s*c\.?\s*m\b|\bcentral militar\b/],
    ["HMEMYN", /hospital(?:\s+de\s+la)?\s+mujer|mujer\s*y\s*neonat|neonatolog|\bh\.?\s*m\.?\s*e\.?\s*m|\bhmem/],
    ["UEM", /unidad de especialidades|\bu\.?\s*e\.?\s*m\b/],
    ["LCA", /cardiel/],
    ["MEX", /mexico\s*-?\s*espana/],
    ["VAS", /vasconcelos|brioso/],
    ["MGR", /gonzalez\s+rivera|manuel gonzalez/],
    ["FBA", /fray bernardino|bernardino/],
    ["INP", /instituto nacional de psiquiatr|\binp\b/],
    ["JNN", /juan n\.?\s*navarro|navarro/],
    ["NAVAL", /naval/]
  ];
  function sedeKey(text) {
    const s = norm(text);
    if (!s.trim()) return "";
    for (const [k, re] of SEDES) if (re.test(s)) return k;
    return "";
  }
  function turnoOf(text) {
    const s = norm(text);
    if (/(2|segundo|2\/?o\.?|2do|2º|2°)\s*\.?\s*turno|vespertin/.test(s)) return "2";
    if (/(1|primer|primero|1\/?er\.?|1ro|1º|1°)\s*\.?\s*turno|matutin/.test(s)) return "1";
    return "";
  }

  /* ---------- personas (cadetes e instructoras) ---------- */
  const STOP = new Set(["cad", "cadete", "cadeta", "de", "del", "la", "las", "los", "y", "el", "en", "por", "al", "sdo", "sold", "dicente", "discente", "the"]);
  const RANGOS = /\b(gral|gral\.|cor|tte|tte\.|cap|myr|mayor|capitan|teniente|coronel|sbtte|subteniente|enfra|enf|enfermera|ret|retirada|lic|licenciada|l\.?\s*e\.?\s*o|leo|mtra|maestra|dra|doctora|profa|profesora|instructora|instructor|docente|c\.?|1\/?o|2\/?o|1o|2o|1er|2do|a cargo)\b\.?/g;
  const ABBR = { hdz: "hernandez", hdez: "hernandez", hernz: "hernandez", glz: "gonzalez", gzz: "gonzalez", gonz: "gonzalez", mtz: "martinez", mtnz: "martinez", rdz: "rodriguez", rguez: "rodriguez", rodz: "rodriguez", fdz: "fernandez", fdez: "fernandez", fndz: "fernandez", gtz: "gutierrez", glez: "gonzalez", ramz: "ramirez", rmz: "ramirez", sanz: "sanchez", sz: "sanchez", lpz: "lopez", pz: "perez", jmz: "jimenez", dguez: "dominguez", dmz: "dominguez", vzq: "vazquez", vqz: "vazquez" };
  function nameTokens(s) {
    return norm(s).replace(/[^a-z\s.]/g, " ").replace(/\./g, " ").split(/\s+/).filter(w => w && !STOP.has(w)).map(w => ABBR[w] || w);
  }
  function lev(a, b, max) {
    if (Math.abs(a.length - b.length) > max) return max + 1;
    const prev = new Array(b.length + 1);
    for (let j = 0; j <= b.length; j++) prev[j] = j;
    for (let i = 1; i <= a.length; i++) {
      let cur = [i], best = i;
      for (let j = 1; j <= b.length; j++) {
        cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
        if (cur[j] < best) best = cur[j];
      }
      if (best > max) return max + 1;
      for (let j = 0; j <= b.length; j++) prev[j] = cur[j];
    }
    return prev[b.length];
  }
  /* cuánto se parece una palabra escrita (q) a una palabra del nombre oficial (t): 1, 0.5 (inicial) o 0 */
  function tokSim(q, t) {
    if (q === t) return 1;
    if (q.length === 1) return t[0] === q ? 0.5 : 0;
    if (q.length >= 3 && t.length >= 4 && (t.startsWith(q) && q.length >= 4)) return 1;
    const max = t.length >= 8 ? 2 : t.length >= 4 ? 1 : 0;
    if (max && q.length >= 3 && lev(q, t, max) <= max) return 1;
    return 0;
  }
  /* parecido de un texto con un nombre oficial: palabras del nombre encontradas en el texto */
  function nameScore(qToks, official) {
    const T = nameTokens(official).filter(w => w.length > 1);
    if (!T.length) return { hit: 0, cov: 0, n: 0 };
    const used = new Set();
    let hit = 0, full = 0;
    for (const t of T) {
      let best = 0, bi = -1;
      qToks.forEach((q, i) => { if (used.has(i)) return; const s = tokSim(q, t); if (s > best) { best = s; bi = i; } });
      if (bi >= 0 && best > 0) { used.add(bi); hit += best; if (best === 1) full++; }
    }
    return { hit, full, cov: hit / T.length, n: T.length };
  }

  function makeIndex(cadetes) {
    const list = (cadetes || []).filter(c => c && c.n).map(c => ({ c, toks: nameTokens(c.n) }));
    const byMat = new Map();
    list.forEach(x => { if (x.c.mat) byMat.set(norm(x.c.mat).replace(/[^a-z0-9]/g, ""), x.c); });
    return { list, byMat };
  }
  /* busca cadete en un texto; devuelve {c, score, dudosos} */
  function findCadet(text, idx, pool) {
    const s = String(text || "");
    const mm = s.match(/\b([ADCadc])\s*-?\s*(\d{6,9})\b/);
    if (mm) { const c = idx.byMat.get(norm(mm[1] + mm[2])); if (c) return { c, score: 1, via: "matrícula" }; }
    const q = nameTokens(s).filter(w => w.length > 1 || /^[a-z]$/.test(w));
    if (q.length < 2) return null;
    const L = pool ? idx.list.filter(x => pool.has(x.c.id)) : idx.list;
    let best = null, second = null;
    for (const x of L) {
      const r = nameScore(q, x.c.n);
      const ok = r.full >= 2 && (r.cov >= 0.6 || r.full >= 3);
      if (!ok) continue;
      const sc = r.cov + r.full * 0.01;
      if (!best || sc > best.sc) { second = best; best = { c: x.c, sc, r }; }
      else if (!second || sc > second.sc) second = { c: x.c, sc, r };
    }
    if (!best) return null;
    if (second && Math.abs(second.sc - best.sc) < 0.05) return { c: null, dudosos: [best.c, second.c], score: best.sc };
    return { c: best.c, score: best.sc, via: "nombre" };
  }

  function instrList(p) {
    const L = (p.instructoras && p.instructoras.length ? p.instructoras : []).concat(p.docente ? [p.docente] : []);
    return [...new Set(L.filter(Boolean))];
  }
  /* prácticas cuya instructora o docente se parece al nombre escrito */
  function practicasDeInstructora(texto, practicas) {
    const q = nameTokens(String(texto || "").replace(RANGOS, " ")).filter(w => w.length > 1);
    if (q.length < 1) return { ids: [], score: 0 };
    /* palabras que solo tiene una instructora (para lecturas parciales, p. ej. OCR que solo leyó «Belem») */
    const freq = new Map();
    const people = new Set();
    practicas.forEach(p => instrList(p).forEach(nm => people.add(nameTokens(String(nm).replace(RANGOS, " ")).join(" "))));
    people.forEach(k => new Set(k.split(" ")).forEach(w => freq.set(w, (freq.get(w) || 0) + 1)));
    let top = 0, ids = [];
    for (const p of practicas) {
      let best = 0;
      for (const nm of instrList(p)) {
        const T = nameTokens(String(nm).replace(RANGOS, " "));
        const r = nameScore(q, String(nm).replace(RANGOS, " "));
        let sc = r.full >= 2 ? r.hit : 0;
        if (!sc && r.full === 1) {
          const uniq = T.some(t => t.length >= 5 && freq.get(t) === 1 && q.includes(t));
          if (uniq) sc = 0.9;
        }
        if (sc > best) best = sc;
      }
      if (best <= 0) continue;
      if (best > top + 0.01) { top = best; ids = [p.id]; }
      else if (Math.abs(best - top) <= 0.01) ids.push(p.id);
    }
    return { ids, score: top };
  }

  /* ---------- fechas ---------- */
  function yearFor(m, ctx) {
    const base = ctx && ctx.semana ? ctx.semana : null;
    if (base) {
      const by = +base.slice(0, 4), bm = +base.slice(5, 7);
      if (bm >= 11 && m <= 2) return by + 1;
      if (bm <= 2 && m >= 11) return by - 1;
      return by;
    }
    return (ctx && ctx.year) || new Date().getFullYear();
  }
  function near(d, ctx) {
    if (!ctx || !ctx.semana) return true;
    const a = addDays(ctx.semana, -10), b = addDays(ctx.semana, 16);
    return d >= a && d <= b;
  }
  function parseFecha(raw, ctx) {
    const s0 = String(raw == null ? "" : raw).trim();
    if (!s0) return "";
    const s = norm(s0);
    let m = s.match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (m && validDate(+m[1], +m[2], +m[3])) return iso(+m[1], +m[2], +m[3]);
    m = s.match(/\b(\d{1,2})\s*[\/\-.]\s*(\d{1,2})\s*[\/\-.]\s*(\d{2,4})\b/);
    if (m) {
      let d = +m[1], mo = +m[2], y = +m[3];
      if (y < 100) y += 2000;
      if (mo > 12 && d <= 12) { const t = d; d = mo; mo = t; }
      if (validDate(y, mo, d)) return iso(y, mo, d);
    }
    m = s.match(/\b(\d{1,2})\s*(?:de\s*|[\-\/.\s])\s*([a-z]{3,10})\.?(?:\s*(?:de|del|[\-\/.,])?\s*(\d{2,4}))?/);
    if (m && MESES[m[2]] != null) {
      const mo = MESES[m[2]]; let y = m[3] ? +m[3] : yearFor(mo, ctx); if (y < 100) y += 2000;
      if (validDate(y, mo, +m[1])) return iso(y, mo, +m[1]);
    }
    m = s.match(/\b([a-z]{3,10})\.?\s+(\d{1,2})(?:\s*,?\s*(\d{4}))?\b/);
    if (m && MESES[m[1]] != null) {
      const mo = MESES[m[1]]; const y = m[3] ? +m[3] : yearFor(mo, ctx);
      if (validDate(y, mo, +m[2])) return iso(y, mo, +m[2]);
    }
    m = s.match(/^(\d{1,2})\s*[\/\-.]\s*(\d{1,2})$/);
    if (m) {
      /* «22/10» (día/mes) o «22 / 1» (fecha / día de práctica) */
      const d = +m[1], mo = +m[2];
      const y = yearFor(mo, ctx);
      if (mo >= 1 && mo <= 12 && validDate(y, mo, d) && (mo >= 8 || mo <= 2) && near(iso(y, mo, d), ctx)) return iso(y, mo, d);
      const byDay = dayInWeek(d, ctx);
      if (byDay) return byDay;
    }
    m = s.match(/\b(domingo|lunes|martes|miercoles|jueves|viernes|sabado)\b(?:\s*(\d{1,2}))?/);
    if (m && ctx && ctx.semana) {
      if (m[2]) { const r = dayInWeek(+m[2], ctx); if (r) return r; }
      const w = DIAS_SEM[m[1]]; const off = w === 0 ? 6 : w - 1; return addDays(ctx.semana, off);
    }
    m = s.match(/^(\d{1,2})\s*[a-z]{0,3}\.?$/);
    if (m) { const r = dayInWeek(+m[1], ctx); if (r) return r; }
    return "";
  }
  function dayInWeek(d, ctx) {
    if (!ctx || !ctx.semana || !(d >= 1 && d <= 31)) return "";
    for (let i = -3; i <= 9; i++) { const x = addDays(ctx.semana, i); if (+x.slice(8, 10) === d) return x; }
    return "";
  }

  /* ---------- motivo y tipo ---------- */
  function motivoOf(text) {
    const s = norm(text);
    if (!s.trim()) return "";
    if (/injustific|sin justific|sin motivo|no justific/.test(s)) return "injust";
    if (/except|exept|excep|\bexc\b/.test(s)) return "exceptuacion";
    if (/encamad|peloton de sanidad|\bpelot|sanidad|enfermeria de la (eme|escuela)|incapacidad/.test(s)) return "encamado";
    if (/comisi|comis[ft]|cemis|comsi|comrs|comioto|\bemi\b|escolta|banda|deport|evento|desfile|colegio mil|ceremonia|honores|futbol|atletismo|natacion/.test(s)) return "comision";
    if (/\bcita|consulta|laboratorio|estudios|\brx\b|odontolog|dental|medic[ao] (general|especialista)|valoracion/.test(s)) return "cita";
    if (/servicio|\bsv\b|\bs\.v\.|guardia|imaginaria|corneta|cuartel|cuarto de guardia|ranchero|cocina|plant[oó]n/.test(s)) return "servicio";
    if (/permiso/.test(s)) return "permiso";
    if (/arresto/.test(s)) return "arresto";
    return "";
  }
  function tipoOf(text) {
    const s = norm(text);
    if (/retardo|llego tarde|llego a las|se presento tarde/.test(s)) return "retardo";
    if (/anecdot|felicita|llamada de atencion|amonestaci/.test(s)) return "anecdota";
    if (/arrestad|arresto de \d|horas de arresto/.test(s)) return "arresto";
    return "falta";
  }
  const GRUPO_RE = /todo el grupo|toda la (clase|seccion)|\b\d{1,3}\s*(discentes|cadetes|alumn[ao]s)\b|grupo completo|ningun cadete|no (acud|asist)[a-z]* (el|todo)/;

  /* ---------- encabezados y tablas ---------- */
  const LABELS = [
    ["materia", /\b(materia|asignatura|practica clinica de|practica de)\s*[:.]/],
    ["sede", /\b(sede\s*\/\s*campo clinico|sede|campo clinico|hospital|unidad|lugar)\s*[:.]/],
    ["docente", /\b(docente a cargo|docente que reporta|docente|instructor[a]? clinic[ao]|instructor[a]?|profesor[a]?|jefa de (la )?practica)\s*[:.]/],
    ["semana", /\b(semana del|semana)\s*[:.]?/],
    ["al", /\bal\s*[:.]/],
    ["turno", /\bturno\s*[:.]/],
    ["entregado", /\bentregado el\s*[:.]?/]
  ];
  function scanLabels(line) {
    const s = norm(line);
    const hits = [];
    for (const [k, re] of LABELS) {
      const g = new RegExp(re.source, "g");
      let m;
      while ((m = g.exec(s))) hits.push({ k, i: m.index, end: m.index + m[0].length });
    }
    hits.sort((a, b) => a.i - b.i);
    const clean = [];
    hits.forEach(h => { if (!clean.length || h.i >= clean[clean.length - 1].end) clean.push(h); });
    const out = {};
    clean.forEach((h, j) => {
      const stop = j + 1 < clean.length ? clean[j + 1].i : line.length;
      const v = line.slice(h.end, stop).replace(/^[\s:.\-_|\t]+|[\s|_\t]+$/g, "").replace(/\.$/, "").trim();
      if (v && !(h.k in out)) out[h.k] = v;
    });
    return out;
  }

  const COLDEF = [
    ["fecha", /^(fecha|fecha\s*\/\s*dia|dia|fechas?)\b/],
    ["nombre", /(nombre|cadete|discente|alumn)/],
    ["mat", /matricula/],
    ["materia", /materia|asignatura|^practica|practica clinica/],
    ["anio", /^(ano|anio)\b/],
    ["grupo", /grupo|turno/],
    ["sede", /sede|hospital|campo clinico|unidad/],
    ["servicio", /servicio|rotacion|area|observ/],
    ["motivo", /motivo/],
    ["instr", /instructor|docente|profesor|responsable/],
    ["dias", /^dias?$|^no\.? de dias|^dias de/],
    ["horas", /horas?|hrs/],
    ["tipo", /^tipo/],
    ["no", /^no\.?$|^num/]
  ];
  function headerMap(cells) {
    const H = cells.map(c => norm(c).trim());
    const hasFecha = H.some(h => /fecha/.test(h));
    const hasNom = H.some(h => /nombre|cadete|discente/.test(h));
    if (!hasFecha || !hasNom) return null;
    const map = {};
    H.forEach((h, i) => {
      if (!h) return;
      if (/motivo escrito/.test(h)) { if (map.motivo2 == null) map.motivo2 = i; return; }
      for (const [k, re] of COLDEF) {
        if (re.test(h) && map[k] == null) {
          if (k === "nombre" && /fecha/.test(h)) continue;
          if (k === "grupo" && /anio|ano/.test(h)) continue;
          map[k] = i; break;
        }
      }
    });
    if (map.fecha == null || map.nombre == null) return null;
    return map;
  }
  function splitCells(line) {
    if (line.includes("\t")) return line.split("\t").map(s => s.trim());
    if (/\s\|\s/.test(line)) return line.split(/\s\|\s?/).map(s => s.trim());
    if ((line.match(/;/g) || []).length >= 2) return line.split(";").map(s => s.trim());
    if ((line.match(/,/g) || []).length >= 3 && !/\s{2,}/.test(line)) return csvSplit(line);
    if (/\S\s{3,}\S/.test(line)) return line.split(/\s{3,}/).map(s => s.trim());
    return null;
  }
  function csvSplit(line) {
    const out = []; let cur = "", q = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (q) { if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; } else if (ch === '"') q = false; else cur += ch; }
      else if (ch === '"') q = true; else if (ch === ",") { out.push(cur.trim()); cur = ""; } else cur += ch;
    }
    out.push(cur.trim());
    return out;
  }

  function sections(text) {
    const lines = String(text || "").replace(/\r/g, "").split("\n");
    const out = []; let cur = { titulo: "", lines: [] };
    const push = () => { if (cur.lines.length) out.push(cur); };
    for (const L of lines) {
      const t = L.trim();
      const isFile = /^##\s+(?!hoja)/i.test(t);
      const isPage = /^---\s*(p[aá]gina|diapositiva)\s+\d+/i.test(t) || /^##\s*hoja\s*:/i.test(t);
      if (isFile || isPage) { push(); cur = { titulo: t.replace(/^#+\s*|^-+\s*|\s*-+$/g, ""), lines: [], file: isFile ? t : (cur.file || "") }; continue; }
      cur.lines.push(L);
    }
    push();
    return out;
  }

  /* ---------- lectura principal ---------- */
  function parse(text, ctx) {
    ctx = ctx || {};
    const idx = makeIndex(ctx.cadetes || []);
    const practicas = ctx.practicas || [];
    const notas = [];
    const eventos = [];
    const encabezados = [];
    const seen = new Set();
    for (const sec of sections(text)) {
      const hdr = { materia: "", sede: "", docente: "", turno: "", semana: "", al: "" };
      let map = null, prevFecha = "", prevMot = "", rows = 0;
      let block = null;
      const flushBlock = () => {
        if (block && (block.nombre || block.cadete)) addRow({ nombre: block.nombre || block.cadete, fecha: block.fecha, motivo: block.motivo, tipo: block.tipo, dias: block.dias, servicio: block.servicio, materia: block.materia, sede: block.sede, instr: block.instructora || block.docente }, block.nombre || block.cadete);
        block = null;
      };
      const localCtx = () => ({ semana: ctx.semana || (hdr.semanaIso ? mondayOf(hdr.semanaIso) : ""), year: ctx.year });
      function addRow(r, rawLine) {
        const lc = localCtx();
        let fecha = parseFecha(r.fecha, lc);
        if (!fecha && !String(r.fecha || "").trim()) fecha = prevFecha;
        if (fecha) prevFecha = fecha;
        let mot = motivoOf(r.motivo || "");
        if (!mot && r.motivo2) mot = motivoOf(r.motivo2);
        if (!mot && !String(r.motivo || "").trim() && map) mot = prevMot;
        if (mot) prevMot = mot;
        const tipo = r.tipo ? tipoOf(r.tipo) : tipoOf([r.motivo, r.servicio].join(" "));
        const nombreRaw = String(r.nombre || "").trim();
        const hit = findCadet(r.mat ? `${r.mat} ${nombreRaw}` : nombreRaw, idx, null);
        if (!hit && GRUPO_RE.test(norm(rawLine || nombreRaw))) {
          notas.push(`Renglón para varios cadetes sin nombre (${sec.titulo || "texto"}): «${String(rawLine || nombreRaw).replace(/\s+/g, " ").trim().slice(0, 140)}». No se registró por cadete; captúralo en Parte del día o pide la lista.`);
          return;
        }
        if (!nombreRaw && !hit) return;
        const ev = {
          nombre: hit && hit.c ? hit.c.n : nombreRaw,
          leido: nombreRaw,
          cid: hit && hit.c ? hit.c.id : "",
          dudosos: hit && hit.dudosos ? hit.dudosos.map(c => c.id) : [],
          fecha, dias: parseInt(r.dias, 10) > 0 ? parseInt(r.dias, 10) : 1,
          tipo, motivo: tipo === "falta" ? (mot || "") : "", justificada: mot !== "injust",
          polaridad: tipo === "anecdota" ? (/felicit|positiv/.test(norm(r.motivo + " " + r.servicio)) ? "pos" : "neg") : "",
          horas: r.horas != null && String(r.horas).trim() !== "" && !isNaN(parseFloat(r.horas)) ? parseFloat(r.horas) : null,
          servicio: String(r.servicio || "").trim(),
          materia: String(r.materia || hdr.materia || "").trim(),
          sede: String(r.sede || hdr.sede || "").trim(),
          instructora: String(r.instr || hdr.docente || "").trim(),
          turno: turnoOf(r.grupo || "") || hdr.turno || "",
          materiaEnRenglon: !!(r.materia && String(r.materia).trim()),
          fuente: sec.titulo || "",
          texto: [r.servicio, r.motivo && motivoOf(r.motivo) ? "" : r.motivo, r.motivo2].filter(Boolean).join(" · ")
        };
        const key = [ev.cid || norm(ev.nombre), ev.fecha, ev.tipo, ev.materia, ev.servicio].join("|");
        if (seen.has(key)) return;
        seen.add(key);
        eventos.push(ev); rows++;
      }
      for (const raw of sec.lines) {
        const line = raw.replace(/\u00a0/g, " ");
        if (!line.trim()) continue;
        const cells = splitCells(line);
        /* encabezado de la bitácora (Materia, Sede, Docente, Semana) */
        const lab = scanLabels(cells ? cells.filter(Boolean).join("  ") : line);
        const labKeys = Object.keys(lab);
        const nmB = norm(line).match(/^\s*(nombre|cadete|fecha|motivo|tipo|dias?|servicio|materia|instructora|docente)\s*[:.\-]\s*(.+)$/);
        if (nmB && !map) {
          const k = nmB[1].replace(/s$/, "");
          const v = line.slice(line.length - nmB[2].length).trim();
          if (k === "nombre" || k === "cadete") { flushBlock(); block = { nombre: v }; continue; }
          if (block) { if (block[k] && (k === "fecha")) { flushBlock(); block = {}; } block[k] = v; continue; }
          if (k === "fecha") { block = { fecha: v }; continue; }
        }
        const dataRow = map && cells && cells.filter(Boolean).length >= 2;
        if (labKeys.length && !dataRow && !(cells && headerMap(cells))) {
          if (lab.materia) hdr.materia = lab.materia;
          if (lab.sede) hdr.sede = lab.sede;
          if (lab.docente) hdr.docente = lab.docente;
          if (lab.turno) hdr.turno = turnoOf(lab.turno + " turno") || hdr.turno;
          if (lab.semana) { hdr.semana = lab.semana; const f = parseFecha(lab.semana, { year: ctx.year || (ctx.semana ? +ctx.semana.slice(0, 4) : new Date().getFullYear()) }); if (f) hdr.semanaIso = f; }
          if (lab.al) hdr.al = lab.al;
          if (!hdr.turno) hdr.turno = turnoOf(line);
          continue;
        }
        if (!hdr.turno && !map && /turno/i.test(line) && !cells) hdr.turno = turnoOf(line);
        if (cells) {
          const hm = headerMap(cells);
          if (hm) { map = hm; prevFecha = ""; prevMot = ""; continue; }
        }
        if (map && cells && cells.length >= 2) {
          const g = k => (map[k] != null ? (cells[map[k]] || "") : "");
          const nombre = g("nombre");
          if (!nombre.trim() && !g("mat").trim()) {
            const f = g("fecha"); if (f.trim()) { const pf = parseFecha(f, localCtx()); if (pf) prevFecha = pf; }
            continue;
          }
          if (/^total|^motivo$|^notas?:/.test(norm(cells[0] || nombre))) continue;
          addRow({ fecha: g("fecha"), nombre, mat: g("mat"), grupo: g("grupo"), materia: g("materia"), sede: g("sede"), servicio: g("servicio"), motivo: g("motivo"), motivo2: g("motivo2"), instr: g("instr"), dias: g("dias"), horas: g("horas"), tipo: g("tipo") }, line);
          continue;
        }
        /* renglón libre (OCR, PDF sin tabla, WhatsApp) */
        const L = line.trim();
        if (L.length < 6 || /^(total|nombre y firma|entregado|anotar cada|bitacora|practica clinica|ejercito|dir\.|esc\. mil|fecha\s*\/\s*dia)/.test(norm(L))) continue;
        if (GRUPO_RE.test(norm(L)) && !findCadet(L, idx, null)) {
          notas.push(`Renglón para varios cadetes sin nombre (${sec.titulo || "texto"}): «${L.replace(/\s+/g, " ").slice(0, 140)}». No se registró por cadete; captúralo en Parte del día o pide la lista.`);
          continue;
        }
        const hit = findCadet(L, idx, null);
        if (!hit) continue;
        const fm = L.match(/(\d{4}-\d{2}-\d{2})|(\b\d{1,2}\s*[\/\-.]\s*\d{1,2}(?:\s*[\/\-.]\s*\d{2,4})?\b)|(\b\d{1,2}\s*(?:de\s+)?[A-Za-zé]{3,10}\.?(?:\s*(?:de\s*)?\d{4})?)|(\b(?:lunes|martes|mi[eé]rcoles|jueves|viernes)\b(?:\s*\d{1,2})?)|(^\s*\d{1,2}\b)/i);
        const fechaTxt = fm ? fm[0] : "";
        const fechaOk = fechaTxt && parseFecha(fechaTxt, localCtx());
        addRow({ fecha: fechaOk ? fechaTxt : "", nombre: hit.c ? hit.c.n : L, motivo: L, servicio: "", tipo: L }, L);
        const last = eventos[eventos.length - 1];
        if (last && last.leido === (hit.c ? hit.c.n : L)) { last.leido = L; last.texto = L; if (!fechaOk && !fechaTxt) last.fecha = last.fecha || ""; }
      }
      flushBlock();
      encabezados.push({ fuente: sec.titulo, materia: hdr.materia, sede: hdr.sede, docente: hdr.docente, turno: hdr.turno, semana: hdr.semana, renglones: rows });
    }
    return { eventos, encabezados, notas };
  }
  function mondayOf(s) { const w = dowOf(s); return addDays(s, w === 0 ? -6 : 1 - w); }

  /* ---------- asignación de práctica ---------- */
  const enPeriodo = (p, f) => !!(p && f && p.ini && p.fin && p.ini <= f && f <= p.fin);
  function practicasDelCadete(cad, P) {
    if (!cad || !cad.asig) return [];
    return [...new Set(Object.values(cad.asig).map(a => a && a.p).filter(id => id && P.has(id)))];
  }
  function yearOk(p, cad) {
    return !cad || !p || p.anio == null || p.anio === "" || cad.a == null || cad.a === "" || String(p.anio) === String(cad.a);
  }
  /* mismas materias del cadete en todas sus sedes (HCM y HMEMYN, u otra), no solo la de la lista oficial */
  function rotacionesDelCadete(cad, P, PL) {
    const own = practicasDelCadete(cad, P);
    if (!PL || !PL.length) return own;
    const mks = new Set(own.map(id => (P.get(id) || {}).mk).filter(Boolean));
    return [...new Set(own.concat(PL.filter(p => mks.has(p.mk) && yearOk(p, cad)).map(p => p.id)))];
  }
  function sedeDe(ev) {
    const k = sedeKey(ev.sede || "") || sedeKey(ev.servicio || "") || sedeKey(ev.materia || "");
    return k === "NAVAL" ? "HCM" : k;
  }
  function turnoDe(ev) {
    return String(ev.turno || "") || turnoOf([ev.servicio, ev.sede, ev.grupo].filter(Boolean).join(" "));
  }
  /* ev: {cid, fecha, materia, sede, instructora, turno, servicio}; ctx: {practicas:[...], cadetes:[...]}
     devuelve {practica, regla, candidatos, aviso} */
  function asignar(ev, ctx) {
    const PL = ctx.practicas || [];
    const P = new Map(PL.map(p => [p.id, p]));
    const cad = ev.cid ? (ctx.cadById ? ctx.cadById.get(ev.cid) : (ctx.cadetes || []).find(c => c.id === ev.cid)) : null;
    const delCad = practicasDelCadete(cad, P);
    const base = delCad.length ? delCad : PL.map(p => p.id);
    const reglas = [];
    let cand = null, aviso = "", conflicto = false;

    /* (a) materia o sede escrita; un servicio que solo existe en una materia también cuenta */
    let mks = mksOf(ev.materia || "");
    if (!mks.length && ev.servicio) { const ms = mksOf(ev.servicio).filter(k => k === "psiq" || k === "sp"); if (ms.length === 1) mks = ms; }
    if (mks.includes("tsu")) mks = ["tsu"];
    const sk = sedeDe(ev);
    const tu = turnoDe(ev);
    if (mks.length || sk) {
      const fit = id => { const p = P.get(id); return p && (!mks.length || mks.includes(p.mk)) && (!sk || sedeKey(p.sede) === sk); };
      let A = base.filter(fit);
      /* si la lista oficial tiene la otra sede, se elige la rotación del hospital que indica la bitácora */
      if (!A.length && sk) {
        const rot = PL.filter(p => fit(p.id) && yearOk(p, cad) && (mks.length ? true : delCad.some(id => (P.get(id) || {}).mk === p.mk))).map(p => p.id);
        if (rot.length) A = rot;
      }
      if (!A.length && sk && mks.length) {
        const mismaMat = base.filter(id => mks.includes((P.get(id) || {}).mk));
        if (mismaMat.length) return { practica: "", regla: "por decidir", candidatos: mismaMat, aviso: "La sede escrita en la bitácora no tiene una rotación registrada de esta práctica." };
      }
      if (!A.length && mks.length && delCad.length) {
        const otras = PL.filter(p => fit(p.id)).map(p => p.id);
        if (otras.length) { aviso = "El cadete no aparece en la lista de la práctica escrita en la bitácora."; return { practica: "", regla: "por decidir", candidatos: [...new Set([...otras, ...delCad])], aviso }; }
      }
      if (A.length) { cand = A; reglas.push(mks.length ? "materia escrita" : "sede escrita"); }
    }
    /* (b) instructora o docente */
    if (ev.instructora) {
      const I = practicasDeInstructora(ev.instructora, PL);
      if (I.ids.length) {
        const B = (cand || base).filter(id => I.ids.includes(id));
        if (B.length) { cand = B; reglas.push("instructora"); }
        else if (!cand && !delCad.length) { cand = I.ids; reglas.push("instructora"); }
        else if (!cand) { aviso = aviso || "La instructora escrita no coincide con las prácticas del cadete."; conflicto = true; }
      }
    }
    /* turno escrito: solo afina; si no viene, se prefiere el mismo turno de la rotación del cadete */
    if (cand && cand.length > 1 && tu) {
      const T = cand.filter(id => String((P.get(id) || {}).turno || "") === tu);
      if (T.length) cand = T;
    } else if (cand && cand.length > 1 && cad && !tu) {
      const mkSet = new Set(cand.map(id => (P.get(id) || {}).mk));
      const propios = delCad.filter(id => mkSet.has((P.get(id) || {}).mk));
      const turnos = [...new Set(propios.map(id => String((P.get(id) || {}).turno || "")).filter(Boolean))];
      if (turnos.length === 1) {
        const T = cand.filter(id => String((P.get(id) || {}).turno || "") === turnos[0]);
        if (T.length) cand = T;
      }
    }
    if (cand && cand.length === 1) {
      const p = P.get(cand[0]);
      /* la fecha no elige, pero sí impide asignar a una práctica que en esa fecha no estaba en curso */
      const escrita = reglas.some(r => /escrita/.test(r));
      if (ev.fecha && p && p.ini && p.fin && !enPeriodo(p, ev.fecha) && escrita) {
        aviso = aviso || `La fecha queda fuera del periodo registrado de esta práctica (${p.ini} a ${p.fin}); revisa sus fechas en Ajustes.`;
      } else if (ev.fecha && p && p.ini && p.fin && !enPeriodo(p, ev.fecha)) {
        return { practica: "", regla: "por decidir", candidatos: [...new Set([...cand, ...base])], aviso: `Coincide con ${reglas.join(" + ")}, pero el ${ev.fecha} esa práctica no estaba en curso (${p.ini} a ${p.fin}).` };
      }
      return { practica: cand[0], regla: reglas.join(" + "), candidatos: cand, aviso };
    }
    if (cand && cand.length > 1 && ev.fecha) {
      const F = cand.filter(id => enPeriodo(P.get(id), ev.fecha));
      if (F.length === 1) return { practica: F[0], regla: reglas.join(" + ") + " + fecha (desempate)", candidatos: cand, aviso };
    }
    if (!cand && delCad.length === 1 && !conflicto && !mks.length && !sk) {
      const p = P.get(delCad[0]);
      if (!ev.fecha || !p.ini || enPeriodo(p, ev.fecha)) return { practica: delCad[0], regla: "única práctica del cadete", candidatos: delCad, aviso };
    }
    return { practica: "", regla: "por decidir", candidatos: cand || base, aviso: aviso || (cand ? "Más de una práctica coincide." : "La bitácora no dice la materia ni la instructora.") };
  }

  /* revisa novedades ya guardadas: {reasignar:[...], decidir:[...]} */
  function revisarGuardadas(eventos, ctx) {
    const PL = ctx.practicas || [];
    const P = new Map(PL.map(p => [p.id, p]));
    const cadById = ctx.cadById || new Map((ctx.cadetes || []).map(c => [c.id, c]));
    const reasignar = [], decidir = [];
    for (const e of eventos) {
      const cad = cadById.get(e.c);
      const delCad = practicasDelCadete(cad, P);
      const permitidas = rotacionesDelCadete(cad, P, PL);
      const p = P.get(e.p);
      const fuera = p && e.f && p.ini && p.fin && !enPeriodo(p, e.f);
      const ajena = e.p && delCad.length && !permitidas.includes(e.p);
      const sin = !e.p || !p;
      const x = String(e.x || "");
      const skX = sedeKey(x) === "NAVAL" ? "HCM" : sedeKey(x);
      /* solo si existe rotación de la misma materia en ese hospital (un servicio que nombra otro nosocomio no basta) */
      const hayRot = !!(skX && p && PL.some(q => q.mk === p.mk && (sedeKey(q.sede) === "NAVAL" ? "HCM" : sedeKey(q.sede)) === skX));
      const sedeDistinta = !!(skX && p && sedeKey(p.sede) && skX !== sedeKey(p.sede) && hayRot);
      if (!fuera && !ajena && !sin && !sedeDistinta) continue;
      const r = asignar({ cid: e.c, fecha: e.f, materia: mksOf(x).length ? x : (p && p.materia) || "", sede: skX ? x : "", instructora: "", servicio: x, turno: turnoOf(x) }, { practicas: PL, cadById });
      const porTexto = r.practica && r.practica !== e.p && (/escrita/.test(r.regla) || sedeDistinta);
      const motivo = sin ? "sin práctica" : ajena ? "la práctica no es del cadete" : sedeDistinta ? "la bitácora indica otro hospital (otra rotación de la misma práctica)" : "la fecha cae fuera del periodo de la práctica";
      const enCursoPropias = delCad.filter(id => id !== e.p && enPeriodo(P.get(id), e.f));
      const enCurso = permitidas.filter(id => id !== e.p && enPeriodo(P.get(id), e.f));
      const sugerida = (r.practica && r.practica !== e.p) ? r.practica : enCursoPropias.length === 1 ? enCursoPropias[0] : enCurso.length === 1 ? enCurso[0] : "";
      const row = { id: e.id, c: e.c, f: e.f, t: e.t, actual: e.p || "", motivo, candidatos: permitidas.length ? permitidas : PL.map(x => x.id), sugerida };
      if (porTexto) reasignar.push(Object.assign(row, { nueva: r.practica, regla: r.regla }));
      else decidir.push(row);
    }
    return { reasignar, decidir };
  }

  const API = { parse, asignar, revisarGuardadas, parseFecha, motivoOf, mksOf, sedeKey, turnoOf, findCadet, makeIndex, practicasDeInstructora, nameTokens, enPeriodo };
  G.ReplicaBit = API;
  if (typeof module !== "undefined" && module.exports) module.exports = API;
})(typeof window !== "undefined" ? window : globalThis);
