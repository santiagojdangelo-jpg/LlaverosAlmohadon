"use client";

import { useState } from "react";
import MugEditor from "@/components/MugEditor";
import SuccessScreen from "@/components/SuccessScreen";
import ProductNav from "@/components/ProductNav";

export default function Home() {
  // `design` queda en null mientras se edita; al guardar trae { url, publicId, designId }
  const [design, setDesign] = useState(null);
  // `key` fuerza un editor "limpio" cuando el cliente elige hacer otro diseño
  const [editorKey, setEditorKey] = useState(0);

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-6xl flex-col px-4 pb-10 pt-6 sm:px-6 lg:px-8">
      {/* Cabecera de marca */}
      <header className="mb-6 flex items-center justify-between lg:mb-10">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-neon-violet to-neon-pink text-lg shadow-glow">
            ☕
          </span>
          <div className="leading-tight">
            <p className="font-display text-xl font-bold tracking-tight">Personalísimo</p>
            <p className="text-xs text-white/50">Diseñá tu taza</p>
          </div>
        </div>
        {!design && <Steps />}
      </header>

      {!design && <ProductNav active="taza" />}

      <div className="flex-1">
        {design ? (
          <SuccessScreen
            design={design}
            onRestart={() => {
              setDesign(null);
              setEditorKey((k) => k + 1);
            }}
          />
        ) : (
          <>
            <div className="mb-5 lg:mb-8">
              <h1 className="font-display text-2xl font-bold sm:text-4xl">
                Subí tu diseño y mirá cómo queda
              </h1>
              <p className="mt-1 text-sm text-white/60 sm:text-base">
                Ajustalo a tu gusto y, cuando estés conforme, guardalo para volver a la tienda.
              </p>
            </div>
            <MugEditor key={editorKey} onSaved={setDesign} />
          </>
        )}
      </div>

      <footer className="mt-10 text-center text-xs text-white/30">
        © {new Date().getFullYear()} Personalísimo · Sublimación personalizada
      </footer>
    </main>
  );
}

function Steps() {
  const items = ["Subí", "Ajustá", "Guardá"];
  return (
    <ol className="hidden items-center gap-2 text-xs text-white/50 sm:flex" aria-label="Pasos">
      {items.map((label, i) => (
        <li key={label} className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-full border border-white/20 text-[11px] font-semibold">
            {i + 1}
          </span>
          {label}
          {i < items.length - 1 && <span className="mx-1 h-px w-6 bg-white/15" />}
        </li>
      ))}
    </ol>
  );
}
