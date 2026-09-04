# --- build ------------------------------------------------------------------
FROM node:22-alpine AS build

WORKDIR /app

COPY package.json package-lock.json ./
# `sharp` is only used by `npm run sync` on a developer machine, and building it
# for musl here would cost minutes for nothing. The build itself needs no
# native deps.
RUN npm ci --omit=dev

COPY . .

# The build fetches https://crafter.run/links.json and falls back to the
# committed snapshot, so it succeeds with or without network access.
RUN npm run build

# --- serve ------------------------------------------------------------------
FROM nginx:1.27-alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s \
  CMD wget -q --spider http://127.0.0.1/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
