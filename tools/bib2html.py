#!/usr/bin/env python3
"""Build the website's publication list from the CV bibliography.

Usage: python3 tools/bib2html.py [path/to/pubbl.bib]

Reads the CV's pubbl.bib (default: tools/pubbl.bib, a copy of the CV file) and
writes _src/_includes/publications_list.html, grouped by publication year,
newest first; within a year ordered by type as in the CV (`keywords` field).
No external packages; run it again whenever the CV bibliography changes.
"""
import html
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
BIB = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / "tools" / "pubbl.bib"
OUT = ROOT / "_src" / "_includes" / "publications_list.html"
ME = ("Francesco", "Fabiano")

GROUPS = [
    ("editor", "Editor", "E"),
    ("journal", "Journal Articles and Book Chapters", "J"),
    ("conference", "Conference Papers", "C"),
    ("report", "Technical Reports and Preprints", "T"),
]

ACCENTS = {"`": "\u0300", "'": "\u0301", "^": "\u0302", '"': "\u0308", "~": "\u0303"}


def parse_bib(text):
    """Return a list of dicts (lower-case field names, plus 'type' and 'key')."""
    entries, i = [], 0
    while True:
        m = re.compile(r"@(\w+)\s*\{").search(text, i)
        if not m:
            return entries
        etype, j, depth = m.group(1).lower(), m.end(), 1
        k = j
        while depth and k < len(text):
            depth += {"{": 1, "}": -1}.get(text[k], 0)
            k += 1
        body, i = text[j:k - 1], k
        if etype in ("preamble", "comment", "string"):
            continue
        key, _, rest = body.partition(",")
        entry, p = {"type": etype, "key": key.strip(), "raw": text[m.start():k]}, 0
        while True:
            fm = re.compile(r"\s*([A-Za-z_]+)\s*=\s*").match(rest, p)
            if not fm:
                break
            name, p = fm.group(1).lower(), fm.end()
            if rest[p] == "{":
                depth, q = 1, p + 1
                while depth:
                    depth += {"{": 1, "}": -1}.get(rest[q], 0)
                    q += 1
                value, p = rest[p + 1:q - 1], q
            elif rest[p] == '"':
                q = rest.index('"', p + 1)
                value, p = rest[p + 1:q], q + 1
            else:
                q = re.compile(r"[,\n}]").search(rest, p)
                q = q.start() if q else len(rest)
                value, p = rest[p:q].strip(), q
            entry[name] = value
            cm = re.compile(r"\s*,").match(rest, p)
            p = cm.end() if cm else p
        entries.append(entry)


def detex(s):
    """LaTeX to plain Unicode text (accents, braces, a few commands)."""
    s = re.sub(r"\$\\mathcal\{+(\w)\}+\$", lambda m: {"H": "\u210b"}.get(m.group(1), m.group(1)), s)
    s = re.sub(r"\\([`'^\"~])\{?\\?([A-Za-z])\}?", lambda m: m.group(2) + ACCENTS[m.group(1)], s)
    s = s.replace("\\&", "&").replace("--", "\u2013").replace("~", "\u00a0")
    s = re.sub(r"\\(textit|emph|textbf|noop)\{([^{}]*)\}", r"\2", s)
    s = s.replace("{", "").replace("}", "").replace("$", "")
    s = re.sub(r"\s+", " ", s).strip()
    import unicodedata
    return unicodedata.normalize("NFC", s)


def names(field):
    out = []
    for raw in re.split(r"\s+and\s+", field.strip()):
        raw = raw.strip()
        if "," in raw:
            last, first = [x.strip() for x in raw.split(",", 1)]
        else:
            parts = raw.rsplit(" ", 1)
            first, last = (parts[0], parts[1]) if len(parts) == 2 else ("", parts[0])
        first, last = detex(first), detex(last)
        full = html.escape(f"{first} {last}".strip())
        if (first, last) == ME:
            full = f"<b>{full}</b>"
        out.append(full)
    if len(out) > 1:
        return ", ".join(out[:-1]) + " and " + out[-1]
    return out[0] if out else ""


def venue(e):
    if e.get("journal"):
        v = detex(e["journal"])
        if e.get("volume"):
            v += f" {detex(e['volume'])}"
            if e.get("number"):
                v += f"({detex(e['number'])})"
    elif e.get("booktitle"):
        v = detex(e["booktitle"])
    elif e.get("series"):
        v = detex(e["series"]) + (f" {detex(e['volume'])}" if e.get("volume") else "")
    elif e.get("eprint"):
        v = f"arXiv:{e['eprint']}"
    else:
        v = detex(e.get("publisher", ""))
    v = v.rstrip(".")
    if e.get("pages"):
        v += f", pp. {detex(e['pages'])}"
    return v


def links(e):
    out = []
    if e.get("doi"):
        out.append(("DOI", "https://doi.org/" + e["doi"].strip().replace("\\", "")))
    if e.get("eprint") and "arxiv" in e.get("archiveprefix", "arxiv").lower():
        out.append(("arXiv", "https://arxiv.org/abs/" + e["eprint"].strip()))
    if e.get("url") and all(e["url"] != u for _, u in out):
        u = e["url"].strip().replace("\\", "")
        if "arxiv.org/abs/" not in u or not e.get("eprint"):
            out.append(("PDF" if u.endswith(".pdf") else "Link", u))
    return out


def item(e):
    title = html.escape(detex(e.get("title", "")).rstrip("."))
    who = names(e.get("author") or e.get("editor", ""))
    if not e.get("author") and e.get("editor"):
        who += " (eds.)"
    linked = " ".join(
        f'<a class="pub-link" href="{html.escape(u)}" target="_blank" rel="noopener">{lab}</a>'
        for lab, u in links(e))
    linked += '<button type="button" class="pub-link pub-cite-btn" aria-expanded="false">Cite</button>'
    plain_who = re.sub(r"<[^>]+>", "", who)
    plain = f"{html.unescape(plain_who)}. {detex(e.get('title', '')).rstrip('.')}. {venue(e)}, {e.get('year', '')}."
    if e.get("doi"):
        plain += " https://doi.org/" + e["doi"].strip().replace("\\", "")
    raw = re.sub(r"\n[ \t]*keywords\s*=\s*\{[^}]*\},?", "", e["raw"].strip())
    cite = ('      <div class="pub-cite" hidden>\n'
            '        <div class="pub-cite-block"><div class="pub-cite-head">BibTeX <button type="button" class="pub-copy">Copy</button></div>'
            f'<pre class="pub-cite-body">{html.escape(raw)}</pre></div>\n'
            '        <div class="pub-cite-block"><div class="pub-cite-head">Text <button type="button" class="pub-copy">Copy</button></div>'
            f'<p class="pub-cite-body">{html.escape(plain)}</p></div>\n'
            '      </div>\n')
    return (f'    <li class="pub-item">\n'
            f'      <span class="pub-title">{title}</span>\n'
            f'      <span class="pub-authors">{who}</span>\n'
            + (f'      <span class="pub-venue"><i>{html.escape(venue(e))}</i></span>\n' if venue(e) else "")
            + f'      <span class="pub-links">{linked}</span>\n'
            + cite
            + "    </li>")


def main():
    entries = parse_bib(BIB.read_text(encoding="utf-8"))
    parts = ["<!-- Generated by tools/bib2html.py from the CV bibliography. Do not edit by hand. -->"]
    order = {g[0]: i for i, g in enumerate(GROUPS)}
    year = lambda e: int(re.sub(r"\D", "", e.get("year", "0")) or 0)
    entries.sort(key=lambda e: (-year(e), order.get(e.get("keywords", "").strip(), len(GROUPS)),
                                detex(e.get("title", "")).lower()))
    total = len(entries)
    for y in sorted({year(e) for e in entries}, reverse=True):
        parts.append(f'<div class="pub-year">\n<h2 class="pub-group">{y or "Undated"}</h2>')
        parts.append('<ol class="pub-list">')
        parts += [item(e) for e in entries if year(e) == y]
        parts.append("</ol>\n</div>")
    missing = [e["key"] for e in entries if e.get("keywords", "").strip() not in {g[0] for g in GROUPS}]
    if missing:
        sys.exit(f"Entries without a known keywords group: {missing}")
    # {% raw %} keeps Jekyll's Liquid from reading BibTeX braces like {{AAAI}} as template tags.
    OUT.write_text(parts[0] + "\n{% raw %}\n" + "\n".join(parts[1:]) + "\n{% endraw %}\n", encoding="utf-8")
    print(f"{total} entries written to {OUT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
