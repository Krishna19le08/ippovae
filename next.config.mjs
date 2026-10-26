// `npm run dev` / `npm run build` behave as before. The GitHub Pages workflow sets NEXT_PUBLIC_BASE_PATH
// (e.g. /Know-Ecommerce), which switches on a fully static export served from that sub-path.
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

/** @type {import('next').NextConfig} */
const nextConfig = basePath
  ? { output: "export", basePath, trailingSlash: true, images: { unoptimized: true } }
  : {};

export default nextConfig;
