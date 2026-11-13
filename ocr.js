/* Reconocimiento óptico de texto en el dispositivo (tesseract.js, spa+eng). */
(function (global) {
  "use strict";
  let workerPromise = null;
  let loadNote = "";

  function asset(path) {
    return new URL(path, document.baseURI).href;
  }

  async function ensureWorker(onProgress) {
    if (workerPromise) return workerPromise;
    workerPromise = (async () => {
      if (!global.Tesseract) {
        await new Promise((res, rej) => {
          const s = document.createElement("script");
          s.src = asset("vendor/tesseract/tesseract.min.js");
          s.onload = res;
          s.onerror = () => rej(new Error("No se pudo cargar Tesseract"));
          document.head.appendChild(s);
        });
      }
      if (onProgress) onProgress("Cargando el motor de reconocimiento de texto (español e inglés)…", 8);
      const w = await Tesseract.createWorker("spa+eng", 1, {
        workerPath: asset("vendor/tesseract/worker.min.js"),
        corePath: asset("vendor/tesseract/tesseract-core-simd-lstm.wasm.js"),
        langPath: asset("vendor/tessdata"),
        gzip: true,
        logger: m => {
          if (!onProgress || !m) return;
          if (m.status === "loading language traineddata") {
            loadNote = "Descargando el idioma (solo la primera vez; después queda en la caché)…";
            onProgress(loadNote, 15);
          } else if (m.status === "initializing api" || m.status === "initialized api") {
            onProgress("Preparando el reconocimiento de texto…", 30);
          } else if (m.status === "recognizing text" && m.progress != null) {
            onProgress("Leyendo el texto de la imagen…", 40 + Math.round(m.progress * 50));
          }
        }
      });
      return w;
    })();
    try {
      return await workerPromise;
    } catch (e) {
      workerPromise = null;
      throw e;
    }
  }

  async function recognize(blob, onProgress) {
    const w = await ensureWorker(onProgress);
    const r = await w.recognize(blob);
    const text = ((r && r.data && r.data.text) || "").trim();
    const conf = r && r.data && typeof r.data.confidence === "number" ? r.data.confidence : null;
    return { text, confidence: conf };
  }

  global.ReplicaOCR = { recognize, ensureWorker };
})(window);
