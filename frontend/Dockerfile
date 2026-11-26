FROM node:24-alpine@sha256:116b800c3754b440ee0aa3ed2f20f5bf3d99a554bfd9adeea09ea8017f6e85f5 AS deps
WORKDIR /app
RUN npm install -g npm@12.0.2
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts

FROM deps AS development
ENV BACKEND_URL=http://backend:3000
COPY . .
EXPOSE 4200
CMD ["npx", "ng", "serve", "--host", "0.0.0.0", "--port", "4200"]

FROM deps AS build
COPY . .
RUN npm run build && npm run check:external

FROM nginxinc/nginx-unprivileged:alpine@sha256:b5047b9b76845eac124358373c6852377c52e4b05834a47647e955dd91cb8f1e AS production
COPY --chown=root:root nginx.conf.template security-headers.conf.template /etc/murmeli/
COPY --chown=root:root --chmod=0755 docker-entrypoint.sh /usr/local/bin/murmeli-entrypoint.sh
COPY --from=build --chown=root:root /app/dist/murmeli-frontend/browser /usr/share/nginx/html
USER 101
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1:8080/healthz || exit 1
ENTRYPOINT ["/usr/local/bin/murmeli-entrypoint.sh"]
