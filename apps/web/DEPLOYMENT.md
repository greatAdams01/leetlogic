# Netlify

Deploy this website from the `greatAdams01/leetlogic` monorepo:

- Repository: `git@github.com:greatAdams01/leetlogic.git`.
- Base directory: repository root (leave blank).
- Package directory: `apps/web`.
- Build command: `pnpm --filter @leetlogic/web build`.
- Publish directory: `apps/web/.next`.
- Install development dependencies during the build.
- Keep Netlify's automatically detected Next.js runtime enabled.

Commit and push from the Leetlogic root. In the existing Netlify site, change its
connected repository from `leetlogic-web` to `leetlogic`, apply these settings,
and verify a deployment. The existing site and domain can be retained. Local
repository consolidation does not change Netlify's remote connection.

The old standalone repository remains an archive. Its local Git metadata and
complete commit history were preserved in the monorepo's `.git/web-repository-backup`
and `.git/web-history.bundle`; these are local backups, not deployed files.

See [Netlify's monorepo documentation](https://docs.netlify.com/build/configure-builds/monorepos/).

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
