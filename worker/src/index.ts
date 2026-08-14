/**
 * Manage — image/attachment upload proxy for Cloudflare R2.
 *
 * The desktop app never holds R2 credentials. It sends files to this Worker with
 * a shared bearer token; the Worker writes them to the bound R2 bucket and
 * returns a public URL. This same Worker is the seed of a future cloud backend:
 * swap the shared token for real per-user auth and the client contract is
 * unchanged.
 *
 * Routes
 *   PUT    /upload?name=<filename>   (auth) — store the request body, return { key, url }
 *   DELETE /o/<key>                  (auth) — delete an object
 *   GET    /o/<key>                  (public) — serve an object (fallback if you
 *                                     don't put a public domain on the bucket)
 */

export interface Env {
  BUCKET: R2Bucket
  UPLOAD_TOKEN: string // secret: `wrangler secret put UPLOAD_TOKEN`
  PUBLIC_BASE?: string // e.g. https://cdn.example.com — the bucket's public domain
  ALLOWED_ORIGIN?: string // CORS origin; defaults to "*"
}

function cors(env: Env): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': env.ALLOWED_ORIGIN || '*',
    'Access-Control-Allow-Methods': 'GET,PUT,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization,Content-Type',
    'Access-Control-Max-Age': '86400',
  }
}

function authed(req: Request, env: Env): boolean {
  return req.headers.get('authorization') === `Bearer ${env.UPLOAD_TOKEN}`
}

export default {
  async fetch(req: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(req.url)
    const headers = cors(env)

    if (req.method === 'OPTIONS') return new Response(null, { headers })

    // Public read (fallback when no public bucket domain is configured).
    if (req.method === 'GET' && url.pathname.startsWith('/o/')) {
      const key = decodeURIComponent(url.pathname.slice(3))
      const cache = caches.default
      const cached = await cache.match(req)
      if (cached) return cached
      const obj = await env.BUCKET.get(key)
      if (!obj) return new Response('Not found', { status: 404, headers })
      const h = new Headers(headers)
      obj.writeHttpMetadata(h)
      h.set('etag', obj.httpEtag)
      h.set('cache-control', 'public, max-age=31536000, immutable')
      const res = new Response(obj.body, { headers: h })
      ctx.waitUntil(cache.put(req, res.clone()))
      return res
    }

    // Everything below mutates — require the shared token.
    if (!authed(req, env)) return new Response('Unauthorized', { status: 401, headers })

    if (req.method === 'PUT' && url.pathname === '/upload') {
      const name = url.searchParams.get('name') || 'file'
      const dot = name.lastIndexOf('.')
      const ext = dot > 0 ? name.slice(dot).toLowerCase().replace(/[^.a-z0-9]/g, '') : ''
      const day = new Date().toISOString().slice(0, 10)
      const key = `${day}/${crypto.randomUUID()}${ext}`
      await env.BUCKET.put(key, req.body, {
        httpMetadata: { contentType: req.headers.get('content-type') || 'application/octet-stream' },
      })
      const base = (env.PUBLIC_BASE?.replace(/\/$/, '')) || `${url.origin}/o`
      return Response.json({ key, url: `${base}/${key}` }, { headers })
    }

    if (req.method === 'DELETE' && url.pathname.startsWith('/o/')) {
      await env.BUCKET.delete(decodeURIComponent(url.pathname.slice(3)))
      return new Response(null, { status: 204, headers })
    }

    return new Response('Not found', { status: 404, headers })
  },
}
