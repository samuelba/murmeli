#!/usr/bin/env node
// Serves the production build (dist/murmeli-frontend/browser) like the nginx image does: the
// same CSP and security headers, cache rules, gzip and the SPA fallback. Used by the service
// worker e2e tests and by `npm run lighthouse`.
//   node scripts/serve-dist.mjs [--port 4301] [--mock guest|family|kid]
// Without --mock every /api request is a 404 (Playwright answers /api itself). With --mock a
// tiny fake backend answers the calls the landing page, the profile picker and the map make.
import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createGzip } from 'node:zlib';

const frontend = resolve(fileURLToPath(new URL('..', import.meta.url)));
const root = join(frontend, 'dist', 'murmeli-frontend', 'browser');

function arg(name, fallback) {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : fallback;
}

const port = Number(arg('port', process.env['PORT'] ?? 4301));
const mock = arg('mock', 'none');

const CSP =
  "default-src 'self'; script-src 'self'; worker-src 'self'; style-src 'self' 'unsafe-inline'; " +
  "img-src 'self' data: blob:; media-src 'self' blob:; font-src 'self'; connect-src 'self'; " +
  "frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'";

const SECURITY_HEADERS = {
  'Content-Security-Policy': CSP,
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Resource-Policy': 'same-origin',
};

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.opus': 'audio/ogg',
  '.ogg': 'audio/ogg',
  '.md': 'text/markdown; charset=utf-8',
};
const COMPRESSIBLE = /^(?:text\/|application\/(?:json|manifest\+json)|image\/svg)/;
const HASHED = /^\/(?:media\/)?[^/]+-[A-Za-z0-9_-]{8}\.(?:js|css|woff2?)$/;
const SERVICE_WORKER = /^\/(?:ngsw-worker\.js|ngsw\.json|safety-worker\.js|worker-basic\.min\.js)$/;

function cacheControl(path) {
  if (HASHED.test(path)) {
    return 'public, max-age=31536000, immutable';
  }
  if (/^\/(?:brand|pictures)\//.test(path)) {
    return 'public, max-age=86400';
  }
  if (/^\/audio\/[A-Za-z-]+\/[\w-]+\.(?:opus|ogg)$/.test(path)) {
    return 'public, max-age=31536000, immutable';
  }
  return 'no-cache';
}

const KID = {
  id: '0190a000-0000-7000-8000-0000000000a1',
  nickname: 'Mia',
  avatar: { animal: 'fox', accessory: 'crown', background: '#FFD8A8' },
  startClass: 'KG2',
  birthYear: null,
  language: 'de-CH',
  hasPin: false,
  dailyLimitMinutes: null,
  soundEnabled: true,
  readAloud: 'off',
};
const USER = {
  id: '0190a000-0000-7000-8000-000000000001',
  email: 'eltern@example.ch',
  role: 'parent',
  locale: 'de-CH',
  emailVerified: true,
  totpEnabled: false,
  createdAt: '2026-01-01T00:00:00.000Z',
};

async function learnMap() {
  const { loadContent } = await import('@murmeli/content');
  const content = loadContent(join(frontend, '..', 'content'));
  const locale = 'de-CH';
  return {
    tracks: content.tracks
      .filter((track) => track.locales.includes(locale))
      .map((track) => ({
        id: track.id,
        title: track.title[locale] ?? track.id,
        icon: track.icon,
        worlds: track.worlds.map((world, w) => ({
          id: world.id,
          title: world.title[locale] ?? world.id,
          scene: world.scene,
          grade: world.grade,
          state: w === 0 ? 'unlocked' : 'locked',
          stars: w === 0 ? 5 : 0,
          maxStars: world.levels.length * 3,
          levels: world.levels.map((level, l) => ({
            id: level.id,
            title: level.title[locale] ?? level.id,
            state: w > 0 ? 'locked' : l < 2 ? 'passed' : l === 2 ? 'unlocked' : 'locked',
            stars: w === 0 && l < 2 ? 3 - l : 0,
          })),
        })),
      })),
  };
}

function api(path) {
  if (mock === 'none') {
    return { status: 404, body: { errorCode: 'NOT_FOUND', message: 'Not mocked' } };
  }
  const signedIn = mock !== 'guest';
  const routes = {
    '/api/auth/config': {
      body: { registrationEnabled: true, emailEnabled: true, setupRequired: false, legal: null },
    },
    '/api/auth/me': signedIn
      ? {
          body: {
            user: USER,
            parentGateExpiresAt: null,
            activeKid: mock === 'kid' ? KID : null,
          },
        }
      : { status: 401, body: { statusCode: 401, errorCode: 'UNAUTHORIZED', message: 'x' } },
    '/api/auth/refresh': signedIn
      ? { body: { ok: true } }
      : { status: 401, body: { statusCode: 401, errorCode: 'SESSION_EXPIRED', message: 'x' } },
    '/api/kids': { body: [KID, { ...KID, id: `${KID.id.slice(0, -1)}2`, nickname: 'Leo' }] },
    '/api/learn/map': { body: learnMap },
  };
  return routes[path] ?? { status: 404, body: { errorCode: 'NOT_FOUND', message: 'Not mocked' } };
}

function send(request, response, status, type, path, file) {
  const gzip = COMPRESSIBLE.test(type) && /\bgzip\b/.test(request.headers['accept-encoding'] ?? '');
  response.writeHead(status, {
    ...SECURITY_HEADERS,
    'Content-Type': type,
    'Cache-Control': cacheControl(path),
    Vary: 'Accept-Encoding',
    ...(gzip ? { 'Content-Encoding': 'gzip' } : {}),
  });
  if (request.method === 'HEAD') {
    response.end();
    return;
  }
  const stream = createReadStream(file);
  (gzip ? stream.pipe(createGzip()) : stream).pipe(response);
}

if (!existsSync(join(root, 'index.html'))) {
  console.error(`No build at ${root}. Run "npm run build" first.`);
  process.exit(1);
}

createServer(async (request, response) => {
  const url = new URL(request.url ?? '/', 'http://localhost');
  const path = decodeURIComponent(url.pathname);
  if (path === '/api' || path.startsWith('/api/')) {
    const { status = 200, body } = api(path);
    const payload = typeof body === 'function' ? await body() : body;
    response.writeHead(status, {
      ...SECURITY_HEADERS,
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    });
    response.end(JSON.stringify(payload));
    return;
  }
  if (path === '/healthz') {
    response.writeHead(200, { 'Content-Type': 'text/plain', 'Cache-Control': 'no-store' });
    response.end('ok\n');
    return;
  }
  const file = normalize(join(root, path));
  const inside = file === root || file.startsWith(root + sep);
  if (inside && existsSync(file) && statSync(file).isFile()) {
    const type =
      TYPES[extname(file)] ??
      (path.startsWith('/pictures/') ? 'text/plain' : 'application/octet-stream');
    send(request, response, 200, type, path, file);
    return;
  }
  if (!inside || extname(path) || SERVICE_WORKER.test(path) || path.startsWith('/audio/')) {
    response.writeHead(404, { ...SECURITY_HEADERS, 'Content-Type': 'text/plain' });
    response.end('Not found\n');
    return;
  }
  send(request, response, 200, TYPES['.html'], '/index.html', join(root, 'index.html'));
}).listen(port, () => {
  console.log(`Serving ${root} on http://localhost:${port} (api mock: ${mock})`);
});
