"use client";

import { useState } from "react";
import PillowEditor from "@/components/PillowEditor";
import SuccessScreen from "@/components/SuccessScreen";
import ProductNav from "@/components/ProductNav";

// Página del LLAVERO ALMOHADÓN (7 × 7 cm). Misma lógica que la de la taza,
// pero con su propio editor, su vista 3D y su carpeta en Cloudinary.
export default function LlaveroPage() {
  const [design, setDesign] = useState(null);
  const [editorKey, setEditorKey] = useState(0);

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-6xl flex-col px-4 pb-10 pt-6 sm:px-6 lg:px-8">
      <header className="mb-6 flex items-center justify-between lg:mb-8">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-neon-violet to-neon-pink text-lg shadow-glow">
            🧸
          </span>
          <div className="leading-tight">
            <p className="font-display text-xl font-bold tracking-tight">Personalísimo</p>
            <p className="text-xs text-white/50">Diseñá tu llavero</p>
          </div>
        </div>
      </header>

      {!design && <ProductNav active="llavero" />}

      <div className="flex-1">
        {design ? (
          <SuccessScreen
            product="llavero"
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
                Diseñá tu llavero almohadón
              </h1>
              <p className="mt-1 text-sm text-white/60 sm:text-base">
                Subí tu imagen, acomodala en el cuadrado de 7 × 7 cm y mirá cómo queda.
              </p>
            </div>
            <PillowEditor key={editorKey} onSaved={setDesign} />
          </>
        )}
      </div>

      <footer className="mt-10 text-center text-xs text-white/30">
        © {new Date().getFullYear()} Personalísimo · Sublimación personalizada
      </footer>
    </main>
  );
}
