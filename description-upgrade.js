(function () {
  if (!window.extensionRegistry) return;

  const DESCRIPTION_SNIPPET_LENGTH = 180;
  const COLLAPSED_MESSAGE_COUNT = 3;
  filters.expandedDescriptions = filters.expandedDescriptions || {};

  window.extensionRegistry.registerVendorDescription((vendor) => {
    const description = String(vendor.description_rich || "Sin descripcion").trim();
    return renderExpandableDescription(vendor, description);
  });

  window.extensionRegistry.registerAction("toggle-description", (id) => {
    filters.expandedDescriptions[id] = !filters.expandedDescriptions[id];
    renderApp();
  });

  function renderExpandableDescription(vendor, description) {
    const messages = parseWhatsAppMessages(description);
    if (messages.length >= 2) return renderWhatsAppThread(vendor, messages);
    return renderPlainDescription(vendor, description);
  }

  function renderPlainDescription(vendor, description) {
    const isLong = description.length > DESCRIPTION_SNIPPET_LENGTH;
    const isExpanded = Boolean(filters.expandedDescriptions[vendor.id]);
    const visibleText = isLong && !isExpanded ? `${description.slice(0, DESCRIPTION_SNIPPET_LENGTH).trimEnd()}...` : description;
    return `
      <p class="vendor-description plain-text">
        ${linkifyDescriptionText(visibleText)}
        ${renderToggle(vendor.id, isLong, isExpanded)}
      </p>
    `;
  }

  function renderWhatsAppThread(vendor, messages) {
    const isExpanded = Boolean(filters.expandedDescriptions[vendor.id]);
    const visibleMessages = isExpanded ? messages : messages.slice(0, COLLAPSED_MESSAGE_COUNT);
    const participants = [...new Set(messages.map((message) => message.author).filter(Boolean))];
    const hiddenCount = messages.length - visibleMessages.length;
    return `
      <div class="vendor-description whatsapp-thread">
        <div class="whatsapp-thread-header">
          <span class="whatsapp-meta-chip">WhatsApp</span>
          <span class="whatsapp-meta-chip">${messages.length} mensajes</span>
          ${participants.length ? `<span class="whatsapp-meta-chip">${participants.slice(0, 3).map(escapeHtml).join(" / ")}</span>` : ""}
        </div>
        ${visibleMessages.map(renderMessage).join("")}
        ${hiddenCount > 0 && !isExpanded ? `<span class="hint">${hiddenCount} mensaje${hiddenCount === 1 ? "" : "s"} mas oculto${hiddenCount === 1 ? "" : "s"}.</span>` : ""}
        ${renderToggle(vendor.id, messages.length > COLLAPSED_MESSAGE_COUNT, isExpanded)}
      </div>
    `;
  }

  function renderMessage(message) {
    return `
      <article class="whatsapp-message">
        <div class="whatsapp-message-head">
          ${message.author ? `<span class="whatsapp-author">${escapeHtml(message.author)}</span>` : ""}
          ${message.date || message.time ? `<span class="whatsapp-time">${escapeHtml([message.date, message.time].filter(Boolean).join(" · "))}</span>` : ""}
        </div>
        <div class="whatsapp-body">${linkifyDescriptionText(message.text)}</div>
      </article>
    `;
  }

  function parseWhatsAppMessages(value) {
    const lines = String(value || "").replace(/\r\n/g, "\n").split("\n");
    const messages = [];
    const patterns = [
      /^\[?([0-3]?\d[\/\-][01]?\d[\/\-]\d{2,4}),?\s+([0-2]?\d:[0-5]\d(?:\s*(?:a\.?\s*m\.?|p\.?\s*m\.?|am|pm))?)\]?\s*[-–]?\s*([^:]{1,80}):\s*(.*)$/i,
      /^([0-3]?\d[\/\-][01]?\d[\/\-]\d{2,4})\s+([0-2]?\d:[0-5]\d)\s*[-–]\s*([^:]{1,80}):\s*(.*)$/i
    ];

    lines.forEach((line) => {
      const cleanLine = line.trimEnd();
      const match = patterns.map((pattern) => cleanLine.match(pattern)).find(Boolean);
      if (match) {
        messages.push({ date: normalizeDateLabel(match[1]), time: normalizeTimeLabel(match[2]), author: match[3].trim(), text: match[4].trim() });
        return;
      }
      if (messages.length && cleanLine.trim()) {
        messages[messages.length - 1].text += `${messages[messages.length - 1].text ? "\n" : ""}${cleanLine.trim()}`;
      }
    });

    return messages.filter((message) => message.text || message.author);
  }

  function normalizeDateLabel(value) {
    return String(value || "").replaceAll("-", "/").trim();
  }

  function normalizeTimeLabel(value) {
    return String(value || "").replace(/\s+/g, " ").replace(/a\.\s*m\./i, "a. m.").replace(/p\.\s*m\./i, "p. m.").trim();
  }

  function renderToggle(id, isVisible, isExpanded) {
    if (!isVisible) return "";
    return `<button class="link-button" type="button" data-action="toggle-description" data-id="${id}">${isExpanded ? "Ver menos" : "Ver mas"}</button>`;
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
