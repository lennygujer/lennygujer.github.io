/* =====================================================================
   3D-Modell des Axialfluss-Generators (three.js).
   Zwei Darstellungen, die per «wipe» ineinander übergehen:
   - beleuchtetes Modell auf dunklem Grund
   - Strichzeichnung auf Papier (Kanten aus Normalen und Bauteil-IDs)
   Die Achse des Generators ist die x-Achse des Modells.
   ===================================================================== */
import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { T, TYPES } from "./parts.js";

const DEG = Math.PI / 180;

/* ---------- Geometrie-Helfer ---------- */

/* Rotationskörper um die x-Achse. profile = geschlossenes Polygon aus [x, r].
   Jede Kante bekommt eigene Eckpunkte, damit die Kanten scharf bleiben. */
function lathe(profile, seg = 96) {
  const pos = [], nor = [], idx = [];
  const n = profile.length;
  let area = 0;
  for (let i = 0; i < n; i++) { const a = profile[i], b = profile[(i + 1) % n]; area += a[0] * b[1] - b[0] * a[1]; }
  const sg = area > 0 ? 1 : -1;
  for (let i = 0; i < n; i++) {
    const [x1, r1] = profile[i], [x2, r2] = profile[(i + 1) % n];
    if (r1 < 1e-6 && r2 < 1e-6) continue;
    const dx = x2 - x1, dr = r2 - r1, l = Math.hypot(dx, dr);
    if (l < 1e-9) continue;
    const nx = sg * dr / l, nr = -sg * dx / l;
    const base = pos.length / 3;
    for (let j = 0; j <= seg; j++) {
      const a = j / seg * Math.PI * 2, c = Math.cos(a), s = Math.sin(a);
      pos.push(x1, r1 * c, r1 * s, x2, r2 * c, r2 * s);
      nor.push(nx, nr * c, nr * s, nx, nr * c, nr * s);
    }
    for (let j = 0; j < seg; j++) { const a = base + j * 2; idx.push(a, a + 1, a + 3, a, a + 3, a + 2); }
  }
  for (let t = 0; t < idx.length; t += 3) {
    const a = idx[t] * 3, b = idx[t + 1] * 3, c = idx[t + 2] * 3;
    const ux = pos[b] - pos[a], uy = pos[b + 1] - pos[a + 1], uz = pos[b + 2] - pos[a + 2];
    const vx = pos[c] - pos[a], vy = pos[c + 1] - pos[a + 1], vz = pos[c + 2] - pos[a + 2];
    const cx = uy * vz - uz * vy, cy = uz * vx - ux * vz, cz = ux * vy - uy * vx;
    const d = cx * (nor[a] + nor[b] + nor[c]) + cy * (nor[a + 1] + nor[b + 1] + nor[c + 1]) + cz * (nor[a + 2] + nor[b + 2] + nor[c + 2]);
    if (d < 0) { const tmp = idx[t + 1]; idx[t + 1] = idx[t + 2]; idx[t + 2] = tmp; }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3));
  g.setIndex(idx);
  return g;
}
const ring = (r0, r1, x0, x1, ch = 0, seg = 96) =>
  lathe([[x0, r0], [x0, r1 - ch], [x0 + ch, r1], [x1 - ch, r1], [x1, r1 - ch], [x1, r0]], seg);
const cyl = (r, x0, x1, seg = 20) => lathe([[x0, 0], [x0, r], [x1, r], [x1, 0]], seg);

/* Form in der (y,z)-Ebene, extrudiert entlang x, um x = 0 zentriert. */
const BASIS = new THREE.Matrix4().makeBasis(new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 1), new THREE.Vector3(1, 0, 0));
function extrude(shape, depth, curveSegments = 24) {
  const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments });
  g.translate(0, 0, -depth / 2);
  g.applyMatrix4(BASIS);
  return g;
}
/* Ringsektor: aussen r1 mit Halbwinkel h1, innen r0 mit Halbwinkel h0. */
function sector(r0, h0, r1, h1, n = 12) {
  const p = [];
  for (let i = 0; i <= n; i++) { const a = -h1 + 2 * h1 * i / n; p.push(new THREE.Vector2(r1 * Math.cos(a), r1 * Math.sin(a))); }
  for (let i = n; i >= 0; i--) { const a = -h0 + 2 * h0 * i / n; p.push(new THREE.Vector2(r0 * Math.cos(a), r0 * Math.sin(a))); }
  return p;
}
function circle(cx, cy, r, n = 28) {
  const p = [];
  for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2; p.push(new THREE.Vector2(cx + r * Math.cos(a), cy + r * Math.sin(a))); }
  return p;
}

/* ---------- Shader ---------- */
const QUAD_VS = "varying vec2 vUv; void main(){ vUv = position.xy*.5+.5; gl_Position = vec4(position.xy,0.,1.); }";
const HASH = "float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233)))*43758.5453); }";

const BG_FS = `
varying vec2 vUv; uniform vec2 uC; uniform float uAsp; uniform vec3 uA; uniform vec3 uB;
${HASH}
void main(){
  vec2 d = vUv - uC; d.x *= uAsp;
  float g = exp(-dot(d,d)*3.4);
  vec3 c = mix(uB, uA, g);
  c += (hash(gl_FragCoord.xy) - .5) * (2.5/255.);
  gl_FragColor = vec4(c, 1.);
}`;

const DATA_VS = "varying vec3 vN; void main(){ vN = normalize(normalMatrix*normal); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }";
const DATA_FS = "uniform float uId; varying vec3 vN; void main(){ vec3 n = normalize(vN); gl_FragColor = vec4(n.xy*.5+.5, 0., uId); }";

const LINE_FS = `
varying vec2 vUv;
uniform sampler2D tData; uniform vec2 uRes; uniform float uLine; uniform float uWipe;
uniform vec3 uPaper; uniform vec3 uInk; uniform vec3 uFront; uniform vec4 uPal[${TYPES}];
${HASH}
vec3 nrm(vec4 s){ vec2 xy = s.rg*2.-1.; return vec3(xy, sqrt(max(0., 1.-dot(xy,xy)))); }
void main(){
  vec2 px = uLine / uRes;
  vec4 c  = texture2D(tData, vUv);
  vec4 s1 = texture2D(tData, vUv + vec2(px.x, 0.));
  vec4 s2 = texture2D(tData, vUv - vec2(px.x, 0.));
  vec4 s3 = texture2D(tData, vUv + vec2(0., px.y));
  vec4 s4 = texture2D(tData, vUv - vec2(0., px.y));
  float idd = max(max(abs(s1.a-c.a), abs(s2.a-c.a)), max(abs(s3.a-c.a), abs(s4.a-c.a)));
  float eI = smoothstep(.4/255., 2.2/255., idd);
  vec3 n = nrm(c);
  float nd = max(max(1.-dot(n,nrm(s1)), 1.-dot(n,nrm(s2))), max(1.-dot(n,nrm(s3)), 1.-dot(n,nrm(s4))));
  float eN = smoothstep(.035, .13, nd) * step(.5/255., c.a);
  float e = clamp(max(eI, eN), 0., 1.);
  vec3 fill = uPaper;
  if (c.a > .03) {
    int t = int(floor(c.a*255./16. + .05));
    if (t < 0) t = 0; if (t > ${TYPES - 1}) t = ${TYPES - 1};
    vec4 p = uPal[t];
    float sh = .82 + .18*clamp(dot(n, normalize(vec3(-.35,.5,.8))), 0., 1.);
    fill = mix(uPaper, p.rgb*sh, p.a);
  }
  vec3 col = mix(fill, uInk, e);
  col += (hash(gl_FragCoord.xy) - .5) * (2./255.);
  float k = vUv.x + (vUv.y - .5)*.22;
  float m = 1. - smoothstep(uWipe - .002, uWipe + .002, k);
  float front = smoothstep(.006, 0., abs(k - uWipe));
  col = mix(col, uFront, front);
  gl_FragColor = vec4(col, max(m, front));
}`;

/* ---------- Generator ---------- */
export function createGenerator(canvas, { magnets = 12, coils = 9 } = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: "high-performance" });
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  renderer.autoClear = false;

  const scene = new THREE.Scene();
  const pm = new THREE.PMREMGenerator(renderer);
  scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.85;
  pm.dispose();

  const HALF_H = 10 * Math.tan(13 * DEG);
  const cam = new THREE.PerspectiveCamera(26, 1, 2, 30);
  cam.position.set(0, 0, 10);

  const key = new THREE.DirectionalLight(0xffc59a, 3.4); key.position.set(4, 6, 7); scene.add(key);
  const rim = new THREE.DirectionalLight(0x8fb4ff, 2.6); rim.position.set(-7, 3, -5); scene.add(rim);
  const low = new THREE.DirectionalLight(0xff8a4a, 1.3); low.position.set(-2, -6, 3); scene.add(low);

  const MAT = {
    steel:  new THREE.MeshStandardMaterial({ color: 0xa3a6ab, metalness: .95, roughness: .3 }),
    iron:   new THREE.MeshStandardMaterial({ color: 0x70747a, metalness: .92, roughness: .38 }),
    magnet: new THREE.MeshStandardMaterial({ color: 0xdfe2e6, metalness: 1, roughness: .16 }),
    copper: new THREE.MeshStandardMaterial({ color: 0xe0823f, metalness: 1, roughness: .3 }),
    epoxy:  new THREE.MeshStandardMaterial({ color: 0x1a2622, metalness: 0, roughness: .22 }),
    l1:     new THREE.MeshStandardMaterial({ color: 0x9a5f33, metalness: 0, roughness: .55 }),
    l2:     new THREE.MeshStandardMaterial({ color: 0x151515, metalness: 0, roughness: .5 }),
    l3:     new THREE.MeshStandardMaterial({ color: 0x9aa2ac, metalness: 0, roughness: .55 }),
    frame:  new THREE.MeshStandardMaterial({ color: 0xb4b7bb, metalness: .85, roughness: .5 })
  };
  const dataBase = new THREE.ShaderMaterial({ uniforms: { uId: { value: 0 } }, vertexShader: DATA_VS, fragmentShader: DATA_FS });

  const root = new THREE.Group(); scene.add(root);
  const meshes = [], parts = {};
  let count = 0;
  function mk(geo, mat, type, parent) {
    const m = new THREE.Mesh(geo, MAT[mat]);
    const d = dataBase.clone();
    d.uniforms.uId.value = (type * 16 + (count++ % 16)) / 255;
    m.userData.beauty = MAT[mat]; m.userData.data = d;
    parent.add(m); meshes.push(m);
    return m;
  }
  function part(name, base, ex, spin = false) {
    const g = new THREE.Group();
    g.userData = { base, ex, spin };
    root.add(g); parts[name] = g;
    return g;
  }

  /* Welle */
  const SH = 1.48;
  mk(lathe([[-SH, 0], [-SH, .052], [-SH + .03, .07], [SH - .03, .07], [SH, .052], [SH, 0]], 40), "steel", T.shaft, part("shaft", 0, 0, true));

  /* Rotoren: Nabe, Rückschluss, Magnete (Seite A bei -x, Seite B bei +x) */
  const hubGeo = lathe([[0, .07], [0, .3], [.05, .3], [.05, .16], [.19, .16], [.19, .07]], 64);
  const boltGeo = cyl(.03, .05, .085, 6);
  const ironGeo = lathe([[-.03, .12], [-.03, .988], [-.018, 1], [.018, 1], [.03, .988], [.03, .64], [.02, .62], [.02, .38], [.03, .36], [.03, .12]]);
  const magGeo = extrude(new THREE.Shape(sector(.56, .7 * Math.PI / magnets, .96, .7 * Math.PI / magnets)), .08);
  for (const side of [-1, 1]) {
    const tag = side < 0 ? "A" : "B";
    const hub = part("hub" + tag, side * .25, side * 2.5, true);
    const flip = new THREE.Group(); if (side < 0) flip.rotation.y = Math.PI; hub.add(flip);
    mk(hubGeo, "steel", T.hub, flip);
    for (let k = 0; k < 6; k++) {
      const b = mk(boltGeo, "steel", T.hub, flip), a = k / 6 * Math.PI * 2;
      b.position.set(0, .23 * Math.cos(a), .23 * Math.sin(a));
    }
    const iron = part("iron" + tag, side * .22, side * 1.85, true);
    const iflip = new THREE.Group(); if (side < 0) iflip.rotation.y = Math.PI; iron.add(iflip);
    mk(ironGeo, "iron", T.iron, iflip);
    const mags = part("mags" + tag, side * .15, side * 1.12, true);
    for (let k = 0; k < magnets; k++) {
      const even = (k % 2 === 0) === (side > 0);
      mk(magGeo, "magnet", even ? T.magN : T.magS, mags).rotation.x = k / magnets * Math.PI * 2;
    }
  }

  /* Stator: Epoxid-Scheibe mit Befestigungslaschen, Spulen, drei Phasenleiter */
  const LUG = [90, 210, 330].map(d => d * DEG), LM = 1.13, LR = .135;
  const outline = [];
  for (let i = 0; i < 360; i++) {
    const a = i / 360 * Math.PI * 2;
    let r = 1.08;
    for (const c of LUG) {
      const d = a - c, s = LM * Math.sin(d), q = LR * LR - s * s;
      if (q > 0 && Math.cos(d) > 0) r = Math.max(r, LM * Math.cos(d) + Math.sqrt(q));
    }
    outline.push(new THREE.Vector2(r * Math.cos(a), r * Math.sin(a)));
  }
  const disc = new THREE.Shape(outline);
  disc.holes.push(new THREE.Path(circle(0, 0, .3, 64)));
  for (const c of LUG) disc.holes.push(new THREE.Path(circle(LM * Math.cos(c), LM * Math.sin(c), .045, 20)));
  const epoxy = part("epoxy", 0, .36);
  mk(extrude(disc, .1), "epoxy", T.epoxy, epoxy);
  [[T.l1, "l1", -.08], [T.l2, "l2", 0], [T.l3, "l3", .08]].forEach(([type, mat, z], i) => {
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, -1.04, z), new THREE.Vector3(0, -1.3, z), new THREE.Vector3(.07, -1.5, z),
      new THREE.Vector3(.28, -1.6 - i * .012, z), new THREE.Vector3(.62, -1.62 - i * .012, z)]);
    mk(new THREE.TubeGeometry(curve, 48, .024, 10), mat, type, epoxy);
  });

  const pitch = Math.PI * 2 / coils, hc = pitch / 2 - 3 * DEG, cw = .13;
  const coilShape = new THREE.Shape(sector(.5, hc, .98, hc, 14));
  coilShape.holes.push(new THREE.Path(sector(.5 + cw, Math.max(.02, hc - cw / (.5 + cw)), .98 - cw, Math.max(.04, hc - cw / (.98 - cw)), 10)));
  const coilGeo = extrude(coilShape, .16);
  const coilG = part("coils", 0, -.36);
  for (let k = 0; k < coils; k++) mk(coilGeo, "copper", T.coil, coilG).rotation.x = k * pitch;

  /* Gestell (geplant): Grundplatte, zwei Lagerböcke */
  const frame = part("frame", 0, 0);
  const FX = 1.3;
  mk(new THREE.BoxGeometry(FX * 2 + .5, .07, 1.15), "frame", T.frame, frame).position.y = -1.785;
  const up = new THREE.Shape([
    new THREE.Vector2(-1.75, -.46), new THREE.Vector2(-1.75, .46), new THREE.Vector2(-.02, .24),
    new THREE.Vector2(.2, .16), new THREE.Vector2(.26, 0), new THREE.Vector2(.2, -.16), new THREE.Vector2(-.02, -.24)]);
  up.holes.push(new THREE.Path(circle(0, 0, .1, 32)));
  const upGeo = extrude(up, .07), bearGeo = ring(.072, .17, -.06, .06, .01, 48);
  for (const side of [-1, 1]) {
    mk(upGeo, "frame", T.frame, frame).position.x = side * FX;
    mk(bearGeo, "steel", T.frame, frame).position.x = side * FX;
  }

  /* ---------- Durchgänge ---------- */
  const ortho = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const tri = new THREE.BufferGeometry();
  tri.setAttribute("position", new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3));
  const quad = (mat) => { const s = new THREE.Scene(), m = new THREE.Mesh(tri, mat); m.frustumCulled = false; s.add(m); return s; };

  const bgMat = new THREE.ShaderMaterial({
    uniforms: { uC: { value: new THREE.Vector2(.5, .5) }, uAsp: { value: 1 }, uA: { value: new THREE.Vector3(.2, .145, .11) }, uB: { value: new THREE.Vector3(.058, .055, .052) } },
    vertexShader: QUAD_VS, fragmentShader: BG_FS, depthTest: false, depthWrite: false
  });
  const rt = new THREE.WebGLRenderTarget(4, 4, { samples: 4, depthBuffer: true });
  const pal = Array.from({ length: TYPES }, () => new THREE.Vector4(0, 0, 0, 0));
  const lineMat = new THREE.ShaderMaterial({
    uniforms: {
      tData: { value: rt.texture }, uRes: { value: new THREE.Vector2(4, 4) }, uLine: { value: 1 }, uWipe: { value: -1 },
      uPaper: { value: new THREE.Vector3(.867, .851, .82) }, uInk: { value: new THREE.Vector3(.106, .102, .094) },
      uFront: { value: new THREE.Vector3(.898, .494, .227) }, uPal: { value: pal }
    },
    vertexShader: QUAD_VS, fragmentShader: LINE_FS, depthTest: false, depthWrite: false, transparent: true
  });
  const bgScene = quad(bgMat), lineScene = quad(lineMat);

  const view = { w: 1, h: 1, halfW: HALF_H, halfH: HALF_H, ppu: 1 };
  function setSize(w, h) {
    const pr = Math.max(1, Math.min(window.devicePixelRatio || 1, 2, Math.sqrt(3.4e6 / (w * h))));
    renderer.setPixelRatio(pr);
    renderer.setSize(w, h, false);
    const W = Math.round(w * pr), H = Math.round(h * pr);
    rt.setSize(W, H);
    lineMat.uniforms.uRes.value.set(W, H);
    lineMat.uniforms.uLine.value = .72 * pr;
    cam.aspect = w / h; cam.updateProjectionMatrix();
    bgMat.uniforms.uAsp.value = w / h;
    Object.assign(view, { w, h, halfH: HALF_H, halfW: HALF_H * w / h, ppu: h / (2 * HALF_H) });
  }

  const qy = new THREE.Quaternion(), qx = new THREE.Quaternion(), qz = new THREE.Quaternion();
  const AX = new THREE.Vector3(1, 0, 0), AY = new THREE.Vector3(0, 1, 0), AZ = new THREE.Vector3(0, 0, 1), v = new THREE.Vector3();
  const useMats = (k) => { for (const m of meshes) m.material = m.userData[k]; };

  /* st: yaw, pitch, roll (Grad), e (Explosion 0..1), f (Gestell 0..1), open (Rotor A weg 0..1),
         spin (rad), s (Massstab), cx, cy (Bildschirm-Pixel), wipe (0 dunkel .. 1 Zeichnung), pal (Float32Array rgba je Typ) */
  function render(st) {
    qy.setFromAxisAngle(AY, st.yaw * DEG); qx.setFromAxisAngle(AX, st.pitch * DEG); qz.setFromAxisAngle(AZ, st.roll * DEG);
    root.quaternion.copy(qz).multiply(qx).multiply(qy);
    root.scale.setScalar(st.s);
    root.position.set((st.cx / view.w - .5) * 2 * view.halfW, -(st.cy / view.h - .5) * 2 * view.halfH, 0);
    for (const name in parts) {
      const g = parts[name], d = g.userData;
      g.position.x = d.base + d.ex * st.e;
      if (d.spin) g.rotation.x = st.spin;
    }
    const k = Math.max(0, 1 - st.open);
    for (const name of ["hubA", "ironA", "magsA"]) { parts[name].scale.set(1, k, k); parts[name].visible = k > .02; }
    frame.position.y = -(1 - st.f) * 1.5;
    frame.scale.setScalar(.6 + .4 * st.f);
    frame.visible = st.f > .01;
    root.updateMatrixWorld(true);

    const wipe = -.15 + 1.3 * st.wipe;
    renderer.setRenderTarget(null);
    renderer.setClearColor(0x0f0e0d, 1);
    renderer.clear();
    if (st.wipe < 1) {
      bgMat.uniforms.uC.value.set(st.cx / view.w, 1 - st.cy / view.h);
      renderer.render(bgScene, ortho);
      renderer.clearDepth();
      useMats("beauty");
      renderer.render(scene, cam);
    }
    if (st.wipe > 0) {
      for (let i = 0; i < TYPES; i++) pal[i].set(st.pal[i * 4], st.pal[i * 4 + 1], st.pal[i * 4 + 2], st.pal[i * 4 + 3]);
      lineMat.uniforms.uWipe.value = st.wipe >= 1 ? 2 : wipe;
      useMats("data");
      renderer.setRenderTarget(rt);
      renderer.setClearColor(0x000000, 0);
      renderer.clear();
      renderer.render(scene, cam);
      renderer.setRenderTarget(null);
      renderer.render(lineScene, ortho);
    }
  }

  /* Bildschirmposition eines Punkts an einem Bauteil (y, z im Modell; dx entlang der Achse). */
  function anchor(name, y, z, dx = 0) {
    v.set(parts[name].position.x + dx, y, z);
    root.localToWorld(v);
    v.project(cam);
    return [(v.x * .5 + .5) * view.w, (-v.y * .5 + .5) * view.h];
  }

  return { setSize, render, anchor, view };
}
