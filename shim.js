/* Almacenamiento local con la misma forma de window.claude.use
   (db, downloads, assets, sample) para que la app original funcione sin Claude. */
(function (global) {
  "use strict";
  const DB_NAME = "practica-clinica-partes";
  const DB_VER = 1;
  const assetUrls = new Map();
  let idbPromise = null;
  let dbApi = null;

  function reqp(req) {
    return new Promise((res, rej) => {
      req.onsuccess = () => res(req.result);
      req.onerror = () => rej(req.error);
    });
  }

  function openDB() {
    if (idbPromise) return idbPromise;
    idbPromise = new Promise((res, rej) => {
      const r = indexedDB.open(DB_NAME, DB_VER);
      r.onupgradeneeded = () => {
        const db = r.result;
        if (!db.objectStoreNames.contains("docs")) {
          const s = db.createObjectStore("docs", { keyPath: "path" });
          s.createIndex("col", "col", { unique: false });
        }
        if (!db.objectStoreNames.contains("assets")) {
          db.createObjectStore("assets", { keyPath: "id" });
        }
      };
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
    return idbPromise;
  }

  function clone(o) {
    return o == null ? o : JSON.parse(JSON.stringify(o));
  }

  function createDb(idb) {
    const listeners = new Map(); // col -> Set of fn

    function listen(col, fn) {
      if (!listeners.has(col)) listeners.set(col, new Set());
      listeners.get(col).add(fn);
      return () => listeners.get(col) && listeners.get(col).delete(fn);
    }

    async function allOf(col) {
      const db = await openDB();
      const tx = db.transaction("docs", "readonly");
      const idx = tx.objectStore("docs").index("col");
      const rows = await reqp(idx.getAll(col));
      return rows;
    }

    async function getPath(path) {
      const db = await openDB();
      return reqp(db.transaction("docs", "readonly").objectStore("docs").get(path));
    }

    async function putDoc(col, id, data) {
      const db = await openDB();
      const rec = { path: col + "/" + id, col, id, data: clone(data) };
      await reqp(db.transaction("docs", "readwrite").objectStore("docs").put(rec));
      await notify(col);
    }

    async function delDoc(col, id) {
      const db = await openDB();
      await reqp(db.transaction("docs", "readwrite").objectStore("docs").delete(col + "/" + id));
      await notify(col);
    }

    async function notify(col) {
      const set = listeners.get(col);
      if (!set || !set.size) return;
      if (col === "ajustes") {
        const row = await getPath("ajustes/general");
        const snap = { exists: !!(row && row.data), data: () => clone(row && row.data) };
        set.forEach(fn => { try { fn(snap); } catch (e) { console.error(e); } });
        return;
      }
      const rows = await allOf(col);
      const snap = {
        docs: rows.map(r => ({ id: r.id, data: () => clone(r.data) }))
      };
      set.forEach(fn => { try { fn(snap); } catch (e) { console.error(e); } });
    }

    function colApi(col) {
      return {
        doc(id) {
          return {
            set: data => putDoc(col, id, data),
            delete: () => delDoc(col, id)
          };
        },
        onSnapshot(ok, err) {
          const fn = snap => ok && ok(snap);
          const unsub = listen(col, fn);
          allOf(col).then(rows => {
            fn({ docs: rows.map(r => ({ id: r.id, data: () => clone(r.data) })) });
          }).catch(e => { console.error(e); if (err) err(e); });
          return unsub;
        }
      };
    }

    return {
      collection: colApi,
      doc(path) {
        const i = path.indexOf("/");
        const col = i < 0 ? path : path.slice(0, i);
        const id = i < 0 ? path : path.slice(i + 1);
        return {
          set: data => putDoc(col, id, data),
          delete: () => delDoc(col, id),
          onSnapshot(ok, err) {
            const fn = snap => ok && ok(snap);
            const unsub = listen(col, fn);
            getPath(col + "/" + id).then(row => {
              fn({ exists: !!(row && row.data), data: () => clone(row && row.data) });
            }).catch(e => { console.error(e); if (err) err(e); });
            return unsub;
          }
        };
      },
      /* helpers for import/export */
      async _all(col) { return allOf(col); },
      async _clear(col) {
        const rows = await allOf(col);
        const db = await openDB();
        const tx = db.transaction("docs", "readwrite");
        const st = tx.objectStore("docs");
        for (const r of rows) st.delete(r.path);
        await new Promise((res, rej) => { tx.oncomplete = res; tx.onerror = () => rej(tx.error); });
        await notify(col);
      },
      async _putSilent(col, id, data) {
        const db = await openDB();
        const rec = { path: col + "/" + id, col, id, data: clone(data) };
        await reqp(db.transaction("docs", "readwrite").objectStore("docs").put(rec));
      },
      async _notify(col) { return notify(col); },
      async _bulk(items) {
        const db = await openDB();
        const tx = db.transaction("docs", "readwrite");
        const st = tx.objectStore("docs");
        for (const it of items) {
          st.put({ path: it.col + "/" + it.id, col: it.col, id: it.id, data: clone(it.data) });
        }
        await new Promise((res, rej) => { tx.oncomplete = res; tx.onerror = () => rej(tx.error); });
      }
    };
  }

  const downloads = {
    async save({ filename, data }) {
      const blob = data instanceof Blob ? data : new Blob([data]);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename || "descarga";
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
    }
  };

  async function storeAsset(blob, opts) {
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
    const type = (opts && opts.type) || blob.type || "application/octet-stream";
    const rec = { id, blob, type, name: (opts && opts.name) || blob.name || "", at: new Date().toISOString() };
    const db = await openDB();
    await reqp(db.transaction("assets", "readwrite").objectStore("assets").put(rec));
    const url = URL.createObjectURL(blob);
    assetUrls.set(id, url);
    return { id, url };
  }

  async function urlFor(id) {
    if (assetUrls.has(id)) return assetUrls.get(id);
    const db = await openDB();
    const rec = await reqp(db.transaction("assets", "readonly").objectStore("assets").get(id));
    if (!rec || !rec.blob) return "";
    const url = URL.createObjectURL(rec.blob);
    assetUrls.set(id, url);
    return url;
  }

  const assets = {
    upload: (blob, opts) => storeAsset(blob, opts),
    urlFor
  };

  const sample = {
    async limits() {
      /* Sin OCR: no se envían fotos. El texto de PDF/Excel/Word sí se lee. */
      return { maxPromptBytes: 400000, images: null };
    },
    async json(prompt, opts) {
      if (global.ReplicaPC && typeof ReplicaPC.parseBitacora === "function") {
        return ReplicaPC.parseBitacora(prompt, opts);
      }
      return {
        eventos: [],
        filas: [],
        notas: "El lector local todavía no está listo. Pega el texto o captura los datos en Parte del día."
      };
    }
  };

  async function ready() {
    const idb = await openDB();
    if (!dbApi) dbApi = createDb(idb);
    return dbApi;
  }

  global.claude = {
    async use(name) {
      if (name === "db") return ready();
      if (name === "downloads") return downloads;
      if (name === "assets") return assets;
      if (name === "sample") return sample;
      return null;
    }
  };
  global.__replicaAssets = { urlFor, storeAsset, assetUrls };
})(window);
