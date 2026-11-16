/* =====================================================================
   3D-Modell des Axialfluss-Generators Version 1 (three.js).
   Die Bauteile stammen aus dem Fusion-Modell und liegen als Netze in assets/model/v1.bin
   (Verzeichnis dazu: assets/model/v1.json; 1 Einheit = 8 cm, Rotor-Radius = 1).
   Zwei Darstellungen, die per «wipe» ineinander übergehen:
   - beleuchtetes Modell auf dunklem Grund
   - Strichzeichnung auf Papier (Kanten aus Normalen und Bauteil-IDs)
   Die Achse des Generators ist die x-Achse des Modells.
   ===================================================================== */
import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { T, TYPES } from "./parts.js";

const DEG = Math.PI / 180;

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
/* Bauteile: Typ (Farbindex), Material, ex = Weg entlang der Achse in der Explosionsansicht,
   spin = dreht mit der Welle, hide = Stufe, ab der das Teil für den Blick ins Innere weggeblendet wird
   (1 = Gehäuse Süd und M6-Schrauben, 2 = Rotor Süd, 3 = Stator-Deckel), house = gehört zum Gehäuse. */
const PARTS = {
  wheel:      { type: T.wheel, mat: "steel",  ex: 0,     spin: true },
  screwsM3:   { type: T.hw,    mat: "steel",  ex: 0,     spin: true },
  nutsM25:    { type: T.hw,    mat: "steel",  ex: -.45,  spin: true, hide: 2 },
  rotorN:     { type: T.rotN,  mat: "rotor",  ex: 1.15,  spin: true },
  rotorS:     { type: T.rotS,  mat: "rotor",  ex: -1.15, spin: true, hide: 2 },
  statorBody: { type: T.statB, mat: "stator", ex: .34 },
  statorLid:  { type: T.statL, mat: "stator", ex: -.34,  hide: 3 },
  housNB:     { type: T.hNB,   mat: "house",  ex: 1.8,   house: 1 },
  housNL:     { type: T.hNL,   mat: "lid",    ex: 2.3,   house: 1 },
  housSB:     { type: T.hSB,   mat: "house",  ex: -1.8,  house: -1, hide: 1 },
  housSL:     { type: T.hSL,   mat: "lid",    ex: -2.3,  house: -1, hide: 1 },
  boltsM6:    { type: T.bolt,  mat: "steel",  ex: -2.75, house: -1, hide: 1 },
  washersM6:  { type: T.bolt,  mat: "steel",  ex: 2.55,  house: 1,  hide: 1 },
  nutsM6:     { type: T.bolt,  mat: "steel",  ex: 2.68,  house: 1,  hide: 1 }
};

export async function createGenerator(canvas) {
  const [manifest, buf] = await Promise.all([
    fetch(new URL("./model/v1.json", import.meta.url)).then(r => { if (!r.ok) throw new Error("model manifest missing"); return r.json(); }),
    fetch(new URL("./model/v1.bin", import.meta.url)).then(r => { if (!r.ok) throw new Error("model data missing"); return r.arrayBuffer(); })
  ]);
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
    steel:  new THREE.MeshStandardMaterial({ color: 0xb0b3b8, metalness: .95, roughness: .3 }),
    rotor:  new THREE.MeshStandardMaterial({ color: 0xc4c7cb, metalness: .35, roughness: .42 }),
    stator: new THREE.MeshStandardMaterial({ color: 0xd9772f, metalness: .45, roughness: .4 }),
    house:  new THREE.MeshStandardMaterial({ color: 0x2c2f33, metalness: .3, roughness: .5 }),
    lid:    new THREE.MeshStandardMaterial({ color: 0x3a3e43, metalness: .3, roughness: .45 })
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
  /* Netze laden. Die flache Standfläche des Gehäuses liegt unten (-y), die Lasche mit der fünften Schraube oben. */
  for (const e of manifest.parts) {
    const cfg = PARTS[e.name];
    if (!cfg) continue;
    const pos = new Float32Array(buf, e.pos, e.verts * 3).slice();
    const nq = new Int8Array(buf, e.nor, e.verts * 3), nor = new Float32Array(e.verts * 3);
    for (let i = 0; i < e.verts * 3; i++) nor[i] = nq[i] / 127;
    const idx = e.idx32 ? new Uint32Array(buf, e.idx, e.tris * 3).slice() : new Uint16Array(buf, e.idx, e.tris * 3).slice();
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    geo.setAttribute("normal", new THREE.BufferAttribute(nor, 3));
    geo.setIndex(new THREE.BufferAttribute(idx, 1));
    const g = new THREE.Group();
    g.userData = cfg;
    root.add(g); parts[e.name] = g;
    mk(geo, cfg.mat, cfg.type, g);
  }
  for (const name in PARTS) if (!parts[name]) throw new Error("model part missing: " + name);

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

  /* st: yaw, pitch, roll (Grad), e (Explosion 0..1), f (Gehäuse: 0 weit weg .. 1 an seinem Platz),
         open (0 geschlossen, 1 ohne Gehäuse Süd, 2 ohne Rotor Süd, 3 ohne Stator-Deckel),
         spin (rad), s (Massstab), cx, cy (Bildschirm-Pixel), wipe (0 dunkel .. 1 Zeichnung), pal (Float32Array rgba je Typ) */
  function render(st) {
    qy.setFromAxisAngle(AY, st.yaw * DEG); qx.setFromAxisAngle(AX, st.pitch * DEG); qz.setFromAxisAngle(AZ, st.roll * DEG);
    root.quaternion.copy(qz).multiply(qx).multiply(qy);
    root.scale.setScalar(st.s);
    root.position.set((st.cx / view.w - .5) * 2 * view.halfW, -(st.cy / view.h - .5) * 2 * view.halfH, 0);
    for (const name in parts) {
      const g = parts[name], d = g.userData;
      g.position.x = d.ex * st.e + (d.house ? d.house * (1 - st.f) * 2 : 0);
      if (d.spin) g.rotation.x = st.spin;
      const k = d.hide ? Math.min(1, Math.max(0, d.hide - st.open)) : 1;
      g.scale.set(1, k, k); g.visible = k > .02;
    }
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
