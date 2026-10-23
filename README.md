# Leetlogic Phase One

TypeScript foundation for Leetlogic's Nigeria-first farmer-to-buyer marketplace.

## Next.js website

The approved Figma website is implemented in `apps/web` using Next.js App Router,
React, TypeScript, and plain CSS. Run `pnpm dev:web` and open
`http://localhost:3001`. The API remains on port 3000.

### Start the web app and admin dashboard locally

After completing Setup below, run this in your terminal:

```sh
cd /Users/greatadams/Documents/ChatGPT/LEETLOGIC
pnpm dev:web
```

- Website: [http://localhost:3001](http://localhost:3001)
- Admin dashboard: [http://localhost:3001/admin](http://localhost:3001/admin)

Keep that terminal open to see web logs. Press `Ctrl+C` to stop the web server.
The admin dashboard is part of the same Next.js app.

Admin login and backend actions also require PostgreSQL, Redis, and the API.
If they are not already running, use a separate terminal:

```sh
cd /Users/greatadams/Documents/ChatGPT/LEETLOGIC
docker compose up -d
pnpm dev
```

Keep the API terminal open for backend logs. If Docker and the API are already
running, only run `pnpm dev:web`; do not start a second API process.

Pages: `/`, `/about`, `/team`, `/for-buyers`, `/how-it-works`, `/impact`, and `/contact`.
The original Figma images, SVGs, and design fonts are served locally. Layouts adapt
to phones and tablets; the hero animation respects reduced-motion preferences.

Validate with `pnpm --filter @leetlogic/web build` and
`pnpm --filter @leetlogic/web typecheck`.

Selling, sourcing, and careers calls to action open a relevant contact inquiry.
The contact form validates input and prepares an email draft for the visitor to
review and send; it does not send or store inquiries on the server. An inquiry API
and production marketplace onboarding are not part of the supplied marketing
screens. Social icons and the branded WhatsApp number remain informational until
real profile URLs and a numeric WhatsApp contact are supplied.

### Netlify deployment

When deploying `apps/web` as its own repository, install its dependencies (including
dev dependencies), use `npm run build`, and publish `.next`. The web package declares
its own TypeScript compiler and Node.js types so it can build without the monorepo.
Do not omit dev dependencies during the build installation step.

When deploying this entire monorepo, leave Netlify's base directory at the repository
root, set the package directory to `apps/web`, use
`pnpm --filter @leetlogic/web build`, and publish `apps/web/.next`.
Use Netlify's automatically detected Next.js runtime for either setup.

## Prerequisites

- Node.js 22+
- pnpm 11+
- Docker with Compose

## Setup

1. Copy `.env.example` to `.env` and replace all secrets.
   Generate `TOTP_ENCRYPTION_KEY` with `openssl rand -hex 32` (64 hex characters) or
   `openssl rand -base64 32` (a Base64-encoded 32-byte key).
2. Start PostgreSQL and Redis with `docker compose up -d`.
3. Install dependencies with `pnpm install`.
4. Generate the Prisma client with `pnpm db:generate`.
5. Apply migrations with `pnpm db:migrate`.
6. Seed languages, units, permissions and roles with `pnpm db:seed`.
7. Start the API with `pnpm dev`.

API documentation is available at `http://localhost:3000/docs`. Health endpoints are
`/health/live` and `/health/ready`.

## Database viewer

Docker Compose includes Adminer for local database inspection. After running
`docker compose up -d`, open `http://localhost:8080` and use:

- System: `PostgreSQL`
- Server: `postgres`
- Username: `leetlogic`
- Password: `leetlogic`
- Database: `leetlogic`

Adminer is bound to `127.0.0.1`, so it is only available from your computer. It is a development
tool and should not be deployed with the production stack.

In development, `OTP_PROVIDER=console` logs OTP codes rather than sending SMS. Do not use the
console provider in production.

## Repository and deployment workflow

All apps are tracked by the root Leetlogic Git repository. Run Git commands from
this root and deploy `apps/web` from the same GitHub repository using the monorepo
Netlify settings above. The previous separate web repository can remain as an archive.
Changing local Git tracking does not switch the connected repository in Netlify;
update that site's repository connection separately and verify a deployment.

## API logs

Development request logs show timestamp, level, method, path, HTTP status, duration,
and request ID on one summary line. Failures add indented `Cause`, `Type`, and `Fix`
lines instead of a JSON blob with escaped stack traces. The original error category
is retained; database and Redis outages return HTTP 503 with a named error code.
Set `LOG_LEVEL=debug` to include source stack frames. Production always emits
structured JSON; set `LOG_FORMAT=json` to use JSON in development too.

Request bodies, query strings, headers, SQL query values and connection credentials
are omitted from request logs. Console OTP codes are printed only outside production;
production requires a real SMS provider.

If translations or login fail, check the dependencies before restarting the API:

```sh
docker compose up -d postgres redis
docker compose ps
curl http://localhost:3000/health/ready
```

Docker Desktop must be running. A healthy API returns `{"status":"ready"}`.
PostgreSQL and Redis use `restart: unless-stopped` so they recover after an
unexpected exit; services explicitly stopped still need the command above.

## Delivery and language pilot

Delivery, customer language selection, cached Azure translation, and typed produce drafts extend the existing app. See [delivery and language operations](docs/delivery-language.md) for configuration, APIs, tests, and launch blockers. Voice remains disabled until a free Igbo speech service passes the required validation. Provider switches default off.

## Native mobile app

The Expo/React Native customer app is in `apps/mobile` and connects to the same API as the website. Run `pnpm --filter @leetlogic/mobile ios` or `pnpm --filter @leetlogic/mobile android` after starting the API. See [mobile scope, simulator setup and test checklist](docs/mobile.md). No mobile admin, wallet provider, or unvalidated voice feature is introduced.

Dojah seller identity verification setup and sandbox testing: [integration guide](docs/dojah-identity.md).
