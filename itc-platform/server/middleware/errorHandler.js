/**
 * 统一错误处理中间件
 * 所有路由抛出的异常最终汇聚到这里，输出 {success:false, error:{code,message}}
 */
const { AppError } = require('../utils/errors');

/** 404 兜底 */
function notFoundHandler(req, res, next) {
  next(AppError.notFound('NOT_FOUND', `接口不存在: ${req.method} ${req.originalUrl}`));
}

/** 统一错误处理 */
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  if (err instanceof AppError) {
    return res.status(err.status).json({
      success: false,
      error: { code: err.code, message: err.message }
    });
  }

  // SQLite 唯一约束等数据库错误
  if (err && err.code && String(err.code).startsWith('SQLITE_')) {
    const msg = err.message || '数据库操作失败';
    if (String(err.code) === 'SQLITE_CONSTRAINT_UNIQUE') {
      return res.status(400).json({
        success: false,
        error: { code: 'DUPLICATE_RECORD', message: '记录已存在（唯一字段冲突）' }
      });
    }
    return res.status(500).json({
      success: false,
      error: { code: 'DB_ERROR', message: msg }
    });
  }

  console.error('[errorHandler]', err);
  return res.status(500).json({
    success: false,
    error: { code: 'INTERNAL_ERROR', message: err.message || '服务器内部错误' }
  });
}

module.exports = { notFoundHandler, errorHandler };