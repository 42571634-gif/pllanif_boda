(function () {
  const HOME_LABEL = "Inicio";

  function activeNavLabel() {
    const active = document.querySelector(".nav button.active");
    return active ? active.textContent.trim() : HOME_LABEL;
  }

  function setDrawer(open) {
    document.querySelector(".sidebar")?.classList.toggle("open", open);
    document.querySelector(".drawer-scrim")?.classList.toggle("open", open);
  }

  function goHome() {
    const homeButton = [...document.querySelectorAll(".nav button")].find((button) => button.textContent.trim() === HOME_LABEL);
    homeButton?.click();
    setDrawer(false);
  }

  function enhanceMenu() {
    const layout = document.querySelector(".main-layout");
    const sidebar = document.querySelector(".sidebar");
    const content = document.querySelector(".content");
    if (!layout || !sidebar || !content || document.querySelector(".app-bar")) return;

    sidebar.classList.add("drawer-sidebar");

    const brand = sidebar.querySelector(".brand");
    const close = document.createElement("button");
    close.className = "icon-btn";
    close.type = "button";
    close.title = "Cerrar";
    close.textContent = "x";
    close.addEventListener("click", () => setDrawer(false));

    const drawerHead = document.createElement("div");
    drawerHead.className = "drawer-head";
    if (brand) drawerHead.appendChild(brand);
    drawerHead.appendChild(close);
    sidebar.insertBefore(drawerHead, sidebar.firstChild);

    const appBar = document.createElement("header");
    appBar.className = "app-bar";

    const menuButton = document.createElement("button");
    menuButton.className = "menu-trigger";
    menuButton.type = "button";
    menuButton.title = "Abrir menu";
    menuButton.setAttribute("aria-label", "Abrir menu");
    menuButton.innerHTML = "<span></span><span></span><span></span>";
    menuButton.addEventListener("click", () => setDrawer(true));

    const backButton = document.createElement("button");
    backButton.className = "back-btn";
    backButton.type = "button";
    backButton.title = "Regresar";
    backButton.textContent = "<";
    backButton.hidden = activeNavLabel() === HOME_LABEL;
    backButton.addEventListener("click", goHome);

    const appBrand = document.createElement("div");
    appBrand.className = "brand app-brand";
    appBrand.innerHTML = "<strong>Nuestra boda</strong><span>Datos locales + Drive</span>";

    appBar.append(menuButton, backButton, appBrand);

    const scrim = document.createElement("div");
    scrim.className = "drawer-scrim";
    scrim.addEventListener("click", () => setDrawer(false));

    layout.insertBefore(appBar, sidebar);
    layout.insertBefore(scrim, sidebar);

    sidebar.querySelector(".nav")?.addEventListener("click", (event) => {
      if (event.target.closest("button")) setDrawer(false);
    });
  }

  const observer = new MutationObserver(() => enhanceMenu());
  observer.observe(document.getElementById("app"), { childList: true, subtree: false });
  document.addEventListener("DOMContentLoaded", enhanceMenu);
  enhanceMenu();
})();
