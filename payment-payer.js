(() => {
  const paymentPayers = [
    ["groom", "Novio"],
    ["bride", "Novia"],
    ["shared", "Ambos"],
    ["pending", "Por definir"],
  ];

  function normalizePaymentPayers(nextState) {
    nextState.payments = (nextState.payments || []).map((payment) => ({ paid_by: "pending", ...payment }));
    return nextState;
  }

  function getPayerTotals(payments) {
    return payments.reduce(
      (totals, payment) => {
        const amount = Number(payment.amount || 0);
        if (payment.paid_by === "groom") totals.groom += amount;
        else if (payment.paid_by === "bride") totals.bride += amount;
        else if (payment.paid_by === "shared") {
          totals.shared += amount;
          totals.groom += amount / 2;
          totals.bride += amount / 2;
        } else {
          totals.pending += amount;
        }
        totals.total += amount;
        return totals;
      },
      { groom: 0, bride: 0, shared: 0, pending: 0, total: 0 },
    );
  }

  function settlementText(totals) {
    const difference = totals.groom - totals.bride;
    if (Math.abs(difference) < 1) return "Balanceado";
    const amount = Math.abs(difference) / 2;
    return difference > 0 ? `Novia debe ${money(amount)}` : `Novio debe ${money(amount)}`;
  }

  function payerChip(value) {
    const payer = paymentPayers.find((item) => item[0] === value);
    const className = value === "groom" ? "payer-groom" : value === "bride" ? "payer-bride" : value === "shared" ? "payer-shared" : "";
    return `<span class="chip ${className}">${payer?.[1] || "Por definir"}</span>`;
  }

  function injectPayerStyles() {
    if (document.getElementById("payment-payer-styles")) return;
    const style = document.createElement("style");
    style.id = "payment-payer-styles";
    style.textContent = `
      .balance-strip {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 14px;
        margin-top: 16px;
        padding: 14px;
      }

      .balance-strip div {
        display: grid;
        gap: 5px;
        min-width: 0;
      }

      .balance-strip span {
        color: var(--muted);
        font-size: 12px;
        font-weight: 900;
        text-transform: uppercase;
      }

      .balance-strip strong {
        color: var(--ink);
        font-size: 20px;
        overflow-wrap: anywhere;
      }

      .balance-strip.compact {
        margin-bottom: 4px;
      }

      .budget-payers {
        margin-top: 16px;
      }

      .chip.payer-groom {
        background: var(--teal-soft);
        color: #174e50;
      }

      .chip.payer-bride {
        background: #fde8ef;
        color: var(--rose-dark);
      }

      .chip.payer-shared {
        background: var(--gold-soft);
        color: #8a6418;
      }

      .table-wrap table {
        min-width: 860px;
      }

      @media (max-width: 980px) {
        .balance-strip {
          grid-template-columns: 1fr;
        }
      }
    `;
    document.head.appendChild(style);
  }

  const baseMigrateState = migrateState;
  migrateState = function migrateStateWithPaymentPayers(nextState) {
    return normalizePaymentPayers(baseMigrateState(nextState));
  };

  renderHome = function renderHomeWithPaymentPayers() {
    const vendors = active(state.vendors);
    const payments = active(state.payments);
    const paid = payments.filter((payment) => payment.status === "paid");
    const scheduled = payments.filter((payment) => payment.status === "scheduled");
    const payerTotals = getPayerTotals(paid);
    return `
      ${topbar("Bienvenida", "Menu de opciones", "Un punto de entrada simple para revisar proveedores, pagos y presupuesto antes de sincronizar con Google Drive.")}
      <section class="grid summary-grid">
        ${metric("Proveedores activos", vendors.length)}
        ${metric("Aprobados", vendors.filter((vendor) => vendor.status === "approved").length)}
        ${metric("Pagos realizados", money(sum(paid, "amount")))}
        ${metric("Pagos programados", money(sum(scheduled, "amount")))}
      </section>
      <section class="card balance-strip">
        <div><span>Pagado por novio</span><strong>${money(payerTotals.groom)}</strong></div>
        <div><span>Pagado por novia</span><strong>${money(payerTotals.bride)}</strong></div>
        <div><span>Arqueo</span><strong>${settlementText(payerTotals)}</strong></div>
      </section>
      <section class="grid home-grid" style="margin-top: 18px;">
        ${menuCard("Proveedores", "Revisar resumen por categoria, estados y registrar opciones nuevas.", "vendorsHub")}
        ${menuCard("Pagos", "Administrar pagos programados, realizados y gastos administrativos.", "paymentsHub")}
        ${menuCard("Presupuesto", "Comparar uso por categoria y editar montos maximos.", "budget")}
      </section>
    `;
  };

  renderPaymentsHub = function renderPaymentsHubWithPaymentPayers() {
    const payments = active(state.payments).filter((payment) => filters.paymentStatus === "all" || payment.status === filters.paymentStatus);
    const scheduled = active(state.payments).filter((payment) => payment.status === "scheduled");
    const paid = active(state.payments).filter((payment) => payment.status === "paid");
    const payerTotals = getPayerTotals(paid);
    return `
      ${topbar("Hub de Pagos", "Programados y realizados", "Controla compromisos de pago, adelantos y gastos administrativos.", `<button class="btn" data-action="new-payment">Nuevo pago</button>`)}
      <section class="grid summary-grid">
        ${metric("Programados", money(sum(scheduled, "amount")))}
        ${metric("Realizados", money(sum(paid, "amount")))}
        ${metric("Pago novio", money(payerTotals.groom))}
        ${metric("Pago novia", money(payerTotals.bride))}
      </section>
      <section class="card balance-strip compact">
        <div><span>Arqueo entre ambos</span><strong>${settlementText(payerTotals)}</strong></div>
        <div><span>Pagos programados</span><strong>${scheduled.length}</strong></div>
        <div><span>Pagos realizados</span><strong>${paid.length}</strong></div>
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
  };

  renderPaymentsTable = function renderPaymentsTableWithPaymentPayers(payments) {
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
              <th>Pago por</th>
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
                    <td>${payerChip(payment.paid_by)}</td>
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
  };

  renderBudget = function renderBudgetWithPaymentPayers() {
    const payments = active(state.payments).filter((payment) => payment.status !== "voided");
    const paid = active(state.payments).filter((payment) => payment.status === "paid");
    const totalBudget = Number(getTotalBudget().amount || 0);
    const totalUsed = sum(payments, "amount");
    const payerTotals = getPayerTotals(paid);
    return `
      ${topbar("Presupuesto", "Uso por categoria", "El resumen se calcula en la app a partir de pagos y presupuestos guardados en la hoja de datos.", `<button class="btn" data-action="edit-total-budget">Editar presupuesto total</button>`)}
      <section class="grid summary-grid">
        ${metric("Presupuesto total", money(totalBudget))}
        ${metric("Utilizado", money(totalUsed))}
        ${metric("Disponible", money(totalBudget - totalUsed))}
        ${metric("Avance", `${totalBudget ? Math.round((totalUsed / totalBudget) * 100) : 0}%`)}
      </section>
      <section class="grid summary-grid budget-payers">
        ${metric("Pagado novio", money(payerTotals.groom))}
        ${metric("Pagado novia", money(payerTotals.bride))}
        ${metric("Pagado en pareja", money(payerTotals.shared))}
        ${metric("Arqueo", settlementText(payerTotals))}
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
  };

  openPaymentForm = function openPaymentFormWithPaymentPayers(payment = {}) {
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
          ${selectField("Pagado por", "paid_by", payment.paid_by || "pending", paymentPayers)}
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
        paid_by: data.paid_by || "pending",
        amount: Number(data.amount || 0),
        currency: "PEN",
        is_deleted: false,
        updated_at: new Date().toISOString(),
      });
      closeModal();
      showSuccess(isEdit ? "Pago actualizado correctamente." : "Pago registrado correctamente.");
    });
  };

  try {
    injectPayerStyles();
    normalizePaymentPayers(state);
    saveState();
    renderApp();
  } catch (error) {
    console.warn("No se pudo activar el arqueo de pagos.", error);
  }
})();
