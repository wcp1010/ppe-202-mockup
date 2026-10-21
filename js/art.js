/* PPE 202 — etched line art, generated as SVG. Colors come from CSS tokens via classes. */
(function () {
  const NS = "http://www.w3.org/2000/svg";
  let uid = 0;

  function rng(seed) {
    let s = seed >>> 0 || 1;
    return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  }
  const f = n => Math.round(n * 10) / 10;

  function svgEl(tag, attrs, parent) {
    const n = document.createElementNS(NS, tag);
    for (const k in attrs) n.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(n);
    return n;
  }

  // style block shared by every art svg (token colors only)
  const STYLE = `
    .a{fill:none;stroke:var(--art);stroke-opacity:var(--art-op);stroke-width:.8;stroke-linecap:round;stroke-linejoin:round}
    .a2{fill:none;stroke:var(--art);stroke-opacity:calc(var(--art-op) * .55);stroke-width:.55;stroke-linecap:round}
    .ah{fill:none;stroke:var(--art);stroke-opacity:calc(var(--art-op) * .5);stroke-width:.5}
    .ar{fill:none;stroke:var(--text);stroke-opacity:.75;stroke-width:1;stroke-linecap:round;stroke-linejoin:round}
    .pk{fill:var(--today)} .pks{fill:none;stroke:var(--today);stroke-width:.9}
    .wh{fill:var(--bg)}`;

  function frame(svg, w, h) {
    svg.setAttribute("viewBox", `0 0 ${w} ${h}`);
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("focusable", "false");
    svg.innerHTML = "";
    svgEl("style", {}, svg).textContent = STYLE;
    return svgEl("defs", {}, svg);
  }

  // parallel hatching clipped to a path
  function hatch(svg, defs, d, { gap = 3, angle = 0, cls = "ah", box = [0, 0, 120, 80] } = {}) {
    const id = "c" + (++uid);
    const cp = svgEl("clipPath", { id }, defs);
    svgEl("path", { d }, cp);
    const g = svgEl("g", { "clip-path": `url(#${id})` }, svg);
    const [x0, y0, w, h] = box, diag = Math.hypot(w, h);
    const cx = x0 + w / 2, cy = y0 + h / 2;
    const inner = svgEl("g", { transform: `rotate(${angle} ${cx} ${cy})` }, g);
    let p = "";
    for (let y = cy - diag / 2; y <= cy + diag / 2; y += gap) p += `M${f(cx - diag / 2)},${f(y)}H${f(cx + diag / 2)}`;
    svgEl("path", { d: p, class: cls }, inner);
    return g;
  }

  // ------------------------------------------------------------- landscape banner
  function landscape(svg, { seed = 7, w = 1200, h = 170, sun = 0.72, ridges = 4, motif = null } = {}) {
    const defs = frame(svg, w, h);
    const r = rng(seed);
    if (sun !== null) {
      const sx = w * sun, sy = h * 0.34, sr = h * 0.13;
      for (let i = 1; i <= 5; i++) svgEl("circle", { cx: sx, cy: sy, r: sr + i * 7, class: "a2", style: `stroke-opacity:${0.3 - i * 0.05}` }, svg);
      svgEl("circle", { cx: sx, cy: sy, r: sr, class: "pk", style: "opacity:.88" }, svg);
      hatch(svg, defs, `M${sx - sr},${sy}a${sr},${sr} 0 1,0 ${2 * sr},0a${sr},${sr} 0 1,0 ${-2 * sr},0`, { gap: 2.6, angle: -20, cls: "ah", box: [sx - sr, sy - sr, 2 * sr, 2 * sr] }).setAttribute("style", "opacity:.35");
    }
    for (let k = 0; k < ridges; k++) {
      const base = h * (0.42 + k * 0.15), amp = h * (0.16 - k * 0.025);
      const ph = [r() * 6, r() * 6, r() * 6], fr = [1.3 + r(), 3 + r() * 2, 7 + r() * 4];
      const pts = [];
      for (let x = 0; x <= w; x += 8) {
        const t = x / w;
        const y = base - amp * (0.55 * Math.sin(t * fr[0] * Math.PI + ph[0]) + 0.3 * Math.sin(t * fr[1] * Math.PI + ph[1]) + 0.12 * Math.sin(t * fr[2] * Math.PI + ph[2]));
        pts.push([x, y]);
      }
      const line = "M" + pts.map(p => f(p[0]) + "," + f(p[1])).join("L");
      const area = line + `L${w},${h}L0,${h}Z`;
      svgEl("path", { d: area, class: "wh" }, svg);
      hatch(svg, defs, area, { gap: 4.2 - k * 0.7, angle: k % 2 ? 3 : -2, cls: "ah", box: [0, 0, w, h] });
      svgEl("path", { d: line, class: "a" }, svg);
    }
    if (motif) motif(svg, defs, w, h, r);
    return svg;
  }

  // ------------------------------------------------------------- emblems (120 × 80)
  const E = {};
  E.method = (svg, defs) => {
    svgEl("path", { d: "M10,68H110", class: "ar" }, svg);
    for (let x = 14; x <= 106; x += 4) svgEl("path", { d: `M${x},68v${x % 20 === 14 ? -5 : -2.5}`, class: "a" }, svg);
    // dividers
    svgEl("path", { d: "M60,12L40,66M60,12L82,66", class: "ar" }, svg);
    svgEl("path", { d: "M47,46Q61,40 75,46", class: "a" }, svg);
    svgEl("path", { d: "M40,66A42,42 0 0,0 82,66", class: "a2", "stroke-dasharray": "2 3" }, svg);
    svgEl("circle", { cx: 60, cy: 12, r: 3.4, class: "pk" }, svg);
    hatch(svg, defs, "M60,12L40,66L44,66L60,20Z", { gap: 1.6, angle: 60 });
  };
  E.classical = (svg, defs) => {
    svgEl("path", { d: "M8,66H112", class: "ar" }, svg);
    for (let i = 0; i < 9; i++) {
      const x = 16 + i * 11, stage = i / 8;
      svgEl("path", { d: `M${x},64V${f(26 - stage * 8)}`, class: "ar" }, svg);
      if (stage > 0.3) svgEl("path", { d: `M${x},64l-1.6,-4`, class: "a" }, svg);
      if (stage > 0.6) svgEl("ellipse", { cx: x, cy: f(25 - stage * 8), rx: 3, ry: 1.4, class: "ar" }, svg);
    }
    svgEl("path", { d: "M10,40C40,10 80,70 112,30", class: "a2", "stroke-dasharray": "1.5 3.5" }, svg);
    svgEl("circle", { cx: 103, cy: 18, r: 5, class: "pk" }, svg);
  };
  E.ethics = (svg, defs) => {
    svgEl("path", { d: "M60,10V68M44,70H76M60,14L22,24M60,14L98,8", class: "ar" }, svg);
    svgEl("path", { d: "M22,24L12,46M22,24L32,46M98,8L88,34M98,8L108,34", class: "a" }, svg);
    const pl = "M8,46Q22,58 36,46Z", pr = "M84,34Q98,46 112,34Z";
    svgEl("path", { d: pl, class: "ar" }, svg); svgEl("path", { d: pr, class: "ar" }, svg);
    hatch(svg, defs, pl, { gap: 1.8, angle: 30 });
    svgEl("circle", { cx: 98, cy: 31, r: 3.2, class: "pk" }, svg);
    svgEl("circle", { cx: 60, cy: 14, r: 2.2, class: "ar" }, svg);
  };
  E.util = (svg, defs) => {
    svgEl("path", { d: "M14,8V70H112", class: "ar" }, svg);
    for (let k = 0; k < 3; k++) {
      const c = 340 + k * 330;
      let d = "";
      for (let x = 20; x <= 108; x += 2) { const y = 70 - c / (x - 4) * 0.9; if (y > 6) d += (d ? "L" : "M") + x + "," + f(y); }
      svgEl("path", { d, class: k === 1 ? "ar" : "a" }, svg);
    }
    svgEl("path", { d: "M14,24L96,70", class: "a2", "stroke-dasharray": "2 2.5" }, svg);
    svgEl("circle", { cx: 45, cy: 41.5, r: 3.2, class: "pk" }, svg);
    hatch(svg, defs, "M14,24L96,70L14,70Z", { gap: 2.4, angle: -30 });
  };
  E.planning = (svg, defs, r = rng(11)) => {
    svgEl("path", { d: "M60,8V72", class: "a2", "stroke-dasharray": "2 3" }, svg);
    const pts = [];
    for (let i = 0; i < 14; i++) pts.push([10 + r() * 44, 12 + r() * 56]);
    pts.forEach((p, i) => { if (i) svgEl("path", { d: `M${f(p[0])},${f(p[1])}L${f(pts[(i * 5) % i][0])},${f(pts[(i * 5) % i][1])}`, class: "a2" }, svg); });
    pts.forEach(p => svgEl("circle", { cx: f(p[0]), cy: f(p[1]), r: 1.6, class: "ar" }, svg));
    for (let x = 70; x <= 108; x += 9.5) for (let y = 14; y <= 68; y += 9) svgEl("circle", { cx: x, cy: y, r: 1.5, class: "ar" }, svg);
    let g = ""; for (let x = 70; x <= 108; x += 9.5) g += `M${x},14V68`; for (let y = 14; y <= 68; y += 9) g += `M70,${y}H108`;
    svgEl("path", { d: g, class: "a2" }, svg);
    svgEl("circle", { cx: 60, cy: 40, r: 3.4, class: "pk" }, svg);
  };
  E.cyber = (svg, defs) => {
    svgEl("circle", { cx: 60, cy: 40, r: 28, class: "a2" }, svg);
    svgEl("path", { d: "M60,12A28,28 0 1,1 32.4,44", class: "ar" }, svg);
    svgEl("path", { d: "M32.4,44l-2.6,-6.4M32.4,44l5.6,-3.6", class: "ar" }, svg);
    const hex = [...Array(6)].map((_, i) => [60 + 16 * Math.cos(i * Math.PI / 3), 40 + 16 * Math.sin(i * Math.PI / 3)]);
    svgEl("path", { d: "M" + hex.map(p => f(p[0]) + "," + f(p[1])).join("L") + "Z", class: "a" }, svg);
    hex.forEach(p => { svgEl("path", { d: `M60,40L${f(p[0])},${f(p[1])}`, class: "a2" }, svg); svgEl("circle", { cx: f(p[0]), cy: f(p[1]), r: 2, class: "ar" }, svg); });
    svgEl("circle", { cx: 60, cy: 40, r: 3.6, class: "pk" }, svg);
    hatch(svg, defs, "M60,40m-28,0a28,28 0 1,0 56,0a28,28 0 1,0 -56,0", { gap: 3, angle: 45 }).setAttribute("style", "opacity:.5");
  };
  E.fascism = (svg, defs) => {
    const vx = 92, vy = 36;
    for (let i = 0; i <= 12; i++) svgEl("path", { d: `M8,${f(6 + i * 5.6)}L${vx},${vy}`, class: i % 3 ? "a2" : "ar" }, svg);
    hatch(svg, defs, `M8,6L${vx},${vy}L8,40Z`, { gap: 1.5, angle: 20 });
    hatch(svg, defs, `M8,40L${vx},${vy}L8,73Z`, { gap: 2.2, angle: -20 });
    svgEl("path", { d: `M${vx},${vy}H114`, class: "ar" }, svg);
    svgEl("circle", { cx: vx, cy: vy, r: 3.4, class: "pk" }, svg);
  };
  E.exam = (svg) => {
    for (let i = 0; i < 3; i++) svgEl("circle", { cx: 60, cy: 40, r: 30 - i * 6, class: i ? "a" : "ar" }, svg);
    for (let a = 0; a < 360; a += 10) { const t = a * Math.PI / 180; svgEl("path", { d: `M${f(60 + 30 * Math.cos(t))},${f(40 + 30 * Math.sin(t))}L${f(60 + 34 * Math.cos(t))},${f(40 + 34 * Math.sin(t))}`, class: "a2" }, svg); }
    svgEl("path", { d: "M60,26L72,40L60,54L48,40Z", class: "pk" }, svg);
  };
  E.final = E.exam;

  function emblem(key, cls = "emblem") {
    const svg = document.createElementNS(NS, "svg");
    svg.setAttribute("class", cls);
    const defs = frame(svg, 120, 80);
    (E[key] || E.exam)(svg, defs);
    return svg;
  }

  // ------------------------------------------------------------- section motifs
  const M = {
    path: (svg, d, w, h) => {
      let p = "";
      for (let i = 0; i <= 40; i++) { const x = w * 0.06 + i * w * 0.022, y = h * 0.62 - Math.sin(i * 0.5) * h * 0.18; p += (i ? "L" : "M") + f(x) + "," + f(y); }
      svgEl("path", { d: p, class: "ar" }, svg);
      for (let i = 0; i <= 40; i += 3) { const x = w * 0.06 + i * w * 0.022, y = h * 0.62 - Math.sin(i * 0.5) * h * 0.18; svgEl("circle", { cx: f(x), cy: f(y), r: 3, class: i === 18 ? "pk" : "wh", stroke: "currentColor", style: "stroke:var(--text);stroke-width:1" }, svg); }
    },
    ledger: (svg, d, w, h) => {
      // a seven-week calendar sheet, Tuesdays and Thursdays marked
      const x0 = w * 0.05, y0 = h * 0.16, cw = 22, ch = 12;
      svgEl("path", { d: `M${x0},${y0 - 6}H${x0 + 7 * cw}`, class: "ar" }, svg);
      for (let r = 0; r < 7; r++) for (let c = 0; c < 7; c++) {
        const x = x0 + c * cw, y = y0 + r * ch;
        const dd = `M${x + 1},${y + 1}h${cw - 2}v${ch - 2}h${-(cw - 2)}Z`;
        svgEl("path", { d: dd, class: "wh" }, svg);
        svgEl("path", { d: dd, class: "a2" }, svg);
        if (c === 1 || c === 3) hatch(svg, d, dd, { gap: 2, angle: 45, box: [x, y, cw, ch] });
        if (c === 5 && r > 0) svgEl("rect", { x: x + cw / 2 - 2.5, y: y + ch / 2 - 2.5, width: 5, height: 5, class: "pk", style: "opacity:.8" }, svg);
      }
    },
    books: (svg, d, w, h, r) => {
      let x = w * 0.05;
      for (let i = 0; i < 18; i++) {
        const bw = 6 + r() * 12, bh = 40 + r() * 46, y = h - 6 - bh;
        const dd = `M${f(x)},${f(h - 6)}V${f(y)}H${f(x + bw)}V${f(h - 6)}Z`;
        svgEl("path", { d: dd, class: "wh" }, svg);
        hatch(svg, d, dd, { gap: 2 + (i % 3), angle: i % 2 ? 90 : 0, box: [x, y, bw, bh] });
        svgEl("path", { d: dd, class: i === 11 ? "pks" : "ar" }, svg);
        x += bw + 1.5;
      }
      svgEl("path", { d: `M${w * 0.04},${h - 6}H${x + 6}`, class: "ar" }, svg);
    },
    coins: (svg, d, w, h) => {
      const cx = w * 0.16, base = h - 8;
      for (let s = 0; s < 5; s++) for (let i = 0; i < [6, 4, 4, 3, 1][s]; i++) {
        const x = cx + s * 30, y = base - i * 7;
        svgEl("ellipse", { cx: x, cy: y, rx: 12, ry: 3.6, class: s === 4 ? "pks" : "ar", style: "fill:var(--bg)" }, svg);
      }
    },
    columns: (svg, d, w, h) => {
      const x0 = w * 0.06;
      svgEl("path", { d: `M${x0 - 10},${h * 0.28}L${x0 + 85},${h * 0.08}L${x0 + 180},${h * 0.28}Z`, class: "ar", style: "fill:var(--bg)" }, svg);
      for (let i = 0; i < 6; i++) { const x = x0 + i * 34; svgEl("path", { d: `M${x},${h * 0.32}V${h - 10}M${x + 12},${h * 0.32}V${h - 10}`, class: "ar" }, svg); for (let k = 3; k < 12; k += 3) svgEl("path", { d: `M${x + k},${h * 0.34}V${h - 12}`, class: "a2" }, svg); }
      svgEl("path", { d: `M${x0 - 14},${h - 8}H${x0 + 186}`, class: "ar" }, svg);
    },
    query: (svg, d, w, h) => {
      for (let i = 0; i < 5; i++) svgEl("path", { d: `M${f(w * 0.06)},${f(h * 0.3 + i * 18)}h${120 - i * 14}`, class: i === 2 ? "pks" : "a2" }, svg);
      svgEl("circle", { cx: w * 0.06 + 150, cy: h * 0.48, r: 4, class: "pk" }, svg);
    },
  };

  window.PPEArt = { landscape, emblem, motifs: M, rng };
})();
