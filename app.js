(() => {
  "use strict";

  // ---------- data ----------
  const VERBS = Object.fromEntries((window.VERBS || []).map(v => [v.word.toLowerCase(), v]));
  const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
  const stop = s => (/[.!?]$/.test(s) ? s : s + ".");
  const split = (text, strong) =>
    text ? text.split(/\s+/).filter(Boolean).map(t => ({ t, s: strong })) : [];
  const bold = t => split(t, true);
  const light = t => split(t, false);
  const field = (label, ...texts) => {
    const body = texts.filter(Boolean);
    return body.length ? [...bold(label), ...body.flatMap(t => light(stop(t)))] : [];
  };

  // Each verb reads as a short run of text, like the screenshot: dark labels, light phrases.
  // Facet 0 is the word, definition and origin/history. Facet 1 is the computing sense.
  function facets(v) {
    const word = bold(stop(cap(v.word)));
    return [
      [...word, ...light(stop(v.definition)),
        ...field("Origin.", v.dateOrigin, v.origin),
        ...field("History.", v.history)],
      [...word, ...field("In computing,", v.dateComputing, v.computing),
        ...field("Signifier.", v.signifier)],
    ];
  }

  // ---------- measuring and fitting ----------
  const FAMILY = '"Inter Tight", "Helvetica Neue", Helvetica, Arial, sans-serif';
  const WEIGHT = { light: 300, strong: 560, max: 640 };
  const LH = 1.08;
  const mctx = document.createElement("canvas").getContext("2d");
  const widths = new Map();

  // Width of text at 100px, cached.
  function measure(text, weight) {
    const key = weight + "|" + text;
    let w = widths.get(key);
    if (w === undefined) {
      mctx.font = `${weight} 100px ${FAMILY}`;
      w = mctx.measureText(text).width;
      widths.set(key, w);
    }
    return w;
  }
  const weightOf = (tk, forced) => forced || (tk.s ? WEIGHT.strong : WEIGHT.light);

  // Greedy line breaking. Returns null if a single word is wider than the line.
  function breakLines(tokens, fs, width, forced) {
    const k = fs / 100;
    const space = measure(" ", WEIGHT.light) * k * 1.1;
    const lines = [];
    let cur = [], w = 0;
    for (const tk of tokens) {
      const tw = measure(tk.t, weightOf(tk, forced)) * k;
      if (tw > width) return null;
      if (cur.length && w + space + tw > width) {
        lines.push(cur); cur = [tk]; w = tw;
      } else {
        w += (cur.length ? space : 0) + tw; cur.push(tk);
      }
    }
    if (cur.length) lines.push(cur);
    return lines;
  }

  // Largest font size whose lines fit the frame height.
  function fit(tokens, width, height, forced) {
    let lo = 4, hi = height, best = null;
    for (let i = 0; i < 26; i++) {
      const fs = (lo + hi) / 2;
      const lines = breakLines(tokens, fs, width, forced);
      if (lines && lines.length * fs * LH <= height) { best = { fs, lines }; lo = fs; }
      else hi = fs;
    }
    return best || { fs: lo, lines: breakLines(tokens, lo, width, forced) || [tokens] };
  }

  // ---------- rendering ----------
  const frame = document.getElementById("frame");
  const live = document.getElementById("live");
  let W = 0, H = 0, PAD = 12, INNER = 0;

  function dims() {
    W = window.innerWidth; H = window.innerHeight;
    PAD = Math.max(12, Math.round(W * 0.012));
    INNER = W - PAD * 2;
    frame.style.setProperty("--pad", PAD + "px");
  }

  function buildBlock(lines, fs, rowH, words) {
    const block = document.createElement("div");
    block.style.fontSize = fs + "px";
    let i = 0;
    for (const ln of lines) {
      const row = document.createElement("div");
      row.className = "line";
      row.style.height = rowH + "px";
      for (const tk of ln) {
        const el = document.createElement("span");
        el.className = tk.s ? "w s" : "w";
        el.textContent = tk.t;
        el.style.setProperty("--i", i++);
        row.appendChild(el);
        if (words) words.push(el);
      }
      block.appendChild(row);
    }
    return block;
  }

  function show(nodes, animate) {
    frame.classList.remove("enter");
    frame.replaceChildren(...nodes);
    if (animate) { void frame.offsetWidth; frame.classList.add("enter"); }
  }

  function announce(v, tokens) {
    live.textContent = tokens ? tokens.map(t => t.t).join(" ") : cap(v.word);
  }

  // ---------- modes ----------
  let mode = "hover";
  let clickFacet = -1;
  let hoverWords = [], hoverCenters = [];
  let scrollTrack = null, scrollPos = 0, scrollTarget = 0, scrollDir = 1;
  let dragBase = [], dragFs = 0, dragShift = 0, dragOffset = 0;

  // HOVER: the word repeated to fill the frame. Words near the pointer darken and thicken.
  function renderHover(animate) {
    const v = VERBS.hover;
    const word = stop(cap(v.word));
    const rows = Math.max(7, Math.min(18, Math.round((H / Math.min(W, H)) * 9)));
    let fs = H / (rows * LH);
    const space = measure(" ", WEIGHT.light) * 1.1;
    const ww = measure(word, WEIGHT.max);
    if ((ww * fs) / 100 > INNER) fs = (INNER / ww) * 100;
    const perLine = Math.max(1, Math.floor((INNER * 100 / fs + space) / (ww + space)));
    const lines = Array.from({ length: rows }, () =>
      Array.from({ length: perLine }, () => ({ t: word, s: false })));
    hoverWords = [];
    show([buildBlock(lines, fs, H / rows, hoverWords)], animate);
    hoverCenters = hoverWords.map(el => {
      const r = el.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2, t: 0 };
    });
    announce(v);
  }

  // CLICK: the word, definition and history. Each click swaps in the next set of words.
  function renderClick(advance) {
    const v = VERBS.click;
    const all = facets(v);
    if (advance) clickFacet = (clickFacet + 1) % all.length;
    const tokens = all[Math.max(0, clickFacet)];
    const { fs, lines } = fit(tokens, INNER, H);
    show([buildBlock(lines, fs, H / lines.length)], advance);
    announce(v, tokens);
  }

  // SCROLL: the whole entry as one block that loops forever.
  function renderScroll(animate) {
    const v = VERBS.scroll;
    const tokens = facets(v).flat();
    const { fs, lines } = fit(tokens, INNER, H);
    const rowH = H / lines.length;
    scrollTrack = document.createElement("div");
    scrollTrack.className = "track";
    scrollTrack.append(buildBlock(lines, fs, rowH), buildBlock(lines, fs, rowH));
    show([scrollTrack], animate);
    placeScroll();
    announce(v, tokens);
  }
  function placeScroll() {
    if (!scrollTrack) return;
    const o = ((scrollPos % H) + H) % H;
    scrollTrack.style.transform = `translate3d(0, ${-o}px, 0)`;
  }

  // DRAG: words are pulled along the lines, wrapping from the end back to the start.
  function renderDrag(animate) {
    const v = VERBS.drag;
    dragBase = facets(v).flat();
    dragFs = fit(dragBase, INNER, H).fs;
    dragShift = NaN;
    layoutDrag(animate);
    announce(v, dragBase);
  }
  function layoutDrag(animate) {
    const n = dragBase.length;
    const shift = (((Math.round(dragOffset / (dragFs * 1.4))) % n) + n) % n;
    if (shift === dragShift) return;
    dragShift = shift;
    const tokens = dragBase.slice(n - shift).concat(dragBase.slice(0, n - shift));
    let lines = breakLines(tokens, dragFs, INNER);
    let fs = dragFs;
    if (!lines || lines.length * fs * LH > H) { ({ fs, lines } = fit(tokens, INNER, H)); }
    show([buildBlock(lines, fs, H / lines.length)], animate);
  }

  function setMode(next, opts = {}) {
    const changed = next !== mode;
    mode = next;
    if (changed && next === "click") clickFacet = -1;
    if (next !== "scroll") scrollTrack = null;
    if (next === "hover") renderHover(changed);
    else if (next === "click") renderClick(true);
    else if (next === "scroll" && changed) renderScroll(true);
    else if (next === "drag" && changed) renderDrag(true);
    if (opts.anchor) anchor = opts.anchor;
    lastAction = performance.now();
  }

  function rerender() {
    dims();
    if (mode === "hover") renderHover(false);
    else if (mode === "click") renderClick(false);
    else if (mode === "scroll") renderScroll(false);
    else if (mode === "drag") renderDrag(false);
  }

  // ---------- input ----------
  const pointer = { x: 0, y: 0, sx: 0, sy: 0, inside: false, strength: 0 };
  let anchor = { x: 0, y: 0 };
  let lastAction = 0;
  let down = null;
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const awayDistance = () => Math.min(W, H) * 0.25;

  addEventListener("pointermove", e => {
    if (e.pointerType === "mouse" || e.pointerType === "pen") {
      pointer.x = e.clientX; pointer.y = e.clientY;
      if (!pointer.inside) { pointer.sx = e.clientX; pointer.sy = e.clientY; }
      pointer.inside = true;
    }
    if (down && e.pointerId === down.id) {
      const dx = e.clientX - down.x, dy = e.clientY - down.y;
      if (!down.moved && Math.hypot(dx, dy) > 6) {
        down.moved = true;
        const vertical = Math.abs(dy) > Math.abs(dx);
        down.kind = down.type === "touch" && vertical ? "scroll" : "drag";
        if (down.kind === "drag") { down.base = dragOffset; setMode("drag"); }
      }
      if (down.moved && down.kind === "drag") {
        dragOffset = down.base + dx + dy;
        layoutDrag(false);
        lastAction = performance.now();
      } else if (down.moved && down.kind === "scroll") {
        scrollBy(down.lastY - e.clientY);
      }
      down.lastY = e.clientY;
      return;
    }
    if (e.pointerType !== "touch" && mode !== "hover" &&
        performance.now() - lastAction > 600 &&
        Math.hypot(e.clientX - anchor.x, e.clientY - anchor.y) > awayDistance()) {
      setMode("hover");
    }
  });

  document.documentElement.addEventListener("pointerleave", () => { pointer.inside = false; });

  addEventListener("pointerdown", e => {
    if (e.button !== 0) return;
    down = { id: e.pointerId, type: e.pointerType, x: e.clientX, y: e.clientY, lastY: e.clientY, moved: false };
  });

  const endPress = e => {
    if (!down || e.pointerId !== down.id) return;
    if (!down.moved && e.type === "pointerup") setMode("click", { anchor: { x: e.clientX, y: e.clientY } });
    else anchor = { x: e.clientX, y: e.clientY };
    lastAction = performance.now();
    down = null;
  };
  addEventListener("pointerup", endPress);
  addEventListener("pointercancel", endPress);

  function scrollBy(dy) {
    if (mode !== "scroll") setMode("scroll");
    scrollTarget += dy;
    if (dy) scrollDir = Math.sign(dy);
    anchor = { x: pointer.x, y: pointer.y };
    lastAction = performance.now();
  }

  addEventListener("wheel", e => {
    e.preventDefault();
    const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? H : 1;
    scrollBy((e.deltaY || e.deltaX) * unit);
  }, { passive: false });

  addEventListener("keydown", e => {
    const k = e.key;
    if (k === " " || k === "Enter") { e.preventDefault(); setMode("click", { anchor: { x: pointer.x, y: pointer.y } }); }
    else if (k === "ArrowDown" || k === "PageDown") { e.preventDefault(); scrollBy(k === "PageDown" ? H * 0.8 : 60); }
    else if (k === "ArrowUp" || k === "PageUp") { e.preventDefault(); scrollBy(k === "PageUp" ? -H * 0.8 : -60); }
    else if (k === "ArrowLeft" || k === "ArrowRight") {
      e.preventDefault();
      if (mode !== "drag") setMode("drag");
      dragOffset += (k === "ArrowRight" ? 1 : -1) * dragFs * 1.4;
      layoutDrag(false);
      lastAction = performance.now();
    } else if (k === "Escape") setMode("hover");
  });

  let resizeTimer = 0;
  addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(rerender, 80);
  });

  // ---------- animation loop ----------
  function tick() {
    if (mode === "hover" && hoverWords.length) {
      pointer.sx += (pointer.x - pointer.sx) * 0.22;
      pointer.sy += (pointer.y - pointer.sy) * 0.22;
      pointer.strength += ((pointer.inside ? 1 : 0) - pointer.strength) * 0.08;
      const R = Math.min(W, H) * 0.2;
      for (let i = 0; i < hoverWords.length; i++) {
        const c = hoverCenters[i];
        const d = Math.hypot(c.x - pointer.sx, (c.y - pointer.sy) * 1.3) / R;
        const t = pointer.strength * Math.exp(-d * d);
        if (Math.abs(t - c.t) > 0.004) {
          c.t = t;
          hoverWords[i].style.setProperty("--t", t.toFixed(3));
        }
      }
    }
    if (mode === "scroll") {
      if (!reduce) scrollTarget += scrollDir * H * 0.0009;
      scrollPos += (scrollTarget - scrollPos) * (reduce ? 1 : 0.12);
      placeScroll();
    }
    requestAnimationFrame(tick);
  }

  // ---------- start ----------
  dims();
  renderHover(false);
  requestAnimationFrame(tick);

  // Re-measure once the web font is in, so line breaks use the real glyph widths.
  if (document.fonts) {
    Promise.all([300, 560, 640].map(w => document.fonts.load(`${w} 100px "Inter Tight"`)))
      .catch(() => {})
      .then(() => { widths.clear(); rerender(); });
  }
})();
