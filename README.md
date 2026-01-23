# Conteo de Inventario Físico (formulario independiente)

Formulario ligero para Vercel que envía los datos (fecha, ingrediente y cantidad) a un Google Sheet a través de un Google Apps Script.

## Archivos
- index.html
- styles.css
- main.js

## Configuración del Apps Script
1. Abre el Sheet: https://docs.google.com/spreadsheets/d/1MQlP9wx199xW-gIYwf4FcjdANG9TLEkSjORiNmxJH5s/edit#gid=830182429
2. Extensiones > Apps Script y pega el siguiente código en un archivo (por ejemplo `MaestroInventario.gs`).
3. Ajusta `TARGET_SHEET` si quieres usar otra pestaña (recomendado crear una hoja llamada "MAESTRO DE INVENTARIO" para las respuestas). La pestaña con precios base se llama "COSTO MATERIA PRIMA" y no se altera.
4. Implementa > Nueva implementación > Tipo Web App > Ejecutar como: Tu cuenta > Quién tiene acceso: Cualquiera con el enlace. Copia la URL de despliegue.

```gs
const TARGET_SHEET = "MAESTRO DE INVENTARIO"; // Crea esta pestaña en el mismo libro

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents || "{}");
    const ingrediente = (body.ingrediente || "").trim();
    const stockInicial = Number(body.stockInicial);

    if (!ingrediente) {
      return _json({ status: "error", message: "Ingrediente requerido" }, 400);
    }
    if (Number.isNaN(stockInicial) || stockInicial < 0) {
      return _json({ status: "error", message: "Stock inicial invalido" }, 400);
    }

    const ss = SpreadsheetApp.getActive();
    const sheet = ss.getSheetByName(TARGET_SHEET) || ss.insertSheet(TARGET_SHEET);

    const timestamp = new Date();
    const user = Session.getActiveUser().getEmail() || "public";
    sheet.appendRow([timestamp, ingrediente, stockInicial, user]);

    return _json({ status: "ok" });
  } catch (err) {
    return _json({ status: "error", message: err.message || "Error interno" }, 500);
  }
}

function doGet() {
  return _json({ status: "ok", message: "Maestro de Inventario" });
}

function _json(obj, code) {
  const output = ContentService.createTextOutput(JSON.stringify(obj));
  output.setMimeType(ContentService.MimeType.JSON);
  if (code) {
    output.setResponseCode(code);
  }
  return output;
}
```

## Conectar el front con el Apps Script
1. En `main.js` reemplaza `https://script.google.com/macros/s/DEPLOYMENT_ID/exec` por la URL web de tu despliegue.
2. Sube estos tres archivos a Vercel como proyecto estatico (no requiere build). Ejemplo:
   ```bash
   npm i -g vercel
   vercel deploy --prod
   ```
3. Prueba el formulario en la URL de Vercel y confirma que las filas se agregan al Sheet (pestaña `MAESTRO DE INVENTARIO`).

## Campos que se registran
- Fecha/hora (servidor de Apps Script)
- Ingrediente (texto tal como lo escribe el usuario)
- Stock inicial (numero)
- Usuario que envía (correo si el ejecutor tiene sesion en Google; de lo contrario "public")

## Notas
- Si quieres forzar la coincidencia con la hoja "COSTO MATERIA PRIMA", agrega una validacion que compare `ingrediente` con esa lista antes de `appendRow`.
- Si ves errores de CORS, confirma que el Web App este en "Cualquiera con el enlace" y que la peticion sea POST a la URL `/exec`.
