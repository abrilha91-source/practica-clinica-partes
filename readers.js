/* Lectura local de PDF, Excel, Word, PowerPoint, imágenes (OCR) y audio. */
(function (global) {
  "use strict";

  function kindOf(f) {
    const n = f && f.name || "";
    const t = f && f.type || "";
    if (/^image\//.test(t) || /\.(jpe?g|png|gif|webp|bmp)$/i.test(n)) return "img";
    if (t === "application/pdf" || /\.pdf$/i.test(n)) return "pdf";
    if (/\.(xlsx|xls|csv)$/i.test(n)) return "xls";
    if (/\.(docx|doc)$/i.test(n)) return "doc";
    if (/\.(pptx|ppt)$/i.test(n)) return "ppt";
    if (/^audio\//.test(t) || /\.(mp3|wav|m4a|ogg|aac)$/i.test(n)) return "aud";
    return "otro";
  }

  const okFile = f => kindOf(f) !== "otro";

  const CHIP = { pdf: "PDF", xls: "Excel", doc: "Word", ppt: "PowerPoint", aud: "Audio", img: "Imagen", otro: "Archivo" };

  function decodeXml(xml) {
    const t = document.createElement("textarea");
    t.innerHTML = String(xml || "").replace(/<a:tab\/>/g, "\t").replace(/<\/w:p>/g, "\n").replace(/<\/a:p>/g, "\n").replace(/<\/w:tc>/g, " | ").replace(/<[^>]+>/g, " ");
    return t.value.replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").replace(/[ \t]{2,}/g, " ").trim();
  }

  async function pptText(f) {
    const Z = await loadJSZip();
    const z = await Z.loadAsync(await f.arrayBuffer());
    const names = Object.keys(z.files).filter(n => /^ppt\/slides\/slide\d+\.xml$/i.test(n))
      .sort((a, b) => (parseInt(a.match(/(\d+)/)[1], 10) - parseInt(b.match(/(\d+)/)[1], 10)));
    if (!names.length) throw new Error("pptx");
    const parts = [];
    const tx = x => [...x.matchAll(/<a:t[^>]*>([^<]*)<\/a:t>/g)].map(m => m[1]).join("");
    const ent = t => t.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'");
    for (const n of names) {
      const xml = await z.file(n).async("string");
      /* tablas: una línea por renglón, celdas separadas por tabulador; texto: una línea por párrafo */
      const flat = xml.replace(/<a:tr[\s>][\s\S]*?<\/a:tr>/g, tr => "<a:p><a:t>" + [...tr.matchAll(/<a:tc[\s>][\s\S]*?<\/a:tc>/g)].map(c => [...c[0].matchAll(/<a:p[\s>][\s\S]*?<\/a:p>/g)].map(p => tx(p[0])).join(" ").replace(/\t/g, " ").trim()).join("\t") + "</a:t></a:p>");
      const lines = [...flat.matchAll(/<a:p[\s>][\s\S]*?<\/a:p>/g)].map(p => ent(tx(p[0])).replace(/[ ]+$/g, "")).filter(l => l.trim());
      const num = n.match(/slide(\d+)/i)[1];
      const body = (lines.join("\n").trim() || decodeXml(xml));
      if (body) parts.push("--- Diapositiva " + num + " ---\n" + body);
    }
    const notes = Object.keys(z.files).filter(n => /ppt\/notesSlides\/notesSlide\d+\.xml$/i.test(n));
    for (const n of notes) {
      const xml = await z.file(n).async("string");
      const texts = [...xml.matchAll(/<a:t[^>]*>([^<]*)<\/a:t>/g)].map(m => m[1]).join(" ").trim();
      if (texts) parts.push("--- Notas ---\n" + texts);
    }
    return parts.join("\n\n").trim();
  }

  /* Word: párrafos en líneas y cada renglón de tabla en una línea con tabuladores (antes cada celda
     quedaba en otra línea y se perdía qué nombre iba con qué fecha y motivo). */
  async function docTextRows(f) {
    const Z = await loadJSZip();
    const z = await Z.loadAsync(await f.arrayBuffer());
    const x = z.file("word/document.xml");
    if (!x) throw new Error("docx");
    const xml = await x.async("string");
    const doc = new DOMParser().parseFromString(xml, "application/xml");
    const W = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
    const kids = (el, name) => [...el.childNodes].filter(c => c.nodeType === 1 && c.localName === name);
    const txt = el => {
      let out = "";
      const walk = n => { for (const c of n.childNodes) { if (c.nodeType !== 1) continue; if (c.localName === "t") out += c.textContent; else if (c.localName === "tab") out += " "; else if (c.localName === "br") out += " "; else walk(c); } };
      walk(el); return out;
    };
    const lines = [];
    const vmerge = new Map();
    const walk = el => {
      for (const c of el.childNodes) {
        if (c.nodeType !== 1) continue;
        if (c.localName === "p") { const t = txt(c).trim(); if (t) lines.push(t); }
        else if (c.localName === "tbl") {
          const prev = [];
          kids(c, "tr").forEach(tr => {
            const cells = [];
            kids(tr, "tc").forEach(tc => {
              const pr = kids(tc, "tcPr")[0];
              const span = pr && kids(pr, "gridSpan")[0] ? parseInt(kids(pr, "gridSpan")[0].getAttributeNS(W, "val") || kids(pr, "gridSpan")[0].getAttribute("w:val") || "1", 10) : 1;
              const vm = pr && kids(pr, "vMerge")[0];
              let t = kids(tc, "p").map(txt).join(" ").replace(/\s+/g, " ").trim();
              const col = cells.length;
              /* celda combinada hacia abajo: repite el valor de arriba */
              if (vm && !(vm.getAttributeNS(W, "val") || vm.getAttribute("w:val")) && !t) t = prev[col] || "";
              cells.push(t);
              for (let k = 1; k < span; k++) cells.push("");
            });
            cells.forEach((v, i) => { prev[i] = v; });
            while (cells.length && !cells[cells.length - 1]) cells.pop();
            if (cells.some(Boolean)) lines.push(cells.join("\t"));
          });
        } else if (c.localName === "body" || c.localName === "sdt" || c.localName === "sdtContent" || c.localName === "customXml" || c.localName === "smartTag") walk(c);
      }
    };
    walk(doc.documentElement);
    return lines.join("\n").trim();
  }

  /* Excel: celdas combinadas rellenas, fechas en AAAA-MM-DD y columnas separadas por tabulador */
  function csvRows(text) {
    const src = String(text || "").replace(/^\ufeff/, "");
    const first = src.split(/\r?\n/)[0] || "";
    const sep = (first.match(/;/g) || []).length > (first.match(/,/g) || []).length ? ";" : (first.includes("\t") ? "\t" : ",");
    const rows = []; let row = [], cur = "", q = false;
    for (let i = 0; i < src.length; i++) {
      const ch = src[i];
      if (q) { if (ch === '"' && src[i + 1] === '"') { cur += '"'; i++; } else if (ch === '"') q = false; else cur += ch; continue; }
      if (ch === '"') q = true;
      else if (ch === sep) { row.push(cur.trim()); cur = ""; }
      else if (ch === "\n" || ch === "\r") { if (ch === "\r" && src[i + 1] === "\n") i++; row.push(cur.trim()); cur = ""; if (row.some(Boolean)) rows.push(row.map(c => c.replace(/\t/g, " ")).join("\t")); row = []; }
      else cur += ch;
    }
    row.push(cur.trim()); if (row.some(Boolean)) rows.push(row.join("\t"));
    return rows.join("\n");
  }

  async function xlsTextRows(f) {
    /* CSV: se lee como texto (sin que la fecha cambie por zona horaria) */
    if (/\.csv$/i.test(f.name || "")) return "## Hoja: " + f.name + "\n" + csvRows(await f.text());
    const X = await loadXLSX();
    /* sin cellDates: las fechas se leen del número de serie y no se recorren por la zona horaria */
    const wb = X.read(await f.arrayBuffer(), { type: "array" });
    if (global.ReplicaXlsTsv) return ReplicaXlsTsv.workbookText(X, wb);
    return wb.SheetNames.map(n => "## Hoja: " + n + "\n" + X.utils.sheet_to_csv(wb.Sheets[n], { blankrows: false, FS: "\t" })).join("\n\n");
  }

  async function pdfTextAndImages(f) {
    const L = await loadPDF();
    const data = new Uint8Array(await f.arrayBuffer());
    const pdf = await L.getDocument({ data }).promise;
    let txt = "";
    const weak = [];
    for (let i = 1; i <= pdf.numPages; i++) {
      const pg = await pdf.getPage(i);
      const tc = await pg.getTextContent();
      const t = pdfLayout(tc.items);
      if (t.length > 40) txt += "--- Página " + i + " ---\n" + t + "\n";
      else weak.push(i);
    }
    return { txt, weak, pages: pdf.numPages, pdf };
  }

  /* PDF con texto: agrupa por renglón (posición vertical) y separa columnas con tabulador */
  function pdfLayout(items) {
    const rows = [];
    (items || []).forEach(it => {
      if (!it || !it.str || !it.str.trim() || !it.transform) return;
      const x = it.transform[4], y = it.transform[5], h = Math.abs(it.transform[3]) || it.height || 10;
      let r = rows.find(r => Math.abs(r.y - y) <= Math.max(2, h * 0.45));
      if (!r) { r = { y, h, items: [] }; rows.push(r); }
      r.items.push({ x, w: it.width || (it.str.length * h * 0.5), s: it.str, h });
    });
    rows.sort((a, b) => b.y - a.y);
    return rows.map(r => {
      r.items.sort((a, b) => a.x - b.x);
      let out = "", end = null;
      r.items.forEach(it => {
        if (end != null) { const gap = it.x - end; out += gap > it.h * 1.6 ? "\t" : (gap > it.h * 0.15 || !/\s$/.test(out) ? " " : ""); }
        out += it.s; end = it.x + it.w;
      });
      return out.replace(/ +/g, " ").replace(/ ?\t ?/g, "\t").trim();
    }).filter(Boolean).join("\n");
  }

  async function renderPdfPage(pdf, i, maxSide) {
    const pg = await pdf.getPage(i);
    const v0 = pg.getViewport({ scale: 1 });
    const k = Math.min(2.8, (maxSide || 1800) / Math.max(v0.width, v0.height));
    const v = pg.getViewport({ scale: k });
    const c = document.createElement("canvas");
    c.width = Math.round(v.width);
    c.height = Math.round(v.height);
    await pg.render({ canvasContext: c.getContext("2d"), viewport: v }).promise;
    return c;
  }

  async function ocrCanvasOrBlob(src, onProgress) {
    if (!global.ReplicaOCR) throw new Error("OCR no disponible");
    const blob = src instanceof Blob ? src : await new Promise(r => src.toBlob(b => r(b), "image/png"));
    return ReplicaOCR.recognize(blob, onProgress);
  }

  async function extract(f, onProgress) {
    const k = kindOf(f);
    const label = CHIP[k] || "Archivo";
    const head = "\n## " + label + ": " + f.name + "\n";
    const res = { kind: k, text: "", notes: [], ocr: false, audio: false };
    try {
      if (k === "xls") {
        res.text = head + await xlsTextRows(f);
      } else if (k === "doc") {
        if (/\.doc$/i.test(f.name) && !/\.docx$/i.test(f.name)) {
          res.notes.push("El formato .doc antiguo no se puede leer; guárdalo como .docx.");
        } else res.text = head + await docTextRows(f);
      } else if (k === "ppt") {
        if (/\.ppt$/i.test(f.name) && !/\.pptx$/i.test(f.name)) {
          res.notes.push("El formato .ppt antiguo no se puede leer; guárdalo como .pptx.");
        } else res.text = head + await pptText(f);
      } else if (k === "pdf") {
        if (onProgress) onProgress("Leyendo PDF: " + f.name, 20);
        const r = await pdfTextAndImages(f);
        let body = r.txt || "";
        if (r.weak.length && global.ReplicaOCR) {
          res.ocr = true;
          const bits = [];
          for (let n = 0; n < r.weak.length; n++) {
            const i = r.weak[n];
            if (onProgress) onProgress("Reconociendo texto de la página " + i + " de " + f.name + "…", 25 + Math.round((n / r.weak.length) * 60));
            try {
              const canvas = await renderPdfPage(r.pdf, i, 1800);
              const o = await ocrCanvasOrBlob(canvas, onProgress);
              if (o.text) bits.push("--- Página " + i + " (OCR) ---\n" + o.text);
            } catch (e) {
              console.warn(e);
              res.notes.push("No se pudo reconocer la página " + i + " de " + f.name + ".");
            }
          }
          if (bits.length) body += (body ? "\n" : "") + bits.join("\n");
          res.notes.push("«" + f.name + "» es un escaneo (" + r.weak.length + " página" + (r.weak.length === 1 ? "" : "s") + " sin texto). El reconocimiento óptico lee bien lo impreso, pero casi nada de la letra a mano: revisa cada renglón y agrega los que falten con «Agregar renglón».");
          if (!body) res.notes.push("El PDF no tiene texto seleccionable y el OCR no obtuvo texto útil.");
        } else if (!body) {
          res.notes.push("El PDF no tiene texto seleccionable. El reconocimiento óptico no estaba listo.");
        }
        res.text = body ? head + body : "";
      } else if (k === "img") {
        res.ocr = true;
        if (onProgress) onProgress("Reconociendo el texto de " + f.name + "…", 30);
        const o = await ocrCanvasOrBlob(f, onProgress);
        if (o.text) res.text = head + o.text;
        else res.notes.push("No se leyó texto en " + f.name + ". El OCR funciona mejor con foto nítida, de frente y letras grandes.");
        if (o.confidence != null && o.confidence < 50) res.notes.push("La lectura de " + f.name + " tiene baja confianza (" + Math.round(o.confidence) + " %). Conviene revisar el texto.");
      } else if (k === "aud") {
        res.audio = true;
        if (onProgress) onProgress("Intentando transcribir " + f.name + "…", 20);
        if (global.ReplicaTranscribe) {
          const t = await ReplicaTranscribe.transcribe(f, onProgress);
          if (t.text) res.text = head + t.text;
          if (t.reason) res.notes.push(t.reason);
          if (!t.text && !t.reason) res.notes.push("No se obtuvo transcripción de " + f.name + ". El audio se guarda en la bitácora.");
        } else {
          res.notes.push("La transcripción de audio no está disponible. El archivo se guarda en la bitácora.");
        }
      } else {
        res.notes.push("No se reconoce el formato de " + f.name + ".");
      }
    } catch (e) {
      console.warn(e);
      res.notes.push("No se pudo leer " + f.name + (e && e.message ? " (" + e.message + ")" : "") + ".");
    }
    return res;
  }

  async function preparar(files, opts) {
    const onProgress = opts && opts.onProgress;
    let texto = "", omit = 0;
    const notes = [], imgs = [];
    const list = files || [];
    for (let i = 0; i < list.length; i++) {
      const f = list[i];
      if (onProgress) onProgress("Leyendo archivo " + (i + 1) + " de " + list.length + ": " + f.name, Math.round((i / Math.max(1, list.length)) * 100));
      const r = await extract(f, onProgress);
      if (r.text) texto += (texto && !r.text.startsWith("\n") ? "\n" : "") + r.text;
      if (r.notes) notes.push(...r.notes);
      if (!r.text && (r.kind === "img" || r.kind === "aud" || r.kind === "pdf")) omit++;
    }
    return { imgs, texto, omit, notes };
  }

  global.ReplicaReaders = { kindOf, okFile, CHIP, extract, preparar, pptText, docTextRows, xlsTextRows, pdfLayout, csvRows };
})(window);
