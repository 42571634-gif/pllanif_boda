(function () {
  if (window.extensionRegistry) return;
  if (typeof handleAction !== "function" || typeof vendorListItem !== "function") return;

  const actionHandlers = {};
  const vendorActionRenderers = [];
  let vendorDescriptionRenderer = null;

  window.extensionRegistry = {
    registerAction(action, handler) {
      actionHandlers[action] = handler;
    },
    registerVendorAction(renderer) {
      vendorActionRenderers.push(renderer);
    },
    registerVendorDescription(renderer) {
      vendorDescriptionRenderer = renderer;
    },
  };

  const originalHandleAction = handleAction;
  handleAction = function registryHandleAction(action, id) {
    if (actionHandlers[action]) {
      actionHandlers[action](id);
      return;
    }
    originalHandleAction(action, id);
  };

  const originalVendorListItem = vendorListItem;
  vendorListItem = function registryVendorListItem(vendor) {
    let html = originalVendorListItem(vendor);

    if (vendorDescriptionRenderer) {
      const currentDescription = `<p>${escapeHtml(vendor.description_rich || "Sin descripcion")}</p>`;
      html = html.replace(currentDescription, vendorDescriptionRenderer(vendor));
    }

    const actions = vendorActionRenderers.map((renderer) => renderer(vendor)).join("");
    if (actions && !html.includes('data-extension-actions="vendor"')) {
      html = html.replace(
        `<button class="action-btn danger-text" data-action="delete-vendor"`,
        `<span data-extension-actions="vendor">${actions}</span>
        <button class="action-btn danger-text" data-action="delete-vendor"`,
      );
    }

    return html;
  };
})();
