FROM node:22-alpine AS dependencies

WORKDIR /app

RUN corepack enable

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

FROM dependencies AS build
COPY . .
RUN pnpm build

FROM dependencies AS browser-test
RUN apk add --no-cache chromium font-noto-emoji
COPY . .
RUN VITE_BASE_PATH=/GlowWords/ pnpm build
CMD ["node", "--test", "tests/garden.test.mjs"]

FROM nginx:1.27-alpine AS runtime

COPY --from=build /app/dist/client /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
