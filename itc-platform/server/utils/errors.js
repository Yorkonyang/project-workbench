/**
 * 统一错误类型
 * 业务错误统一抛出 AppError，由 errorHandler 中间件转换为 {success:false, error:{code,message}}
 */

class AppError extends Error {
  /**
   * @param {string} code 错误码（如 TICKET_NOT_FOUND）
   * @param {string} message 用户可读信息
   * @param {number} [status=400] HTTP 状态码
   */
  constructor(code, message, status = 400) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.status = status;
  }
}

/** 404 快捷方法 */
AppError.notFound = (code, message) => new AppError(code, message || '资源不存在', 404);

/** 401 快捷方法 */
AppError.unauthorized = (code, message) => new AppError(code || 'UNAUTHORIZED', message || '未登录或登录已过期', 401);

/** 403 快捷方法 */
AppError.forbidden = (code, message) => new AppError(code || 'FORBIDDEN', message || '没有权限执行该操作', 403);

/** 参数校验失败 */
AppError.validation = (message) => new AppError('VALIDATION_ERROR', message, 400);

module.exports = { AppError };