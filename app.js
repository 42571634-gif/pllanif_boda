const ACCESS_KEY = "boda-2026";
const STORAGE_PREFIX = "weddingPlanner";

const categories = [
  { id: "cat_local", name: "Local" },
  { id: "cat_entertainment", name: "Entretenimiento" },
  { id: "cat_food_bar", name: "Comida y bar" },
  { id: "cat_furniture", name: "Mobiliario" },
  { id: "cat_security", name: "Seguridad" },
  { id: "cat_wedding_planner", name: "Wedding planner" },
  { id: "cat_other", name: "Otros" },
];

const vendorStatuses = [
  { value: "pending_contact", label: "Pendiente contactar", className: "warn" },
  { value: "quoted", label: "Cotizado", className: "" },
  { value: "rejected", label: "Denegado", className: "danger" },
  { value: "approved", label: "Aprobado", className: "ok" },
];

const paymentStatuses = [
  { value: "scheduled", label: "Programado", className: "warn" },
  { value: "paid", label: "Realizado", className: "ok" },
  { value: "voided", label: "Anulado", className: "danger" },
];

const paymentMethods = [
  ["cash", "Efectivo"],
  ["bank_transfer", "Transferencia"],
  ["yape", "Yape"],
  ["plin", "Plin"],
  ["card", "Tarjeta"],
  ["other", "Otro"],
];

const seedData = {
  vendors: [
    {
      id: "vendor_sample_001",
      category_id: "cat_local",
      name: "Ejemplo Local Miraflores",
      description_rich: "Salon principal, terraza y estacionamiento.",
      status: "quoted",
      price_min: 12000,
      price_max: 18000,
      currency: "PEN",
      social_url_1: "https://instagram.com/ejemplo",
      social_url_2: "",
      phone_local: "987654321",
      country_code: "+51",
      website_url: "https://ejemplo-local.pe",
      notes: "Pedir contrato y restricciones de ruido.",
      groom_rating: 3,
      bride_rating: 4,
      is_deleted: false,
      updated_at: new Date().toISOString(),
    },
    {
      id: "vendor_sample_002",
      category_id: "cat_food_bar",
      name: "Ejemplo Catering & Bar",
      description_rich: "Menu degustacion pendiente. Opciones vegetarianas.",
      status: "approved",
      price_min: 15000,
      price_max: 22000,
      currency: "PEN",
      social_url_1: "",
      social_url_2: "",
      phone_local: "912345678",
      country_code: "+51",
      website_url: "",
      notes: "Solicita adelanto de 30%.",
      groom_rating: 4,
      bride_rating: 5,
      is_deleted: false,
      updated_at: new Date().toISOString(),
    },
  ],
  payments: [
    {
      id: "payment_sample_001",
      vendor_id: "vendor_sample_002",
      payment_type: "vendor",
      category_id: "cat_food_bar",
      concept: "Adelanto catering",
      description: "Primer adelanto del proveedor aprobado.",
      amount: 4500,
      currency: "PEN",
      payment_date: "2026-07-15",
      method: "bank_transfer",
      status: "paid",
      receipt_url: "",
      is_deleted: false,
      updated_at: new Date().toISOString(),
    },
    {
      id: "payment_sample_002",
      vendor_id: "",
      payment_type: "admin",
      category_id: "cat_other",
      concept: "Separacion municipal",
      description: "Pago administrativo no asociado a proveedor.",
      amount: 350,
      currency: "PEN",
      payment_date: "2026-07-20",
      method: "yape",
      status: "scheduled",
      receipt_url: "",
      is_deleted: false,
      updated_at: new Date().toISOString(),
    },
  ],
  budgets: [
    { id: "budget_global_001", budget_type: "global", category_id: "", amount: 50000, currency: "PEN" },
    { id: "budget_cat_local", budget_type: "category", category_id: "cat_local", amount: 14000, currency: "PEN" },
    { id: "budget_cat_entertainment", budget_type: "category", category_id: "cat_entertainment", amount: 6000, currency: "PEN" },
    { id: "budget_cat_food_bar", budget_type: "category", category_id: "cat_food_bar", amount: 18000, currency: "PEN" },
    { id: "budget_cat_furniture", budget_type: "category", category_id: "cat_furniture", amount: 7000, currency: "PEN" },
    { id: "budget_cat_security", budget_type: "category", category_id: "cat_security", amount: 1500, currency: "PEN" },
    { id: "budget_cat_wedding_planner", budget_type: "category", category_id: "cat_wedding_planner", amount: 3000, currency: "PEN" },
    { id: "budget_cat_other", budget_type: "category", category_id: "cat_other", amount: 500, currency: "PEN" },
  ],
  sync: { lastSyncAt: "", remoteKey: "" },
};

let state = migrateState(loadState());
let route = "home";
let filters = {
  vendorSearch: "",
  vendorCategory: "all",
  paymentStatus: "all",
  openCategories: {},
};

const app = document.getElementById("app");
const modalRoot = document.getElementById("modal-root");

init();

function init() {
  const url = new URL(window.location.href);
  const key = url.searchParams.get("key");
  if (key !== ACCESS_KEY) {
    renderLocked(key);
    return;
  }
  state.sync.remoteKey = key;
  saveState();
  renderApp();
}

function renderLocked(attemptedKey) {
  app.innerHTML = `
    <main class="locked">
      <section class="access-panel">
        <p class="kicker">Acceso privado</p>
        <h1>Planificador de Boda</h1>
        <p>Ingresa la llave del enlace para abrir la app y preparar la sincronizacion con Drive.</p>
        <form id="access-form" class="grid">
          <label class="field">
            <span>Key de acceso</span>
            <input name="key" type="password" autocomplete="off" value="${escapeHtml(attemptedKey || "")}" />
          </label>
          <div class="error">${attemptedKey ? "La key no coincide con esta app." : ""}</div>
          <button class="btn" type="submit">Abrir app</button>
          <div class="hint">Para esta primera version local usa <strong>${ACCESS_KEY}</strong>. Luego esta llave puede mapearse al archivo de Google Sheets.</div>
        </form>
      </section>
    </main>
  `;
  document.getElementById("access-form").addEventListener("submit", (event) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const nextUrl = new URL(window.location.href);
    nextUrl.searchParams.set("key", data.get("key").trim());
    window.location.href = nextUrl.toString();
  });
}

function renderApp() {
  app.innerHTML = `
    <div class="main-layout">
      <aside class="sidebar">
        <div class="brand">
          <strong>Nuestra boda</strong>
          <span>Datos locales + Drive</span>
        </div>
        <nav class="nav">
          ${navButton("home", "Inicio")}
          ${navButton("vendorsHub", "Proveedores")}
          ${navButton("paymentsHub", "Pagos")}
          ${navButton("budget", "Presupuesto")}
        </nav>
        <div class="sync-box">
          <button class="btn secondary" data-action="load-google">Cargar desde Drive</button>
          <button class="btn secondary" data-action="save-google">Subir a Drive</button>
          <small>${state.sync.lastSyncAt ? `Ultima sincronizacion: ${formatDateTime(state.sync.lastSyncAt)}` : "Sin sincronizacion remota todavia."}</small>
        </div>
      </aside>
      <main class="content">${renderRoute()}</main>
    </div>
  `;

  document.querySelectorAll("[data-route]").forEach((button) => {
    button.addEventListener("click", () => {
      route = button.dataset.route;
      renderApp();
    });
  });
  document.querySelectorAll("[data-action]").forEach((button) => {
    button.addEventListener("click", () => handleAction(button.dataset.action, button.dataset.id));
  });
  bindFilters();
}

function navButton(id, label) {
  return `<button class="${route === id ? "active" : ""}" data-route="${id}" title="${label}">${label}</button>`;
}

function renderRoute() {
  if (route === "vendorsHub") return renderVendorsHub();
  if (route === "paymentsHub") return renderPaymentsHub();
  if (route === "budget") return renderBudget();
  return renderHome();
}

function renderHome() {
  const vendors = active(state.vendors);
  const payments = active(state.payments);
  const paid = payments.filter((payment) => payment.status === "paid");
  const scheduled = payments.filter((payment) => payment.status === "scheduled");
  return `
    ${topbar("Bienvenida", "Menu de opciones", "Un punto de entrada simple para revisar proveedores, pagos y presupuesto antes de sincronizar con Google Drive.")}
    <section class="grid summary-grid">
      ${metric("Proveedores activos", vendors.length)}
      ${metric("Aprobados", vendors.filter((vendor) => vendor.status === "approved").length)}
      ${metric("Pagos realizados", money(sum(paid, "amount")))}
      ${metric("Pagos programados", money(sum(scheduled, "amount")))}
    </section>
    <section class="grid home-grid" style="margin-top: 18px;">
      ${menuCard("Proveedores", "Revisar resumen por categoria, estados y registrar opciones nuevas.", "vendorsHub")}
      ${menuCard("Pagos", "Administrar pagos programados, realizados y gastos administrativos.", "paymentsHub")}
      ${menuCard("Presupuesto", "Comparar uso por categoria y editar montos maximos.", "budget")}
    </section>
  `;
}

function renderVendorsHub() {
  const visible = active(state.vendors).filter((vendor) => {
    const searchOk = !filters.vendorSearch || vendor.name.toLowerCase().includes(filters.vendorSearch.toLowerCase());
    const categoryOk = filters.vendorCategory === "all" || vendor.category_id === filters.vendorCategory;
    return searchOk && categoryOk;
  });

  return `
    ${topbar("Hub Proveedores", "Resumen por categoria", "Cada categoria se despliega para revisar sus proveedores y editar registros sin salir del hub.", `<button class="btn" data-action="new-vendor">Nuevo proveedor</button>`)}
    <div class="toolbar">
      <div class="filters">
        <input id="vendor-search" placeholder="Buscar proveedor" value="${escapeHtml(filters.vendorSearch)}" />
        <select id="vendor-category">
          <option value="all">Todas las categorias</option>
          ${categories.map((cat) => `<option value="${cat.id}" ${filters.vendorCategory === cat.id ? "selected" : ""}>${cat.name}</option>`).join("")}
        </select>
      </div>
    </div>
    <section class="category-list">
      ${categories
        .map((category) => {
          const vendors = visible.filter((vendor) => vendor.category_id === category.id);
          const isOpen = filters.openCategories[category.id] !== false;
          return `
            <article class="card category-panel">
              <div class="category-row">
                <button class="category-toggle" data-action="toggle-category" data-id="${category.id}">
                  <span>${isOpen ? "-" : "+"}</span>
                  <span class="category-title">
                    <strong>${category.name}</strong>
                    <small>${vendors.length} proveedor${vendors.length === 1 ? "" : "es"}</small>
                  </span>
                </button>
                <div class="chips">${statusCountChips(vendors)}</div>
                <button class="btn secondary" data-action="new-vendor-category" data-id="${category.id}">Agregar</button>
              </div>
              ${isOpen ? `<div class="category-detail">${vendors.length ? vendors.map(vendorListItem).join("") : `<div class="empty">Sin proveedores en esta categoria.</div>`}</div>` : ""}
            </article>
          `;
        })
        .join("")}
    </section>
  `;
}

function vendorListItem(vendor) {
  return `
    <div class="vendor-item">
      <div>
        <strong>${escapeHtml(vendor.name)}</strong>
        <p>${escapeHtml(vendor.description_rich || "Sin descripcion")}</p>
        <div class="chips">
          ${statusChip(vendor.status, vendorStatuses)}
          <span class="chip">${money(vendor.price_min)} - ${money(vendor.price_max)}</span>
          ${vendor.phone_local ? `<a class="chip" href="${whatsAppUrl(vendor)}" target="_blank" rel="noreferrer">WhatsApp</a>` : ""}
        </div>
      </div>
      <div class="rating-summary">
        <span>Novio ${stars(vendor.groom_rating)}</span>
        <span>Novia ${stars(vendor.bride_rating)}</span>
      </div>
      <div class="row-actions">
        <button class="action-btn" data-action="edit-vendor" data-id="${vendor.id}" title="Editar proveedor">Editar</button>
        <button class="action-btn danger-text" data-action="delete-vendor" data-id="${vendor.id}" title="Eliminar proveedor">Eliminar</button>
      </div>
    </div>
  `;
}

function statusCountChips(vendors) {
  if (!vendors.length) return `<span class="chip">Sin registros</span>`;
  return vendorStatuses
    .map((status) => {
      const count = vendors.filter((vendor) => vendor.status === status.value).length;
      return count ? `<span class="chip ${status.className}">${status.label}: ${count}</span>` : "";
    })
    .join("");
}

function renderPaymentsHub() {
  const payments = active(state.payments).filter((payment) => filters.paymentStatus === "all" || payment.status === filters.paymentStatus);
  const scheduled = active(state.payments).filter((payment) => payment.status === "scheduled");
  const paid = active(state.payments).filter((payment) => payment.status === "paid");
  return `
    ${topbar("Hub de Pagos", "Programados y realizados", "Controla compromisos de pago, adelantos y gastos administrativos.", `<button class="btn" data-action="new-payment">Nuevo pago</button>`)}
    <section class="grid summary-grid">
      ${metric("Programados", money(sum(scheduled, "amount")))}
      ${metric("Realizados", money(sum(paid, "amount")))}
      ${metric("Cantidad programada", scheduled.length)}
      ${metric("Cantidad realizada", paid.length)}
    </section>
    <div class="toolbar">
      <div class="filters">
        <select id="payment-status">
          <option value="all">Todos los pagos</option>
          ${paymentStatuses.map((status) => `<option value="${status.value}" ${filters.paymentStatus === status.value ? "selected" : ""}>${status.label}</option>`).join("")}
        </select>
      </div>
    </div>
    ${renderPaymentsTable(payments)}
  `;
}

function renderPaymentsTable(payments) {
  if (!payments.length) return `<div class="empty">No hay pagos con estos filtros.</div>`;
  return `
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Concepto</th>
            <th>Proveedor</th>
            <th>Categoria</th>
            <th>Monto</th>
            <th>Fecha</th>
            <th>Estado</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          ${payments
            .map(
              (payment) => `
                <tr>
                  <td><strong>${escapeHtml(payment.concept)}</strong><span class="hint">${escapeHtml(payment.description || "")}</span></td>
                  <td>${payment.vendor_id ? vendorName(payment.vendor_id) : "Administrativo"}</td>
                  <td>${categoryName(payment.category_id)}</td>
                  <td>${money(payment.amount)}</td>
                  <td>${formatDate(payment.payment_date)}</td>
                  <td>${statusChip(payment.status, paymentStatuses)}</td>
                  <td>
                    <div class="row-actions">
                      <button class="action-btn" data-action="edit-payment" data-id="${payment.id}" title="Editar pago">Editar</button>
                      <button class="action-btn danger-text" data-action="delete-payment" data-id="${payment.id}" title="Eliminar pago">Eliminar</button>
                    </div>
                  </td>
                </tr>
              `,
            )
            .join("")}
        </tbody>
      </table>
    </div>
  `;
}

function renderBudget() {
  const payments = active(state.payments).filter((payment) => payment.status !== "voided");
  const totalBudget = Number(getTotalBudget().amount || 0);
  const totalUsed = sum(payments, "amount");
  return `
    ${topbar("Presupuesto", "Uso por categoria", "El resumen se calcula en la app a partir de pagos y presupuestos guardados en la hoja de datos.", `<button class="btn" data-action="edit-total-budget">Editar presupuesto total</button>`)}
    <section class="grid summary-grid">
      ${metric("Presupuesto total", money(totalBudget))}
      ${metric("Utilizado", money(totalUsed))}
      ${metric("Disponible", money(totalBudget - totalUsed))}
      ${metric("Avance", `${totalBudget ? Math.round((totalUsed / totalBudget) * 100) : 0}%`)}
    </section>
    <section class="category-list" style="margin-top:18px;">
      ${categories
        .map((category) => {
          const budget = getCategoryBudget(category.id);
          const used = sum(payments.filter((payment) => payment.category_id === category.id), "amount");
          const percent = budget.amount ? Math.min(100, Math.round((used / budget.amount) * 100)) : 0;
          return `
            <article class="card budget-row">
              <h3>${category.name}</h3>
              <div class="bar"><span style="width:${percent}%"></span></div>
              <strong>${money(used)}</strong>
              <span>de ${money(budget.amount)}</span>
              <span>${percent}%</span>
              <button class="btn secondary" data-action="edit-budget" data-id="${category.id}">Editar maximo</button>
            </article>
          `;
        })
        .join("")}
    </section>
  `;
}

function topbar(kicker, title, subtitle, actions = "") {
  return `
    <header class="topbar">
      <div>
        <p class="kicker">${kicker}</p>
        <h1>${title}</h1>
        <p class="subtitle">${subtitle}</p>
      </div>
      <div class="actions">${actions}</div>
    </header>
  `;
}

function metric(label, value) {
  return `<article class="card metric"><p>${label}</p><strong>${value}</strong></article>`;
}

function menuCard(title, description, targetRoute) {
  return `
    <article class="card menu-card">
      <span class="symbol">${title.slice(0, 1)}</span>
      <h2>${title}</h2>
      <p>${description}</p>
      <button class="btn secondary" data-route="${targetRoute}">Abrir</button>
    </article>
  `;
}

function statusChip(value, list) {
  const status = list.find((item) => item.value === value);
  return `<span class="chip ${status?.className || ""}">${status?.label || value}</span>`;
}

function bindFilters() {
  const vendorSearch = document.getElementById("vendor-search");
  if (vendorSearch) {
    vendorSearch.addEventListener("input", (event) => {
      filters.vendorSearch = event.target.value;
      renderApp();
    });
  }
  const vendorCategory = document.getElementById("vendor-category");
  if (vendorCategory) {
    vendorCategory.addEventListener("change", (event) => {
      filters.vendorCategory = event.target.value;
      renderApp();
    });
  }
  const paymentStatus = document.getElementById("payment-status");
  if (paymentStatus) {
    paymentStatus.addEventListener("change", (event) => {
      filters.paymentStatus = event.target.value;
      renderApp();
    });
  }
}

function handleAction(action, id) {
  if (action === "toggle-category") {
    filters.openCategories[id] = filters.openCategories[id] === false;
    renderApp();
  }
  if (action === "new-vendor") openVendorForm();
  if (action === "new-vendor-category") openVendorForm({ category_id: id });
  if (action === "edit-vendor") openVendorForm(state.vendors.find((vendor) => vendor.id === id));
  if (action === "delete-vendor") confirmDelete("proveedor", () => softDelete("vendors", id));
  if (action === "new-payment") openPaymentForm();
  if (action === "edit-payment") openPaymentForm(state.payments.find((payment) => payment.id === id));
  if (action === "delete-payment") confirmDelete("pago", () => softDelete("payments", id));
  if (action === "edit-total-budget") openTotalBudgetForm();
  if (action === "edit-budget") openBudgetForm(id);
  if (action === "load-google") simulateGoogleLoad();
  if (action === "save-google") simulateGoogleSave();
}

function openVendorForm(vendor = {}) {
  const isEdit = Boolean(vendor.id);
  openModal(`
    <form id="vendor-form">
      <div class="modal-head">
        <h2>${isEdit ? "Editar proveedor" : "Nuevo proveedor"}</h2>
        <button class="icon-btn" type="button" data-close title="Cerrar">x</button>
      </div>
      <div class="modal-body form-grid">
        ${field("Nombre", "name", vendor.name || "", "text", true)}
        ${selectField("Categoria", "category_id", vendor.category_id || "cat_local", categories.map((cat) => [cat.id, cat.name]))}
        ${selectField("Estado", "status", vendor.status || "pending_contact", vendorStatuses.map((item) => [item.value, item.label]))}
        ${field("Telefono", "phone_local", vendor.phone_local || "", "tel")}
        ${field("Precio minimo", "price_min", vendor.price_min || "", "number")}
        ${field("Precio maximo", "price_max", vendor.price_max || "", "number")}
        ${ratingField("Opinion del novio", "groom_rating", vendor.groom_rating || 0)}
        ${ratingField("Opinion de la novia", "bride_rating", vendor.bride_rating || 0)}
        ${field("Instagram / red 1", "social_url_1", vendor.social_url_1 || "", "url")}
        ${field("Red 2", "social_url_2", vendor.social_url_2 || "", "url")}
        ${field("Sitio web", "website_url", vendor.website_url || "", "url")}
        ${field("Descripcion", "description_rich", vendor.description_rich || "", "textarea")}
        ${field("Notas", "notes", vendor.notes || "", "textarea")}
      </div>
      <div class="modal-foot">
        <button class="btn secondary" type="button" data-close>Cancelar</button>
        <button class="btn" type="submit">${isEdit ? "Guardar cambios" : "Registrar proveedor"}</button>
      </div>
    </form>
  `);
  document.getElementById("vendor-form").addEventListener("submit", (event) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.currentTarget));
    upsert("vendors", {
      ...vendor,
      ...data,
      id: vendor.id || makeId("vendor"),
      price_min: Number(data.price_min || 0),
      price_max: Number(data.price_max || 0),
      currency: "PEN",
      country_code: "+51",
      groom_rating: Number(data.groom_rating || 0),
      bride_rating: Number(data.bride_rating || 0),
      is_deleted: false,
      updated_at: new Date().toISOString(),
    });
    closeModal();
    showSuccess(isEdit ? "Proveedor actualizado correctamente." : "Proveedor registrado correctamente.");
  });
}

function openPaymentForm(payment = {}) {
  const isEdit = Boolean(payment.id);
  const approvedVendors = active(state.vendors).filter((vendor) => vendor.status === "approved");
  const vendorOptions = [["", "Administrativo / sin proveedor"], ...approvedVendors.map((vendor) => [vendor.id, vendor.name])];
  openModal(`
    <form id="payment-form">
      <div class="modal-head">
        <h2>${isEdit ? "Editar pago" : "Nuevo pago"}</h2>
        <button class="icon-btn" type="button" data-close title="Cerrar">x</button>
      </div>
      <div class="modal-body form-grid">
        ${field("Concepto", "concept", payment.concept || "", "text", true)}
        ${selectField("Proveedor", "vendor_id", payment.vendor_id || "", vendorOptions)}
        ${selectField("Categoria", "category_id", payment.category_id || "cat_other", categories.map((cat) => [cat.id, cat.name]))}
        ${selectField("Estado", "status", payment.status || "scheduled", paymentStatuses.map((item) => [item.value, item.label]))}
        ${field("Monto", "amount", payment.amount || "", "number", true)}
        ${field("Fecha", "payment_date", payment.payment_date || "", "date", true)}
        ${selectField("Metodo", "method", payment.method || "bank_transfer", paymentMethods)}
        ${field("Comprobante URL", "receipt_url", payment.receipt_url || "", "url")}
        ${field("Descripcion", "description", payment.description || "", "textarea")}
      </div>
      <div class="modal-foot">
        <button class="btn secondary" type="button" data-close>Cancelar</button>
        <button class="btn" type="submit">${isEdit ? "Guardar cambios" : "Registrar pago"}</button>
      </div>
    </form>
  `);
  document.getElementById("payment-form").addEventListener("submit", (event) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.currentTarget));
    upsert("payments", {
      ...payment,
      ...data,
      id: payment.id || makeId("payment"),
      payment_type: data.vendor_id ? "vendor" : "admin",
      amount: Number(data.amount || 0),
      currency: "PEN",
      is_deleted: false,
      updated_at: new Date().toISOString(),
    });
    closeModal();
    showSuccess(isEdit ? "Pago actualizado correctamente." : "Pago registrado correctamente.");
  });
}

function openTotalBudgetForm() {
  const budget = getTotalBudget();
  openBudgetAmountModal("Editar presupuesto total", budget, "Presupuesto total actualizado correctamente.");
}

function openBudgetForm(categoryId) {
  const budget = getCategoryBudget(categoryId);
  const category = categories.find((item) => item.id === categoryId);
  openBudgetAmountModal(`Editar presupuesto - ${category.name}`, budget, "Presupuesto actualizado correctamente.");
}

function openBudgetAmountModal(title, budget, message) {
  openModal(`
    <form id="budget-form">
      <div class="modal-head">
        <h2>${title}</h2>
        <button class="icon-btn" type="button" data-close title="Cerrar">x</button>
      </div>
      <div class="modal-body">
        ${field("Monto maximo", "amount", budget.amount || "", "number", true)}
      </div>
      <div class="modal-foot">
        <button class="btn secondary" type="button" data-close>Cancelar</button>
        <button class="btn" type="submit">Guardar presupuesto</button>
      </div>
    </form>
  `, "small");
  document.getElementById("budget-form").addEventListener("submit", (event) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.currentTarget));
    upsert("budgets", { ...budget, amount: Number(data.amount || 0), updated_at: new Date().toISOString() });
    closeModal();
    showSuccess(message);
  });
}

function field(label, name, value, type = "text", required = false) {
  if (type === "textarea") {
    return `<label class="field full"><span>${label}</span><textarea name="${name}" ${required ? "required" : ""}>${escapeHtml(value)}</textarea></label>`;
  }
  return `<label class="field ${name.includes("description") || name === "notes" ? "full" : ""}"><span>${label}</span><input name="${name}" type="${type}" value="${escapeHtml(value)}" ${required ? "required" : ""} /></label>`;
}

function selectField(label, name, value, options) {
  return `<label class="field"><span>${label}</span><select name="${name}">${options.map(([optionValue, optionLabel]) => `<option value="${optionValue}" ${value === optionValue ? "selected" : ""}>${optionLabel}</option>`).join("")}</select></label>`;
}

function ratingField(label, name, value) {
  const current = Number(value || 0);
  return `
    <fieldset class="field star-field">
      <span>${label}</span>
      <div class="star-rating" aria-label="${label}">
        ${[5, 4, 3, 2, 1]
          .map(
            (score) => `<label><input type="radio" name="${name}" value="${score}" ${current === score ? "checked" : ""} /><span aria-hidden="true">&#9733;</span></label>`,
          )
          .join("")}
      </div>
    </fieldset>
  `;
}

function openModal(content, size = "") {
  modalRoot.innerHTML = `<div class="modal-backdrop"><section class="modal ${size}">${content}</section></div>`;
  modalRoot.querySelectorAll("[data-close]").forEach((item) => item.addEventListener("click", closeModal));
}

function closeModal() {
  modalRoot.innerHTML = "";
}

function confirmDelete(label, onConfirm) {
  openModal(`
    <div class="modal-head"><h2>Confirmar eliminacion</h2><button class="icon-btn" type="button" data-close title="Cerrar">x</button></div>
    <div class="modal-body"><p>Esta accion marcara el ${label} como eliminado. Podra conservarse para sincronizacion y auditoria.</p></div>
    <div class="modal-foot"><button class="btn secondary" type="button" data-close>Cancelar</button><button class="btn danger" id="confirm-delete" type="button">Eliminar</button></div>
  `, "small");
  document.getElementById("confirm-delete").addEventListener("click", () => {
    onConfirm();
    closeModal();
    showSuccess(`${capitalize(label)} eliminado correctamente.`);
  });
}

function showSuccess(message) {
  renderApp();
  modalRoot.innerHTML = `<div class="toast"><strong>Operacion exitosa</strong><br>${message}</div>`;
  setTimeout(() => {
    if (modalRoot.querySelector(".toast")) modalRoot.innerHTML = "";
  }, 2200);
}

function simulateGoogleSave() {
  state.sync.lastSyncAt = new Date().toISOString();
  localStorage.setItem(remoteStorageKey(), JSON.stringify(state));
  saveState();
  showSuccess("Contenido local preparado y guardado en el espacio remoto simulado por key.");
}

function simulateGoogleLoad() {
  const remote = localStorage.getItem(remoteStorageKey());
  if (remote) {
    state = migrateState(JSON.parse(remote));
    saveState();
    showSuccess("Data cargada desde el espacio remoto simulado por key.");
  } else {
    showSuccess("No hay datos remotos todavia para esta key. Puedes subir cambios primero.");
  }
}

function loadState() {
  const saved = localStorage.getItem(`${STORAGE_PREFIX}:local`);
  return saved ? JSON.parse(saved) : structuredClone(seedData);
}

function saveState() {
  localStorage.setItem(`${STORAGE_PREFIX}:local`, JSON.stringify(state));
}

function migrateState(nextState) {
  nextState.vendors = (nextState.vendors || []).map((vendor) => ({ groom_rating: 0, bride_rating: 0, ...vendor }));
  nextState.payments = nextState.payments || [];
  nextState.budgets = nextState.budgets || [];
  if (!nextState.budgets.some((budget) => budget.budget_type === "global" || budget.id === "budget_global_001")) {
    nextState.budgets.unshift({ id: "budget_global_001", budget_type: "global", category_id: "", amount: 50000, currency: "PEN" });
  }
  nextState.sync = nextState.sync || { lastSyncAt: "", remoteKey: "" };
  return nextState;
}

function remoteStorageKey() {
  return `${STORAGE_PREFIX}:remote:${state.sync.remoteKey || ACCESS_KEY}`;
}

function upsert(collection, item) {
  const index = state[collection].findIndex((current) => current.id === item.id);
  if (index >= 0) state[collection][index] = item;
  else state[collection].push(item);
  saveState();
}

function softDelete(collection, id) {
  const item = state[collection].find((current) => current.id === id);
  if (!item) return;
  item.is_deleted = true;
  item.deleted_at = new Date().toISOString();
  item.updated_at = new Date().toISOString();
  saveState();
}

function active(items) {
  return items.filter((item) => !item.is_deleted);
}

function makeId(prefix) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

function categoryName(id) {
  return categories.find((category) => category.id === id)?.name || "Sin categoria";
}

function vendorName(id) {
  return state.vendors.find((vendor) => vendor.id === id)?.name || "Proveedor no encontrado";
}

function getTotalBudget() {
  let budget = state.budgets.find((item) => item.budget_type === "global" || item.id === "budget_global_001");
  if (!budget) {
    budget = { id: "budget_global_001", budget_type: "global", category_id: "", amount: 50000, currency: "PEN" };
    state.budgets.unshift(budget);
    saveState();
  }
  return budget;
}

function getCategoryBudget(categoryId) {
  let budget = state.budgets.find((item) => item.category_id === categoryId && item.budget_type !== "global");
  if (!budget) {
    budget = { id: makeId("budget"), budget_type: "category", category_id: categoryId, amount: 0, currency: "PEN" };
    state.budgets.push(budget);
    saveState();
  }
  return budget;
}

function stars(value) {
  const score = Math.max(0, Math.min(5, Number(value || 0)));
  return `<span class="stars">${"&#9733;".repeat(score)}${"&#9734;".repeat(5 - score)}</span>`;
}

function sum(items, key) {
  return items.reduce((total, item) => total + Number(item[key] || 0), 0);
}

function money(value) {
  return new Intl.NumberFormat("es-PE", { style: "currency", currency: "PEN", maximumFractionDigits: 0 }).format(Number(value || 0));
}

function formatDate(value) {
  if (!value) return "-";
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split("-");
    return `${day}/${month}/${year}`;
  }
  return new Intl.DateTimeFormat("es-PE", { dateStyle: "medium" }).format(new Date(value));
}

function formatDateTime(value) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("es-PE", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
}

function whatsAppUrl(vendor) {
  const code = String(vendor.country_code || "+51").replace("+", "");
  return `https://wa.me/${code}${vendor.phone_local}`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function capitalize(value) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
