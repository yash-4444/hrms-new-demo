import type { NextConfig } from "next";

/**
 * GitHub Pages is a static file host, so the production deploy is a full static
 * export. Every dynamic route enumerates its params via `generateStaticParams`
 * in a thin server shell (see any `[id]/page.tsx`).
 *
 * `basePath` must match the repo name for a project site
 * (https://<user>.github.io/<repo>/). The Pages workflow sets
 * NEXT_PUBLIC_BASE_PATH from the repo name automatically, so nothing here is
 * hard-coded; local `npm run dev` leaves it empty and serves from /.
 */
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

const nextConfig: NextConfig = {
  output: "export",
  basePath,
  assetPrefix: basePath || undefined,
  // Pages serves /foo/ as /foo/index.html; trailing slashes keep deep links working.
  trailingSlash: true,
  images: { unoptimized: true },
};

export default nextConfig;
