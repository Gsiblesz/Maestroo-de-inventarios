// Web App for Maestro de Inventario
// - GET ?mode=ingredientes -> returns list from sheet COSTO MATERIA PRIMA (codigo + articulo)
// - POST body { items: [{ fecha, codigo, articulo, stockInicial }] } -> appends rows into CONTEO DE INVENTARIO FISICO

const SPREADSHEET_ID = "1MQlP9wx199xW-gIYwf4FcjdANG9TLEkSjORiNmxJH5s"; // ID del libro
const SOURCE_SHEET = "COSTO MATERIA PRIMA";
const TARGET_SHEET = "CONTEO DE INVENTARIO FISICO"; // pestaña donde se guardan las respuestas

function doGet(e) {
  const mode = (e && e.parameter && e.parameter.mode) || "";
  if (mode === "ingredientes") {
    const items = getIngredientes();
    return json({ status: "ok", items });
  }
  return json({ status: "ok", message: "Maestro de Inventario" });
}

function doOptions() {
  return ContentService.createTextOutput("");
}

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents || "{}");
    const responsable = (body.responsable || "").toString().trim();
    const items = Array.isArray(body.items) ? body.items : [];

    if (!responsable) {
      return json({ status: "error", message: "Responsable requerido" }, 400);
    }

    if (!items.length) {
      return json({ status: "error", message: "Sin items" }, 400);
    }

    const ss = getSpreadsheet();
    const target = ss.getSheetByName(TARGET_SHEET) || ss.insertSheet(TARGET_SHEET);

    // mapa para validar/obtener articulo desde el codigo
    const sourceMap = buildSourceMap();

    const rows = items.map((item) => {
      const fechaRaw = (item.fecha || "").toString().trim();
      const codigo = (item.codigo || "").trim();
      const articulo = (item.articulo || sourceMap[codigo] || "").trim();
      const stockInicial = Number(item.stockInicial);

      if (!fechaRaw) {
        throw new Error("Fecha requerida");
      }
      // Espera formato YYYY-MM-DD
      if (!/^\d{4}-\d{2}-\d{2}$/.test(fechaRaw)) {
        throw new Error("Fecha invalida");
      }
      const fecha = new Date(`${fechaRaw}T00:00:00`);
      if (isNaN(fecha.getTime())) {
        throw new Error("Fecha invalida");
      }

      if (!codigo) {
        throw new Error("Codigo requerido");
      }
      if (!articulo) {
        throw new Error("Articulo no encontrado");
      }
      if (Number.isNaN(stockInicial) || stockInicial < 0) {
        throw new Error("Stock inicial invalido");
      }

      // Columns: A=FECHA, B=CODIGO, C=INGREDIENTE, D=UND PRINCIPAL (leave blank), E=RESPONSABLE, F=STOCK
      return [fecha, codigo, articulo, "", responsable, stockInicial];
    });

    target.getRange(target.getLastRow() + 1, 1, rows.length, rows[0].length).setValues(rows);

    return json({ status: "ok", message: `Se registraron ${rows.length} fila(s).` });
  } catch (err) {
    return json({ status: "error", message: err.message || "Error" }, 500);
  }
}

function getIngredientes() {
  const sheet = getSpreadsheet().getSheetByName(SOURCE_SHEET);
  if (!sheet) return [];
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  const values = sheet.getRange(2, 1, lastRow - 1, 2).getValues(); // col A codigo, col B articulo
  const seen = {};
  return values
    .map((row) => ({
      code: (row[0] || "").toString().trim(),
      name: (row[1] || "").toString().trim(),
    }))
    .filter((r) => r.code && r.name)
    .filter((r) => {
      const upCode = r.code.toUpperCase();
      const upName = r.name.toUpperCase();
      return upCode !== "CODIGO" && upName !== "ARTICULO";
    })
    .filter((r) => {
      if (seen[r.code]) return false;
      seen[r.code] = true;
      return true;
    })
    .sort((a, b) => a.code.localeCompare(b.code));
}

function buildSourceMap() {
  const list = getIngredientes();
  return list.reduce((acc, item) => {
    acc[item.code] = item.name;
    return acc;
  }, {});
}

function getSpreadsheet() {
  if (SPREADSHEET_ID) {
    return SpreadsheetApp.openById(SPREADSHEET_ID);
  }
  return SpreadsheetApp.getActive();
}

function json(payload, code) {
  const out = ContentService.createTextOutput(JSON.stringify(payload));
  out.setMimeType(ContentService.MimeType.JSON);
  if (code) out.setResponseCode(code);
  return out;
}
