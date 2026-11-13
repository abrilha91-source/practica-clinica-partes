/* Transcripción de audio en el dispositivo. Intenta Whisper tiny (transformers.js),
   cargado solo al usarse (~40–80 MB la primera vez, luego queda en caché).
   Si no es viable, el audio se guarda adjunto y se explica en pantalla. */
(function (global) {
  "use strict";
  const MODEL = "Xenova/whisper-tiny";
  let pipePromise = null;
  let lastError = null;

  function usable() {
    return typeof Promise !== "undefined" && (typeof window.AudioContext !== "undefined" || typeof window.webkitAudioContext !== "undefined");
  }

  async function loadPipeline(onProgress) {
    if (pipePromise) return pipePromise;
    pipePromise = (async () => {
      if (onProgress) onProgress("Cargando el transcriptor de audio (Whisper tiny, primera vez ~40–80 MB)…", 5);
      const mod = await import("https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2");
      const { pipeline, env } = mod;
      env.allowLocalModels = false;
      env.useBrowserCache = true;
      const rec = await pipeline("automatic-speech-recognition", MODEL, {
        quantized: true,
        progress_callback: ev => {
          if (!onProgress || !ev) return;
          if (ev.status === "progress" && ev.total) {
            const pct = Math.min(70, 8 + Math.round((ev.loaded / ev.total) * 60));
            onProgress("Descargando el modelo de transcripción… " + Math.round(ev.loaded / 1048576) + " MB", pct);
          } else if (ev.status === "ready") onProgress("Modelo listo. Transcribiendo…", 75);
        }
      });
      return rec;
    })();
    try {
      return await pipePromise;
    } catch (e) {
      pipePromise = null;
      lastError = e;
      throw e;
    }
  }

  async function transcribe(file, onProgress) {
    if (!usable()) {
      return { text: "", stored: true, reason: "Este navegador no puede transcribir audio." };
    }
    try {
      const rec = await loadPipeline(onProgress);
      if (onProgress) onProgress("Transcribiendo el audio en el dispositivo…", 80);
      const url = URL.createObjectURL(file);
      try {
        const out = await rec(url, { language: "spanish", task: "transcribe" });
        const text = (out && (out.text || (Array.isArray(out) && out.map(x => x.text).join(" ")))) || "";
        return { text: String(text).trim(), engine: "whisper-tiny", stored: true };
      } finally {
        URL.revokeObjectURL(url);
      }
    } catch (e) {
      lastError = e;
      console.warn("transcribe", e);
      return {
        text: "",
        stored: true,
        reason: "No se pudo transcribir el audio en este dispositivo (el modelo es pesado o no llegó a cargarse). El archivo se guarda en la bitácora para consultarlo después.",
        error: String(e && e.message || e)
      };
    }
  }

  global.ReplicaTranscribe = { transcribe, lastError: () => lastError, model: MODEL };
})(window);
