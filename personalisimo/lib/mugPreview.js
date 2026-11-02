import {
  CANVAS,
  MUG_PHOTO,
  TEMPLATE_PX,
  TEMPLATE_CM,
  MUG_CIRCUMFERENCE_CM,
  FRONT_CENTER_U,
} from "./config";
import { drawFallbackMugBack, drawFallbackMugFront } from "./drawDesign";

// ════════════════════════════════════════════════════════════════
//  Vista "Taza": envuelve la plantilla 21×9 alrededor de la foto de la taza.
//  Proyección cilíndrica: cada columna de pantalla muestra la franja de la
//  plantilla que realmente queda de frente (el centro se ve ancho y los
//  costados se comprimen, como en una taza real).
// ════════════════════════════════════════════════════════════════

let layers = null; // capas auxiliares: se crean una sola vez
function getLayers() {
  if (!layers) {
    const make = () => {
      const c = document.createElement("canvas");
      c.width = CANVAS.width;
      c.height = CANVAS.height;
      return c;
    };
    layers = { design: make(), gloss: make() };
  }
  return layers;
}

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {{ mask: HTMLImageElement|null, tpl: HTMLCanvasElement|null }} opts
 *   mask: foto de la taza (null → taza genérica de respaldo)
 *   tpl:  plantilla ya renderizada (diseño encuadrado, proporción 21:9)
 */
export function drawMugPreview(ctx, { mask, tpl }) {
  const { width: W, height: H } = CANVAS;
  const { cx, r, top, height } = MUG_PHOTO;
  const zone = { x: cx - r, y: top, w: r * 2, h: height };

  ctx.clearRect(0, 0, W, H);

  // Fondo + taza
  if (mask) {
    const bg = ctx.createRadialGradient(W / 2, H * 0.55, 80, W / 2, H * 0.55, W * 0.75);
    bg.addColorStop(0, "#23233f");
    bg.addColorStop(1, "#0b0b17");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);
    ctx.drawImage(mask, 0, 0, W, H);
  } else {
    drawFallbackMugBack(ctx, W, H, zone);
  }

  if (!tpl) {
    if (!mask) drawFallbackMugFront(ctx, zone);
    return;
  }

  const { design, gloss } = getLayers();
  const d = design.getContext("2d");
  d.globalCompositeOperation = "source-over";
  d.clearRect(0, 0, W, H);
  d.imageSmoothingQuality = "high";

  // Equivalencias entre la plantilla (px) y la vuelta de la taza
  const pxPerCm = TEMPLATE_PX.h / TEMPLATE_CM.h;
  const rEff = (MUG_CIRCUMFERENCE_CM * pxPerCm) / (2 * Math.PI); // radio, en px de plantilla
  const k = tpl.width / TEMPLATE_PX.w; // la plantilla puede venir a mayor resolución
  const uCenter = TEMPLATE_PX.w * FRONT_CENTER_U;

  // Una tira de 1 px por cada columna visible del cuerpo
  for (let x = Math.floor(cx - r); x < Math.ceil(cx + r); x++) {
    const a = Math.max(-1, Math.min(1, (x - cx) / r));
    const b = Math.max(-1, Math.min(1, (x + 1 - cx) / r));
    const u1 = uCenter + Math.asin(a) * rEff;
    const u2 = uCenter + Math.asin(b) * rEff;
    if (u2 <= 0 || u1 >= TEMPLATE_PX.w) continue;
    d.drawImage(tpl, u1 * k, 0, Math.max((u2 - u1) * k, 0.5), tpl.height, x, top, 1, height);
  }

  // Oscurece los costados: el diseño "se va" hacia atrás
  d.globalCompositeOperation = "source-atop";
  const edge = d.createLinearGradient(cx - r, 0, cx + r, 0);
  edge.addColorStop(0, "rgba(0,0,0,0.42)");
  edge.addColorStop(0.2, "rgba(0,0,0,0)");
  edge.addColorStop(0.8, "rgba(0,0,0,0)");
  edge.addColorStop(1, "rgba(0,0,0,0.48)");
  d.fillStyle = edge;
  d.fillRect(cx - r, top, r * 2, height);

  if (mask) {
    d.globalCompositeOperation = "destination-in"; // solo donde hay taza
    d.drawImage(mask, 0, 0, W, H);
  }
  d.globalCompositeOperation = "source-over";

  ctx.save();
  ctx.globalCompositeOperation = "multiply";
  ctx.drawImage(design, 0, 0);
  ctx.restore();

  if (!mask) {
    drawFallbackMugFront(ctx, zone);
    return;
  }

  // Brillo vertical de la cerámica
  const g = gloss.getContext("2d");
  g.globalCompositeOperation = "source-over";
  g.clearRect(0, 0, W, H);
  const gx = cx - r + r * 2 * 0.14;
  const gw = r * 2 * 0.16;
  const sh = g.createLinearGradient(gx, 0, gx + gw, 0);
  sh.addColorStop(0, "rgba(255,255,255,0)");
  sh.addColorStop(0.5, "rgba(255,255,255,0.55)");
  sh.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = sh;
  g.fillRect(gx, top, gw, height);
  g.globalCompositeOperation = "destination-in";
  g.drawImage(mask, 0, 0, W, H);
  g.globalCompositeOperation = "source-over";

  ctx.save();
  ctx.globalCompositeOperation = "screen";
  ctx.globalAlpha = 0.5;
  ctx.drawImage(gloss, 0, 0);
  ctx.restore();
}
