// ════════════════════════════════════════════════════════════════
//  CONFIGURACIÓN DEL VISUALIZADOR DE TAZA
// ════════════════════════════════════════════════════════════════

/**
 * ⚠️ URL DE LA IMAGEN DE TU TAZA (PNG con fondo transparente) ⚠️
 *
 * La taza es una FOTO (cuerpo blanco opaco, fondo transparente). El diseño se
 * "envuelve" alrededor y se mezcla encima en modo multiply, recortado a la
 * silueta de la taza, así conserva sus sombras y brillos reales.
 *
 * Opciones para la URL:
 *  a) Subí el PNG a /public (ej: /public/taza.png) y poné "/taza.png".
 *  b) O usá una URL de Cloudinary / CDN (como la de abajo).
 *
 * 💡 La foto original es de 5000×5000 px (muy pesada para un celular).
 *    Por eso la URL lleva "w_1400": le pide a Cloudinary una versión más chica.
 *
 * ⚠️ Si cambiás la foto por otra, hay que recalcular CANVAS y MUG_PHOTO.
 *    Si lo dejás vacío ("") se dibuja una taza genérica de prueba.
 */
export const MUG_MASK_URL =
  "https://res.cloudinary.com/hiapjxrc/image/upload/w_1400/v1793530428/taza.png"; // 👈 tu taza

// ── PLANTILLA DE IMPRESIÓN ──────────────────────────────────────

/** Medidas reales de la plantilla de sublimación (toda la vuelta de la taza). */
export const TEMPLATE_CM = { w: 21, h: 9 };

/** Tamaño interno del lienzo de edición (50 px por cm). Mantener la proporción 21:9. */
export const TEMPLATE_PX = { w: 1050, h: 450 };

/** Ancho en px del archivo final que se sube a Cloudinary: 21 cm a 300 dpi ≈ 2480 px. */
export const EXPORT_WIDTH = 2480;

// ── TAZA FÍSICA (11 oz) ─────────────────────────────────────────

export const MUG_CIRCUMFERENCE_CM = 25.4; // vuelta completa del cuerpo
export const MUG_BODY_H_CM = 9.5; // alto del cuerpo

/**
 * Qué punto de la plantilla queda mirando al frente (0 = borde izquierdo,
 * 0.5 = centro, 1 = borde derecho). Con 0.5 el centro del diseño queda de
 * frente y los bordes izquierdo/derecho se juntan atrás de la taza.
 */
export const FRONT_CENTER_U = 0.5;

/** Parte de la plantilla que se ve desde un solo lado (media vuelta ≈ 60 %). */
export const FRONT_VISIBLE_FRACTION = MUG_CIRCUMFERENCE_CM / 2 / TEMPLATE_CM.w;

// ── FOTO DE LA TAZA ─────────────────────────────────────────────

/** Tamaño interno del canvas de la vista "Taza" (misma proporción que la foto: 1:1). */
export const CANVAS = { width: 1000, height: 1000 };

/**
 * Dónde está el cuerpo de la taza dentro del canvas (px del canvas):
 *  cx / r  → centro y radio del cuerpo (de borde a borde)
 *  top / height → franja imprimible (debajo del labio y sobre la base)
 * Calculado para tu foto actual.
 */
export const MUG_PHOTO = { cx: 497, r: 214, top: 330, height: 450 };

// ── OTROS ───────────────────────────────────────────────────────

/** Carpeta de Cloudinary donde se guardan los diseños (si tu preset lo permite). */
export const CLOUDINARY_FOLDER = "personalisimo/disenos";

/** Carpeta por producto (el llavero se guarda aparte para no mezclarlo con las tazas). */
export const CLOUDINARY_FOLDERS = {
  taza: CLOUDINARY_FOLDER,
  llavero: "personalisimo/disenos-llavero",
};

/** Restricciones del archivo que sube el cliente. */
export const ACCEPTED_TYPES = ["image/png", "image/jpeg", "image/webp"];
export const MAX_FILE_MB = 15;
/** Debajo de este lado mayor (px) se avisa que puede salir pixelado en 21×9 cm. */
export const MIN_RECOMMENDED_WIDTH = 1500;

// ════════════════════════════════════════════════════════════════
//  LLAVERO ALMOHADÓN  (página /llavero)
// ════════════════════════════════════════════════════════════════

/**
 * Medida de la tela que se sublima (una sola cara, la de adelante).
 * Tu llavero mide aprox. 7 × 7 cm. Si hacés uno más rectangular (ej. 7 × 8),
 * cambiá solo estos números: el editor y la vista 3D se adaptan solos.
 */
export const PILLOW_CM = { w: 7, h: 7 };

/** Margen que "se come" la costura en todo el borde (cm). Lo que cae ahí se pierde o queda doblado. */
export const PILLOW_SEAM_CM = 0.5;

/** Resolución del lienzo de edición (px por cm). */
export const PILLOW_PX_PER_CM = 100;
export const PILLOW_TEMPLATE_PX = {
  w: Math.round(PILLOW_CM.w * PILLOW_PX_PER_CM),
  h: Math.round(PILLOW_CM.h * PILLOW_PX_PER_CM),
};

/** Resolución del archivo final que se sube a Cloudinary (px por cm). 150 px/cm ≈ 380 dpi → 1050×1050 px. */
export const PILLOW_EXPORT_PX_PER_CM = 150;

/**
 * Dónde sale la cinta con la argolla sobre el borde de arriba:
 * -1 = esquina izquierda, 0 = centro, 1 = esquina derecha. En tu llavero va cerca de una esquina.
 */
export const PILLOW_LOOP_X = 0.72;

/** Debajo de este lado mayor (px) se avisa que puede salir pixelado en 7×7 cm. */
export const PILLOW_MIN_RECOMMENDED = 800;
