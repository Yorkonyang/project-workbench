# ============================================================
# Dockerfile - 项目工作台
# 多阶段构建：node 构建 -> nginx 运行
# ============================================================

# ---- 阶段1: 构建 ----
FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# ---- 阶段2: 运行 ----
FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY deploy/nginx-docker.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
