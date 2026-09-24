# Comic Universe Plugin - SakuraMangas

Plugin HTTP API for Comic Universe backed by SakuraMangas.

## Capabilities

- `metadata`
- `content`

## Backend-only Requests

All website calls happen server-side in `/api/*` routes. This avoids browser CORS issues
in clients like Bruno/Insomnia and centralizes Sakura-specific headers/cookies in backend env vars.

### Runtime Bootstrap

The plugin now bootstraps Sakura protection values at runtime (home page + scripts),
then retries protected requests automatically on first `403`.

### Required Environment Variables

Set these in your deploy/backend environment:

- `SAKURA_COOKIE` (includes `PHPSESSID` and `cf_clearance`)

These are optional runtime overrides (used if present, otherwise auto-discovered):

- `SAKURA_CSRF_TOKEN`
- `SAKURA_CLIENT_SIGNATURE`
- `SAKURA_VERIFICATION_KEY_1`
- `SAKURA_VERIFICATION_KEY_2`
- `SAKURA_PROOF`
- `SAKURA_CHALLENGE`

Optional:

- `SAKURA_BASE_URL` (default `https://sakuramangas.org`)
- `SAKURA_USER_AGENT`

## Endpoints

- `POST /api/getList` - default list
- `POST /api/search` - body `{ search }`
- `POST /api/getDetails` - body `{ siteId }`
- `POST /api/getChapters` - body `{ siteId }`
- `POST /api/getPages` - body `{ chapterSiteId }`
- `POST /api/downloadChapter` - stub
- `GET /api/metadata`

## Dev

```bash
npm install
npm run dev
```

Cloudflare session cookies are still required:

- `SAKURA_COOKIE` (or `SAKURA_PHPSESSID` + `SAKURA_CF_CLEARANCE`)

## Install in Comic Universe

Use deep link:

```text
comic-universe-tauri://plugin/install?url=<PLUGIN_BASE_URL>/api&metadataUrl=<PLUGIN_BASE_URL>/api/metadata&name=MangaDex&tag=mangadex

comic-universe-tauri://plugin/install?url=<PLUGIN_BASE_URL>/api&metadataUrl=<PLUGIN_BASE_URL>/api/metadata&name=SakuraMangas&tag=sakuramangas
```
