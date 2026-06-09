(function () {
  "use strict";

  if (typeof vendorListItem !== "function") return;

  const originalVendorListItem = vendorListItem;
  vendorListItem = function socialVendorListItem(vendor) {
    const html = originalVendorListItem(vendor);
    const links = renderSocialLinks(vendor);
    if (!links) return html;
    return html.replace("</div>\n      </div>\n      <div class=\"rating-summary\">", `${links}\n        </div>\n      </div>\n      <div class=\"rating-summary\">`);
  };

  function renderSocialLinks(vendor) {
    const links = [
      socialLink("Instagram / red 1", vendor.social_url_1),
      socialLink("Red 2", vendor.social_url_2),
      socialLink("Web", vendor.website_url)
    ].filter(Boolean);
    return links.join("");
  }

  function socialLink(label, value) {
    const href = normalizeUrl(value);
    if (!href) return "";
    return `<a class="chip social-chip" href="${escapeHtml(href)}" target="_blank" rel="noreferrer">${escapeHtml(shortLabel(label, href))}</a>`;
  }

  function normalizeUrl(value) {
    const raw = String(value || "").trim();
    if (!raw) return "";
    if (/^https?:\/\//i.test(raw)) return raw;
    if (/^www\./i.test(raw)) return `https://${raw}`;
    if (/^@?[a-z0-9._]{2,}$/i.test(raw)) return `https://instagram.com/${raw.replace(/^@/, "")}`;
    return "";
  }

  function shortLabel(label, href) {
    if (/instagram\.com/i.test(href)) return "Instagram";
    if (/facebook\.com|fb\.com/i.test(href)) return "Facebook";
    if (/tiktok\.com/i.test(href)) return "TikTok";
    if (/wa\.me|whatsapp\.com/i.test(href)) return "WhatsApp";
    return label === "Web" ? "Web" : label;
  }
})();
