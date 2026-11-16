/* =====================================================================
   Startseite: Generator-Sequenz und Kachel-Menü.
   Das Scrollen schiebt die Animation direkt vorwärts. An jeder Station
   (Intro, Übersicht, jede Etappe) gibt es eine lange Haltephase, in der
   sich nichts ändert, damit man nicht genau zielen muss.
   ===================================================================== */
import { SITE, $, $$, esc, clamp, lerp, seg, smooth, ease, pad, hex, reduced } from "./util.js";
import { T, TYPES } from "./parts.js";

const G = SITE.generator;
const STATUS = { done: "Done", active: "In progress", planned: "Planned" };
const COL = {
  done: hex("#B7D63E"), active: hex("#E57E3A"), planned: hex("#6C8CFF"),
  copper: hex("#E9A26B"), red: hex("#E5574B"), blue: hex("#5B7DF5"),
  l1: hex("#A8642F"), l2: hex("#2A2826"), l3: hex("#9AA2AC")
};

/* ---------- Inhalt einsetzen ---------- */
(function fill() {
  const line = (word, off, dot) => `<span class="ln">${[...word].map((c, i) => `<span class="ch" style="--i:${i + off}">${esc(c)}</span>`).join("")}${dot ? `<span class="ch dot" style="--i:${word.length + off}">.</span>` : ""}</span>`;
  $("#name").innerHTML = line(SITE.first, 0) + line(SITE.last, SITE.first.length, true);
  $("#role").textContent = SITE.role;
  $("#g-title").textContent = G.title;
  $("#g-sum").textContent = G.summary;
  $("#g-specs").innerHTML = G.specs.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join("");
  $("#g-repo").href = G.repo;
  $("#cards").innerHTML = G.stages.map((s, k) => `
    <article class="card" data-k="${k}">
      <div class="c-meta"><span class="c-no">${pad(k + 1)} / ${pad(G.stages.length)}</span><span class="chip ${s.status}">${STATUS[s.status] || ""}</span></div>
      <h3>${esc(s.title)}</h3>
      <p>${esc(s.text)}</p>
      ${s.image ? `<figure><img src="${esc(s.image)}" alt="${esc(s.title)}" loading="lazy"></figure>` : ""}
    </article>`).join("");
  const act = G.stages.find(s => s.status === "active");
  $("#t-photo").src = SITE.me.image;
  $("#t-proj-sub").textContent = SITE.projects.map(p => p.title).join(", ") + " and more";
  $("#t-now-sub").textContent = G.title + (act ? ": " + act.label.toLowerCase() : "");
  $("#t-gh").href = SITE.github;
})();

/* =====================================================================
   Zeitachse der Sequenz. u = gescrollte Bildschirmhöhen.
   TRANS = Scroll-Weg für den Wechsel, HOLD = Scroll-Weg, in dem die Station stehen bleibt.
   Grössere HOLD-Werte = längere Pause an den Stationen (die Seite wird entsprechend länger).
   ===================================================================== */
const NS = G.stages.length;
const HOLD = { intro: .5, ov: 1.2, stage: 1.0 };
const TRANS = { wipe: 1.1, stage: .5 };
const U = { wipe0: HOLD.intro, sp: TRANS.stage + HOLD.stage };
U.ov0 = U.wipe0 + TRANS.wipe;          // Übersicht erreicht
U.ov1 = U.ov0 + HOLD.ov;               // Übersicht endet
U.st0 = U.ov1;                         // erste Etappe beginnt
U.stEnd = U.st0 + NS * U.sp;
U.menu0 = U.stEnd + .1;                // Modell dreht sich frontal
U.zoom0 = U.menu0 + .35;               // Kacheln fahren ein
U.zoom1 = U.zoom0 + 1.3;
U.end = U.zoom1 + .35;

/* Was das Modell je Etappe zeigt: a = Pose der Etappe, b = Bewegung innerhalb der Etappe (z.B. Gestell fährt hoch),
   hi = gefüllte Bauteile, lab = Beschriftungen. */
const ALL = [T.shaft, T.hub, T.iron, T.magN, T.magS, T.epoxy, T.coil, T.l1, T.l2, T.l3];
const FOCUS = {
  all:      { a: { yaw: 54, pitch: 12, roll: 6, e: 0, s: 1.16, oy: -.05, w: 1.3 }, hi: ALL, amt: .94, lab: [] },
  stator:   { a: { yaw: 44, pitch: 14, roll: 8, e: .5, s: 1.12, ox: .17, oy: -.03, open: 1, w: .1 }, hi: [T.epoxy, T.coil], amt: .95, lab: ["coil", "epoxy", "leads"] },
  iron:     { a: { yaw: 25, pitch: 18, roll: 12, e: .8, s: .86, ox: .13, w: .1 }, hi: [T.iron], amt: .95, lab: ["iron", "mag"] },
  frame:    { a: { yaw: 46, pitch: 16, roll: 0, e: 0, s: .8, ox: .15, oy: -.13, f: 0, w: .2 }, b: { yaw: 38, f: 1 }, hi: [T.frame], amt: .95, lab: ["frame"] },
  assembly: { a: { yaw: 34, pitch: 16, roll: 0, e: .3, s: .8, ox: .15, oy: -.13, f: 1, w: .2 }, b: { yaw: 44, e: 0 }, hi: [...ALL, T.frame], amt: .34, lab: [] },
  test:     { a: { yaw: 40, pitch: 14, roll: 0, e: .2, s: .8, ox: .15, oy: -.13, f: 1, w: 2.6 }, hi: [], amt: 1, lab: ["leads", "coil", "mag"] }
};
const focusOf = k => FOCUS[G.stages[k].focus] || FOCUS.all;

const BASE = { yaw: 40, pitch: 12, roll: 0, e: 0, s: 1, ox: .16, oy: 0, f: 0, w: .3, open: 0 };
const keys = [];
const K = (u, o) => keys.push({ ...BASE, ...o, u });
const INTRO = { yaw: 42, pitch: 12, roll: 8, e: .2, s: 1.3, ox: .24, w: .7 };
const OVER = { yaw: 28, pitch: 16, roll: 13, e: 1, s: .82, ox: .13, oy: -.02, w: .12 };
K(0, INTRO);
K(U.wipe0, INTRO);
K(U.ov0, OVER);
K(U.ov1, OVER);
G.stages.forEach((st, k) => {
  const F = focusOf(k), t = U.st0 + k * U.sp;
  K(t + TRANS.stage, F.a);
  if (F.b) K(t + TRANS.stage + .35, { ...F.a, ...F.b });
  K(t + U.sp, { ...F.a, ...(F.b || {}) });
});
const MENU = { yaw: 90, pitch: 0, roll: 0, e: 0, s: 1.15, ox: 0, oy: 0, f: 0, open: 1, w: .45 };
K(U.menu0 + .35, MENU);
K(U.end + 1, MENU);
const PROPS = Object.keys(BASE);
function pose(u, out) {
  let i = 0;
  while (i < keys.length - 2 && keys[i + 1].u <= u) i++;
  const a = keys[i], b = keys[i + 1], t = smooth(seg(u, a.u, b.u));
  for (const p of PROPS) out[p] = lerp(a[p], b[p], t);
  return out;
}

/* Beschriftungen: side "rt" = oben rechts, "lb" = unten links. Reihenfolge = Zeilen von oben nach unten. */
const LABELS = [
  { key: "mag",   side: "rt", text: `${G.magnets} magnets`,  types: [T.magN, T.magS], at: ["magsB", .96, 0, -.04] },
  { key: "iron",  side: "rt", text: "back iron",             types: [T.iron],         at: ["ironB", 1, 0, 0] },
  { key: "frame", side: "rt", text: "frame (planned)",       types: [T.frame],        at: ["frame", .2, 0, 1.3] },
  { key: "leads", side: "lb", text: "phase leads L1 L2 L3",  types: [T.l1, T.l2, T.l3], at: ["epoxy", -1.62, 0, .6] },
  { key: "epoxy", side: "lb", text: "epoxy stator",          types: [T.epoxy],        at: ["epoxy", -1.02, .25, -.05] },
  { key: "coil",  side: "lb", text: `${G.coils} coils`,      types: [T.coil],         at: ["coils", -.7, .26, -.08] },
  { key: "hub",   side: "lb", text: "hub",                   types: [T.hub],          at: ["hubA", -.3, 0, -.03] },
  { key: "shaft", side: "lb", text: "shaft",                 types: [T.shaft],        at: ["shaft", 0, 0, -1.48] }
];
const OV_LABELS = ["mag", "iron", "hub", "leads", "epoxy", "coil", "shaft"];

const pin = $("#pin"), track = $("#home"), nav = $("#nav");
const elIntro = $("#intro"), elHint = $("#hint"), elOv = $("#ov");
const elMenu = $("#menu"), elHole = $(".t-hole"), elScope = $("#scope"), svg = $("#leaders"), labBox = $("#labels");
const cards = $$(".card");
track.style.height = (U.end + 1) * 100 + "vh";

let hover = null;
const SVGNS = "http://www.w3.org/2000/svg";
LABELS.forEach(L => {
  L.el = document.createElement("div"); L.el.className = "lab"; L.el.textContent = L.text; labBox.appendChild(L.el);
  L.path = document.createElementNS(SVGNS, "path"); L.dot = document.createElementNS(SVGNS, "circle"); L.dot.setAttribute("r", 3);
  svg.append(L.path, L.dot);
  L.el.addEventListener("pointerenter", () => { hover = L; });
  L.el.addEventListener("pointerleave", () => { if (hover === L) hover = null; });
});

let vh = innerHeight, vw = innerWidth, trackTop = 0, menuO = { x: 0, y: 0, w: 1, h: 1 }, sized = false;
const goU = (u, instant) => window.scrollTo({ top: trackTop + u * vh, behavior: reduced || instant ? "instant" : "smooth" });
const stageAt = u => Math.floor((u - U.st0) / U.sp);
$$("[data-go]").forEach(a => a.addEventListener("click", e => {
  e.preventDefault();
  const go = a.dataset.go;
  if (go === "active") goU(U.st0 + Math.max(0, G.stages.findIndex(s => s.status === "active")) * U.sp + TRANS.stage + HOLD.stage * .5);
  else if (go === "menu") goU(U.end);
  else goU(U.ov0 + HOLD.ov * .5);
}));

/* 3D-Modell laden. Scheitert das (kein WebGL, CDN nicht erreichbar), zeigt die Seite alles als normales Layout. */
let gen = null;
try {
  if (new URLSearchParams(location.search).has("nogl")) throw new Error("3D switched off by ?nogl");
  const mod = await import("./generator3d.js");
  gen = mod.createGenerator($("#gl"), { magnets: G.magnets, coils: G.coils });
} catch (err) {
  console.warn("3D generator unavailable:", err);
  document.documentElement.classList.add("no-gl");
  track.style.height = "";
}

function measure() {
  vh = innerHeight; vw = innerWidth;
  trackTop = track.getBoundingClientRect().top + scrollY;
  if (!gen) return;
  gen.setSize(vw, vh);
  const tf = elMenu.style.transform; elMenu.style.transform = "none";
  menuO = { x: elHole.offsetLeft + elHole.offsetWidth / 2, y: elHole.offsetTop + elHole.offsetHeight / 2, w: elHole.offsetWidth, h: elHole.offsetHeight };
  elMenu.style.transformOrigin = `${menuO.x}px ${menuO.y}px`;
  elMenu.style.transform = tf;
  LABELS.forEach(L => { L.w = L.el.offsetWidth - 16; });
  const pr = Math.min(devicePixelRatio || 1, 2);
  elScope.width = elScope.clientWidth * pr; elScope.height = elScope.clientHeight * pr;
  sized = true;
}
addEventListener("resize", measure);
measure();

/* index.html#tiles springt direkt zum fertigen Menü (z.B. vom «Menu»-Knopf der Unterseiten). */
if (gen && location.hash === "#tiles") {
  const toMenu = () => goU(U.end, true);
  history.scrollRestoration = "manual";
  toMenu();
  addEventListener("load", toMenu);
  addEventListener("pageshow", toMenu);
}

/* Zeigerposition für leichte Parallaxe */
let mx = 0, my = 0, pmx = 0, pmy = 0;
addEventListener("pointermove", e => { mx = e.clientX / vw - .5; my = e.clientY / vh - .5; }, { passive: true });

const P = { ...BASE }, pal = new Float32Array(TYPES * 4), palT = new Float32Array(TYPES * 4);
let us = 0, spin = 0, last = performance.now(), lastCard = -2, started = false;
const setT = (type, c, a) => { palT[type * 4] = c[0]; palT[type * 4 + 1] = c[1]; palT[type * 4 + 2] = c[2]; palT[type * 4 + 3] = a; };

function drawScope(phase) {
  const c = elScope, x = c.getContext("2d"), w = c.width, h = c.height, pr = w / c.clientWidth;
  x.clearRect(0, 0, w, h);
  x.lineWidth = pr; x.strokeStyle = "rgba(27,26,24,.14)";
  x.beginPath();
  for (let i = 0; i <= 8; i++) { const px = Math.round(i * (w - pr) / 8) + pr / 2; x.moveTo(px, 0); x.lineTo(px, h); }
  for (let i = 0; i <= 4; i++) { const py = Math.round(i * (h - pr) / 4) + pr / 2; x.moveTo(0, py); x.lineTo(w, py); }
  x.stroke();
  ["#E57E3A", "#1B1A18", "#8C949E"].forEach((col, i) => {
    x.strokeStyle = col; x.lineWidth = 2 * pr; x.beginPath();
    for (let px = 0; px <= w; px += 3) {
      const y = h / 2 - Math.sin(px / w * Math.PI * 5 - phase - i * Math.PI * 2 / 3) * h * .36;
      px ? x.lineTo(px, y) : x.moveTo(px, y);
    }
    x.stroke();
  });
}

function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(.05, (now - last) / 1000); last = now;
  const y = scrollY, u = clamp((y - trackTop) / vh, 0, U.end);
  const inView = y < trackTop + (U.end + 1) * vh;
  /* Das Scrollen schiebt die Animation direkt; nur leicht geglättet. */
  us = reduced || !started || !inView ? u : us + (u - us) * Math.min(1, dt * 8);
  if (Math.abs(u - us) < .0004) us = u;
  started = true;
  if (!inView) { nav.classList.remove("off"); return; }

  pose(us, P);
  /* Die Karte einer Etappe erscheint gegen Ende ihres Wechsels und bleibt bis kurz in den nächsten hinein. */
  let card = -1;
  for (let i = 0; i < NS; i++) {
    const t = U.st0 + i * U.sp, end = i === NS - 1 ? U.stEnd + .05 : t + U.sp + TRANS.stage * .25;
    if (us >= t + TRANS.stage * .6 && us < end) card = i;
  }
  const ovA = seg(us, U.ov0 - .3, U.ov0 - .05) * (1 - seg(us, U.ov1 + .05, U.ov1 + .22));
  const mBlend = smooth(seg(us, U.menu0, U.menu0 + .35)), z = ease(seg(us, U.zoom0, U.zoom1));
  const wipe = seg(us, U.wipe0 + .05, U.wipe0 + .8);

  /* Texte */
  const io = 1 - seg(us, .2, U.wipe0 + .1);
  elIntro.style.opacity = io; elIntro.style.transform = `translateY(${-us * 70}px)`; elIntro.style.visibility = io > 0 ? "visible" : "hidden";
  elHint.style.opacity = .7 * (1 - seg(us, .05, .3));
  elOv.style.opacity = ovA; elOv.style.visibility = ovA > .01 ? "visible" : "hidden"; elOv.style.transform = `translateY(${(1 - ovA) * 24}px)`;
  pin.classList.toggle("lit", wipe > .45);
  if (card !== lastCard) { cards.forEach((c, i) => c.classList.toggle("on", i === card)); lastCard = card; }
  const test = card >= 0 && G.stages[card].focus === "test";
  elScope.classList.toggle("on", test);
  if (test) drawScope(spin * 2);

  /* Menü */
  const menuOn = us > U.menu0 + .25;
  elMenu.classList.toggle("on", menuOn);
  elMenu.classList.toggle("ready", z > .97);
  nav.classList.toggle("off", us > U.menu0);
  let cx = vw * (.5 + P.ox), cy = vh * (.5 + P.oy), s = P.s;
  if (!gen || !sized) return;
  if (menuOn || mBlend > 0) {
    const g0 = Math.max(vw / menuO.w, vh / menuO.h) * 1.12, gs = lerp(g0, 1, z);
    const tx = (vw / 2 - menuO.x) * (1 - z), ty = (vh / 2 - menuO.y) * (1 - z);
    elMenu.style.transform = `translate(${tx}px,${ty}px) scale(${gs})`;
    elMenu.style.setProperty("--ho", seg(z, .4, .8));
    const hx = menuO.x + tx, hy = menuO.y + ty, hh = menuO.h * gs;
    const fit = .76 * hh / (2.9 * gen.view.ppu);
    s = Math.min(P.s, fit);
    cx = lerp(cx, hx + menuO.w * gs * .2 * z, mBlend); cy = lerp(cy, hy - .18 * s * gen.view.ppu + hh * .02, mBlend);
  }

  /* Bauteil-Farben */
  palT.fill(0);
  let show = [];
  if (card >= 0 && us < U.stEnd + .02) {
    const F = focusOf(card), st = G.stages[card], c = COL[st.status] || COL.planned;
    F.hi.forEach(t => setT(t, t === T.coil && F.hi.length < 4 ? COL.copper : c, F.amt));
    if (st.focus === "test") {
      setT(T.l1, COL.l1, 1); setT(T.l2, COL.l2, 1); setT(T.l3, COL.l3, 1);
      setT(T.coil, COL.copper, .95); setT(T.magN, COL.red, .9); setT(T.magS, COL.blue, .9);
    }
    show = F.lab;
  } else if (ovA > .5) show = OV_LABELS;
  if (hover && show.includes(hover.key)) {
    if (hover.key === "mag") { setT(T.magN, COL.red, .92); setT(T.magS, COL.blue, .92); }
    else hover.types.forEach(t => setT(t, t === T.coil ? COL.copper : COL.active, .95));
  }
  const kf = Math.min(1, dt * 9);
  for (let i = 0; i < TYPES; i++) {
    const o = i * 4, a0 = pal[o + 3], a1 = palT[o + 3];
    if (a1 > .02) { const kk = a0 < .02 ? 1 : kf; for (let c = 0; c < 3; c++) pal[o + c] = lerp(pal[o + c], palT[o + c], kk); }
    pal[o + 3] = lerp(a0, a1, kf);
  }

  if (!reduced) spin += P.w * dt;
  pmx += (mx - pmx) * Math.min(1, dt * 4); pmy += (my - pmy) * Math.min(1, dt * 4);
  const par = 1 - mBlend, sway = reduced ? 0 : par;
  gen.render({
    yaw: P.yaw + pmx * 9 * par + Math.sin(now * .00045) * 2.5 * sway, pitch: P.pitch + pmy * 6 * par + Math.cos(now * .00033) * 1.2 * sway, roll: P.roll, e: P.e,
    f: P.f * (1 - seg(us, U.stEnd - .03, U.menu0 + .1)), open: P.open,
    spin, s, cx, cy, wipe, pal
  });

  /* Beschriftungen und Führungslinien */
  const rows = { rt: 0, lb: 0 }, nLb = LABELS.filter(L => L.side === "lb").length;
  const padX = vw * .04;
  LABELS.forEach(L => {
    const row = rows[L.side]++, on = show.includes(L.key), hi = hover === L && on;
    L.el.classList.toggle("on", on); L.el.classList.toggle("hi", hi);
    L.path.classList.toggle("on", on); L.dot.classList.toggle("on", on); L.path.classList.toggle("hi", hi);
    if (!on) return;
    const [ax, ay] = gen.anchor(...L.at);
    let ly, d;
    if (L.side === "rt") {
      ly = Math.max(104, vh * .13) + row * 28;
      const x0 = vw - padX - L.w - 12, ex = Math.min(x0 - 14, ax + (ay - ly));
      d = `M${x0} ${ly}H${ex}L${ax} ${ay}`;
      L.el.style.left = vw - padX - L.w + "px";
    } else {
      ly = vh * .93 - (nLb - 1 - row) * 28;
      const x0 = padX + L.w + 12, ex = Math.max(x0 + 14, ax - (ly - ay));
      d = `M${x0} ${ly}H${ex}L${ax} ${ay}`;
      L.el.style.left = padX + "px";
    }
    L.el.style.top = ly - 8 + "px";
    L.path.setAttribute("d", d);
    L.dot.setAttribute("cx", ax); L.dot.setAttribute("cy", ay);
  });
}
if (gen) requestAnimationFrame(frame);
