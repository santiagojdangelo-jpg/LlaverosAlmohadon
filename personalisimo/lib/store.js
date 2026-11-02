// ════════════════════════════════════════════════════════════════
//  REDIRECCIÓN A TIENDANUBE
// ════════════════════════════════════════════════════════════════

/**
 * ⚠️ URL A LA QUE VUELVE EL CLIENTE DESPUÉS DE GUARDAR SU DISEÑO ⚠️
 *
 * Se configura con la variable de entorno NEXT_PUBLIC_TIENDANUBE_URL
 * (en Vercel: Settings → Environment Variables). Ejemplos:
 *    https://tutienda.tiendanube.com/productos/taza-personalizada/
 *    https://tutienda.tiendanube.com/comprar/        (checkout)
 *    https://tutienda.tiendanube.com/cart/           (carrito)
 */
export const STORE_URL = process.env.NEXT_PUBLIC_TIENDANUBE_URL || "";

/**
 * (Opcional) URL aparte para el LLAVERO: NEXT_PUBLIC_TIENDANUBE_URL_LLAVERO
 * (ej: https://tutienda.tiendanube.com/productos/llavero-almohadon/).
 * Si no la cargás, el llavero usa la misma URL que la taza.
 */
export const STORE_URL_LLAVERO = process.env.NEXT_PUBLIC_TIENDANUBE_URL_LLAVERO || "";

export function storeUrlFor(product = "taza") {
  return product === "llavero" ? STORE_URL_LLAVERO || STORE_URL : STORE_URL;
}

/**
 * Si es true, se agrega el link del diseño a la URL como parámetro
 * (ej: ...?diseno=https://res.cloudinary.com/...). Útil si tu tema de
 * TiendaNube lee ese parámetro (script/campo personalizado).
 * TiendaNube no lo usa por sí sola: por eso además se copia el link
 * al portapapeles para que el cliente pueda pegarlo en el campo de
 * "comentarios / personalización" de la compra.
 */
export const PASS_DESIGN_AS_PARAM = true;
export const DESIGN_URL_PARAM = "diseno";

export function buildStoreUrl(designUrl, product = "taza") {
  const base = storeUrlFor(product);
  if (!base) return "";
  try {
    const u = new URL(base);
    if (PASS_DESIGN_AS_PARAM && designUrl) u.searchParams.set(DESIGN_URL_PARAM, designUrl);
    return u.toString();
  } catch {
    return "";
  }
}
