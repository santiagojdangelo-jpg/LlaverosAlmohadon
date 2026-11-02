/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,jsx}",
    "./components/**/*.{js,jsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        display: ["var(--font-display)", "system-ui", "sans-serif"],
        sans: ["var(--font-body)", "system-ui", "sans-serif"],
      },
      colors: {
        ink: {
          950: "#07070d",
          900: "#0d0d18",
          800: "#14142a",
          700: "#1d1d3a",
        },
        neon: {
          violet: "#8b5cf6",
          pink: "#ec4899",
          cyan: "#22d3ee",
        },
      },
      boxShadow: {
        glow: "0 0 40px -10px rgba(139, 92, 246, 0.55)",
      },
    },
  },
  plugins: [],
};
