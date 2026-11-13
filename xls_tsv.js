/* Hoja de Excel → texto con tabuladores, rellenando celdas combinadas y fechas en AAAA-MM-DD. */
(function (G) {
  "use strict";
  const pad = n => String(n).padStart(2, "0");
  function sheetToTsv(X, ws) {
    if (!ws || !ws["!ref"]) return "";
    const R = X.utils.decode_range(ws["!ref"]);
    const val = {};
    const key = (r, c) => r + ":" + c;
    for (let r = R.s.r; r <= R.e.r; r++) for (let c = R.s.c; c <= R.e.c; c++) {
      const cell = ws[X.utils.encode_cell({ r, c })];
      if (!cell) continue;
      let t = "";
      if (cell.v instanceof Date && !isNaN(cell.v)) t = `${cell.v.getFullYear()}-${pad(cell.v.getMonth() + 1)}-${pad(cell.v.getDate())}`;
      else if (cell.t === "n" && cell.z && X.SSF && X.SSF.is_date && X.SSF.is_date(cell.z)) {
        const d = X.SSF.parse_date_code(cell.v); t = d ? `${d.y}-${pad(d.m)}-${pad(d.d)}` : String(cell.w || cell.v);
      } else t = cell.w != null ? String(cell.w) : String(cell.v == null ? "" : cell.v);
      val[key(r, c)] = t.replace(/[\t\r\n]+/g, " ").trim();
    }
    (ws["!merges"] || []).forEach(m => {
      const top = val[key(m.s.r, m.s.c)] || "";
      if (!top) return;
      const wide = m.e.c > m.s.c;
      for (let r = m.s.r; r <= m.e.r; r++) for (let c = m.s.c; c <= m.e.c; c++) {
        if (r === m.s.r && c === m.s.c) continue;
        /* combinadas a lo ancho (títulos): solo la primera celda; a lo alto: se repite el valor */
        if (wide && c > m.s.c) continue;
        if (!val[key(r, c)]) val[key(r, c)] = top;
      }
    });
    const lines = [];
    for (let r = R.s.r; r <= R.e.r; r++) {
      const row = [];
      for (let c = R.s.c; c <= R.e.c; c++) row.push(val[key(r, c)] || "");
      while (row.length && !row[row.length - 1]) row.pop();
      if (row.length) lines.push(row.join("\t"));
    }
    return lines.join("\n");
  }
  function workbookText(X, wb) {
    return wb.SheetNames.map(n => "## Hoja: " + n + "\n" + sheetToTsv(X, wb.Sheets[n])).join("\n\n");
  }
  G.ReplicaXlsTsv = { sheetToTsv, workbookText };
  if (typeof module !== "undefined" && module.exports) module.exports = G.ReplicaXlsTsv;
})(typeof window !== "undefined" ? window : globalThis);
