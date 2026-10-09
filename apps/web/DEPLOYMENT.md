# Netlify

For the standalone `leetlogic-web` repository:

- Base directory: repository root (leave blank).
- Build command: `npm run build`.
- Publish directory: `.next`.
- Install development dependencies during the build. If custom installation flags
  omit them, remove those flags or use `npm install --include=dev`.
- Keep Netlify's automatically detected Next.js runtime enabled.

`typescript`, `@types/node`, and React type definitions are declared in this
package because Next.js needs them during production builds. Do not rely on
dependencies installed in a parent workspace.

The Next.js configuration selects the parent pnpm workspace only when one exists,
so this package also works as a nested Git checkout during local development.

After updating the repository, trigger a new Netlify deploy. A missing build-cache
warning on the first build is informational, not a deployment failure.

See [Netlify's build configuration documentation](https://docs.netlify.com/build/configure-builds/overview/).

## Search and social metadata

All seven pages have unique titles, descriptions, canonical URLs, and Open Graph
and Twitter preview metadata. `/robots.txt` and `/sitemap.xml` are generated at
build time. Production includes Organization and WebSite structured data.
Development and non-production Netlify contexts use `noindex` and block crawlers.

The public URL defaults to `https://leetlogicglobal.netlify.app`. `SITE_URL` takes
precedence over Netlify's `URL` environment variable and this default. Set
`SITE_URL` to your preferred HTTPS domain if it changes, then rebuild/redeploy.
Never set it to a deploy-preview URL. After deployment, verify the domain in
Google Search Console and submit `/sitemap.xml`. Indexing and ranking are not
guaranteed by technical metadata alone.

The favicon, SVG icon, Apple touch icon and social preview reuse the existing
LeetLogic logo. Run `npm run brand:generate` after changing the source logo and
commit the generated files. No runtime image-generation service is needed.

## Optimized image workflow

The pages serve precompressed WebP assets from `public/optimized`, including
responsive 480px and 800px variants. Small avatar photos use 72px files. The hero
loads with high priority; lower-page photos are lazy-loaded.

Original Figma PNGs remain in `public/figma` for regeneration, but pages no longer
request them. Run `npm run images:optimize` after changing source images and
include the generated assets when committing or deploying. The regular build
does not require an image-processing service or first-request conversion.
