(function () {
  if (typeof vendorListItem !== "function" || typeof handleAction !== "function") return;

  const DESCRIPTION_SNIPPET_LENGTH = 160;
  filters.expandedDescriptions = filters.expandedDescriptions || {};

  const originalVendorListItem = vendorListItem;
  vendorListItem = function patchedDescriptionVendorListItem(vendor) {
    const html = originalVendorListItem(vendor);
    const fullDescription = String(vendor.description_rich || "Sin descripcion").trim();
    const currentParagraph = `<p>${escapeHtml(vendor.description_rich || "Sin descripcion")}</p>`;
    return html.replace(currentParagraph, renderExpandableDescription(vendor, fullDescription));
  };

  const originalHandleAction = handleAction;
  handleAction = function patchedDescriptionHandleAction(action, id) {
    if (action === "toggle-description") {
      filters.expandedDescriptions[id] = !filters.expandedDescriptions[id];
      renderApp();
      return;
    }
    originalHandleAction(action, id);
  };

  function renderExpandableDescription(vendor, description) {
    const isLong = description.length > DESCRIPTION_SNIPPET_LENGTH;
    const isExpanded = Boolean(filters.expandedDescriptions[vendor.id]);
    const visibleText = isLong && !isExpanded ? `${description.slice(0, DESCRIPTION_SNIPPET_LENGTH).trimEnd()}...` : description;
    return `
      <p class="vendor-description">
        ${linkifyDescriptionText(visibleText)}
        ${
          isLong
            ? `<button class="link-button" type="button" data-action="toggle-description" data-id="${vendor.id}">${isExpanded ? "Ver menos" : "Ver mas"}</button>`
            : ""
        }
      </p>
    `;
  }

  function linkifyDescriptionText(value) {
    const urlPattern = /((?:https?:\/\/|www\.)[^\s<>"']+)/gi;
    return escapeHtml(value).replace(urlPattern, (match) => {
      const cleanMatch = match.replace(/[.,;:!?)]$/, "");
      const trailing = match.slice(cleanMatch.length);
      const href = cleanMatch.toLowerCase().startsWith("www.") ? `https://${cleanMatch}` : cleanMatch;
      return `<a href="${href}" target="_blank" rel="noreferrer">${cleanMatch}</a>${trailing}`;
    });
  }
})();
