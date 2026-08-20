/**
 * 认证与用户路由
 * POST /api/auth/login
 * GET  /api/auth/me
 * PUT  /api/auth/password
 * GET  /api/users
 */
const express = require('express');
const bcrypt = require('bcryptjs');
const { db } = require('../db');
const { signToken, authRequired } = require('../middleware/auth');
const { AppError } = require('../utils/errors');
const { now } = require('../utils/time');

const router = express.Router();

/** 安全脱敏用户信息 */
function publicUser(u) {
  if (!u) return null;
  return {
    id: u.id, username: u.username, name: u.name, role: u.role,
    email: u.email || '', avatar: u.avatar || '', created_at: u.created_at
  };
}

/** 登录 */
router.post('/login', async (req, res, next) => {
  try {
    const { username, password } = req.body || {};
    if (!username || !password) {
      throw AppError.validation('用户名和密码不能为空');
    }
    const user = db.prepare('SELECT * FROM users WHERE username = ?').get(String(username).trim());
    if (!user) {
      throw AppError.unauthorized('LOGIN_FAILED', '用户名或密码错误');
    }
    const ok = bcrypt.compareSync(String(password), user.password_hash);
    if (!ok) {
      throw AppError.unauthorized('LOGIN_FAILED', '用户名或密码错误');
    }
    const token = signToken(user);
    res.json({ success: true, data: { token, user: publicUser(user) } });
  } catch (err) {
    next(err);
  }
});

/** 当前用户信息 */
router.get('/me', authRequired, (req, res, next) => {
  try {
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
    if (!user) throw AppError.notFound('USER_NOT_FOUND', '用户不存在');
    res.json({ success: true, data: { user: publicUser(user) } });
  } catch (err) {
    next(err);
  }
});

/** 修改密码 */
router.put('/password', authRequired, (req, res, next) => {
  try {
    const { oldPassword, newPassword } = req.body || {};
    if (!oldPassword || !newPassword) throw AppError.validation('旧密码和新密码不能为空');
    if (String(newPassword).length < 6) throw AppError.validation('新密码长度至少 6 位');
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
    if (!user) throw AppError.notFound('USER_NOT_FOUND', '用户不存在');
    const ok = bcrypt.compareSync(String(oldPassword), user.password_hash);
    if (!ok) throw AppError.validation('旧密码不正确');
    const hash = bcrypt.hashSync(String(newPassword), 10);
    db.prepare('UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?').run(hash, now(), req.user.id);
    res.json({ success: true, data: { message: '密码修改成功' } });
  } catch (err) {
    next(err);
  }
});

/** 用户列表（分派下拉、工作量统计） */
router.get('/users', authRequired, (req, res, next) => {
  try {
    const users = db.prepare('SELECT * FROM users ORDER BY role DESC, name').all();
    res.json({ success: true, data: { users: users.map(publicUser) } });
  } catch (err) {
    next(err);
  }
});

module.exports = router;