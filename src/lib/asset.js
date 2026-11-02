// Public files (images, logo) are not rewritten by Next's basePath, so prefix them when the site is served from a sub-path (GitHub Pages).
export const withBase = (path) => `${process.env.NEXT_PUBLIC_BASE_PATH || ""}${path}`;
