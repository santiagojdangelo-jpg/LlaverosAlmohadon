"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import UploadZone from "./UploadZone";
import { FitButton, Slider, Spinner } from "./ui";
import {
  PILLOW_CM,
  PILLOW_SEAM_CM,
  PILLOW_PX_PER_CM,
  PILLOW_TEMPLATE_PX,
  PILLOW_EXPORT_PX_PER_CM,
  PILLOW_LOOP_X,
  PILLOW_MIN_RECOMMENDED,
} from "@/lib/config";
import { INITIAL_TRANSFORM, paintTemplate } from "@/lib/drawDesign";
import { uploadToCloudinary } from "@/lib/cloudinary";

// La vista 3D (Three.js) se descarga recién cuando el cliente abre la pestaña.
const Pillow3D = dynamic(() => import("./Pillow3D"), {
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
const TPL = PILLOW_TEMPLATE_PX;
const SEAM_PX = PILLOW_SEAM_CM * PILLOW_PX_PER_CM;
const EXPORT_W = Math.round(PILLOW_CM.w * PILLOW_EXPORT_PX_PER_CM);
const EXPORT_H = Math.round(PILLOW_CM.h * PILLOW_EXPORT_PX_PER_CM);
const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

const BG_SWATCHES = ["#ffffff", "#000000", "#1e1b4b", "#f97316"];

function newDesignId() {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

/**
 * Editor del llavero almohadón.
 *  - "Plantilla": se edita sobre el panel real de 7 × 7 cm (lo que se imprime en la tela).
 *  - "Vista 3D": el almohadón inflado, con cinta y argolla, balanceándose.
 * Props: onSaved({ url, publicId, designId }) cuando Cloudinary devolvió la URL.
 */
export default function PillowEditor({ onSaved }) {
  const tplCanvasRef = useRef(null);
  const objectUrlRef = useRef(null);
  const pointers = useRef(new Map());
  const pinchRef = useRef(null);

  const [img, setImg] = useState(null);
  const [fileName, setFileName] = useState("");
  const [loadingImg, setLoadingImg] = useState(false);
  const [t, setT] = useState(INITIAL_TRANSFORM);
  const [bg, setBg] = useState("");
  const [dragging, setDragging] = useState(false);
  const [phase, setPhase] = useState("idle"); // idle | rendering | uploading
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const [view, setView] = useState("edit"); // edit | 3d
  const [tpl, setTpl] = useState(null);

  const busy = phase !== "idle";

  useEffect(
    () => () => {
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    },
    []
  );

  // ── Carga de la imagen ───────────────────────────────────────
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
    setT(INITIAL_TRANSFORM);
    setLoadingImg(false);
  }, []);

  // ── Atajos de encuadre ───────────────────────────────────────
  function applyFit(mode) {
    if (!img) return;
    const cover = Math.max(TPL.w / img.naturalWidth, TPL.h / img.naturalHeight);
    let scale = 1; // 1 = rellena todo el panel (recorta lo que sobra)
    if (mode === "contain") {
      scale = Math.min(TPL.w / img.naturalWidth, TPL.h / img.naturalHeight) / cover;
    }
    if (mode === "safe") {
      // entera y dentro de la zona segura (sin tocar la costura)
      const sw = TPL.w - 2 * SEAM_PX;
      const sh = TPL.h - 2 * SEAM_PX;
      scale = Math.min(sw / img.naturalWidth, sh / img.naturalHeight) / cover;
    }
    setT({ ...INITIAL_TRANSFORM, scale });
  }

  // ── Vista "Plantilla": panel 7×7 + guías ─────────────────────
  useEffect(() => {
    if (view !== "edit") return;
    const c = tplCanvasRef.current;
    if (!c) return;
    const ctx = c.getContext("2d");

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, TPL.w, TPL.h);

    if (img) {
      paintTemplate(ctx, img, TPL.w, TPL.h, t, bg || null);
    } else {
      ctx.fillStyle = "rgba(139,92,246,0.10)";
      ctx.fillRect(0, 0, TPL.w, TPL.h);
      ctx.fillStyle = "rgba(109,60,230,0.95)";
      ctx.font = "600 34px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("Tu diseño va acá", TPL.w / 2, TPL.h / 2 - 22);
      ctx.font = "500 28px system-ui, sans-serif";
      ctx.fillText(`${PILLOW_CM.w} × ${PILLOW_CM.h} cm`, TPL.w / 2, TPL.h / 2 + 22);
    }
    drawGuides(ctx);
  }, [view, img, t, bg]);

  // ── Panel renderizado para la vista 3D ───────────────────────
  useEffect(() => {
    if (view === "edit" || !img) return;
    const id = setTimeout(() => setTpl(renderDesignCanvas(img, t, 1024, bg || null)), 80);
    return () => clearTimeout(id);
  }, [view, img, t, bg]);

  // ── Gestos: arrastrar (mover) y pellizcar (zoom) ─────────────
  function toTemplateUnits(dx, dy) {
    const r = tplCanvasRef.current.getBoundingClientRect();
    return { x: (dx * TPL.w) / r.width, y: (dy * TPL.h) / r.height };
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
        x: clamp(s.x + u.x, -TPL.w, TPL.w),
        y: clamp(s.y + u.y, -TPL.h, TPL.h),
      }));
    }
  }
  function onPointerUp(e) {
    pointers.current.delete(e.pointerId);
    pinchRef.current = null;
    if (pointers.current.size === 0) setDragging(false);
  }

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

  // ── Guardar: exporta el panel 7×7 y sube a Cloudinary ────────
  async function handleSave() {
    if (!img || busy) return;
    setError("");
    setProgress(0);
    setPhase("rendering");
    await new Promise((r) => setTimeout(r, 60));

    try {
      // Archivo final: el panel COMPLETO de 7 × 7 cm (sin guías ni 3D).
      const out = renderDesignCanvas(img, t, EXPORT_W, bg || null);
      const blob = await new Promise((resolve, reject) =>
        out.toBlob(
          (b) => (b ? resolve(b) : reject(new Error("No se pudo generar la imagen final."))),
          "image/png"
        )
      );

      setPhase("uploading");
      const designId = newDesignId();
      const res = await uploadToCloudinary(blob, { designId, product: "llavero" }, setProgress);
      onSaved({ url: res.secure_url, publicId: res.public_id, designId });
    } catch (err) {
      setError(err.message || "Ocurrió un error al guardar tu diseño. Probá de nuevo.");
      setPhase("idle");
    }
  }

  const lowRes = img && Math.max(img.naturalWidth, img.naturalHeight) < PILLOW_MIN_RECOMMENDED;
  const tabs = [
    ["edit", "✏️ Plantilla"],
    ["3d", "🧊 Vista 3D"],
  ];
  const hint = {
    edit: "Arrastrá el diseño para moverlo · pellizcá o usá la rueda para hacer zoom",
    "3d": "Arrastrá para girar el llavero · pellizcá o usá la rueda para acercar",
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
          <div className={view === "edit" ? "p-3 sm:p-4" : "hidden"}>
            <canvas
              ref={tplCanvasRef}
              width={TPL.w}
              height={TPL.h}
              className={`canvas-touch mx-auto block h-auto w-full max-w-[620px] rounded-lg ${
                img ? (dragging ? "cursor-grabbing" : "cursor-grab") : ""
              }`}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
            />
            <p className="mt-3 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs text-white/50">
              <span>
                📐 Tela real: {PILLOW_CM.w} × {PILLOW_CM.h} cm
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="inline-block h-3 w-5 rounded-sm border border-dashed border-neon-violet" />
                Zona segura (se ve entera)
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="inline-block h-3 w-5 rounded-sm bg-ink-950/60 ring-1 ring-white/20" />
                Costura ({PILLOW_SEAM_CM * 10} mm)
              </span>
            </p>
          </div>

          {view === "3d" && <Pillow3D designCanvas={tpl} />}

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
            <p className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-xs leading-relaxed text-white/50">
              💡 El llavero mide aprox. {PILLOW_CM.w} × {PILLOW_CM.h} cm y se imprime solo por
              adelante. Los {PILLOW_SEAM_CM * 10} mm del borde quedan en la costura, así que
              conviene que lo importante quede un poco más adentro.
            </p>
          </>
        ) : (
          <>
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
              <p className="mb-3 truncate text-sm text-white/70" title={fileName}>
                📎 {fileName}
              </p>

              <p className="mb-2 text-sm font-medium text-white/90">¿Cómo se acomoda en el llavero?</p>
              <div className="grid grid-cols-3 gap-2">
                <FitButton onClick={() => applyFit("cover")} disabled={busy} icon="🔲" label="Rellenar todo" />
                <FitButton onClick={() => applyFit("safe")} disabled={busy} icon="🎯" label="Zona segura" />
                <FitButton onClick={() => applyFit("contain")} disabled={busy} icon="🖼️" label="Ajustar entera" />
              </div>
              <p className="mt-2 text-xs leading-relaxed text-white/45">
                <b className="font-medium text-white/60">Rellenar</b> cubre toda la tela (recorta lo
                que sobra). <b className="font-medium text-white/60">Zona segura</b> la muestra
                entera sin tocar la costura. <b className="font-medium text-white/60">Entera</b> la
                ajusta al panel completo.
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
                  min={-TPL.w}
                  max={TPL.w}
                  step={1}
                  display={`${(t.x / PILLOW_PX_PER_CM).toFixed(1)} cm`}
                  disabled={busy}
                  onChange={(v) => setT((s) => ({ ...s, x: v }))}
                />
                <Slider
                  label="Posición vertical"
                  value={t.y}
                  min={-TPL.h}
                  max={TPL.h}
                  step={1}
                  display={`${(t.y / PILLOW_PX_PER_CM).toFixed(1)} cm`}
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

            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
              <p className="mb-1 text-sm font-medium text-white/90">Color de fondo</p>
              <p className="mb-3 text-xs text-white/45">
                Rellena los espacios que tu imagen no cubre. “Sin fondo” deja la tela blanca.
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setBg("")}
                  className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition disabled:opacity-40 ${
                    bg === ""
                      ? "border-neon-violet bg-neon-violet/20 text-white"
                      : "border-white/15 text-white/70 hover:bg-white/10"
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
                ⚠️ Tu imagen es chica ({img.naturalWidth}×{img.naturalHeight} px). Para el llavero (
                {PILLOW_CM.w} × {PILLOW_CM.h} cm) conviene una de al menos {PILLOW_MIN_RECOMMENDED} px;
                si no, puede salir pixelada.
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

/** Renderiza el panel completo (7×7 cm) a un ancho dado, SIN guías. Va a Cloudinary y a la vista 3D. */
function renderDesignCanvas(img, t, width, bg) {
  const k = width / TPL.w;
  const out = document.createElement("canvas");
  out.width = width;
  out.height = Math.round(TPL.h * k);
  const octx = out.getContext("2d");
  octx.scale(k, k);
  paintTemplate(octx, img, TPL.w, TPL.h, t, bg);
  return out;
}

/** Guías sobre el panel (solo en pantalla, NO van en el archivo final). */
function drawGuides(ctx) {
  const { w, h } = TPL;
  const s = SEAM_PX;

  // Costura: se oscurece el borde
  ctx.fillStyle = "rgba(7,7,13,0.45)";
  ctx.fillRect(0, 0, w, s);
  ctx.fillRect(0, h - s, w, s);
  ctx.fillRect(0, s, s, h - 2 * s);
  ctx.fillRect(w - s, s, s, h - 2 * s);

  // Línea de la zona segura
  ctx.save();
  ctx.setLineDash([14, 10]);
  ctx.lineWidth = 4;
  ctx.strokeStyle = "rgba(255,255,255,0.9)";
  ctx.strokeRect(s, s, w - 2 * s, h - 2 * s);
  ctx.lineWidth = 2;
  ctx.strokeStyle = "rgba(139,92,246,1)";
  ctx.strokeRect(s, s, w - 2 * s, h - 2 * s);
  ctx.restore();

  // Dónde sale la cinta (arriba, hacia una esquina)
  const cx = w / 2 + PILLOW_LOOP_X * (w / 2) * 0.9;
  const tabW = 0.9 * PILLOW_PX_PER_CM;
  ctx.fillStyle = "rgba(236,72,153,0.9)";
  ctx.beginPath();
  ctx.roundRect(cx - tabW / 2, 0, tabW, s + 6, [0, 0, 8, 8]);
  ctx.fill();
  ctx.font = "600 20px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#fff";
  ctx.fillText("cinta", cx, s / 2 + 2);

  // Borde de la plantilla
  ctx.strokeStyle = "rgba(0,0,0,0.25)";
  ctx.lineWidth = 2;
  ctx.strokeRect(1, 1, w - 2, h - 2);
}
