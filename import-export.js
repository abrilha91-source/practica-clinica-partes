/* Importación del concentrado .xlsx, respaldo JSON y lector local de bitácoras. */
(function (global) {
  "use strict";

  const MK_NAME = {
    quir: "Enfermería Quirúrgica", mq: "Médico Quirúrgica", fund: "Fundamentos I",
    sp: "Salud Pública", psiq: "Enfermería Psiquiátrica", tsu: "Médico Quirúrgica T.S.U."
  };
  const YEAR_MK = { "4": ["quir", "psiq"], "3": ["sp", "mq"], "2": ["fund"] };
  const ANIO_REV = { "2/o.": "2", "3/er.": "3", "4/o.": "4", "T.S.U.": "T", "2/o": "2", "3/er": "3", "4/o": "4" };
  const MOT_ALL = [
    ["servicio", "Servicio", "servicio", "servicios"],
    ["cita", "Cita programada", "cita programada", "citas programadas"],
    ["comision", "Comisión", "comisión", "comisión"],
    ["exceptuacion", "Exceptuación", "exceptuado", "exceptuados"],
    ["encamado", "Pelotón de sanidad", "encamado en el pelotón de sanidad", "encamados en el pelotón de sanidad"],
    ["guardia", "Guardia", "guardia", "guardias"],
    ["lab", "Laboratorios", "laboratorios", "laboratorios"],
    ["permiso", "Permiso", "permiso", "permisos"],
    ["arresto", "Arresto", "arresto", "arrestos"],
    ["injust", "Sin justificación", "falta injustificada", "faltas injustificadas"],
    ["otro", "Otro", "otro", "otros"]
  ];
  const REP_MAP = { "Por reponer": "pendiente", "Reposición solicitada": "solicitada", "Repuesta": "repuesta", "No aplica": "no" };
  const COLS = ["practicas", "cadetes", "eventos", "partes", "bitacoras"];

  const norm = s => (s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const slug = (s, n) => (norm(s).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, n || 24) || "x");
  const pad = n => String(n).padStart(2, "0");

  function cellIso(v, yearHint) {
    if (v == null || v === "") return "";
    if (v instanceof Date && !isNaN(v)) return `${v.getFullYear()}-${pad(v.getMonth() + 1)}-${pad(v.getDate())}`;
    if (typeof v === "number" && isFinite(v)) {
      try {
        const d = (global.XLSX && XLSX.SSF && XLSX.SSF.parse_date_code) ? XLSX.SSF.parse_date_code(v) : null;
        if (d && d.y) return `${d.y}-${pad(d.m)}-${pad(d.d)}`;
      } catch (e) {}
    }
    const s = String(v).trim();
    let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) return s.slice(0, 10);
    m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (m) {
      let d = +m[1], mo = +m[2], y = +m[3];
      if (mo > 12 && d <= 12) { const t = d; d = mo; mo = t; }
      return `${y}-${pad(mo)}-${pad(d)}`;
    }
    m = s.match(/^(\d{1,2})\/(\d{1,2})$/);
    if (m && yearHint) return `${yearHint}-${pad(+m[2])}-${pad(+m[1])}`;
    return "";
  }

  function mkOf(mat) {
    const s = norm(mat);
    if (s.includes("t.s.u") || (s.includes("tsu") && s.includes("medico"))) return "tsu";
    if (s.includes("psiquiatr")) return "psiq";
    if (s.includes("salud publica")) return "sp";
    if (s.includes("fundamentos")) return "fund";
    if (s.includes("medico quirurg")) return "mq";
    if (s.includes("quirurg")) return "quir";
    return "";
  }
  function parseTurno(s) {
    const t = norm(s);
    return (t.startsWith("2") || t.includes("segundo")) ? "2" : "1";
  }
  function parseAnio(s) {
    const t = String(s || "").trim();
    if (ANIO_REV[t]) return ANIO_REV[t];
    const n = norm(t);
    if (n.startsWith("2")) return "2";
    if (n.startsWith("3")) return "3";
    if (n.startsWith("4")) return "4";
    if (n.includes("t.s.u") || n === "t") return "T";
    return t || "";
  }
  function normMat(mat) {
    const s = String(mat || "").trim().toUpperCase().replace(/\s+/g, "");
    const m = s.match(/^([A-Z]+)(\d+)$/);
    return m ? (m[1] + "-" + m[2]) : String(mat || "").trim().toUpperCase();
  }
  function cadId(mat, name, anio, grupo) {
    const nm = normMat(mat);
    if (nm) return "m-" + nm.replace(/[^A-Z0-9-]/g, "");
    return "n-" + slug(name, 40) + "-" + (anio || "x") + "-" + slug(grupo || "x", 8);
  }
  function pracId(mk, sede, turno) { return (mk || "x") + "-" + slug(sede, 20) + "-" + turno; }

  function cell(row, idx, def) {
    if (idx == null || idx >= (row || []).length || row[idx] == null) return def === undefined ? "" : def;
    return row[idx];
  }
  function idxOf(hdr, names) {
    names = Array.isArray(names) ? names : [names];
    for (const n of names) {
      const i = hdr.indexOf(n);
      if (i >= 0) return i;
    }
    return null;
  }
  function colsOf(hdr, alias) {
    const out = {};
    for (const k of Object.keys(alias)) out[k] = idxOf(hdr, alias[k]);
    return out;
  }

  function parseNovText(s) {
    if (!s) return [];
    const out = [];
    String(s).trim().split(/\s*;\s*/).forEach(part => {
      if (!part) return;
      const m = part.trim().match(/^(\d+)\s+(.+)$/);
      if (!m) return;
      const n = +m[1], rest = m[2].trim();
      let key = null, x = "";
      for (const mot of MOT_ALL) {
        if (mot.slice(1).some(f => norm(rest) === norm(f))) { key = mot[0]; break; }
      }
      if (!key) {
        const cands = [];
        for (const mot of MOT_ALL) {
          for (const form of mot.slice(1)) {
            if (norm(rest).startsWith(norm(form))) cands.push([norm(form).length, mot[0]]);
          }
        }
        if (cands.length) {
          cands.sort((a, b) => b[0] - a[0]);
          key = cands[0][1]; x = rest;
        } else { key = "otro"; x = rest; }
      }
      out.push({ n, m: key, x });
    });
    return out;
  }
  function motFromLabel(label) {
    const s = String(label || "").trim();
    for (const mot of MOT_ALL) {
      if (mot.slice(1).some(f => norm(s) === norm(f))) return mot[0];
    }
    for (const mot of MOT_ALL) {
      if (norm(s).startsWith(norm(mot[1]))) return mot[0];
    }
    return "otro";
  }
  function evId(t, cid, pid, f, extra) {
    const raw = `${t}|${cid}|${pid}|${f}|${extra || ""}`;
    let h = 2166136261;
    for (let i = 0; i < raw.length; i++) { h ^= raw.charCodeAt(i); h = Math.imul(h, 16777619); }
    return "e-" + (h >>> 0).toString(16).padStart(8, "0") + raw.length.toString(16);
  }

  function classify(name, rows) {
    const h = (rows[0] || []).map(c => String(c == null ? "" : c).trim());
    if (h.includes("Novedades") && h.includes("Efectivo")) return "partes";
    if (h.includes("Reposición") || h.includes("Reposicion")) return "inasistencias";
    if (h.includes("Impuesto por")) return "arrestos";
    if (h.includes("Hecho")) return "anecdotario";
    if (h.includes("Instrumento") && (h.includes("Final") || h.some(x => /Trabajo/.test(x)))) return "calif";
    if (name === "Retardos" || (h[0] === "Fecha" && h.includes("Observaciones") && !h.includes("Motivo") && !h.includes("Tipo") && !h.includes("Días") && !h.includes("Dias"))) return "retardos";
    const title = String((rows[0] || [])[0] || "");
    if (/turno/i.test(title) && title.includes("·")) return "practica";
    return "other";
  }

  function sheetRows(X, wb, name) {
    const ws = wb.Sheets[name];
    if (!ws) return [];
    const rows = X.utils.sheet_to_json(ws, { header: 1, raw: true, defval: null });
    return rows.map(r => {
      const a = Array.isArray(r) ? r.slice() : [];
      while (a.length && (a[a.length - 1] == null || a[a.length - 1] === "")) a.pop();
      return a;
    });
  }

  function parseConcentrado(X, wb) {
    const sheets = {};
    (wb.SheetNames || []).forEach(n => { sheets[n] = sheetRows(X, wb, n); });
    const practicas = {}, cadetes = {}, eventos = {}, partes = {};
    const horasMateria = {}, warnings = [];
    const report = { hojas: {}, omitidas: [], sin_practica: [] };
    let yearHint = 2026;
    Object.values(sheets).some(rows => rows.slice(0, 10).some(row => row.some(c => {
      const iso = cellIso(c);
      if (iso) { yearHint = +iso.slice(0, 4); return true; }
      return false;
    })));

    function ensureCad(name, mat, anio, grupo) {
      name = String(name || "").trim(); mat = String(mat || "").trim();
      anio = parseAnio(anio); grupo = String(grupo || "").trim();
      const cid = cadId(mat, name, anio, grupo);
      if (!cadetes[cid]) cadetes[cid] = { n: name, mat: mat ? normMat(mat) : "", a: anio, g: grupo, asig: {}, cal: {} };
      else {
        const o = cadetes[cid];
        if (name && !o.n) o.n = name;
        if (mat && !o.mat) o.mat = normMat(mat);
        if (anio && !o.a) o.a = anio;
        if (grupo && !o.g) o.g = grupo;
      }
      return cid;
    }
    function ensurePrac(materia, sede, turno, extra) {
      extra = extra || {};
      materia = String(materia || "").trim(); sede = String(sede || "").trim();
      turno = parseTurno(turno || "1");
      const mk = extra.mk || mkOf(materia) || "";
      const pid = pracId(mk, sede, turno);
      if (!practicas[pid]) {
        practicas[pid] = {
          materia, sede, turno, mk, docente: extra.docente || "",
          instructoras: (extra.instructoras || []).slice(),
          anio: extra.anio || "", ini: "", fin: "", dias: [],
          orden: extra.orden != null ? extra.orden : 99, unidad: "cadetes"
        };
        if (extra.efectivo != null) practicas[pid].efectivo = extra.efectivo;
      } else {
        const p = practicas[pid];
        if (extra.docente && !p.docente) p.docente = extra.docente;
        if (extra.instructoras) {
          const have = (p.instructoras || []).map(norm);
          extra.instructoras.forEach(n => {
            if (n && !have.includes(norm(n))) { (p.instructoras || (p.instructoras = [])).push(n); have.push(norm(n)); }
          });
        }
        if (extra.anio && !p.anio) p.anio = extra.anio;
        if (extra.efectivo != null && p.efectivo == null) p.efectivo = extra.efectivo;
        if (extra.orden != null && (p.orden || 99) === 99) p.orden = extra.orden;
      }
      return pid;
    }

    let orden = 0;
    Object.keys(sheets).forEach(name => {
      const rows = sheets[name], kind = classify(name, rows);
      report.hojas[name] = { tipo: kind, filas: rows.length, filas_datos: Math.max(0, rows.length - (kind === "practica" ? 4 : 1)) };
      if (kind !== "practica") return;
      const title = String((rows[0] || [])[0] || "");
      const parts = title.split("·").map(s => s.trim());
      const materia = parts[0] || "", sede = parts[1] || "", turno = parseTurno(parts[2] || "1");
      const instrLine = String((rows[1] || [])[0] || "").replace(/^Instructoras:\s*/, "").trim();
      const instructoras = instrLine.split(";").map(s => s.trim()).filter(Boolean);
      const hdr = rows[3] || [];
      const mk = mkOf(materia);
      hdr.forEach(c => {
        const m = String(c || "").match(/de\s+(\d+)\s*h/i);
        if (m && mk) horasMateria[mk] = +m[1];
      });
      orden += 1;
      let anio = (rows[4] && rows[4][3] != null) ? parseAnio(rows[4][3]) : "";
      if (!anio && mk) anio = Object.keys(YEAR_MK).find(y => YEAR_MK[y].includes(mk)) || "";
      if (mk === "tsu") anio = "T";
      const pid = ensurePrac(materia, sede, turno, { mk, instructoras, docente: instructoras[0] || "", anio, orden });
      const hdrS = hdr.map(c => String(c == null ? "" : c).trim());
      const iNom = idxOf(hdrS, "Nombre") ?? 1, iMat = idxOf(hdrS, ["Matrícula", "Matricula"]) ?? 2;
      const iAn = idxOf(hdrS, ["Año", "Anio"]) ?? 3, iGr = idxOf(hdrS, "Grupo") ?? 4;
      let ncad = 0;
      rows.slice(4).forEach(row => {
        if (!row || row.every(c => c == null || c === "")) return;
        const nom = String(cell(row, iNom) || "").trim();
        if (!nom || nom.toLowerCase() === "nombre") return;
        const cid = ensureCad(nom, cell(row, iMat), cell(row, iAn), cell(row, iGr));
        if (mk) { cadetes[cid].asig = cadetes[cid].asig || {}; cadetes[cid].asig[mk] = { p: pid }; }
        ncad++;
      });
      report.hojas[name].cadetes = ncad;
      report.hojas[name].practica = pid;
    });

    Object.keys(sheets).forEach(name => {
      const rows = sheets[name];
      if (classify(name, rows) !== "calif") return;
      const hdr = (rows[0] || []).map(c => String(c == null ? "" : c).trim());
      let titleSrc = /^calif /i.test(name) ? name.slice(6) : name;
      let mk = mkOf(titleSrc) || mkOf("Enfermería " + titleSrc);
      if (!mk) {
        for (const k of Object.keys(MK_NAME)) {
          const label = MK_NAME[k];
          if (norm(titleSrc).includes(norm(label)) || norm(label.replace("Enfermería ", "")).includes(norm(titleSrc)) || norm(titleSrc).includes(norm(label.replace("Enfermería ", "")))) { mk = k; break; }
        }
      }
      const iNom = idxOf(hdr, "Nombre") ?? 1, iMat = idxOf(hdr, ["Matrícula", "Matricula"]) ?? 2;
      const iAn = idxOf(hdr, "Año") ?? 3, iGr = idxOf(hdr, "Grupo") ?? 4;
      const iSede = idxOf(hdr, ["Campo clínico", "Sede"]);
      const iInst = idxOf(hdr, "Instrumento"), iTi = idxOf(hdr, "Trabajo de investigación");
      const iEv = idxOf(hdr, ["Evaluación parcial final", "Evaluacion parcial final"]);
      let n = 0, grades = 0;
      rows.slice(1).forEach(row => {
        if (!row) return;
        const nom = String(cell(row, iNom) || "").trim();
        if (!nom) return;
        const cid = ensureCad(nom, cell(row, iMat), cell(row, iAn), cell(row, iGr));
        const sede = String(cell(row, iSede) || "").trim();
        if (mk && !(cadetes[cid].asig || {})[mk] && sede) {
          const matches = Object.keys(practicas).filter(p => practicas[p].mk === mk && norm(practicas[p].sede) === norm(sede));
          let pid = null;
          if (matches.length === 1) pid = matches[0];
          else if (matches.length) pid = practicas[pracId(mk, sede, "1")] ? pracId(mk, sede, "1") : matches[0];
          else pid = ensurePrac(MK_NAME[mk] || titleSrc, sede, "1", { mk, anio: cadetes[cid].a });
          if (pid) { cadetes[cid].asig = cadetes[cid].asig || {}; cadetes[cid].asig[mk] = { p: pid }; }
        }
        const num = v => { if (v == null || v === "") return null; const x = Number(v); return isNaN(x) ? null : x; };
        const cal = {};
        [["inst", iInst], ["ti", iTi], ["ev", iEv]].forEach(([k, i]) => {
          const v = i == null ? null : num(cell(row, i, null));
          if (v != null) cal[k] = v;
        });
        if (Object.keys(cal).length && mk) { cadetes[cid].cal = cadetes[cid].cal || {}; cadetes[cid].cal[mk] = cal; grades++; }
        n++;
      });
      Object.assign(report.hojas[name], { cadetes: n, con_calificacion: grades, mk });
    });

    Object.keys(sheets).forEach(name => {
      const rows = sheets[name];
      if (classify(name, rows) !== "partes") return;
      const c = colsOf((rows[0] || []).map(x => String(x == null ? "" : x).trim()), {
        f: "Fecha", t: "Turno", mat: "Materia", se: "Sede", doc: "Docente", asi: "Asistieron", ef: "Efectivo", nov: "Novedades"
      });
      let n = 0;
      rows.slice(1).forEach(row => {
        if (!row) return;
        const f = cellIso(cell(row, c.f), yearHint);
        if (!f) { warnings.push("Parte sin fecha"); return; }
        const materia = String(cell(row, c.mat) || "").trim();
        const sede = String(cell(row, c.se) || "").trim();
        const turno = parseTurno(String(cell(row, c.t) || "1"));
        const docente = String(cell(row, c.doc) || "").trim();
        const mk = mkOf(materia);
        let tot = cell(row, c.ef, null);
        tot = (tot == null || tot === "") ? null : (isNaN(+tot) ? null : +tot);
        const extra = { mk, docente };
        const guess = pracId(mk || "x", sede, turno);
        if (!practicas[guess] && tot != null) Object.assign(extra, { efectivo: tot, anio: mk === "tsu" ? "T" : "", orden: 90 });
        const pid = ensurePrac(materia, sede, turno, extra);
        if (docente) practicas[pid].docente = docente;
        partes[f + "_" + pid] = { f, p: pid, tot: tot != null ? tot : 0, nov: parseNovText(String(cell(row, c.nov) || "")), src: "import" };
        n++;
      });
      report.hojas[name].partes = n;
    });

    function findPid(materia, sede, cid) {
      const mk = mkOf(materia || ""), sedeN = norm(sede || "");
      if (cid && cadetes[cid] && mk) {
        const a = (cadetes[cid].asig || {})[mk];
        if (a && a.p && practicas[a.p]) return a.p;
      }
      const cands = Object.keys(practicas).filter(p => (!mk || practicas[p].mk === mk) && (!sedeN || norm(practicas[p].sede) === sedeN));
      if (cands.length === 1) return cands[0];
      if (cands.length > 1 && cid && cadetes[cid]) {
        const found = cands.find(p => Object.values(cadetes[cid].asig || {}).some(v => v.p === p));
        if (found) return found;
      }
      return cands[0] || null;
    }
    function addEv(t, row, c, fields) {
      const f = cellIso(cell(row, c.f), yearHint);
      const nom = String(cell(row, c.n) || "").trim(), mat = String(cell(row, c.m) || "").trim();
      if (!nom && !mat) return null;
      const cid = ensureCad(nom, mat, cell(row, c.a), cell(row, c.g));
      const materia = String(cell(row, c.mat) || "").trim(), sede = String(cell(row, c.se) || "").trim();
      let pid = findPid(materia, sede, cid);
      if (!pid) {
        const mk = mkOf(materia);
        if (mk && sede) {
          pid = ensurePrac(materia, sede, "1", { mk, anio: parseAnio(cell(row, c.a)) });
          cadetes[cid].asig = cadetes[cid].asig || {}; cadetes[cid].asig[mk] = { p: pid };
        } else {
          report.sin_practica.push({ nombre: nom, matricula: mat, materia, sede, tipo: t });
          return null;
        }
      }
      const mk = practicas[pid].mk;
      if (mk && !(cadetes[cid].asig || {})[mk]) { cadetes[cid].asig = cadetes[cid].asig || {}; cadetes[cid].asig[mk] = { p: pid }; }
      const ev = Object.assign({ t, c: cid, p: pid, f: f || "", at: (f || "1970-01-01") + "T12:00:00.000Z" }, fields);
      const eid = evId(t, cid, pid, ev.f, JSON.stringify(fields));
      eventos[eid] = ev;
      return eid;
    }

    Object.keys(sheets).forEach(name => {
      const rows = sheets[name], kind = classify(name, rows);
      const hdr = (rows[0] || []).map(x => String(x == null ? "" : x).trim());
      if (kind === "inasistencias") {
        const c = colsOf(hdr, { f: "Fecha", n: "Nombre", m: ["Matrícula", "Matricula"], a: "Año", g: "Grupo", mat: "Materia", se: "Sede", d: ["Días", "Dias"], mot: "Motivo", ji: "J/I", rep: ["Reposición", "Reposicion"], x: "Observaciones" });
        let n = 0;
        rows.slice(1).forEach(row => {
          if (!row) return;
          let d = +cell(row, c.d, 1); if (!d) d = 1;
          const ji = String(cell(row, c.ji) || "").trim().toUpperCase();
          const fields = { d, m: motFromLabel(String(cell(row, c.mot) || "")), j: ji !== "I", rep: REP_MAP[String(cell(row, c.rep) || "").trim()] || "pendiente", x: String(cell(row, c.x) || "").trim() };
          if (addEv("falta", row, c, fields)) n++;
        });
        report.hojas[name].eventos = n;
      } else if (kind === "retardos") {
        const c = colsOf(hdr, { f: "Fecha", n: "Nombre", m: ["Matrícula", "Matricula"], a: "Año", g: "Grupo", mat: "Materia", se: "Sede", x: "Observaciones" });
        let n = 0;
        rows.slice(1).forEach(row => { if (row && addEv("retardo", row, c, { x: String(cell(row, c.x) || "").trim() })) n++; });
        report.hojas[name].eventos = n;
      } else if (kind === "anecdotario") {
        const c = colsOf(hdr, { f: "Fecha", n: "Nombre", m: ["Matrícula", "Matricula"], a: "Año", g: "Grupo", mat: "Materia", se: "Sede", tipo: "Tipo", x: "Hecho" });
        let n = 0;
        rows.slice(1).forEach(row => {
          if (!row) return;
          const pol = /neg/i.test(String(cell(row, c.tipo) || "")) ? "neg" : "pos";
          if (addEv("anecdota", row, c, { pol, x: String(cell(row, c.x) || "").trim() })) n++;
        });
        report.hojas[name].eventos = n;
      } else if (kind === "arrestos") {
        const c = colsOf(hdr, { f: "Fecha", n: "Nombre", m: ["Matrícula", "Matricula"], a: "Año", g: "Grupo", mat: "Materia", se: "Sede", h: "Horas", por: "Impuesto por", x: "Motivo" });
        let n = 0;
        rows.slice(1).forEach(row => {
          if (!row || row.every(v => v == null || v === "")) return;
          const h = Number(cell(row, c.h, 0) || 0) || 0;
          if (addEv("arresto", row, c, { h, por: String(cell(row, c.por) || "").trim(), x: String(cell(row, c.x) || "").trim() })) n++;
        });
        report.hojas[name].eventos = n;
      } else if (kind === "other") report.omitidas.push(name);
    });

    const datesByP = {};
    Object.values(partes).forEach(d => { if (d.f) (datesByP[d.p] || (datesByP[d.p] = new Set())).add(d.f); });
    Object.values(eventos).forEach(e => { if (e.f && e.p) (datesByP[e.p] || (datesByP[e.p] = new Set())).add(e.f); });
    const all = [];
    Object.values(datesByP).forEach(s => s.forEach(x => all.push(x)));
    all.sort();
    const gmin = all[0] || "", gmax = all[all.length - 1] || "";
    Object.keys(practicas).forEach(pid => {
      const p = practicas[pid];
      const ds = [...(datesByP[pid] || [])].sort();
      p.ini = ds[0] || gmin; p.fin = ds[ds.length - 1] || gmax;
      const dows = [...new Set(ds.map(x => { const [y, m, d] = x.split("-").map(Number); return new Date(y, m - 1, d).getDay(); }))].sort((a, b) => a - b);
      p.dias = dows.length ? dows : [1, 2, 3, 4];
      if (!(p.instructoras || []).length && p.docente) p.instructoras = [p.docente];
    });

    const evT = {};
    Object.values(eventos).forEach(e => { evT[e.t] = (evT[e.t] || 0) + 1; });
    report.resumen = {
      practicas: Object.keys(practicas).length,
      cadetes: Object.keys(cadetes).length,
      asignaciones: Object.values(cadetes).reduce((s, c) => s + Object.keys(c.asig || {}).length, 0),
      eventos: Object.keys(eventos).length,
      eventos_por_tipo: evT,
      partes: Object.keys(partes).length,
      horas_materia: Object.assign({}, horasMateria),
      rango_fechas: [gmin, gmax],
      sin_practica: report.sin_practica.length,
      sin_matricula: Object.values(cadetes).filter(c => !c.mat).length,
      advertencias: warnings
    };
    const cfg = { minimo: 6, riesgoPct: 30, pesos: { inst: 40, ti: 30, ev: 30 }, horasDia: 5, horasMateria: Object.assign({}, horasMateria) };
    return { practicas, cadetes, eventos, partes, bitacoras: {}, cfg, report };
  }

  function styleSheet(ws) {
    Object.keys(ws).forEach(k => {
      if (k[0] === "!") return;
      const c = ws[k];
      if (!c || typeof c !== "object") return;
      c.s = c.s || {};
      c.s.font = Object.assign({ name: "Noto Sans", sz: 10 }, c.s.font || {});
    });
  }

  async function replaceAll(data) {
    if (!S.db) throw new Error("Sin base de datos");
    for (const col of COLS) await S.db._clear(col);
    await S.db._clear("ajustes");
    const items = [];
    const add = (col, obj) => Object.keys(obj || {}).forEach(id => items.push({ col, id, data: obj[id] }));
    add("practicas", data.practicas);
    add("cadetes", data.cadetes);
    add("eventos", data.eventos);
    add("partes", data.partes);
    add("bitacoras", data.bitacoras);
    if (data.cfg) items.push({ col: "ajustes", id: "general", data: data.cfg });
    await S.db._bulk(items);
    await Promise.all(["practicas", "cadetes", "eventos", "partes", "bitacoras", "ajustes"].map(c => S.db._notify(c)));
  }

  function snapshot() {
    const pack = (M) => {
      const o = {};
      M.forEach((v, k) => { o[k] = v; });
      return o;
    };
    return {
      formato: "practica-clinica-partes-respaldo",
      version: "1.0",
      app: "Seguimiento de práctica clínica (réplica)",
      exportedAt: new Date().toISOString(),
      cfg: JSON.parse(JSON.stringify(S.cfg || {})),
      practicas: pack(S.prac),
      cadetes: pack(S.cad),
      eventos: pack(S.ev),
      partes: pack(S.par),
      bitacoras: pack(S.bit)
    };
  }

  async function downloadJson() {
    const data = snapshot();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const DL = await window.claude.use("downloads");
    await DL.save({ filename: `RESPALDO PRACTICA CLINICA ${today()}.json`, data: blob });
    toast("Respaldo JSON listo");
  }

  function looksLikeBackup(o) {
    return o && o.formato === "practica-clinica-partes-respaldo" && (o.practicas || o.cadetes);
  }

  function parseBitacora(prompt) {
    const notas = [];
    const chunks = [];
    const re = /"""([\s\S]*?)"""/g;
    let m;
    while ((m = re.exec(prompt))) chunks.push(m[1]);
    const text = chunks.join("\n\n");
    if (/CONCENTRADO PRACTICA|Inasistencias/.test(text) && /Fecha/.test(text) && /Matr[ií]cula/.test(text) && /Novedades|Reposición/.test(text)) {
      notas.push("Este archivo parece un concentrado de la app. Impórtalo en Ajustes → Importar concentrado .xlsx para cargar cadetes, partes y novedades.");
    }
    const isCal = /Lee la lista de calificaciones/.test(prompt) || /JSON:\s*\{"filas"/.test(prompt);
    if (isCal) {
      const filas = parseCalText(text);
      if (!filas.length) notas.push("No se encontraron calificaciones en el texto. Revisa el texto leído o pega las notas.");
      return { filas, notas: notas.join(" ") };
    }
    let eventos;
    if (global.ReplicaBit) {
      const ctx = {
        cadetes: typeof cads === "function" ? cads() : [],
        practicas: typeof pracs === "function" ? pracs() : [],
        semana: global.__bitSemana || ""
      };
      const r = ReplicaBit.parse(text, ctx);
      eventos = r.eventos;
      if (r.notas.length) notas.push(...r.notas);
      global.__bitEncabezados = r.encabezados;
    } else eventos = parseNovFromText(text);
    if (!eventos.length) notas.push("No se pudieron extraer novedades con certeza. Revisa el texto leído abajo, corrige las filas si hace falta o captura los datos en Parte del día y en Novedades. El reconocimiento óptico y la transcripción no son perfectos.");
    return { eventos, partes: [], notas: notas.join(" ") };
  }

  function parseCalText(text) {
    const filas = [];
    const lines = String(text || "").split(/\r?\n/);
    for (const line of lines) {
      const cells = line.split(/[,;\t]/).map(s => s.trim()).filter((s, i, a) => s || i < a.length - 1);
      if (cells.length < 2) continue;
      if (/^no\.?$/i.test(cells[0]) || /nombre/i.test(cells[0])) continue;
      const nums = [];
      let nombre = "";
      cells.forEach(c => {
        const v = c.replace(",", ".");
        if (/^\d+(\.\d+)?$/.test(v) && +v <= 10) nums.push(+v);
        else if (!nombre && /[a-záéíóúñ]/i.test(c) && !/^(instrumento|trabajo|evaluaci|final|campo)/i.test(c)) nombre = c;
      });
      if (nombre && nums.length) filas.push({ nombre, instrumento: nums[0] ?? null, trabajo: nums[1] ?? null, evaluacion: nums[2] ?? null });
    }
    return filas;
  }

  function parseNovFromText(text) {
    const eventos = [];
    const lines = String(text || "").split(/\r?\n/);
    const header = (lines[0] || "").toLowerCase();
    if (header.includes("fecha") && (header.includes("motivo") || header.includes("nombre"))) {
      const cols = lines[0].split(/[,;\t]/).map(s => s.trim().toLowerCase());
      const i = k => cols.findIndex(c => c.includes(k));
      const iF = i("fecha"), iN = i("nombre"), iT = cols.findIndex(c => c === "tipo" || c.includes("tipo")), iM = i("motivo"), iD = i("día") >= 0 ? i("día") : i("dia");
      lines.slice(1).forEach(line => {
        const c = line.split(/[,;\t]/);
        if (!c.length) return;
        const nombre = (c[iN] || "").trim();
        if (!nombre) return;
        let tipo = "falta";
        const t = (iT >= 0 ? c[iT] : "").toLowerCase();
        if (/retardo/.test(t)) tipo = "retardo";
        else if (/anecdot/.test(t)) tipo = "anecdota";
        else if (/arresto/.test(t)) tipo = "arresto";
        const fecha = cellIso((iF >= 0 ? c[iF] : "").trim(), 2026);
        const motivo = motFromLabel((iM >= 0 ? c[iM] : "").trim());
        const dias = iD >= 0 ? (parseInt(c[iD], 10) || 1) : 1;
        eventos.push({ nombre, fecha, dias, tipo, motivo, justificada: true, polaridad: "", horas: null, texto: "" });
      });
      return eventos;
    }
    const dateRe = /(\d{4}-\d{2}-\d{2})|(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/g;
    const cadList = typeof cads === "function" ? cads().slice().sort((a, b) => (b.n || "").length - (a.n || "").length) : [];
    /* Bloques «Clave: valor» en renglones separados (PDF, OCR, audio) */
    const blocks = [];
    let cur = null;
    for (const raw of lines) {
      const m = raw.trim().match(/^(fecha|nombre|cadete|tipo|motivo|d[ií]as?)\s*[:.\-]\s*(.+)$/i);
      if (!m) continue;
      const k = norm(m[1]).replace(/s$/, "");
      if (k === "nombre" || k === "cadete") { if (cur && cur.nombre) blocks.push(cur); cur = Object.assign({}, cur && !cur.nombre ? cur : {}, { nombre: m[2].trim() }); }
      else { cur = cur || {}; if (cur[k] && cur.nombre) { blocks.push(cur); cur = {}; } cur[k] = m[2].trim(); }
    }
    if (cur && cur.nombre) blocks.push(cur);
    blocks.forEach(b => {
      const hit = cadList.find(c => c.n && norm(b.nombre).includes(norm(c.n)));
      const nombre = hit ? hit.n : b.nombre;
      const t = norm(b.tipo || "");
      const tipo = /retardo/.test(t) ? "retardo" : /anecdot/.test(t) ? "anecdota" : /arresto/.test(t) ? "arresto" : "falta";
      const mot = b.motivo ? MOT_ALL.find(m => m.slice(1).some(f => f && norm(b.motivo).includes(norm(f)))) : null;
      const dm = (b.fecha || "").match(dateRe);
      eventos.push({ nombre, fecha: dm ? cellIso(dm[0], 2026) : "", dias: parseInt(b.dia, 10) || 1, tipo, motivo: mot ? mot[0] : "", justificada: true, polaridad: "", horas: null, texto: [b.fecha, b.tipo, b.motivo].filter(Boolean).join(" · ") });
    });
    if (blocks.length) return eventos;
    for (const line of lines) {
      const L = line.trim();
      if (L.length < 6) continue;
      if (/^fecha\b/i.test(L) && /nombre|motivo/i.test(L)) continue;
      const dates = L.match(dateRe);
      const mot = MOT_ALL.find(m => m.slice(1).some(f => f && norm(L).includes(norm(f))));
      let tipo = "falta";
      if (/retardo/i.test(L)) tipo = "retardo";
      else if (/anecdot/i.test(L)) tipo = "anecdota";
      else if (/arresto/i.test(L)) tipo = "arresto";
      let nombre = "";
      for (const c of cadList) {
        if (c.n && norm(L).includes(norm(c.n))) { nombre = c.n; break; }
      }
      if (!nombre) {
        const mat = L.match(/\b([ADC]-?\d{5,})\b/i);
        if (mat) {
          const raw = mat[1].toUpperCase().replace(/^(A|D|C)(\d)/, "$1-$2");
          const found = cadList.find(c => (c.mat || "").toUpperCase() === raw || (c.mat || "").replace(/-/g, "") === raw.replace(/-/g, ""));
          if (found) nombre = found.n;
        }
      }
      if (!nombre) {
        const nm = L.match(/nombre\s*[:.\-]\s*(.+)$/i);
        if (nm) nombre = nm[1].replace(/[,;].*$/, "").trim();
      }
      if (!nombre) continue;
      if (!dates && !mot && tipo === "falta" && !/inasist|falta/i.test(L)) continue;
      const fecha = dates && dates[0] ? cellIso(dates[0], 2026) : "";
      const already = eventos.some(e => e.nombre === nombre && e.fecha === fecha && e.tipo === tipo);
      if (already) continue;
      eventos.push({ nombre, fecha, dias: 1, tipo, motivo: mot ? mot[0] : "", justificada: true, polaridad: "", horas: null, texto: L });
    }
    return eventos;
  }

  function enhanceCfg() {
    if (!VW) return;
    if (VW.querySelector("#repBox")) return;
    const box = document.createElement("div");
    box.innerHTML = `
<section class="box" id="repBox">
  <h3>Respaldo e importación</h3>
  <p class="hint" style="margin:4px 0 10px">Los registros se quedan en este dispositivo. Puedes traer el contenido de la app original con el concentrado en Excel, o restaurar un respaldo JSON de esta réplica. Al importar se sustituyen los datos actuales (se pide confirmación).</p>
  <div class="acts" style="justify-content:flex-start">
    <button class="btn" type="button" id="jsondl">Descargar respaldo JSON</button>
    <button class="btn ghost" type="button" id="jsonup">Importar respaldo JSON</button>
    <button class="btn ghost" type="button" id="xlup">Importar concentrado .xlsx</button>
  </div>
  <input type="file" id="jsonFile" accept="application/json,.json" hidden>
  <input type="file" id="xlFile" accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" hidden>
  <p class="hint" style="margin-top:8px" id="impMsg"></p>
</section>
<section class="box">
  <h3>Acerca de esta réplica</h3>
  <p class="hint">Versión 1.2 · App independiente de «Seguimiento de práctica clínica» (seguimiento-discentes). Esta réplica no envía datos a Claude ni a ningún servidor. Lee PDF, Excel, Word, PowerPoint, fotos (OCR) y, si el dispositivo lo permite, audio; conviene revisar lo leído antes de aplicar. Cada novedad se registra en la práctica que dice la bitácora (materia o sede escrita; si hay dos rotaciones, en el hospital que indica la bitácora); si no lo dice, por la instructora; si aun así hay duda, queda «Por asignar» y tú eliges.</p>
</section>
<section class="box" id="perBox">
  <h3>Fechas de las prácticas</h3>
  <p class="hint" style="margin:4px 0 10px">La app usa el inicio y el término de cada práctica para desempatar y para avisar cuando una novedad cae fuera de su periodo. Puedes corregirlas en la tabla de prácticas o traerlas de un archivo JSON (solo cambia fechas y días; no toca cadetes ni novedades).</p>
  <div class="acts" style="justify-content:flex-start"><button class="btn ghost" type="button" id="perup">Actualizar fechas desde JSON</button></div>
  <input type="file" id="perFile" accept="application/json,.json" hidden>
  <p class="hint" style="margin-top:8px" id="perMsg"></p>
</section>
<section class="box" id="revBox">
  <h3>Revisar la práctica de las novedades guardadas</h3>
  <p class="hint" style="margin:4px 0 10px">Busca novedades que quedaron en una práctica que no corresponde (por ejemplo, en Psiquiatría antes de que empiece, o en una práctica que no es del cadete). Te muestra lo que encontró y nada cambia hasta que confirmes.</p>
  <div class="acts" style="justify-content:flex-start"><button class="btn" type="button" id="revgo">Revisar novedades</button></div>
  <div id="revOut" style="margin-top:10px"></div>
</section>`;
    /* Insert the backup box after the first section (concentrado) */
    const first = VW.querySelector("section.box");
    if (first && first.nextSibling) VW.insertBefore(box, first.nextSibling);
    else VW.appendChild(box);
    /* unwrap: box may have two sections */
    while (box.firstChild) box.parentNode.insertBefore(box.firstChild, box);
    box.remove();

    const msg = (t, ok) => { const el = $("#impMsg"); if (el) { el.textContent = t || ""; el.style.color = ok ? "var(--ok)" : "var(--muted)"; } };
    const $id = id => document.getElementById(id);
    if ($id("jsondl")) $id("jsondl").onclick = () => downloadJson().catch(e => { console.error(e); toast("No se pudo descargar el respaldo."); });
    if ($id("jsonup")) $id("jsonup").onclick = () => $id("jsonFile").click();
    if ($id("xlup")) $id("xlup").onclick = () => $id("xlFile").click();
    if ($id("jsonFile")) $id("jsonFile").onchange = async ev => {
      const f = ev.target.files && ev.target.files[0]; ev.target.value = "";
      if (!f) return;
      try {
        const o = JSON.parse(await f.text());
        if (!looksLikeBackup(o)) { toast("Ese archivo no es un respaldo de esta réplica."); return; }
        const nCad = Object.keys(o.cadetes || {}).length, nEv = Object.keys(o.eventos || {}).length;
        if (!confirm(`Esto sustituye los datos actuales por el respaldo (${nCad} cadetes, ${nEv} novedades). ¿Continuar?`)) return;
        msg("Importando respaldo…");
        await replaceAll(o);
        toast("Respaldo importado");
        msg(`Listo: ${nCad} cadetes, ${nEv} novedades.`, true);
      } catch (e) {
        console.error(e); toast("No se pudo importar el JSON."); msg("Error al importar el JSON.");
      }
    };
    if ($id("perup")) $id("perup").onclick = () => $id("perFile").click();
    if ($id("perFile")) $id("perFile").onchange = async ev => {
      const f = ev.target.files && ev.target.files[0]; ev.target.value = "";
      if (!f) return;
      const pm = $id("perMsg");
      try {
        const o = JSON.parse(await f.text());
        const src = o && o.practicas;
        if (!src || typeof src !== "object") { toast("El archivo no trae prácticas."); return; }
        const cambios = [];
        Object.entries(src).forEach(([id, p]) => {
          const cur = S.prac.get(id);
          if (!cur || !p) return;
          const ini = /^\d{4}-\d{2}-\d{2}$/.test(p.ini || "") ? p.ini : cur.ini, fin = /^\d{4}-\d{2}-\d{2}$/.test(p.fin || "") ? p.fin : cur.fin;
          const dias = Array.isArray(p.dias) && p.dias.length ? p.dias : cur.dias;
          if (ini !== cur.ini || fin !== cur.fin || JSON.stringify(dias) !== JSON.stringify(cur.dias)) cambios.push({ id, ini, fin, dias, antes: `${cur.ini} a ${cur.fin}` });
        });
        if (!cambios.length) { if (pm) pm.textContent = "Las fechas ya coinciden; no hubo cambios."; return; }
        const lista = cambios.slice(0, 20).map(c => `• ${(S.prac.get(c.id) || {}).materia || c.id} · ${(S.prac.get(c.id) || {}).sede || ""}: ${c.antes} → ${c.ini} a ${c.fin}`).join("\n");
        if (!confirm(`Se actualizarán las fechas de ${cambios.length} práctica(s):\n${lista}${cambios.length > 20 ? "\n…" : ""}\n\nNo cambia cadetes ni novedades. ¿Continuar?`)) return;
        for (const c of cambios) { const cur = Object.assign({}, S.prac.get(c.id), { ini: c.ini, fin: c.fin, dias: c.dias }); await put("practicas", c.id, cur, true); }
        toast("Fechas de prácticas actualizadas");
        if (pm) { pm.textContent = `Listo: ${cambios.length} práctica(s) con fechas nuevas.`; pm.style.color = "var(--ok)"; }
      } catch (e) { console.error(e); toast("No se pudo leer el archivo de fechas."); }
    };
    if ($id("revgo") && global.ReplicaRev) $id("revgo").onclick = () => ReplicaRev.mostrar($id("revOut"));
    if ($id("xlFile")) $id("xlFile").onchange = async ev => {
      const f = ev.target.files && ev.target.files[0]; ev.target.value = "";
      if (!f) return;
      try {
        const X = await loadXLSX();
        const wb = X.read(await f.arrayBuffer(), { type: "array", cellDates: true });
        const data = parseConcentrado(X, wb);
        const r = data.report.resumen;
        if (!r.practicas && !r.cadetes) { toast("No se reconoció el formato del concentrado."); return; }
        if (!confirm(`Esto sustituye los datos actuales por el concentrado:\n${r.practicas} prácticas, ${r.cadetes} cadetes, ${r.partes} partes, ${r.eventos} novedades.\n¿Continuar?`)) return;
        msg("Importando concentrado…");
        await replaceAll(data);
        const extra = r.sin_practica ? ` ${r.sin_practica} fila(s) no se pudieron asignar a una práctica.` : "";
        toast("Concentrado importado");
        msg(`Listo: ${r.practicas} prácticas, ${r.cadetes} cadetes, ${r.partes} partes, ${r.eventos} novedades.${extra}`, true);
      } catch (e) {
        console.error(e); toast("No se pudo importar el Excel."); msg("Error al importar el concentrado.");
      }
    };
  }

  function install() {
    const prev = global.vCfg;
    if (typeof prev === "function") {
      global.vCfg = function () { prev(); enhanceCfg(); };
    }
  }

  global.ReplicaPC = {
    styleSheet, parseBitacora, parseConcentrado, replaceAll, snapshot, downloadJson, enhanceCfg, install,
    parseNovText, motFromLabel
  };
})(window);
