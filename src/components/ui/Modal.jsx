import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function Modal({ title, children, onClose, size = 'md', scrollable = false, dynamicPosition = false, footer }) {
  const overlayRef = useRef(null);

  useEffect(() => {
    const handleEsc = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', handleEsc);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', handleEsc);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  const SIZES = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-2xl',
    '2xl': 'max-w-3xl',
    '3xl': 'max-w-5xl',
  };

  // Dynamic positioning: always centered vertically in viewport
  const positionStyle = dynamicPosition
    ? { position: 'fixed', top: '50%', transform: 'translateY(-50%)' }
    : {};

  const modalContent = (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center px-4"
      ref={overlayRef}
      onClick={(e) => {
        if (e.target === overlayRef.current) onClose();
      }}
    >
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" />
      <div
        className={cn(
          'relative bg-white rounded-2xl shadow-xl w-full',
          scrollable
            ? 'max-h-[75vh] flex flex-col overflow-hidden'
            : SIZES[size] || SIZES.md,
          dynamicPosition && 'max-h-[80vh]'
        )}
        style={positionStyle}
      >
        {title && (
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 flex-shrink-0 bg-white rounded-t-2xl">
            <h3 className="font-semibold text-slate-800 text-base">{title}</h3>
            <button
              onClick={onClose}
              className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600 transition-smooth"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
        <div
          className="px-6 py-5 overflow-y-auto"
          style={dynamicPosition ? { maxHeight: 'calc(80vh - 80px)' } : undefined}
        >
          {children}
        </div>
        {footer && (
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100 flex-shrink-0 bg-white rounded-b-2xl">
            {footer}
          </div>
        )}
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
