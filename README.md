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

URL principal con Google Apps Script conectado:

```text
https://42571634-gif.github.io/pllanif_boda/?key=boda-2026
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
- Cache local con `localStorage` y cola de pendientes.
- Sincronizacion online-first con Google Sheets mediante Apps Script.

## Google Apps Script

El archivo `google-apps-script/Code.gs` contiene la API para leer y escribir contra Google Sheets.

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
8. Abre el front con la key:

```text
https://42571634-gif.github.io/pllanif_boda/?key=boda-2026
```

La URL del Web App usada por defecto en el modulo de sincronizacion es:

```text
https://script.google.com/macros/s/AKfycbxTnacdtk_tAOfp4rSVOkDFs-4gYSQunZtI8RHxkwTlQdXUw6s98w-_k0efp4kmTY6rMA/exec
```

Si necesitas usar otro Apps Script temporalmente, puedes sobreescribirlo con:

```text
https://42571634-gif.github.io/pllanif_boda/?key=boda-2026&api=WEB_APP_URL
```

La key del front se envia al Apps Script. Si no coincide con `APP_KEY`, el script rechaza la operacion.

### Uso

- Al ingresar a la app, descarga `vendors`, `payments` y `budgets` desde Google Sheets automaticamente.
- Al crear, editar o eliminar proveedores y pagos, sube solo ese registro.
- Al editar presupuestos, sube solo ese presupuesto.
- `Cargar desde Drive` fuerza una descarga completa y luego reintenta pendientes.
- `Subir a Drive` reintenta la cola y envia los registros locales por operaciones granulares; ya no debe usarse como reemplazo completo de tablas.
- Si Google falla, la app usa cache local y conserva una cola de pendientes para reintentar luego.
- Si quieres desactivar la API y trabajar en local, guarda `local`, `none` u `off` como URL de API.

### Importante al publicar cambios de backend

Actualizar este repositorio no cambia el Web App ya desplegado. Despues de modificar `google-apps-script/Code.gs`, hay que copiar el archivo al editor de Apps Script y crear un nuevo deployment o actualizar el deployment existente.
