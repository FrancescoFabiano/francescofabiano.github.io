// Home page: every few seconds the portrait dissolves into a cloud of pixels that flies
// into a drawing (a coat of arms, a Kripke structure, the Rome Marathon course, a quote
// from my thesis), and the text on the left transforms to tell its story. Each pass goes
// through every drawing once, in a random order, before the portrait comes back. Items come from _data/morph.yml
// (JSON in #morph-data). Click a drawing to go back to the portrait. Off with prefers-reduced-motion.
//
// Left and right arrows (left of the text and right of the picture on wide screens, either
// side of the picture on narrow ones; grid in _home.scss) step through the cycle, in a loop
// with the intro. Under the picture (under the text and the picture on wide screens) the
// Baganza river runs across, with two round buttons on it: home shows the portrait and starts
// the cycle again; pause / play switches the automatic changes off and on. While they are on,
// the river fills from its source to Parma as the countdown to the next card. Paused, there is
// no timer and the cards follow the order of morph.yml.
(function () {
  const img = document.getElementById("profile_pic");
  const dataEl = document.getElementById("morph-data");
  const textEl = document.getElementById("home-text");
  if (!img || !dataEl || !textEl) return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  let items;
  try { items = JSON.parse(dataEl.textContent); } catch (e) { return; }
  if (!Array.isArray(items) || !items.length) return;

  const HOLD = 9000, HOLD_QUOTE = 11000;  // how long a drawing (or a quote) stays
  const FIRST = [HOLD, HOLD];       // the portrait stays as long as any card, also at page load
  const FACE = [HOLD, HOLD];        // and between passes
  const FLY = 1400, STAGGER = 400, FADE = 200;  // pixels: about 2 s in all
  const BLEED = 0.25;               // room around the picture for the flying pixels, share of its size
  const TEXT_OUT = 300, TEXT_IN = 1700;         // text: about 2 s in all
  const BLOCK = 2.5;                // size of one particle, CSS px
  const PAD = 0.07;                 // margin around a drawing, share of the box

  const host = img.parentElement;
  if (getComputedStyle(host).position === "static") host.style.position = "relative";
  const stage = host.closest("section") || host;  // holds the arrows and the bar; carries morph-ready / morph-moving
  // Click a drawing to go back to the portrait (on the picture's box: the canvas lets clicks through).
  host.addEventListener("click", () => { if (shown >= 0 && !busy) go(-1); });
  const color = () => (getComputedStyle(document.documentElement).getPropertyValue("--theme-primary") || "#2E9CCA").trim() || "#2E9CCA";
  const homeHTML = textEl.innerHTML;
  const homeTitle = (textEl.querySelector(".home-title") || {}).innerHTML || "";
  const rand = ([a, b]) => a + Math.random() * (b - a);

  // Order: `seq` is the current pass (a shuffle of all items; file order in carousel mode),
  // `pos` the place in it.
  let seq = [], pos = -1;
  let manual = false;   // manual mode (see the button bar): no timer, arrows, file order
  const shuffle = () => {
    seq = items.map((_, i) => i);
    if (!manual) for (let i = seq.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [seq[i], seq[j]] = [seq[j], seq[i]]; }
    pos = -1;
  };
  shuffle();

  let forceFlight = "", forceWords = "";  // set only by the test hook
  let busy = false, shown = -1, canvas = null, timer = 0, cache = {}, cacheKey = "";

  // ---- Controls: the bar (the river, the home and pause / play buttons) and the arrows. ----
  const HOME_ICON = '<svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true"><path d="M4 11.2 12 4.5l8 6.7"/><path d="M6.5 9.5V19h4v-5h3v5h4V9.5"/></svg>';
  const PAUSE_ICON = '<svg class="morph-auto-icon" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M9.2 6.5v11M14.8 6.5v11"/></svg>';
  const PLAY_ICON = '<svg class="morph-auto-icon morph-auto-play" viewBox="0 0 24 24" width="15" height="15" aria-hidden="true"><path d="M9.2 6.5v11L17.7 12z"/></svg>';
  const AUTO_ICON = `<span class="morph-auto-glyph"></span>`;

  // The Baganza, from its source in the Apennines (left) past Calestano to Parma (right): its
  // course from OpenStreetMap (relation 2235693), turned to run left to right, simplified and
  // squashed in height, in a 1000 x 40 box. Five pieces, wider and wider downstream. It is the
  // countdown too: while the cards change by themselves, the water fills it from the source to
  // Parma, and the next card comes when it gets there.
  const RIVER = [
    "M0.9 30.7C1.8 30.2 3.8 28.0 6.6 27.4C9.5 26.7 15.1 27.2 17.8 26.7C20.5 26.3 20.2 25.1 22.7 24.5C25.3 24.0 30.7 23.9 33.3 23.4C35.8 23.0 36.8 22.6 38.0 21.8C39.2 21.0 39.3 19.3 40.7 18.5C42.0 17.7 41.9 17.4 46.1 17.0C50.3 16.7 61.7 16.5 66.0 16.6C70.4 16.8 69.3 18.0 72.3 17.9C75.3 17.9 81.2 16.5 84.2 16.2C87.2 15.9 88.7 15.9 90.5 16.0C92.3 16.1 93.9 16.9 95.1 16.9C96.4 16.9 95.1 16.0 98.0 15.9C101.0 15.8 109.7 16.2 112.7 16.2C115.7 16.1 114.0 15.4 115.8 15.5C117.7 15.7 121.2 16.7 123.9 16.8C126.6 16.9 130.4 16.6 132.0 16.3C133.7 16.0 128.6 15.5 133.5 15.0C138.4 14.6 155.7 14.0 161.5 13.6C167.3 13.2 165.5 12.5 168.1 12.4C170.7 12.3 175.0 13.2 177.0 13.3C179.0 13.3 179.3 12.7 180.2 12.7C181.1 12.7 179.4 13.2 182.4 13.4C185.4 13.5 193.8 13.9 198.2 13.5",
    "M198.2 13.5C202.6 13.2 204.9 11.6 208.8 11.2C212.7 10.7 217.2 11.6 221.6 10.8C225.9 10.0 230.0 7.4 235.1 6.5C240.2 5.5 242.8 4.9 252.1 5.0C261.5 5.1 283.1 6.4 291.1 7.1C299.1 7.9 296.9 9.0 300.2 9.3C303.6 9.7 308.8 8.8 311.2 9.2C313.6 9.7 313.2 11.8 314.7 12.1C316.2 12.5 317.3 11.2 320.3 11.4C323.2 11.7 329.4 13.3 332.2 13.6C335.0 13.9 333.5 12.3 337.1 13.1C340.6 13.9 349.4 17.3 353.5 18.4C357.6 19.4 360.2 18.9 361.9 19.2C363.5 19.6 362.0 20.1 363.3 20.6C364.6 21.0 367.4 21.5 369.6 21.8C371.8 22.1 375.5 21.9 376.5 22.2C377.5 22.5 375.1 23.1 375.5 23.6C375.9 24.0 376.1 24.4 378.7 24.9C381.4 25.5 387.4 26.4 391.4 26.8C395.4 27.2 396.8 27.8 402.8 27.6",
    "M402.8 27.6C408.7 27.3 416.9 25.2 427.0 25.2C437.0 25.1 454.7 26.6 463.1 27.3C471.4 28.0 472.9 28.4 477.0 29.4C481.0 30.4 483.9 32.7 487.3 33.4C490.8 34.1 494.8 33.5 497.7 33.8C500.6 34.0 500.7 35.1 504.8 35.0C509.0 34.9 516.8 33.4 522.5 33.1C528.2 32.8 534.6 33.3 539.1 33.1C543.6 32.8 543.0 31.7 549.6 31.5C556.1 31.2 570.9 31.9 578.5 31.6C586.2 31.2 584.0 29.2 595.6 29.2",
    "M595.6 29.2C607.2 29.2 636.5 31.4 648.0 31.5C659.4 31.6 659.1 30.0 664.3 29.9C669.6 29.8 674.5 30.8 679.5 30.9C684.4 31.1 688.4 30.6 693.9 30.7C699.4 30.8 705.5 31.8 712.2 31.6C719.0 31.4 728.7 29.8 734.2 29.4C739.8 29.1 737.6 30.0 745.6 29.4C753.5 28.8 771.2 26.5 781.9 25.9C792.6 25.2 803.1 25.5 809.8 25.5",
    "M809.8 25.5C816.4 25.6 818.6 25.9 821.9 26.3C825.1 26.7 825.8 27.5 829.0 27.7C832.2 28.0 837.3 27.9 841.2 27.7C845.1 27.5 847.0 26.6 852.6 26.6C858.1 26.7 868.2 27.8 874.2 27.8C880.3 27.8 884.5 26.6 889.0 26.8C893.4 27.0 897.6 28.4 901.1 28.8C904.6 29.2 906.2 29.3 910.0 29.2C913.9 29.0 919.6 27.7 924.2 27.9C928.8 28.0 932.9 29.8 937.8 30.2C942.8 30.6 950.9 30.0 953.9 30.2C956.9 30.4 949.6 31.6 955.7 31.6C961.9 31.6 983.3 30.4 990.6 30.3C998.0 30.1 998.4 30.7 1000.0 30.7"
  ];
  // Villages on the river (OpenStreetMap place nodes, put on the nearest point of the course),
  // in % of the box; the label goes under the river (or over it), centred on its dot or ending at it.
  // Parma is where the Baganza ends (it joins the Parma river in the city): its dot is the mouth.
  const TOWNS = [["Berceto", 11.6, 38.9, "under"], ["Calestano", 42.1, 64.4, "under end"],
    ["Felino", 72.2, 77.9, "under"], ["Parma", 100, 76.8, "under end keep"]];
  const riverSVG = (cls) => `<svg class="${cls}" viewBox="0 0 1000 40" preserveAspectRatio="none" aria-hidden="true">` +
    RIVER.map((d, k) => `<path d="${d}" style="stroke-width:${(1.1 + k * 0.45).toFixed(2)}px"/>`).join("") + "</svg>";
  const river = document.createElement("div");
  river.className = "morph-river";
  river.title = "The Baganza, from its source to Parma, past Calestano. River course \u00a9 OpenStreetMap contributors (ODbL).";
  river.innerHTML = riverSVG("morph-river-bed") + riverSVG("morph-river-flow") +
    `<span class="morph-river-label morph-scene-caption morph-cap-above">The river where I grew up</span>` +
    TOWNS.map(([name, x, y, side]) => `<span class="morph-river-dot${side.includes("keep") ? " morph-river-keep" : ""}" style="left:${x}%;top:${y}%"></span>` +
      `<span class="morph-river-label morph-river-town ${side.split(" ").map((c) => "morph-river-" + c).join(" ")}" style="left:${x}%;top:${y}%">${name}</span>`).join("") +
    "";
  const flow = river.querySelector(".morph-river-flow");
  const bed = river.querySelector(".morph-river-bed");

  // Height (0..40, box units) at x (0..1000) of a line drawn left to right as SVG paths.
  function yOnPaths(paths, x) {
    for (const path of paths) {
      const len = path.getTotalLength(), a = path.getPointAtLength(0), b = path.getPointAtLength(len);
      if (x < a.x || x > b.x) continue;
      let lo = 0, hi = len;
      for (let k = 0; k < 24; k++) { const m = (lo + hi) / 2; if (path.getPointAtLength(m).x < x) lo = m; else hi = m; }
      return path.getPointAtLength(lo).y;
    }
    return 20;
  }

  // The other scenes: a journey from one place to another, drawn left to right in the same
  // 1000 x 40 box, with a small vehicle that travels it as the countdown (it arrives when the
  // next card comes). Routes from OpenStreetMap (OSRM road routing: the bike on the paved SP15 and
  // SS62, the Vespa through towns on the SS62, so no motorway), turned to run left
  // to right, kept moving forward (hairpins smoothed out), simplified and squashed in height.
  const ICON = {
    plane: '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path class="fill" d="M21 12.2c0-.7-.6-1.2-1.3-1.2H15L10.4 3.6H8.6l2.2 7.4H6.3L4.6 8.8H3.2l1 3.4-1 3.4h1.4l1.7-2.2h4.5l-2.2 7.4h1.8L15 13.4h4.7c.7 0 1.3-.5 1.3-1.2z"/></svg>',
    car: '<svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true"><path class="fill" d="M3 15.6v-2.4c0-.6.4-1.1 1-1.3l2.4-.7 2.2-2.6c.4-.5 1-.7 1.6-.7h4.4c.6 0 1.2.3 1.6.8l2 2.5 1.9.5c.6.2 1 .7 1 1.3v2.6h-1.6a2.4 2.4 0 0 0-4.8 0H9.4a2.4 2.4 0 0 0-4.8 0z"/><circle class="fill" cx="7" cy="15.8" r="1.7"/><circle class="fill" cx="16.9" cy="15.8" r="1.7"/></svg>',
    // The bike and its rider, leaning forward, hands on the bars (limbs with background-coloured halos).
    bike: '<svg viewBox="0 -5 24 26" width="23" height="25" aria-hidden="true"><g class="line">' +
      '<circle cx="5.8" cy="15.5" r="3.6"/><circle cx="18.2" cy="15.5" r="3.6"/><path d="M5.8 15.5 9.6 8.6h5.6l3 6.9M9.6 8.6l2.9 6.9H5.8M8.4 7h2.6"/></g>' +
      [["M9.6 6.4 13.4 9.4 12.6 14.8", 2.2], ["M9.4 6.2 13.6 1.9", 2.8], ["M13.6 1.9 16.3 6.2", 1.4]].map(([d, w]) =>
        `<path class="halo" d="${d}" stroke-width="${w + 1.2}"/><path class="limb" d="${d}" stroke-width="${w}"/>`).join("") +
      '<circle class="hub" cx="15.4" cy="-.5" r="2.4"/><circle class="fill" cx="15.4" cy="-.5" r="1.8"/>' +
      '<g class="line"><path d="M14.2 6.4h2.6"/></g></svg>',
    // A classic small-frame Vespa: round rear cowl and seat, leg shield, front mudguard, headlamp on
    // the handlebar, and its rider sitting upright. Thin cuts in the page's background colour keep
    // the parts apart.
    vespa: '<svg viewBox="0 -8.5 28 28.5" width="31" height="32" aria-hidden="true"><g class="fill cut">' +
      '<circle cx="6.6" cy="16.4" r="2.6"/><circle cx="22.6" cy="16.4" r="2.6"/>' +
      '<path d="M1.6 15.4C1.6 11.2 4.1 8.6 8 8.6h2.6c1.3 0 2 .8 2 2.1v2.1h4.3c1.1-2.9 2-6 2.7-9h2.5c-.5 3.6-1.4 7-2.8 10.1-.3.9-1 1.5-2 1.5z"/>' +
      '<path d="M19.4 15.1c.3-2.4 1.6-3.7 3.3-3.7 1.8 0 3.1 1.3 3.4 3.7z"/><path d="M4.2 8.7c0-1 .7-1.6 1.7-1.6h4.4c.9 0 1.4.6 1.4 1.6z"/>' +
      '<rect x="18.3" y="2.4" width="6" height="1.3" rx=".65"/><circle cx="21.6" cy="3.6" r="1.5"/></g>' +
      [["M8.8 6.2 14.4 6.9 15.6 12.3", 2.6], ["M8.4 6.4 10.3-2.2", 3.4], ["M10.5-1.4 14.8 1.2 19.2 2.7", 1.6]].map(([d, w]) =>
        `<path class="halo" d="${d}" stroke-width="${w + 1.2}"/><path class="limb" d="${d}" stroke-width="${w}"/>`).join("") +
      '<circle class="hub" cx="11.1" cy="-5.4" r="2.6"/><circle class="fill" cx="11.1" cy="-5.4" r="2"/>' +
      '<circle class="hub" cx="6.6" cy="16.4" r=".8"/><circle class="hub" cx="22.6" cy="16.4" r=".8"/></svg>',
  };
  const JOURNEYS = [
    { name: "flight", d: "M8 32 Q500 0 992 32", from: ["London Heathrow", 0.8, 80], to: ["Bologna", 99.2, 80], icon: ICON.plane, turn: 1,
      caption: "Flying home", title: "Flying home: from London Heathrow to Bologna." },
    { name: "road", d: "M8.0 29.3C9.3 30.3 2.2 35.1 15.8 35.0C29.4 34.9 59.6 29.5 89.6 28.5C119.6 27.5 174.5 29.2 195.9 28.9C217.3 28.7 204.9 27.4 218.2 27.0C231.4 26.6 263.4 27.2 275.3 26.8C287.1 26.4 282.2 24.9 289.3 24.8C296.4 24.6 306.7 26.0 318.0 25.9C329.4 25.8 345.9 24.3 357.3 23.9C368.8 23.6 376.6 23.5 386.5 23.9C396.4 24.3 404.3 26.1 417.0 26.4C429.7 26.7 450.8 26.1 462.5 25.6C474.2 25.2 480.8 24.5 487.3 23.5C493.9 22.6 496.2 20.9 501.9 20.1C507.6 19.3 502.6 19.0 521.5 18.6C540.4 18.2 597.6 18.3 615.2 18.0C632.8 17.6 623.7 17.4 627.2 16.5C630.8 15.7 632.0 13.9 636.7 13.0C641.3 12.2 648.9 11.5 655.2 11.3C661.6 11.1 668.2 12.0 674.8 11.7C681.5 11.5 688.8 10.8 695.1 9.9C701.3 8.9 705.8 6.9 712.2 6.1C718.7 5.3 727.2 4.5 733.5 5.0C739.8 5.5 745.7 8.6 749.8 9.4C754.0 10.1 755.8 9.0 758.3 9.5C760.9 10.0 760.2 11.6 765.3 12.1C770.5 12.6 782.2 11.6 789.2 12.5C796.2 13.5 801.4 15.5 807.3 17.7C813.1 19.9 815.5 23.6 824.2 25.8C832.9 27.9 851.2 29.7 859.6 30.6C868.0 31.6 869.4 31.6 874.4 31.7C879.4 31.8 882.7 31.0 889.6 31.3C896.5 31.7 910.1 33.7 916.0 33.8C922.0 33.9 920.4 32.1 925.3 31.9C930.1 31.7 934.7 32.7 945.2 32.5C955.7 32.4 980.4 31.5 988.2 31.0C996.0 30.6 991.4 30.1 992.0 30.0", from: ["Felino", 0.8, 73.4, "under"], to: ["Calestano", 99.2, 74.9, "under"], stops: [["Pioppone", 71.9, 14.3, "over"]], icon: ICON.car, turn: 0.3,
      caption: "Sunday lunch at grandma\u2019s", title: "From Felino to Calestano past Pioppone by car, 16 km. Route © OpenStreetMap contributors (ODbL)." },
    { name: "bike", d: "M8.0 28.3C11.8 27.7 19.9 25.6 31.1 24.9C42.3 24.2 61.6 24.6 75.2 23.9C88.8 23.2 94.7 21.4 112.7 20.6C130.7 19.9 167.5 20.2 183.2 19.3C198.8 18.3 196.2 15.7 206.4 14.8C216.6 13.8 236.6 14.1 244.3 13.4C252.0 12.7 248.6 11.1 252.5 10.5C256.5 9.8 261.5 10.2 267.9 9.3C274.3 8.4 284.9 5.1 291.0 5.0C297.1 4.9 300.8 8.0 304.7 8.6C308.6 9.1 310.2 7.4 314.4 8.5C318.7 9.7 324.8 13.9 330.1 15.4C335.3 17.0 339.5 17.2 345.7 17.8C352.0 18.4 363.2 18.9 367.5 18.9C371.9 18.8 366.2 18.0 372.0 17.7C377.7 17.4 392.2 17.8 402.1 16.8C412.1 15.9 426.0 12.7 431.6 12.1C437.2 11.6 431.2 13.1 435.9 13.6C440.6 14.2 454.4 14.9 459.6 15.7C464.9 16.5 465.9 17.4 467.4 18.4C469.0 19.3 467.7 21.5 468.8 21.5C470.0 21.5 472.5 18.8 474.3 18.4C476.1 18.1 478.5 18.6 479.5 19.2C480.5 19.9 479.6 21.8 480.6 22.3C481.5 22.8 483.7 22.6 485.1 22.2C486.6 21.8 486.3 20.3 489.1 20.0C491.9 19.6 499.0 18.8 501.9 19.9C504.9 21.1 504.2 25.9 506.7 26.8C509.2 27.7 514.8 26.0 516.7 25.4C518.6 24.9 516.5 23.8 518.1 23.6C519.7 23.5 523.5 24.7 526.3 24.5C529.0 24.3 532.7 21.0 534.5 22.5C536.3 24.0 535.0 31.5 537.0 33.6C539.1 35.7 543.7 35.1 547.0 35.0C550.3 34.9 553.9 32.9 556.7 32.8C559.6 32.6 561.0 34.7 564.3 34.3C567.5 33.8 573.4 30.8 576.5 30.1C579.6 29.4 581.4 29.7 582.9 30.0C584.4 30.3 584.5 31.8 585.4 31.9C586.3 31.9 587.1 30.5 588.2 30.3C589.2 30.1 589.9 31.0 591.8 30.8C593.6 30.6 594.9 28.5 599.0 29.0C603.1 29.5 611.1 33.1 616.6 33.9C622.1 34.6 629.3 34.0 632.1 33.5C634.8 33.1 632.0 31.7 633.3 31.2C634.5 30.7 638.1 31.2 639.4 30.4C640.7 29.6 639.3 27.4 641.1 26.4C642.8 25.5 646.8 24.7 650.0 24.5C653.2 24.3 657.8 25.5 660.2 25.1C662.5 24.8 662.1 22.7 664.3 22.3C666.4 21.8 669.8 22.9 673.1 22.4C676.4 22.0 682.4 20.5 684.3 19.3C686.2 18.2 683.7 16.0 684.6 15.5C685.6 15.0 687.8 16.6 689.8 16.3C691.9 15.9 693.6 13.8 696.8 13.4C699.9 13.0 706.3 12.7 708.7 13.8C711.1 15.0 709.0 19.3 711.2 20.4C713.4 21.5 719.6 20.6 722.1 20.3C724.6 20.1 723.4 19.1 726.1 19.0C728.8 18.9 735.3 20.0 738.3 19.7C741.4 19.5 740.8 17.5 744.5 17.5C748.2 17.6 757.2 20.0 760.6 20.1C763.9 20.2 760.6 19.0 764.5 18.2C768.5 17.4 780.1 16.2 784.4 15.3C788.7 14.4 788.9 13.1 790.1 12.9C791.3 12.7 787.0 14.0 791.7 14.3C796.4 14.6 813.6 14.0 818.2 14.8C822.9 15.6 817.5 18.6 819.7 19.1C822.0 19.5 825.4 17.0 831.6 17.5C837.7 18.1 849.7 22.0 856.5 22.4C863.3 22.8 867.4 20.0 872.2 20.0C877.1 19.9 880.3 22.5 885.6 22.2C890.9 21.8 899.3 18.1 903.8 17.9C908.3 17.7 910.5 20.7 912.6 21.2C914.8 21.6 914.9 20.1 916.6 20.6C918.3 21.1 920.6 23.4 922.9 24.1C925.2 24.9 927.9 25.1 930.5 25.1C933.1 25.2 936.2 25.1 938.4 24.4C940.6 23.6 940.3 21.4 943.6 20.6C946.9 19.9 954.7 19.9 958.2 20.0C961.7 20.0 963.6 20.7 964.9 21.1C966.1 21.6 964.5 22.5 965.8 22.7C967.1 22.8 970.7 21.7 972.5 22.0C974.4 22.3 975.3 24.2 976.9 24.6C978.5 24.9 980.7 23.8 982.2 24.3C983.7 24.7 984.2 26.8 985.8 27.5C987.5 28.1 991.0 28.1 992.0 28.3", from: ["Felino", 0.8, 70.7, "under"], to: ["Passo della |Cisa", 99.2, 70.7, "under"], stops: [["Calestano", 39.8, 41.4, "under"], ["Berceto", 82.0, 47.6, "under"]], icon: ICON.bike, turn: 0.3,
      caption: "The hardest cycling day of my life", title: "From Felino up to the Cisa pass by bike, 49 km, through Calestano, Ravarano and Berceto. Route © OpenStreetMap contributors (ODbL)." },
    { name: "vespa", d: "M8.0 10.4C11.3 10.5 21.0 10.2 27.5 10.9C34.1 11.6 42.3 13.8 47.3 14.4C52.3 15.0 55.8 14.3 57.7 14.6C59.5 14.8 56.0 15.8 58.4 16.0C60.8 16.3 70.0 15.7 72.4 16.1C74.7 16.5 71.5 18.0 72.6 18.5C73.6 19.0 74.1 18.9 78.7 19.1C83.4 19.2 94.6 19.0 100.5 19.3C106.4 19.7 110.2 21.0 114.0 21.2C117.9 21.4 115.2 20.5 123.7 20.3C132.1 20.1 157.0 19.9 164.5 20.1C172.1 20.4 165.8 21.6 168.8 21.9C171.8 22.3 179.2 22.0 182.5 22.2C185.9 22.4 184.5 23.1 188.9 23.2C193.3 23.3 201.2 22.3 209.0 22.9C216.8 23.5 226.9 26.0 235.9 26.8C244.9 27.5 257.2 27.1 263.1 27.6C269.1 28.0 267.2 29.3 271.5 29.7C275.9 30.0 283.7 29.1 289.3 29.7C294.9 30.3 296.9 32.9 305.2 33.4C313.6 33.8 333.5 32.2 339.3 32.3C345.2 32.4 339.2 33.7 340.5 34.1C341.9 34.4 342.9 34.4 347.4 34.2C351.8 34.0 357.5 33.1 367.2 32.9C377.0 32.6 394.9 32.5 406.0 32.8C417.0 33.2 417.7 35.1 433.5 35.0C449.2 34.9 489.0 33.1 500.4 32.3C511.7 31.4 497.9 30.8 501.6 30.0C505.2 29.1 516.9 27.7 522.3 27.1C527.7 26.5 530.4 27.4 534.2 26.5C537.9 25.6 541.6 22.7 544.9 21.8C548.2 20.8 539.5 21.9 553.9 20.9C568.4 19.9 615.2 16.8 631.8 15.9C648.4 15.0 648.1 15.6 653.6 15.3C659.1 15.0 662.1 14.3 664.8 14.2C667.5 14.1 667.8 14.8 669.9 14.7C672.0 14.6 672.1 13.7 677.4 13.3C682.7 12.9 697.2 12.7 701.5 12.4C705.8 12.1 701.1 11.7 703.4 11.3C705.7 11.0 711.3 10.5 715.3 10.4C719.2 10.2 722.3 10.7 727.1 10.5C731.8 10.3 736.2 9.0 743.7 9.4C751.1 9.7 763.7 12.0 771.7 12.7C779.7 13.4 787.5 13.0 791.5 13.3C795.4 13.7 792.6 14.7 795.5 14.8C798.4 14.9 802.3 13.8 808.9 13.8C815.5 13.9 830.3 15.0 835.1 15.1C839.9 15.1 836.2 14.2 837.8 14.1C839.4 14.0 839.9 14.7 844.9 14.4C850.0 14.1 858.2 13.8 868.0 12.3C877.8 10.7 894.2 5.9 903.8 5.0C913.3 4.1 921.3 6.0 925.2 6.6C929.1 7.2 925.1 8.4 927.3 8.7C929.4 8.9 934.8 8.0 938.3 8.2C941.7 8.3 942.1 9.2 948.0 9.7C953.9 10.2 968.0 11.2 973.7 11.2C979.3 11.3 978.9 10.2 981.9 10.0C985.0 9.9 990.3 10.4 992.0 10.4", from: ["Calestano", 0.8, 26.0, "under"], to: ["Lerici", 99.2, 26.1, "over"], stops: [["Passo della Cisa", 30.1, 80.6, "under"], ["Aulla", 72.9, 25.6, "over"], ["Sarzana", 90.5, 13.0, "over"]], icon: ICON.vespa, turn: 0.3,
      caption: "Weekend at the beach on my ET3", title: "From Calestano over the Cisa pass to Lerici on my Vespa ET3, 97 km on the old Strada della Cisa, through Aulla and Sarzana. Route © OpenStreetMap contributors (ODbL)." },
  ];
  function journey(j) {
    const el = document.createElement("div");
    el.className = `morph-route morph-route-${j.name}`;
    el.title = j.title;
    const svg = (cls, paths) => `<svg class="${cls}" viewBox="0 0 1000 40" preserveAspectRatio="none" aria-hidden="true">${paths}</svg>`;
    // "Passo della |Cisa": the part before the bar is left out on phones.
    const town = (name) => name.replace(/^(.*)\|/, '<span class="morph-wide-only">$1</span>');
    const end = ([name, x, y, side], cls) => `<span class="morph-river-dot morph-river-keep" style="left:${x}%;top:${y}%"></span>` +
      `<span class="morph-river-label morph-river-town morph-river-keep morph-river-${side || (y < 50 ? "over" : "under")} ${cls}" style="left:${x}%;top:${y}%">${town(name)}</span>`;
    el.innerHTML = svg("morph-route-bed", `<path class="band" d="${j.d}"/><path class="line" d="${j.d}"/>`) +
      svg("morph-route-flown", `<path d="${j.d}"/>`) + end(j.from, "morph-route-from") + end(j.to, "morph-river-end") +
      (j.stops || []).map(([name, x, y, side]) => `<span class="morph-river-dot" style="left:${x}%;top:${y}%"></span>` +
        `<span class="morph-river-label morph-river-town morph-river-${side}" style="left:${x}%;top:${y}%">${name}</span>`).join("") +
      `<span class="morph-mover" aria-hidden="true">${j.icon}</span>` +
      `<span class="morph-river-label morph-scene-caption morph-cap-above">${j.caption}</span>`;
    const path = el.querySelector(".morph-route-bed .line"), mover = el.querySelector(".morph-mover");
    return {
      el, flow: el.querySelector(".morph-route-flown"),
      lineY: (x) => yOnPaths([path], x),
      // Put the vehicle at t (0..1) along its way, turned along it (up to `turn` radians).
      place(t) {
        const w = el.clientWidth, h = el.clientHeight;
        if (!w) return;
        const len = path.getTotalLength(), at = (l) => path.getPointAtLength(Math.max(0, Math.min(len, l)));
        const p = at(t * len), a = at(t * len - 3), b = at(t * len + 3);
        const ang = Math.max(-j.turn, Math.min(j.turn, Math.atan2(((b.y - a.y) / 40) * h, ((b.x - a.x) / 1000) * w)));
        mover.style.transform = `translate(${((p.x / 1000) * w).toFixed(1)}px, ${((p.y / 40) * h).toFixed(1)}px) rotate(${ang.toFixed(3)}rad)`;
      },
    };
  }

  // The scenes take turns, one per card: the river, then each journey. Each shows its caption for 3 s.
  const scenes = [{ el: river, flow, lineY: (x) => yOnPaths(bed.querySelectorAll("path"), x), place: null }, ...JOURNEYS.map(journey)];
  let scene = 0, captionTimer = 0;
  // The next scene comes in while the picture changes (a slow crossfade, the buttons glide to
  // its line); its caption and countdown start once the new card is in place.
  function showScene(k) {
    scene = k;
    scenes.forEach((sc, i) => {
      sc.el.classList.toggle("morph-scene-on", i === k);
      if (i !== k) sc.el.classList.remove("morph-caption-on");
    });
    if (scenes[k].place) scenes[k].place(0);
    seatButtons();
  }
  function showCaption() {
    const el = scenes[scene].el;
    el.classList.add("morph-caption-on");
    clearTimeout(captionTimer);
    captionTimer = setTimeout(() => el.classList.remove("morph-caption-on"), 3000);
  }
  const lineY = (x) => scenes[scene].lineY(x);

  // The line on show runs through the middle of each button: each one moves
  // up or down to it.
  function seatButtons() {
    const box = bar.getBoundingClientRect();
    if (!box.width) return;
    // Layout positions (offsetLeft/Top, relative to the bar), not the moving, transformed ones.
    bar.querySelectorAll(".morph-btn").forEach((b) => {
      const cx = b.offsetLeft + b.offsetWidth / 2, cy = b.offsetTop + b.offsetHeight / 2;
      const y = (lineY((cx / box.width) * 1000) / 40) * box.height;
      b.style.transform = `translateY(${(y - cy).toFixed(1)}px)`;
    });
    if (scenes[scene].place && manual) scenes[scene].place(0);
  }
  const bar = document.createElement("div");
  bar.className = "morph-controls";
  bar.append(...scenes.map((sc) => sc.el));
  const mkBtn = (cls, html, label, fn) => {
    const b = document.createElement("button");
    b.type = "button"; b.className = cls; b.innerHTML = html;
    b.setAttribute("aria-label", label); b.title = label;
    b.addEventListener("click", (e) => { e.stopPropagation(); if (!busy) fn(); });
    bar.appendChild(b);
    return b;
  };
  mkBtn("morph-btn morph-btn-home", HOME_ICON, "Back to the start", () => restart());
  const autoBtn = mkBtn("morph-btn morph-btn-auto", AUTO_ICON, "Automatic", () => setManual(!manual));
  const updateBar = () => {
    autoBtn.setAttribute("aria-pressed", String(!manual));
    const label = manual ? "Play: the cards change by themselves" : "Pause: change the cards with the arrows";
    autoBtn.title = label; autoBtn.setAttribute("aria-label", label);
    autoBtn.querySelector(".morph-auto-glyph").innerHTML = manual ? PLAY_ICON : PAUSE_ICON;
  };
  const mkArrow = (dir, label) => {
    const b = document.createElement("button");
    b.type = "button"; b.className = `morph-arrow morph-arrow-${dir}`; b.setAttribute("aria-label", label); b.title = label;
    b.addEventListener("click", (e) => { e.stopPropagation(); if (!busy) (dir === "next" ? advance() : back()); });
    return b;
  };
  const prevArrow = mkArrow("prev", "Previous"), nextArrow = mkArrow("next", "Next");
  stage.prepend(prevArrow);
  stage.append(nextArrow, bar);  // the bar goes under the picture (grid in _home.scss)
  let flowAnim = null;

  let planeRaf = 0;
  function countdown(ms) {
    if (flowAnim) flowAnim.cancel();
    cancelAnimationFrame(planeRaf);
    const fill = [{ clipPath: "inset(0 100% 0 0)" }, { clipPath: "inset(0 0 0 0)" }], timing = { duration: ms, easing: "linear", fill: "forwards" };
    const sc = scenes[scene];
    flowAnim = sc.flow.animate(fill, timing);
    if (sc.place) {
      const t0 = performance.now();
      const step = (now) => { const t = Math.min(1, (now - t0) / ms); sc.place(t); if (t < 1 && !manual) planeRaf = requestAnimationFrame(step); };
      planeRaf = requestAnimationFrame(step);
    }
    stage.classList.add("morph-ready");
  }
  const later = (ms) => {
    clearTimeout(timer);
    if (manual) { stage.classList.add("morph-ready"); return; }  // manual: no timer
    timer = setTimeout(tick, ms); countdown(ms);
  };
  const holdFor = (i) => (i < 0 ? rand(FACE) : items[i].quote ? HOLD_QUOTE : HOLD);

  // ---- Text: the old text blurs away, the new one decodes letter by letter. ----
  // The text is revealed left to right; only a short tip of letters scrambles, and it changes
  // every few frames. Letters not reached yet keep their place (hidden), so lines never jump.
  const GLYPHS = "abcdefghijklmnopqrstuvwxyz";
  const TIP = 6, SCRAMBLE_MS = 90;
  function decode(root, ms) {
    return new Promise((done) => {
      const texts = [], walk = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      while (walk.nextNode()) if (walk.currentNode.nodeValue.trim()) texts.push(walk.currentNode);
      const cells = [], groups = [];
      for (const n of texts) {
        const frag = document.createDocumentFragment(), spans = [];
        for (const ch of n.nodeValue) {
          const sp = document.createElement("span");
          sp.textContent = ch; sp.style.visibility = "hidden";
          spans.push(sp); frag.appendChild(sp); cells.push({ sp, ch });
        }
        groups.push({ n, spans, parent: n.parentNode });
        n.parentNode.replaceChild(frag, n);
      }
      const total = cells.length;
      if (!total) return done();
      const t0 = performance.now();
      let lastScramble = 0;
      const frame = (now) => {
        const p = Math.min(1, (now - t0) / ms);
        const head = Math.floor(p * (total + TIP));
        const reshuffle = now - lastScramble > SCRAMBLE_MS;
        if (reshuffle) lastScramble = now;
        for (let k = 0; k < total; k++) {
          const c = cells[k];
          if (k < head - TIP) { if (c.state !== 2) { c.sp.textContent = c.ch; c.sp.style.visibility = ""; c.state = 2; } }
          else if (k < head && c.ch.trim()) {
            if (c.state !== 1 || reshuffle) { c.sp.textContent = GLYPHS[(Math.random() * GLYPHS.length) | 0]; c.sp.style.visibility = ""; c.state = 1; }
          } else if (k < head) { c.sp.style.visibility = ""; c.state = 2; }
        }
        if (p < 1) return requestAnimationFrame(frame);
        for (const g of groups) {  // put the plain text nodes back
          const first = g.spans[0];
          if (first && first.parentNode) { first.parentNode.insertBefore(g.n, first); for (const sp of g.spans) sp.remove(); }
        }
        done();
      };
      requestAnimationFrame(frame);
    });
  }
  // A card title may take no more lines than "Hi, I'm Francesco." does at this width, and no
  // word may run past its column (e.g. "Anthropology-" next to the picture): if either would
  // happen, its font shrinks a little at a time until it fits.
  function fitTitle() {
    const h = textEl.querySelector(".home-title");
    if (!h || textEl.innerHTML === homeHTML) return;
    const probe = document.createElement("h1");
    probe.className = "home-title"; probe.innerHTML = homeTitle;
    Object.assign(probe.style, { position: "absolute", visibility: "hidden", width: h.getBoundingClientRect().width + "px" });
    textEl.appendChild(probe);
    const limit = probe.getBoundingClientRect().height + 2;
    probe.remove();
    let size = parseFloat(getComputedStyle(h).fontSize);
    const min = size * 0.55;
    const tooBig = () => h.getBoundingClientRect().height > limit || h.scrollWidth > h.clientWidth + 1;
    while (tooBig() && size > min) { size *= 0.94; h.style.fontSize = size + "px"; }
  }
  // Several ways for the new text to appear, picked at random (never twice in a row).
  const WORDS = ["decode", "blur", "wipe", "rise"];
  let lastWords = "";
  const pickWords = () => { if (forceWords) return forceWords; let m; do m = WORDS[(Math.random() * WORDS.length) | 0]; while (m === lastWords); return (lastWords = m); };
  function rise(root, ms) {  // words float up one after another
    return new Promise((done) => {
      const texts = [], walk = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      while (walk.nextNode()) if (walk.currentNode.nodeValue.trim()) texts.push(walk.currentNode);
      const words = [], groups = [];
      for (const n of texts) {
        // Words, split also after a hyphen or a slash: the plain text can break there, so the
        // lines while the words rise are the same as after (e.g. "700-year-old").
        const frag = document.createDocumentFragment(), parts = n.nodeValue.split(/(\s+)|(?<=[-\u2010-\u2014/])(?=\S)/), nodes = [];
        for (const w of parts) {
          if (!w) continue;  // also the undefined slots of the split
          if (/^\s+$/.test(w)) { const t = document.createTextNode(w); frag.appendChild(t); nodes.push(t); continue; }
          const sp = document.createElement("span"); sp.textContent = w; sp.style.display = "inline-block"; sp.style.opacity = "0";
          frag.appendChild(sp); nodes.push(sp); words.push(sp);
        }
        groups.push({ n, nodes }); n.parentNode.replaceChild(frag, n);
      }
      const each = ms * 0.45, gap = words.length > 1 ? (ms - each) / (words.length - 1) : 0;
      const anims = words.map((sp, k) => sp.animate([{ opacity: 0, transform: "translateY(0.6em)" }, { opacity: 1, transform: "none" }],
        { duration: each, delay: k * gap, easing: "cubic-bezier(.2,.7,.2,1)", fill: "forwards" }));
      Promise.all(anims.map((x) => x.finished)).catch(() => {}).then(() => {
        for (const g of groups) { const first = g.nodes[0]; if (first && first.parentNode) { first.parentNode.insertBefore(g.n, first); for (const x of g.nodes) x.remove(); } }
        done();
      });
    });
  }
  const swapText = (html) => new Promise((done) => {
    const out = textEl.animate([{ opacity: 1, filter: "blur(0)" }, { opacity: 0, filter: "blur(8px)" }],
      { duration: TEXT_OUT, fill: "forwards", easing: "ease-in" });
    out.onfinish = () => {
      textEl.innerHTML = html;
      fitTitle();
      const mode = pickWords();
      out.cancel();
      if (mode === "blur") {
        textEl.animate([{ opacity: 0, filter: "blur(10px)" }, { opacity: 1, filter: "blur(0)" }], { duration: TEXT_IN, easing: "ease-out" }).onfinish = done;
      } else if (mode === "wipe") {
        textEl.animate([{ clipPath: "inset(0 100% 0 0)" }, { clipPath: "inset(0 0 0 0)" }], { duration: TEXT_IN, easing: "cubic-bezier(.6,0,.2,1)" }).onfinish = done;
      } else if (mode === "rise") {
        rise(textEl, TEXT_IN).then(done);
      } else {
        const vis = textEl.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 200, fill: "forwards" });
        decode(textEl, TEXT_IN).then(() => { vis.finish(); done(); });
      }
    };
  });
  const esc = (s) => String(s || "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const blue = (s) => String(s || "").replace(/<span>/g, '<span class="text-primary">');
  function itemHTML(it) {
    let html = `<h1 class="home-title">${blue(it.title)}</h1><div class="home-content"><p>${blue(it.text)}</p>`;
    if (it.credit) {
      const c = it.credit_link ? `<a target="_blank" rel="noopener" href="${esc(it.credit_link)}">${esc(it.credit)}</a>` : esc(it.credit);
      html += `<p class="morph-credit">${c}</p>`;
    }
    return html + "</div>";
  }

  // ---- Drawing. ----
  function geometry() {
    const box = img.getBoundingClientRect(), hbox = host.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    return { box, hbox, dpr, W: Math.round(box.width * dpr), H: Math.round(box.height * dpr) };
  }
  const loadImage = (src) => new Promise((ok, ko) => { const im = new Image(); im.onload = () => ok(im); im.onerror = ko; im.src = src; });
  function wrap(ctx, text, max) {
    const words = text.split(/\s+/), lines = [];
    let line = "";
    for (const w of words) { const t = line ? line + " " + w : w; if (ctx.measureText(t).width > max && line) { lines.push(line); line = w; } else line = t; }
    if (line) lines.push(line);
    return lines;
  }
  // Paint item `i` (or the portrait, i = -1) into a W x H canvas, crisp.
  async function paint(i, g) {
    const c = document.createElement("canvas");
    c.width = g.W; c.height = g.H;
    const ctx = c.getContext("2d", { willReadFrequently: true });
    if (i < 0) {
      const s = Math.max(g.W / img.naturalWidth, g.H / img.naturalHeight);
      const dw = img.naturalWidth * s, dh = img.naturalHeight * s;
      ctx.drawImage(img, (g.W - dw) / 2, (g.H - dh) / 2, dw, dh);
      return c;
    }
    const it = items[i];
    const x0 = g.W * PAD, y0 = g.H * PAD, w = g.W * (1 - 2 * PAD), h = g.H * (1 - 2 * PAD);
    if (it.image) {
      const im = await loadImage(it.image);
      const iw = im.naturalWidth || 1000, ih = im.naturalHeight || 1000, s = Math.min(w / iw, h / ih);
      ctx.drawImage(im, x0 + (w - iw * s) / 2, y0 + (h - ih * s) / 2, iw * s, ih * s);
    } else if (it.quote) {
      const sans = (getComputedStyle(document.documentElement).getPropertyValue("--sans-serif") || "sans-serif").trim();
      const serif = 'Georgia, "Times New Roman", serif';
      ctx.fillStyle = color(); ctx.textAlign = "center"; ctx.textBaseline = "alphabetic";
      let size = Math.round(h / 6), blocks;
      for (; size > 10; size -= 2) {
        const q = { font: `italic 400 ${size}px ${serif}`, lh: size * 1.3 };
        ctx.font = q.font; q.lines = wrap(ctx, "“" + it.quote + "”", w);
        const t = it.translation ? { font: `italic 300 ${size * 0.62}px ${sans}`, lh: size * 0.62 * 1.35 } : null;
        if (t) { ctx.font = t.font; t.lines = wrap(ctx, it.translation, w); }
        const a = { font: `300 ${size * 0.5}px ${sans}`, lh: size * 0.5 * 1.4 };
        ctx.font = a.font; a.lines = wrap(ctx, "— " + it.author, w);
        blocks = [q, t, a].filter(Boolean);
        const total = blocks.reduce((s, b) => s + b.lines.length * b.lh, 0) + size * 0.9 * (blocks.length - 1);
        if (total <= h) { blocks.total = total; break; }
      }
      let y = y0 + (h - blocks.total) / 2;
      blocks.forEach((b, k) => {
        ctx.font = b.font;
        for (const l of b.lines) { y += b.lh; ctx.fillText(l, x0 + w / 2, y - b.lh * 0.25); }
        if (k < blocks.length - 1) y += size * 0.9;
      });
    }
    return c;
  }
  // Particles: one per inked block; also the bounding box of the ink (CSS px).
  function sample(c, g) {
    const B = Math.max(1, Math.round(BLOCK * g.dpr));
    const d = c.getContext("2d", { willReadFrequently: true }).getImageData(0, 0, g.W, g.H).data;
    const pts = [];
    let l = g.W, t = g.H, r = 0, b = 0;
    for (let y = 0; y < g.H; y += B) {
      for (let x = 0; x < g.W; x += B) {
        const cx = Math.min(g.W - 1, x + (B >> 1)), cy = Math.min(g.H - 1, y + (B >> 1));
        if (d[(cy * g.W + cx) * 4 + 3] > 90 || d[(y * g.W + x) * 4 + 3] > 90) {
          pts.push(x, y);
          if (x < l) l = x; if (y < t) t = y; if (x > r) r = x; if (y > b) b = y;
        }
      }
    }
    if (r < l) { l = 0; t = 0; r = g.W; b = g.H; }
    return { pts, B, bb: { left: l / g.dpr, top: t / g.dpr, right: (r + B) / g.dpr, bottom: (b + B) / g.dpr } };
  }
  async function shape(i, g) {
    const key = `${g.W}x${g.H}`;
    if (key !== cacheKey) { cache = {}; cacheKey = key; }
    if (!cache[i]) { const c = await paint(i, g); cache[i] = { canvas: c, ...sample(c, g) }; }
    return cache[i];
  }
  const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

  // Several ways for the pixels of `from` to become `to`, picked at random (never twice in a row).
  // Each takes about 2 s and ends by fading into the crisp `to`.
  // All stay inside the picture's box: no pixel flies far out of it.
  const FLIGHTS = ["swarm", "sweep", "spiral", "ripple", "fall"];
  let lastFlight = "";
  const pickFlight = () => { if (forceFlight) return forceFlight; let m; do m = FLIGHTS[(Math.random() * FLIGHTS.length) | 0]; while (m === lastFlight); return (lastFlight = m); };
  function fly(cv, from, to, mode = pickFlight()) {
    return new Promise((done) => {
      const ctx = cv.getContext("2d");
      // The drawing is W x H; the canvas is larger by a margin on every side (BLEED), so pixels
      // that fly out of the picture's box are not cut off at its invisible edges.
      const W = to.canvas.width, H = to.canvas.height, cx = W / 2, cy = H / 2;
      const mx = (cv.width - W) / 2, my = (cv.height - H) / 2;
      const a = from.pts, b = to.pts, na = a.length / 2, nb = b.length / 2, n = Math.max(na, nb, 1);
      const perm = (m) => { const p = new Uint32Array(n); for (let i = 0; i < n; i++) p[i] = i < m ? i : (Math.random() * m) | 0; for (let i = n - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; const t = p[i]; p[i] = p[j]; p[j] = t; } return p; };
      let pa = perm(na), pb = perm(nb);
      const key = { sweep: (arr, k) => arr[k * 2], fall: (arr, k) => arr[k * 2 + 1], spiral: (arr, k) => Math.atan2(arr[k * 2 + 1] - cy, arr[k * 2] - cx) }[mode];
      if (key) { pa = Uint32Array.from(pa).sort((x, y) => key(a, x) - key(a, y)); pb = Uint32Array.from(pb).sort((x, y) => key(b, x) - key(b, y)); }
      const P = new Float32Array(n * 6);  // x0 y0 x1 y1 delay extra
      const RMAX = Math.hypot(W, H) / 2;
      for (let i = 0; i < n; i++) {
        const o = i * 6;
        P[o] = na ? a[pa[i] * 2] : cx; P[o + 1] = na ? a[pa[i] * 2 + 1] : cy;
        P[o + 2] = nb ? b[pb[i] * 2] : cx; P[o + 3] = nb ? b[pb[i] * 2 + 1] : cy;
        P[o + 4] = mode === "sweep" ? (P[o + 2] / W) * STAGGER * 0.6       // left to right
          : mode === "fall" ? (P[o + 3] / H) * STAGGER * 0.6                  // top to bottom
          : mode === "ripple" ? (Math.hypot(P[o + 2] - cx, P[o + 3] - cy) / RMAX) * STAGGER  // centre outwards
          : Math.random() * STAGGER;
        P[o + 5] = (Math.random() - 0.5) * 0.5;
      }
      const B = to.B, fill = color(), t0 = performance.now(), fly_ = FLY;
      const frame = (now) => {
        const el = now - t0;
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, cv.width, cv.height);
        ctx.translate(mx, my);
        const fade = Math.max(0, Math.min(1, (el - FLY - STAGGER) / FADE));
        if (fade < 1) {
          ctx.globalAlpha = 1 - fade; ctx.fillStyle = fill; ctx.beginPath();
          for (let i = 0; i < n; i++) {
            const o = i * 6, raw = Math.max(0, Math.min(1, (el - P[o + 4]) / fly_)), t = ease(raw);
            let x, y;
            if (mode === "spiral") {     // polar interpolation with an extra quarter turn
              const a0 = Math.atan2(P[o + 1] - cy, P[o] - cx), r0 = Math.hypot(P[o] - cx, P[o + 1] - cy);
              let a1 = Math.atan2(P[o + 3] - cy, P[o + 2] - cx); const r1 = Math.hypot(P[o + 2] - cx, P[o + 3] - cy);
              while (a1 - a0 > Math.PI) a1 -= 2 * Math.PI; while (a0 - a1 > Math.PI) a1 += 2 * Math.PI;
              const ang = a0 + (a1 - a0) * t + Math.sin(Math.PI * t) * Math.PI / 2, rad = r0 + (r1 - r0) * t;
              x = cx + Math.cos(ang) * rad; y = cy + Math.sin(ang) * rad;
            } else if (mode === "fall") {        // straight down to the target, with a slight sway
              x = P[o] + (P[o + 2] - P[o]) * t + Math.sin(Math.PI * t * 2 + P[o + 5] * 12) * W * 0.012 * Math.sin(Math.PI * t);
              y = P[o + 1] + (P[o + 3] - P[o + 1]) * t;
            } else {                             // swarm, sweep and ripple: straight flight with a slight bend
              const dx = P[o + 2] - P[o], dy = P[o + 3] - P[o + 1];
              const bend = Math.sin(Math.PI * t) * (mode === "sweep" ? 0.08 : mode === "ripple" ? 0.04 : P[o + 5]);
              x = P[o] + dx * t - dy * bend; y = P[o + 1] + dy * t + dx * bend;
            }
            ctx.rect(x, y, B, B);
          }
          ctx.fill();
        }
        if (fade > 0) { ctx.globalAlpha = fade; ctx.drawImage(to.canvas, 0, 0); }
        ctx.globalAlpha = 1;
        if (fade < 1) requestAnimationFrame(frame); else done();
      };
      requestAnimationFrame(frame);
    });
  }

  // ---- Moving between the portrait (-1) and the items. ----
  async function go(target) {
    if (busy || target === shown) return;
    busy = true; clearTimeout(timer);
    try {
      const g = geometry();
      if (!g.W || !g.H) throw new Error("no box");
      const [from, to] = await Promise.all([shape(shown, g), shape(target, g)]);
      if (!canvas) {
        canvas = document.createElement("canvas");
        canvas.className = "morph-canvas"; canvas.setAttribute("aria-hidden", "true");
        const m = Math.round(Math.max(g.W, g.H) * BLEED);  // device px on every side
        Object.assign(canvas.style, {
          position: "absolute", left: g.box.left - g.hbox.left - m / g.dpr + "px", top: g.box.top - g.hbox.top - m / g.dpr + "px",
          width: (g.W + 2 * m) / g.dpr + "px", height: (g.H + 2 * m) / g.dpr + "px", zIndex: 1, pointerEvents: "none",
        });
        canvas.width = g.W + 2 * m; canvas.height = g.H + 2 * m;
        host.appendChild(canvas);
        img.style.visibility = "hidden";
      }
      stage.classList.add("morph-moving");
      if (flowAnim) flowAnim.cancel();
      cancelAnimationFrame(planeRaf);
      showScene((scene + 1) % scenes.length);
      await Promise.all([fly(canvas, from, to), swapText(target < 0 ? homeHTML : itemHTML(items[target]))]);
      shown = target;
      if (manual && target < 0) pos = -1;  // the manual loop starts again at the intro
      if (target < 0) { canvas.remove(); canvas = null; img.style.visibility = ""; }
    } catch (e) {
      if (canvas) canvas.remove();
      canvas = null; shown = -1; img.style.visibility = ""; textEl.innerHTML = homeHTML;
    }
    stage.classList.remove("morph-moving");
    showCaption();
    host.classList.toggle("morph-clickable", shown >= 0);
    host.title = shown >= 0 ? "Back to the portrait" : "";
    busy = false;
    updateBar();
    later(holdFor(shown));
  }

  // Home button, in both modes: the portrait, and the cycle starts again from it.
  function restart() {
    shuffle();
    if (shown >= 0) return go(-1);
    later(holdFor(-1));
  }

  // Left arrow: previous card; from the first card to the intro, from the intro to the last card.
  function back() {
    if (shown < 0) { pos = seq.length - 1; return go(seq[pos]); }
    if (pos <= 0) { pos = -1; return go(-1); }
    pos--;
    go(seq[pos]);
  }

  // Manual: no timer, the cards in file order from where we are. Automatic: a new random
  // pass that starts with the card on screen, and the timer.
  function setManual(on) {
    manual = on;
    stage.classList.toggle("morph-manual", on);
    updateBar();
    if (on) {
      shuffle();    // file order
      pos = shown;  // in file order the place of card i is i; -1 on the portrait
      clearTimeout(timer);
      if (flowAnim) flowAnim.cancel();
      cancelAnimationFrame(planeRaf);
      if (scenes[scene].place) scenes[scene].place(0);
    } else {
      shuffle();
      if (shown >= 0) { seq.splice(seq.indexOf(shown), 1); seq.unshift(shown); pos = 0; }
      later(holdFor(shown));
    }
  }

  const visible = () => {
    if (document.hidden) return false;
    const r = img.getBoundingClientRect();
    return r.bottom > 0 && r.top < window.innerHeight && r.width > 0;
  };

  // Automatic step: from the portrait to the first item of the pass, then item after item;
  // after the last one, back to the portrait and a new pass.
  function advance() {
    if (shown >= 0 && pos >= seq.length - 1) { shuffle(); return go(-1); }  // pass over: the portrait, then a new pass
    if (pos >= seq.length - 1) shuffle();
    pos++;
    go(seq[pos]);
  }
  function tick() {
    if (busy) return;
    if (!visible()) { clearTimeout(timer); timer = setTimeout(tick, 4000); return; }
    advance();
  }

  // A resize: go straight back to the portrait.
  if (window.ResizeObserver) new ResizeObserver(seatButtons).observe(bar);
  window.addEventListener("resize", () => {
    if (busy) return;
    if (canvas) { canvas.remove(); canvas = null; }
    img.style.visibility = "";
    if (shown >= 0) { shown = -1; textEl.innerHTML = homeHTML; }
    host.classList.remove("morph-clickable"); host.title = "";
    if (manual) pos = -1;
    updateBar();
    cache = {}; cacheKey = "";
    const g = geometry();
    shape(-1, g).catch(() => {});
    later(rand(FACE));
  });

  // Test hook: window.__morph(i, flight, words) shows item i now (-1 or nothing: the portrait).
  window.__morph = (i, flight = "", words = "") => { forceFlight = flight; forceWords = words; return go(i === undefined ? -1 : i).finally(() => { forceFlight = forceWords = ""; }); };

  (img.complete && img.naturalWidth ? Promise.resolve() : img.decode())
    .then(() => shape(-1, geometry()))
    .then(() => { updateBar(); showScene(0); showCaption(); later(rand(FIRST)); })
    .catch(() => {});
})();
