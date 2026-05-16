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
  images: {
    remotePatterns: [
      // Permite imágenes de Supabase Storage y Freepik (cuando se integren).
      { protocol: "https", hostname: "*.supabase.co" },
      { protocol: "https", hostname: "img.freepik.com" },
    ],
  },
};

export default nextConfig;
