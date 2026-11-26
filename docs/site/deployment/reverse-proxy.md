# Reverse proxy and HTTPS

Murmeli has no TLS of its own. Put a reverse proxy in front of it that terminates HTTPS and forwards everything to the frontend container on port 8080:

```text
browser ──https──> reverse proxy ──http──> murmeli-frontend (nginx :8080) ──> murmeli-backend (:3000)
```

HTTPS is not optional. The session cookies are always `Secure` (`COOKIE_SECURE` must be `true` in production), so browsers only accept them over HTTPS, or on `http://localhost`. `APP_URL` must be the `https://` address of the proxy.

## Checklist
1. Set `APP_URL` to the public address, for example `https://murmeli.example.com`.
2. Don't expose port 8080 to the network. Either bind it to the loopback interface with `FRONTEND_PORT=127.0.0.1:8080` (for a proxy on the host), or remove the port and use a shared Docker network (for a proxy in a container).
3. Set `TRUSTED_PROXIES` to the address the proxy connects from (see [below](#trusted_proxies-and-the-real-client-ip)).
4. Turn on HSTS, either at the proxy or with `HSTS_ENABLED=true` (see [HSTS](#hsts)).
5. Run `docker compose up -d` and check the result (see [Check the setup](#check-the-setup)).

Leave `TRUST_PROXY` at its default of `1`. The frontend's nginx always passes exactly one client address to the backend, however many proxies are in front.

## `TRUSTED_PROXIES` and the real client IP
Rate limits and lockouts (sign-in, registration, password reset, parent area) count requests per client IP. Behind a proxy, every request comes from the proxy's address. Unless the frontend knows that address, all visitors share one IP, and one person guessing passwords can lock everyone out.

`TRUSTED_PROXIES` is a comma-separated list of IP addresses or CIDR ranges. Only requests from these addresses may set `X-Forwarded-For` and `X-Forwarded-Proto`; from anywhere else the headers are ignored. A `/0` range is rejected. While the variable is empty, the frontend logs a warning at startup.

Which address to use depends on where the proxy runs:

| Proxy runs… | It connects from… | Example `TRUSTED_PROXIES` |
|---|---|---|
| in a container on a shared Docker network | its address in that network | the network's subnet, e.g. `172.30.0.0/24` |
| on the host, connecting to `127.0.0.1:8080` | the gateway of the `murmeli` Docker network | that gateway, e.g. `172.31.250.1` |
| on another machine | that machine's IP | `192.168.1.10` |

Docker can assign a different subnet when a network is recreated, so pin the subnet for a stable value. The examples below show how. A broad range such as `172.16.0.0/12` also works, but then every container on the host counts as a trusted proxy.

## Traefik
Traefik runs in its own container and reaches the frontend through a shared, external Docker network. Create the network once, with a fixed subnet:

```bash
docker network create --subnet 172.30.0.0/24 traefik
```

Attach Traefik to it, with a `websecure` entry point on port 443 and a certificate resolver named `letsencrypt` (see the Traefik documentation). Then add a `docker-compose.override.yml` next to Murmeli's `docker-compose.yml`. Docker Compose merges it automatically:

```yaml
services:
  frontend:
    ports: !reset []
    networks:
      - murmeli
      - traefik
    labels:
      - traefik.enable=true
      - traefik.docker.network=traefik
      - traefik.http.routers.murmeli.rule=Host(`murmeli.example.com`)
      - traefik.http.routers.murmeli.entrypoints=websecure
      - traefik.http.routers.murmeli.tls.certresolver=letsencrypt
      - traefik.http.services.murmeli.loadbalancer.server.port=8080

networks:
  traefik:
    external: true
```

`!reset []` removes the published port (Docker Compose 2.24 or newer). With an older version, set `FRONTEND_PORT=127.0.0.1:8080` instead. Add to `.env`:

```dotenv
APP_URL=https://murmeli.example.com
TRUSTED_PROXIES=172.30.0.0/24
```

Traefik sets `X-Forwarded-For` and `X-Forwarded-Proto` by default.

## Caddy
Caddy on the host gets certificates automatically. Bind Murmeli to the loopback interface and pin the subnet of its Docker network, so the address Caddy connects from stays the same. In `docker-compose.override.yml`:

```yaml
networks:
  murmeli:
    ipam:
      config:
        - subnet: 172.31.250.0/24
```

In `.env`:

```dotenv
APP_URL=https://murmeli.example.com
FRONTEND_PORT=127.0.0.1:8080
TRUSTED_PROXIES=172.31.250.1
```

Connections to a published port on `127.0.0.1` reach the container from the network's gateway, here `172.31.250.1`. The subnet only changes when the network is recreated, so run `docker compose down` and `docker compose up -d` after adding it.

The `Caddyfile`:

```caddy
murmeli.example.com {
    reverse_proxy 127.0.0.1:8080
}
```

Caddy passes `Host` and sets `X-Forwarded-For` and `X-Forwarded-Proto` on its own. If Caddy runs in a container instead, use a shared network as in the Traefik example and `reverse_proxy murmeli-frontend:8080`.

## nginx
nginx on the host, with the same `docker-compose.override.yml` and `.env` as in the Caddy example. Certificates come from certbot or another ACME client:

```nginx
server {
    listen 80;
    listen [::]:80;
    server_name murmeli.example.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl;
    listen [::]:443 ssl;
    http2 on;
    server_name murmeli.example.com;

    ssl_certificate     /etc/letsencrypt/live/murmeli.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/murmeli.example.com/privkey.pem;

    client_max_body_size 1m;

    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $remote_addr;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

`X-Forwarded-For $remote_addr` replaces whatever the client sent, so a client can't forge its address. `http2 on` needs nginx 1.25.1 or newer; with older versions, write `listen 443 ssl http2;`.

## HSTS
HSTS tells browsers to use HTTPS for this host from now on. Send it from one place only:

- **At the proxy** (Traefik middleware, Caddy `header`, nginx `add_header`), or
- **from Murmeli**, with `HSTS_ENABLED=true`. `HSTS_MAX_AGE` (default `31536000`, one year) and `HSTS_INCLUDE_SUBDOMAINS` (default `false`) shape the header. With HSTS on, the Content Security Policy also gets `upgrade-insecure-requests`.

Turn it on only when HTTPS works, and only set `HSTS_INCLUDE_SUBDOMAINS=true` when every subdomain of that domain has HTTPS. Browsers remember the header for `HSTS_MAX_AGE` seconds. While HSTS is off, the frontend logs a warning at startup.

## Check the setup
- `curl -sI https://murmeli.example.com/` returns `200` with a `Content-Security-Policy` header, and `Strict-Transport-Security` if you enabled it.
- Look at the `client` field in `docker compose logs frontend`. It should show your own public IP, not the proxy's. If it shows the proxy's address, `TRUSTED_PROXIES` doesn't match it: put that address into `TRUSTED_PROXIES` and run `docker compose up -d`.
- Sign in from another device. If the sign-in seems to work but you land on the sign-in page again, the browser dropped the cookies: the site is not served over HTTPS.

## Notes
- `/healthz` on the frontend answers `200` for uptime checks. `/api/health/ready` is blocked at the frontend (404).
- The access log is JSON and never contains query strings. Invitation tokens in paths are logged as `:token`.
- Murmeli needs no WebSockets and no sticky sessions.
- `CORS_ORIGINS` is only for other origins that call the API from a browser. A normal setup leaves it empty, because the app and the API share one origin.
- `COOKIE_DOMAIN` stays empty for host-only cookies, which is what you want unless you share cookies between subdomains.
