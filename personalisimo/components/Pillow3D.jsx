"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { PILLOW_CM, PILLOW_LOOP_X } from "@/lib/config";

// ════════════════════════════════════════════════════════════════
//  LLAVERO ALMOHADÓN 3D (Three.js)
//  1 unidad = 1 cm.
//  - Cara de adelante: la tela sublimada (el diseño del cliente, SIN deformar).
//  - Cara de atrás: tela blanca lisa.
//  - Costura plana alrededor, cinta de raso en una esquina y argolla metálica.
//  La tela se "infla" con el relleno: el panel de 7×7 se ve un poco más
//  chico de frente (SHRINK) porque parte de su largo se usa en la panza.
// ════════════════════════════════════════════════════════════════

const W = PILLOW_CM.w;
const H = PILLOW_CM.h;
const SHRINK = 0.92; // cuánto se achica el panel al inflarse
const PW = W * SHRINK; // ancho visible del almohadón
const PH = H * SHRINK; // alto visible
const PUFF = 1.75; // grosor de cada cara en el centro (cm)  ← más alto = más "gordito"
const FLANGE = 0.3; // franja plana de la costura (cm)
const SIDE_PULL = 0.1; // cuánto se hunden hacia adentro los lados (las esquinas quedan "en punta")
const WRINKLE = 0.1; // profundidad de las arrugas que salen de las esquinas (cm)

/**
 * Deformación del contorno: el relleno acorta la tela, y los lados se curvan hacia
 * adentro en el medio mientras las esquinas sobresalen. (nx, ny en -1…1)
 */
function warp(nx, ny) {
  const px = SIDE_PULL * Math.pow(Math.abs(nx), 3) * (1 - ny * ny) * (PW / 2);
  const py = SIDE_PULL * Math.pow(Math.abs(ny), 3) * (1 - nx * nx) * (PH / 2);
  return [(nx * PW) / 2 - Math.sign(nx) * px, (ny * PH) / 2 - Math.sign(ny) * py];
}

/** Altura de la panza en un punto: 0 en el borde cosido, PUFF en el centro, con arrugas en las esquinas. */
function puff(nx, ny) {
  const c = Math.cos((nx * Math.PI) / 2) * Math.cos((ny * Math.PI) / 2);
  let z = PUFF * Math.pow(Math.max(c, 0), 0.62);
  // la panza se afloja hacia las esquinas y la tela se arruga en abanico
  const cx = 1 - Math.abs(nx);
  const cy = 1 - Math.abs(ny);
  const d = Math.hypot(cx, cy); // distancia a la esquina (0 en la esquina)
  if (d < 0.9) {
    const ang = Math.atan2(cy, cx); // 0…90°
    const prox = Math.pow(1 - d / 0.9, 1.5);
    z -= WRINKLE * prox * (0.5 + 0.5 * Math.sin(ang * 9 + 0.6)) * (1 + 3 * prox);
  }
  return Math.max(z, 0);
}

function pillowFace(side) {
  const N = 90;
  const geo = new THREE.PlaneGeometry(2, 2, N, N); // uv 0…1 = diseño sin deformar
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const nx = pos.getX(i);
    const ny = pos.getY(i);
    const [x, y] = warp(nx, ny);
    pos.setXYZ(i, x, y, side * puff(nx, ny));
  }
  geo.computeVertexNormals();
  return geo;
}

/** Contorno cosido (curvo): puntos del borde del almohadón, en sentido antihorario. */
function outlinePoints(n = 48) {
  const pts = [];
  const edge = (f) => {
    for (let i = 0; i < n; i++) pts.push(f(-1 + (2 * i) / n));
  };
  edge((t) => warp(t, -1)); // abajo →
  edge((t) => warp(1, t)); //  derecha ↑
  edge((t) => warp(-t, 1)); // arriba ←
  edge((t) => warp(-1, -t)); // izquierda ↓
  return pts;
}

/** Costura: marco plano que sigue el contorno curvo del almohadón. */
function flangeGeometry() {
  const inner = outlinePoints();
  const m = inner.length;
  const outer = inner.map((p, i) => {
    const a = inner[(i - 1 + m) % m];
    const b = inner[(i + 1) % m];
    // normal hacia afuera (el recorrido es antihorario)
    let nx = b[1] - a[1];
    let ny = -(b[0] - a[0]);
    const len = Math.hypot(nx, ny) || 1;
    nx /= len;
    ny /= len;
    return [p[0] + nx * FLANGE, p[1] + ny * FLANGE];
  });
  const shape = new THREE.Shape(outer.map(([x, y]) => new THREE.Vector2(x, y)));
  shape.holes.push(new THREE.Path(inner.map(([x, y]) => new THREE.Vector2(x, y)).reverse()));
  return new THREE.ShapeGeometry(shape);
}

/** Cinta plegada en bucle (ancho sobre el eje X, el bucle se dibuja en el plano YZ). */
function ribbonGeometry(points, width, thickness) {
  const curve = new THREE.CatmullRomCurve3(points);
  const n = 40;
  const side = new THREE.Vector3(1, 0, 0);
  const verts = [];
  const idx = [];
  for (let i = 0; i <= n; i++) {
    const p = curve.getPoint(i / n);
    const t = curve.getTangent(i / n);
    const nrm = new THREE.Vector3().crossVectors(t, side).normalize();
    const hw = width / 2;
    const ht = thickness / 2;
    [
      [hw, ht],
      [-hw, ht],
      [-hw, -ht],
      [hw, -ht],
    ].forEach(([a, b]) => {
      verts.push(
        p.x + side.x * a + nrm.x * b,
        p.y + side.y * a + nrm.y * b,
        p.z + side.z * a + nrm.z * b
      );
    });
  }
  for (let i = 0; i < n; i++) {
    for (let k = 0; k < 4; k++) {
      const a = i * 4 + k;
      const b = i * 4 + ((k + 1) % 4);
      const c = a + 4;
      const d = b + 4;
      idx.push(a, c, b, b, c, d);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(verts, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return geo;
}

/** Trama fina de la tela, para el relieve (bump). */
function weaveTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 32;
  const g = c.getContext("2d");
  g.fillStyle = "#808080";
  g.fillRect(0, 0, 32, 32);
  for (let i = 0; i < 32; i += 4) {
    g.fillStyle = "#b4b4b4";
    g.fillRect(i, 0, 2, 32);
    g.fillStyle = "#5c5c5c";
    g.fillRect(0, i + 2, 32, 2);
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(W * 9, H * 9);
  return t;
}

/**
 * @param {{ designCanvas: HTMLCanvasElement | null }} props
 *   designCanvas: el panel 7×7 ya encuadrado (el mismo que se sube a Cloudinary).
 */
export default function Pillow3D({ designCanvas }) {
  const wrapRef = useRef(null);
  const apiRef = useRef(null);
  const [auto, setAuto] = useState(true);
  const autoRef = useRef(true);
  const [unsupported, setUnsupported] = useState(false);

  useEffect(() => {
    autoRef.current = auto;
  }, [auto]);

  // ── Escena (una sola vez) ────────────────────────────────────
  useEffect(() => {
    const wrap = wrapRef.current;
    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    } catch {
      setUnsupported(true);
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.NeutralToneMapping; // respeta los colores del diseño
    renderer.domElement.style.cssText =
      "display:block;width:100%;height:100%;touch-action:none;outline:none";
    wrap.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environmentIntensity = 0.6;

    const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 200);
    const targetY = PH / 2 + 0.3;
    camera.position.set(0, targetY + 1.2, 25);

    const key = new THREE.DirectionalLight(0xffffff, 1.5);
    key.position.set(-6, 10, 12);
    const fill = new THREE.DirectionalLight(0xbfc8ff, 0.45);
    fill.position.set(8, -2, 6);
    scene.add(key, fill, new THREE.AmbientLight(0xffffff, 0.2));

    // ── Materiales ──
    const weave = weaveTexture();
    const fabricProps = {
      roughness: 0.78,
      sheen: 0.6,
      sheenRoughness: 0.5,
      sheenColor: new THREE.Color(0xffffff),
      bumpMap: weave,
      bumpScale: 0.35,
      side: THREE.DoubleSide,
    };
    const frontMat = new THREE.MeshPhysicalMaterial({ color: 0xf8f8fb, ...fabricProps });
    const backMat = new THREE.MeshPhysicalMaterial({ color: 0xf1f1f5, ...fabricProps });
    const seamMat = new THREE.MeshPhysicalMaterial({
      color: 0xeeeef3,
      roughness: 0.85,
      sheen: 0.4,
      side: THREE.DoubleSide,
    });
    const satin = new THREE.MeshPhysicalMaterial({
      color: 0xfdfdff,
      roughness: 0.32,
      sheen: 1,
      sheenRoughness: 0.3,
      sheenColor: new THREE.Color(0xffffff),
      side: THREE.DoubleSide,
    });
    const metal = new THREE.MeshStandardMaterial({
      color: 0xd7d9e0,
      metalness: 1,
      roughness: 0.28,
    });

    // ── Geometría ──
    const toy = new THREE.Group(); // todo el llavero
    const frontMesh = new THREE.Mesh(pillowFace(+1), frontMat);
    const backMesh = new THREE.Mesh(pillowFace(-1), backMat);
    const flange = new THREE.Mesh(flangeGeometry(), seamMat);
    toy.add(frontMesh, backMesh, flange);

    // Cinta con bucle, cerca de la esquina de arriba
    const lx = warp(PILLOW_LOOP_X, 1)[0];
    const y0 = warp(PILLOW_LOOP_X, 1)[1]; // el borde de arriba está hundido en el medio
    const loopPts = [
      new THREE.Vector3(0, y0 - 0.3, 0.05),
      new THREE.Vector3(0, y0 + 0.45, 0.26),
      new THREE.Vector3(0, y0 + 1.25, 0.38),
      new THREE.Vector3(0, y0 + 1.75, 0.0),
      new THREE.Vector3(0, y0 + 1.25, -0.38),
      new THREE.Vector3(0, y0 + 0.45, -0.26),
      new THREE.Vector3(0, y0 - 0.3, -0.05),
    ];
    const ribbon = new THREE.Mesh(ribbonGeometry(loopPts, 0.9, 0.05), satin);
    ribbon.position.x = lx;
    toy.add(ribbon);

    // Argolla (pasa por el bucle de la cinta)
    const ringR = 1.15;
    const ring = new THREE.Mesh(new THREE.TorusGeometry(ringR, 0.085, 16, 64), metal);
    ring.position.set(lx, y0 + 1.5 + ringR, 0);
    ring.rotation.y = 0.25;
    toy.add(ring);
    const ring2 = new THREE.Mesh(new THREE.TorusGeometry(ringR - 0.15, 0.07, 16, 64), metal);
    ring2.position.copy(ring.position);
    ring2.position.z += 0.07;
    ring2.rotation.y = 0.25;
    toy.add(ring2);

    scene.add(toy);

    // ── Controles ──
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.enablePan = false;
    controls.minDistance = 11;
    controls.maxDistance = 38;
    controls.minPolarAngle = Math.PI * 0.2;
    controls.maxPolarAngle = Math.PI * 0.8;
    controls.target.set(0, targetY, 0);
    controls.addEventListener("start", () => setAuto(false)); // al tocarlo, deja de balancearse solo

    const resize = () => {
      const w = wrap.clientWidth || 1;
      const h = wrap.clientHeight || 1;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    const ro = new ResizeObserver(resize);
    ro.observe(wrap);
    resize();

    // Balanceo suave: gira ±38° para mostrar el volumen (y un poco el dorso)
    let phase = 0;
    let last = performance.now();
    let raf;
    const tick = (now) => {
      const dt = Math.min((now - last) / 1000, 0.1);
      last = now;
      if (autoRef.current) phase += dt;
      toy.rotation.y = Math.sin(phase * 0.8) * 0.66;
      toy.rotation.x = Math.sin(phase * 0.5) * 0.05;
      controls.update();
      renderer.render(scene, camera);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    apiRef.current = { renderer, frontMat, toy, controls };

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      controls.dispose();
      scene.traverse((o) => {
        o.geometry?.dispose?.();
        if (o.material) [].concat(o.material).forEach((m) => m.dispose());
      });
      frontMat.map?.dispose();
      weave.dispose();
      pmrem.dispose();
      renderer.dispose();
      renderer.domElement.remove();
      apiRef.current = null;
    };
  }, []);

  // ── Textura del diseño ───────────────────────────────────────
  useEffect(() => {
    const api = apiRef.current;
    if (!api) return;
    const old = api.frontMat.map;
    if (!designCanvas) {
      api.frontMat.map = null;
    } else {
      const tex = new THREE.CanvasTexture(designCanvas);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = api.renderer.capabilities.getMaxAnisotropy();
      api.frontMat.map = tex;
    }
    api.frontMat.needsUpdate = true;
    old?.dispose();
  }, [designCanvas]);

  if (unsupported) {
    return (
      <div className="flex aspect-square items-center justify-center p-6 text-center text-sm text-white/60">
        Tu dispositivo no soporta la vista 3D. Podés seguir usando el editor normal.
      </div>
    );
  }

  return (
    <div className="relative aspect-square w-full bg-[radial-gradient(circle_at_50%_55%,#23233f,#0b0b17_75%)]">
      <div ref={wrapRef} className="absolute inset-0" />
      <button
        type="button"
        onClick={() => setAuto((a) => !a)}
        className="absolute right-3 top-3 rounded-full border border-white/15 bg-ink-950/70 px-3 py-1.5 text-xs font-medium text-white/80 backdrop-blur transition hover:bg-white/10"
      >
        {auto ? "⏸ Pausar balanceo" : "▶ Balancear solo"}
      </button>
    </div>
  );
}
