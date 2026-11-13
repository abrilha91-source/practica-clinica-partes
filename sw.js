const C = "practica-clinica-partes-v1.0";
const A = [
  "./",
  "./index.html",
  "./styles.css",
  "./app.js",
  "./shim.js",
  "./import-export.js",
  "./boot.js",
  "./manifest.json",
  "./icon.svg",
  "./icon-192.png",
  "./icon-512.png",
  "./vendor/fonts.css",
  "./vendor/jszip.min.js",
  "./vendor/pdf.min.js",
  "./vendor/pdf.worker.min.js",
  "./vendor/xlsx.bundle.js",
  "./vendor/LICENSE-xlsx-js-style.txt"
];
self.addEventListener("install", e => {
  e.waitUntil((async () => {
    const cache = await caches.open(C);
    const fontCss = await fetch("./vendor/fonts.css").then(r => r.text()).catch(() => "");
    const fonts = [...fontCss.matchAll(/url\(([^)]+)\)/g)].map(m => {
      const u = m[1].replace(/['"]/g, "");
      return u.startsWith("http") ? null : new URL("vendor/" + u.replace(/^\.\//, ""), self.location).pathname.replace(/.*\/vendor\//, "./vendor/");
    }).filter(Boolean);
    // fonts.css uses url(fonts/xxx) relative to vendor/fonts.css
    const fontUrls = [...fontCss.matchAll(/url\(([^)]+)\)/g)].map(m => {
      const u = m[1].replace(/['"]/g, "");
      return "./vendor/" + u.replace(/^\.\//, "");
    });
    await cache.addAll([...A, ...fontUrls].filter((v, i, a) => a.indexOf(v) === i));
    self.skipWaiting();
  })());
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(k => Promise.all(k.filter(x => x !== C).map(x => caches.delete(x)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", e => {
  if (e.request.method !== "GET") return;
  const url = new URL(e.request.url);
  if (url.origin !== location.origin) return;
  e.respondWith(
    caches.match(e.request, { ignoreSearch: true }).then(r => r || fetch(e.request).then(n => {
      if (n.ok) {
        const cp = n.clone();
        caches.open(C).then(c => c.put(e.request, cp));
      }
      return n;
    }).catch(() => caches.match("./index.html")))
  );
});
