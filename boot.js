/* Registro de la PWA y parches de la réplica */
(function () {
  if ("serviceWorker" in navigator && !/[?&]nosw\b/.test(location.search)) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("./sw.js").catch(err => console.warn("SW", err));
    });
  }
  if (window.ReplicaPC && typeof ReplicaPC.install === "function") {
    ReplicaPC.install();
  }
})();
