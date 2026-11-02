"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import UploadZone from "./UploadZone";
import { FitButton, Slider, Spinner } from "./ui";
import {
  TEMPLATE_PX,
  TEMPLATE_CM,
  EXPORT_WIDTH,
  MIN_RECOMMENDED_WIDTH,
  FRONT_CENTER_U,
  FRONT_VISIBLE_FRACTION,
} from "@/lib/config";
import { INITIAL_TRANSFORM, paintTemplate } from "@/lib/drawDesign";
import { uploadToCloudinary } from "@/lib/cloudinary";

// La vista 3D (Three.js) se descarga recién cuando el cliente abre la pestaña.
const Mug3D = dynamic(() => import("./Mug3D"), {
  ssr: false,
  loading: () => (
    <div className="flex aspect-square flex-col items-center justify-center gap-3">
      <Spinner />
      <p className="text-sm font-medium">Cargando vista 3D…</p>
    </div>
  ),
});

const MIN_SCALE = 0.2;
const MAX_SCALE = 5;
const PX_PER_CM = TEMPLATE_PX.h / TEMPLATE_CM.h;
const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

// Colores rápidos para el fondo (espacios que la imagen no cubre)
const BG_SWATCHES = ["#ffffff", "#000000", "#1e1b4b", "#f97316"];

function newDesignId() {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

/**
 * Editor de taza.
 *  - "Plantilla": se edita directamente sobre la plantilla real de 21 × 9 cm (lo que se imprime).
 *  - "Vista 3D": taza 3D giratoria.
 * Props: onSaved({ url, publicId, designId }) cuando Cloudinary devolvió la URL.
 */
export default function MugEditor({ onSaved }) {
  const tplCanvasRef = useRef(null);
  const objectUrlRef = useRef(null);
  const pointers = useRef(new Map());
  const pinchRef = useRef(null);

  const [img, setImg] = useState(null);
  const [fileName, setFileName] = useState("");
  const [loadingImg, setLoadingImg] = useState(false);
  const [t, setT] = useState(INITIAL_TRANSFORM);
  const [bg, setBg] = useState(""); // "" = sin fondo (se imprime blanco)
  const [dragging, setDragging] = useState(false);
  const [phase, setPhase] = useState("idle"); // idle | rendering | uploading
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const [view, setView] = useState("edit"); // edit | 3d
  const [tpl, setTpl] = useState(null); // plantilla renderizada para la vista 3D

  const busy = phase !== "idle";

  useEffect(
    () => () => {
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    },
    []
  );

  // ── Carga de la imagen del cliente ───────────────────────────
  const loadFile = useCallback(async (file) => {
    setError("");
    setLoadingImg(true);
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.src = url;
    try {
      await image.decode();
    } catch {
      URL.revokeObjectURL(url);
      setLoadingImg(false);
      setError("No pudimos leer esa imagen. Probá con otra (PNG, JPG o WEBP).");
      return;
    }
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    objectUrlRef.current = url;
    setImg(image);
    setFileName(file.name);
    setT(INITIAL_TRANSFORM); // por defecto: rellena toda la plantilla
    setLoadingImg(false);
  }, []);

  // ── Atajos de encuadre ───────────────────────────────────────
  function applyFit(mode) {
    if (!img) return;
    const { w, h } = TEMPLATE_PX;
    const cover = Math.max(w / img.naturalWidth, h / img.naturalHeight);
    let scale = 1; // 1 = "cover": rellena los 21×9 cm (recorta lo que sobra)
    let x = 0;
    if (mode === "contain") {
      // entera, sin recortar nada
      scale = Math.min(w / img.naturalWidth, h / img.naturalHeight) / cover;
    }
    if (mode === "front") {
      // entera y centrada en la parte que se ve de frente
      const bandW = w * FRONT_VISIBLE_FRACTION;
      scale = Math.min(bandW / img.naturalWidth, h / img.naturalHeight) / cover;
      x = (FRONT_CENTER_U - 0.5) * w;
    }
    setT({ ...INITIAL_TRANSFORM, scale, x });
  }

  // ── Vista "Plantilla": lienzo 21×9 + guías ───────────────────
  useEffect(() => {
    if (view !== "edit") return;
    const c = tplCanvasRef.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    const { w, h } = TEMPLATE_PX;

    // Papel blanco: lo que no se cubre se imprime blanco
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, w, h);

    if (img) {
      paintTemplate(ctx, img, w, h, t, bg || null);
    } else {
      ctx.fillStyle = "rgba(139,92,246,0.10)";
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = "rgba(109,60,230,0.95)";
      ctx.font = "600 34px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("Tu diseño va acá · plantilla 21 × 9 cm", w / 2, h / 2);
    }
    drawTemplateGuides(ctx, w, h);
  }, [view, img, t, bg]);

  // ── Plantilla renderizada para la vista 3D (con pequeño retraso al editar) ──
  useEffect(() => {
    if (view === "edit" || !img) return;
    const id = setTimeout(() => setTpl(renderDesignCanvas(img, t, 2048, bg || null)), 80);
    return () => clearTimeout(id);
  }, [view, img, t, bg]);

  // ── Gestos sobre la plantilla: arrastrar (mover) y pellizcar (zoom) ──
  function toTemplateUnits(dx, dy) {
    const r = tplCanvasRef.current.getBoundingClientRect();
    return { x: (dx * TEMPLATE_PX.w) / r.width, y: (dy * TEMPLATE_PX.h) / r.height };
  }
  function pinchDist() {
    const [a, b] = [...pointers.current.values()];
    return Math.hypot(a.x - b.x, a.y - b.y);
  }

  function onPointerDown(e) {
    if (!img || busy) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 2) {
      pinchRef.current = { dist: pinchDist() || 1, scale: t.scale };
    }
    setDragging(true);
  }
  function onPointerMove(e) {
    const prev = pointers.current.get(e.pointerId);
    if (!prev) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pointers.current.size === 2 && pinchRef.current) {
      const ns = clamp(
        (pinchRef.current.scale * pinchDist()) / pinchRef.current.dist,
        MIN_SCALE,
        MAX_SCALE
      );
      setT((s) => ({ ...s, scale: ns }));
      return;
    }
    if (pointers.current.size === 1) {
      const u = toTemplateUnits(e.clientX - prev.x, e.clientY - prev.y);
      setT((s) => ({
        ...s,
        x: clamp(s.x + u.x, -TEMPLATE_PX.w, TEMPLATE_PX.w),
        y: clamp(s.y + u.y, -TEMPLATE_PX.h, TEMPLATE_PX.h),
      }));
    }
  }
  function onPointerUp(e) {
    pointers.current.delete(e.pointerId);
    pinchRef.current = null;
    if (pointers.current.size === 0) setDragging(false);
  }

  // Zoom con la rueda del mouse (listener no-pasivo para poder hacer preventDefault)
  useEffect(() => {
    const c = tplCanvasRef.current;
    if (!c || !img) return;
    const onWheel = (e) => {
      e.preventDefault();
      setT((s) => ({
        ...s,
        scale: clamp(s.scale * Math.exp(-e.deltaY * 0.0015), MIN_SCALE, MAX_SCALE),
      }));
    };
    c.addEventListener("wheel", onWheel, { passive: false });
    return () => c.removeEventListener("wheel", onWheel);
  }, [img]);

  // ── Guardar: exporta la plantilla 21×9 y sube a Cloudinary ───
  async function handleSave() {
    if (!img || busy) return;
    setError("");
    setProgress(0);
    setPhase("rendering");

    // Deja que React pinte el cartel "Generando…" antes del trabajo pesado
    await new Promise((r) => setTimeout(r, 60));

    try {
      // Archivo final: la plantilla COMPLETA de 21 × 9 cm a 300 dpi (sin taza ni sombras).
      const out = renderDesignCanvas(img, t, EXPORT_WIDTH, bg || null);

      const blob = await new Promise((resolve, reject) =>
        out.toBlob(
          (b) => (b ? resolve(b) : reject(new Error("No se pudo generar la imagen final."))),
          "image/png"
        )
      );

      setPhase("uploading");
      const designId = newDesignId();
      const res = await uploadToCloudinary(blob, { designId }, setProgress);

      onSaved({ url: res.secure_url, publicId: res.public_id, designId });
    } catch (err) {
      setError(err.message || "Ocurrió un error al guardar tu diseño. Probá de nuevo.");
      setPhase("idle");
    }
  }

  const lowRes = img && Math.max(img.naturalWidth, img.naturalHeight) < MIN_RECOMMENDED_WIDTH;
  const tabs = [
    ["edit", "✏️ Plantilla"],
    ["3d", "🧊 Vista 3D"],
  ];
  const hint = {
    edit: "Arrastrá el diseño para moverlo · pellizcá o usá la rueda para hacer zoom",
    "3d": "Arrastrá para girar la taza · pellizcá o usá la rueda para acercar",
  };

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_380px] lg:gap-8">
      {/* ── Vista previa ── */}
      <section aria-label="Vista previa">
        <div
          className="mb-3 inline-flex max-w-full rounded-full border border-white/10 bg-white/[0.04] p-1"
          role="tablist"
        >
          {tabs.map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={view === id}
              disabled={id !== "edit" && !img}
              title={id !== "edit" && !img ? "Subí una imagen primero" : undefined}
              onClick={() => setView(id)}
              className={`whitespace-nowrap rounded-full px-3 py-1.5 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-40 sm:px-4 ${
                view === id
                  ? "bg-gradient-to-r from-neon-violet to-neon-pink text-white"
                  : "text-white/70 hover:text-white"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-ink-900 shadow-glow">
          {/* Los canvas quedan montados (solo ocultos) para no perder el dibujo al cambiar de pestaña */}
          <div className={view === "edit" ? "p-3 sm:p-4" : "hidden"}>
            <canvas
              ref={tplCanvasRef}
              width={TEMPLATE_PX.w}
              height={TEMPLATE_PX.h}
              className={`canvas-touch block h-auto w-full rounded-lg ${
                img ? (dragging ? "cursor-grabbing" : "cursor-grab") : ""
              }`}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
            />
            <p className="mt-3 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs text-white/50">
              <span>📐 Plantilla real: {TEMPLATE_CM.w} × {TEMPLATE_CM.h} cm</span>
              <span className="inline-flex items-center gap-1.5">
                <span className="inline-block h-3 w-5 rounded-sm border border-neon-violet" />
                Zona central (la que se ve al mirar el centro)
              </span>
            </p>
          </div>

          {view === "3d" && <Mug3D designCanvas={tpl} />}

          {loadingImg && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-ink-950/70 backdrop-blur-sm">
              <Spinner />
              <p className="text-sm font-medium">Generando vista previa…</p>
            </div>
          )}
        </div>

        {img && <p className="mt-3 text-center text-xs text-white/50">{hint[view]}</p>}
      </section>

      {/* ── Panel lateral ── */}
      <aside className="flex flex-col gap-4">
        {!img ? (
          <>
            <UploadZone onFile={loadFile} disabled={loadingImg} />
            {error && (
              <p role="alert" className="text-sm text-rose-400">
                {error}
              </p>
            )}
          </>
        ) : (
          <>
            {/* Qué espacio de la taza ocupar */}
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <p className="truncate text-sm text-white/70" title={fileName}>
                  📎 {fileName}
                </p>
              </div>

              <p className="mb-2 text-sm font-medium text-white/90">¿Qué espacio de la taza ocupa?</p>
              <div className="grid grid-cols-3 gap-2">
                <FitButton onClick={() => applyFit("cover")} disabled={busy} icon="🔲" label="Rellenar todo" />
                <FitButton onClick={() => applyFit("contain")} disabled={busy} icon="🖼️" label="Ajustar entera" />
                <FitButton onClick={() => applyFit("front")} disabled={busy} icon="🎯" label="Solo al frente" />
              </div>
              <p className="mt-2 text-xs leading-relaxed text-white/45">
                <b className="font-medium text-white/60">Rellenar</b> cubre toda la vuelta (recorta lo
                que sobra). <b className="font-medium text-white/60">Ajustar</b> muestra la imagen
                entera. <b className="font-medium text-white/60">Al frente</b> la deja centrada en la
                parte visible.
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
              <div className="mb-4 flex items-center justify-between">
                <p className="text-sm font-medium text-white/90">Ajuste fino</p>
                <button
                  type="button"
                  onClick={() => setT(INITIAL_TRANSFORM)}
                  disabled={busy}
                  className="rounded-lg border border-white/15 px-3 py-1.5 text-xs font-medium text-white/80 transition hover:bg-white/10 disabled:opacity-40"
                >
                  Restablecer
                </button>
              </div>

              <div className="space-y-4">
                <Slider
                  label="Zoom"
                  value={t.scale}
                  min={MIN_SCALE}
                  max={MAX_SCALE}
                  step={0.01}
                  display={`${Math.round(t.scale * 100)}%`}
                  disabled={busy}
                  onChange={(v) => setT((s) => ({ ...s, scale: v }))}
                />
                <Slider
                  label="Posición horizontal"
                  value={t.x}
                  min={-TEMPLATE_PX.w}
                  max={TEMPLATE_PX.w}
                  step={1}
                  display={`${(t.x / PX_PER_CM).toFixed(1)} cm`}
                  disabled={busy}
                  onChange={(v) => setT((s) => ({ ...s, x: v }))}
                />
                <Slider
                  label="Posición vertical"
                  value={t.y}
                  min={-TEMPLATE_PX.h}
                  max={TEMPLATE_PX.h}
                  step={1}
                  display={`${(t.y / PX_PER_CM).toFixed(1)} cm`}
                  disabled={busy}
                  onChange={(v) => setT((s) => ({ ...s, y: v }))}
                />
                <Slider
                  label="Rotación"
                  value={t.rotation}
                  min={-180}
                  max={180}
                  step={1}
                  display={`${Math.round(t.rotation)}°`}
                  disabled={busy}
                  onChange={(v) => setT((s) => ({ ...s, rotation: v }))}
                />
              </div>

              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  setT((s) => ({
                    ...s,
                    rotation: ((((s.rotation + 90 + 180) % 360) + 360) % 360) - 180,
                  }))
                }
                className="mt-4 w-full rounded-lg border border-white/15 px-3 py-2 text-sm font-medium text-white/80 transition hover:bg-white/10 disabled:opacity-40"
              >
                ↻ Girar 90°
              </button>
            </div>

            {/* Color de fondo para los espacios vacíos */}
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
              <p className="mb-1 text-sm font-medium text-white/90">Color de fondo</p>
              <p className="mb-3 text-xs text-white/45">
                Rellena los espacios que tu imagen no cubre.
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setBg("")}
                  className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition disabled:opacity-40 ${
                    bg === "" ? "border-neon-violet bg-neon-violet/20 text-white" : "border-white/15 text-white/70 hover:bg-white/10"
                  }`}
                >
                  Sin fondo
                </button>
                {BG_SWATCHES.map((c) => (
                  <button
                    key={c}
                    type="button"
                    aria-label={`Fondo ${c}`}
                    disabled={busy}
                    onClick={() => setBg(c)}
                    style={{ backgroundColor: c }}
                    className={`h-8 w-8 rounded-full border-2 transition disabled:opacity-40 ${
                      bg === c ? "border-neon-violet" : "border-white/25"
                    }`}
                  />
                ))}
                <label className="relative flex h-8 cursor-pointer items-center gap-2 rounded-lg border border-white/15 px-2.5 text-xs text-white/70 transition hover:bg-white/10">
                  🎨 Otro
                  <input
                    type="color"
                    value={bg || "#ffffff"}
                    disabled={busy}
                    onChange={(e) => setBg(e.target.value)}
                    className="absolute inset-0 cursor-pointer opacity-0"
                  />
                </label>
              </div>
            </div>

            {lowRes && (
              <p className="rounded-xl border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-sm text-amber-200">
                ⚠️ Tu imagen es chica ({img.naturalWidth}×{img.naturalHeight} px). Para llenar toda la
                taza ({TEMPLATE_CM.w} × {TEMPLATE_CM.h} cm) conviene una de al menos {EXPORT_WIDTH}{" "}
                px de ancho; si no, puede salir pixelada.
              </p>
            )}

            <UploadZone onFile={loadFile} compact disabled={busy || loadingImg} />
          </>
        )}

        {error && img && (
          <p
            role="alert"
            className="rounded-xl border border-rose-400/30 bg-rose-400/10 px-4 py-3 text-sm text-rose-200"
          >
            {error}
          </p>
        )}

        {/* Botón de guardado (queda pegado abajo en el celular) */}
        <div className="sticky bottom-3 z-20 -mx-1 rounded-2xl bg-ink-950/80 p-1 backdrop-blur lg:static lg:bg-transparent lg:p-0 lg:backdrop-blur-none">
          <button
            type="button"
            onClick={handleSave}
            disabled={!img || busy}
            className="relative w-full overflow-hidden rounded-2xl bg-gradient-to-r from-neon-violet to-neon-pink px-6 py-4 font-display text-base font-semibold text-white shadow-glow transition enabled:hover:brightness-110 enabled:active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-40"
          >
            {phase === "uploading" && (
              <span
                className="absolute inset-y-0 left-0 bg-white/25 transition-[width]"
                style={{ width: `${progress}%` }}
                aria-hidden
              />
            )}
            <span className="relative flex items-center justify-center gap-2">
              {busy && <Spinner small />}
              {phase === "rendering" && "Generando archivo final…"}
              {phase === "uploading" && `Subiendo diseño… ${progress}%`}
              {phase === "idle" && "Guardar mi diseño"}
            </span>
          </button>
        </div>
      </aside>
    </div>
  );
}

/* ── Helpers de dibujo ─────────────────────────────────────── */

/**
 * Renderiza la plantilla completa (21×9 cm) a un ancho dado, SIN taza ni guías.
 * Se usa para el archivo que se sube a Cloudinary y para las vista 3D.
 */
function renderDesignCanvas(img, t, width, bg) {
  const k = width / TEMPLATE_PX.w;
  const out = document.createElement("canvas");
  out.width = width;
  out.height = Math.round(TEMPLATE_PX.h * k);
  const octx = out.getContext("2d");
  octx.scale(k, k);
  paintTemplate(octx, img, TEMPLATE_PX.w, TEMPLATE_PX.h, t, bg);
  return out;
}

/** Guías sobre la plantilla (solo en pantalla, NO van en el archivo final). */
function drawTemplateGuides(ctx, w, h) {
  const bandW = w * FRONT_VISIBLE_FRACTION;
  const x0 = w * FRONT_CENTER_U - bandW / 2;
  const x1 = x0 + bandW;

  // Oscurece lo que queda fuera de la zona de frente (se ve al girar la taza)
  ctx.fillStyle = "rgba(7,7,13,0.42)";
  if (x0 > 0) ctx.fillRect(0, 0, x0, h);
  if (x1 < w) ctx.fillRect(x1, 0, w - x1, h);

  // Bordes de la zona de frente
  ctx.save();
  ctx.setLineDash([14, 10]);
  ctx.lineWidth = 4;
  ctx.strokeStyle = "rgba(255,255,255,0.9)";
  ctx.beginPath();
  ctx.moveTo(x0, 0);
  ctx.lineTo(x0, h);
  ctx.moveTo(x1, 0);
  ctx.lineTo(x1, h);
  ctx.stroke();
  ctx.lineWidth = 2;
  ctx.strokeStyle = "rgba(139,92,246,1)";
  ctx.beginPath();
  ctx.moveTo(x0, 0);
  ctx.lineTo(x0, h);
  ctx.moveTo(x1, 0);
  ctx.lineTo(x1, h);
  ctx.stroke();
  ctx.restore();

  // Etiquetas
  ctx.font = "600 24px system-ui, sans-serif";
  ctx.textBaseline = "middle";
  const pill = (text, cx, cy) => {
    const tw = ctx.measureText(text).width + 28;
    ctx.fillStyle = "rgba(13,13,24,0.78)";
    ctx.beginPath();
    ctx.roundRect(cx - tw / 2, cy - 18, tw, 36, 18);
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.textAlign = "center";
    ctx.fillText(text, cx, cy + 1);
  };
  pill("FRENTE", w * FRONT_CENTER_U, 30);
  if (x0 > 90) pill("al girar", x0 / 2, 30);
  if (w - x1 > 90) pill("al girar", x1 + (w - x1) / 2, 30);

  // Borde de la plantilla
  ctx.strokeStyle = "rgba(0,0,0,0.25)";
  ctx.lineWidth = 2;
  ctx.strokeRect(1, 1, w - 2, h - 2);
}
