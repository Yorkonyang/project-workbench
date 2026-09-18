/**
 * MultiSelect - 可搜索多选下拉组件
 */
import { useState, useRef, useEffect, useLayoutEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { X, ChevronDown, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { pinyinMatch } from '@/lib/pinyinMatch';

export default function MultiSelect({
  label,
  value = [],          // string[] - 选中的 value 数组
  onChange,            // (value: string[]) => void
  options = [],        // [{value, label}]
  placeholder = '请选择',
  searchable = true,
  className,
  maxDisplay = 3,
  single = false,        // 单选模式：选中即替换并关闭下拉
  pinnedValues = null,   // Set<string> - 已置顶选项的 value 集合，用于标记"常用"
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const wrapperRef = useRef(null);
  const dropdownRef = useRef(null);
  const searchInputRef = useRef(null);
  const [coords, setCoords] = useState({ top: 0, left: 0, width: 0 });

  // 根据触发元素位置计算下拉坐标（portal 渲染到 body，脱离 Modal 的 overflow 裁剪）
  const reposition = useCallback(() => {
    if (!wrapperRef.current) return;
    const rect = wrapperRef.current.getBoundingClientRect();
    const dropdownH = 260; // 估算下拉最大高度（搜索框 + 列表 max-h-52）
    const spaceBelow = window.innerHeight - rect.bottom;
    const dropUp = spaceBelow < dropdownH && rect.top > dropdownH;
    setCoords({
      left: rect.left,
      width: rect.width,
      top: dropUp ? rect.top - 4 - dropdownH : rect.bottom + 4,
    });
  }, []);

  // 打开时（绘制前）先计算一次定位，避免首帧出现在 (0,0) 造成闪动
  useLayoutEffect(() => {
    if (open) reposition();
  }, [open, reposition]);

  // 打开状态下，弹窗/页面滚动或窗口缩放时重新定位下拉（跟随触发元素），
  // 不再直接收起，避免打开瞬间因聚焦搜索框触发滚动而被误关
  useEffect(() => {
    if (!open) return;
    const onReflow = () => reposition();
    window.addEventListener('scroll', onReflow, true);
    window.addEventListener('resize', onReflow);
    return () => {
      window.removeEventListener('scroll', onReflow, true);
      window.removeEventListener('resize', onReflow);
    };
  }, [open, reposition]);

  // 点击外部关闭
  useEffect(() => {
    const handleClick = (e) => {
      if (
        wrapperRef.current && !wrapperRef.current.contains(e.target) &&
        dropdownRef.current && !dropdownRef.current.contains(e.target)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // 打开时聚焦搜索框
  useEffect(() => {
    if (open && searchInputRef.current) {
      searchInputRef.current.focus();
      setFocusedIndex(-1);
    }
  }, [open]);

  const selectedValues = new Set(value);

  // 模糊匹配：支持中文直接包含、完整拼音、拼音首字母
  const filteredOptions = options.filter((opt) => {
    if (!search) return true;
    return pinyinMatch(opt.label, search);
  });

  const handleSelect = (val) => {
    if (single) {
      onChange([val]);
      setOpen(false);
      return;
    }
    if (selectedValues.has(val)) {
      onChange(value.filter((v) => v !== val));
    } else {
      onChange([...value, val]);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!open) {
        setOpen(true);
      } else {
        setFocusedIndex((i) => Math.min(i + 1, filteredOptions.length - 1));
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setFocusedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && focusedIndex >= 0 && open) {
      e.preventDefault();
      const opt = filteredOptions[focusedIndex];
      if (opt) handleSelect(opt.value);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  return (
    <>
      <div className={cn('relative', className)} ref={wrapperRef}>
      {label && <label className="block text-sm font-medium text-slate-700 mb-1.5">{label}</label>}
      <div
        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm cursor-pointer min-h-[40px] flex flex-wrap items-center gap-1.5 bg-white hover:border-slate-400 focus-within:outline-none focus-within:ring-2 focus-within:ring-primary-500/40 focus-within:border-primary-500 transition-smooth"
        onClick={() => {
          setOpen(!open);
          setSearch('');
        }}
        onKeyDown={handleKeyDown}
        tabIndex={0}
        role="combobox"
        aria-expanded={open}
      >
        {value.length === 0 && (
          <span className="text-slate-400">{placeholder}</span>
        )}
        {value.slice(0, maxDisplay).map((val) => {
          const opt = options.find((o) => o.value === val);
          return (
            <span
              key={val}
              className="inline-flex items-center gap-1 px-2 py-0.5 bg-primary-50 text-primary-700 rounded text-xs font-medium"
            >
              {opt?.label || val}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  if (single) onChange([]);
                  else handleSelect(val);
                }}
                className="hover:text-primary-900"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          );
        })}
        {value.length > maxDisplay && (
          <span className="text-xs text-slate-500">+{value.length - maxDisplay} 更多</span>
        )}
        <div className="ml-auto flex items-center gap-1">
          <ChevronDown className="w-4 h-4 text-slate-400" />
        </div>
      </div>

      </div>
      {open && createPortal(
        <div
          ref={dropdownRef}
          style={{ position: 'fixed', top: coords.top, left: coords.left, width: coords.width, zIndex: 10000 }}
          className="bg-white border border-slate-300 rounded-lg shadow-lg max-h-52 overflow-hidden flex flex-col"
        >
          {searchable && (
            <div className="p-2 border-b border-slate-100">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setFocusedIndex(0);
                  }}
                  placeholder="搜索..."
                  className="w-full pl-8 pr-2 py-1.5 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-primary-500/40"
                />
              </div>
            </div>
          )}
          <div className="overflow-y-auto py-1">
            {filteredOptions.length === 0 ? (
              <div className="px-3 py-2 text-sm text-slate-400 text-center">无匹配项</div>
            ) : (
              filteredOptions.map((opt, idx) => (
                <div
                  key={opt.value}
                  className={cn(
                    'px-3 py-2 text-sm cursor-pointer flex items-center justify-between',
                    idx === focusedIndex ? 'bg-primary-50' : 'hover:bg-slate-50',
                    selectedValues.has(opt.value) ? 'bg-primary-50/50' : ''
                  )}
                  onClick={() => handleSelect(opt.value)}
                >
                  <span className={cn(
                    'text-slate-700',
                    selectedValues.has(opt.value) && 'text-primary-700 font-medium'
                  )}>
                    {opt.label}
                  </span>
                  {pinnedValues && pinnedValues.has(opt.value) && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-600 shrink-0">常用</span>
                  )}
                  {selectedValues.has(opt.value) && (
                    <span className="text-primary-600 text-xs">✓ 已选</span>
                  )}
                </div>
              ))
            )}
          </div>
        </div>,
        document.body
      )}
    </>
  );
}