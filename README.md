# Personalísimo · Visualizador de tazas

Next.js (App Router) + Tailwind CSS + Canvas 2D. Subida a Cloudinary sin firma.

## Flujo
1. El cliente sube su imagen (click o drag & drop) y la ve sobre la taza.
2. Edita sobre la plantilla real de 21 × 9 cm: atajos (Rellenar / Ajustar / Solo al frente), zoom, posición, rotación y color de fondo. Pestaña Vista 3D para ver cómo envuelve.
3. "Guardar mi diseño" → se genera un PNG de 2480×1063 px (21 × 9 cm a 300 dpi, solo la plantilla, sin taza) y se sube a Cloudinary.
4. Pantalla de éxito → botón para volver a TiendaNube; el link del diseño se copia al portapapeles y se agrega a la URL como `?diseno=...`.

## Llavero almohadón (`/llavero`)

Página aparte para el llavero de ~7 × 7 cm: mismo flujo (subir → ajustar → guardar en Cloudinary → volver a la tienda), con plantilla cuadrada, margen de costura marcado, vista 3D del almohadón con la cinta y la argolla. Los diseños se guardan en la carpeta `personalisimo/disenos-llavero`. Medidas y posición de la cinta en `lib/config.js` (sección LLAVERO). Podés usar otra URL de tienda para el llavero con `NEXT_PUBLIC_TIENDANUBE_URL_LLAVERO` (si no, usa la de la taza).

## Qué tenés que configurar
| Qué | Dónde |
|---|---|
| URL de la foto PNG de la taza | `lib/config.js` → `MUG_MASK_URL` (ej. `/mascara-taza.png` y el archivo en `/public`) |
| Plantilla (21 × 9 cm), taza física y posición del cuerpo en la foto | `lib/config.js` → `TEMPLATE_CM`, `MUG_PHOTO`, `FRONT_CENTER_U` |
| Cloud name y upload preset de Cloudinary | variables `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME` y `NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET` |
| URL del carrito/checkout de TiendaNube | variable `NEXT_PUBLIC_TIENDANUBE_URL` |

Sin `MUG_MASK_URL` se dibuja una taza genérica de prueba.

## Foto de la taza
PNG cuadrado con la taza (cuerpo blanco opaco) sobre fondo transparente. El diseño se mezcla encima en modo multiply y se recorta a la silueta. Si cambiás la foto, recalculá `CANVAS` y `MUG_PHOTO` en `lib/config.js`.

## Cloudinary
Settings → Upload → Upload presets → Add upload preset → **Signing mode: Unsigned**. Cada archivo queda con tags (`personalisimo`, `taza`, `design_<id>`) y contexto (`design_id`).

## Correr local
```bash
npm install
cp .env.example .env.local   # completá los valores
npm run dev
```

## Deploy en Vercel
Subí el proyecto a GitHub → Vercel → Import → cargá las 3 variables de entorno → Deploy.
