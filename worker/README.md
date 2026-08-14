# Manage — R2 upload Worker

A tiny Cloudflare Worker that stores image/attachment uploads in R2 and returns a
public URL. The desktop app talks only to this Worker (with a shared bearer
token), so no R2 credentials ever ship in the app. It's also the natural seed of
a future cloud backend: swap the shared token for real per-user auth and the
client contract is unchanged.

## Setup

```bash
cd worker
npm install

# 1. Create the bucket
npx wrangler r2 bucket create manage-uploads

# 2. Set the shared upload token (any strong random string)
npx wrangler secret put UPLOAD_TOKEN

# 3. (recommended) Make the bucket public and point PUBLIC_BASE at its domain
#    Dashboard → R2 → manage-uploads → Settings → Public access (r2.dev or a
#    custom domain), then set "PUBLIC_BASE" in wrangler.jsonc to that URL.

# 4. Deploy
npx wrangler deploy
```

## Point the app at it

In the app: **avatar menu → Settings → Cloud image storage**, enter the Worker
URL (e.g. `https://manage-uploads.<you>.workers.dev`) and the same
`UPLOAD_TOKEN`. Until you do, images are stored inline (local-first) and
everything still works offline.

## Routes

| Method | Path | Auth | Purpose |
|---|---|---|---|
| `PUT` | `/upload?name=<file>` | Bearer | Store the body, return `{ key, url }` |
| `DELETE` | `/o/<key>` | Bearer | Delete an object |
| `GET` | `/o/<key>` | public | Serve an object (fallback if no public domain) |

## Notes

- `@cloudflare/workers-types` isn't installed until you run `npm install` here —
  that's why editors may flag `Request`/`Response` before setup. It has its own
  `tsconfig.json` and is independent of the desktop app's build.
- CORS defaults to `*`; tighten `ALLOWED_ORIGIN` in `wrangler.jsonc` for prod.
