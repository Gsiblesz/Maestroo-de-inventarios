// Web App for Maestro de Inventario
// - GET ?mode=ingredientes -> returns list from sheet COSTO MATERIA PRIMA (codigo + articulo)
// - GET ?mode=familias -> returns list from sheet FAMILIA
// - POST body { items: [{ codigo, articulo, familia, stockInicial }] } -> appends rows into CONTEO DE INVENTARIO FISICO

const SPREADSHEET_ID = "1MQlP9wx199xW-gIYwf4FcjdANG9TLEkSjORiNmxJH5s"; // ID del libro
const SOURCE_SHEET = "COSTO MATERIA PRIMA";
const TARGET_SHEET = "CONTEO DE INVENTARIO FISICO"; // pestana donde se guardan las respuestas
const FAMILY_SHEET = "FAMILIA";

function doGet(e) {
  const mode = (e && e.parameter && e.parameter.mode) || "";
  if (mode === "ingredientes") {
    const items = getIngredientes();
    return json({ status: "ok", items });
  }
  if (mode === "familias") {
    const items = getFamilias();
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
    const familySet = buildFamilySet();

    const rows = items.map((item) => {
      const codigo = (item.codigo || "").trim();
      const articulo = (item.articulo || sourceMap[codigo] || "").trim();
      const familia = (item.familia || "").toString().trim();
      const stockInicial = Number(item.stockInicial);

      if (!codigo) {
        throw new Error("Codigo requerido");
      }
      if (!articulo) {
        throw new Error("Articulo no encontrado");
      }
      if (!familia) {
        throw new Error("Familia requerida");
      }
      if (!familySet[familia.toUpperCase()]) {
        throw new Error(`Familia invalida: ${familia}`);
      }
      if (Number.isNaN(stockInicial) || stockInicial < 0) {
        throw new Error("Stock inicial invalido");
      }

      // Columns: A=FECHA, B=CODIGO, C=INGREDIENTE, D=UND PRINCIPAL (leave blank), E=FAMILIA, F=RESPONSABLE, G=STOCK
      return [new Date(), codigo, articulo, "", familia, responsable, stockInicial];
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

function getFamilias() {
  const sheet = getSpreadsheet().getSheetByName(FAMILY_SHEET);
  if (!sheet) return [];
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  const values = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
  const seen = {};
  return values
    .map((row) => (row[0] || "").toString().trim())
    .filter((name) => name)
    .filter((name) => name.toUpperCase() !== "FAMILIA")
    .filter((name) => {
      const key = name.toUpperCase();
      if (seen[key]) return false;
      seen[key] = true;
      return true;
    })
    .sort((a, b) => a.localeCompare(b));
}

function buildSourceMap() {
  const list = getIngredientes();
  return list.reduce((acc, item) => {
    acc[item.code] = item.name;
    return acc;
  }, {});
}

function buildFamilySet() {
  const list = getFamilias();
  return list.reduce((acc, item) => {
    acc[item.toUpperCase()] = true;
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
