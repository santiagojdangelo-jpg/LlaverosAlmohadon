"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import {
  TEMPLATE_CM,
  MUG_CIRCUMFERENCE_CM,
  MUG_BODY_H_CM,
  FRONT_CENTER_U,
} from "@/lib/config";

// ════════════════════════════════════════════════════════════════
//  TAZA 3D (Three.js)
//  Medidas en "radios": el radio de la taza = 1.
//  La plantilla 21×9 cm se pega sobre el cilindro SIN deformarse:
//  21 cm de 25,4 cm de vuelta ≈ 298° (el hueco queda atrás de la taza).
// ════════════════════════════════════════════════════════════════

const R = 1; // radio
const CM_PER_R = MUG_CIRCUMFERENCE_CM / (2 * Math.PI); // cm que mide un "radio"
const BODY_H = MUG_BODY_H_CM / CM_PER_R; // alto del cuerpo
const PRINT_H = TEMPLATE_CM.h / CM_PER_R; // alto de la plantilla
const ARC = TEMPLATE_CM.w / CM_PER_R; // ancho de la plantilla (radianes)
// El asa está sobre el eje -X (ángulo -90°). El hueco blanco sin imprimir queda justo ahí,
// así que el centro del diseño apunta al lado opuesto (+X).
const HANDLE_SIDE_ANGLE = -Math.PI / 2;

/**
 * @param {{ designCanvas: HTMLCanvasElement | null }} props
 *   designCanvas: la plantilla 21×9 ya encuadrada (la misma que se sube a Cloudinary).
 */
export default function Mug3D({ designCanvas }) {
  const wrapRef = useRef(null);
  const apiRef = useRef(null);
  const [auto, setAuto] = useState(true);
  const [unsupported, setUnsupported] = useState(false);

  // ── Escena (se crea una sola vez) ────────────────────────────
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
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.domElement.style.cssText =
      "display:block;width:100%;height:100%;touch-action:none;outline:none";
    wrap.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environmentIntensity = 0.55;

    const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
    camera.position.set(7.2, 1.1, 1.4); // mira de frente el centro del diseño

    const sun = new THREE.DirectionalLight(0xffffff, 1.1);
    sun.position.set(3, 6, 4);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.camera.left = -4;
    sun.shadow.camera.right = 4;
    sun.shadow.camera.top = 4;
    sun.shadow.camera.bottom = -4;
    sun.shadow.radius = 5;
    scene.add(sun, new THREE.AmbientLight(0xffffff, 0.12));

    // ── Materiales ──
    const ceramic = new THREE.MeshPhysicalMaterial({
      color: 0xf6f6fa,
      roughness: 0.22,
      clearcoat: 1,
      clearcoatRoughness: 0.08,
    });
    const innerMat = ceramic.clone();
    innerMat.side = THREE.BackSide;
    innerMat.color.set(0xe4e4ec);
    const designMat = new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      roughness: 0.5,
      clearcoat: 0.5,
      clearcoatRoughness: 0.15,
      transparent: true,
      polygonOffset: true,
      polygonOffsetFactor: -2,
    });

    // ── Geometría ──
    const mug = new THREE.Group();
    const add = (geo, mat, setup) => {
      const m = new THREE.Mesh(geo, mat);
      m.castShadow = true;
      m.receiveShadow = true;
      setup?.(m);
      mug.add(m);
      return m;
    };

    // Cuerpo exterior e interior
    add(new THREE.CylinderGeometry(R, R, BODY_H, 96, 1, true), ceramic);
    add(new THREE.CylinderGeometry(R - 0.06, R - 0.06, BODY_H - 0.1, 96, 1, true), innerMat, (m) => {
      m.position.y = -0.05;
    });
    // Fondo interior y exterior
    add(new THREE.CircleGeometry(R - 0.06, 64), ceramic, (m) => {
      m.rotation.x = -Math.PI / 2;
      m.position.y = -BODY_H / 2 + 0.12;
    });
    add(new THREE.CircleGeometry(R - 0.03, 64), ceramic, (m) => {
      m.rotation.x = Math.PI / 2;
      m.position.y = -BODY_H / 2;
    });
    // Bordes redondeados (labio y base)
    const lip = new THREE.TorusGeometry(R - 0.03, 0.03, 16, 96);
    add(lip, ceramic, (m) => {
      m.rotation.x = Math.PI / 2;
      m.position.y = BODY_H / 2;
    });
    add(lip, ceramic, (m) => {
      m.rotation.x = Math.PI / 2;
      m.position.y = -BODY_H / 2;
    });

    // Asa (del lado izquierdo, como en la foto)
    const handlePath = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-0.92, 0.78, 0),
      new THREE.Vector3(-1.45, 0.86, 0),
      new THREE.Vector3(-1.82, 0.32, 0),
      new THREE.Vector3(-1.82, -0.32, 0),
      new THREE.Vector3(-1.45, -0.86, 0),
      new THREE.Vector3(-0.92, -0.78, 0),
    ]);
    add(new THREE.TubeGeometry(handlePath, 64, 0.15, 20, false), ceramic);

    // Diseño: tramo de cilindro; el hueco sin imprimir queda del lado del asa
    const designMesh = add(
      new THREE.CylinderGeometry(R + 0.003, R + 0.003, PRINT_H, 128, 1, true, HANDLE_SIDE_ANGLE + Math.PI - ARC * FRONT_CENTER_U, ARC),
      designMat,
      (m) => {
        m.position.y = 0;
        m.castShadow = false;
        m.visible = false;
      }
    );
    scene.add(mug);

    // Piso que solo recibe la sombra
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(16, 16),
      new THREE.ShadowMaterial({ opacity: 0.28 })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -BODY_H / 2 - 0.005;
    floor.receiveShadow = true;
    scene.add(floor);

    // ── Controles: arrastrar para girar, pellizcar para acercar ──
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.enablePan = false;
    controls.minDistance = 4.5;
    controls.maxDistance = 11;
    controls.minPolarAngle = Math.PI * 0.2;
    controls.maxPolarAngle = Math.PI * 0.62; // no deja pasar por debajo del piso
    controls.target.set(0, 0, 0);
    controls.autoRotate = true;
    controls.autoRotateSpeed = 1.6;
    controls.addEventListener("start", () => setAuto(false)); // al tocarla, deja de girar sola

    // ── Tamaño responsive ──
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

    let raf;
    const tick = () => {
      controls.update();
      renderer.render(scene, camera);
      raf = requestAnimationFrame(tick);
    };
    tick();

    apiRef.current = { renderer, controls, designMat, designMesh };

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      controls.dispose();
      scene.traverse((o) => {
        o.geometry?.dispose?.();
        if (o.material) [].concat(o.material).forEach((m) => m.dispose());
      });
      designMat.map?.dispose();
      pmrem.dispose();
      renderer.dispose();
      renderer.domElement.remove();
      apiRef.current = null;
    };
  }, []);

  // ── Textura: se actualiza cada vez que cambia el diseño ───────
  useEffect(() => {
    const api = apiRef.current;
    if (!api) return;
    const old = api.designMat.map;
    if (!designCanvas) {
      api.designMat.map = null;
      api.designMesh.visible = false;
    } else {
      const tex = new THREE.CanvasTexture(designCanvas);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = api.renderer.capabilities.getMaxAnisotropy();
      api.designMat.map = tex;
      api.designMesh.visible = true;
    }
    api.designMat.needsUpdate = true;
    old?.dispose();
  }, [designCanvas]);

  // ── Giro automático on/off ───────────────────────────────────
  useEffect(() => {
    if (apiRef.current) apiRef.current.controls.autoRotate = auto;
  }, [auto]);

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
        {auto ? "⏸ Pausar giro" : "▶ Girar solo"}
      </button>
    </div>
  );
}
