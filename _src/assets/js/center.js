// In-page links (menu, "next" arrows): a section that fits on screen is centred
// in the space below the fixed header; a taller one starts just under the header.
(function () {
  const HEADER = 70;  // fixed site header height (px)
  const GAP = 16;     // breathing room under the header (px)

  function targetTop(section) {
    if (section.id === "home") return 0;
    const r = section.getBoundingClientRect();
    const room = window.innerHeight - HEADER;
    const top = r.top + window.scrollY - HEADER;
    return r.height + 2 * GAP <= room ? top - (room - r.height) / 2 : top - GAP;
  }

  function go(section, smooth) {
    window.scrollTo({ top: Math.max(0, targetTop(section)), behavior: smooth ? "smooth" : "instant" });
  }

  document.addEventListener("click", (e) => {
    const a = e.target.closest('a[href^="#"]');
    if (!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey) return;
    const id = decodeURIComponent(a.getAttribute("href").slice(1));
    const section = id && document.getElementById(id);
    if (!section || section.tagName !== "SECTION") return;
    e.preventDefault();
    go(section, true);
    try { history.replaceState(null, "", "#" + id); } catch (err) { /* address bar unchanged */ }
  });

  // Clicking inside a section (an accordion item, a tab, "Show older", "Cite"...) re-centres it
  // once its size has settled. A section taller than the screen is not re-centred; instead the
  // item that was clicked is scrolled just enough to be fully visible.
  let pending;
  document.addEventListener("click", (e) => {
    const section = e.target.closest("main section");
    if (!section || section.id === "home") return;
    if (e.target.closest("input, textarea, select")) return;
    const hash = e.target.closest('a[href^="#"]');  // links to a section are handled above
    if (hash) { const t = document.getElementById(decodeURIComponent(hash.getAttribute("href").slice(1))); if (t && t.tagName === "SECTION") return; }
    if (window.getSelection && String(window.getSelection()).length) return;
    const item = e.target.closest(".accordeon-item, .pub-item, .tabs-container");
    clearTimeout(pending);
    pending = setTimeout(() => {
      const r = section.getBoundingClientRect();
      if (r.height + 2 * GAP <= window.innerHeight - HEADER) {
        if (Math.abs(targetTop(section) - window.scrollY) > 8) go(section, true);
        return;
      }
      if (!item) return;
      const ir = item.getBoundingClientRect();
      const top = HEADER + GAP, bottom = window.innerHeight - GAP;
      let delta = 0;
      if (ir.top < top) delta = ir.top - top;
      else if (ir.bottom > bottom) delta = Math.min(ir.bottom - bottom, ir.top - top);
      if (Math.abs(delta) > 8) window.scrollBy({ top: delta, behavior: "smooth" });
    }, 350);  // accordion items slide open in 0.3 s
  }, true);  // capture: the tab script stops clicks from bubbling
  window.centerSection = (section) => go(section, true);

  // Opening the page with #section in the address: place it the same way once the page has loaded.
  window.addEventListener("load", () => {
    const id = decodeURIComponent(location.hash.slice(1));
    const section = id && document.getElementById(id);
    if (section && section.tagName === "SECTION") setTimeout(() => go(section, false), 50);
  });
})();
