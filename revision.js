/* Revisión de la práctica de las novedades ya guardadas (v1.2). Nada cambia hasta que la usuaria confirma. */
(function (G) {
  "use strict";
  function mostrar(out) {
    if (!out || !G.ReplicaBit) return;
    const PL = pracs();
    const lista = evs();
    const r = ReplicaBit.revisarGuardadas(lista, { practicas: PL, cadById: S.cad });
    const lab = id => { const p = S.prac.get(id); return p ? pracLabel({ id, ...p }, true) : "Sin práctica"; };
    const cad = id => { const c = S.cad.get(id); return c ? `${c.n} (${ANIO[c.a] || c.a} ${c.g || ""})` : "—"; };
    const filas = [
      ...r.reasignar.map(x => Object.assign({ grupo: "reasignar", elegida: x.nueva }, x)),
      ...r.decidir.map(x => Object.assign({ grupo: "decidir", elegida: "" }, x))
    ];
    if (!filas.length) {
      out.innerHTML = `<p class="notice">Revisé ${lista.length} novedades: todas están en una práctica del cadete y dentro de su periodo. Si las fechas de alguna práctica están mal, corrígelas primero y vuelve a revisar.</p>`;
      return;
    }
    const opts = x => `<option value="">— Dejar como está —</option>` + (x.candidatos || []).filter(id => id !== x.actual).map(id => `<option value="${id}" ${x.elegida === id ? "selected" : ""}>${esc(lab(id))}${x.sugerida === id ? " · en curso esa fecha" : ""}</option>`).join("");
    const row = (x, i) => `<tr data-ri="${i}"><td>${esc(cad(x.c))}</td><td>${fCorta(x.f)}</td><td>${esc(TIPO_TXT[x.t] || x.t)}</td><td>${esc(lab(x.actual))}<span class="sub">${esc(x.motivo)}</span></td>
      <td><select class="rv">${opts(x)}</select>${x.grupo === "reasignar" ? `<span class="sub">${esc(x.regla)}</span>` : x.sugerida ? `<span class="sub">Sugerencia: la única práctica del cadete en curso esa fecha. Elige tú.</span>` : ""}</td></tr>`;
    const head = `<thead><tr><th>Cadete</th><th>Fecha</th><th>Tipo</th><th>Práctica actual</th><th>Pasar a</th></tr></thead>`;
    const nR = r.reasignar.length, nD = r.decidir.length;
    out.innerHTML = `<p class="notice">Revisé ${lista.length} novedades. ${nR ? `${nR} se pueden pasar a la práctica que dice su texto.` : ""} ${nD ? `${nD} necesitan que elijas la práctica.` : ""} Nada cambia hasta que oprimas «Guardar cambios».</p>
      ${nR ? `<h3 style="border:0;padding:0;margin-top:10px">Se pueden reasignar (${nR})</h3><div class="tscroll"><table class="tbl" style="min-width:820px">${head}<tbody>${filas.map((x, i) => x.grupo === "reasignar" ? row(x, i) : "").join("")}</tbody></table></div>` : ""}
      ${nD ? `<h3 style="border:0;padding:0;margin-top:10px">Por decidir (${nD})</h3>${r.decidir.some(x => x.sugerida) ? `<div class="acts" style="justify-content:flex-start;margin:6px 0"><button class="btn ghost" type="button" id="rvsug">Usar las sugerencias</button></div>` : ""}<div class="tscroll"><table class="tbl" style="min-width:820px">${head}<tbody>${filas.map((x, i) => x.grupo === "decidir" ? row(x, i) : "").join("")}</tbody></table></div>` : ""}
      <div class="acts" style="justify-content:flex-start;margin-top:10px"><button class="btn ghost" type="button" id="rvcan">Cerrar</button><button class="btn" type="button" id="rvok">Guardar cambios</button></div>`;
    out.querySelectorAll("tr[data-ri]").forEach(tr => { const x = filas[+tr.dataset.ri]; tr.querySelector(".rv").onchange = e => { x.elegida = e.target.value; }; });
    const sug = out.querySelector("#rvsug");
    if (sug) sug.onclick = () => { filas.forEach((x, i) => { if (x.grupo === "decidir" && x.sugerida) { x.elegida = x.sugerida; const s = out.querySelector(`tr[data-ri="${i}"] .rv`); if (s) s.value = x.sugerida; } }); toast("Sugerencias marcadas; revisa y guarda"); };
    out.querySelector("#rvcan").onclick = () => { out.innerHTML = ""; };
    out.querySelector("#rvok").onclick = async () => {
      const cambios = filas.filter(x => x.elegida && x.elegida !== x.actual && S.ev.has(x.id));
      if (!cambios.length) { toast("No elegiste ningún cambio"); return; }
      if (!confirm(`Se pasarán ${cambios.length} novedad(es) a la práctica elegida. ¿Continuar?`)) return;
      for (const x of cambios) {
        const e = Object.assign({}, S.ev.get(x.id), { p: x.elegida, ra: x.grupo === "reasignar" ? "revisión: " + x.regla : "revisión: elegida por ti", pAntes: x.actual });
        await put("eventos", x.id, e, true);
      }
      render();
      toast(`${cambios.length} novedad(es) cambiadas de práctica`);
    };
  }
  G.ReplicaRev = { mostrar };
})(window);
