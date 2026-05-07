import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Required for the Docker `runner` stage in our Dockerfile.
  output: "standalone",
  images: {
    remotePatterns: [
      // Permite imágenes de Supabase Storage y Freepik (cuando se integren).
      { protocol: "https", hostname: "*.supabase.co" },
      { protocol: "https", hostname: "img.freepik.com" },
    ],
  },
};

export default nextConfig;
