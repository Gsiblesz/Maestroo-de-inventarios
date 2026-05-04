# CONTEO DE INVENTARIO FISICO (formulario independiente)

Formulario ligero para Vercel que envia datos a Google Sheets por medio de un Google Apps Script.

## Archivos
- `index.html`
- `styles.css`
- `main.js`
- `apps_script_maestro_inventario.gs`

## Estructura esperada en Google Sheets
- Hoja `COSTO MATERIA PRIMA`: columna A = CODIGO, columna B = ARTICULO.
- Hoja `FAMILIA`: columna A = FAMILIA (ejemplo: `PANADERIA`, `HOJALDRE`).
- Hoja `CONTEO DE INVENTARIO FISICO`: columnas destino:
  1. FECHA
  2. CODIGO
  3. INGREDIENTE
  4. UND PRINCIPAL (se deja en blanco)
  5. FAMILIA
  6. RESPONSABLE
  7. STOCK INICIAL

## Deploy manual en Google Apps Script
1. Abre el libro de Google Sheets.
2. Ve a `Extensiones > Apps Script`.
3. Crea/reemplaza el archivo con el contenido de `apps_script_maestro_inventario.gs`.
4. Guarda y despliega como Web App:
   - `Implementar > Nueva implementacion`
   - Tipo: `Aplicacion web`
   - Ejecutar como: tu cuenta
   - Acceso: `Cualquiera con el enlace`
5. Copia la URL `/exec` y pegala en `main.js` en `GAS_ENDPOINT`.
6. Vuelve a desplegar el front estatico.

## Endpoints usados por el front
- `GET ?mode=ingredientes`
- `GET ?mode=familias`
- `POST` con `responsable` e `items` (`fecha`, `codigo`, `articulo`, `familia`, `stockInicial`)
