# ---- 前端构建阶段 ----
FROM node:22-alpine AS frontend-builder
WORKDIR /app/web
COPY web/package.json ./
RUN npm install
COPY web/ ./
RUN npm run build

# ---- 后端运行阶段 ----
FROM node:22-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY server/package.json server/package-lock.json* ./
RUN npm install --omit=dev
COPY server/ ./server
COPY --from=frontend-builder /app/web/dist ./web/dist
EXPOSE 3001
CMD ["node", "server/index.js"]