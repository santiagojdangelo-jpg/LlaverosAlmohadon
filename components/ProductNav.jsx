import Link from "next/link";

/**
 * Selector de producto (Taza / Llavero). Cada producto es una página aparte:
 *   /          → taza
 *   /llavero   → llavero almohadón
 * Para sumar otro producto, agregalo a este arreglo y creá su carpeta en /app.
 */
const PRODUCTS = [
  { id: "taza", href: "/", label: "☕ Taza" },
  { id: "llavero", href: "/llavero", label: "🧸 Llavero" },
];

export default function ProductNav({ active }) {
  return (
    <nav
      aria-label="Producto"
      className="mb-5 inline-flex rounded-full border border-white/10 bg-white/[0.04] p-1 lg:mb-6"
    >
      {PRODUCTS.map((p) => (
        <Link
          key={p.id}
          href={p.href}
          aria-current={p.id === active ? "page" : undefined}
          className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
            p.id === active
              ? "bg-gradient-to-r from-neon-violet to-neon-pink text-white shadow-glow"
              : "text-white/60 hover:text-white"
          }`}
        >
          {p.label}
        </Link>
      ))}
    </nav>
  );
}
