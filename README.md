# Planificador de Boda

App web responsive para administrar proveedores, pagos y presupuesto de boda.

## Abrir localmente

Abre `index.html` en el navegador y usa la key:

```text
boda-2026
```

Tambien puedes abrirla con la key en la URL:

```text
index.html?key=boda-2026
```

## Estado actual

- Bienvenida y menu principal.
- Hub de proveedores por categoria con acordeones desplegables.
- Registro, edicion y eliminacion logica de proveedores.
- Calificacion de proveedores con estrellas para novio y novia.
- Hub de pagos programados y realizados.
- Registro, edicion y eliminacion logica de pagos.
- Presupuesto total editable y presupuesto maximo por categoria.
- Confirmacion de exito para operaciones.
- Reconfirmacion antes de eliminar.
- Persistencia local con `localStorage`.
- Sincronizacion opcional con Google Sheets mediante Apps Script.

## Google Apps Script

El archivo `google-apps-script/Code.gs` contiene una API simple para leer y escribir contra Google Sheets.

### Configuracion manual

1. Crea o abre el Google Sheet que usara la app como repositorio.
2. Copia el ID del spreadsheet desde la URL:

```text
https://docs.google.com/spreadsheets/d/SPREADSHEET_ID/edit
```

3. En Google Sheets, abre `Extensiones > Apps Script`.
4. Pega el contenido de `google-apps-script/Code.gs`.
5. Cambia estos parametros:

```js
SPREADSHEET_ID: "PASTE_YOUR_SPREADSHEET_ID_HERE",
APP_KEY: "boda-2026",
```

6. Despliega como Web App:

```text
Deploy > New deployment > Web app
Execute as: Me
Who has access: Anyone with the link
```

7. Copia la Web App URL generada.
8. Abre el front con ambos parametros:

```text
https://42571634-gif.github.io/pllanif_boda/?key=boda-2026&api=WEB_APP_URL
```

La key del front se envia al Apps Script. Si no coincide con `APP_KEY`, el script rechaza la operacion.

### Uso

- `Cargar desde Drive`: descarga `vendors`, `payments` y `budgets` desde Google Sheets.
- `Subir a Drive`: reemplaza esas tablas en Google Sheets con el estado local actual.
- Si no pasas `api=WEB_APP_URL`, la app conserva el modo local simulado con `localStorage`.
