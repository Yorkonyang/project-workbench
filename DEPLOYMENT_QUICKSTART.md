# 项目工作台快速部署指南

## 一、快速部署（5 分钟）

### 1. 服务器准备
```bash
# CentOS 安装 Nginx
yum install -y nginx epel-release
systemctl start nginx && systemctl enable nginx
firewall-cmd --permanent --add-service=http && firewall-cmd --reload
```

### 2. 本地配置
编辑 `deploy/deploy.sh`：
```bash
REMOTE_HOST="你的服务器IP"
REMOTE_USER="root"
```

### 3. 一键部署
```bash
npm install
npm run build
bash deploy/deploy.sh
```

### 4. 验证
浏览器访问：`http://你的服务器IP`

---

## 二、快速更新（2 分钟）

```bash
# 拉取最新代码
git pull origin main

# 重新构建并部署
npm run build && bash deploy/deploy.sh
```

---

## 三、常见问题

### Q1: SSH 连接失败
```bash
# 测试连接
ssh root@你的服务器IP

# 如果需要密码，配置免密登录
ssh-copy-id root@你的服务器IP
```

### Q2: Nginx 配置错误
```bash
# 服务器上测试配置
nginx -t

# 查看错误日志
tail -f /var/log/nginx/error.log
```

### Q3: 更新后 404
```bash
# 重载 Nginx
ssh root@你的服务器IP "systemctl reload nginx"
```

---

## 四、HTTPS 配置（可选）

```bash
# 安装 certbot
yum install -y certbot python2-certbot-nginx

# 自动配置 HTTPS
certbot --nginx -d 你的域名
```

---

## 五、回滚到上一版本

```bash
# 查看备份
ls -la /opt/ | grep project-workbench.backup

# 恢复
BACKUP=$(ls -td /opt/project-workbench.backup.* | head -1)
ssh root@你的服务器IP "rm -rf /opt/project-workbench && cp -r $BACKUP /opt/project-workbench && systemctl reload nginx"
```

---

## 六、监控命令

```bash
# 检查服务状态
ssh root@你的服务器IP "systemctl status nginx"

# 查看访问日志
ssh root@你的服务器IP "tail -f /var/log/nginx/access.log"

# 健康检查
curl http://你的服务器IP/health
```

---

## 七、Docker 部署（备选方案）

```bash
# 构建镜像
docker build -t project-workbench:latest .

# 运行容器
docker run -d --name workbench -p 80:80 --restart unless-stopped project-workbench:latest

# 或使用 Docker Compose
docker-compose -f deploy/docker-compose.yml up -d
```

---

**详细文档**: 请查看 `docs/DEPLOYMENT_GUIDE.md`
