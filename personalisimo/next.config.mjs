/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // three.js se publica como ESM: Next lo transpila para evitar problemas de compatibilidad
  transpilePackages: ["three"],
};

export default nextConfig;
