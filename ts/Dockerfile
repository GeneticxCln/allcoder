# Multi-stage Dockerfile for allcoder-ts (CLI/API)

# ---- Builder ----
FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json* pnpm-lock.yaml* yarn.lock* ./
COPY ts ./ts
RUN cd ts && npm ci || npm install
RUN cd ts && npm run build

# ---- Runtime ----
FROM node:20-alpine AS runtime
WORKDIR /app
COPY --from=builder /app/ts/dist ./dist
COPY --from=builder /app/ts/package.json ./package.json
RUN npm pkg set type=module && npm pkg set bin.allcoder-ts=dist/index.js
USER node
EXPOSE 8000
ENTRYPOINT ["node", "dist/index.js"]
CMD ["--version"]
