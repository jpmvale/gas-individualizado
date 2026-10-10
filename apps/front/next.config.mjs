import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Mesmo arranjo do coda: imagem standalone atrás do Caddy; em dev o Next repassa /api à API.
  output: "standalone",
  outputFileTracingRoot: path.join(here, "../.."),
  async rewrites() {
    const apiUrl = process.env.API_URL ?? "http://localhost:3000";
    return [{ source: "/api/:path*", destination: `${apiUrl}/api/:path*` }];
  },
};

export default nextConfig;
