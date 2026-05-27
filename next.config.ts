import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Required for the Docker `runner` stage in our Dockerfile.
  output: "standalone",
  // Puppeteer + @sparticuz/chromium ship as commonjs and pull in a native
  // binary at runtime; they cannot be bundled by Turbopack/Webpack. Mark them
  // as external so Vercel's nodejs runtime resolves them from node_modules at
  // request time.
  serverExternalPackages: ["puppeteer-core", "@sparticuz/chromium-min"],
  // El wizard de creación devuelve 3 imágenes generadas por Nano Banana
  // como data URLs base64. Cada imagen puede pesar ~500KB-1MB, así que
  // el payload total de un `generateImageVariationsAction` supera el 1MB
  // default de Server Actions. Subimos el límite a 10MB para tener holgura.
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
  images: {
    remotePatterns: [
      // Permite imágenes de Supabase Storage y Freepik (cuando se integren).
      { protocol: "https", hostname: "*.supabase.co" },
      { protocol: "https", hostname: "img.freepik.com" },
    ],
  },
};

export default nextConfig;
