/* PPE 202 — site application. Content comes from data/data.js. */
(function () {
  "use strict";
  const D = window.PPE_DATA;
  if (!D) {
    document.getElementById("main").innerHTML = '<div class="wrap section"><h2>Could not load</h2><p>Reload the page.</p></div>';
    return;
  }
  const Art = window.PPEArt;
  // Two versions share this code: index.html hides reading summaries, with-summaries.html shows them.
  const SHOW_SUMMARIES = !!window.PPE_SHOW_SUMMARIES;
  const NS = "http://www.w3.org/2000/svg";

  // ------------------------------------------------------------------ utilities
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const strip = html => { const t = document.createElement("template"); t.innerHTML = html || ""; return t.content.textContent.replace(/\s+/g, " ").trim(); };
  const store = {
    get(k, d) { try { const v = localStorage.getItem("ppe-" + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem("ppe-" + k, JSON.stringify(v)); } catch (e) {} },
  };
  function svgEl(tag, attrs = {}, parent, text) {
    const n = document.createElementNS(NS, tag);
    for (const k in attrs) if (attrs[k] != null) n.setAttribute(k, attrs[k]);
    if (text != null) n.textContent = text;
    if (parent) parent.appendChild(n);
    return n;
  }
  const toast = msg => { const t = $("#toast"); t.textContent = msg; t.classList.add("on"); clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove("on"), 2200); };

  // ------------------------------------------------------------------ indexes
  const S = Object.fromEntries(D.sessions.map(s => [s.id, s]));
  const R = Object.fromEntries(D.readings.map(r => [r.id, r]));
  const A = Object.fromEntries(D.assignments.map(a => [a.id, a]));
  const MV = Object.fromEntries(D.movements.map(m => [m.key, m]));
  const COMP = Object.fromEntries(D.grading.components.map(c => [c.key, c]));
  const SESS = D.sessions;
  const C = D.course;
  const sessLabel = s => `W${s.week} · S${s.n}`;
  const authorShort = r => r.author.replace(/ and /g, " & ").replace(/ \(eds\.\)$/, "");
  // author, plus a short title when two readings in the same session share an author
  const rLabel = r => D.readings.some(o => o !== r && o.author === r.author && o.sessions.some(x => r.sessions.includes(x))) ? `${authorShort(r)}, ${r.short}` : authorShort(r);
  const mvName = k => (MV[k] ? MV[k].name : k === "exam" ? "Oral exam" : "");

  // ------------------------------------------------------------------ time
  const params = new URLSearchParams(location.search);
  const NOW = params.get("today") ? new Date(params.get("today") + "T12:00:00+08:00") : new Date();
  let TZ = store.get("tz", "Asia/Shanghai");
  const TZ_SHORT = { "Asia/Shanghai": "BJT", "America/New_York": "New York" };
  const fmt = (d, o, tz = TZ) => new Intl.DateTimeFormat("en-US", { timeZone: tz, ...o }).format(typeof d === "string" ? new Date(d) : d);
  const time = (d, tz = TZ) => fmt(d, { hour: "numeric", minute: "2-digit", hour12: true }, tz).replace(" AM", "am").replace(" PM", "pm").replace(":00", "");
  const dayParts = (d, tz = "Asia/Shanghai") => { const p = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(d); return p; };
  const dayNum = iso => Math.round(new Date(iso + "T00:00:00Z").getTime() / 864e5);
  const todayISO = dayParts(NOW);
  const daysUntil = d => dayNum(dayParts(typeof d === "string" && d.length > 10 ? new Date(d) : (typeof d === "string" ? new Date(d + "T12:00:00+08:00") : d))) - dayNum(todayISO);
  const rel = n => n === 0 ? "today" : n === 1 ? "tomorrow" : n === -1 ? "yesterday" : n > 0 ? `in ${n} days` : `${-n} days ago`;
  const sessDate = (s, o = { weekday: "short", month: "short", day: "numeric" }) => fmt(s.start_utc, o);
  const classTime = s => `${time(s.start_utc)}–${time(s.end_utc)}`;
  const dueFmt = iso => `${fmt(iso, { weekday: "short", month: "short", day: "numeric" })}, ${time(iso)}`;
  const tzNote = () => TZ === "Asia/Shanghai" ? "BJT" : "New York time";

  // ------------------------------------------------------------------ highlight (prose ↔ data)
  let pinned = null;
  function applyHL(keys) {
    $$(".hl").forEach(n => n.classList.remove("hl"));
    $$(".dimming").forEach(n => n.classList.remove("dimming"));
    $$("[data-band]").forEach(b => b.classList.toggle("hl", !!keys && keys.includes(b.dataset.band)));
    if (!keys || !keys.length) return;
    const sel = keys.map(k => `[data-k~="${CSS.escape(k)}"]`).join(",");
    $$(sel).forEach(n => {
      n.classList.add("hl");
      const scope = n.closest(".dim-scope");
      if (scope) scope.classList.add("dimming");
    });
  }
  const restoreHL = () => applyHL(pinned);
  document.addEventListener("mouseover", e => {
    const t = e.target.closest("[data-hl], .dim-scope [data-k]");
    if (!t) return;
    const keys = (t.dataset.hl || t.dataset.k.split(" ")[0]).split(" ");
    applyHL(keys);
  });
  document.addEventListener("mouseout", e => {
    const t = e.target.closest("[data-hl], .dim-scope [data-k]");
    if (t && !t.contains(e.relatedTarget)) restoreHL();
  });
  document.addEventListener("focusin", e => { const t = e.target.closest("[data-hl], .dim-scope [data-k]"); if (t) applyHL((t.dataset.hl || t.dataset.k.split(" ")[0]).split(" ")); });
  document.addEventListener("focusout", restoreHL);
  document.addEventListener("click", e => {
    const t = e.target.closest("[data-hl]");
    if (!t) return;
    e.preventDefault();
    const keys = t.dataset.hl.split(" ");
    const same = pinned && pinned.join() === keys.join();
    $$(".hl-link.pinned").forEach(n => n.classList.remove("pinned"));
    pinned = same ? null : keys;
    if (!same) {
      t.classList.add("pinned");
      if (t.dataset.go) { const target = $(t.dataset.go); if (target && !inView(target)) target.scrollIntoView({ behavior: "smooth", block: "center" }); }
      toast("Pinned · click again or press Esc to clear");
    }
    restoreHL();
  });
  const inView = el => { const r = el.getBoundingClientRect(); return r.top < innerHeight && r.bottom > 0; };
  const hl = (keys, text, go) => `<a href="#" class="hl-link" data-hl="${esc(keys)}"${go ? ` data-go="${go}"` : ""}>${text}</a>`;

  // ------------------------------------------------------------------ links + hover previews
  const refLink = (type, id, inner, cls = "") => {
    const href = `#${type}/${id}`;
    return `<a href="${href}" data-ref="${type}:${id}"${cls ? ` class="${cls}"` : ""}>${inner}</a>`;
  };
  const readingLink = (id, inner) => refLink("reading", id, inner ?? esc(rLabel(R[id])));
  const sessionLink = (id, inner) => refLink("session", id, inner ?? esc(sessLabel(S[id])));
  const assignLink = (id, inner) => refLink("assignment", id, inner ?? esc(A[id].name));

  const chList = cs => { const out = []; cs.forEach(c => { const l = out[out.length - 1]; if (l && c === l[1] + 1) l[1] = c; else out.push([c, c]); }); return out.map(([a, b]) => a === b ? a : b === a + 1 ? `${a}, ${b}` : `${a}–${b}`).join(", "); };
  function reqSummary(q) {
    if (!q) return "";
    if (q.whole_file) return `Ch. ${q.chapters.join(" + ")} (the whole PDF)`;
    if (q.kind === "pages") return `only pp. ${q.book_pages}` + (q.pdf_ranges ? ` (PDF ${q.pdf_ranges.map(r => r[0] + "–" + r[1]).join(", ")})` : "");
    if (q.kind === "chapters") return `Ch. ${chList(q.chapters)}` + (q.pdf_ranges ? ` (PDF pp. ${q.pdf_ranges.map(r => r[0] + "–" + r[1]).join(", ")})` : "");
    return "";
  }
  function previewHTML(type, id) {
    if (type === "reading") {
      const r = R[id]; if (!r) return "";
      const ss = r.sessions.map(s => `${sessLabel(S[s])} ${sessDate(S[s], { month: "short", day: "numeric" })}`).join(" & ");
      const req = r.requirements.map(reqSummary).filter(Boolean).join("; ");
      return `<div class="pv-k">Reading · ${ss} · ${r.pages} pp${r.ocr ? " · OCR" : ""}</div>
        <div class="pv-t">${r.title_html}</div><div class="pv-k" style="color:var(--muted)">${esc(r.author)}</div>
        ${SHOW_SUMMARIES ? `<div class="pv-s">${esc(strip(r.summary_html))}</div>` : ""}${req ? `<div class="pv-f">Assigned: ${esc(req)}</div>` : ""}`;
    }
    if (type === "session") {
      if (id === "final") return `<div class="pv-k">Exam period</div><div class="pv-t">Final oral exams</div><div class="pv-s">${esc(D.exam_period.syllabus)}</div>`;
      const s = S[id]; if (!s) return "";
      const reads = s.readings.map(r => authorShort(R[r])).join(" · ");
      return `<div class="pv-k">${sessLabel(s)} · ${sessDate(s)} · ${classTime(s)}</div><div class="pv-t">${s.topic_html}</div>
        <div class="pv-s">${reads ? "Read: " + esc(reads) : "No reading assigned"}</div>
        ${s.assignments.length ? `<div class="pv-f">Due: ${s.assignments.map(a => esc(A[a].name)).join(", ")}</div>` : ""}`;
    }
    if (type === "assignment") {
      const a = A[id]; if (!a) return "";
      return `<div class="pv-k">${a.points} points · ${a.due_utc ? "due " + dueFmt(a.due_utc) : "no Canvas date"}</div>
        <div class="pv-t">${esc(a.name)}</div><div class="pv-s">${esc(strip(a.guidance_html))}</div>
        <div class="pv-f">Instructions from the syllabus</div>`;
    }
    return "";
  }
  const pv = $("#preview");
  let pvTimer = null, pvFor = null;
  const canHover = matchMedia("(hover: hover)").matches;
  document.addEventListener("mouseover", e => {
    if (!canHover) return;
    const a = e.target.closest("[data-ref]");
    if (!a || a === pvFor) return;
    pvFor = a;
    clearTimeout(pvTimer);
    pvTimer = setTimeout(() => {
      const [type, id] = a.dataset.ref.split(":");
      const html = previewHTML(type, id);
      if (!html) return;
      pv.innerHTML = html;
      const r = a.getBoundingClientRect();
      pv.style.left = "0px"; pv.style.top = "0px"; pv.classList.add("on");
      const w = pv.offsetWidth, h = pv.offsetHeight;
      let x = Math.min(innerWidth - w - 12, Math.max(12, r.left + r.width / 2 - w / 2));
      let y = r.bottom + 10; if (y + h > innerHeight - 8) y = r.top - h - 10;
      pv.style.left = x + "px"; pv.style.top = Math.max(8, y) + "px";
    }, 260);
  });
  document.addEventListener("mouseout", e => {
    const a = e.target.closest("[data-ref]");
    if (a && !a.contains(e.relatedTarget)) { clearTimeout(pvTimer); pv.classList.remove("on"); pvFor = null; }
  });
  document.addEventListener("scroll", () => { pv.classList.remove("on"); pvFor = null; }, { passive: true });

  // ------------------------------------------------------------------ sidenotes
  let snCount = 0;
  function sidenote(html) {
    const n = ++snCount;
    return `<button type="button" class="sn-ref" aria-expanded="false" aria-controls="sn-${n}" data-sn="${n}">${n}</button><span class="sidenote" id="sn-${n}" role="note"><span class="sn-n">${n}</span>${html}</span>`;
  }
  document.addEventListener("click", e => {
    const b = e.target.closest(".sn-ref");
    if (!b) return;
    const n = $("#sn-" + b.dataset.sn);
    const open = n.classList.toggle("open");
    b.setAttribute("aria-expanded", open);
  });

  // ------------------------------------------------------------------ section header
  function secHead(num, id, title, artOpts) {
    return `<svg class="sec-art" data-art='${JSON.stringify(artOpts)}'></svg>
      <div class="sec-head reveal"><span class="sec-num sc">§ ${num}</span><h2 id="h-${id}">${title}</h2></div>`;
  }
  function paintArt(root = document) {
    $$("svg[data-art]", root).forEach(svg => {
      const o = JSON.parse(svg.dataset.art);
      const motif = o.motif ? Art.motifs[o.motif] : null;
      Art.landscape(svg, { seed: o.seed, w: 1200, h: o.h || 120, sun: o.sun ?? 0.8, ridges: o.ridges || 3, motif });
    });
  }

  // ================================================================== §1 TITLE
  function upcoming() {
    const now = NOW.getTime();
    const nextClass = SESS.find(s => new Date(s.end_utc).getTime() > now);
    const dues = D.assignments.filter(a => a.due_utc && new Date(a.due_utc).getTime() > now);
    return { nextClass, nextDue: dues[0], dues };
  }
  function renderTitle() {
    const el = $("#s-title");
    const first = SESS[0], last = SESS[SESS.length - 1];
    const { nextClass, nextDue } = upcoming();
    const about = strip(C.about_html);
    const objectives = $$("li", Object.assign(document.createElement("div"), { innerHTML: C.objectives_html })).map(li => `<li>${esc(li.textContent.trim())}</li>`).join("");
    const pts = k => COMP[k].points;
    el.innerHTML = `
      <svg class="hero-art" id="hero-art"></svg>
      <h1 id="h-title" class="reveal">PPE 202: Ethics, Markets, and Politics</h1>
      <div class="sub reveal">Duke Kunshan University, Fall 2026, Session 2</div>
      <div class="hero-grid">
        <div class="reveal">
          <dl class="meta">
            <dt>Instructor</dt><dd>${esc(C.instructor.name)}<br><span class="muted" style="font-size:.88em">${esc(C.instructor.title)} · <a href="mailto:${esc(C.instructor.email)}">${esc(C.instructor.email)}</a></span></dd>
            <dt>Meets</dt><dd>Tuesdays &amp; Thursdays, ${esc(classTime(first))} ${TZ === "Asia/Shanghai" ? "BJT" : "<span class='muted'>(New York; 2:45–5:15pm BJT)</span>"}</dd>
            <dt>Room</dt><dd>${esc(C.location)}</dd>
            <dt>Dates</dt><dd>${esc(sessDate(first, { month: "short", day: "numeric" }))} – ${esc(sessDate(last, { month: "short", day: "numeric" }))}; final oral exams in the exam period ${sidenote(`The syllabus header says “${esc(C.dates_syllabus)}”; the first class is ${esc(sessDate(first))}.`)}</dd>
            <dt>Format</dt><dd>${esc(C.format)} · ${esc(C.credits)} · ${esc(C.class_size.split(",")[0])}${/^none/i.test(C.tas) ? "; no TAs" : ""}</dd>
            <dt>Office hours</dt><dd>${esc(C.office_hours)}</dd>
          </dl>
        </div>
        <div class="today-card reveal" id="today-card" aria-live="polite"></div>
      </div>
      <div class="with-margin framing">
        <div class="src-label reveal">From the syllabus</div>
        <p class="lede dropcap reveal">${esc(about)}</p>
        <p class="reveal">The ${SESS.length} sessions move through ${D.movements.length} movements:
          ${D.movements.map((m, i) => hl("mv:" + m.key, esc(m.name.replace("Prelude: ", "").toLowerCase()), "#path-wrap") + (i === D.movements.length - 2 ? ", and " : i < D.movements.length - 1 ? ", " : "")).join("")}.
          The grade comes from ${hl("c:mid c:final", `two oral exams worth ${pts("mid") + pts("final")} points`, "#fig-grade")},
          ${hl("c:refl", `six weekly reflections (${pts("refl")})`, "#fig-grade")},
          ${hl("c:lead", `one discussion you lead (${pts("lead")})`, "#fig-grade")}
          and ${hl("c:live", `a Live Engagement grade the whole class shares (${pts("live")})`, "#fig-grade")}.
          <span class="muted" style="font-size:.85em">(Linked phrases highlight the figures; click to pin.)</span></p>
        <h3 class="reveal" style="font-size:1.05rem;margin-top:22px">Learning objectives</h3><ul class="objectives reveal">${objectives}</ul>
      </div>`;
    Art.landscape($("#hero-art"), { seed: 202, w: 1200, h: 210, sun: 0.78, ridges: 5 });
    renderToday();
  }
  function renderToday() {
    const card = $("#today-card"); if (!card) return;
    const { nextClass, nextDue, dues } = upcoming();
    const dateStr = fmt(NOW, { weekday: "long", month: "long", day: "numeric" });
    let big, items = [];
    const signup = D.deadlines.find(d => /Discussion Leading slot/i.test(d.what));
    if (nextClass) {
      const n = daysUntil(nextClass.start_utc);
      const isFirst = nextClass === SESS[0];
      big = n === 0 ? `<span class="count">Today</span> ${isFirst ? "the first class" : "class meets"}`
        : `<span class="count">${n}</span> day${n === 1 ? "" : "s"} until ${isFirst ? "the first class" : "the next class"}`;
      items.push(`<li><span class="when">${esc(sessDate(nextClass))}<br>${esc(classTime(nextClass))}</span><span>${sessionLink(nextClass.id, nextClass.topic_html)}<br><span class="muted" style="font-size:.9em">${nextClass.readings.length ? "Read " + nextClass.readings.map(r => readingLink(r)).join(", ") : esc(nextClass.topic)}</span></span></li>`);
      if (isFirst || daysUntil(SESS[0].start_utc) > -7) {
        if (signup) items.push(`<li><span class="when">${esc(signup.when.split("(")[0].trim())}</span><span>Claim a discussion-leading slot on the <a href="${esc(C.signup_url)}" target="_blank" rel="noopener">sign-up sheet</a>; reservations happen ${esc((signup.when.match(/during the first week[^)"]*/) || ["in the first week"])[0])}.</span></li>`);
      }
    } else {
      big = `<span class="count">✓</span> Classes are over`;
      items.push(`<li><span class="when">Exam period</span><span>${sessionLink("final", "Final oral exams")}: ${esc(D.exam_period.when)}. No date is set yet.</span></li>`);
    }
    if (nextDue) {
      const n = daysUntil(nextDue.due_utc);
      items.push(`<li><span class="when">${esc(dueFmt(nextDue.due_utc))}</span><span>Next deadline: ${assignLink(nextDue.id)} <span class="muted">(${nextDue.points} pts, ${rel(n)})</span></span></li>`);
    }
    card.innerHTML = `<div class="today-date sc">Today · ${esc(dateStr)}${params.get("today") ? " (simulated)" : ""}</div>
      <div class="today-big">${big}</div>
      <ul class="today-list">${items.join("")}</ul>
      <div class="ribbon" aria-hidden="true"><svg id="ribbon"></svg></div>`;
    drawRibbon();
  }
  function drawRibbon() {
    const svg = $("#ribbon"); if (!svg) return;
    const w = svg.clientWidth || 300, h = 38;
    svg.setAttribute("viewBox", `0 0 ${w} ${h}`); svg.innerHTML = "";
    const d0 = new Date("2026-10-26T00:00:00+08:00").getTime(), d1 = new Date("2026-12-13T00:00:00+08:00").getTime();
    const X = t => 6 + (t - d0) / (d1 - d0) * (w - 12);
    svgEl("line", { x1: 6, x2: w - 6, y1: 20, y2: 20, class: "axis" }, svg);
    for (let k = 0; k < 7; k++) {
      const t = d0 + k * 7 * 864e5;
      svgEl("line", { x1: X(t), x2: X(t), y1: 16, y2: 24, class: "axis" }, svg);
      svgEl("text", { x: X(t) + 3, y: 35, class: "tick-lbl" }, svg, "W" + (k + 1));
    }
    SESS.forEach(s => svgEl(s.exam ? "rect" : "circle", s.exam ? { x: X(new Date(s.start_utc)) - 3.5, y: 16.5, width: 7, height: 7, transform: `rotate(45 ${X(new Date(s.start_utc))} 20)`, class: "fill-mid" } : { cx: X(new Date(s.start_utc)), cy: 20, r: 2.6, class: new Date(s.end_utc) < NOW ? "node past" : "node", style: "stroke-width:1" }, svg));
    D.assignments.filter(a => a.component === "refl").forEach(a => svgEl("rect", { x: X(new Date(a.due_utc)) - 2.5, y: 7, width: 5, height: 5, class: "fill-refl" }, svg));
    const tx = X(NOW.getTime());
    if (tx < 6) { svgEl("path", { d: "M10,5l-4,3l4,3", class: "pks", style: "fill:none;stroke:var(--today)" }, svg); svgEl("text", { x: 14, y: 11, class: "today-txt", style: "font-size:10px" }, svg, "today"); }
    else if (tx <= w - 6) { svgEl("line", { x1: tx, x2: tx, y1: 2, y2: 28, style: "stroke:var(--today);stroke-width:1.5" }, svg); }
  }

  // ================================================================== §2 SCOPE (winding path)
  function renderScope() {
    const el = $("#s-scope");
    const threadsOn = store.get("threads", true);
    const groups = [];
    SESS.forEach(s => {
      const key = s.exam ? "exam" : s.movement;
      const g = groups[groups.length - 1];
      if (g && g.key === key && key !== "exam") g.items.push(s); else groups.push({ key, items: [s] });
    });
    groups.push({ key: "exam", items: [{ id: "final", final: true }] });
    let idx = 0;
    const nextIdx = SESS.findIndex(s => new Date(s.end_utc) > NOW);
    const stop = s => {
      const i = idx++;
      if (s.final) {
        return `<li class="stop exam" data-i="${i}" data-k="final c:final a:final">
          <div class="anchor"><span class="dot-slot"></span></div>
          <div class="body"><div class="when">${esc(D.exam_period.when.replace(/^exam period/i, "Exam period"))}</div>
          ${refLink("session", "final", "Final oral exams", "topic")}
          <div class="reads">Prepare three prompts; a coin decides which one you answer.</div>
          <div class="dues"><a class="due-chip final" href="#assignment/final" data-ref="assignment:final"><i></i>Final · ${A.final.points} pts · date not set</a></div></div></li>`;
      }
      const reads = s.readings.map(id => readingLink(id) + (s.reading_notes[id] && s.reading_notes[id].kind && !s.reading_notes[id].whole_file ? ` <span style="font-style:normal;font-size:.9em">(${esc(reqSummary(s.reading_notes[id]).replace(/ \(PDF.*\)$/, ""))})</span>` : "")).join(", ");
      const weekRefl = D.assignments.find(a => a.component === "refl" && a.week === s.week);
      const lastOfWeek = !SESS.some(o => o.week === s.week && o.n > s.n);
      const dues = [];
      if (s.exam) dues.push(`<a class="due-chip mid" href="#assignment/midterm" data-ref="assignment:midterm"><i></i>Midterm oral exam · ${A.midterm.points} pts</a>`);
      if (weekRefl && lastOfWeek) dues.push(`<a class="due-chip refl" href="#assignment/${weekRefl.id}" data-ref="assignment:${weekRefl.id}"><i></i>Reflection, Week ${weekRefl.week} · due ${esc(dueFmt(weekRefl.due_utc))}</a>`);
      const keys = [s.id, "mv:" + s.movement, ...s.readings.map(r => "r:" + r), ...s.assignments.map(a => "a:" + a)].join(" ");
      return `<li class="stop${s.exam ? " exam" : ""}${i === nextIdx ? " is-today" : ""}" data-i="${i}" data-k="${keys}">
        <div class="anchor"><span class="dot-slot"></span></div>
        <div class="body"><div class="when">${sessLabel(s)} · ${esc(sessDate(s))} · ${esc(classTime(s))}</div>
        ${refLink("session", s.id, s.topic_html, "topic")}
        ${reads ? `<div class="reads">${reads}</div>` : `<div class="reads">${esc(D.midterm_note)}</div>`}
        ${dues.length ? `<div class="dues">${dues.join("")}</div>` : ""}</div></li>`;
    };
    const bands = groups.map(g => {
      if (g.key === "exam") return `<li class="band" style="--mv:var(--mv-exam)"><ol class="path-list">${g.items.map(stop).join("")}</ol></li>`;
      const m = MV[g.key];
      return `<li class="band" style="--mv:var(--mv-${g.key})" data-band="mv:${g.key}">
        <div class="band-head"><div class="bh-text"><div class="bh-name">${esc(m.name)}</div><div class="bh-gloss">${esc(m.gloss)}</div></div><span class="emblem-slot" data-emblem="${g.key}"></span></div>
        <ol class="path-list">${g.items.map(stop).join("")}</ol></li>`;
    }).join("");
    el.innerHTML = `${secHead(2, "scope", "The arc of the course", { seed: 31, motif: "path", sun: 0.86 })}
      <div class="with-margin">
        <p class="lede reveal">The course runs from method to fascism: the ${hl("mv:classical", "classical economists")} on natural order,
        ${hl("mv:ethics", "market ethics")} on what selling does to goods, ${hl("mv:util", "utilitarianism")} on welfare as calculation, the ${hl("mv:planning", "calculation debate")}
        on markets versus planning, ${hl("mv:cyber", "Stafford Beer")} on democratic planning, and ${hl("mv:fascism", "Sohn-Rethel")} on planning under German fascism.
        ${sidenote("The movements and dashed threads are my own grouping of the readings. Sessions, dates and readings are from the syllabus.")}</p>
      </div>
      <div class="scope-controls reveal">
        <div class="chips" role="group" aria-label="Map layers">
          <button type="button" class="chip" id="tg-threads" aria-pressed="${threadsOn}"><svg width="18" height="8" aria-hidden="true"><path d="M1 4h16" stroke="currentColor" stroke-dasharray="1.5 3" stroke-linecap="round"/></svg>Threads (editorial)</button>
        </div>
        <div class="muted" style="font-size:.8rem">● session &nbsp; ◆ oral exam &nbsp; times in ${tzNote()}</div>
      </div>
      <figure class="fig reveal" id="fig-scope">
        <div class="path-wrap dim-scope ${threadsOn ? "" : "threads-off"}" id="path-wrap">
          <svg class="path-svg" id="path-svg" aria-hidden="true"></svg>
          <ol class="path-list" aria-label="Sessions in order">${bands}</ol>
        </div>
        <figcaption><b>Fig. 1</b> The ${SESS.length} sessions in order, ${esc(sessDate(SESS[0], { month: "short", day: "numeric" }))} to the exam period. Bands mark movements; pink diamonds are oral exams; dashed arcs in the margin link related sessions (hover an arc for the connection). ${nextIdx > 0 ? "The pink stretch marks sessions already held." : ""}</figcaption>
      </figure>`;
    $$(".emblem-slot", el).forEach(s => s.replaceWith(Art.emblem(s.dataset.emblem)));
    $("#tg-threads").addEventListener("click", e => {
      const on = e.currentTarget.getAttribute("aria-pressed") !== "true";
      e.currentTarget.setAttribute("aria-pressed", on);
      $("#path-wrap").classList.toggle("threads-off", !on);
      store.set("threads", on);
    });
  }
  const smoothV = pts => pts.map((p, i) => i ? `C${p0(pts[i - 1])[0]},${(pts[i - 1][1] + p[1]) / 2} ${p[0]},${(pts[i - 1][1] + p[1]) / 2} ${p[0]},${p[1]}` : `M${p[0]},${p[1]}`).join(" ");
  const p0 = p => p;
  function drawPath() {
    const wrap = $("#path-wrap"), svg = $("#path-svg");
    if (!wrap || !svg) return;
    const narrow = wrap.clientWidth < 720 - 32;
    const gutter = parseFloat(getComputedStyle(wrap).getPropertyValue("--gutter")) || 230;
    const cx = narrow ? 34 : 150, amp = narrow ? 11 : 44;
    const top = wrap.getBoundingClientRect().top;
    const stops = $$(".stop", wrap);
    const P = stops.map((st, i) => {
      const r = st.querySelector(".dot-slot").getBoundingClientRect();
      return [Math.round((cx + amp * Math.sin(i * 0.82)) * 10) / 10, Math.round(r.top - top)];
    });
    const H = wrap.clientHeight;
    svg.setAttribute("viewBox", `0 0 ${gutter} ${H}`);
    svg.style.height = H + "px";
    svg.innerHTML = "";
    const ext = [[P[0][0], P[0][1] - 26], ...P, [P[P.length - 1][0], P[P.length - 1][1] + 30]];
    const d = smoothV(ext);
    svgEl("path", { d, class: "path-etch", transform: "translate(3.5,0)" }, svg);
    svgEl("path", { d, class: "path-main" }, svg);
    // progress: the stretch already travelled
    const nextIdx = SESS.findIndex(s => new Date(s.end_utc) > NOW);
    if (nextIdx > 0) svgEl("path", { d: smoothV([ext[0], ...P.slice(0, nextIdx + (nextIdx < P.length ? 0 : 0))]), class: "path-past" }, svg);
    // threads in the left margin, staggered
    D.threads.forEach((t, j) => {
      const ia = stops.findIndex(s => s.dataset.k.split(" ")[0] === t.from), ib = stops.findIndex(s => s.dataset.k.split(" ")[0] === t.to);
      if (ia < 0 || ib < 0) return;
      const [x1, y1] = P[ia], [x2, y2] = P[ib];
      const bend = narrow ? 3 + (j % 4) * 4 : 10 + j * 11;
      const dd = `M${x1},${y1} C${bend},${y1} ${bend},${y2} ${x2},${y2}`;
      svgEl("path", { d: dd, class: "thread", "data-k": `th${j} ${t.from} ${t.to}` }, svg);
      const hit = svgEl("path", { d: dd, class: "thread-hit", "data-k": `th${j} ${t.from} ${t.to}`, "data-ref": `thread:${j}` }, svg);
      hit.addEventListener("mouseenter", () => {
        applyHL([t.from, t.to, "th" + j]);
        pv.innerHTML = `<div class="pv-k">Thread · editorial</div><div class="pv-t">${esc(t.label)}</div><div class="pv-s">${sessLabel(S[t.from])} ${esc(S[t.from].topic)} → ${sessLabel(S[t.to])} ${esc(S[t.to].topic)}</div>`;
        const r = hit.getBoundingClientRect();
        pv.style.left = Math.max(12, r.left + 10) + "px"; pv.style.top = Math.min(innerHeight - 140, r.top + r.height / 2) + "px"; pv.classList.add("on");
      });
      hit.addEventListener("mouseleave", () => { restoreHL(); pv.classList.remove("on"); });
    });
    // connectors + nodes
    stops.forEach((st, i) => {
      const [x, y] = P[i];
      const isExam = st.classList.contains("exam");
      svgEl("line", { x1: x + 9, x2: gutter - 10, y1: y, y2: y, class: "path-etch", style: "stroke-opacity:.35" }, svg);
      const k = st.dataset.k;
      const node = isExam
        ? svgEl("path", { d: `M${x},${y - 8}L${x + 8},${y}L${x},${y + 8}L${x - 8},${y}Z`, class: "node exam", "data-k": k })
        : svgEl("circle", { cx: x, cy: y, r: 6, class: "node" + (i < nextIdx ? " past" : ""), "data-k": k });
      svg.appendChild(node);
      node.style.pointerEvents = "all"; node.style.cursor = "pointer";
      const id = k.split(" ")[0];
      node.addEventListener("click", () => { location.hash = `#session/${id}`; });
      node.addEventListener("mouseenter", () => applyHL([id]));
      node.addEventListener("mouseleave", restoreHL);
    });
    // today marker
    if (nextIdx >= 0 && nextIdx < P.length) {
      const [x, y] = P[nextIdx];
      const ty = nextIdx === 0 ? y - 30 : (P[nextIdx - 1][1] + y) / 2;
      svgEl("circle", { cx: x + (nextIdx === 0 ? 0 : amp * 0), cy: ty, r: 4, class: "today-dot" }, svg);
      if (!narrow) svgEl("text", { x: x + 10, y: ty + 4, class: "today-txt" }, svg, "today");
    }
  }

  // ================================================================== §3 CALENDAR
  function renderCalendar() {
    const el = $("#s-calendar");
    const weeks = [...new Set(SESS.map(s => s.week))];
    const refl = w => D.assignments.find(a => a.component === "refl" && a.week === w);
    const firstRefl = D.assignments.find(a => a.component === "refl");
    const satLabel = fmt(firstRefl.due_utc, { weekday: "long" }) + " deadline";
    const nowWeekIdx = weeks.findIndex(w => SESS.filter(s => s.week === w).some(s => new Date(s.end_utc) > NOW));
    const signup = D.deadlines.find(d => /Discussion Leading slot/i.test(d.what));
    const card = s => {
      if (!s) return `<div class="cal-cell cal-empty"></div>`;
      const past = new Date(s.end_utc) < NOW;
      const rl = s.readings.map(id => {
        const r = R[id], q = s.reading_notes[id];
        const pg = q && q.pdf_pages_total && !q.whole_file ? `${q.pdf_pages_total} of ${r.pages} pp` : `${r.pages} pp`;
        return `<li><span>${esc(rLabel(r))}</span><span class="pg">${pg}</span></li>`;
      }).join("");
      const keys = [s.id, "mv:" + s.movement, ...s.readings.map(r => "r:" + r), ...s.assignments.map(a => "a:" + a)].join(" ");
      let note = "";
      if (s.date_note) note = `<div class="note">Syllabus prints “${esc(s.date_syllabus)}”</div>`;
      if (s.exam) note = `<div class="note">Canvas due date: ${esc(dueFmt(A.midterm.due_utc))}</div>`;
      return `<div class="cal-cell"><a class="cal-card${s.exam ? " exam" : ""}${past ? " past" : ""}" href="#session/${s.id}" data-ref="session:${s.id}" data-k="${keys}" style="--mv:var(--mv-${s.exam ? "exam" : s.movement})">
        <span class="mvline"></span>
        <div class="cd"><span class="day">${esc(fmt(s.start_utc, { day: "numeric" }))}</span><span class="dl">${esc(fmt(s.start_utc, { weekday: "short" }))} · ${esc(fmt(s.start_utc, { month: "short" }))} · ${esc(classTime(s))}</span></div>
        <div class="tt">${s.topic_html}</div>
        ${rl ? `<ul class="rl">${rl}</ul>` : ""}${note}</a></div>`;
    };
    let rows = "";
    weeks.forEach((w, wi) => {
      const ss = SESS.filter(s => s.week === w);
      const tue = ss.find(s => s.dow === "Tue"), thu = ss.find(s => s.dow === "Thu");
      const monday = new Date(new Date(ss[0].date + "T12:00:00+08:00").getTime() - 864e5);
      const sunday = new Date(monday.getTime() + 6 * 864e5);
      if (wi === nowWeekIdx || (nowWeekIdx === -1 && wi === weeks.length) ) {
        const before = new Date(ss[0].start_utc) > NOW;
        rows += `<div class="cal-today" id="cal-today">today · ${esc(fmt(NOW, { weekday: "short", month: "short", day: "numeric" }))}${before && wi === 0 ? ` · ${daysUntil(ss[0].start_utc)} days before the first class` : ""}</div>`;
      }
      const r = refl(w);
      rows += `<div class="cal-wk"><div class="wn">${w}</div><div class="wd sc">${esc(fmt(monday, { month: "short", day: "numeric" }, "Asia/Shanghai"))}–${esc(fmt(sunday, { month: "short", day: "numeric" }, "Asia/Shanghai"))}</div></div>
        ${card(tue)}${card(thu)}
        <div class="cal-sat">${r ? `<a href="#assignment/${r.id}" data-ref="assignment:${r.id}" data-k="a:${r.id} c:refl ${r.sessions.join(" ")}"><span class="sq"></span>Reflection, Week ${w}<span class="t">${esc(dueFmt(r.due_utc))} · ${r.points} pts</span></a>` : `<span class="muted ital" style="font-size:.9em">No reflection in Week ${w}</span>`}</div>`;
      if (wi === 0 && signup) rows += `<div class="cal-week-note" style="grid-column:1/-1">Week 1: claim a discussion-leading slot on the <a href="${esc(C.signup_url)}" target="_blank" rel="noopener">sign-up sheet</a> (reservations “performed during the first week of class”).</div>`;
      if (ss.some(s => s.exam)) rows += `<div class="cal-week-note" style="grid-column:1/-1">${esc(D.midterm_note)} Individual slots have not been announced.</div>`;
    });
    rows += `<div class="cal-exam-row"><div class="cal-wk"><div class="wn" style="font-size:1rem">Exams</div></div>
      <div class="cal-cell"><a class="cal-card exam" href="#assignment/final" data-ref="assignment:final" data-k="final a:final c:final" style="--mv:var(--mv-exam)"><span class="mvline"></span>
      <div class="cd"><span class="day" style="font-size:1.2rem">Exam period</span><span class="dl">${esc(D.exam_period.when)}</span></div>
      <div class="tt">Final oral exams · ${A.final.points} points</div><div class="note">${esc(D.exam_period.syllabus)} No Canvas date.</div></a></div></div>`;
    el.innerHTML = `${secHead(3, "calendar", "The calendar", { seed: 47, motif: "ledger", sun: 0.9 })}
      <div class="with-margin"><p class="lede reveal">Fourteen sessions, Tuesdays and Thursdays, ${esc(classTime(SESS[0]))} ${TZ === "Asia/Shanghai" ? "Beijing time" : "New York time"}, in ${esc(C.location)}. Readings are listed with their page counts; reflections fall due each ${esc(fmt(firstRefl.due_utc, { weekday: "long" }))} at ${esc(time(firstRefl.due_utc))}.
        ${sidenote(esc(D.reflection_conflict))}</p></div>
      <div class="cal-controls reveal">
        <div class="muted" style="font-size:.82rem">Times shown in <b style="font-weight:500;color:var(--text)">${TZ === "Asia/Shanghai" ? "Asia/Shanghai (course time)" : "America/New_York (as Canvas displays them)"}</b>. Switch with BJT / NY at the top.</div>
        <button type="button" class="pill-btn no-print" id="cal-jump">Jump to this week</button>
      </div>
      <figure class="fig reveal">
        <div class="cal dim-scope" role="region" aria-label="Week-by-week calendar">
          <div class="cal-h" aria-hidden="true">Week</div><div class="cal-h" aria-hidden="true">Tuesday</div><div class="cal-h" aria-hidden="true">Thursday</div><div class="cal-h" aria-hidden="true">${esc(satLabel)}</div>
          ${rows}
        </div>
        <figcaption><b>Fig. 2</b> Week by week. The colored rule on each card marks its movement; pink outlines are oral exams. Page counts show the assigned portion where the syllabus limits it.</figcaption>
      </figure>`;
    $("#cal-jump").addEventListener("click", () => { const t = $("#cal-today") || $(".cal"); t.scrollIntoView({ behavior: "smooth", block: "center" }); });
  }

  // ================================================================== §4 LIBRARY
  let libSort = store.get("libSort", "session"), libFilter = store.get("libFilter", "all");
  const readingOrder = D.readings.slice().sort((a, b) => SESS.findIndex(s => s.id === a.sessions[0]) - SESS.findIndex(s => s.id === b.sessions[0]) || S[a.sessions[0]].readings.indexOf(a.id) - S[b.sessions[0]].readings.indexOf(b.id));
  const reqRanges = r => {
    const rs = [];
    r.requirements.forEach(q => (q.pdf_ranges || [[1, r.pages]]).forEach(x => rs.push(x)));
    rs.sort((a, b) => a[0] - b[0]);
    const m = [];
    rs.forEach(([a, b]) => { if (m.length && a <= m[m.length - 1][1] + 1) m[m.length - 1][1] = Math.max(b, m[m.length - 1][1]); else m.push([a, b]); });
    return m;
  };
  const reqPages = r => reqRanges(r).reduce((t, [a, b]) => t + b - a + 1, 0);
  function renderLibrary() {
    const el = $("#s-library");
    const total = D.readings.reduce((t, r) => t + r.pages, 0), req = D.readings.reduce((t, r) => t + reqPages(r), 0);
    const maxP = Math.max(...D.readings.map(r => r.pages));
    el.innerHTML = `${secHead(4, "library", "The readings", { seed: 83, motif: "books", sun: 0.88 })}
      <div class="with-margin"><p class="lede reveal">${D.readings.length} texts, from a six-page blog post to a book on German fascism of which four chapters are assigned. Each opens to ${SHOW_SUMMARIES ? "a summary, " : ""}the assigned pages, the PDF and its extracted text.
      ${sidenote(`Print the readings: devices are not allowed in class.`)}</p></div>
      <div class="lib-controls reveal">
        <div class="chips" role="group" aria-label="Filter by movement" id="lib-filter">
          <button type="button" class="chip" data-f="all" aria-pressed="${libFilter === "all"}">All</button>
          ${D.movements.map(m => `<button type="button" class="chip" data-f="${m.key}" aria-pressed="${libFilter === m.key}"><span class="dot" style="background:var(--mv-${m.key})"></span>${esc(m.name.replace("Prelude: m", "M"))}</button>`).join("")}
        </div>
        <div style="display:flex;gap:12px;align-items:center"><span class="muted sc" style="font-size:.78rem">Sort</span>
        <div class="seg" role="group" aria-label="Sort readings" id="lib-sort">
          ${["session", "author", "pages"].map(k => `<button type="button" data-s="${k}" aria-pressed="${libSort === k}">${k[0].toUpperCase() + k.slice(1)}</button>`).join("")}
        </div></div>
      </div>
      <div class="lib-summary reveal" id="lib-summary"></div>
      <figure class="fig reveal" style="margin-top:6px">
        <ol class="lib dim-scope" id="lib"></ol>
        <figcaption><b>Fig. 3</b> Each line is a PDF drawn to scale (the longest is ${maxP} pages); the filled part is what the syllabus assigns. <span class="tag">OCR</span> marks scans whose text was recognized by OCR; <span class="tag">spreads</span> marks scans with two book pages per PDF page.</figcaption>
      </figure>`;
    $("#lib-filter").addEventListener("click", e => { const b = e.target.closest("[data-f]"); if (!b) return; libFilter = b.dataset.f; store.set("libFilter", libFilter); $$("#lib-filter .chip").forEach(c => c.setAttribute("aria-pressed", c === b)); fillLibrary(); });
    $("#lib-sort").addEventListener("click", e => { const b = e.target.closest("[data-s]"); if (!b) return; libSort = b.dataset.s; store.set("libSort", libSort); $$("#lib-sort button").forEach(c => c.setAttribute("aria-pressed", c === b)); fillLibrary(); });
    fillLibrary();
    void total; void req;
  }
  function fillLibrary() {
    const maxP = Math.max(...D.readings.map(r => r.pages));
    let list = readingOrder.slice();
    if (libSort === "author") list.sort((a, b) => a.author.localeCompare(b.author));
    if (libSort === "pages") list.sort((a, b) => b.pages - a.pages);
    const shown = list.filter(r => libFilter === "all" || r.movement === libFilter);
    const tot = shown.reduce((t, r) => t + r.pages, 0), req = shown.reduce((t, r) => t + reqPages(r), 0);
    $("#lib-summary").textContent = `${shown.length} reading${shown.length === 1 ? "" : "s"} · ${tot} PDF pages · ${req} assigned`;
    $("#lib").innerHTML = shown.map(r => {
      const n = readingOrder.indexOf(r) + 1;
      const wPct = r.pages / maxP * 100;
      const segs = reqRanges(r).map(([a, b]) => `<rect class="req" x="${((a - 1) / maxP * 100).toFixed(3)}%" y="2" width="${Math.max(0.35, (b - a + 1) / maxP * 100).toFixed(3)}%" height="10" rx="1"></rect>`).join("");
      const partial = reqPages(r) < r.pages;
      const badges = [r.ocr ? `<span class="tag">OCR</span>` : "", r.spread ? `<span class="tag">spreads</span>` : "", partial ? `<span class="tag ok">${reqPages(r)} of ${r.pages} pp assigned</span>` : ""].join("");
      return `<li class="lib-row" data-open="#reading/${r.id}" data-k="r:${r.id} mv:${r.movement} ${r.sessions.join(" ")}" style="--mv:var(--mv-${r.movement})" aria-label="${esc(r.author)}, ${esc(strip(r.title_html))}">
        <span class="no">${n}</span>
        <span><span class="au">${esc(r.author)}</span><br><span class="ti">${refLink("reading", r.id, r.title_html)}</span><span class="badges">${badges}</span>${SHOW_SUMMARIES ? `<span class="teaser">${esc(strip(r.summary_html).split(/(?<=[.?!])\s/)[0])}</span>` : ""}</span>
        <span class="spine-col"><span class="spine"><svg aria-hidden="true"><rect class="tot" x="0.5" y="2" width="calc(${wPct.toFixed(3)}% - 1px)" height="10" rx="1"></rect>${segs}</svg></span><span class="spine-lbl">${r.pages} pp${r.pages > 1 ? "" : ""}</span></span>
        <span class="sess">${r.sessions.map(s => `${sessionLink(s)}<br>${esc(sessDate(S[s], { month: "short", day: "numeric" }))}`).join("<br>")}</span>
      </li>`;
    }).join("");
    // SVG rect width with calc() is not universally supported: set px widths after layout
    $$("#lib .spine svg").forEach((svg, i) => {
      const r = shown[i], W = svg.clientWidth || 200;
      const tot = svg.querySelector(".tot"); tot.setAttribute("width", Math.max(2, r.pages / maxP * W - 1));
      $$(".req", svg).forEach(rc => { rc.setAttribute("x", parseFloat(rc.getAttribute("x")) / 100 * W); rc.setAttribute("width", Math.max(1.5, parseFloat(rc.getAttribute("width")) / 100 * W)); });
    });
  }
  document.addEventListener("click", e => {
    const row = e.target.closest("[data-open]");
    if (row && !e.target.closest("a")) location.hash = row.dataset.open;
  });
  document.addEventListener("keydown", e => {
    const row = e.target.closest && e.target.closest("[data-open]");
    if (row && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); location.hash = row.dataset.open; }
  });

  // ================================================================== §5 GRADING
  const calcState = Object.assign({ final: 0.85, live: 0.85, mid: 0.85, lead: 0.85, refl: 0.85, abs: 0, late: 0 }, store.get("calc", {}));
  function renderGrading() {
    const el = $("#s-grading");
    const c = COMP;
    const scale = D.grading.scale_syllabus;
    el.innerHTML = `${secHead(5, "grading", "Assignments and grading", { seed: 59, motif: "coins", sun: 0.84 })}
      <div class="with-margin"><p class="lede reveal">The course is graded out of 100 points, one point per percent. Almost half is in ${hl("c:final c:mid", "two oral exams")}; the ${hl("c:live", "Live Engagement")} grade is shared by the whole class; the rest is ${hl("c:lead", "one discussion you lead")} and ${hl("c:refl", "six short reflections")}, due weekly from Week 2.
      ${sidenote("Assignment instructions and rubrics come from the syllabus.")}</p></div>
      <figure class="fig grade-figure reveal" id="fig-grade">
        <div class="fig-frame dim-scope" id="grade-frame"><svg id="grade-svg" role="img" aria-labelledby="grade-cap"></svg></div>
        <figcaption id="grade-cap"><b>Fig. 4</b> The 100 points and their due dates. Click a segment to open the assignment. Stem height is proportional to points; dashed marks have no date on Canvas. Live Engagement and Discussion Leading run through the session.</figcaption>
        <details class="table-fallback"><summary>Table version</summary>
          <table class="data"><thead><tr><th>Component</th><th>Points</th><th>When (${esc(tzNote())})</th></tr></thead><tbody>
          ${D.grading.components.map(k => `<tr><td>${esc(k.label)}</td><td>${k.key === "refl" ? "6 × 3 = 18" : k.points}</td><td>${k.assignments.map(id => A[id].due_utc ? esc(dueFmt(A[id].due_utc)) : "no Canvas date").join("; ")}</td></tr>`).join("")}
          </tbody></table></details>
      </figure>
      <h3 class="reveal" style="margin-top:38px;font-size:1.25rem">All ten assignments</h3>
      <ol class="a-list dim-scope reveal" id="a-list">${D.assignments.map(a => `
        <li class="a-row" data-open="#assignment/${a.id}" data-k="a:${a.id} c:${a.component} ${a.sessions.join(" ")}">
          <span class="sw dot-${a.component}"></span>
          <span class="nm">${assignLink(a.id)}<br><span class="sub">${esc(c[a.component].label)} · ${a.submission === "online_upload" ? "file upload on Canvas" : "no online submission"} · not yet graded</span></span>
          <span class="du">${a.due_utc ? esc(dueFmt(a.due_utc)) : a.component === "final" ? "exam period" : a.component === "lead" ? "your sign-up day" : "all session"}</span>
          <span class="pt">${a.points}</span></li>`).join("")}</ol>
      <div class="grade-tools">
        <div class="panel reveal" id="calc">
          <h3>Grade calculator</h3>
          <p class="hint">Set hypothetical scores. Absences and latenesses reduce Live Engagement under the attendance rule. Stored in this browser only.</p>
          ${["final", "mid", "live", "lead", "refl"].map(k => `<div class="calc-row"><label for="sl-${k}"><i class="dot-${k}"></i>${esc(c[k].label.replace(" Papers", "s"))}</label>
            <input type="range" id="sl-${k}" min="0" max="${c[k].points}" step="${k === "refl" ? 0.5 : 0.5}" value="${(calcState[k] * c[k].points).toFixed(1)}" style="--fill:var(--c-${k})">
            <output for="sl-${k}" id="o-${k}"></output></div>`).join("")}
          <div class="att-row"><span>Absences <span class="stepper"><button type="button" data-step="abs:-1" aria-label="Fewer absences">−</button><output id="o-abs">0</output><button type="button" data-step="abs:1" aria-label="More absences">+</button></span></span>
            <span>Latenesses <span class="stepper"><button type="button" data-step="late:-1" aria-label="Fewer latenesses">−</button><output id="o-late">0</output><button type="button" data-step="late:1" aria-label="More latenesses">+</button></span></span></div>
          <div class="calc-total"><span class="big lnum" id="o-total">0</span><span class="letter" id="o-letter">–</span><span class="vs" id="o-vs"></span></div>
        </div>
        <div>
          <div class="panel reveal">
            <h3>The scale</h3>
            <p class="hint">Only “+” grades: ${scale.map(s => `${s.grade} ${s.grade === "F" ? "below 60" : s.min + "–" + (s.max === 100 ? 100 : Math.floor(s.max) + (s.max % 1 ? ".999" : ""))}`).join(" · ")}.</p>
            <figure class="fig scale-fig dim-scope" style="margin:0"><svg id="scale-svg" role="img" aria-label="Grading scale from 0 to 100"></svg>
              <figcaption><b>Fig. 5</b> The syllabus grade bands. The pink marker is the calculator total.</figcaption></figure>
            <details class="table-fallback"><summary>Explanation, from the syllabus</summary><div style="font-size:.86rem">${D.grading.scale_explanation_html}</div></details>
          </div>
          <div class="panel reveal" style="margin-top:18px" id="attendance">
            <h3>Attendance</h3>
            <p class="hint">${D.attendance.free} unexcused absences are free. Each one after that costs ${D.attendance.penalty_pct}% of Live Engagement; the ${D.attendance.zero_at}th zeroes it; more than ${D.attendance.f_above} may mean an F. ${D.attendance.late_per_absence} latenesses count as one absence.</p>
            <div class="att-fig"><svg id="att-svg" role="img" aria-labelledby="att-cap"></svg></div>
            <div class="att-legend" id="att-cap"><b style="color:var(--text);font-weight:600">Fig. 6</b> Absences from left to right; the stepper above moves the marker.</div>
          </div>
        </div>
      </div>`;
    ["final", "mid", "live", "lead", "refl"].forEach(k => $("#sl-" + k).addEventListener("input", e => { calcState[k] = e.target.value / c[k].points; updateCalc(); }));
    $$("#calc [data-step]").forEach(b => b.addEventListener("click", () => {
      const [k, d] = b.dataset.step.split(":");
      calcState[k] = Math.max(0, Math.min(k === "abs" ? 6 : 9, calcState[k] + Number(d)));
      updateCalc();
    }));
    drawGradeFigure();
    updateCalc();
  }
  function attendanceFactor() {
    const eff = calcState.abs + Math.floor(calcState.late / D.attendance.late_per_absence);
    const over = Math.max(0, eff - D.attendance.free);
    const f = eff >= D.attendance.zero_at ? 0 : Math.max(0, 1 - over * D.attendance.penalty_pct / 100);
    return { eff, f, fail: eff > D.attendance.f_above };
  }
  const letterFor = (p, scale) => (scale.find(s => p >= s.min) || scale[scale.length - 1]).grade;
  function updateCalc() {
    const c = COMP;
    const { eff, f, fail } = attendanceFactor();
    let total = 0;
    ["final", "mid", "live", "lead", "refl"].forEach(k => {
      const sl = $("#sl-" + k), v = Number(sl.value);
      sl.style.setProperty("--pct", (v / c[k].points * 100) + "%");
      let shown = v;
      if (k === "live") shown = v * f;
      total += shown;
      $("#o-" + k).innerHTML = k === "live" && f < 1 ? `<span style="color:var(--link)">${shown.toFixed(1)}</span>/${c[k].points}` : `${v.toFixed(1)}/${c[k].points}`;
    });
    $("#o-abs").textContent = calcState.abs; $("#o-late").textContent = calcState.late;
    total = Math.round(total * 10) / 10;
    const syl = letterFor(total, D.grading.scale_syllabus);
    $("#o-total").textContent = total.toFixed(1);
    $("#o-letter").textContent = fail ? "F?" : syl;
    $("#o-vs").innerHTML = fail ? `More than ${D.attendance.f_above} absences: the instructor may assign an F.` : `syllabus grade${f < 1 ? ` · Live Engagement ×${f} for ${eff} absence${eff === 1 ? "" : "s"}` : ""}`;
    store.set("calc", calcState);
    drawScale(total);
    drawAttendance();
  }
  function drawScale(total) {
    const svg = $("#scale-svg"); if (!svg) return;
    const W = Math.max(280, svg.clientWidth || 420), H = 50, L = 6, Rr = 6;
    const X = p => L + p / 100 * (W - L - Rr);
    svg.setAttribute("viewBox", `0 0 ${W} ${H}`); svg.innerHTML = "";
    const sc = D.grading.scale_syllabus.slice().reverse();
    sc.forEach((s, i) => {
      const lo = s.min, hi = i < sc.length - 1 ? sc[i + 1].min : 100;
      const tint = { "A+": "lead", "B+": "live", "C+": "refl", "D+": "mid", F: "final" }[s.grade];
      svgEl("rect", { x: X(lo), y: 18, width: X(hi) - X(lo) - 1, height: 26, class: "fill-" + tint, rx: 2, "data-k": "g:" + s.grade }, svg);
      if (X(hi) - X(lo) > 22) svgEl("text", { x: (X(lo) + X(hi)) / 2, y: 36, "text-anchor": "middle", class: "ink-" + tint, style: "font-size:13px;font-family:var(--serif)" }, svg, s.grade);
    });
    [0, 60, 70, 80, 90, 100].forEach(p => svgEl("text", { x: X(p), y: 12, "text-anchor": p === 0 ? "start" : p === 100 ? "end" : "middle", class: "tick-lbl" }, svg, p));
    const tx = X(total);
    svgEl("path", { d: `M${tx},16v30`, style: "stroke:var(--today);stroke-width:2" }, svg);
    svgEl("path", { d: `M${tx - 5},10L${tx + 5},10L${tx},16Z`, class: "pk", style: "fill:var(--today)" }, svg);
  }
  function drawAttendance() {
    const svg = $("#att-svg"); if (!svg) return;
    const W = Math.max(280, svg.clientWidth || 420), H = 92;
    svg.setAttribute("viewBox", `0 0 ${W} ${H}`); svg.innerHTML = "";
    const { eff } = attendanceFactor();
    const n = 6, step = (W - 40) / (n - 1), y = 34;
    const lab = ["free", "free", `−${D.attendance.penalty_pct}% LE`, "LE = 0", "may be F", "may be F"];
    for (let i = 1; i <= n; i++) {
      const x = 20 + (i - 1) * step;
      const free = i <= D.attendance.free, half = i === D.attendance.free + 1, zero = i === D.attendance.zero_at, fail = i > D.attendance.f_above;
      svgEl("circle", { cx: x, cy: y, r: 13, style: `fill:${free ? "var(--c-lead)" : "none"};stroke:${fail ? "var(--today)" : "var(--text)"};stroke-width:1.2;${fail ? "stroke-dasharray:3 2.5" : ""}` }, svg);
      if (half) svgEl("path", { d: `M${x},${y - 13}A13,13 0 0,1 ${x},${y + 13}Z`, class: "fill-mid" }, svg);
      if (zero) { svgEl("path", { d: `M${x - 7},${y - 7}L${x + 7},${y + 7}M${x + 7},${y - 7}L${x - 7},${y + 7}`, style: "stroke:var(--today);stroke-width:1.4" }, svg); }
      svgEl("text", { x, y: y + 4, "text-anchor": "middle", class: free ? "ink-lead" : "svg-text", style: "font-size:12px;font-variant-numeric:lining-nums" }, svg, i);
      svgEl("text", { x, y: y + 30, "text-anchor": "middle", class: "tick-lbl" }, svg, lab[i - 1]);
    }
    // latenesses: three ticks = one absence
    svgEl("text", { x: 4, y: 84, class: "tick-lbl", style: "font-size:10px" }, svg, `latenesses ${calcState.late} → ${Math.floor(calcState.late / 3)} absence${Math.floor(calcState.late / 3) === 1 ? "" : "s"}`);
    if (eff > 0) {
      const x = 20 + (Math.min(eff, n) - 1) * step;
      svgEl("path", { d: `M${x - 5},6L${x + 5},6L${x},13Z`, style: "fill:var(--today)" }, svg);
    }
  }
  function drawGradeFigure() {
    const svg = $("#grade-svg"); if (!svg) return;
    const W = Math.max(300, $("#grade-frame").clientWidth - 44);
    const narrow = W < 560;
    const H = narrow ? 300 : 330;
    svg.setAttribute("viewBox", `0 0 ${W} ${H}`); svg.innerHTML = "";
    const L = 2, Rr = 2, by = 22, bh = narrow ? 38 : 46, unit = (W - L - Rr) / 100;
    const segs = [];
    ["final", "live", "mid", "lead"].forEach(k => segs.push({ k, a: COMP[k].assignments[0], pts: COMP[k].points, label: COMP[k].label }));
    COMP.refl.assignments.forEach(id => segs.push({ k: "refl", a: id, pts: A[id].points, label: "Week " + A[id].week, w: A[id].week }));
    let x = L; const centers = {};
    svgEl("text", { x: L, y: 12, class: "tick-lbl" }, svg, "0");
    svgEl("text", { x: W - Rr, y: 12, class: "tick-lbl", "text-anchor": "end" }, svg, "100 points");
    segs.forEach(s => {
      const w = s.pts * unit;
      const g = svgEl("g", { "data-k": `a:${s.a} c:${s.k}`, tabindex: 0, role: "button", "aria-label": `${A[s.a].name}, ${s.pts} points`, class: "seg-g" }, svg);
      svgEl("rect", { x, y: by, width: w, height: bh, class: `seg-rect fill-${s.k}` }, g);
      let lbl = "";
      if (s.k === "refl") lbl = w >= 13 ? String(s.w) : "";
      else { const short = s.label.replace(" oral exam", "").replace("Discussion Leading", "Leading"); lbl = w > (short.length + 4) * 7.6 ? `${short} ${s.pts}` : w > 22 ? String(s.pts) : ""; }
      if (lbl) svgEl("text", { x: x + w / 2, y: by + bh / 2 + 5, "text-anchor": "middle", class: `ink-${s.k}`, style: `font-size:${s.k === "refl" ? 12 : narrow ? 13 : 15}px;font-family:var(--serif);pointer-events:none;font-variant-numeric:lining-nums` }, g, lbl);
      g.addEventListener("click", () => { location.hash = "#assignment/" + s.a; });
      g.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); location.hash = "#assignment/" + s.a; } });
      centers[s.a] = x + w / 2;
      x += w;
    });
    const rx0 = L + 82 * unit;
    svgEl("path", { d: `M${rx0 + 1},${by + bh + 6}v5H${x - 1}v-5`, class: "axis", "data-k": "c:refl", style: "fill:none" }, svg);
    svgEl("text", { x: (rx0 + x) / 2, y: by + bh + 25, "text-anchor": "end", class: "tick-lbl", style: "font-size:12px" }, svg, "Reflections 6 × 3");

    // timeline
    const ay = H - 64;
    const gutW = narrow ? 64 : 120;
    const d0 = new Date("2026-10-26T00:00:00+08:00").getTime(), d1 = new Date("2026-12-13T00:00:00+08:00").getTime();
    const t0 = L + 2, t1 = W - Rr - gutW - 10;
    const X = t => t0 + (t - d0) / (d1 - d0) * (t1 - t0);
    svgEl("line", { x1: t0, x2: t1, y1: ay, y2: ay, class: "axis" }, svg);
    for (let k = 0; k < 7; k++) {
      const t = d0 + k * 7 * 864e5;
      svgEl("line", { x1: X(t), x2: X(t), y1: ay, y2: ay + 5, class: "axis" }, svg);
      svgEl("text", { x: X(t) + 3, y: ay + 17, class: "tick-lbl" }, svg, narrow ? `W${k + 1}` : `W${k + 1} ${fmt(new Date(t + 12 * 36e5), { month: "short", day: "numeric" }, "Asia/Shanghai")}`);
    }
    // exam-period gutter (hatched)
    const gx = W - Rr - gutW, gTop = ay - 130;
    const defs = svgEl("defs", {}, svg);
    const pat = svgEl("pattern", { id: "gh", width: 6, height: 6, patternUnits: "userSpaceOnUse", patternTransform: "rotate(45)" }, defs);
    svgEl("line", { x1: 0, y1: 0, x2: 0, y2: 6, class: "hatch-line" }, pat);
    svgEl("rect", { x: gx, y: gTop, width: gutW, height: ay - gTop, fill: "url(#gh)" }, svg);
    svgEl("line", { x1: gx, x2: gx + gutW, y1: ay, y2: ay, class: "axis", style: "stroke-dasharray:3 3" }, svg);
    svgEl("text", { x: gx + gutW / 2, y: ay + 17, "text-anchor": "middle", class: "tick-lbl" }, svg, narrow ? "exams" : "exam period · not set");
    // ongoing bands
    const s0 = X(new Date(SESS[0].start_utc).getTime()), s1 = X(new Date(SESS[SESS.length - 1].end_utc).getTime());
    [["live", ay + 28, "Live Engagement · every class"], ["lead", ay + 42, "Discussion Leading · your sign-up day"]].forEach(([k, y, label]) => {
      const g = svgEl("g", { "data-k": `a:${COMP[k].assignments[0]} c:${k}`, tabindex: 0, role: "button", "aria-label": label, style: "cursor:pointer" }, svg);
      svgEl("rect", { x: s0, y, width: s1 - s0, height: 7, rx: 3.5, class: `fill-${k}`, style: k === "lead" ? "opacity:.55" : "" }, g);
      if (k === "lead") for (let xx = s0 + 10; xx < s1; xx += 26) svgEl("circle", { cx: xx, cy: y + 3.5, r: 1.6, class: "ink-lead" }, g);
      svgEl("text", { x: s1 + 6, y: y + 7, class: "tick-lbl", style: "font-size:10.5px;font-style:italic" }, g, narrow ? label.split(" · ")[0] : label);
      g.addEventListener("click", () => { location.hash = "#assignment/" + COMP[k].assignments[0]; });
      svgEl("path", { d: `M${centers[COMP[k].assignments[0]]},${by + bh} C${centers[COMP[k].assignments[0]]},${by + bh + 80} ${s0},${y - 60} ${s0},${y}`, class: "connector", "data-k": `a:${COMP[k].assignments[0]} c:${k}` }, svg);
    });
    // lollipops
    const K = narrow ? 3.4 : 4;
    const lolly = (id, k, xp, unknown, label) => {
      const h = A[id].points * K;
      const g = svgEl("g", { "data-k": `a:${id} c:${k}`, style: "cursor:pointer" }, svg);
      svgEl("path", { d: `M${centers[id]},${by + bh} C${centers[id]},${by + bh + 70} ${xp},${ay - h - 60} ${xp},${ay - h - 7}`, class: "connector", "data-k": `a:${id} c:${k}` }, svg);
      svgEl("line", { x1: xp, x2: xp, y1: ay, y2: ay - h, class: `stroke-${k}`, style: `stroke-width:2;${unknown ? "stroke-dasharray:3 2.5;stroke:var(--text)" : ""}` }, g);
      svgEl("circle", { cx: xp, cy: ay - h, r: k === "refl" ? 4.5 : 6, class: unknown ? "unknown-mark" : `fill-${k}`, style: unknown ? "stroke:var(--text)" : "" }, g);
      if (label) svgEl("text", { x: xp, y: ay - h - 11, "text-anchor": "middle", class: "tick-lbl", style: "font-size:11.5px" }, g, label);
      g.addEventListener("click", () => { location.hash = "#assignment/" + id; });
    };
    COMP.refl.assignments.forEach(id => lolly(id, "refl", X(new Date(A[id].due_utc).getTime()), false, narrow ? String(A[id].week) : "R" + A[id].week));
    const midClass = SESS.find(s => s.exam);
    svgEl("rect", { x: X(new Date(midClass.start_utc).getTime()), y: ay - 2.5, width: X(new Date(A.midterm.due_utc).getTime()) - X(new Date(midClass.start_utc).getTime()), height: 5, class: "fill-mid", "data-k": "a:midterm c:mid" }, svg);
    lolly("midterm", "mid", X(new Date(midClass.start_utc).getTime()), false, narrow ? "Midterm" : `Midterm · ${fmt(midClass.start_utc, { month: "short", day: "numeric" })}–${fmt(A.midterm.due_utc, { day: "numeric" })}`);
    lolly("final", "final", gx + gutW / 2, true, narrow ? "Final" : "Final · date not set");
    // today
    const tn = NOW.getTime();
    if (tn < d0) svgEl("text", { x: t0, y: narrow ? gTop + 10 : ay - 6, class: "today-txt", style: "font-size:11px" }, svg, `← today, ${fmt(NOW, { month: "short", day: "numeric" })}`);
    else if (tn < d1) { svgEl("line", { x1: X(tn), x2: X(tn), y1: ay - 130, y2: ay + 50, style: "stroke:var(--today);stroke-width:1;stroke-dasharray:2 3" }, svg); svgEl("text", { x: X(tn) + 4, y: ay - 120, class: "today-txt", style: "font-size:11px" }, svg, "today"); }
  }

  // ================================================================== §6 RULES
  const ICONS = {
    ai: `<svg viewBox="0 0 40 40" aria-hidden="true"><path d="M7 9h22a3 3 0 0 1 3 3v11a3 3 0 0 1-3 3H17l-6 5v-5H7a3 3 0 0 1-3-3V12a3 3 0 0 1 3-3z"/><path d="M11 15h14M11 20h9"/><path class="pk" d="M5 35L35 5"/></svg>`,
    devices: `<svg viewBox="0 0 40 40" aria-hidden="true"><rect x="9" y="5" width="22" height="13" rx="1.5"/><path d="M6 21h28M12 25h16v10H12z"/><path d="M15 29h10M15 32h7"/><path class="pk" d="M7 5l26 13"/></svg>`,
    chatham: `<svg viewBox="0 0 40 40" aria-hidden="true"><path d="M8 34V9l12-4 12 4v25"/><path d="M15 34V20h10v14"/><path d="M20 20v14"/><circle class="pk" cx="23" cy="27" r="1"/></svg>`,
    absences: `<svg viewBox="0 0 40 40" aria-hidden="true"><circle cx="9" cy="20" r="5"/><circle cx="20" cy="20" r="5"/><circle class="pk" cx="31" cy="20" r="5"/><path d="M5 31h30"/><path d="M28 33l3-2 3 2"/></svg>`,
  };
  function renderRules() {
    const el = $("#s-rules");
    const P = Object.fromEntries(D.policies.map(p => [p.key, p]));
    const tiles = [
      ["ai", "No AI on assignments", "No LLM text generation. Violations are an academic-integrity case: a zero, or failing the class."],
      ["devices", "No devices; print the readings", "No laptops, phones or tablets in class. Breaking this can count as an absence."],
      ["chatham", "Chatham House rule", "Use what is said, never who said it. No recording of class."],
      ["absences", `${D.attendance.free} free absences`, `Then −${D.attendance.penalty_pct}% of Live Engagement each; ${D.attendance.zero_at} zero it. ${D.attendance.late_per_absence} latenesses = 1 absence.`],
    ];
    el.innerHTML = `${secHead(6, "rules", "Rules and policies", { seed: 13, motif: "columns", sun: 0.86, h: 110 })}
      <div class="with-margin"><p class="reveal muted" style="font-size:.95rem">${esc(D.key_rules)}</p></div>
      <div class="rules">${tiles.map(([k, t, d]) => `<a class="rule reveal" href="#pol-${k === "absences" ? "absences" : k}" style="text-decoration:none;color:inherit">${ICONS[k]}<h3>${esc(t)}</h3><p>${esc(d)}</p></a>`).join("")}</div>
      <div class="contact">
        <div class="panel reveal"><div class="src-label">Instructor</div>
          <h3 style="font-size:1.25rem">${esc(C.instructor.name)}</h3>
          <div class="muted" style="font-size:.88rem">${esc(C.instructor.title)}</div>
          <dl class="kv" style="margin-top:12px">
            <dt>Email</dt><dd><a href="mailto:${esc(C.instructor.email)}">${esc(C.instructor.email)}</a> <span class="muted">(preferred)</span></dd>
            <dt>Office</dt><dd>${esc(C.instructor.office)}</dd>
            <dt>Phone</dt><dd>${esc(/\)$/.test(C.instructor.phone) ? C.instructor.phone.replace(/\)$/, "; unreliable)") : C.instructor.phone + " (unreliable)")}</dd>
            <dt>TAs</dt><dd>${esc(C.tas)}</dd>
          </dl>
          <details class="table-fallback" style="margin-top:10px"><summary>About the instructor (syllabus)</summary><div style="font-size:.86rem">${C.instructor.bio_html}</div></details>
        </div>
        <div class="panel reveal"><div class="src-label">Office hours</div>
          <p style="margin:.2em 0 .6em;font-size:1rem">${esc(C.office_hours)}</p>
          <p class="muted" style="font-size:.86rem">Online when needed: <a href="${esc(C.zoom)}" target="_blank" rel="noopener">Zoom room</a>. The syllabus links <a href="${esc(C.office_hours_video)}" target="_blank" rel="noopener">a short video</a> on what office hours are for.</p>
        </div>
      </div>
      <div class="policy-acc reveal"><div class="verbatim-label" style="padding:10px 4px 0">Verbatim from the syllabus</div>
        ${D.policies.map(p => `<details id="pol-${p.key}"><summary><span>${esc(p.title)}</span></summary><div class="pbody">${p.html}</div></details>`).join("")}
      </div>`;
    $$(".rule", el).forEach(a => a.addEventListener("click", e => { e.preventDefault(); const d = $(a.getAttribute("href")); d.open = true; d.scrollIntoView({ behavior: "smooth", block: "center" }); }));
  }

  function renderColophon() {
    $("#colophon").innerHTML = `<hr><div>
      <div><p style="margin-top:0">Sessions, readings, assignments and policies are from the course syllabus. The grouping of sessions into movements, the threads and the short glosses are my own.</p>
      <p>Set in EB Garamond. Keys: <kbd>/</kbd> search · <kbd>J</kbd>/<kbd>K</kbd> next/previous session · <kbd>Esc</kbd> close.</p></div></div>`;
  }

  // ================================================================== DRAWER
  const drawer = $("#drawer"), dBody = $("#d-body"), dCrumb = $("#d-crumb"), dNav = $("#d-nav"), scrim = $("#scrim");
  let lastFocus = null, current = null, readingShow = null;
  function openDrawer() {
    if (!drawer.classList.contains("on")) lastFocus = document.activeElement;
    drawer.classList.add("on"); scrim.classList.add("on");
    drawer.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
    setTimeout(() => $("#d-close").focus({ preventScroll: true }), 60);
  }
  function closeDrawer(updateHash = true) {
    if (!drawer.classList.contains("on")) return;
    drawer.classList.remove("on"); scrim.classList.remove("on");
    drawer.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
    current = null;
    if (updateHash && /^#(reading|session|assignment)\//.test(location.hash)) history.pushState(null, "", location.pathname + location.search);
    if (lastFocus && document.contains(lastFocus)) lastFocus.focus({ preventScroll: true });
  }
  $("#d-close").addEventListener("click", () => closeDrawer());
  scrim.addEventListener("click", () => closeDrawer());
  drawer.addEventListener("keydown", e => {
    if (e.key !== "Tab") return;
    const f = $$('a[href], button:not([disabled]), input, select, textarea, iframe, [tabindex]:not([tabindex="-1"])', drawer).filter(n => n.offsetParent !== null);
    if (!f.length) return;
    if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
    else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
  });
  const navBtns = (prev, next, label) => `
    <button class="icon-btn" type="button" ${prev ? `data-go="${prev}"` : "disabled style='opacity:.3'"} aria-label="Previous ${label} (K)"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M10 3.5L5.5 8l4.5 4.5"/></svg></button>
    <button class="icon-btn" type="button" ${next ? `data-go="${next}"` : "disabled style='opacity:.3'"} aria-label="Next ${label} (J)"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M6 3.5L10.5 8 6 12.5"/></svg></button>`;
  dNav.addEventListener("click", e => { const b = e.target.closest("[data-go]"); if (b) location.hash = b.dataset.go; });
  const srcLabel = t => `<div class="src-label">${esc(t)}</div>`;

  function sessionDrawer(id) {
    const order = [...SESS.map(s => s.id), "final"];
    const i = order.indexOf(id);
    const prev = i > 0 ? "#session/" + order[i - 1] : null, next = i < order.length - 1 ? "#session/" + order[i + 1] : null;
    dNav.innerHTML = navBtns(prev, next, "session");
    if (id === "final") {
      dCrumb.textContent = "Session · Exam period";
      dBody.innerHTML = `<div class="d-hero has-emblem"><span class="emblem-slot" data-emblem="exam"></span><div class="d-kicker">Exam period</div><h2 id="d-title">Final oral exams</h2><div class="d-sub">${esc(D.exam_period.when)}</div></div>
        <div class="d-sec">${srcLabel("From the syllabus")}<p class="prose">${esc(D.exam_period.syllabus)}</p>
        <h3>Assignment</h3><ul class="mini-list"><li>${assignLink("final", `<span>Final Oral Exam</span><span class="r">${A.final.points} pts · no Canvas date</span>`)}</li></ul></div>`;
      return;
    }
    const s = S[id], m = MV[s.movement];
    dCrumb.textContent = `Session · ${sessLabel(s)} · ${sessDate(s)}`;
    const reads = s.readings.map(rid => {
      const r = R[rid], q = s.reading_notes[rid];
      return `<li>${readingLink(rid, `<span><span class="au">${esc(authorShort(r))}</span>${r.title_html}${q && q.kind ? `<br><span class="muted" style="font-size:.85em">${esc(reqSummary(q))}</span>` : ""}</span><span class="r">${q && q.pdf_pages_total && !q.whole_file ? q.pdf_pages_total + " of " : ""}${r.pages} pp</span>`)}</li>`;
    }).join("");
    const ths = D.threads.filter(t => t.from === id || t.to === id).map(t => `<li>${sessionLink(t.from === id ? t.to : t.from, `<span>${t.from === id ? "→" : "←"} ${esc(S[t.from === id ? t.to : t.from].topic)}<br><span class="muted" style="font-size:.85em;font-style:italic">${esc(t.label)}</span></span><span class="r">${sessLabel(S[t.from === id ? t.to : t.from])}</span>`)}</li>`).join("");
    const asg = s.assignments.map(a => `<li>${assignLink(a, `<span>${esc(A[a].name)}</span><span class="r">${A[a].due_utc ? esc(dueFmt(A[a].due_utc)) : "—"} · ${A[a].points} pts</span>`)}</li>`).join("");
    dBody.innerHTML = `
      <div class="d-hero has-emblem"><span class="emblem-slot" data-emblem="${s.exam ? "exam" : s.movement}"></span>
        <div class="d-kicker">${sessLabel(s)} · ${s.exam ? "Oral exams" : esc(m.name)}</div>
        <h2 id="d-title">${s.topic_html}</h2>
        <div class="d-sub">${esc(sessDate(s, { weekday: "long", month: "long", day: "numeric" }))} · ${esc(classTime(s))} ${esc(tzNote())} · ${esc(C.location)}</div></div>
      <div class="d-sec">
        ${s.date_note ? `<div class="notice">${esc(s.date_note)}</div>` : ""}
        ${s.exam ? `<div class="notice calm">${esc(D.midterm_note)} Canvas lists the midterm as due ${esc(dueFmt(A.midterm.due_utc))}; individual slots have not been announced.</div>` : ""}
        ${srcLabel("From the syllabus")}
        <h3>Before class</h3><div class="prose">${s.prework_html || "—"}</div>
        ${reads ? `<h3>Readings</h3><ul class="mini-list">${reads}</ul>` : ""}
        <h3>In class</h3><div class="prose">${s.activities_html || "—"}</div>
        <h3>Assignments due</h3><div class="prose">The syllabus says: “${esc(s.due_syllabus || "—")}”.${!s.exam && s.due_syllabus === "Reflection paper" ? " Only one paper per week is required." : ""}</div>
        ${asg ? `<ul class="mini-list" style="margin-top:6px">${asg}</ul>` : ""}
        ${ths ? `<h3>Threads <span class="tag">editorial</span></h3><ul class="mini-list">${ths}</ul>` : ""}
      </div>`;
  }

  function assignmentDrawer(id) {
    const a = A[id];
    const i = D.assignments.indexOf(a);
    dNav.innerHTML = navBtns(i > 0 ? "#assignment/" + D.assignments[i - 1].id : null, i < D.assignments.length - 1 ? "#assignment/" + D.assignments[i + 1].id : null, "assignment");
    dCrumb.textContent = `Assignment · ${COMP[a.component].label}`;
    const sy = a.syllabus;
    const crit = sy.criteria_b ? `<h3>What the grades mean</h3><div class="criteria"><div><h4>Adequate (B-level)</h4><ul>${sy.criteria_b.map(x => `<li>${x}</li>`).join("")}</ul></div><div class="a"><h4>Excellent (A-level)</h4><ul>${sy.criteria_a.map(x => `<li>${x}</li>`).join("")}</ul></div></div>` : "";
    const rub = sy.rubric ? `<h3>${esc(sy.rubric_title)}</h3><table class="rubric">${sy.rubric.map((x, j) => `<tr><td>${j + 1}</td><td>${x}</td></tr>`).join("")}</table>` : "";
    const oral = a.component === "mid" || a.component === "final";
    const related = a.sessions.map(sid => `<li>${sessionLink(sid, `<span>${S[sid].topic_html}<br><span class="muted" style="font-size:.85em">${S[sid].readings.map(r => esc(authorShort(R[r]))).join(" · ")}</span></span><span class="r">${sessLabel(S[sid])} · ${esc(sessDate(S[sid], { month: "short", day: "numeric" }))}</span>`)}</li>`).join("");
    dBody.innerHTML = `<div class="d-band bg-${a.component}"></div>
      <div class="d-hero"><div class="d-kicker">${esc(COMP[a.component].label)} · ${a.points} point${a.points === 1 ? "" : "s"} of 100</div>
        <h2 id="d-title">${esc(a.name)}</h2>
        <div class="d-sub">${a.due_utc ? `Due ${esc(fmt(a.due_utc, { weekday: "long", month: "long", day: "numeric" }))}, ${esc(time(a.due_utc))} ${esc(tzNote())}` : "No due date on Canvas"}</div></div>
      <div class="d-sec">

                ${a.component === "refl" ? `<div class="notice calm">${esc(D.reflection_conflict)}</div>` : ""}
        
        ${related ? `<h3>Responds to</h3><ul class="mini-list">${related}</ul>` : ""}
        <div style="margin-top:22px">${srcLabel("From the syllabus")}</div>
        <div class="prose">${sy.html}</div>
        ${rub}${crit}
        ${a.component === "live" ? `<p class="prose"><a href="#attendance" data-close-drawer>How absences affect this grade →</a></p>` : ""}
        <h3 style="margin-top:26px">Notes</h3><div class="prose muted" style="font-size:.88rem">${a.guidance_html}</div>
        <div class="fineprint">${a.due_utc ? `Canvas shows the deadline as ${esc(a.due_canvas_display)} · ` : ""}Submission: ${a.submission === "online_upload" ? "file upload on Canvas" : "none online (graded in class or office)"} · Rubric: ${oral ? "to be posted" : sy.rubric ? "none on Canvas; the syllabus gives one" : "none on Canvas"} · not submitted, not graded · <a href="${esc(a.canvas_url)}" target="_blank" rel="noopener">open on Canvas</a></div>
      </div>`;
  }

  const textCache = {};
  const loadText = r => textCache[r.id] || (textCache[r.id] = fetch(r.text_url).then(x => { if (!x.ok) throw new Error(x.status); return x.json(); }));
  function readingDrawer(id, tab = "summary", page = null, q = "") {
    const r = R[id];
    const i = readingOrder.indexOf(r);
    dNav.innerHTML = navBtns(i > 0 ? "#reading/" + readingOrder[i - 1].id : null, i < readingOrder.length - 1 ? "#reading/" + readingOrder[i + 1].id : null, "reading");
    dCrumb.textContent = `Reading · ${authorShort(r)}`;
    const reqHTML = r.requirements.map(qq => {
      const s = S[qq.session];
      const btns = (qq.pdf_ranges || []).map(([a, b]) => `<button type="button" data-page="${a}">PDF p. ${a}${b !== a ? "–" + b : ""}</button>`).join("");
      return `<div class="req-box"><div class="sc" style="font-size:.76rem;color:var(--accent)">${sessionLink(s.id, `${sessLabel(s)} · ${esc(sessDate(s))}`)}</div>
        <div>As listed: <em>${esc(qq.as_listed)}</em></div>
        ${qq.kind === "pages" ? `<div class="muted" style="font-size:.86em;margin-top:4px">Book pages ${esc(qq.book_pages)} ${qq.pdf_ranges ? `are PDF pages ${qq.pdf_ranges.map(x => x[0] + "–" + x[1]).join(", ")} (${qq.pdf_pages_total} of ${r.pages}), matched from the printed page numbers.` : "(could not be matched to PDF pages)."}</div>` : ""}
        ${qq.kind === "chapters" && !qq.whole_file ? `<div class="muted" style="font-size:.86em;margin-top:4px">${qq.pdf_ranges ? `Chapters located at PDF pages ${qq.pdf_ranges.map(x => x[0] + "–" + x[1]).join(", ")} (${qq.pdf_pages_total} of ${r.pages}) from the chapter headings.` : "The chapters could not be located in the PDF."}</div>` : ""}
        ${qq.whole_file ? `<div class="muted" style="font-size:.86em;margin-top:4px">The PDF contains exactly these chapters.</div>` : ""}
        ${qq.rest ? `<div class="muted" style="font-size:.86em">${esc(qq.rest)}</div>` : ""}
        ${btns && !qq.whole_file ? `<div class="pages">${btns}</div>` : ""}
        <div class="pagemap" data-ranges='${JSON.stringify(qq.pdf_ranges || [[1, r.pages]])}' data-total="${r.pages}"></div></div>`;
    }).join("");
    const pairs = r.pairs.map(p => `<li>${readingLink(p, `<span><span class="au">${esc(authorShort(R[p]))}</span>${R[p].title_html}</span><span class="r">${R[p].pages} pp</span>`)}</li>`).join("");
    const refl = r.reflections.map(a => `<li>${assignLink(a, `<span>${esc(A[a].name)}</span><span class="r">${esc(dueFmt(A[a].due_utc))}</span>`)}</li>`).join("");
    const ths = r.threads.map(t => `<li>${sessionLink(r.sessions.includes(t.from) ? t.to : t.from, `<span>${esc(t.label)}</span><span class="r">${sessLabel(S[r.sessions.includes(t.from) ? t.to : t.from])}</span>`)}</li>`).join("");
    const big = r.bytes > 5e6;
    dBody.innerHTML = `
      <div class="d-hero has-emblem"><span class="emblem-slot" data-emblem="${r.movement}"></span>
        <div class="d-kicker">${esc(r.author)}</div><h2 id="d-title">${r.title_html}</h2>
        <div class="d-sub">${r.sessions.map(s => `${sessLabel(S[s])}, ${esc(sessDate(S[s]))}`).join(" and ")} · ${esc(mvName(r.movement))}</div></div>
      <div class="tabs" role="tablist" aria-label="Reading views">
        ${[["summary", SHOW_SUMMARIES ? "Summary" : "Details"], ["pdf", "PDF"], ["text", "Text"]].map(([k, l]) => `<button role="tab" type="button" id="tab-${k}" aria-selected="${tab === k}" aria-controls="panel" data-tab="${k}">${l}</button>`).join("")}
      </div>
      <div id="panel" class="d-sec tabpanel" role="tabpanel"></div>`;
    const panel = $("#panel");
    const show = (t, pg, query) => {
      $$(".tabs button", dBody).forEach(b => b.setAttribute("aria-selected", b.dataset.tab === t));
      history.replaceState(null, "", `#reading/${id}${t !== "summary" ? "/" + t : ""}${pg ? "/" + pg : ""}${query ? "?q=" + encodeURIComponent(query) : ""}`);
      panel.classList.remove("tabpanel"); void panel.offsetWidth; panel.classList.add("tabpanel");
      if (t === "summary") {
        panel.innerHTML = `${SHOW_SUMMARIES ? `${srcLabel("Summary")}<div class="prose">${r.summary_html}</div>` : ""}
          <h3${SHOW_SUMMARIES ? "" : ' style="margin-top:4px"'}>Assigned</h3>${reqHTML}
          ${refl ? `<h3>Feeds into</h3><ul class="mini-list">${refl}</ul>` : `<h3>Feeds into</h3><p class="prose muted">No reflection paper: Week 1 has none.</p>`}
          ${pairs ? `<h3>Read alongside</h3><ul class="mini-list">${pairs}</ul>` : ""}
          ${ths ? `<h3>Threads <span class="tag">editorial</span></h3><ul class="mini-list">${ths}</ul>` : ""}
          <div class="fineprint">${r.pages} PDF pages${r.spread ? " (two book pages per PDF page)" : ""} · ${(r.bytes / 1e6).toFixed(r.bytes > 1e6 ? 1 : 2)} MB · ${r.ocr ? "OCR text (may contain errors)" : "embedded text layer"} · uploaded ${esc(r.uploaded)}${r.notes_html.length ? `<div class="fp-notes">${r.notes_html.join("")}</div>` : ""}</div>`;
        $$(".pagemap", panel).forEach(drawPageMap);
        $$("[data-page]", panel).forEach(b => b.addEventListener("click", () => show("pdf", Number(b.dataset.page))));
      } else if (t === "pdf") {
        if (!r.pdf_url) { panel.innerHTML = `<div class="pdf-gate"><p>PDFs are not included in the public build.</p></div>`; return; }
        const src = `${encodeURI(r.pdf_url)}#page=${pg || 1}&view=FitH`;
        const frame = () => `<div class="reader-bar"><span class="muted">${r.pages} pages${pg ? ` · opened at PDF p. ${pg}` : ""}</span><span style="flex:1"></span><a class="pill-btn" href="${encodeURI(r.pdf_url)}${pg ? "#page=" + pg : ""}" target="_blank" rel="noopener">Open in new tab to print ↗</a></div>
          <iframe class="pdf-frame" title="${esc(r.author)}, PDF" src="${src}" loading="lazy"></iframe>`;
        if (big && !show._ok?.[id]) {
          panel.innerHTML = `<div class="pdf-gate"><p>This scan is ${(r.bytes / 1e6).toFixed(1)} MB.</p><button class="pill-btn" type="button" id="load-pdf">Load the PDF</button> <a class="pill-btn" href="${encodeURI(r.pdf_url)}" target="_blank" rel="noopener">Open in new tab ↗</a></div>`;
          $("#load-pdf").addEventListener("click", () => { (show._ok = show._ok || {})[id] = true; panel.innerHTML = frame(); });
        } else panel.innerHTML = frame();
      } else if (t === "text") {
        if (!r.text_url) { panel.innerHTML = `<div class="pdf-gate"><p>Extracted text is not included in the public build.</p></div>`; return; }
        panel.innerHTML = `<p class="muted">Loading text…</p>`;
        loadText(r).then(doc => textReader(panel, r, doc, pg || firstReq(r), query || "")).catch(() => {
          panel.innerHTML = `<div class="pdf-gate"><p>The text could not be loaded. Open the site from a local server (<code>python3 -m http.server</code> in the <code>site</code> folder) rather than as a file.</p></div>`;
        });
      }
    };
    readingShow = show;
    $$(".tabs button", dBody).forEach(b => b.addEventListener("click", () => show(b.dataset.tab)));
    $(".tabs", dBody).addEventListener("keydown", e => {
      if (!["ArrowLeft", "ArrowRight"].includes(e.key)) return;
      const bs = $$(".tabs button", dBody), k = bs.indexOf(document.activeElement);
      const n = bs[(k + (e.key === "ArrowRight" ? 1 : bs.length - 1)) % bs.length]; n.focus(); show(n.dataset.tab);
    });
    show(tab, page, q);
  }
  const firstReq = r => { const rs = reqRanges(r); return rs.length && rs[0][0] > 1 ? rs[0][0] : 1; };
  function drawPageMap(div) {
    const ranges = JSON.parse(div.dataset.ranges), total = Number(div.dataset.total);
    const svg = svgEl("svg", { "aria-hidden": "true" }, div);
    const W = div.clientWidth || 400;
    svg.setAttribute("viewBox", `0 0 ${W} 26`);
    svgEl("rect", { x: .5, y: 8, width: W - 1, height: 8, rx: 2, style: "fill:none;stroke:var(--text);stroke-opacity:.35" }, svg);
    ranges.forEach(([a, b]) => svgEl("rect", { x: (a - 1) / total * W, y: 8, width: Math.max(2, (b - a + 1) / total * W), height: 8, rx: 1, style: "fill:var(--accent);opacity:.8" }, svg));
    svgEl("text", { x: 0, y: 26, class: "tick-lbl" }, svg, "p. 1");
    svgEl("text", { x: W, y: 26, class: "tick-lbl", "text-anchor": "end" }, svg, "p. " + total);
  }
  function textReader(panel, r, doc, page, query) {
    const reqSet = new Set(); reqRanges(r).forEach(([a, b]) => { for (let p = a; p <= b; p++) reqSet.add(p); });
    const all = reqSet.size === r.pages;
    let cur = Math.min(Math.max(1, page), doc.pages.length);
    let q = query;
    panel.innerHTML = `${doc.note ? `<div class="notice">${esc(doc.note)}. Expect recognition errors.</div>` : ""}
      ${r.spread ? `<div class="notice calm">Each PDF page holds two printed pages (a book spread).</div>` : ""}
      <div class="reader-bar"><button class="icon-btn" type="button" id="pg-prev" aria-label="Previous page"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M10 3.5L5.5 8l4.5 4.5"/></svg></button>
        <label class="muted">Page <input type="number" id="pg-in" min="1" max="${doc.pages.length}" value="${cur}"> of ${doc.pages.length}</label>
        <button class="icon-btn" type="button" id="pg-next" aria-label="Next page"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M6 3.5L10.5 8 6 12.5"/></svg></button>
        <input type="search" id="pg-q" placeholder="Search this reading" value="${esc(q)}" aria-label="Search this reading"></div>
      <div class="muted" style="font-size:.76rem" id="pg-info"></div>
      <div class="page-strip" id="pg-strip" aria-label="Pages">${doc.pages.map((t, k) => `<button type="button" data-p="${k + 1}" class="${!all && reqSet.has(k + 1) ? "req" : ""}${!t.trim() ? " empty" : ""}" aria-label="Page ${k + 1}${reqSet.has(k + 1) && !all ? ", assigned" : ""}">${k + 1}</button>`).join("")}</div>
      <div class="page-head"><span id="pg-lbl"></span><a href="#" id="pg-pdf">view this page in the PDF</a></div>
      <div class="page-text" id="pg-text" tabindex="0"></div>`;
    const re = () => q.trim() ? new RegExp(q.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+"), "gi") : null;
    const paint = () => {
      const rx = re();
      const t = doc.pages[cur - 1] || "";
      $("#pg-text").innerHTML = t.trim() ? (rx ? esc(t).replace(new RegExp(rx.source.replace(/&/g, "&amp;"), "gi"), m => `<mark>${m}</mark>`) : esc(t)) : `<span class="muted ital">This page has no text (blank in the PDF${r.ocr ? " or not recognized" : ""}).</span>`;
      $("#pg-in").value = cur;
      $("#pg-lbl").textContent = `PDF page ${cur}${!all && reqSet.has(cur) ? " · assigned" : !all ? " · not assigned" : ""}`;
      $$("#pg-strip button").forEach(b => b.classList.toggle("cur", Number(b.dataset.p) === cur));
      let hits = 0;
      $$("#pg-strip button").forEach((b, k) => { const n = rx ? (doc.pages[k].match(rx) || []).length : 0; hits += n; b.classList.toggle("hit", n > 0); });
      $("#pg-info").textContent = rx ? `${hits} match${hits === 1 ? "" : "es"} for “${q.trim()}” on ${$$("#pg-strip .hit").length} page(s); underlined in the strip.` : (!all ? `Green pages are assigned (${reqSet.size} of ${r.pages}).` : "");
      history.replaceState(null, "", `#reading/${r.id}/text/${cur}${q.trim() ? "?q=" + encodeURIComponent(q.trim()) : ""}`);
      const m = $("#pg-text mark"); if (m) m.scrollIntoView({ block: "center", behavior: "smooth" });
    };
    $("#pg-prev").addEventListener("click", () => { if (cur > 1) { cur--; paint(); } });
    $("#pg-next").addEventListener("click", () => { if (cur < doc.pages.length) { cur++; paint(); } });
    $("#pg-in").addEventListener("change", e => { cur = Math.min(Math.max(1, Number(e.target.value) || 1), doc.pages.length); paint(); });
    $("#pg-strip").addEventListener("click", e => { const b = e.target.closest("[data-p]"); if (b) { cur = Number(b.dataset.p); paint(); } });
    let qt; $("#pg-q").addEventListener("input", e => { clearTimeout(qt); qt = setTimeout(() => { q = e.target.value; paint(); }, 180); });
    $("#pg-pdf").addEventListener("click", e => { e.preventDefault(); location.hash = `#reading/${r.id}/pdf/${cur}`; });
    paint();
  }

  // ------------------------------------------------------------------ router
  function route() {
    const h = decodeURIComponent(location.hash);
    const m = h.match(/^#(reading|session|assignment)\/([\w-]+)(?:\/(summary|pdf|text))?(?:\/(\d+))?(?:\?q=(.*))?$/);
    if (!m) { closeDrawer(false); if (h && h.length > 1) { const t = document.getElementById(h.slice(1)); if (t) t.scrollIntoView(); } return; }
    const [, type, id, tab, pg, q] = m;
    const key = `${type}/${id}`;
    if (type === "reading" && !R[id] || type === "session" && !S[id] && id !== "final" || type === "assignment" && !A[id]) { toast("Not found: " + key); return; }
    if (current === key && type === "reading" && drawer.classList.contains("on") && readingShow) { readingShow(tab || "summary", pg ? Number(pg) : null, q || ""); return; }
    current = key;
    pv.classList.remove("on");
    if (type === "reading") readingDrawer(id, tab || "summary", pg ? Number(pg) : null, q || "");
    if (type === "session") sessionDrawer(id);
    if (type === "assignment") assignmentDrawer(id);
    $$(".emblem-slot", dBody).forEach(s => s.replaceWith(Art.emblem(s.dataset.emblem)));
    dBody.scrollTop = 0;
    openDrawer();
    applyHL([type === "reading" ? "r:" + id : type === "assignment" ? "a:" + id : id]);
  }
  window.addEventListener("hashchange", route);
  document.addEventListener("click", e => {
    const a = e.target.closest("[data-close-drawer]");
    if (a) { closeDrawer(false); setTimeout(() => $(a.getAttribute("href")).scrollIntoView({ behavior: "smooth", block: "center" }), 350); e.preventDefault(); history.pushState(null, "", a.getAttribute("href")); }
  });

  // ------------------------------------------------------------------ search
  const search = $("#search"), sInput = $("#search-input"), sRes = $("#search-res"), sStatus = $("#search-status");
  let fullText = null, sel = 0;
  function openSearch() {
    search.classList.add("on"); sInput.value = sInput.value || ""; sInput.focus(); sInput.select();
    document.body.style.overflow = "hidden";
    runSearch();
    if (!fullText && !D.public) {
      sStatus.textContent = "loading full text…";
      let n = 0;
      Promise.all(D.readings.map(r => loadText(r).then(d => { sStatus.textContent = `loading full text ${++n}/${D.readings.length}`; return [r.id, d]; }))).then(arr => {
        fullText = Object.fromEntries(arr); sStatus.textContent = "full text searchable"; runSearch();
      }).catch(() => { sStatus.textContent = "full text unavailable (open via a local server)"; });
    }
  }
  function closeSearch() { search.classList.remove("on"); if (!drawer.classList.contains("on")) document.body.style.overflow = ""; }
  $$("[data-close]", search).forEach(b => b.addEventListener("click", closeSearch));
  $("#search-btn").addEventListener("click", openSearch);
  const index = [
    ...SESS.map(s => ({ k: `${sessLabel(s)} · ${sessDate(s, { month: "short", day: "numeric" })}`, t: s.topic, href: "#session/" + s.id, body: [s.topic, s.readings.map(r => R[r].author + " " + strip(R[r].title_html)).join(" "), strip(s.prework_html)].join(" "), g: "Sessions" })),
    ...D.readings.map(r => ({ k: `${authorShort(r)} · ${r.pages} pp`, t: strip(r.title_html), href: "#reading/" + r.id, body: [r.author, strip(r.title_html), SHOW_SUMMARIES ? strip(r.summary_html) : ""].join(" "), g: "Readings" })),
    ...D.assignments.map(a => ({ k: `${a.points} pts`, t: a.name, href: "#assignment/" + a.id, body: [a.name, strip(a.guidance_html), strip(a.syllabus.html)].join(" "), g: "Assignments" })),
    ...D.policies.map(p => ({ k: "Policy", t: p.title, href: "#pol-" + p.key, body: p.title + " " + strip(p.html), g: "Policies" })),
  ];
  function snippet(text, rx, len = 70) {
    const m = rx.exec(text); rx.lastIndex = 0;
    if (!m) return "";
    const a = Math.max(0, m.index - len), b = Math.min(text.length, m.index + m[0].length + len);
    const s = text.slice(a, b).replace(/\s+/g, " ");
    return (a > 0 ? "…" : "") + esc(s).replace(new RegExp(rx.source, "gi"), x => `<mark>${x}</mark>`) + (b < text.length ? "…" : "");
  }
  function runSearch() {
    const q = sInput.value.trim();
    sel = 0;
    if (!q) {
      sRes.innerHTML = `<h4>Jump to</h4>` + SESS.filter(s => new Date(s.end_utc) > NOW).slice(0, 3).map(s => `<a href="#session/${s.id}" role="option"><span class="k">${sessLabel(s)} · ${esc(sessDate(s))}</span><br>${s.topic_html}</a>`).join("") + `<h4>Tip</h4><div style="padding:0 16px;font-size:.84rem" class="muted">Search covers session topics, reading summaries, the syllabus’s assignment instructions, policies and${D.public ? "" : " the full text of every reading"}.</div>`;
      return;
    }
    const terms = q.toLowerCase().split(/\s+/);
    const rx = new RegExp(terms.map(t => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|"), "gi");
    const groups = {};
    index.forEach(it => {
      const b = it.body.toLowerCase();
      if (!terms.every(t => b.includes(t))) return;
      const score = terms.reduce((s, t) => s + (it.t.toLowerCase().includes(t) ? 3 : 0) + (it.k.toLowerCase().includes(t) ? 2 : 0), 0);
      (groups[it.g] = groups[it.g] || []).push({ ...it, score, snip: snippet(it.body, rx) });
    });
    let html = "";
    ["Sessions", "Readings", "Assignments", "Policies"].forEach(g => {
      if (!groups[g]) return;
      html += `<h4>${g}</h4>` + groups[g].sort((a, b) => b.score - a.score).slice(0, 6).map(it => `<a href="${it.href}" role="option"><span class="k">${esc(it.k)}</span><br>${esc(it.t)}<span class="snip">${it.snip}</span></a>`).join("");
    });
    if (fullText && q.length >= 3) {
      const phrase = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+"), "gi");
      const hits = [];
      readingOrder.forEach(r => {
        const pages = fullText[r.id].pages;
        let count = 0, first = [];
        pages.forEach((t, k) => { const m = t.match(phrase); if (m) { count += m.length; if (first.length < 2) first.push(k + 1); } });
        if (count) hits.push({ r, count, first, pages });
      });
      if (hits.length) {
        html += `<h4>In the full text · ${hits.reduce((t, h) => t + h.count, 0)} matches</h4>` + hits.sort((a, b) => b.count - a.count).slice(0, 10).map(h => h.first.map((p, j) => `<a href="#reading/${h.r.id}/text/${p}?q=${encodeURIComponent(q)}" role="option"><span class="k">${esc(authorShort(h.r))} · p. ${p}${j === 0 ? ` · ${h.count} match${h.count === 1 ? "" : "es"}` : ""}</span><span class="snip">${snippet(h.pages[p - 1], new RegExp(phrase.source, "gi"))}</span></a>`).join("")).join("");
      }
    }
    sRes.innerHTML = html || `<div style="padding:18px 16px" class="muted">Nothing matches “${esc(q)}”.</div>`;
    markSel();
  }
  const markSel = () => { const as = $$("a", sRes); as.forEach((a, i) => a.classList.toggle("sel", i === sel)); if (as[sel]) as[sel].scrollIntoView({ block: "nearest" }); };
  let st; sInput.addEventListener("input", () => { clearTimeout(st); st = setTimeout(runSearch, 120); });
  sInput.addEventListener("keydown", e => {
    const as = $$("a", sRes);
    if (e.key === "ArrowDown") { e.preventDefault(); sel = Math.min(as.length - 1, sel + 1); markSel(); }
    if (e.key === "ArrowUp") { e.preventDefault(); sel = Math.max(0, sel - 1); markSel(); }
    if (e.key === "Enter" && as[sel]) { e.preventDefault(); as[sel].click(); }
  });
  sRes.addEventListener("click", e => {
    const a = e.target.closest("a"); if (!a) return;
    closeSearch();
    const href = a.getAttribute("href");
    if (href.startsWith("#pol-")) { e.preventDefault(); closeDrawer(false); const d = $(href); d.open = true; d.scrollIntoView({ behavior: "smooth", block: "center" }); }
  });

  // ------------------------------------------------------------------ keyboard
  document.addEventListener("keydown", e => {
    const typing = /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName) || document.activeElement.isContentEditable;
    if (e.key === "Escape") {
      if (search.classList.contains("on")) return closeSearch();
      if (drawer.classList.contains("on")) return closeDrawer();
      if (pinned) { pinned = null; $$(".hl-link.pinned").forEach(n => n.classList.remove("pinned")); restoreHL(); }
      return;
    }
    if (typing || e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key === "/") { e.preventDefault(); openSearch(); }
    if (e.key === "j" || e.key === "k") {
      const order = [...SESS.map(s => s.id), "final"];
      const m = location.hash.match(/^#session\/([\w-]+)/);
      let i;
      if (m) i = order.indexOf(m[1]) + (e.key === "j" ? 1 : -1);
      else { const up = SESS.findIndex(s => new Date(s.end_utc) > NOW); i = up < 0 ? order.length - 1 : up + (e.key === "k" ? -1 : 0); }
      i = Math.max(0, Math.min(order.length - 1, i));
      location.hash = "#session/" + order[i];
    }
  });

  // ------------------------------------------------------------------ theme + tz
  function setThemeIcon() {
    const dark = getComputedStyle(document.documentElement).getPropertyValue("--bg").trim().toLowerCase() === getComputedStyle(document.documentElement).getPropertyValue("--moss").trim().toLowerCase();
    $("#theme-btn").innerHTML = dark
      ? `<svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="3"/><path d="M8 1.5v1.6M8 12.9v1.6M1.5 8h1.6M12.9 8h1.6M3.4 3.4l1.1 1.1M11.5 11.5l1.1 1.1M3.4 12.6l1.1-1.1M11.5 4.5l1.1-1.1"/></svg>`
      : `<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M13.5 9.6A6 6 0 0 1 6.4 2.5a6 6 0 1 0 7.1 7.1z"/></svg>`;
    $("#theme-btn").setAttribute("aria-label", dark ? "Switch to light theme" : "Switch to dark theme");
    favicon();
  }
  function favicon() {
    const cs = getComputedStyle(document.documentElement);
    const g = n => cs.getPropertyValue(n).trim();
    const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'><rect width='32' height='32' rx='6' fill='${g("--moss")}'/><path d='M6 22c5-9 9 3 14-6 2-3 4-4 6-4' fill='none' stroke='${g("--cream")}' stroke-width='1.6'/><circle cx='22' cy='11' r='3' fill='${g("--blossom")}'/></svg>`;
    let l = $("link[rel=icon]"); if (!l) { l = document.createElement("link"); l.rel = "icon"; document.head.appendChild(l); }
    l.href = "data:image/svg+xml," + encodeURIComponent(svg);
  }
  $("#theme-btn").addEventListener("click", () => {
    const dark = getComputedStyle(document.documentElement).getPropertyValue("--bg").trim().toLowerCase() === getComputedStyle(document.documentElement).getPropertyValue("--moss").trim().toLowerCase();
    document.documentElement.dataset.theme = dark ? "light" : "dark";
    try { localStorage.setItem("ppe-theme", document.documentElement.dataset.theme); } catch (e) {}
    setThemeIcon();
  });
  function setTZ(tz) {
    TZ = tz; store.set("tz", tz);
    $$("#tz-seg button").forEach(b => b.setAttribute("aria-pressed", b.dataset.tz === tz));
    const y = scrollY;
    renderAll();
    scrollTo(0, y);
    if (current) { const k = current; current = null; route(); void k; }
    toast(tz === "Asia/Shanghai" ? "Times in Beijing time (course time)" : "Times in New York time (as Canvas shows them)");
  }
  $$("#tz-seg button").forEach(b => b.addEventListener("click", () => setTZ(b.dataset.tz)));

  // ------------------------------------------------------------------ boot
  function renderAll() {
    snCount = 0;
    renderTitle(); renderScope(); renderCalendar(); renderLibrary(); renderGrading(); renderRules(); renderColophon();
    paintArt();
    requestAnimationFrame(() => { drawPath(); reveal(); });
    applyHL(pinned);
  }
  let io, booted = false;
  function reveal() {
    if (io) io.disconnect();
    io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } }), { rootMargin: "0px 0px -6% 0px" });
    if (booted) { $$(".reveal").forEach(n => n.classList.add("in")); return; }
    $$(".reveal:not(.in)").forEach(n => io.observe(n));
  }
  // active section in the nav
  const navIO = new IntersectionObserver(es => es.forEach(e => {
    if (e.isIntersecting) $$("#toc a").forEach(a => a.classList.toggle("on", a.getAttribute("href") === "#" + e.target.id));
  }), { rootMargin: "-40% 0px -55% 0px" });
  $$("main .section").forEach(s => navIO.observe(s));

  $$("#tz-seg button").forEach(b => b.setAttribute("aria-pressed", b.dataset.tz === TZ));
  renderAll();
  requestAnimationFrame(() => { booted = true; });
  setThemeIcon();
  matchMedia("(prefers-color-scheme: light)").addEventListener("change", setThemeIcon);
  let rz;
  const relayout = () => { drawPath(); drawRibbon(); drawGradeFigure(); updateCalc(); fillLibrary(); };
  window.addEventListener("resize", () => { clearTimeout(rz); rz = setTimeout(relayout, 150); });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => drawPath());
  new ResizeObserver(() => { clearTimeout(rz); rz = setTimeout(drawPath, 100); }).observe($("#s-scope"));
  if (location.hash) setTimeout(route, 50);
})();
