// Agent City — Paris edition. The 3D scene only; app.js decides what agents do.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const TAU = Math.PI * 2;

// Each landmark is one Cominty capability, placed on one of the 8 avenues of an
// Étoile-style star around the Eiffel Tower (the City Planner's HQ).
export const BUILDINGS = {
  studio:   { name: 'Art Studio',     place: 'Montmartre',             cap: 'Image generation',     icon: '🎨', color: 0xff8a65, angle: 0,    build: 'sacre' },
  writers:  { name: "Writers' Café",  place: 'Saint-Germain',          cap: 'Files & drafts',       icon: '✍️', color: 0xffd166, angle: 45,   build: 'cafe' },
  home:     { name: 'Your Desk',      place: 'Le Marais',              cap: 'You',                  icon: '🏠', color: 0xfff1d6, angle: 90,   build: 'home' },
  workshop: { name: 'Workshop',       place: 'Centre Pompidou',        cap: 'Integrations · tools', icon: '🛠️', color: 0x7fb8ff, angle: 135,  build: 'pompidou' },
  library:  { name: 'Library',        place: 'Panthéon · Quartier Latin', cap: 'Web search',        icon: '🔎', color: 0x5fb4ff, angle: 180,  build: 'pantheon' },
  archive:  { name: 'Archive',        place: 'Louvre',                 cap: 'Reads documents',      icon: '🗂️', color: 0x8bd3c7, angle: -135, build: 'louvre' },
  vault:    { name: 'Memory Vault',   place: 'Arc de Triomphe',        cap: 'Memory',               icon: '🧠', color: 0x6be3bf, angle: -90,  build: 'arc' },
  townhall: { name: 'Town Hall',      place: 'Hôtel de Ville',         cap: 'Review · 2nd opinion', icon: '⚖️', color: 0xc792ea, angle: -45,  build: 'hdv' },
};

const RING = 40;        // landmark centres
const PLAZA_R = 17;     // gardens around the tower
const ROAD_R = 22;      // outer edge of the roundabout
const ARC_R = 13.5;     // walkers circle the tower on this gravel ring
const SPAWN_R = 11.5;   // walkers appear here, between the tower legs
const ENTRY_R = 19.5;   // where a walker turns onto an avenue
const WS = 1.6;         // walker scale
const LITE = new URLSearchParams(location.search).has('lite'); // ?lite for slower laptops

// ------------------------------------------------------------------ textures
function rng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }

function facadeTextures(seed = 1, { floors = 5, cols = 4, tint = '#e8dcc3' } = {}) {
  const W = 256, H = 256;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const e = document.createElement('canvas'); e.width = W; e.height = H;
  const g = c.getContext('2d'), ge = e.getContext('2d');
  const r = rng(seed);
  const grad = g.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, tint); grad.addColorStop(1, '#d4c6a9');
  g.fillStyle = grad; g.fillRect(0, 0, W, H);
  ge.fillStyle = '#000'; ge.fillRect(0, 0, W, H);
  // stone courses
  g.strokeStyle = 'rgba(120,100,70,0.12)';
  for (let y = 6; y < H; y += 9) { g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); }
  const groundH = 44, top = 14, fh = (H - groundH - top) / floors;
  // cornice
  g.fillStyle = '#cbbd9f'; g.fillRect(0, 0, W, top - 4);
  g.fillStyle = 'rgba(90,75,55,.35)'; g.fillRect(0, top - 5, W, 2);
  const cw = W / cols, ww = cw * 0.42;
  for (let f = 0; f < floors; f++) {
    const y = top + f * fh;
    const wh = fh * 0.62;
    for (let i = 0; i < cols; i++) {
      const x = i * cw + (cw - ww) / 2;
      const lit = r() < 0.38;
      g.fillStyle = 'rgba(80,65,45,.35)'; g.fillRect(x - 3, y + fh * 0.12 - 3, ww + 6, wh + 6);
      g.fillStyle = lit ? '#ffd38c' : (r() < 0.5 ? '#3a4652' : '#2f3a45');
      g.fillRect(x, y + fh * 0.12, ww, wh);
      g.fillStyle = 'rgba(255,255,255,.18)'; g.fillRect(x + ww / 2 - 1, y + fh * 0.12, 2, wh);
      if (lit) { ge.fillStyle = r() < 0.3 ? '#ffe2b0' : '#ffb85c'; ge.fillRect(x, y + fh * 0.12, ww, wh); }
      // wrought-iron balcony rail
      if (f === 1 || f === floors - 1 || r() < 0.25) {
        g.fillStyle = '#1f2326';
        const by = y + fh * 0.12 + wh - 2;
        if (f === 1 || f === floors - 1) g.fillRect(0, by, W, 3); else g.fillRect(x - 4, by, ww + 8, 3);
        for (let b = 0; b < (f === 1 || f === floors - 1 ? W : ww + 8); b += 5) g.fillRect((f === 1 || f === floors - 1 ? 0 : x - 4) + b, by - 7, 1, 7);
      }
    }
  }
  // ground floor shops with arches and awnings
  const gy = H - groundH;
  g.fillStyle = '#c8b894'; g.fillRect(0, gy, W, groundH);
  const awn = ['#8e2c2c', '#2f5d46', '#1f3b5a', '#7a4a2a'][Math.floor(r() * 4)];
  for (let i = 0; i < cols; i++) {
    const x = i * cw + cw * 0.12, w = cw * 0.76;
    g.fillStyle = '#2b2a28'; g.fillRect(x, gy + 12, w, groundH - 12);
    g.fillStyle = '#ffc77a'; g.globalAlpha = 0.85; g.fillRect(x + 3, gy + 16, w - 6, groundH - 20); g.globalAlpha = 1;
    ge.fillStyle = '#ff9f40'; ge.fillRect(x + 3, gy + 16, w - 6, groundH - 20);
    g.fillStyle = awn; g.fillRect(x - 2, gy + 6, w + 4, 8);
  }
  const map = new THREE.CanvasTexture(c); map.colorSpace = THREE.SRGBColorSpace;
  const emap = new THREE.CanvasTexture(e); emap.colorSpace = THREE.SRGBColorSpace;
  for (const t of [map, emap]) { t.anisotropy = 4; }
  return { map, emap };
}

function skyMaterial() {
  return new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { top: { value: new THREE.Color() }, horizon: { value: new THREE.Color() }, bottom: { value: new THREE.Color() },
      sunDir: { value: new THREE.Vector3(0, 1, 0) }, sunColor: { value: new THREE.Color() }, sunSize: { value: 0.0 } },
    vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `uniform vec3 top; uniform vec3 horizon; uniform vec3 bottom; uniform vec3 sunDir; uniform vec3 sunColor; uniform float sunSize;
      varying vec3 vDir;
      void main(){
        float h = vDir.y;
        vec3 col = h > 0.0 ? mix(horizon, top, pow(clamp(h,0.0,1.0), 0.55)) : mix(horizon, bottom, clamp(-h*3.0,0.0,1.0));
        float s = max(dot(normalize(vDir), normalize(sunDir)), 0.0);
        col += sunColor * (pow(s, 600.0) * 3.0 * sunSize + pow(s, 12.0) * 0.35 * sunSize);
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
}

const TIMES = {
  golden: { label: '🌅 Golden hour', top: 0x4a78b8, horizon: 0xf7cfa6, bottom: 0x9a8a7a, fog: 0xeed8bf, fogNear: 160, fogFar: 460,
    sun: 0xffdcb4, sunI: 3.0, sunPos: [-100, 70, 60], sunSize: 1, hemiSky: 0xfff3e2, hemiGround: 0x8a7a66, hemiI: 1.35,
    windows: 0.45, lamps: 0.9, tower: 0.06, sparkle: false, bloom: 0.4, exposure: 1.05, water: 0x2a4a5c },
  day: { label: '☀️ Day', top: 0x3d7fd1, horizon: 0xcfe4f3, bottom: 0x9aa6a8, fog: 0xd6e6ef, fogNear: 170, fogFar: 520,
    sun: 0xfff6e8, sunI: 2.8, sunPos: [70, 120, 60], sunSize: 0.6, hemiSky: 0xdfefff, hemiGround: 0x6a6455, hemiI: 1.0,
    windows: 0.08, lamps: 0.2, tower: 0.0, sparkle: false, bloom: 0.18, exposure: 1.0, water: 0x1c3a4d },
  night: { label: '🌙 Night', top: 0x03060f, horizon: 0x1b2a48, bottom: 0x05070c, fog: 0x101a2c, fogNear: 110, fogFar: 380,
    sun: 0x9fb6ff, sunI: 0.55, sunPos: [80, 90, -60], sunSize: 0.0, hemiSky: 0x5a6f9e, hemiGround: 0x1a1612, hemiI: 0.35,
    windows: 1.6, lamps: 2.2, tower: 0.9, sparkle: true, bloom: 1.05, exposure: 1.05, water: 0x0b1a2a },
};

// ------------------------------------------------------------------ robots
// Original glossy hover-bot design. Role colour, hat and prop say what each one does.
const ROBOT = {
  shell: new THREE.MeshPhysicalMaterial({ color: 0xfbfaf7, roughness: 0.28, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.12, sheen: 0.3 }),
  visor: new THREE.MeshPhysicalMaterial({ color: 0x05080c, roughness: 0.08, metalness: 0.2, clearcoat: 1, clearcoatRoughness: 0.03 }),
  joint: new THREE.MeshStandardMaterial({ color: 0xd9dde2, roughness: 0.35, metalness: 0.6 }),
  dark: new THREE.MeshStandardMaterial({ color: 0x2a3138, roughness: 0.5, metalness: 0.3 }),
  cheek: new THREE.MeshBasicMaterial({ color: 0xff7f9e, transparent: true, opacity: 0.55 }),
  shadowTex: (() => {
    const c = document.createElement('canvas'); c.width = c.height = 64;
    const g = c.getContext('2d'); const grd = g.createRadialGradient(32, 32, 2, 32, 32, 32);
    grd.addColorStop(0, 'rgba(0,0,0,0.55)'); grd.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grd; g.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(c);
  })(),
};
// egg-shaped body, turned on a lathe
const BODY_PROFILE = [[0, 0], [0.2, 0.01], [0.33, 0.06], [0.42, 0.16], [0.46, 0.3], [0.45, 0.45], [0.4, 0.6], [0.31, 0.72], [0.18, 0.79], [0, 0.81]];

function makeProp(role, s, color) {
  const g = new THREE.Group();
  const M = (c, e = 0) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.45, emissive: e ? c : 0x000000, emissiveIntensity: e });
  const add = (geo, mat, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) => {
    const m = new THREE.Mesh(geo, mat); m.position.set(x * s, y * s, z * s); m.rotation.set(rx, ry, rz); m.castShadow = true; g.add(m); return m;
  };
  switch (role) {
    case 'Scout': // magnifying glass
      add(new THREE.TorusGeometry(0.13 * s, 0.03 * s, 8, 20), M(0x2b3440), 0, 0.22, 0.05);
      add(new THREE.CircleGeometry(0.12 * s, 20), new THREE.MeshStandardMaterial({ color: 0xbfe6ff, transparent: true, opacity: 0.6, emissive: 0x5fb4ff, emissiveIntensity: 0.4 }), 0, 0.22, 0.05);
      add(new THREE.CylinderGeometry(0.025 * s, 0.03 * s, 0.22 * s, 8), M(0x8a5a2b), 0, 0.03, 0.05);
      break;
    case 'Researcher': // a book
      add(new THREE.BoxGeometry(0.3 * s, 0.22 * s, 0.07 * s), M(0x2a6f9e), 0, 0.05, 0.08);
      add(new THREE.BoxGeometry(0.28 * s, 0.2 * s, 0.075 * s), M(0xfaf6ea), 0.012, 0.05, 0.08);
      break;
    case 'Reviewer': case 'Courier-ask': // clipboard
      add(new THREE.BoxGeometry(0.26 * s, 0.34 * s, 0.03 * s), M(0x8a5a2b), 0, 0.1, 0.1);
      add(new THREE.BoxGeometry(0.22 * s, 0.26 * s, 0.035 * s), M(0xffffff), 0, 0.08, 0.1);
      add(new THREE.BoxGeometry(0.1 * s, 0.04 * s, 0.04 * s), M(0xc0c6cc), 0, 0.27, 0.1);
      break;
    case 'Artist': // paintbrush
      add(new THREE.CylinderGeometry(0.022 * s, 0.03 * s, 0.38 * s, 8), M(0xc9a26b), 0, 0.12, 0.05, 0.5);
      add(new THREE.ConeGeometry(0.045 * s, 0.12 * s, 8), M(color, 0.6), 0, 0.33, 0.15, 0.5);
      break;
    case 'Producer':
      add(new THREE.BoxGeometry(0.28 * s, 0.18 * s, 0.16 * s), M(0x22262b), 0, 0.08, 0.08);
      add(new THREE.CylinderGeometry(0.06 * s, 0.06 * s, 0.1 * s, 12), M(0x111111), 0, 0.08, 0.2, Math.PI / 2);
      break;
    case 'Writer': // pencil
      add(new THREE.CylinderGeometry(0.03 * s, 0.03 * s, 0.34 * s, 6), M(0xf2c230), 0, 0.12, 0.05, 0.4);
      add(new THREE.ConeGeometry(0.03 * s, 0.08 * s, 6), M(0xe8cfa0), 0, 0.3, 0.12, 0.4);
      break;
    case 'Clerk': // folder
      add(new THREE.BoxGeometry(0.3 * s, 0.24 * s, 0.05 * s), M(0x8bd3c7), 0, 0.06, 0.08);
      break;
    case 'Keeper': // memory orb
      add(new THREE.SphereGeometry(0.13 * s, 16, 12), M(0x6be3bf, 1.2), 0, 0.18, 0.08);
      break;
    case 'Courier': // parcel
      add(new THREE.BoxGeometry(0.32 * s, 0.26 * s, 0.26 * s), M(0xc89b62), 0, 0.12, 0.12);
      add(new THREE.BoxGeometry(0.33 * s, 0.05 * s, 0.27 * s), M(0x7a5634), 0, 0.12, 0.12);
      break;
    case 'Operator': // wrench
      add(new THREE.BoxGeometry(0.05 * s, 0.32 * s, 0.04 * s), M(0x9aa5b1), 0, 0.12, 0.05);
      add(new THREE.TorusGeometry(0.06 * s, 0.025 * s, 6, 12, Math.PI * 1.5), M(0x9aa5b1), 0, 0.3, 0.05);
      break;
    case 'Planner': // little star wand
      add(new THREE.CylinderGeometry(0.02 * s, 0.02 * s, 0.3 * s, 6), M(0xd8b25a), 0, 0.1, 0.05);
      add(new THREE.OctahedronGeometry(0.1 * s), M(0xffe28a, 1), 0, 0.3, 0.05);
      break;
  }
  return g;
}

class Walker {
  constructor(city, { label, color = 0xffffff, size = 1, at, role = 'Operator' }) {
    size *= WS;
    const s = size;
    this.city = city; this.size = s; this.color = color; this.role = role;
    this.speed = 10 + Math.random() * 3;
    this.group = new THREE.Group();
    this.rig = new THREE.Group();
    this.group.add(this.rig);
    const env = city.envMap;
    const accent = new THREE.MeshPhysicalMaterial({ color, roughness: 0.3, metalness: 0.05, clearcoat: 0.8, clearcoatRoughness: 0.2, emissive: color, emissiveIntensity: 0.12 });
    const eyeCol = new THREE.Color(color).lerp(new THREE.Color(0xffffff), 0.45);
    const glow = new THREE.MeshBasicMaterial({ color: eyeCol, toneMapped: false });
    this.glowMat = glow;
    for (const m of [ROBOT.shell, ROBOT.visor, accent]) { if (env) { m.envMap = env; m.envMapIntensity = 0.9; } }
    const mesh = (geo, mat, x = 0, y = 0, z = 0, parent = this.rig) => {
      const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; parent.add(m); return m;
    };
    const H0 = 0.32 * s; // hover height
    this.H0 = H0;

    // soft contact shadow + hover ring (stay on the ground)
    this.shadow = new THREE.Mesh(new THREE.CircleGeometry(0.62 * s, 24),
      new THREE.MeshBasicMaterial({ map: ROBOT.shadowTex, transparent: true, depthWrite: false }));
    this.shadow.rotation.x = -Math.PI / 2; this.shadow.position.y = 0.07;
    this.group.add(this.shadow);
    this.halo = new THREE.Mesh(new THREE.RingGeometry(0.62 * s, 0.82 * s, 40),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.6, side: THREE.DoubleSide, depthWrite: false }));
    this.halo.rotation.x = -Math.PI / 2; this.halo.position.y = 0.08;
    this.group.add(this.halo);

    // body
    this.body = new THREE.Group(); this.body.position.y = H0; this.rig.add(this.body);
    const lathe = new THREE.LatheGeometry(BODY_PROFILE.map(([r, y]) => new THREE.Vector2(r * s, y * s)), 40);
    mesh(lathe, ROBOT.shell, 0, 0, 0, this.body);
    // hover thruster under the body
    this.thruster = mesh(new THREE.TorusGeometry(0.2 * s, 0.035 * s, 10, 32), new THREE.MeshBasicMaterial({ color: eyeCol, toneMapped: false }), 0, 0.02 * s, 0, this.body);
    this.thruster.rotation.x = Math.PI / 2;
    // colour band + collar
    const band = mesh(new THREE.TorusGeometry(0.455 * s, 0.03 * s, 10, 48), accent, 0, 0.36 * s, 0, this.body);
    band.rotation.x = Math.PI / 2;
    const collar = mesh(new THREE.TorusGeometry(0.2 * s, 0.045 * s, 10, 32), accent, 0, 0.8 * s, 0, this.body);
    collar.rotation.x = Math.PI / 2;
    // chest light
    this.chest = mesh(new THREE.CircleGeometry(0.07 * s, 24), glow, 0, 0.5 * s, 0.452 * s, this.body);
    mesh(new THREE.RingGeometry(0.075 * s, 0.1 * s, 24), accent, 0, 0.5 * s, 0.451 * s, this.body);

    // flipper arms
    this.arms = [-1, 1].map((side) => {
      const sh = new THREE.Group(); sh.position.set(side * 0.43 * s, 0.6 * s, 0.02 * s); this.body.add(sh);
      const arm = mesh(new THREE.SphereGeometry(0.11 * s, 20, 14), ROBOT.shell, 0, -0.2 * s, 0, sh);
      arm.scale.set(0.75, 2.3, 0.7);
      mesh(new THREE.SphereGeometry(0.075 * s, 16, 12), accent, 0, -0.42 * s, 0, sh);
      const hand = new THREE.Group(); hand.position.set(0, -0.44 * s, 0.04 * s); sh.add(hand);
      return { sh, hand, side };
    });
    this.arms[1].hand.add(makeProp(role, s, color));

    // head
    this.head = new THREE.Group(); this.head.position.set(0, H0 + 1.22 * s, 0); this.rig.add(this.head);
    mesh(new THREE.CylinderGeometry(0.11 * s, 0.13 * s, 0.14 * s, 20), ROBOT.joint, 0, -0.43 * s, 0, this.head);
    const HS = new THREE.Vector3(1.2, 0.92, 1.0), R = 0.5 * s;
    const shell = mesh(new THREE.SphereGeometry(R, 48, 32), ROBOT.shell, 0, 0, 0, this.head);
    shell.scale.copy(HS);
    // visor: a patch of a slightly larger sphere, so it hugs the head
    const visorGeo = new THREE.SphereGeometry(R * 1.012, 48, 32, Math.PI / 2 - 0.98, 1.96, Math.PI / 2 - 0.62, 1.12);
    const visor = mesh(visorGeo, ROBOT.visor, 0, 0, 0, this.head);
    visor.scale.copy(HS);
    // helper: a point on the visor surface, and the outward normal
    const onFace = (yaw, pitch, lift = 1.03) => {
      const phi = Math.PI / 2 - yaw, th = Math.PI / 2 - pitch;
      const p = new THREE.Vector3(-Math.cos(phi) * Math.sin(th), Math.cos(th), Math.sin(phi) * Math.sin(th));
      const n = new THREE.Vector3(p.x / HS.x, p.y / HS.y, p.z / HS.z).normalize();
      p.multiply(HS).multiplyScalar(R * lift);
      return { p, q: new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), n) };
    };
    const place = (m, yaw, pitch, lift) => { const { p, q } = onFace(yaw, pitch, lift); m.position.copy(p); m.quaternion.copy(q); this.head.add(m); return m; };
    // eyes: normal pill, happy arc
    this.eyeGroup = new THREE.Group(); this.head.add(this.eyeGroup);
    this.eyes = []; this.happyEyes = [];
    for (const side of [-1, 1]) {
      const e = new THREE.Mesh(new THREE.CapsuleGeometry(0.052 * s, 0.07 * s, 6, 14), glow);
      e.scale.z = 0.25;
      const holder = new THREE.Group(); place(holder, side * 0.33, 0.06, 1.035); this.eyeGroup.add(holder);
      holder.add(e); this.eyes.push(e);
      const hp = new THREE.Mesh(new THREE.TorusGeometry(0.065 * s, 0.022 * s, 8, 20, Math.PI), glow);
      hp.position.y = -0.02 * s; hp.visible = false; holder.add(hp); this.happyEyes.push(hp);
      const ck = new THREE.Mesh(new THREE.CircleGeometry(0.05 * s, 18), ROBOT.cheek); place(ck, side * 0.55, -0.2, 1.03);
    }
    this.mouth = new THREE.Mesh(new THREE.TorusGeometry(0.045 * s, 0.014 * s, 6, 16, Math.PI), glow);
    this.mouth.rotation.z = Math.PI;
    const mh = new THREE.Group(); place(mh, 0, -0.2, 1.035); mh.add(this.mouth);
    // ear pods
    for (const side of [-1, 1]) {
      const ear = mesh(new THREE.CylinderGeometry(0.14 * s, 0.14 * s, 0.1 * s, 28), ROBOT.shell, side * 0.6 * s, 0, 0, this.head);
      ear.rotation.z = Math.PI / 2;
      const inner = mesh(new THREE.CylinderGeometry(0.09 * s, 0.09 * s, 0.11 * s, 24), accent, side * 0.61 * s, 0, 0, this.head);
      inner.rotation.z = Math.PI / 2;
    }
    // antenna
    mesh(new THREE.CylinderGeometry(0.015 * s, 0.02 * s, 0.24 * s, 8), ROBOT.joint, 0.12 * s, 0.53 * s, -0.05 * s, this.head).rotation.z = -0.25;
    this.bulb = mesh(role === 'Planner' ? new THREE.OctahedronGeometry(0.09 * s) : new THREE.SphereGeometry(0.065 * s, 16, 12),
      new THREE.MeshBasicMaterial({ color: role === 'Planner' ? 0xffe28a : eyeCol, toneMapped: false }), 0.16 * s, 0.66 * s, -0.05 * s, this.head);

    // role hats & accessories
    if (role === 'Artist') {
      const beret = mesh(new THREE.SphereGeometry(0.36 * s, 24, 12, 0, TAU, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x2a2d33, roughness: 0.9 }), -0.05 * s, 0.36 * s, -0.02 * s, this.head);
      beret.scale.set(1.15, 0.35, 1.05); beret.rotation.z = 0.22;
      mesh(new THREE.CylinderGeometry(0.02 * s, 0.02 * s, 0.07 * s, 6), ROBOT.dark, -0.05 * s, 0.5 * s, 0, this.head);
    } else if (role === 'Courier' || role === 'Courier-ask') {
      const cap = mesh(new THREE.SphereGeometry(0.4 * s, 24, 12, 0, TAU, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x2b4f7a, roughness: 0.7 }), 0, 0.3 * s, -0.03 * s, this.head);
      cap.scale.set(1.2, 0.5, 1.1);
      const brim = mesh(new THREE.CylinderGeometry(0.22 * s, 0.22 * s, 0.025 * s, 20, 1, false, -Math.PI / 2, Math.PI), new THREE.MeshStandardMaterial({ color: 0x1f3b5c }), 0, 0.32 * s, 0.38 * s, this.head);
      brim.scale.z = 0.9;
    } else if (role === 'Researcher') {
      const pack = mesh(new THREE.BoxGeometry(0.46 * s, 0.46 * s, 0.2 * s), new THREE.MeshStandardMaterial({ color: 0x9a6a3a, roughness: 0.8 }), 0, 0.45 * s, -0.47 * s, this.body);
      pack.rotation.x = -0.12;
      mesh(new THREE.BoxGeometry(0.4 * s, 0.14 * s, 0.05 * s), new THREE.MeshStandardMaterial({ color: 0x7a5230 }), 0, 0.34 * s, -0.58 * s, this.body);
    } else if (role === 'Reviewer') {
      for (const side of [-1, 1]) {
        const lens = new THREE.Mesh(new THREE.TorusGeometry(0.1 * s, 0.016 * s, 8, 24), ROBOT.joint);
        place(lens, side * 0.33, 0.06, 1.07);
      }
    } else if (role === 'Planner') {
      for (const side of [-1, 1]) {
        const bow = mesh(new THREE.ConeGeometry(0.08 * s, 0.15 * s, 12), new THREE.MeshStandardMaterial({ color: 0xd23b3b, roughness: 0.6 }), side * 0.08 * s, 0.8 * s, 0.22 * s, this.body);
        bow.rotation.z = side * -Math.PI / 2;
      }
      mesh(new THREE.SphereGeometry(0.035 * s, 10, 8), new THREE.MeshStandardMaterial({ color: 0xa82a2a }), 0, 0.8 * s, 0.23 * s, this.body);
    } else if (role === 'Keeper') {
      const halo = mesh(new THREE.TorusGeometry(0.25 * s, 0.02 * s, 8, 32), new THREE.MeshBasicMaterial({ color: 0x9dffe0, toneMapped: false }), 0, 0.62 * s, 0, this.head);
      halo.rotation.x = Math.PI / 2;
    }

    this.el = document.createElement('div');
    this.el.className = 'walker-label';
    this.el.style.setProperty('--c', '#' + new THREE.Color(color).getHexString());
    this.el.innerHTML = `<span class="wl-status"></span><span class="wl-name"></span>`;
    this.el.querySelector('.wl-name').textContent = label;
    this.statusEl = this.el.querySelector('.wl-status');
    this.label = new CSS2DObject(this.el);
    this.label.position.set(0, H0 + 2.0 * s, 0);
    this.group.add(this.label);

    this.group.position.copy(at);
    this.group.scale.setScalar(0.01);
    this.appear = 0; this.path = []; this.resolve = null;
    this.t = Math.random() * 10; this.age = 0; this.working = false; this.fading = false;
    this.nextBlink = 1 + Math.random() * 3; this.happyUntil = 0; this.lean = 0;
    this.look = new THREE.Vector2();
    city.scene.add(this.group);
  }
  setStatus(text, kind = '') {
    this.statusEl.textContent = text || '';
    this.statusEl.className = 'wl-status ' + kind;
    this.el.classList.toggle('has-status', !!text);
    if (kind === 'ok') this.happyUntil = this.t + 1.8;
  }
  walkTo(points) {
    this.path = (Array.isArray(points) ? points : [points]).map((p) => p.clone());
    this.working = false;
    return new Promise((r) => { this.resolve = r; });
  }
  update(dt) {
    this.t += dt; this.age += dt;
    const t = this.t, s = this.size;
    if (this.appear < 1 && !this.fading) {
      this.appear = Math.min(1, this.appear + dt * 2.4);
      const k = this.appear, pop = 1 + Math.sin(k * Math.PI) * 0.22;
      this.group.scale.setScalar(Math.max(0.01, k * pop));
    }
    if (this.fading) {
      this.appear -= dt * 2.5;
      this.group.scale.setScalar(Math.max(0.01, this.appear));
      this.el.style.opacity = Math.max(0, this.appear);
      if (this.appear <= 0) this.city._removeWalker(this);
      return;
    }
    const happy = t < this.happyUntil;
    // eyes: blink, happy arcs, focused squint
    this.nextBlink -= dt;
    let eyeY = 1;
    if (this.nextBlink < 0.13 && this.nextBlink > 0) eyeY = 0.12;
    if (this.nextBlink < 0) this.nextBlink = 2.2 + Math.random() * 3;
    if (this.working) eyeY *= 0.62;
    for (let i = 0; i < 2; i++) {
      this.eyes[i].visible = !happy; this.happyEyes[i].visible = happy;
      this.eyes[i].scale.y += (eyeY - this.eyes[i].scale.y) * Math.min(1, dt * 30);
    }
    this.mouth.scale.setScalar(happy ? 1.5 : 1);

    const pos = this.group.position;
    const [aL, aR] = this.arms;
    let moving = false;
    if (this.path.length) {
      moving = true;
      const target = this.path[0];
      const dx = target.x - pos.x, dz = target.z - pos.z;
      const dist = Math.hypot(dx, dz), step = this.speed * dt;
      if (dist <= step) {
        pos.x = target.x; pos.z = target.z; this.path.shift();
        if (!this.path.length && this.resolve) { const r = this.resolve; this.resolve = null; r(); }
      } else {
        pos.x += (dx / dist) * step; pos.z += (dz / dist) * step;
        const ang = Math.atan2(dx, dz);
        const diff = ((((ang - this.group.rotation.y) % TAU) + 3 * Math.PI) % TAU) - Math.PI;
        this.group.rotation.y += diff * Math.min(1, dt * 8);
        this.rig.rotation.z += (-diff * 0.25 - this.rig.rotation.z) * Math.min(1, dt * 6); // bank into turns
      }
    }
    this.lean += ((moving ? 0.2 : 0) - this.lean) * Math.min(1, dt * 5);
    this.rig.rotation.x = this.lean;
    if (!moving) this.rig.rotation.z *= 0.9;

    // hover bob
    const bob = Math.sin(t * (moving ? 7 : 2.4)) * (moving ? 0.05 : 0.07) * s + (happy ? Math.abs(Math.sin(t * 9)) * 0.25 * s : 0);
    this.rig.position.y = bob;
    this.shadow.scale.setScalar(1 - bob / s * 0.8);
    this.thruster.material.color.setScalar(1);

    if (this.age < 1.3 && !this.working) {
      // say hello: wave on arrival in the world
      aR.sh.rotation.set(0, 0, 2.3 + Math.sin(t * 14) * 0.35);
      aL.sh.rotation.set(0, 0, -0.15);
    } else if (this.working) {
      aR.sh.rotation.set(-1.5 + Math.sin(t * 10) * 0.5, 0, 0.15);
      aL.sh.rotation.set(-0.5 + Math.sin(t * 10 + 1.2) * 0.25, 0, -0.25);
      this.head.rotation.set(0.18 + Math.sin(t * 10) * 0.05, Math.sin(t * 1.2) * 0.25, 0);
      this.group.rotation.y += Math.sin(t * 0.7) * dt * 0.5;
      this.bulb.scale.setScalar(Math.sin(t * 14) > 0 ? 1.35 : 0.8);
      this.chest.scale.setScalar(1 + Math.sin(t * 8) * 0.35);
    } else if (moving) {
      aR.sh.rotation.set(Math.sin(t * 7) * 0.35 - 0.2, 0, 0.18);
      aL.sh.rotation.set(-Math.sin(t * 7) * 0.35 - 0.2, 0, -0.18);
      this.head.rotation.set(-0.12, 0, 0);
    } else {
      aR.sh.rotation.set(Math.sin(t * 1.4) * 0.08 - 0.3, 0, 0.12 + (happy ? 1.8 + Math.sin(t * 12) * 0.3 : 0));
      aL.sh.rotation.set(Math.sin(t * 1.4 + 1) * 0.08, 0, -0.12 - (happy ? 1.8 + Math.sin(t * 12) * 0.3 : 0));
      this.head.rotation.set(Math.sin(t * 0.9) * 0.06, Math.sin(t * 0.55) * 0.45, Math.sin(t * 0.7) * 0.08);
    }
    if (!this.working) { this.bulb.scale.setScalar(1 + Math.sin(t * 3) * 0.15); this.chest.scale.setScalar(1); }
    // eyes glance around a little
    this.eyeGroup.position.x = Math.sin(t * 0.8) * 0.015 * s;
    this.eyeGroup.position.y = Math.sin(t * 0.5) * 0.01 * s;
    this.thruster.scale.setScalar(1 + Math.sin(t * 20) * 0.06);
    this.halo.material.opacity = 0.4 + Math.sin(t * 4) * 0.2;
  }
  fade() { this.fading = true; this.setStatus(''); }
}

// ------------------------------------------------------------------ the city
export class City {
  constructor(container) {
    this.container = container;
    this.walkers = new Set();
    this.packets = new Set();
    this.buildings = {};
    this.deskItems = 0;
    this.clock = new THREE.Clock();
    this.director = true;
    this.userUntil = 0;
    this.anim = []; // per-frame callbacks for ambient life

    const w = container.clientWidth, h = container.clientHeight;
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(LITE ? 1 : Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(w, h);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    container.appendChild(this.renderer.domElement);

    this.labels = new CSS2DRenderer();
    this.labels.setSize(w, h);
    this.labels.domElement.className = 'label-layer';
    container.appendChild(this.labels.domElement);

    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.Fog(0xe2b592, 140, 420);

    this.camera = new THREE.PerspectiveCamera(40, w / h, 0.5, 1200);
    this.camera.position.set(38, 78, 112);

    this.controls = new OrbitControls(this.camera, this.labels.domElement);
    this.controls.enableDamping = true;
    this.controls.maxPolarAngle = Math.PI * 0.45;
    this.controls.minDistance = 25;
    this.controls.maxDistance = 260;
    this.controls.target.set(0, 4, 4);
    this.controls.addEventListener('start', () => { this.userUntil = performance.now() + 9000; });
    this.view = { target: V(0, 4, 4), dist: 138 };

    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(w, h), 0.55, 0.6, 0.82);
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());

    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.envMap = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this._materials();
    this._sky();
    this._ground();
    this._seine();
    this._tower();
    for (const key of Object.keys(BUILDINGS)) this._landmark(key);
    this._blocks();
    this._trees();
    this._lamps();

    this.planner = new Walker(this, { label: 'City Planner', color: 0x6be3bf, size: 1.5, at: V(0, 0, 4), role: 'Planner' });
    this.setTime('golden');

    window.addEventListener('resize', () => this.resize());
    this.renderer.setAnimationLoop(() => this._tick());
  }

  /** Shift the picture left so the city is centred in the space beside the side panel. */
  setShift(px) { this.shiftX = px; this.resize(); }

  resize() {
    const w = this.container.clientWidth, h = this.container.clientHeight;
    this.camera.aspect = w / h;
    if (this.shiftX) this.camera.setViewOffset(w, h, this.shiftX, 0, w, h); else this.camera.clearViewOffset();
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h); this.labels.setSize(w, h);
    this.composer.setSize(w, h); this.bloom.setSize(w, h);
  }

  // ------------------------------------------------------------ materials
  _materials() {
    const f = facadeTextures(11);
    this.M = {
      facade: new THREE.MeshStandardMaterial({ map: f.map, emissiveMap: f.emap, emissive: 0xffffff, emissiveIntensity: 0.5, roughness: 0.85 }),
      stone: new THREE.MeshStandardMaterial({ color: 0xe8dec9, roughness: 0.82 }),
      stoneDark: new THREE.MeshStandardMaterial({ color: 0xcdbfa4, roughness: 0.9 }),
      zinc: new THREE.MeshStandardMaterial({ color: 0x8c97a3, roughness: 0.5, metalness: 0.2 }),
      gold: new THREE.MeshStandardMaterial({ color: 0xd8b25a, roughness: 0.3, metalness: 0.85, emissive: 0x6a4a10, emissiveIntensity: 0.4 }),
      glass: new THREE.MeshStandardMaterial({ color: 0xa9d2ea, roughness: 0.05, metalness: 0.2, transparent: true, opacity: 0.6, emissive: 0xffd9a0, emissiveIntensity: 0.2 }),
      white: new THREE.MeshStandardMaterial({ color: 0xf5f1e8, roughness: 0.6 }),
      iron: new THREE.MeshStandardMaterial({ color: 0x23282c, roughness: 0.6, metalness: 0.4 }),
      lampHead: new THREE.MeshStandardMaterial({ color: 0xfff0d0, emissive: 0xffc070, emissiveIntensity: 1 }),
      terracotta: new THREE.MeshStandardMaterial({ color: 0xb4674a, roughness: 0.9 }),
      grass: new THREE.MeshStandardMaterial({ color: 0x6f9a4c, roughness: 1 }),
      gravel: new THREE.MeshStandardMaterial({ color: 0xd9ccb0, roughness: 1 }),
    };
  }

  // ------------------------------------------------------------ sky + light
  _sky() {
    this.skyMat = skyMaterial();
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(900, 32, 16), this.skyMat);
    this.scene.add(this.sky);
    this.hemi = new THREE.HemisphereLight(0xffe0bf, 0x5b4a3a, 0.9);
    this.scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight(0xffc98f, 2.6);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(LITE ? 1024 : 4096, LITE ? 1024 : 4096);
    Object.assign(this.sun.shadow.camera, { left: -130, right: 130, top: 130, bottom: -130, near: 1, far: 400 });
    this.sun.shadow.bias = -0.0004;
    this.sun.shadow.normalBias = 0.6;
    this.scene.add(this.sun, this.sun.target);
    this.hqLight = new THREE.PointLight(0x6be3bf, 0, 60, 1.4);
    this.hqLight.position.set(0, 18, 0);
    this.scene.add(this.hqLight);
    // stars for the night
    const n = 900, pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * TAU, el = 0.08 + Math.random() * 1.4;
      pos.set([Math.cos(a) * Math.cos(el) * 800, Math.sin(el) * 800, Math.sin(a) * Math.cos(el) * 800], i * 3);
    }
    const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.stars = new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xffffff, size: 1.6, sizeAttenuation: false, fog: false, transparent: true, opacity: 0.8 }));
    this.scene.add(this.stars);
  }

  setTime(mode) {
    const T = TIMES[mode] || TIMES.golden;
    this.time = mode;
    const u = this.skyMat.uniforms;
    u.top.value.set(T.top); u.horizon.value.set(T.horizon); u.bottom.value.set(T.bottom);
    u.sunColor.value.set(T.sun); u.sunSize.value = T.sunSize;
    const sp = V(...T.sunPos);
    u.sunDir.value.copy(sp).normalize();
    this.scene.fog.color.set(T.fog); this.scene.fog.near = T.fogNear; this.scene.fog.far = T.fogFar;
    this.sun.color.set(T.sun); this.sun.intensity = T.sunI; this.sun.position.copy(sp);
    this.hemi.color.set(T.hemiSky); this.hemi.groundColor.set(T.hemiGround); this.hemi.intensity = T.hemiI;
    this.M.facade.emissiveIntensity = T.windows;
    for (const b of Object.values(this.buildings)) if (b.facade) b.facade.emissiveIntensity = T.windows;
    this.M.lampHead.emissiveIntensity = T.lamps;
    this.M.glass.emissiveIntensity = T.windows * 0.6;
    this.towerMat.emissiveIntensity = T.tower;
    this.towerBase = T.tower;
    this.sparkle.visible = T.sparkle;
    this.beams.visible = mode === 'night';
    this.stars.visible = mode === 'night';
    this.waterMat.emissive.set(T.water);
    this.bloom.strength = T.bloom;
    this.renderer.toneMappingExposure = T.exposure;
    return T.label;
  }

  // ------------------------------------------------------------ ground, avenues
  _plane(w, d, mat, x, z, rotY = 0, y = 0.02) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), mat);
    m.rotation.order = 'YXZ'; m.rotation.y = rotY; m.rotation.x = -Math.PI / 2;
    m.position.set(x, y, z); m.receiveShadow = true;
    this.scene.add(m);
    return m;
  }

  _ground() {
    const pave = new THREE.MeshStandardMaterial({ color: 0xb9ab90, roughness: 1 });
    const ground = new THREE.Mesh(new THREE.CircleGeometry(700, 64), pave);
    ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true;
    this.scene.add(ground);

    // roundabout (asphalt) + gardens around the tower
    const asphalt = new THREE.MeshStandardMaterial({ color: 0x86827a, roughness: 0.95 });
    const road = new THREE.Mesh(new THREE.RingGeometry(PLAZA_R, ROAD_R, 96), asphalt);
    road.rotation.x = -Math.PI / 2; road.position.y = 0.03; road.receiveShadow = true;
    this.scene.add(road);
    const lane = new THREE.Mesh(new THREE.RingGeometry((PLAZA_R + ROAD_R) / 2 - 0.12, (PLAZA_R + ROAD_R) / 2 + 0.12, 96),
      new THREE.MeshBasicMaterial({ color: 0xf2ead8, transparent: true, opacity: 0.5 }));
    lane.rotation.x = -Math.PI / 2; lane.position.y = 0.05; this.scene.add(lane);
    const garden = new THREE.Mesh(new THREE.CircleGeometry(PLAZA_R, 96), this.M.grass);
    garden.rotation.x = -Math.PI / 2; garden.position.y = 0.04; garden.receiveShadow = true;
    this.scene.add(garden);
    const gravelRing = new THREE.Mesh(new THREE.RingGeometry(ARC_R - 1.6, ARC_R + 1.6, 96), this.M.gravel);
    gravelRing.rotation.x = -Math.PI / 2; gravelRing.position.y = 0.06; gravelRing.receiveShadow = true;
    this.scene.add(gravelRing);
    const inner = new THREE.Mesh(new THREE.CircleGeometry(SPAWN_R - 1, 64), this.M.gravel);
    inner.rotation.x = -Math.PI / 2; inner.position.y = 0.06; inner.receiveShadow = true;
    this.scene.add(inner);
    // hedges on the garden edge
    const hedgeMat = new THREE.MeshStandardMaterial({ color: 0x3f6b37, roughness: 1 });
    for (let i = 0; i < 8; i++) {
      const a0 = THREE.MathUtils.degToRad(i * 45 + 9), a1 = THREE.MathUtils.degToRad(i * 45 + 36);
      const geo = new THREE.TorusGeometry(PLAZA_R - 0.9, 0.45, 6, 24, a1 - a0);
      const hedge = new THREE.Mesh(geo, hedgeMat);
      hedge.rotation.x = -Math.PI / 2; hedge.rotation.z = a0; hedge.position.y = 0.4; hedge.scale.z = 1.4;
      hedge.castShadow = true; this.scene.add(hedge);
    }
    // avenues: pale stone boulevards radiating from the star
    const aveMat = new THREE.MeshStandardMaterial({ color: 0xcfc2a6, roughness: 1 });
    const sideMat = new THREE.MeshStandardMaterial({ color: 0xd9cdb3, roughness: 1 });
    for (const b of Object.values(BUILDINGS)) {
      const a = THREE.MathUtils.degToRad(b.angle);
      const len = 300, mid = ROAD_R - 1 + len / 2;
      const rot = -a + Math.PI / 2;
      this._plane(7, len, aveMat, Math.cos(a) * mid, Math.sin(a) * mid, rot, 0.035);
      this._plane(13, len, sideMat, Math.cos(a) * mid, Math.sin(a) * mid, rot, 0.025);
    }
  }

  // ------------------------------------------------------------ the Seine
  _seine() {
    const curve = new THREE.CatmullRomCurve3([
      V(-260, 0, -40), V(-170, 0, -58), V(-100, 0, -62), V(-50, 0, -76), V(0, 0, -84),
      V(55, 0, -76), V(110, 0, -58), V(180, 0, -66), V(260, 0, -48)]);
    this.seine = curve;
    const N = 260;
    this.seinePts = curve.getSpacedPoints(N);
    const ribbon = (inner, outer, y, mat) => {
      const pos = [], idx = [];
      for (let i = 0; i <= N; i++) {
        const p = this.seinePts[i], t = curve.getTangentAt(i / N);
        const n = V(-t.z, 0, t.x).normalize();
        for (const s of [-1, 1]) {
          pos.push(p.x + n.x * inner * s, y, p.z + n.z * inner * s, p.x + n.x * outer * s, y, p.z + n.z * outer * s);
        }
        if (i < N) {
          for (const k of [0, 2]) {
            const a = i * 4 + k, b = a + 1, c = a + 4, d = a + 5;
            idx.push(a, c, b, b, c, d);
          }
        }
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.setIndex(idx); g.computeVertexNormals();
      const m = new THREE.Mesh(g, mat);
      m.receiveShadow = true;
      // make sure normals point up
      g.getAttribute('normal').array.forEach((_, i, arr) => { if (i % 3 === 1) arr[i] = 1; else arr[i] = 0; });
      m.material.side = THREE.DoubleSide;
      this.scene.add(m);
      return m;
    };
    const waterTex = (() => {
      const c = document.createElement('canvas'); c.width = 256; c.height = 256;
      const g = c.getContext('2d');
      g.fillStyle = '#4f7f93'; g.fillRect(0, 0, 256, 256);
      for (let i = 0; i < 260; i++) {
        g.fillStyle = `rgba(255,240,220,${Math.random() * 0.22})`;
        g.fillRect(Math.random() * 256, Math.random() * 256, 8 + Math.random() * 26, 1.2);
      }
      const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(6, 6);
      t.colorSpace = THREE.SRGBColorSpace;
      return t;
    })();
    this.waterTex = waterTex;
    this.waterMat = new THREE.MeshStandardMaterial({ map: waterTex, color: 0xffffff, roughness: 0.12, metalness: 0.35, emissive: 0x2a4a5c, emissiveIntensity: 0.6 });
    const water = ribbon(0, 9, 0.05, this.waterMat);
    // planar UVs so the ripples look continuous
    const p = water.geometry.getAttribute('position');
    const uv = new Float32Array(p.count * 2);
    for (let i = 0; i < p.count; i++) { uv[i * 2] = p.getX(i) / 40; uv[i * 2 + 1] = p.getZ(i) / 40; }
    water.geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    ribbon(9, 11.5, 0.07, new THREE.MeshStandardMaterial({ color: 0xc9b998, roughness: 1 }));       // quays
    ribbon(11.5, 12.2, 0.6, new THREE.MeshStandardMaterial({ color: 0xa8977a, roughness: 1 }));     // parapet top

    // stone bridges
    const deckMat = this.M.stoneDark;
    for (const t of [0.22, 0.42, 0.6, 0.8]) {
      const pnt = curve.getPointAt(t), tan = curve.getTangentAt(t);
      const n = V(-tan.z, 0, tan.x).normalize();
      const g = new THREE.Group();
      g.position.copy(pnt);
      g.rotation.y = Math.atan2(n.x, n.z);
      const deck = new THREE.Mesh(new THREE.BoxGeometry(7, 1, 25), deckMat);
      deck.position.y = 2.2; deck.castShadow = true; deck.receiveShadow = true;
      g.add(deck);
      for (const z of [-5.5, 0, 5.5]) {
        const arch = new THREE.Mesh(new THREE.TorusGeometry(2.6, 0.55, 8, 20, Math.PI), deckMat);
        arch.rotation.y = Math.PI / 2; arch.position.set(-3.2, 0, z); arch.scale.y = 0.75;
        const arch2 = arch.clone(); arch2.position.x = 3.2;
        g.add(arch, arch2);
      }
      for (const z of [-8.3, -2.7, 2.7, 8.3]) {
        const pier = new THREE.Mesh(new THREE.BoxGeometry(7.4, 2, 1.2), deckMat);
        pier.position.set(0, 1, z); g.add(pier);
      }
      for (const x of [-3.3, 3.3]) {
        const rail = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.8, 25), this.M.stone);
        rail.position.set(x, 3.1, 0); g.add(rail);
        for (const z of [-11, -5.5, 0, 5.5, 11]) {
          const lp = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 3, 6), this.M.iron);
          lp.position.set(x, 4.2, z);
          const lh = new THREE.Mesh(new THREE.SphereGeometry(0.32, 10, 8), this.M.lampHead);
          lh.position.set(x, 5.8, z);
          g.add(lp, lh);
        }
      }
      this.scene.add(g);
    }
    // bateaux-mouches
    for (let i = 0; i < 3; i++) {
      const boat = new THREE.Group();
      const hull = new THREE.Mesh(new THREE.BoxGeometry(2.6, 1, 10), this.M.white);
      hull.position.y = 0.5; hull.castShadow = true;
      const cabin = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.9, 7.5), this.M.glass);
      cabin.position.y = 1.45;
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(2.65, 0.25, 10.05), new THREE.MeshStandardMaterial({ color: 0x2b4f7a }));
      stripe.position.y = 0.6;
      boat.add(hull, cabin, stripe);
      const state = { t: 0.1 + i * 0.3, dir: i % 2 ? 1 : -1, off: i % 2 ? 3.5 : -3.5 };
      this.scene.add(boat);
      this.anim.push((dt) => {
        state.t = (state.t + state.dir * dt * 0.006 + 1) % 1;
        const p = curve.getPointAt(state.t), tg = curve.getTangentAt(state.t);
        const n = V(-tg.z, 0, tg.x).normalize();
        boat.position.set(p.x + n.x * state.off, 0.1, p.z + n.z * state.off);
        boat.rotation.y = Math.atan2(tg.x, tg.z) + (state.dir < 0 ? Math.PI : 0);
      });
    }
  }

  distToSeine(x, z) {
    let best = Infinity;
    for (const p of this.seinePts) { const d = (p.x - x) ** 2 + (p.z - z) ** 2; if (d < best) best = d; }
    return Math.sqrt(best);
  }

  // ------------------------------------------------------------ Eiffel Tower (Planner HQ)
  _tower() {
    const g = new THREE.Group();
    this.towerMat = new THREE.MeshStandardMaterial({ color: 0x5e4a3a, roughness: 0.6, metalness: 0.35, emissive: 0xffa94d, emissiveIntensity: 0.25 });
    const legPts = (sx, sz) => new THREE.CatmullRomCurve3([
      V(sx * 7.2, 0, sz * 7.2), V(sx * 5.2, 6, sz * 5.2), V(sx * 3.6, 12, sz * 3.6), V(sx * 2.3, 20, sz * 2.3),
      V(sx * 1.3, 30, sz * 1.3), V(sx * 0.6, 40, sz * 0.6), V(sx * 0.25, 48, sz * 0.25)]);
    const corners = [[1, 1], [-1, 1], [-1, -1], [1, -1]];
    const legs = corners.map(([sx, sz]) => legPts(sx, sz));
    for (const curve of legs) {
      const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, 48, 0.55, 6, false), this.towerMat);
      tube.castShadow = true; g.add(tube);
      // second, inner chord of each leg for a lattice look
      const inner = new THREE.CatmullRomCurve3(curve.points.map((p, i) => p.clone().multiplyScalar(i < 5 ? 0.82 : 0.9)));
      const t2 = new THREE.Mesh(new THREE.TubeGeometry(inner, 48, 0.3, 5, false), this.towerMat);
      t2.castShadow = true; g.add(t2);
    }
    // cross bracing between neighbouring legs
    const brace = [];
    for (let k = 0; k < 4; k++) {
      const A = legs[k], B = legs[(k + 1) % 4];
      for (let i = 0; i < 26; i++) {
        const t0 = i / 26 * 0.93, t1 = (i + 1) / 26 * 0.93;
        const a0 = A.getPointAt(t0), b1 = B.getPointAt(t1), b0 = B.getPointAt(t0), a1 = A.getPointAt(t1);
        brace.push(a0, b1, b0, a1);
      }
    }
    const lg = new THREE.BufferGeometry().setFromPoints(brace);
    g.add(new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ color: 0x5a412b, transparent: true, opacity: 0.9 })));
    // platforms
    for (const [y, s, hgt] of [[11.5, 10.2, 1.4], [23, 5.6, 1.0], [36, 2.8, 0.8]]) {
      const pf = new THREE.Mesh(new THREE.BoxGeometry(s, hgt, s), this.towerMat);
      pf.position.y = y; pf.castShadow = true; g.add(pf);
      const rim = new THREE.Mesh(new THREE.BoxGeometry(s + 0.6, 0.25, s + 0.6), this.M.gold);
      rim.position.y = y + hgt / 2; g.add(rim);
    }
    // arches between the legs at the base
    for (let k = 0; k < 4; k++) {
      const arch = new THREE.Mesh(new THREE.TorusGeometry(5, 0.4, 6, 24, Math.PI), this.towerMat);
      arch.rotation.y = k * Math.PI / 2;
      const a = k * Math.PI / 2;
      arch.position.set(Math.sin(a) * 6.3, 4.6, Math.cos(a) * 6.3);
      arch.scale.y = 1.1;
      g.add(arch);
    }
    // spire + beacon
    const spire = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.35, 8, 6), this.towerMat);
    spire.position.y = 52; g.add(spire);
    this.beacon = new THREE.Mesh(new THREE.SphereGeometry(0.7, 16, 12), new THREE.MeshBasicMaterial({ color: 0xfff1c9 }));
    this.beacon.position.y = 48.5; g.add(this.beacon);
    // rotating searchlight beams (night)
    this.beams = new THREE.Group();
    const beamMat = new THREE.MeshBasicMaterial({ color: 0xfff1c9, transparent: true, opacity: 0.12, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
    for (const s of [1, -1]) {
      const beam = new THREE.Mesh(new THREE.ConeGeometry(3.5, 120, 16, 1, true), beamMat);
      beam.rotation.z = s * Math.PI / 2; beam.position.x = s * 60;
      this.beams.add(beam);
    }
    this.beams.position.y = 48.5; g.add(this.beams);
    // sparkle lights (night)
    const sp = [];
    for (let i = 0; i < 700; i++) {
      const leg = legs[i % 4], t = Math.random() * 0.98, p = leg.getPointAt(t);
      sp.push(p.x + (Math.random() - 0.5) * 0.8, p.y, p.z + (Math.random() - 0.5) * 0.8);
    }
    const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3));
    this.sparkle = new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xffffff, size: 0.55, transparent: true, opacity: 1, depthWrite: false }));
    g.add(this.sparkle);
    // mint Cominty ring that spins when the Planner is thinking
    this.hqRing = new THREE.Mesh(new THREE.TorusGeometry(9.5, 0.18, 8, 96),
      new THREE.MeshBasicMaterial({ color: 0x6be3bf, transparent: true, opacity: 0.85 }));
    this.hqRing.rotation.x = Math.PI / 2; this.hqRing.position.y = 16;
    g.add(this.hqRing);
    this.scene.add(g);
    const el = document.createElement('div');
    el.className = 'bsign hq';
    el.innerHTML = `<span class="bs-icon">⭐</span><span class="bs-text"><b>Planner HQ</b><small>Tour Eiffel</small><i>Cominty managed agent</i></span>`;
    const sign = new CSS2DObject(el); sign.position.set(0, 60, 0); g.add(sign);
  }

  // ------------------------------------------------------------ landmarks
  _box(g, w, h, d, mat, x = 0, y = 0, z = 0) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y + h / 2, z); m.castShadow = true; m.receiveShadow = true;
    g.add(m); return m;
  }
  _mansard(g, w, h, d, x = 0, y = 0, z = 0, mat = this.M.zinc) {
    const geo = new THREE.CylinderGeometry(0.5, 0.7071, 1, 4, 1); geo.rotateY(Math.PI / 4);
    const m = new THREE.Mesh(geo, mat);
    m.scale.set(w, h, d); m.position.set(x, y + h / 2, z); m.castShadow = true;
    g.add(m); return m;
  }
  _facadeMat(seed, opts) {
    const f = facadeTextures(seed, opts);
    return new THREE.MeshStandardMaterial({ map: f.map, emissiveMap: f.emap, emissive: 0xffffff, emissiveIntensity: 0.5, roughness: 0.85 });
  }

  _build(kind, accent) {
    const g = new THREE.Group();
    const M = this.M;
    let height = 10, depth = 12, facade = null;
    switch (kind) {
      case 'pantheon': {
        this._box(g, 16, 1.2, 14, M.stoneDark, 0, 0, 0);
        this._box(g, 14, 9, 11, M.stone, 0, 1.2, -1);
        for (let i = 0; i < 6; i++) {
          const c = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.48, 8, 12), M.stone);
          c.position.set(-5 + i * 2, 5.2, 5.6); c.castShadow = true; g.add(c);
        }
        const tri = new THREE.Shape(); tri.moveTo(-6.2, 0); tri.lineTo(0, 2.6); tri.lineTo(6.2, 0); tri.lineTo(-6.2, 0);
        const ped = new THREE.Mesh(new THREE.ExtrudeGeometry(tri, { depth: 3, bevelEnabled: false }), M.stone);
        ped.position.set(0, 9.6, 3.6); ped.castShadow = true; g.add(ped);
        this._box(g, 12.6, 0.6, 3.4, M.stone, 0, 9.2, 4.4);
        const drum = new THREE.Mesh(new THREE.CylinderGeometry(4, 4.2, 5, 24), M.stone);
        drum.position.set(0, 12.7, -1.5); drum.castShadow = true; g.add(drum);
        for (let i = 0; i < 16; i++) {
          const a = i / 16 * TAU, c = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 4.4, 8), M.white);
          c.position.set(Math.cos(a) * 4.5, 12.6, -1.5 + Math.sin(a) * 4.5); g.add(c);
        }
        const dome = new THREE.Mesh(new THREE.SphereGeometry(4.1, 28, 14, 0, TAU, 0, Math.PI / 2), M.zinc);
        dome.position.set(0, 15.2, -1.5); dome.scale.y = 1.25; dome.castShadow = true; g.add(dome);
        const lantern = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.8, 1.8, 12), M.stone);
        lantern.position.set(0, 21, -1.5); g.add(lantern);
        const cross = new THREE.Mesh(new THREE.SphereGeometry(0.5, 12, 8), M.gold); cross.position.set(0, 22.3, -1.5); g.add(cross);
        height = 23; depth = 14;
        break;
      }
      case 'louvre': {
        facade = this._facadeMat(31, { floors: 3, cols: 6, tint: '#efe4cc' });
        this._box(g, 26, 8, 5, facade, 0, 0, -6);
        this._mansard(g, 26, 3, 5, 0, 8, -6);
        for (const s of [-1, 1]) {
          this._box(g, 5, 8, 14, facade, s * 10.5, 0, 0.5);
          this._mansard(g, 5, 3, 14, s * 10.5, 8, 0.5);
          this._box(g, 6, 11, 6, M.stone, s * 10.5, 0, -6);
          this._mansard(g, 6.2, 4.5, 6.2, s * 10.5, 11, -6);
        }
        const pyr = new THREE.Mesh(new THREE.ConeGeometry(4.6, 5.5, 4, 1), M.glass);
        pyr.rotation.y = Math.PI / 4; pyr.position.set(0, 2.75, 1.5); g.add(pyr);
        const frame = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.ConeGeometry(4.6, 5.5, 4, 3)), new THREE.LineBasicMaterial({ color: 0x31404a }));
        frame.rotation.y = Math.PI / 4; frame.position.copy(pyr.position); g.add(frame);
        const pool = new THREE.Mesh(new THREE.BoxGeometry(14, 0.2, 2.2), this.waterMat);
        pool.position.set(0, 0.1, 6); g.add(pool);
        height = 16; depth = 16;
        break;
      }
      case 'arc': {
        this._box(g, 15, 1, 8, M.stoneDark, 0, 0, 0);
        for (const s of [-1, 1]) this._box(g, 4.4, 11, 6, M.stone, s * 4.6, 1, 0);
        this._box(g, 13.6, 4.2, 6.4, M.stone, 0, 12, 0);
        this._box(g, 14, 0.6, 6.8, M.stoneDark, 0, 11.6, 0);
        this._box(g, 14.2, 0.8, 7, M.stoneDark, 0, 16.2, 0);
        const arch = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 2.4, 6.05, 24, 1, false, 0, Math.PI), M.stone);
        arch.rotation.z = Math.PI / 2; arch.rotation.y = Math.PI / 2; arch.position.set(0, 9.6, 0);
        // the arch's underside is open: fill the top with a half disc
        g.add(arch);
        for (const s of [-1, 1]) for (const z of [-3.05, 3.05]) {
          const relief = new THREE.Mesh(new THREE.BoxGeometry(2.6, 3.6, 0.2), M.stoneDark);
          relief.position.set(s * 4.6, 5, z); g.add(relief);
        }
        // eternal flame — the city's memory
        this.flame = new THREE.Mesh(new THREE.ConeGeometry(0.35, 1.2, 10), new THREE.MeshBasicMaterial({ color: 0xffb347 }));
        this.flame.position.set(0, 1.7, 0); g.add(this.flame);
        const fl = new THREE.PointLight(0xffa040, 8, 12, 2); fl.position.set(0, 2.5, 0); g.add(fl);
        height = 18; depth = 8;
        break;
      }
      case 'hdv': {
        facade = this._facadeMat(47, { floors: 3, cols: 7, tint: '#efe6d2' });
        this._box(g, 22, 9, 8, facade, 0, 0, 0);
        this._mansard(g, 22, 3.2, 8, 0, 9, 0);
        for (const s of [-1, 1]) {
          this._box(g, 5, 11, 9, M.stone, s * 9.5, 0, 0.3);
          const r = new THREE.Mesh(new THREE.ConeGeometry(4.2, 6, 4), M.zinc);
          r.rotation.y = Math.PI / 4; r.position.set(s * 9.5, 14, 0.3); r.castShadow = true; g.add(r);
        }
        this._box(g, 4.6, 7, 4.6, M.stone, 0, 9, 0.5);
        const cr = new THREE.Mesh(new THREE.ConeGeometry(3.4, 6, 4), M.zinc);
        cr.rotation.y = Math.PI / 4; cr.position.set(0, 19, 0.5); cr.castShadow = true; g.add(cr);
        const clock = new THREE.Mesh(new THREE.CircleGeometry(1.1, 24), new THREE.MeshStandardMaterial({ color: 0xfff7e0, emissive: 0xffe2a8, emissiveIntensity: 0.6 }));
        clock.position.set(0, 13.5, 2.85); g.add(clock);
        // French flags
        for (const s of [-1, 1]) {
          const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 3.5, 6), M.iron);
          pole.position.set(s * 3, 14, 4.2); g.add(pole);
          ['#1f3f8f', '#ffffff', '#d0313d'].forEach((col, i) => {
            const st = new THREE.Mesh(new THREE.BoxGeometry(0.6, 1.1, 0.05), new THREE.MeshStandardMaterial({ color: col }));
            st.position.set(s * 3 + 0.35 + i * 0.6, 15, 4.2); g.add(st);
          });
        }
        height = 22; depth = 10;
        break;
      }
      case 'sacre': {
        const hill = new THREE.Mesh(new THREE.CylinderGeometry(9, 13, 5, 32), M.grass);
        hill.position.y = 2.5; hill.receiveShadow = true; g.add(hill);
        for (let i = 0; i < 4; i++) this._box(g, 5 - i * 0.2, 0.5, 2, M.stone, 0, i * 1.2, 11 - i * 1.2);
        this._box(g, 9, 6, 8, M.white, 0, 5, -1);
        const drum = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 2.6, 4, 24), M.white);
        drum.position.set(0, 13, -1); g.add(drum);
        const dome = new THREE.Mesh(new THREE.SphereGeometry(2.8, 24, 16, 0, TAU, 0, Math.PI / 2), M.white);
        dome.scale.y = 1.6; dome.position.set(0, 15, -1); dome.castShadow = true; g.add(dome);
        const lan = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.5, 1.6, 10), M.white); lan.position.set(0, 20, -1); g.add(lan);
        for (const [x, z] of [[-3.6, 2.2], [3.6, 2.2], [-3.6, -4], [3.6, -4]]) {
          const d = new THREE.Mesh(new THREE.SphereGeometry(1.3, 16, 10, 0, TAU, 0, Math.PI / 2), M.white);
          d.scale.y = 1.5; d.position.set(x, 11, z); d.castShadow = true; g.add(d);
          const dr = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.2, 1.4, 14), M.white); dr.position.set(x, 10.3, z); g.add(dr);
        }
        this._box(g, 2.6, 13, 2.6, M.white, 0, 5, -6.5);
        const cd = new THREE.Mesh(new THREE.SphereGeometry(1.3, 14, 10, 0, TAU, 0, Math.PI / 2), M.white);
        cd.scale.y = 1.4; cd.position.set(0, 18, -6.5); g.add(cd);
        // painters' easels on the hill (Place du Tertre)
        for (const x of [-6, -3.5, 3.5, 6]) {
          const easel = new THREE.Mesh(new THREE.BoxGeometry(1, 1.3, 0.1), new THREE.MeshStandardMaterial({ color: [0xff8a65, 0x5fb4ff, 0xffd166, 0xc792ea][(x + 6) % 4 | 0] }));
          easel.position.set(x, 5.9, 6.5); easel.rotation.x = -0.2; g.add(easel);
        }
        height = 22; depth = 18;
        break;
      }
      case 'cafe': {
        facade = this._facadeMat(73, { floors: 5, cols: 4, tint: '#ece0c6' });
        this._box(g, 12, 13, 9, facade, 0, 0, -1);
        this._mansard(g, 12, 3.6, 9, 0, 13, -1);
        for (const x of [-3.5, 0, 3.5]) this._box(g, 0.8, 1.6, 0.8, M.terracotta, x, 15.5, -2);
        const awn = new THREE.Mesh(new THREE.BoxGeometry(12.4, 0.25, 3), new THREE.MeshStandardMaterial({ color: 0x2f5d46, roughness: 0.8 }));
        awn.position.set(0, 3.6, 4.6); awn.rotation.x = 0.28; awn.castShadow = true; g.add(awn);
        const signMesh = new THREE.Mesh(new THREE.BoxGeometry(6, 0.9, 0.2), new THREE.MeshStandardMaterial({ color: 0x1d2a24, emissive: 0xffd166, emissiveIntensity: 0.3 }));
        signMesh.position.set(0, 4.6, 3.6); g.add(signMesh);
        for (const [x, z] of [[-4, 6], [-1.3, 6.8], [1.4, 6], [4, 6.8]]) {
          const tbl = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.08, 12), M.white); tbl.position.set(x, 1.05, z);
          const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1, 6), M.iron); leg.position.set(x, 0.5, z);
          g.add(tbl, leg);
          for (const s of [-1, 1]) this._box(g, 0.5, 0.9, 0.5, new THREE.MeshStandardMaterial({ color: 0x8a5a2b }), x + s * 0.8, 0, z);
        }
        height = 18; depth = 12;
        break;
      }
      case 'home': {
        facade = this._facadeMat(97, { floors: 4, cols: 4, tint: '#efe3c8' });
        this._box(g, 11, 11, 8, facade, 0, 0, -1);
        this._mansard(g, 11, 3.4, 8, 0, 11, -1);
        // flower boxes on the balconies
        for (const y of [4.3, 6.9, 9.5]) for (const x of [-4.1, -1.4, 1.4, 4.1]) {
          this._box(g, 1.6, 0.35, 0.5, new THREE.MeshStandardMaterial({ color: 0x3f7a35 }), x, y, 3.2);
          const fl = new THREE.Mesh(new THREE.SphereGeometry(0.28, 8, 6), new THREE.MeshStandardMaterial({ color: [0xe25a7a, 0xff9f43, 0xf7f1e3][(x + y) % 3 | 0] }));
          fl.position.set(x, y + 0.5, 3.2); g.add(fl);
        }
        const awn = new THREE.Mesh(new THREE.BoxGeometry(11.4, 0.22, 2.6), new THREE.MeshStandardMaterial({ color: 0x8e2c2c }));
        awn.position.set(0, 3.5, 4.2); awn.rotation.x = 0.3; awn.castShadow = true; g.add(awn);
        // your desk on the terrace
        this._box(g, 5, 0.25, 2.2, new THREE.MeshStandardMaterial({ color: 0x6b4a2e }), 0, 1.1, 6.2);
        for (const x of [-2.2, 2.2]) this._box(g, 0.2, 1.1, 0.2, M.iron, x, 0, 6.2);
        const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.3, 10, 8), M.lampHead); lamp.position.set(2, 2.1, 6.2); g.add(lamp);
        const dl = new THREE.PointLight(0xffc070, 6, 10, 2); dl.position.set(2, 2.6, 6.2); g.add(dl);
        height = 16; depth = 12;
        break;
      }
      case 'pompidou': {
        this._box(g, 18, 10, 9, new THREE.MeshStandardMaterial({ color: 0x9fb6c4, roughness: 0.15, metalness: 0.4, transparent: true, opacity: 0.85 }), 0, 0, -1);
        const steel = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(18, 10, 9, 6, 4, 3)), new THREE.LineBasicMaterial({ color: 0xf2f2f2 }));
        steel.position.set(0, 5, -1); g.add(steel);
        const pipeCols = [0x2f6fd1, 0x2fa65a, 0xd23b3b, 0xf2c230];
        for (let i = 0; i < 12; i++) {
          const p = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 10.6, 10), new THREE.MeshStandardMaterial({ color: pipeCols[i % 4], roughness: 0.4 }));
          p.position.set(-8.4 + i * 1.53, 5.3, -5.9); p.castShadow = true; g.add(p);
        }
        for (const y of [3, 6.5, 9.5]) {
          const p = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 18.4, 10), new THREE.MeshStandardMaterial({ color: pipeCols[(y | 0) % 4] }));
          p.rotation.z = Math.PI / 2; p.position.set(0, y, 3.8); g.add(p);
        }
        const esc = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 19, 12), new THREE.MeshStandardMaterial({ color: 0xd23b3b, transparent: true, opacity: 0.85 }));
        esc.rotation.z = Math.atan2(19, 9) - Math.PI / 2 + 0.05; esc.position.set(0, 5.5, 4.3); g.add(esc);
        for (const x of [-7, -3, 3, 7]) {
          const vent = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.4, 2.4, 12), M.white);
          vent.position.set(x, 1.2, 7); g.add(vent);
          const mouth = new THREE.Mesh(new THREE.TorusGeometry(0.6, 0.2, 8, 16), M.white); mouth.position.set(x, 2.6, 7); g.add(mouth);
        }
        height = 15; depth = 11;
        break;
      }
    }
    // capability accent: a glowing band, coloured like the capability
    const accentMat = new THREE.MeshStandardMaterial({ color: accent, emissive: accent, emissiveIntensity: 0.3 });
    return { g, height, depth, facade, accentMat };
  }

  _landmark(key) {
    const b = BUILDINGS[key];
    const a = THREE.MathUtils.degToRad(b.angle);
    const pos = V(Math.cos(a) * RING, 0, Math.sin(a) * RING);
    const toCenter = pos.clone().multiplyScalar(-1).normalize();
    const built = this._build(b.build, b.color);
    const { g, height, depth } = built;
    g.position.copy(pos);
    g.rotation.y = Math.atan2(toCenter.x, toCenter.z);
    const door = pos.clone().add(toCenter.clone().multiplyScalar(depth / 2 + 3.5));
    const localDoorZ = depth / 2 + 3.5;

    const pad = new THREE.Mesh(new THREE.CircleGeometry(3.4, 40),
      new THREE.MeshBasicMaterial({ color: b.color, transparent: true, opacity: 0.18, depthWrite: false }));
    pad.rotation.x = -Math.PI / 2; pad.position.set(0, 0.09, localDoorZ); g.add(pad);
    const ring = new THREE.Mesh(new THREE.RingGeometry(3.3, 3.6, 48), built.accentMat);
    ring.rotation.x = -Math.PI / 2; ring.position.set(0, 0.1, localDoorZ); g.add(ring);
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.2, 70, 24, 1, true),
      new THREE.MeshBasicMaterial({ color: b.color, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
    beam.position.set(0, 35, localDoorZ); g.add(beam);
    const light = new THREE.PointLight(b.color, 0, 26, 1.6);
    light.position.set(0, 4, localDoorZ); g.add(light);

    const el = document.createElement('div');
    el.className = 'bsign';
    el.style.setProperty('--c', '#' + new THREE.Color(b.color).getHexString());
    el.innerHTML = `<span class="bs-icon">${b.icon}</span><span class="bs-text"><b></b><small></small><i></i></span><span class="bs-count"></span>`;
    el.querySelector('b').textContent = b.name;
    el.querySelector('small').textContent = b.place;
    el.querySelector('i').textContent = b.cap;
    const sign = new CSS2DObject(el);
    sign.position.set(0, height + 5, 0);
    g.add(sign);

    this.scene.add(g);
    this.buildings[key] = { ...b, key, pos, door, group: g, facade: built.facade, accent: built.accentMat, light, pad, beam, el, busy: 0, glow: 0 };
  }

  // ------------------------------------------------------------ Haussmann blocks
  _clear(x, z, margin = 0) {
    const r = Math.hypot(x, z);
    if (r < ROAD_R + 6 + margin) return false;
    for (const b of Object.values(BUILDINGS)) {
      const a = THREE.MathUtils.degToRad(b.angle);
      const lx = Math.cos(a), lz = Math.sin(a);
      const along = x * lx + z * lz;
      const perp = Math.abs(-x * lz + z * lx);
      if (along > 0 && perp < 10.5 + margin) return false;          // avenue + trees
      const dx = x - lx * RING, dz = z - lz * RING;
      if (Math.hypot(dx, dz) < 17 + margin) return false;           // landmark plot
    }
    if (this.distToSeine(x, z) < 16 + margin) return false;
    return true;
  }

  _blocks() {
    const r = rng(2024);
    const cells = [];
    const S = 9.5;
    for (let gx = -15; gx <= 15; gx++) {
      for (let gz = -15; gz <= 14; gz++) {
        const x = gx * S + (r() - 0.5) * 1.2, z = gz * S + (r() - 0.5) * 1.2;
        if (Math.hypot(x, z) > 150) continue;
        if (!this._clear(x, z)) continue;
        if (r() < 0.07) { cells.push({ x, z, park: true }); continue; }
        cells.push({ x, z, w: 7 + r() * 1.6, d: 7 + r() * 1.6, h: 8.5 + r() * 3.5, rh: 2.4 + r() * 1.2, tint: 0.92 + r() * 0.1 });
      }
    }
    const blocks = cells.filter((c) => !c.park);
    const body = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), this.M.facade, blocks.length);
    const roofGeo = new THREE.CylinderGeometry(0.5, 0.7071, 1, 4, 1); roofGeo.rotateY(Math.PI / 4);
    const roof = new THREE.InstancedMesh(roofGeo, this.M.zinc, blocks.length);
    const chim = new THREE.InstancedMesh(new THREE.BoxGeometry(0.7, 1.4, 0.7), this.M.terracotta, blocks.length * 2);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3(), col = new THREE.Color();
    blocks.forEach((c, i) => {
      // face each block toward the nearest avenue for a more organic grain
      const rot = (Math.round(Math.atan2(c.z, c.x) / (Math.PI / 4)) * Math.PI / 4) + Math.PI / 2;
      q.setFromAxisAngle(V(0, 1, 0), rot);
      m.compose(p.set(c.x, c.h / 2, c.z), q, s.set(c.w, c.h, c.d)); body.setMatrixAt(i, m);
      body.setColorAt(i, col.setRGB(c.tint, c.tint * 0.985, c.tint * 0.96));
      m.compose(p.set(c.x, c.h + c.rh / 2, c.z), q, s.set(c.w, c.rh, c.d)); roof.setMatrixAt(i, m);
      roof.setColorAt(i, col.setHSL(0.58, 0.07, 0.55 + r() * 0.15));
      for (let k = 0; k < 2; k++) {
        const off = V((k ? 1 : -1) * c.w * 0.3, 0, (r() - 0.5) * c.d * 0.4).applyQuaternion(q);
        m.compose(p.set(c.x + off.x, c.h + c.rh * 0.7, c.z + off.z), q, s.set(1, 1, 1)); chim.setMatrixAt(i * 2 + k, m);
      }
    });
    for (const im of [body, roof, chim]) { im.castShadow = true; im.receiveShadow = true; im.instanceMatrix.needsUpdate = true; this.scene.add(im); }
    // little squares (parks) where a block was left out
    this.parks = cells.filter((c) => c.park);
    for (const c of this.parks) this._plane(8, 8, this.M.grass, c.x, c.z, 0, 0.05);
  }

  // ------------------------------------------------------------ plane trees, lamps
  _trees() {
    const spots = [];
    const r = rng(77);
    for (const b of Object.values(BUILDINGS)) {
      const a = THREE.MathUtils.degToRad(b.angle);
      const lx = Math.cos(a), lz = Math.sin(a);
      for (let d = ROAD_R + 4; d < 160; d += 5.5) {
        for (const side of [-1, 1]) {
          const x = lx * d - lz * 5.6 * side, z = lz * d + lx * 5.6 * side;
          if (Math.hypot(x - lx * RING, z - lz * RING) < 15) continue;
          if (this.distToSeine(x, z) < 13) continue;
          spots.push([x, z, 0.85 + r() * 0.35]);
        }
      }
    }
    // along the Seine quays
    for (let i = 0; i < this.seinePts.length; i += 3) {
      const t = this.seine.getTangentAt(i / (this.seinePts.length - 1));
      const n = V(-t.z, 0, t.x).normalize(), p = this.seinePts[i];
      for (const s of [-1, 1]) {
        const x = p.x + n.x * 14 * s, z = p.z + n.z * 14 * s;
        if (Math.hypot(x, z) < 160) spots.push([x, z, 0.8 + r() * 0.3]);
      }
    }
    for (const c of this.parks) for (let k = 0; k < 2; k++) spots.push([c.x + (r() - 0.5) * 5, c.z + (r() - 0.5) * 5, 1 + r() * 0.3]);
    // garden around the tower
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * TAU + 0.2;
      if (Object.values(BUILDINGS).some((b) => Math.abs(((a - THREE.MathUtils.degToRad(b.angle) + 3 * Math.PI) % TAU) - Math.PI) < 0.22)) continue;
      spots.push([Math.cos(a) * (PLAZA_R - 2.6), Math.sin(a) * (PLAZA_R - 2.6), 0.75]);
    }
    const trunk = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.22, 0.32, 3, 6), new THREE.MeshStandardMaterial({ color: 0x8a7a64 }), spots.length);
    const crownGeo = new THREE.IcosahedronGeometry(1.9, 1);
    const crown = new THREE.InstancedMesh(crownGeo, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, flatShading: true }), spots.length);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3(), col = new THREE.Color();
    spots.forEach(([x, z, k], i) => {
      m.compose(p.set(x, 1.5 * k, z), q.identity(), s.set(k, k, k)); trunk.setMatrixAt(i, m);
      q.setFromEuler(new THREE.Euler(0, r() * TAU, 0));
      m.compose(p.set(x, 4.2 * k, z), q, s.set(k * 1.1, k * (0.95 + r() * 0.25), k * 1.1)); crown.setMatrixAt(i, m);
      crown.setColorAt(i, col.setHSL(0.24 + r() * 0.06, 0.45, 0.33 + r() * 0.1));
    });
    for (const im of [trunk, crown]) { im.castShadow = true; im.receiveShadow = true; this.scene.add(im); }
  }

  _lamps() {
    const spots = [];
    for (const b of Object.values(BUILDINGS)) {
      const a = THREE.MathUtils.degToRad(b.angle), lx = Math.cos(a), lz = Math.sin(a);
      for (let d = ROAD_R + 2; d < 150; d += 11) for (const side of [-1, 1]) {
        const x = lx * d - lz * 3.9 * side, z = lz * d + lx * 3.9 * side;
        if (Math.hypot(x - lx * RING, z - lz * RING) < 13) continue;
        if (this.distToSeine(x, z) < 12) continue;
        spots.push([x, z]);
      }
    }
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * TAU + 0.13;
      spots.push([Math.cos(a) * (ROAD_R + 1.2), Math.sin(a) * (ROAD_R + 1.2)]);
    }
    const pole = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.09, 0.14, 4.4, 6), this.M.iron, spots.length);
    const head = new THREE.InstancedMesh(new THREE.SphereGeometry(0.36, 10, 8), this.M.lampHead, spots.length);
    const m = new THREE.Matrix4();
    spots.forEach(([x, z], i) => {
      m.makeTranslation(x, 2.2, z); pole.setMatrixAt(i, m);
      m.makeTranslation(x, 4.55, z); head.setMatrixAt(i, m);
    });
    pole.castShadow = true;
    this.scene.add(pole, head);
  }

  // ---------------------------------------------------------------- API ---
  spawn({ label, color, size = 1, from = 'hq', toward, role }) {
    let at = V(0, 0, SPAWN_R);
    if (from === 'hq' && toward && this.buildings[toward]) {
      const a = Math.atan2(this.buildings[toward].door.z, this.buildings[toward].door.x);
      at = V(Math.cos(a) * SPAWN_R, 0, Math.sin(a) * SPAWN_R);
    } else if (from !== 'hq' && this.buildings[from]) at = this.buildings[from].door.clone();
    const w = new Walker(this, { label, color, size, at, role });
    this.walkers.add(w);
    return w;
  }

  _arc(a0, a1, r = ARC_R) {
    const d = ((a1 - a0 + Math.PI * 3) % TAU) - Math.PI;
    const n = Math.max(1, Math.ceil(Math.abs(d) / 0.35));
    const pts = [];
    for (let i = 0; i <= n; i++) { const a = a0 + (d * i) / n; pts.push(V(Math.cos(a) * r, 0, Math.sin(a) * r)); }
    return pts;
  }
  _angleOf(v) { return Math.atan2(v.z, v.x); }
  _onAvenue(key, r) { const a = this._angleOf(this.buildings[key].door); return V(Math.cos(a) * r, 0, Math.sin(a) * r); }

  async goTo(walker, key) {
    const b = this.buildings[key];
    const jitter = V((Math.random() - 0.5) * 3.4, 0, (Math.random() - 0.5) * 3.4);
    const pts = [];
    const p = walker.group.position;
    let fromAngle = this._angleOf(p);
    if (walker.at && walker.at !== 'hq' && this.buildings[walker.at]) {
      pts.push(this._onAvenue(walker.at, ENTRY_R));
      fromAngle = this._angleOf(this.buildings[walker.at].door);
    }
    pts.push(...this._arc(fromAngle, this._angleOf(b.door)));
    pts.push(this._onAvenue(key, ENTRY_R), b.door.clone().add(jitter));
    await walker.walkTo(pts);
    walker.at = key;
  }

  async goHQ(walker) {
    const from = walker.at && this.buildings[walker.at];
    const pts = [];
    const a = this._angleOf(from ? from.door : walker.group.position);
    if (from) pts.push(this._onAvenue(walker.at, ENTRY_R));
    pts.push(V(Math.cos(a) * ARC_R, 0, Math.sin(a) * ARC_R), V(Math.cos(a) * SPAWN_R, 0, Math.sin(a) * SPAWN_R));
    await walker.walkTo(pts);
    walker.at = 'hq';
  }

  enter(key) { const b = this.buildings[key]; if (b) b.busy++; }
  leave(key) { const b = this.buildings[key]; if (b) b.busy = Math.max(0, b.busy - 1); }
  flash(key) { const b = this.buildings[key]; if (b) b.glow = 1.5; }
  dismiss(walker) { walker.fade(); }

  _removeWalker(w) {
    this.scene.remove(w.group);
    w.label.element.remove();
    this.walkers.delete(w);
  }

  packet(fromVec, toKeyOrVec, color = 0x6be3bf) {
    const to = toKeyOrVec instanceof THREE.Vector3 ? toKeyOrVec : this.buildings[toKeyOrVec].door.clone();
    const from = fromVec.clone(); if (from.y < 2) from.y = 3;
    const mid = from.clone().lerp(to, 0.5); mid.y = 30;
    const curve = new THREE.QuadraticBezierCurve3(from, mid, to.clone().setY(2));
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.8, 16, 12), new THREE.MeshBasicMaterial({ color }));
    const glow = new THREE.Mesh(new THREE.SphereGeometry(1.7, 16, 12), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.3, depthWrite: false }));
    m.add(glow);
    this.scene.add(m);
    return new Promise((resolve) => { this.packets.add({ m, curve, t: 0, dur: 1.5, resolve }); });
  }

  addDeskItem(color = 0xffffff) {
    const b = this.buildings.home;
    const i = this.deskItems++;
    const item = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.35, 1.8),
      new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.6 }));
    const toCenter = b.door.clone().normalize().multiplyScalar(-1);
    const side = V(-toCenter.z, 0, toCenter.x);
    const base = b.door.clone().add(toCenter.clone().multiplyScalar(-1.2));
    item.position.copy(base).add(side.multiplyScalar(((i % 4) - 1.5) * 1.6));
    item.position.y = 1.45 + Math.floor(i / 4) * 0.4;
    item.rotation.y = Math.atan2(toCenter.x, toCenter.z) + (Math.random() - 0.5) * 0.4;
    item.castShadow = true;
    this.scene.add(item);
    (this.deskMeshes ||= []).push(item);
    this.flash('home');
  }

  clearDesk() {
    for (const m of this.deskMeshes || []) this.scene.remove(m);
    this.deskMeshes = []; this.deskItems = 0;
  }

  focus(key, dist = 78) {
    if (key === 'overview' || !key) { this.view = { target: V(0, 4, 4), dist: 138 }; return; }
    const b = key === 'hq' ? { door: V(0, 8, 6) } : this.buildings[key];
    if (!b) return;
    this.view = { target: b.door.clone().multiplyScalar(0.7).setY(4), dist };
  }

  setThinking(on) { this.thinking = on; }

  _tick() {
    const dt = Math.min(0.12, this.clock.getDelta());
    const t = this.clock.elapsedTime;
    for (const w of [...this.walkers]) w.update(dt);
    this.planner.update(dt);
    for (const f of this.anim) f(dt, t);

    for (const p of [...this.packets]) {
      p.t += dt / p.dur;
      const k = Math.min(1, p.t);
      p.m.position.copy(p.curve.getPoint(k));
      if (k >= 1) { this.scene.remove(p.m); this.packets.delete(p); p.resolve(); }
    }

    for (const b of Object.values(this.buildings)) {
      b.glow = Math.max(0, b.glow - dt * 0.8);
      const act = b.busy ? 1 : 0;
      b.light.intensity += ((act ? 260 : 0) + b.glow * 200 - b.light.intensity) * Math.min(1, dt * 4);
      b.pad.material.opacity = 0.18 + act * (0.3 + 0.15 * Math.sin(t * 5)) + b.glow * 0.25;
      b.beam.material.opacity += ((act ? 0.16 + 0.06 * Math.sin(t * 4) : 0) + b.glow * 0.12 - b.beam.material.opacity) * Math.min(1, dt * 3);
      b.accent.emissiveIntensity = 0.3 + act * 1.6 + b.glow;
      b.el.classList.toggle('active', b.busy > 0 || b.glow > 0.3);
      b.el.querySelector('.bs-count').textContent = b.busy > 1 ? `×${b.busy}` : '';
    }

    const busy = this.thinking ? 1 : 0;
    this.hqRing.rotation.z += dt * (busy ? 2.2 : 0.35);
    this.hqRing.position.y = 16 + Math.sin(t * (busy ? 3 : 0.8)) * (busy ? 3 : 0.6);
    this.hqRing.material.opacity = 0.55 + busy * 0.4;
    this.towerMat.emissiveIntensity = (this.towerBase || 0) + busy * (0.25 + 0.15 * Math.sin(t * 6));
    this.hqLight.intensity = busy ? 400 + 200 * Math.sin(t * 6) : 0;
    this.beacon.scale.setScalar(1 + (busy ? 0.5 : 0.15) * Math.sin(t * 7));
    this.beams.rotation.y += dt * 0.5;
    if (this.sparkle.visible) this.sparkle.material.opacity = 0.35 + 0.65 * Math.abs(Math.sin(t * 13.7) * Math.sin(t * 7.3));
    if (this.flame) this.flame.scale.set(1, 1 + 0.25 * Math.sin(t * 17), 1);
    this.waterTex.offset.x -= dt * 0.01; this.waterTex.offset.y += dt * 0.004;

    if (this.director && performance.now() > this.userUntil) {
      this.controls.target.lerp(this.view.target, Math.min(1, dt * 1.1));
      const off = this.camera.position.clone().sub(this.controls.target);
      const d = off.length();
      off.setLength(d + (this.view.dist - d) * Math.min(1, dt * 0.9));
      this.camera.position.copy(this.controls.target).add(off);
      this.controls.autoRotate = true;
      this.controls.autoRotateSpeed = 0.22;
    } else this.controls.autoRotate = false;
    this.controls.update();
    if (LITE) this.renderer.render(this.scene, this.camera); else this.composer.render();
    this.labels.render(this.scene, this.camera);
  }
}
