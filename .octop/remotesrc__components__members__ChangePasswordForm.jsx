import { useState } from 'react';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import { Eye, EyeOff, Lock, Check, AlertCircle } from 'lucide-react';
import { useAuthStore } from '@/store/useAuthStore';

export default function ChangePasswordForm({ onClose }) {
  const changePassword = useAuthStore((s) => s.changePassword);

  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showOld, setShowOld] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const validate = () => {
    if (!oldPassword.trim()) return '请输入原密码';
    if (!newPassword.trim()) return '请输入新密码';
    if (newPassword.length < 8) return '新密码至少8位';
    if (!/[a-z]/.test(newPassword) || !/[A-Z]/.test(newPassword) || !/\d/.test(newPassword))
      return '新密码需包含大小写字母和数字';
    if (newPassword === oldPassword) return '新密码不能与原密码相同';
    if (newPassword !== confirmPassword) return '两次输入的密码不一致';
    return '';
  };

  const handleSubmit = async () => {
    const err = validate();
    if (err) {
      setError(err);
      return;
    }
    setError('');
    // S2：改密走后端 /auth/change-password，前端不再持有/比对明文
    const result = await changePassword(oldPassword, newPassword);
    if (result.success) {
      setSuccess(true);
      setTimeout(() => onClose(), 1500);
    } else {
      setError(result.error || '修改失败');
    }
  };

  if (success) {
    return (
      <Modal title="修改密码" onClose={onClose}>
        <div className="py-8 flex flex-col items-center">
          <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mb-3">
            <Check className="w-7 h-7 text-green-600" />
          </div>
          <p className="text-sm font-medium text-slate-800">密码修改成功</p>
          <p className="text-xs text-slate-400 mt-1">下次登录请使用新密码</p>
        </div>
      </Modal>
    );
  }

  return (
    <Modal title="修改密码" onClose={onClose}>
      <div className="space-y-4">
        {error && (
          <div className="flex items-center gap-2 px-3 py-2.5 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {error}
          </div>
        )}

        {/* 原密码 */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">原密码</label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type={showOld ? 'text' : 'password'}
              value={oldPassword}
              onChange={(e) => { setOldPassword(e.target.value); setError(''); }}
              className="w-full pl-9 pr-9 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              placeholder="请输入原密码"
              autoComplete="current-password"
            />
            <button
              type="button"
              onClick={() => setShowOld(!showOld)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              {showOld ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* 新密码 */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">新密码</label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type={showNew ? 'text' : 'password'}
              value={newPassword}
              onChange={(e) => { setNewPassword(e.target.value); setError(''); }}
              className="w-full pl-9 pr-9 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              placeholder="至少8位，含大小写和数字"
              autoComplete="new-password"
            />
            <button
              type="button"
              onClick={() => setShowNew(!showNew)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* 确认新密码 */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">确认新密码</label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type={showConfirm ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(e) => { setConfirmPassword(e.target.value); setError(''); }}
              className="w-full pl-9 pr-9 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              placeholder="再次输入新密码"
              autoComplete="new-password"
            />
            <button
              type="button"
              onClick={() => setShowConfirm(!showConfirm)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          {confirmPassword && newPassword !== confirmPassword && (
            <p className="text-xs text-red-500 mt-1">两次输入的密码不一致</p>
          )}
          {confirmPassword && newPassword === confirmPassword && newPassword.length >= 6 && (
            <p className="text-xs text-green-500 mt-1 flex items-center gap-1">
              <Check className="w-3 h-3" /> 密码一致
            </p>
          )}
        </div>

        <div className="flex gap-3 pt-2">
          <Button variant="outline" onClick={onClose} className="flex-1">
            取消
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!oldPassword || !newPassword || !confirmPassword}
            className="flex-1"
          >
            确认修改
          </Button>
        </div>
      </div>
    </Modal>
  );
}
