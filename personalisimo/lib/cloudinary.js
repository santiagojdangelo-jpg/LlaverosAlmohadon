import { CLOUDINARY_FOLDERS } from "./config";

// ════════════════════════════════════════════════════════════════
//  SUBIDA A CLOUDINARY (unsigned upload, API REST)
//
//  ⚠️ LAS CREDENCIALES VAN EN VARIABLES DE ENTORNO (no acá):
//     NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME
//     NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET
//  Ver .env.example y el README para cargarlas en Vercel.
// ════════════════════════════════════════════════════════════════

const CLOUD_NAME = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
const UPLOAD_PRESET = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET;

export function isCloudinaryConfigured() {
  return Boolean(
    CLOUD_NAME &&
      UPLOAD_PRESET &&
      CLOUD_NAME !== "TU_CLOUD_NAME" &&
      UPLOAD_PRESET !== "TU_UPLOAD_PRESET"
  );
}

/**
 * Sube un Blob (PNG ya procesado) a Cloudinary, con progreso.
 *
 * @param {Blob} blob
 * @param {{designId: string}} meta   Id único del diseño (para identificarlo en Cloudinary)
 * @param {(pct:number)=>void} [onProgress]
 * @returns {Promise<{secure_url:string, public_id:string}>}
 */
export function uploadToCloudinary(blob, { designId, product = "taza" }, onProgress) {
  return new Promise((resolve, reject) => {
    if (!isCloudinaryConfigured()) {
      reject(
        new Error(
          "Falta configurar Cloudinary (NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME y NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET)."
        )
      );
      return;
    }

    const url = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`;

    const form = new FormData();
    form.append("file", blob, `diseno-${designId}.png`);
    form.append("upload_preset", UPLOAD_PRESET);

    // 🏷️ Tags para encontrar los diseños en tu Media Library.
    form.append("tags", ["personalisimo", product, `design_${designId}`].join(","));
    form.append("context", `design_id=${designId}|producto=${product}`);

    // Carpeta (solo aplica si el preset unsigned no la define ya).
    const folder = CLOUDINARY_FOLDERS[product];
    if (folder) form.append("folder", folder);

    const xhr = new XMLHttpRequest();
    xhr.open("POST", url);

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    };

    xhr.onload = () => {
      let data = {};
      try {
        data = JSON.parse(xhr.responseText);
      } catch {
        /* respuesta no JSON */
      }
      if (xhr.status >= 200 && xhr.status < 300 && data.secure_url) resolve(data);
      else
        reject(
          new Error(
            data?.error?.message || `Cloudinary respondió con error ${xhr.status}.`
          )
        );
    };

    xhr.onerror = () =>
      reject(new Error("No se pudo conectar con Cloudinary. Revisá tu conexión."));

    xhr.send(form);
  });
}
