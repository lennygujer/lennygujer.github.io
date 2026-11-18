/* =====================================================================
   Gemeinsame Logik aller Seiten: Inhalt einsetzen, Seitenwechsel,
   Einblenden, Magnet-Knöpfe, Projekt-Vorschau, Uhr, Wellen.
   Der Inhalt selbst steht in assets/content.js (window.SITE).
   ===================================================================== */
import { SITE, $, $$, esc, clamp, pad, reduced } from "./util.js";

const set = (sel, fn) => { const el = $(sel); if (el) fn(el); };

/* ---------- Inhalt einsetzen (nur was auf der jeweiligen Seite vorkommt) ---------- */
set("#me-img", el => { el.src = SITE.me.image; });
set("#me-big", el => { el.textContent = SITE.me.text[0] || ""; });
set("#me-more", el => { el.innerHTML = SITE.me.text.slice(1).map(t => `<p>${esc(t)}</p>`).join(""); });
set("#me-facts", el => { el.innerHTML = (SITE.me.facts || []).map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join(""); });

set("#rows", el => {
  el.innerHTML = SITE.projects.map((p, i) => `
    <a class="row" href="${esc(p.repo)}" target="_blank" rel="noopener" data-rv data-img="${esc(p.image || "")}" data-letter="${esc(p.title[0])}">
      <span class="r-no mono">${pad(i + 1)}</span>
      <span class="r-title">${esc(p.title)}</span>
      <span class="r-text">${esc(p.text)}<em>${p.tags.map(esc).join(", ")}</em></span>
      <span class="r-when mono">${esc(p.when)}</span>
      <span class="r-go"><svg class="arr" viewBox="0 0 16 16" aria-hidden="true"><path d="M4 12 12 4M5.5 4H12v6.5"/></svg></span>
    </a>`).join("") + `
    <a class="row" href="${esc(SITE.github)}" target="_blank" rel="noopener" data-rv data-letter="+">
      <span class="r-no mono">${pad(SITE.projects.length + 1)}</span>
      <span class="r-title">More on GitHub</span>
      <span class="r-text">Smaller builds and experiments live in my other repositories.</span>
      <span class="r-when mono">Ongoing</span>
      <span class="r-go"><svg class="arr" viewBox="0 0 16 16" aria-hidden="true"><path d="M4 12 12 4M5.5 4H12v6.5"/></svg></span>
    </a>`;
});

set("#about", el => { el.textContent = SITE.about; });
set("#time", el => { el.innerHTML = SITE.timeline.map(t => `<li><span class="yr mono">${esc(t.when)}</span><div><strong>${esc(t.what)}</strong><span>${esc(t.where)}</span></div></li>`).join(""); });
set("#stack", el => { el.innerHTML = SITE.stack.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${v.split(",").map(x => `<span>${esc(x.trim())}</span>`).join("")}</dd></div>`).join(""); });
set("#cv-file", el => { el.href = SITE.cvFile; });
set("#mail", el => { el.href = "mailto:" + SITE.email; el.textContent = SITE.email; });
set("#orb", el => { el.href = "mailto:" + SITE.email; });
$$("[data-gh]").forEach(el => { el.href = SITE.github; });
$$("[data-li]").forEach(el => { el.href = SITE.linkedin; });
const cap = w => w[0] + w.slice(1).toLowerCase();
set("#copy", el => { el.textContent = `© ${new Date().getFullYear()} ${cap(SITE.first)} ${cap(SITE.last)}`; });

/* ---------- Seitenwechsel wie bei einem Kachel-Menü ----------
   Klick auf eine Kachel: Die Kachel wächst in ihrer Farbe über den ganzen Bildschirm, dann lädt die Unterseite.
   Die Unterseite beginnt mit derselben Farbe (.veil), die nach oben wegfährt. */
$$("a.tile[href$='.html'], a.tile[href*='.html#']").forEach(tile => {
  tile.addEventListener("click", e => {
    if (reduced || e.metaKey || e.ctrlKey || e.shiftKey || e.button) return;
    e.preventDefault();
    const r = tile.getBoundingClientRect(), cs = getComputedStyle(tile);
    try { sessionStorage.setItem("veil", cs.backgroundColor); } catch (err) { /* privater Modus */ }
    const g = document.createElement("div");
    g.className = "grow";
    Object.assign(g.style, { left: r.left + "px", top: r.top + "px", width: r.width + "px", height: r.height + "px", background: cs.backgroundColor });
    document.body.appendChild(g);
    g.getBoundingClientRect();
    Object.assign(g.style, { left: "0px", top: "0px", width: "100vw", height: "100vh", borderRadius: "0px" });
    setTimeout(() => { location.href = tile.href; }, 480);
  });
});
/* Kommt man mit «Zurück» wieder, darf die gewachsene Kachel nicht mehr im Weg sein. */
addEventListener("pageshow", () => { $$(".grow").forEach(g => g.remove()); });
set(".veil", el => {
  let c = null;
  try { c = sessionStorage.getItem("veil"); sessionStorage.removeItem("veil"); } catch (err) { /* privater Modus */ }
  if (c) el.style.background = c;
  el.classList.add("go");
  el.addEventListener("animationend", () => el.remove());
});

/* ---------- Einblenden beim Scrollen ---------- */
const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } }), { threshold: .12 });
$$("[data-rv]").forEach(el => io.observe(el));

/* Leichte Parallaxe im Porträt */
set("#me-img", img => {
  const move = () => {
    const r = img.parentElement.getBoundingClientRect();
    if (r.bottom > 0 && r.top < innerHeight) img.style.transform = `translateY(${-clamp((innerHeight - r.top) / (innerHeight + r.height)) * 10.5}%)`;
  };
  addEventListener("scroll", move, { passive: true }); move();
});

/* ---------- Magnetische Knöpfe: Alle Knöpfe und Links ziehen sich gleich zum Zeiger hin und federn zurück. ---------- */
const mags = [];
function magnet(el, max = 22) {
  let inner = null;
  if (el.matches(".btn,.orb")) {
    inner = el.classList.contains("orb") ? el.firstElementChild : document.createElement("span");
    if (!inner.parentNode) { inner.append(...el.childNodes); el.append(inner); }
    inner.classList.add("m-in");
  }
  const m = { el, inner, x: 0, y: 0, tx: 0, ty: 0 };
  el.addEventListener("pointermove", e => {
    const r = el.getBoundingClientRect();
    m.tx = clamp((e.clientX - (r.left + r.width / 2 - m.x)) * .3, -max, max);
    m.ty = clamp((e.clientY - (r.top + r.height / 2 - m.y)) * .3, -max, max);
  });
  el.addEventListener("pointerleave", () => { m.tx = m.ty = 0; });
  mags.push(m);
}
const mouse = matchMedia("(hover: hover) and (pointer: fine)").matches;
if (mouse) {
  $$(".btn,.orb,.nav a,.foot a,.mail,.c-links a").forEach(el => magnet(el));
  $$(".tile").forEach(el => magnet(el, 7));
}
(function spring() {
  requestAnimationFrame(spring);
  if (reduced) return;
  for (const m of mags) {
    if (m.x === m.tx && m.y === m.ty) continue;
    if (Math.abs(m.tx - m.x) < .05 && Math.abs(m.ty - m.y) < .05) { m.x = m.tx; m.y = m.ty; }
    else { m.x += (m.tx - m.x) * .16; m.y += (m.ty - m.y) * .16; }
    m.el.style.transform = m.x || m.y ? `translate(${m.x.toFixed(2)}px,${m.y.toFixed(2)}px)` : "";
    if (m.inner) m.inner.style.transform = m.x || m.y ? `translate(${(m.x * .4).toFixed(2)}px,${(m.y * .4).toFixed(2)}px)` : "";
  }
})();

/* ---------- Projekt-Vorschau am Zeiger ---------- */
set("#peek", peek => {
  if (!matchMedia("(hover: hover) and (pointer: fine)").matches) return;
  let px = 0, py = 0, tx = 0, ty = 0, peeking = false;
  $$(".row").forEach(row => {
    row.addEventListener("pointerenter", () => {
      peek.textContent = row.dataset.letter || "";
      if (row.dataset.img) { const im = new Image(); im.alt = ""; im.onload = () => peek.appendChild(im); im.src = row.dataset.img; }
      peek.classList.add("on"); peeking = true;
    });
    row.addEventListener("pointerleave", () => { peek.classList.remove("on"); peeking = false; });
  });
  addEventListener("pointermove", e => { tx = e.clientX + 150; ty = e.clientY - 30; }, { passive: true });
  (function follow() {
    requestAnimationFrame(follow);
    if (!peeking && Math.abs(tx - px) < .5) return;
    px += (tx - px) * .14; py += (ty - py) * .14;
    peek.style.left = px + "px"; peek.style.top = py + "px";
  })();
});

/* ---------- Uhr ---------- */
set("#clock", clock => {
  const tick = () => { clock.textContent = "Local time in Switzerland " + new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Zurich" }).format(new Date()); };
  tick(); setInterval(tick, 15000);
});

/* ---------- Drei Phasen auf der Kontakt-Seite ---------- */
set("#waves", c => {
  const x = c.getContext("2d");
  let vis = false, t = 0, lastT = performance.now(), amp = .34, ampT = .34;
  new IntersectionObserver(es => { vis = es[0].isIntersecting; }).observe(c);
  c.parentElement.addEventListener("pointermove", e => { ampT = .2 + .26 * clamp(e.clientX / innerWidth); });
  (function draw(now) {
    requestAnimationFrame(draw);
    const dt = Math.min(.05, ((now || lastT) - lastT) / 1000); lastT = now || lastT;
    if (!vis) return;
    const pr = Math.min(devicePixelRatio || 1, 2), w = c.clientWidth * pr, h = c.clientHeight * pr;
    if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
    if (!reduced) t += dt * 1.6;
    amp += (ampT - amp) * .06;
    x.clearRect(0, 0, w, h);
    ["#E57E3A", "#DDD9D1", "#8C949E"].forEach((col, i) => {
      x.strokeStyle = col; x.lineWidth = 2 * pr; x.beginPath();
      for (let p = 0; p <= w; p += 4) {
        const yy = h / 2 - Math.sin(p / w * Math.PI * 7 - t - i * Math.PI * 2 / 3) * h * amp;
        p ? x.lineTo(p, yy) : x.moveTo(p, yy);
      }
      x.stroke();
    });
  })();
});
