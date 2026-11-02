// ════════════════════════════════════════════════════════════════
//  Lógica de dibujo compartida entre la vista previa y la exportación.
//  Así lo que ve el cliente es EXACTAMENTE lo que se imprime.
// ════════════════════════════════════════════════════════════════

/**
 * Estado de la transformación del diseño (en unidades de la zona imprimible):
 *   x, y     → desplazamiento del centro del diseño respecto al centro de la zona
 *   scale    → 1 = la imagen "cubre" la zona (cover). <1 deja bordes, >1 hace zoom.
 *   rotation → grados
 */
export const INITIAL_TRANSFORM = { x: 0, y: 0, scale: 1, rotation: 0 };

/**
 * Dibuja el diseño dentro de un rectángulo (0,0,zoneW,zoneH) del contexto actual,
 * recortado a esa zona. El llamador hace ctx.translate() a la esquina de la zona.
 */
export function drawDesign(ctx, img, zoneW, zoneH, t) {
  const base = Math.max(zoneW / img.naturalWidth, zoneH / img.naturalHeight);
  const s = base * t.scale;

  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, zoneW, zoneH);
  ctx.clip();

  ctx.translate(zoneW / 2 + t.x, zoneH / 2 + t.y);
  ctx.rotate((t.rotation * Math.PI) / 180);
  ctx.scale(s, s);
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2);
  ctx.restore();
}

/**
 * Pinta la plantilla completa: color de fondo opcional (para los espacios vacíos)
 * y encima el diseño del cliente. Se usa en el editor, en las vistas previas y
 * en el archivo final que se sube a Cloudinary.
 */
export function paintTemplate(ctx, img, w, h, t, bg) {
  if (bg) {
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);
  }
  drawDesign(ctx, img, w, h, t);
}

/**
 * Taza genérica de prueba, usada cuando todavía no configuraste MUG_MASK_URL.
 * Se dibuja ANTES del diseño (cuerpo) y DESPUÉS (brillos).
 */
export function drawFallbackMugBack(ctx, W, H, zone) {
  // Fondo
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, "#1a1a33");
  bg.addColorStop(1, "#0b0b17");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // Sombra en el piso
  ctx.fillStyle = "rgba(0,0,0,0.35)";
  ctx.beginPath();
  ctx.ellipse(W / 2, zone.y + zone.h + 90, zone.w * 0.7, 26, 0, 0, Math.PI * 2);
  ctx.fill();

  const bodyX = zone.x - 28;
  const bodyW = zone.w + 56;
  const bodyY = zone.y - 70;
  const bodyH = zone.h + 140;

  // Asa
  ctx.strokeStyle = "#e9e9f2";
  ctx.lineWidth = 34;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(bodyX + bodyW - 6, bodyY + 60);
  ctx.bezierCurveTo(
    bodyX + bodyW + 170, bodyY + 40,
    bodyX + bodyW + 170, bodyY + bodyH - 40,
    bodyX + bodyW - 6, bodyY + bodyH - 60
  );
  ctx.stroke();

  // Cuerpo cerámico
  ctx.fillStyle = "#f3f3fa";
  roundRect(ctx, bodyX, bodyY, bodyW, bodyH, 26);
  ctx.fill();
}

export function drawFallbackMugFront(ctx, zone) {
  const bodyX = zone.x - 28;
  const bodyW = zone.w + 56;
  const bodyY = zone.y - 70;
  const bodyH = zone.h + 140;

  // Sombreado cilíndrico (oscuro en los bordes, claro al centro)
  const cyl = ctx.createLinearGradient(bodyX, 0, bodyX + bodyW, 0);
  cyl.addColorStop(0, "rgba(0,0,0,0.38)");
  cyl.addColorStop(0.12, "rgba(0,0,0,0.04)");
  cyl.addColorStop(0.5, "rgba(255,255,255,0.00)");
  cyl.addColorStop(0.88, "rgba(0,0,0,0.10)");
  cyl.addColorStop(1, "rgba(0,0,0,0.45)");
  ctx.fillStyle = cyl;
  roundRect(ctx, bodyX, bodyY, bodyW, bodyH, 26);
  ctx.fill();

  // Brillo vertical
  const gloss = ctx.createLinearGradient(bodyX + bodyW * 0.18, 0, bodyX + bodyW * 0.3, 0);
  gloss.addColorStop(0, "rgba(255,255,255,0)");
  gloss.addColorStop(0.5, "rgba(255,255,255,0.38)");
  gloss.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = gloss;
  ctx.fillRect(bodyX + bodyW * 0.18, bodyY + 18, bodyW * 0.12, bodyH - 36);

  // Bordes superior e inferior (borde de la taza)
  ctx.fillStyle = "rgba(0,0,0,0.12)";
  ctx.fillRect(bodyX, bodyY, bodyW, 10);
  ctx.fillRect(bodyX, bodyY + bodyH - 10, bodyW, 10);
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// ════════════════════════════════════════════════════════════════
//  PLANTILLA DESPLEGADA + PROYECCIÓN SOBRE LA TAZA
// ════════════════════════════════════════════════════════════════

/**
 * Guías sobre la plantilla 21×9: marca qué franja se ve de frente y cuáles son
 * los costados. Solo se dibujan en pantalla: NO van en el archivo que se sube.
 */
export function drawTemplateGuides(ctx, W, H, frontFraction, empty) {
  const fw = W * frontFraction;
  const fx = (W - fw) / 2;
  ctx.save();

  // Costados levemente sombreados
  ctx.fillStyle = "rgba(20,20,60,0.12)";
  ctx.fillRect(0, 0, fx, H);
  ctx.fillRect(fx + fw, 0, fx, H);

  // Franja de vista frontal
  ctx.setLineDash([14, 10]);
  ctx.strokeStyle = "rgba(124,58,237,0.95)";
  ctx.lineWidth = 3;
  ctx.strokeRect(fx, 1.5, fw, H - 3);
  ctx.setLineDash([]);

  // Línea del centro
  ctx.strokeStyle = "rgba(124,58,237,0.4)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(W / 2, 0);
  ctx.lineTo(W / 2, H);
  ctx.stroke();

  // Etiquetas (con halo blanco para que se lean sobre cualquier imagen)
  const label = (text, x, y, color) => {
    ctx.font = "700 20px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.lineJoin = "round";
    ctx.lineWidth = 6;
    ctx.strokeStyle = "rgba(255,255,255,0.9)";
    ctx.strokeText(text, x, y);
    ctx.fillStyle = color;
    ctx.fillText(text, x, y);
  };
  label("VISTA FRONTAL", W / 2, 10, "rgba(109,40,217,1)");
  label("COSTADO", fx / 2, 10, "rgba(71,71,110,1)");
  label("COSTADO", fx + fw + fx / 2, 10, "rgba(71,71,110,1)");

  if (empty) {
    ctx.textBaseline = "middle";
    ctx.font = "700 30px system-ui, sans-serif";
    ctx.fillStyle = "rgba(109,40,217,0.85)";
    ctx.fillText("Tu diseño va acá", W / 2, H / 2);
  }
  ctx.restore();
}

/**
 * Proyecta la plantilla (src) sobre el frente de una taza cilíndrica:
 * cada columna de pantalla x = R·sen(φ) toma la franja correspondiente de la
 * plantilla, así el centro se ve natural y los costados se comprimen como en
 * una taza real.
 */
export function projectFront(ctx, src, zone, wrapAngle) {
  const half = zone.w / 2;
  for (let i = 0; i < zone.w; i++) {
    const x = (i + 0.5 - half) / half; // -1 … 1
    const phi = Math.asin(Math.max(-0.9999, Math.min(0.9999, x)));
    const u = 0.5 + phi / wrapAngle;
    const dphi = 1 / half / Math.sqrt(1 - x * x);
    const sw = Math.min(Math.max(1, (src.width * dphi) / wrapAngle), src.width * 0.08);
    ctx.drawImage(src, u * src.width - sw / 2, 0, sw, src.height, zone.x + i, zone.y, 1, zone.h);
  }
}
