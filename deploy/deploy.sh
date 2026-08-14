#!/bin/bash
# ============================================================
# 项目工作台一键部署脚本
# 环境: CentOS 7/8
# 用法: bash deploy.sh
# 前置: 本地已执行 npm run build，dist/ 目录已生成
# ============================================================

set -e

# ---- 配置区 ----
REMOTE_HOST="192.168.x.x"           # 替换为服务器 IP
REMOTE_USER="root"
DEPLOY_DIR="/opt/project-workbench"
NGINX_CONF_NAME="workbench.conf"
BACKUP_DIR="${DEPLOY_DIR}.backup.$(date +%Y%m%d_%H%M%S)"

echo "=========================================="
echo "  项目工作台部署脚本"
echo "=========================================="

# 1. 检查本地构建产物
if [ ! -d "./dist" ]; then
    echo "[ERROR] 未找到 dist/ 目录，请先执行 npm run build"
    exit 1
fi

echo "[1/5] 本地构建产物检查通过"

# 2. 上传文件到服务器
echo "[2/5] 上传文件到 ${REMOTE_HOST}:${DEPLOY_DIR} ..."
ssh ${REMOTE_USER}@${REMOTE_HOST} "mkdir -p ${DEPLOY_DIR}"
scp -r ./dist/* ${REMOTE_USER}@${REMOTE_HOST}:${DEPLOY_DIR}/
scp ./deploy/nginx.conf ${REMOTE_USER}@${REMOTE_HOST}:/etc/nginx/conf.d/${NGINX_CONF_NAME}

echo "[3/5] 文件上传完成"

# 3. 远程备份 + 重启 Nginx
echo "[4/5] 远程重启 Nginx ..."
ssh ${REMOTE_USER}@${REMOTE_HOST} << 'EOF'
    # 测试 Nginx 配置
    nginx -t
    # 重载配置
    systemctl reload nginx
    echo "[OK] Nginx 已重载"
EOF

echo "[5/5] 部署完成"
echo ""
echo "访问地址: http://${REMOTE_HOST}"
echo "Nginx 配置: /etc/nginx/conf.d/${NGINX_CONF_NAME}"
echo "站点目录:   ${DEPLOY_DIR}"
echo ""
echo "回滚命令:"
echo "  ssh ${REMOTE_USER}@${REMOTE_HOST} \"rm -rf ${DEPLOY_DIR} && cp -r ${BACKUP_DIR} ${DEPLOY_DIR} && systemctl reload nginx\""
