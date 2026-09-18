import { useState, useCallback } from 'react';
import { FileSpreadsheet, Upload, Download, X, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import { apiClient } from '@/lib/apiClient';
import { parseOrgExcel, generateTemplate } from '@/lib/orgExcelParser';
import { cn } from '@/lib/utils';

export default function ExcelImportModal({ onClose, onImported }) {
  const [fileName, setFileName] = useState('');
  const [parsed, setParsed] = useState(null); // { departments, members, warnings }
  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);

  // 上传并解析文件
  const handleFile = useCallback((file) => {
    if (!file) return;
    setParsing(true);
    setError('');
    setResult(null);
    setParsed(null);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const r = parseOrgExcel(data);
        if (r.departments.length === 0 && r.members.length === 0) {
          setError('未从文件中解析到有效数据。请确认 Excel 包含「部门表」或「成员表」，或点击「下载模板」查看格式。');
        } else {
          setParsed(r);
          setFileName(file.name);
        }
      } catch (err) {
        console.error('Parse error:', err);
        setError(`文件解析失败：${err.message}`);
      }
      setParsing(false);
    };
    reader.onerror = () => {
      setParsing(false);
      setError('文件读取失败，请重试');
    };
    reader.readAsArrayBuffer(file);
  }, []);

  // 确认导入
  const handleImport = async () => {
    if (!parsed) return;
    setImporting(true);
    setError('');
    try {
      const res = await apiClient.importOrganization({
        departments: parsed.departments,
        members: parsed.members,
      });
      setResult(res);
      onImported?.(res);
    } catch (err) {
      setError('导入失败：' + err.message);
    }
    setImporting(false);
  };

  const handleClose = () => {
    onClose();
  };

  return (
    <Modal title="Excel 导入组织架构与成员" onClose={handleClose} size="large">
      <div className="space-y-4">
        {/* 模板下载 */}
        <div className="flex items-center justify-between bg-blue-50 border border-blue-200 rounded-lg p-3">
          <div className="text-sm text-blue-700">
            <span className="font-medium">导入格式：</span>
            <span>Excel 文件需包含「部门表」和「成员表」两个 sheet（或一个表含一级~五级部门层级列）</span>
          </div>
          <Button size="sm" variant="outline" onClick={generateTemplate} className="shrink-0">
            <Download className="w-3.5 h-3.5" />
            下载模板
          </Button>
        </div>

        {/* 文件选择 */}
        <div
          className="border-2 border-dashed border-slate-300 rounded-xl p-8 text-center hover:border-blue-400 hover:bg-blue-50/50 transition-smooth cursor-pointer"
          onClick={() => document.getElementById('org-excel-input')?.click()}
        >
          <input
            id="org-excel-input"
            type="file"
            accept=".xlsx,.xls,.csv"
            className="hidden"
            onChange={(e) => {
              handleFile(e.target.files?.[0]);
              e.target.value = '';
            }}
          />
          {parsing ? (
            <div className="flex flex-col items-center gap-2 text-slate-500">
              <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
              <p className="text-sm">正在解析文件...</p>
            </div>
          ) : parsed ? (
            <div className="flex flex-col items-center gap-2 text-green-600">
              <FileSpreadsheet className="w-8 h-8" />
              <p className="text-sm font-medium">{fileName}</p>
              <p className="text-xs text-slate-400">点击可重新选择文件</p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2 text-slate-500">
              <Upload className="w-8 h-8 text-slate-400" />
              <p className="text-sm font-medium">点击选择 Excel 文件</p>
              <p className="text-xs text-slate-400">支持 .xlsx / .xls / .csv</p>
            </div>
          )}
        </div>

        {/* 错误提示 */}
        {error && (
          <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm bg-red-50 text-red-700 border border-red-200">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* 解析预览 */}
        {parsed && !result && (
          <div className="space-y-3">
            {parsed.warnings.length > 0 && (
              <div className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                {parsed.warnings.map((w, i) => <div key={i}>⚠ {w}</div>)}
              </div>
            )}
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-blue-50 rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-blue-600">{parsed.departments.length}</p>
                <p className="text-xs text-slate-500 mt-0.5">将导入部门</p>
              </div>
              <div className="bg-green-50 rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-green-600">{parsed.members.length}</p>
                <p className="text-xs text-slate-500 mt-0.5">将导入成员</p>
              </div>
              <div className="bg-purple-50 rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-purple-600">{parsed.hasHierarchy ? '层级列' : '表格式'}</p>
                <p className="text-xs text-slate-500 mt-0.5">解析模式</p>
              </div>
            </div>

            {/* 部门预览 */}
            {parsed.departments.length > 0 && (
              <div>
                <p className="text-sm font-medium text-slate-700 mb-1.5">部门预览（前 5 条）</p>
                <div className="border border-slate-200 rounded-lg overflow-hidden text-xs">
                  <table className="w-full">
                    <thead className="bg-slate-50 text-slate-500">
                      <tr>
                        <th className="py-1.5 px-3 text-left font-medium">部门名称</th>
                        <th className="py-1.5 px-3 text-left font-medium">上级部门</th>
                      </tr>
                    </thead>
                    <tbody>
                      {parsed.departments.slice(0, 5).map((d, i) => {
                        const parent = parsed.departments.find((x) => x.id === d.parentId);
                        return (
                          <tr key={i} className="border-t border-slate-100">
                            <td className="py-1.5 px-3 text-slate-700">{d.name}</td>
                            <td className="py-1.5 px-3 text-slate-400">{parent?.name || '-'}</td>
                          </tr>
                        );
                      })}
                      {parsed.departments.length > 5 && (
                        <tr className="border-t border-slate-100">
                          <td className="py-1.5 px-3 text-slate-400" colSpan={2}>... 共 {parsed.departments.length} 条</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* 成员预览 */}
            {parsed.members.length > 0 && (
              <div>
                <p className="text-sm font-medium text-slate-700 mb-1.5">成员预览（前 5 条）</p>
                <div className="border border-slate-200 rounded-lg overflow-hidden text-xs">
                  <table className="w-full">
                    <thead className="bg-slate-50 text-slate-500">
                      <tr>
                        <th className="py-1.5 px-3 text-left font-medium">姓名</th>
                        <th className="py-1.5 px-3 text-left font-medium">邮箱</th>
                        <th className="py-1.5 px-3 text-left font-medium">所属部门</th>
                      </tr>
                    </thead>
                    <tbody>
                      {parsed.members.slice(0, 5).map((m, i) => (
                        <tr key={i} className="border-t border-slate-100">
                          <td className="py-1.5 px-3 text-slate-700">{m.name}</td>
                          <td className="py-1.5 px-3 text-slate-400">{m.email || '-'}</td>
                          <td className="py-1.5 px-3 text-slate-400">{m.departmentId || '-'}</td>
                        </tr>
                      ))}
                      {parsed.members.length > 5 && (
                        <tr className="border-t border-slate-100">
                          <td className="py-1.5 px-3 text-slate-400" colSpan={3}>... 共 {parsed.members.length} 条</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => { setParsed(null); setFileName(''); }}>
                <X className="w-4 h-4" />
                重新选择
              </Button>
              <Button onClick={handleImport} disabled={importing}>
                {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                {importing ? '导入中...' : '确认导入'}
              </Button>
            </div>
          </div>
        )}

        {/* 导入结果 */}
        {result && (
          <div className="text-center py-4">
            <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-3" />
            <h3 className="text-base font-semibold text-slate-800 mb-2">导入完成</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 max-w-md mx-auto">
              <div className="bg-slate-50 rounded-lg p-2.5">
                <p className="text-xl font-bold text-blue-600">{result.syncedDepartments || 0}</p>
                <p className="text-xs text-slate-500">新增部门</p>
              </div>
              <div className="bg-slate-50 rounded-lg p-2.5">
                <p className="text-xl font-bold text-green-600">{result.syncedMembers || 0}</p>
                <p className="text-xs text-slate-500">新增成员</p>
              </div>
              <div className="bg-slate-50 rounded-lg p-2.5">
                <p className="text-xl font-bold text-amber-600">{result.updatedMembers || 0}</p>
                <p className="text-xs text-slate-500">更新成员</p>
              </div>
              <div className="bg-slate-50 rounded-lg p-2.5">
                <p className="text-xl font-bold text-slate-600">{result.skipped || 0}</p>
                <p className="text-xs text-slate-500">跳过</p>
              </div>
            </div>
            <div className="flex justify-center gap-2 mt-5">
              <Button onClick={handleClose}>完成</Button>
              <Button variant="outline" onClick={() => { setParsed(null); setResult(null); setFileName(''); }}>
                继续导入
              </Button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}