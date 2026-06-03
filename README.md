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
- Simulacion de carga/subida a Drive usando la key como namespace.

## Proximo paso tecnico

Conectar los botones `Cargar desde Drive` y `Subir a Drive` a una fuente real:

1. Google Apps Script como API sobre Google Sheets.
2. Google Sheets API con OAuth.
3. Export/import manual de JSON como puente temporal.
