"use client";

// Piezas de interfaz compartidas por los editores (taza y llavero).

/* ── Piezas chicas ─────────────────────────────────────────── */

export function FitButton({ icon, label, onClick, disabled }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex flex-col items-center gap-1 rounded-xl border border-white/15 bg-white/[0.03] px-2 py-3 text-center text-xs font-medium leading-tight text-white/85 transition hover:border-neon-violet hover:bg-neon-violet/15 active:scale-[0.98] disabled:opacity-40"
    >
      <span className="text-lg">{icon}</span>
      {label}
    </button>
  );
}

export function Slider({ label, value, min, max, step, display, onChange, disabled }) {
  return (
    <label className="block">
      <span className="mb-1.5 flex items-center justify-between text-sm">
        <span className="text-white/80">{label}</span>
        <span className="tabular-nums text-white/50">{display}</span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-2 w-full cursor-pointer disabled:opacity-40"
      />
    </label>
  );
}

export function Spinner({ small = false }) {
  return (
    <span
      className={`inline-block animate-spin rounded-full border-2 border-white/30 border-t-white ${
        small ? "h-4 w-4" : "h-8 w-8"
      }`}
      aria-hidden
    />
  );
}
