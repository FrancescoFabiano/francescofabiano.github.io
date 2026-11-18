// Keeps long sections to about one screen: items that do not fit are hidden
// under a "Show older (N)" button. Recomputed on load and on resize.
(function () {
  const HEADER = 70;   // fixed site header height (px)
  const RESERVE = 90;  // room kept for the button and spacing (px)
  const lists = [];

  function register(container, itemSelector, opts) {
    if (!container) return;
    const l = Object.assign({ container, itemSelector, min: 3, expanded: false, suspended: false }, opts || {});
    l.items = () => [...l.container.querySelectorAll(l.itemSelector)].filter((el) => el.parentElement.closest(l.itemSelector) === null);
    l.btn = document.createElement("button");
    l.btn.type = "button";
    l.btn.className = "fit-more";
    l.btn.addEventListener("click", () => {
      l.expanded = !l.expanded;
      fit(l);
      if (!l.expanded && l.onCollapse) l.onCollapse(l);
      // Collapsing: bring the section back into view (center.js centres it when it fits).
      if (!l.expanded) {
        const sec = l.container.closest("section");
        if (sec.getBoundingClientRect().top < 0 || sec.getBoundingClientRect().top > window.innerHeight) {
          window.centerSection ? window.centerSection(sec) : sec.scrollIntoView({ behavior: "smooth" });
        }
      }
    });
    (l.buttonInside ? l.container : l.container.parentElement).insertBefore(l.btn, l.buttonInside ? null : l.container.nextSibling);
    lists.push(l);
  }

  function fit(l) {
    const items = l.items();
    items.forEach((el) => el.classList.remove("fit-hidden"));
    if (l.groupSelector) l.container.querySelectorAll(l.groupSelector).forEach((g) => g.classList.remove("fit-hidden"));
    let cut = items.length;
    const horizontal = getComputedStyle(l.container).display === "flex" &&
      getComputedStyle(l.container).flexDirection.startsWith("row");
    if (!l.expanded && !l.suspended && l.container.offsetParent !== null) {
      const box = l.container.getBoundingClientRect();
      if (horizontal) {
        // A row of tabs: keep room for the button at the end of the row.
        l.btn.hidden = false;
        l.btn.textContent = `Older (${items.length})`;
        const limit = l.container.clientWidth - l.btn.offsetWidth - 12;
        cut = items.findIndex((el) => el.getBoundingClientRect().right - box.left > limit);
      } else {
        const section = l.container.closest("section").getBoundingClientRect();
        const budget = window.innerHeight - HEADER - RESERVE - Math.max(0, box.top - section.top);
        cut = items.findIndex((el) => el.getBoundingClientRect().bottom - box.top > budget);
      }
      if (cut < 0) cut = items.length;
      cut = Math.max(cut, Math.min(horizontal ? 1 : l.min, items.length));
    }
    const hidden = items.length - cut;
    items.slice(cut).forEach((el) => el.classList.add("fit-hidden"));
    // Optional groups (e.g. a publication year): hide a group when all its items are hidden.
    if (l.groupSelector) {
      l.container.querySelectorAll(l.groupSelector).forEach((g) => {
        const own = [...g.querySelectorAll(l.itemSelector)];
        g.classList.toggle("fit-hidden", own.length > 0 && own.every((el) => el.classList.contains("fit-hidden")));
      });
    }
    const older = l.expanded ? items.length - Math.min(l.min, items.length) : hidden;
    l.btn.hidden = l.suspended || (!l.expanded && hidden === 0);
    l.btn.textContent = l.expanded ? "Show fewer" : horizontal ? `Older (${older})` : `Show older (${older})`;
  }

  // Re-fit while keeping the reader's place: the section at the top of the screen stays put.
  const fitAll = () => {
    const header = HEADER;
    const anchor = [...document.querySelectorAll("main section")].find((s) => s.getBoundingClientRect().bottom > header);
    const before = anchor ? anchor.getBoundingClientRect().top : 0;
    lists.forEach(fit);
    if (anchor && window.scrollY > 0) window.scrollBy(0, anchor.getBoundingClientRect().top - before);
  };
  // Phones resize the window when the address bar hides or shows while scrolling:
  // on touch screens only a width change (or a large height change, e.g. rotation) triggers a re-fit.
  const touch = window.matchMedia("(pointer: coarse)").matches;
  let lastW = window.innerWidth, lastH = window.innerHeight, timer;
  const onResize = () => {
    const w = window.innerWidth, h = window.innerHeight;
    if (touch && w === lastW && Math.abs(h - lastH) < 200) return;
    lastW = w; lastH = h;
    clearTimeout(timer); timer = setTimeout(fitAll, 150);
  };

  // Experience and Education (accordions).
  ["experience", "education"].forEach((id) =>
    register(document.querySelector(`#${id} .accordeon`), ".accordeon-item"));

  // Projects & Events (tab bar). Collapsing again re-selects the first tab if a hidden one was open.
  register(document.querySelector("#projects.tabs-container .tabs"), ".tab", {
    buttonInside: true,
    onCollapse: (l) => {
      const active = l.container.querySelector(".tab.active");
      const first = l.items()[0];
      if (active && first && active.classList.contains("fit-hidden")) first.click();
    },
  });

  // Publications: live list and fallback list, one paper per item, year headings follow.
  ["#pub-live", "#pub-fallback"].forEach((sel) =>
    register(document.querySelector(sel), ".pub-item", { min: 5, groupSelector: ".pub-year" }));

  // While searching publications, show everything.
  const search = document.getElementById("pub-search");
  if (search) {
    search.addEventListener("input", () => {
      const on = search.value.trim() !== "";
      lists.filter((l) => l.itemSelector === ".pub-item").forEach((l) => { l.suspended = on; fit(l); });
    });
  }

  document.addEventListener("pubs:rendered", fitAll);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(fitAll);
  window.addEventListener("load", fitAll);
  window.addEventListener("resize", onResize);
  fitAll();
})();
