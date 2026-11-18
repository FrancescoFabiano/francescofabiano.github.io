// Live publication list, read in the browser from DBLP's SPARQL endpoint.
// The static list built from the CV bibliography is shown at once; if DBLP answers within
// TIMEOUT_MS the live list replaces it, otherwise the static list simply stays.
(function () {
  const PID = "https://dblp.org/pid/221/6112";
  const ME = "Francesco Fabiano";
  const ENDPOINT = "https://sparql.dblp.org/sparql";
  const TIMEOUT_MS = 4000;

  const QUERY = `PREFIX dblp: <https://dblp.org/rdf/schema#>
SELECT ?p (SAMPLE(?t) AS ?title) (SAMPLE(?y) AS ?year) (SAMPLE(?ty) AS ?type) (SAMPLE(?v) AS ?venue)
  (SAMPLE(?st) AS ?streamTitle) (SAMPLE(?j) AS ?journal) (SAMPLE(?vol) AS ?volume) (SAMPLE(?iss) AS ?number)
  (SAMPLE(?pg) AS ?pages) (SAMPLE(?bk) AS ?booktitle) (SAMPLE(?pub) AS ?publisher) (SAMPLE(?ser) AS ?series)
  (SAMPLE(?serv) AS ?seriesVolume) (SAMPLE(?d) AS ?doi) (SAMPLE(?e) AS ?ee)
  (GROUP_CONCAT(DISTINCT CONCAT(STR(?ord), "~", ?name); separator="|") AS ?authors)
WHERE {
  ?p dblp:authoredBy|dblp:editedBy <${PID}> ;
     dblp:title ?t ; dblp:yearOfPublication ?y ; a ?ty .
  FILTER(?ty != dblp:Publication)
  OPTIONAL { ?p dblp:publishedIn ?v }
  OPTIONAL { ?p dblp:publishedInStream ?s . ?s dblp:primaryStreamTitle ?st }
  OPTIONAL { ?p dblp:publishedInJournal ?j }
  OPTIONAL { ?p dblp:publishedInJournalVolume ?vol }
  OPTIONAL { ?p dblp:publishedInJournalVolumeIssue ?iss }
  OPTIONAL { ?p dblp:pagination ?pg }
  OPTIONAL { ?p dblp:publishedAsPartOf ?par . ?par dblp:title ?bk . OPTIONAL { ?par dblp:publishedBy ?pub } }
  OPTIONAL { ?p dblp:publishedBy ?pub }
  OPTIONAL { ?p dblp:publishedInSeries ?ser }
  OPTIONAL { ?p dblp:publishedInSeriesVolume ?serv }
  OPTIONAL { ?p dblp:doi ?d }
  OPTIONAL { ?p dblp:primaryDocumentPage ?e }
  OPTIONAL { ?p dblp:hasSignature ?sig . ?sig dblp:signatureOrdinal ?ord ; dblp:signatureDblpName ?name . }
}
GROUP BY ?p`;

  // DBLP publication types, grouped like the CV.
  const GROUPS = [
    { name: "Editor", types: ["Editorship"] },
    { name: "Journal Articles and Book Chapters", types: ["Article", "Incollection", "Book"] },
    { name: "Conference Papers", types: ["Inproceedings"] },
    { name: "Technical Reports and Preprints", types: ["Informal", "Data", "Withdrawn"] },
  ];

  const root = document.getElementById("pub-live");
  const fallback = document.getElementById("pub-fallback");
  const search = document.getElementById("pub-search");
  const status = document.getElementById("pub-status");
  if (!root) return;

  const esc = (s) => String(s).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const cleanName = (n) => n.replace(/\s\d{4}$/, "");
  const citeHtml = (bib, text) => `<div class="pub-cite" hidden>
        <div class="pub-cite-block"><div class="pub-cite-head">BibTeX <button type="button" class="pub-copy">Copy</button></div><pre class="pub-cite-body">${esc(bib)}</pre></div>
        <div class="pub-cite-block"><div class="pub-cite-head">Text <button type="button" class="pub-copy">Copy</button></div><p class="pub-cite-body">${esc(text)}</p></div>
      </div>`;

  function showFallback() {
    root.hidden = true;
    if (fallback) fallback.hidden = false;
    if (status) status.textContent = "";
    document.dispatchEvent(new Event("pubs:rendered"));
  }

  function toPubs(bindings) {
    return bindings.map((b) => {
      const v = (k) => (b[k] ? b[k].value : "");
      return {
        key: "DBLP:" + v("p").replace("https://dblp.org/rec/", ""),
        title: v("title").replace(/\.$/, ""),
        year: parseInt(v("year"), 10) || 0,
        type: v("type").split("#").pop(),
        venue: v("venue"), streamTitle: v("streamTitle"),
        journal: v("journal"), volume: v("volume"), number: v("number"),
        pages: v("pages"), booktitle: v("booktitle").replace(/\.$/, ""), publisher: v("publisher"),
        series: v("series"), seriesVolume: v("seriesVolume"),
        doi: v("doi").replace(/^https?:\/\/doi\.org\//, ""), ee: v("ee"),
        authors: v("authors") ? v("authors").split("|")
          .map((s) => { const i = s.indexOf("~"); return [parseInt(s.slice(0, i), 10), cleanName(s.slice(i + 1))]; })
          .sort((a, b) => a[0] - b[0]).map((x) => x[1]) : [],
      };
    });
  }

  const join = (xs) => (xs.length > 1 ? xs.slice(0, -1).join(", ") + " and " + xs[xs.length - 1] : xs.join(""));
  const arxivId = (p) => (p.journal === "CoRR" && p.volume.startsWith("abs/") ? p.volume.slice(4) : "");

  // Venue as shown on the page: the full venue name, plus volume, issue and pages.
  function venueText(p) {
    const pages = p.pages ? `, pp. ${p.pages.replace("-", "\u2013")}` : "";
    if (arxivId(p)) return `arXiv preprint arXiv:${arxivId(p)}`;
    if (p.type === "Editorship") return [p.series, p.seriesVolume].filter(Boolean).join(" ") || p.publisher || p.venue;
    let name = p.streamTitle || p.venue;
    if (p.venue && p.streamTitle && !p.streamTitle.includes(p.venue)) name = `${p.venue}, ${p.streamTitle}`;
    if (p.type === "Article") return (p.streamTitle || p.journal || p.venue) + (p.volume ? ` ${p.volume}${p.number ? `(${p.number})` : ""}` : "") + pages;
    return name + pages;
  }

  // BibTeX in DBLP's style, built from the same data.
  function bibtex(p) {
    const protect = (t) => t.replace(/&/g, "\\&").replace(/\b([A-Za-z]*[A-Z][A-Za-z0-9]*[A-Z0-9][A-Za-z0-9]*)\b/g, "{$1}");
    const kind = { Inproceedings: "inproceedings", Article: "article", Informal: "article", Editorship: "proceedings",
                   Incollection: "incollection", Book: "book" }[p.type] || "misc";
    const f = [];
    f.push([p.type === "Editorship" ? "editor" : "author", p.authors.join(" and ")]);
    f.push(["title", protect(p.title)]);
    if (kind === "inproceedings" || kind === "incollection") f.push(["booktitle", protect(p.booktitle || p.venue)]);
    if (kind === "article") { f.push(["journal", p.journal || p.venue]); if (p.volume) f.push(["volume", p.volume]); if (p.number) f.push(["number", p.number]); }
    if (kind === "proceedings") { if (p.series) f.push(["series", p.series]); if (p.seriesVolume) f.push(["volume", p.seriesVolume]); }
    if (p.pages) f.push(["pages", p.pages.replace("-", "--")]);
    if (p.publisher && kind !== "article") f.push(["publisher", p.publisher]);
    f.push(["year", String(p.year)]);
    if (p.ee) f.push(["url", p.ee]);
    if (p.doi) f.push(["doi", p.doi]);
    if (arxivId(p)) { f.push(["eprinttype", "arXiv"]); f.push(["eprint", arxivId(p)]); }
    return `@${kind}{${p.key},\n` + f.filter((x) => x[1]).map(([k, v]) => `  ${k.padEnd(10)} = {${v}}`).join(",\n") + "\n}";
  }

  function plainText(p) {
    const who = join(p.authors) + (p.type === "Editorship" ? " (eds.)" : "");
    return `${who}. ${p.title}. ${venueText(p)}, ${p.year}.` + (p.doi ? ` https://doi.org/${p.doi}` : "");
  }

  function itemHtml(p) {
    const names = p.authors.map((n) => (n === ME ? `<b>${esc(n)}</b>` : esc(n)));
    const link = p.doi ? `https://doi.org/${p.doi}` : p.ee;
    const label = p.doi ? "DOI" : "Link";
    return `<li class="pub-item">
      <span class="pub-title">${esc(p.title)}</span>
      <span class="pub-authors">${join(names)}${p.type === "Editorship" ? " (eds.)" : ""}</span>
      <span class="pub-venue"><i>${esc(venueText(p))}</i></span>
      <span class="pub-links">${link ? `<a class="pub-link" href="${esc(link)}" target="_blank" rel="noopener">${label}</a>` : ""}<button type="button" class="pub-link pub-cite-btn" aria-expanded="false">Cite</button></span>
      ${citeHtml(bibtex(p), plainText(p))}
    </li>`;
  }

  function render(pubs) {
    // Grouped by publication year, newest first; within a year, by type (as in the CV) then title.
    const rank = (p) => { const i = GROUPS.findIndex((g) => g.types.includes(p.type)); return i < 0 ? GROUPS.length : i; };
    pubs.sort((a, b) => b.year - a.year || rank(a) - rank(b) || a.title.localeCompare(b.title));
    let html = "";
    for (const year of [...new Set(pubs.map((p) => p.year))]) {
      const list = pubs.filter((p) => p.year === year);
      html += `<div class="pub-year"><h2 class="pub-group">${year || "Undated"}</h2><ol class="pub-list">${list.map(itemHtml).join("")}</ol></div>`;
    }
    root.innerHTML = html;
    root.hidden = false;
    if (fallback) fallback.hidden = true;
    if (status) status.textContent = `${pubs.length} publications, live from DBLP.`;
    document.dispatchEvent(new Event("pubs:rendered"));
  }

  // Search filters whichever list is showing (live or fallback), on title, authors and venue.
  if (search) {
    search.addEventListener("input", () => {
      const q = search.value.trim().toLowerCase();
      document.querySelectorAll("#publications .pub-item").forEach((li) => {
        const text = [...li.querySelectorAll(".pub-title, .pub-authors, .pub-venue")].map((e) => e.textContent).join(" ");
        li.hidden = q && !text.toLowerCase().includes(q);
      });
      document.querySelectorAll("#publications .pub-list").forEach((ol) => {
        const anyVisible = [...ol.children].some((li) => !li.hidden);
        ol.hidden = !anyVisible;
        const h = ol.previousElementSibling;
        if (h && h.classList.contains("pub-group")) h.hidden = !anyVisible;
      });
    });
  }

  // "Cite" opens the citation panel; "Copy" puts its text on the clipboard.
  const section = document.getElementById("publications");
  if (section) {
    section.addEventListener("click", (e) => {
      const cite = e.target.closest(".pub-cite-btn");
      if (cite) {
        const panel = cite.closest(".pub-item").querySelector(".pub-cite");
        panel.hidden = !panel.hidden;
        cite.setAttribute("aria-expanded", String(!panel.hidden));
        return;
      }
      const copy = e.target.closest(".pub-copy");
      if (copy) {
        const text = copy.closest(".pub-cite-block").querySelector(".pub-cite-body").textContent;
        const done = () => { copy.textContent = "Copied"; setTimeout(() => { copy.textContent = "Copy"; }, 1500); };
        const legacy = () => {
          const t = document.createElement("textarea");
          t.value = text; t.style.position = "fixed"; t.style.opacity = "0";
          document.body.appendChild(t); t.select();
          try { document.execCommand("copy"); done(); } catch (err) { /* nothing to do */ }
          t.remove();
        };
        if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(text).then(done, legacy);
        else legacy();
      }
    });
  }

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  fetch(`${ENDPOINT}?query=${encodeURIComponent(QUERY)}`, {
    headers: { Accept: "application/sparql-results+json" },
    signal: ctrl.signal,
  })
    .then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then((d) => {
      const pubs = toPubs(d.results.bindings);
      if (!pubs.length) throw new Error("empty");
      render(pubs);
    })
    .catch(showFallback)
    .finally(() => clearTimeout(timer));
})();
