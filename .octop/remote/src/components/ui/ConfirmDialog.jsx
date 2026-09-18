import Modal from './Modal';
import Button from './Button';
import { AlertTriangle } from 'lucide-react';

export default function ConfirmDialog({ title, message, onConfirm, onClose, confirmLabel = '确认删除', danger = true, dynamicPosition = true }) {
  return (
    <Modal title={title || '确认操作'} onClose={onClose} size="sm" dynamicPosition={dynamicPosition}>
      <div className="flex gap-3">
        {danger && (
          <div className="w-10 h-10 bg-red-50 rounded-full flex items-center justify-center shrink-0">
            <AlertTriangle className="w-5 h-5 text-red-500" />
          </div>
        )}
        <p className="text-sm text-slate-600 pt-1">{message}</p>
      </div>
      <div className="flex justify-end gap-2 mt-6">
        <Button variant="secondary" size="sm" onClick={onClose}>取消</Button>
        <Button variant={danger ? 'danger' : 'primary'} size="sm" onClick={() => { onConfirm(); onClose(); }}>
          {confirmLabel}
        </Button>
      </div>
    </Modal>
  );
}
