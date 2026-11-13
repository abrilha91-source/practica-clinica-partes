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
    for (const n of names) {
      const xml = await z.file(n).async("string");
      const texts = [...xml.matchAll(/<a:t[^>]*>([^<]*)<\/a:t>/g)].map(m => m[1]);
      const num = n.match(/slide(\d+)/i)[1];
      const body = (texts.join(" ").trim() || decodeXml(xml));
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

  async function pdfTextAndImages(f) {
    const L = await loadPDF();
    const data = new Uint8Array(await f.arrayBuffer());
    const pdf = await L.getDocument({ data }).promise;
    let txt = "";
    const weak = [];
    for (let i = 1; i <= pdf.numPages; i++) {
      const pg = await pdf.getPage(i);
      const tc = await pg.getTextContent();
      const t = tc.items.map(it => it.str + (it.hasEOL ? "\n" : " ")).join("").trim();
      if (t.length > 40) txt += "--- Página " + i + " ---\n" + t + "\n";
      else weak.push(i);
    }
    return { txt, weak, pages: pdf.numPages, pdf };
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
        res.text = head + await xlsText(f);
      } else if (k === "doc") {
        if (/\.doc$/i.test(f.name) && !/\.docx$/i.test(f.name)) {
          res.notes.push("El formato .doc antiguo no se puede leer; guárdalo como .docx.");
        } else res.text = head + await docText(f);
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

  global.ReplicaReaders = { kindOf, okFile, CHIP, extract, preparar, pptText };
})(window);
