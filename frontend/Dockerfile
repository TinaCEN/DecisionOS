FROM node:20-alpine

WORKDIR /app

RUN corepack enable

COPY package.json pnpm-lock.yaml postcss.config.mjs eslint.config.mjs /app/
COPY frontend /app/frontend

ARG NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
ENV NEXT_PUBLIC_API_BASE_URL=${NEXT_PUBLIC_API_BASE_URL}

RUN HUSKY=0 pnpm install --frozen-lockfile
RUN pnpm build:web

EXPOSE 3000

CMD ["pnpm", "exec", "next", "start", "frontend", "--hostname", "0.0.0.0", "--port", "3000"]
