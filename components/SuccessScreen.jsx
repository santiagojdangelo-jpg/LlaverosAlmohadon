"use client";

import { useEffect, useState } from "react";
import { storeUrlFor, buildStoreUrl } from "@/lib/store";

/**
 * Pantalla de éxito: muestra el diseño guardado y manda al cliente
 * de vuelta a TiendaNube (carrito/checkout), copiando el link del diseño.
 */
export default function SuccessScreen({ design, onRestart, product = "taza" }) {
  const [copied, setCopied] = useState(false);
  const [redirecting, setRedirecting] = useState(false);

  const storeUrl = buildStoreUrl(design.url, product);

  // Vista previa liviana (Cloudinary redimensiona al vuelo; la URL original queda intacta)
  const thumb = design.url.replace("/upload/", "/upload/w_900,q_auto/");

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(design.url);
      setCopied(true);
      return true;
    } catch {
      setCopied(false);
      return false;
    }
  }

  // Intento de copia automática (algunos navegadores la bloquean sin un toque: no pasa nada)
  useEffect(() => {
    copyLink();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function goToStore() {
    setRedirecting(true);
    await copyLink();
    window.location.assign(storeUrl);
  }

  return (
    <div className="mx-auto max-w-xl text-center">
      <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-400/15 text-3xl ring-1 ring-emerald-400/40">
        ✅
      </div>
      <h2 className="font-display text-3xl font-bold">¡Diseño guardado!</h2>
      <p className="mx-auto mt-2 max-w-md text-white/60">
        Ya recibimos tu diseño. Ahora volvé a la tienda para completar tu compra.
      </p>

      {/* Fondo ajedrez para que se note si el PNG tiene transparencia */}
      <div
        className="mt-6 overflow-hidden rounded-2xl border border-white/10 p-3"
        style={{
          backgroundColor: "#14142a",
          backgroundImage:
            "linear-gradient(45deg,#1d1d3a 25%,transparent 25%,transparent 75%,#1d1d3a 75%),linear-gradient(45deg,#1d1d3a 25%,transparent 25%,transparent 75%,#1d1d3a 75%)",
          backgroundSize: "20px 20px",
          backgroundPosition: "0 0, 10px 10px",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={thumb} alt="Tu diseño guardado" className="mx-auto h-auto max-h-64 w-auto max-w-full" />
      </div>

      <div className="mt-6 space-y-3">
        {storeUrl ? (
          <button
            type="button"
            onClick={goToStore}
            disabled={redirecting}
            className="w-full rounded-2xl bg-gradient-to-r from-neon-violet to-neon-pink px-6 py-4 font-display text-base font-semibold text-white shadow-glow transition hover:brightness-110 active:scale-[0.99] disabled:opacity-70"
          >
            {redirecting ? "Llevándote a la tienda…" : "¡Diseño guardado! Volver a la tienda para comprar"}
          </button>
        ) : (
          <p className="rounded-xl border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-sm text-amber-200">
            {storeUrlFor(product)
              ? "La URL de la tienda (NEXT_PUBLIC_TIENDANUBE_URL) no es válida."
              : "Falta configurar NEXT_PUBLIC_TIENDANUBE_URL para volver a la tienda."}
          </p>
        )}

        {/* Link del diseño: copiar y, si el portapapeles falla, copiar a mano */}
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3 text-left">
          <p className="mb-2 text-xs text-white/50">
            Link de tu diseño{" "}
            {copied ? (
              <span className="text-emerald-300">· copiado al portapapeles ✓</span>
            ) : null}
          </p>
          <div className="flex gap-2">
            <input
              readOnly
              value={design.url}
              onFocus={(e) => e.target.select()}
              className="min-w-0 flex-1 rounded-lg border border-white/10 bg-ink-950 px-3 py-2 text-xs text-white/70"
            />
            <button
              type="button"
              onClick={copyLink}
              className="shrink-0 rounded-lg border border-white/15 px-3 py-2 text-xs font-medium transition hover:bg-white/10"
            >
              {copied ? "Copiado" : "Copiar"}
            </button>
          </div>
          <p className="mt-2 text-xs text-white/40">
            Si la tienda te pide el diseño, pegá este link en el campo de comentarios o
            personalización.
          </p>
        </div>

        <button
          type="button"
          onClick={onRestart}
          className="text-sm text-white/50 underline-offset-4 transition hover:text-white hover:underline"
        >
          Hacer otro diseño
        </button>
      </div>
    </div>
  );
}
