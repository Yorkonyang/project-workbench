# 项目工作台部署与更新指南

## 一、部署方案概览

本项目支持两种部署方式：
1. **传统 Nginx 部署**（推荐）- 适合大多数服务器环境
2. **Docker 部署** - 适合容器化环境

---

## 二、传统 Nginx 部署

### 2.1 服务器环境要求

- **操作系统**: CentOS 7/8 或 Ubuntu 20.04+
- **Nginx**: 1.18+
- **Node.js**: 22+ (仅本地构建时需要)
- **端口**: 80 (HTTP) 或 443 (HTTPS)
- **权限**: root 或 sudo 权限

### 2.2 部署前准备

#### 2.2.1 服务器端安装 Nginx

**CentOS:**
```bash
# 安装 EPEL 源
yum install -y epel-release

# 安装 Nginx
yum install -y nginx

# 启动并设置开机自启
systemctl start nginx
systemctl enable nginx

# 开放防火墙端口
firewall-cmd --permanent --add-service=http
firewall-cmd --permanent --add-service=https
firewall-cmd --reload
```

**Ubuntu:**
```bash
# 更新软件源
apt update

# 安装 Nginx
apt install -y nginx

# 启动并设置开机自启
systemctl start nginx
systemctl enable nginx

# 开放防火墙端口（如果使用 UFW）
ufw allow 'Nginx Full'
```

#### 2.2.2 配置 SSH 免密登录（推荐）

```bash
# 在本地生成 SSH 密钥（如果还没有）
ssh-keygen -t rsa -b 4096 -C "deploy@example.com"

# 将公钥复制到服务器
ssh-copy-id root@your-server-ip

# 测试免密登录
ssh root@your-server-ip
```

### 2.3 本地配置部署脚本

#### 2.3.1 修改部署配置

编辑 `deploy/deploy.sh` 文件，修改以下配置：

```bash
# ---- 配置区 ----
REMOTE_HOST="192.168.1.100"           # 替换为服务器 IP
REMOTE_USER="root"                     # 服务器用户名
DEPLOY_DIR="/opt/project-workbench"    # 部署目录
NGINX_CONF_NAME="workbench.conf"       # Nginx 配置文件名
```

#### 2.3.2 修改 Nginx 配置

编辑 `deploy/nginx.conf` 文件，修改域名或 IP：

```nginx
server {
    listen       80;
    server_name  workbench.grinm.com;  # 替换为实际域名或 IP

    # 根目录指向构建产物
    root /opt/project-workbench;
    index index.html;

    # ... 其他配置保持不变
}
```

### 2.4 执行部署

#### 2.4.1 本地构建

```bash
# 进入项目目录
cd D:\AI\project-workbench

# 安装依赖（首次部署）
npm install

# 构建生产版本
npm run build
```

#### 2.4.2 执行部署脚本

**Windows (Git Bash):**
```bash
bash deploy/deploy.sh
```

**Linux/macOS:**
```bash
bash deploy/deploy.sh
```

#### 2.4.3 部署流程说明

脚本会自动执行以下步骤：
1. ✅ 检查本地 `dist/` 目录是否存在
2. ✅ 在服务器上创建部署目录
3. ✅ 上传构建产物到服务器
4. ✅ 上传 Nginx 配置文件
5. ✅ 测试并重载 Nginx 配置

### 2.5 验证部署

```bash
# 在浏览器访问
http://your-server-ip

# 或使用命令行测试
curl http://your-server-ip/health
# 预期输出: ok
```

### 2.6 HTTPS 配置（推荐）

使用 Let's Encrypt 免费 SSL 证书：

```bash
# 安装 certbot
# CentOS
yum install -y certbot python2-certbot-nginx

# Ubuntu
apt install -y certbot python3-certbot-nginx

# 自动申请证书并配置 Nginx
certbot --nginx -d workbench.grinm.com

# 设置自动续期
certbot renew --dry-run
```

---

## 三、Docker 部署

### 3.1 服务器环境要求

- **Docker**: 20.10+
- **Docker Compose**: 2.0+
- **端口**: 80

### 3.2 Docker 部署步骤

#### 3.2.1 构建镜像

```bash
# 进入项目目录
cd D:\AI\project-workbench

# 构建 Docker 镜像
docker build -t project-workbench:latest .
```

#### 3.2.2 运行容器

```bash
# 运行容器
docker run -d \
  --name workbench \
  -p 80:80 \
  --restart unless-stopped \
  project-workbench:latest
```

#### 3.2.3 使用 Docker Compose（推荐）

编辑 `deploy/docker-compose.yml`：

```yaml
version: '3.8'

services:
  workbench:
    image: project-workbench:latest
    container_name: workbench
    ports:
      - "80:80"
    restart: unless-stopped
    volumes:
      - ./logs:/var/log/nginx
    healthcheck:
      test: ["CMD", "wget", "--quiet", "--tries=1", "--spider", "http://localhost/health"]
      interval: 30s
      timeout: 10s
      retries: 3
```

启动服务：
```bash
docker-compose -f deploy/docker-compose.yml up -d
```

### 3.3 Docker 部署验证

```bash
# 查看容器状态
docker ps | grep workbench

# 查看容器日志
docker logs workbench

# 测试健康检查
curl http://localhost/health
```

---

## 四、功能更新流程

### 4.1 更新前准备

```bash
# 1. 拉取最新代码（如果使用 Git）
git pull origin main

# 2. 查看更新内容
git log --oneline -10

# 3. 备份当前版本（可选）
cp -r dist dist.backup.$(date +%Y%m%d_%H%M%S)
```

### 4.2 执行更新

#### 方式一：使用部署脚本（推荐）

```bash
# 本地构建
npm run build

# 部署到服务器
bash deploy/deploy.sh
```

#### 方式二：手动更新

```bash
# 1. 本地构建
npm run build

# 2. 上传到服务器
scp -r dist/* root@your-server-ip:/opt/project-workbench/

# 3. 重载 Nginx
ssh root@your-server-ip "systemctl reload nginx"
```

#### 方式三：Docker 更新

```bash
# 1. 重新构建镜像
docker build -t project-workbench:latest .

# 2. 停止并删除旧容器
docker stop workbench
docker rm workbench

# 3. 启动新容器
docker run -d \
  --name workbench \
  -p 80:80 \
  --restart unless-stopped \
  project-workbench:latest

# 或使用 Docker Compose
docker-compose -f deploy/docker-compose.yml up -d --build
```

### 4.3 更新后验证

```bash
# 1. 检查服务状态
ssh root@your-server-ip "systemctl status nginx"

# 2. 测试访问
curl http://your-server-ip/health

# 3. 查看浏览器访问
# 在浏览器中访问 http://your-server-ip
```

---

## 五、故障排查

### 5.1 部署失败

#### 问题：SSH 连接失败
```bash
# 测试 SSH 连接
ssh root@your-server-ip

# 检查防火墙
# CentOS
firewall-cmd --list-ports
# Ubuntu
ufw status
```

#### 问题：Nginx 配置错误
```bash
# 测试 Nginx 配置
nginx -t

# 查看 Nginx 错误日志
tail -f /var/log/nginx/error.log
```

### 5.2 更新后页面 404

#### 问题：Nginx 路由配置问题
检查 `try_files` 配置：
```nginx
location / {
    try_files $uri $uri/ /index.html;
}
```

#### 问题：文件权限问题
```bash
# 修改文件权限
chmod -R 755 /opt/project-workbench
chown -R nginx:nginx /opt/project-workbench
```

### 5.3 回滚到上一版本

```bash
# 查看备份目录
ls -la /opt/ | grep project-workbench.backup

# 恢复备份
ssh root@your-server-ip << 'EOF'
    BACKUP_DIR=$(ls -td /opt/project-workbench.backup.* | head -1)
    rm -rf /opt/project-workbench
    cp -r $BACKUP_DIR /opt/project-workbench
    systemctl reload nginx
    echo "已回滚到版本: $BACKUP_DIR"
EOF
```

---

## 六、性能优化建议

### 6.1 Nginx 配置优化

```nginx
# 启用 HTTP/2
listen 443 ssl http2;

# 增加缓冲区大小
client_body_buffer_size 128k;
client_max_body_size 10m;

# 启用 Brotli 压缩（需安装模块）
brotli on;
brotli_comp_level 6;
brotli_types text/plain text/css application/json application/javascript text/xml application/xml text/javascript image/svg+xml;
```

### 6.2 CDN 加速

将静态资源上传到 CDN，修改 Nginx 配置：
```nginx
location /assets/ {
    proxy_pass https://your-cdn-domain.com/assets/;
    proxy_cache_valid 200 1y;
}
```

### 6.3 数据库优化

如果使用 SQLite，定期优化数据库：
```bash
sqlite3 data/workbench.db "VACUUM;"
```

---

## 七、监控与日志

### 7.1 Nginx 访问日志

```bash
# 实时查看访问日志
tail -f /var/log/nginx/access.log

# 统计访问量
awk '{print $1}' /var/log/nginx/access.log | sort | uniq -c | sort -rn
```

### 7.2 应用日志监控

```bash
# 创建日志目录
mkdir -p /opt/project-workbench/logs

# 配置日志轮转
cat > /etc/logrotate.d/project-workbench << 'EOF'
/opt/project-workbench/logs/*.log {
    daily
    rotate 7
    compress
    missingok
    notifempty
    create 644 nginx nginx
}
EOF
```

---

## 八、安全建议

### 8.1 基本安全措施

1. **定期更新系统**
```bash
# CentOS
yum update -y

# Ubuntu
apt update && apt upgrade -y
```

2. **配置防火墙**
```bash
# CentOS - 仅开放必要端口
firewall-cmd --permanent --add-service=http
firewall-cmd --permanent --add-service=https
firewall-cmd --permanent --remove-service=ssh
firewall-cmd --reload
```

3. **限制 SSH 访问**
```bash
# 编辑 /etc/ssh/sshd_config
Port 22222                    # 修改默认端口
PermitRootLogin no            # 禁止 root 登录
PasswordAuthentication no     # 禁用密码登录

# 重启 SSH 服务
systemctl restart sshd
```

### 8.2 备份策略

```bash
# 创建备份脚本
cat > /opt/backup-workbench.sh << 'EOF'
#!/bin/bash
BACKUP_DIR="/backup/workbench"
DATE=$(date +%Y%m%d_%H%M%S)
mkdir -p $BACKUP_DIR

# 备份应用文件
tar -czf $BACKUP_DIR/workbench_$DATE.tar.gz /opt/project-workbench

# 备份数据库
cp /opt/project-workbench/data/workbench.db $BACKUP_DIR/workbench_$DATE.db

# 删除 7 天前的备份
find $BACKUP_DIR -name "workbench_*" -mtime +7 -delete

echo "备份完成: $BACKUP_DIR/workbench_$DATE"
EOF

chmod +x /opt/backup-workbench.sh

# 设置定时备份（每天凌晨 2 点）
(crontab -l 2>/dev/null; echo "0 2 * * * /opt/backup-workbench.sh") | crontab -
```

---

## 九、快速参考

### 部署命令速查

```bash
# 首次部署
npm install && npm run build && bash deploy/deploy.sh

# 日常更新
npm run build && bash deploy/deploy.sh

# 检查部署状态
curl http://your-server-ip/health

# 查看 Nginx 日志
ssh root@your-server-ip "tail -f /var/log/nginx/error.log"

# 回滚
ssh root@your-server-ip "systemctl reload nginx"
```

### 常用端口

- **HTTP**: 80
- **HTTPS**: 443
- **SSH**: 22（建议修改为其他端口）

### 重要文件路径

- **部署目录**: `/opt/project-workbench`
- **Nginx 配置**: `/etc/nginx/conf.d/workbench.conf`
- **Nginx 日志**: `/var/log/nginx/`
- **数据库**: `/opt/project-workbench/data/workbench.db`

---

## 十、联系与支持

如有问题，请参考：
- 项目文档: `docs/` 目录
- Nginx 官方文档: https://nginx.org/en/docs/
- Docker 官方文档: https://docs.docker.com/
