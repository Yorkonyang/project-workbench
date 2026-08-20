/**
 * JWT 认证中间件
 * - authRequired: 登录即可
 * - adminRequired: 必须 admin
 * 约定：请求头 Authorization: Bearer <token>
 */
const jwt = require('jsonwebtoken');
const { JWT_SECRET, JWT_EXPIRES_IN } = require('../config');
const { AppError } = require('../utils/errors');

/** 签发 JWT */
function signToken(user) {
  return jwt.sign(
    { id: user.id, username: user.username, name: user.name, role: user.role },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
}

/** 从请求头解析 token 并挂载 req.user */
function authRequired(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) {
    return next(AppError.unauthorized('UNAUTHORIZED', '未登录或缺少 token'));
  }
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = {
      id: payload.id,
      username: payload.username,
      name: payload.name,
      role: payload.role
    };
    return next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return next(AppError.unauthorized('TOKEN_EXPIRED', '登录已过期，请重新登录'));
    }
    return next(AppError.unauthorized('INVALID_TOKEN', '无效的登录凭证'));
  }
}

/** admin 权限 */
function adminRequired(req, res, next) {
  if (!req.user) return next(AppError.unauthorized());
  if (req.user.role !== 'admin') {
    return next(AppError.forbidden('ADMIN_REQUIRED', '需要管理员权限'));
  }
  return next();
}

module.exports = { signToken, authRequired, adminRequired };