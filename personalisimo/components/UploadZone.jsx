"use client";

import { useRef, useState } from "react";
import { ACCEPTED_TYPES, MAX_FILE_MB } from "@/lib/config";

/**
 * Zona de carga: click para elegir o arrastrar y soltar (PNG, JPG, WEBP).
 * `compact` muestra una versión chica para "cambiar imagen".
 */
export default function UploadZone({ onFile, compact = false, disabled = false }) {
  const inputRef = useRef(null);
  const [over, setOver] = useState(false);
  const [error, setError] = useState("");

  function validate(file) {
    if (!ACCEPTED_TYPES.includes(file.type)) {
      return "Formato no válido. Subí una imagen PNG, JPG o WEBP.";
    }
    if (file.size > MAX_FILE_MB * 1024 * 1024) {
      return `La imagen pesa demasiado (máximo ${MAX_FILE_MB} MB).`;
    }
    return "";
  }

  function handle(file) {
    if (!file || disabled) return;
    const msg = validate(file);
    setError(msg);
    if (!msg) onFile(file);
  }

  function onDrop(e) {
    e.preventDefault();
    setOver(false);
    handle(e.dataTransfer.files?.[0]);
  }

  function open() {
    if (!disabled) inputRef.current?.click();
  }

  return (
    <div>
      <div
        role="button"
        tabIndex={0}
        aria-label="Subir imagen"
        onClick={open}
        onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && open()}
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={onDrop}
        className={[
          "group cursor-pointer rounded-2xl border-2 border-dashed text-center transition",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-neon-violet",
          compact ? "px-4 py-3" : "px-6 py-10",
          over
            ? "border-neon-cyan bg-neon-cyan/10"
            : "border-white/15 bg-white/[0.03] hover:border-neon-violet hover:bg-neon-violet/10",
          disabled ? "pointer-events-none opacity-50" : "",
        ].join(" ")}
      >
        {compact ? (
          <p className="text-sm font-medium text-white/80">
            🔄 Cambiar imagen
          </p>
        ) : (
          <>
            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-neon-violet to-neon-pink text-2xl shadow-glow">
              ⬆️
            </div>
            <p className="font-display text-lg font-semibold">
              Subí tu diseño
            </p>
            <p className="mt-1 text-sm text-white/60">
              Tocá para elegir o arrastrá tu imagen acá
            </p>
            <p className="mt-3 text-xs text-white/40">
              PNG · JPG · WEBP — hasta {MAX_FILE_MB} MB
            </p>
          </>
        )}
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED_TYPES.join(",")}
          className="hidden"
          onChange={(e) => {
            handle(e.target.files?.[0]);
            e.target.value = ""; // permite volver a elegir el mismo archivo
          }}
        />
      </div>
      {error && (
        <p role="alert" className="mt-2 text-sm text-rose-400">
          {error}
        </p>
      )}
    </div>
  );
}
