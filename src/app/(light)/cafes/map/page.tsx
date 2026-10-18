import CafesMapClient from "./CafesMapClient";

/**
 * Nearby — server entry. Its one job is to hand the CARTO basemap key to the
 * client at REQUEST time.
 *
 * Why not NEXT_PUBLIC_…: the Docker build runs with `.env` excluded from the
 * build context (.dockerignore) and no build-arg, so a NEXT_PUBLIC_ variable
 * is always empty when the client bundle is compiled. Runtime env is the only
 * channel that reaches production — hence a server component + force-dynamic
 * (otherwise `next build` would prerender this page once with an empty key).
 *
 * CARTO stopped serving keyless raster tiles on 2026-09-25 (every tile became
 * an "API KEY REQUIRED" placeholder). The key is free, non-commercial, and
 * restricted to bettertastethansorry.com in CARTO's dashboard. Empty →
 * CafeMap falls back to a keyless basemap, so CI screenshots and a lost key
 * still show a real map instead of the watermark.
 */
export const dynamic = "force-dynamic";

export default function CafesMapPage() {
  return <CafesMapClient cartoKey={process.env.CARTO_BASEMAP_KEY ?? ""} />;
}
