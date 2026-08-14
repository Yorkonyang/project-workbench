import { useState, useEffect } from 'react';
import {
  Bell, Clock, AlertTriangle, Calendar, Volume2, Monitor,
  Save, RotateCcw, CheckCircle, Plug, Zap, AlertCircle,
} from 'lucide-react';
import PageContainer from '@/components/layout/PageContainer';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import { useReminderConfigStore, DEFAULT_REMINDER_CONFIG } from '@/store/useReminderConfigStore';
import { apiClient } from '@/lib/apiClient';
import { cn } from '@/lib/utils';

export default function ReminderSettingsPage() {
  const config = useReminderConfigStore((s) => s.config);
  const updateConfig = useReminderConfigStore((s) => s.updateConfig);
  const resetConfig = useReminderConfigStore((s) => s.resetConfig);

  const [local, setLocal] = useState(config);
  const [saved, setSaved] = useState(false);

  // 轻流 BPM 配置
  const [bpmConfig, setBpmConfig] = useState({ baseUrl: '', qsourceId: '' });
  const [bpmSaving, setBpmSaving] = useState(false);
  const [bpmTesting, setBpmTesting] = useState(false);
  const [bpmTestResult, setBpmTestResult] = useState(null);

  useEffect(() => {
    apiClient.getQingflowConfig().then(cfg => {
      setBpmConfig({ baseUrl: cfg.baseUrl || '', qsourceId: cfg.qsourceId || '' });
    }).catch(() => {});
  }, []);

  const handleBpmSave = async () => {
    setBpmSaving(true);
    try {
      await apiClient.setQingflowConfig(bpmConfig);
      setBpmTestResult({ success: true, message: '配置已保存' });
    } catch (e) {
      setBpmTestResult({ success: false, message: '保存失败: ' + e.message });
    }
    setBpmSaving(false);
    setTimeout(() => setBpmTestResult(null), 5000);
  };

  const handleBpmTest = async () => {
    setBpmTesting(true);
    setBpmTestResult(null);
    try {
      // 先保存再测试
      await apiClient.setQingflowConfig(bpmConfig);
      const result = await apiClient.testQingflowConnection();
      if (result.success) {
        setBpmTestResult({ success: true, message: '连接成功，测试消息已发送到轻流' });
      } else {
        setBpmTestResult({ success: false, message: result.error || result.errMsg || '连接失败' });
      }
    } catch (e) {
      setBpmTestResult({ success: false, message: '连接失败: ' + e.message });
    }
    setBpmTesting(false);
    setTimeout(() => setBpmTestResult(null), 8000);
  };

  const set = (key, val) => {
    setLocal((f) => ({ ...f, [key]: val }));
    setSaved(false);
  };

  const handleSave = () => {
    updateConfig(local);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const handleReset = () => {
    setLocal({ ...DEFAULT_REMINDER_CONFIG });
    resetConfig();
  };

  const togglePreDueDay = (day) => {
    const days = [...local.preDueDays].sort((a, b) => a - b);
    if (days.includes(day)) {
      set('preDueDays', days.filter((d) => d !== day));
    } else {
      set('preDueDays', [...days, day].sort((a, b) => a - b));
    }
  };

  const toggleMilestoneDay = (day) => {
    const days = [...local.milestonePreDays].sort((a, b) => a - b);
    if (days.includes(day)) {
      set('milestonePreDays', days.filter((d) => d !== day));
    } else {
      set('milestonePreDays', [...days, day].sort((a, b) => a - b));
    }
  };

  return (
    <PageContainer>
      {/* 保存栏 */}
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-slate-500">配置到期前提醒、逾期催办等提醒规则</p>
        <div className="flex items-center gap-2">
          {saved && (
            <span className="flex items-center gap-1 text-sm text-green-600">
              <CheckCircle className="w-4 h-4" />
              已保存
            </span>
          )}
          <Button size="sm" variant="secondary" onClick={handleReset}>
            <RotateCcw className="w-4 h-4" />
            恢复默认
          </Button>
          <Button size="sm" onClick={handleSave}>
            <Save className="w-4 h-4" />
            保存配置
          </Button>
        </div>
      </div>

      <div className="space-y-4">
        {/* 到期前提醒 */}
        <Card title="到期前提醒" icon={Clock}>
          <p className="text-sm text-slate-500 mb-3">
            在任务/待办到期前，提前几天发送提醒通知
          </p>
          <div className="flex gap-2 flex-wrap">
            {[1, 2, 3, 5, 7, 10, 14].map((day) => (
              <button
                key={day}
                onClick={() => togglePreDueDay(day)}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors',
                  local.preDueDays.includes(day)
                    ? 'bg-amber-500 text-white border-amber-500'
                    : 'bg-white text-slate-600 border-slate-300 hover:border-amber-400'
                )}
              >
                提前 {day} 天
              </button>
            ))}
          </div>
        </Card>

        {/* 到期当天 */}
        <Card title="到期当天提醒" icon={Calendar}>
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={local.enableDueDay}
              onChange={(e) => set('enableDueDay', e.target.checked)}
              className="w-4 h-4 rounded text-primary-500"
            />
            <span className="text-sm text-slate-700">到期当天发送提醒通知</span>
          </label>
        </Card>

        {/* 逾期提醒 */}
        <Card title="逾期提醒" icon={AlertTriangle}>
          <div className="space-y-3">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={local.enableOverdue}
                onChange={(e) => set('enableOverdue', e.target.checked)}
                className="w-4 h-4 rounded text-primary-500"
              />
              <span className="text-sm text-slate-700">逾期后发送提醒通知</span>
            </label>

            <div className="grid grid-cols-2 gap-4 pl-7">
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">
                  逾期几天后开始催办
                </label>
                <input
                  type="number"
                  min="1"
                  max="30"
                  value={local.escalationDays}
                  onChange={(e) => set('escalationDays', parseInt(e.target.value) || 3)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">
                  催办间隔（天）
                </label>
                <input
                  type="number"
                  min="1"
                  max="7"
                  value={local.escalationInterval}
                  onChange={(e) => set('escalationInterval', parseInt(e.target.value) || 2)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
            </div>
            <p className="text-xs text-slate-400 pl-7">
              逾期 {local.escalationDays} 天后，每 {local.escalationInterval} 天自动发送一次催办通知
            </p>
          </div>
        </Card>

        {/* 里程碑提醒 */}
        <Card title="里程碑提醒" icon={Bell}>
          <p className="text-sm text-slate-500 mb-3">
            在里程碑到达前，提前几天发送提醒通知
          </p>
          <div className="flex gap-2 flex-wrap">
            {[1, 3, 5, 7, 10, 14, 21, 30].map((day) => (
              <button
                key={day}
                onClick={() => toggleMilestoneDay(day)}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors',
                  local.milestonePreDays.includes(day)
                    ? 'bg-purple-500 text-white border-purple-500'
                    : 'bg-white text-slate-600 border-slate-300 hover:border-purple-400'
                )}
              >
                提前 {day} 天
              </button>
            ))}
          </div>
        </Card>

        {/* 通知方式 */}
        <Card title="通知方式" icon={Monitor}>
          <div className="space-y-3">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={local.enableBrowserNotif}
                onChange={(e) => {
                  set('enableBrowserNotif', e.target.checked);
                  if (e.target.checked && typeof Notification !== 'undefined' && Notification.permission !== 'granted') {
                    Notification.requestPermission();
                  }
                }}
                className="w-4 h-4 rounded text-primary-500"
              />
              <div>
                <span className="text-sm text-slate-700 flex items-center gap-1.5">
                  <Monitor className="w-4 h-4 text-slate-400" />
                  浏览器桌面通知
                </span>
                <p className="text-xs text-slate-400">在浏览器最小化时也能收到桌面弹窗通知</p>
              </div>
            </label>

            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={local.enableSound}
                onChange={(e) => set('enableSound', e.target.checked)}
                className="w-4 h-4 rounded text-primary-500"
              />
              <div>
                <span className="text-sm text-slate-700 flex items-center gap-1.5">
                  <Volume2 className="w-4 h-4 text-slate-400" />
                  声音提醒
                </span>
                <p className="text-xs text-slate-400">收到新通知时播放提示音</p>
              </div>
            </label>
          </div>
        </Card>

        {/* 检查频率 */}
        <Card title="检查频率" icon={Clock}>
          <div className="flex items-center gap-4">
            <label className="text-sm text-slate-700">自动检查间隔</label>
            <select
              value={local.checkIntervalSec}
              onChange={(e) => set('checkIntervalSec', parseInt(e.target.value))}
              className="px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value={30}>30 秒</option>
              <option value={60}>1 分钟</option>
              <option value={120}>2 分钟</option>
              <option value={300}>5 分钟</option>
              <option value={600}>10 分钟</option>
            </select>
            <span className="text-xs text-slate-400">
              系统每隔此间隔自动检查所有任务、待办和里程碑的到期情况
            </span>
          </div>
        </Card>

        {/* BPM 系统集成 */}
        <Card title="BPM 系统集成（轻流）" icon={Plug}>
          <div className="space-y-4">
            <div className={cn(
              'flex items-center gap-2 px-3 py-2 rounded-lg text-sm',
              bpmConfig.qsourceId
                ? 'bg-green-50 text-green-700 border border-green-200'
                : 'bg-amber-50 text-amber-700 border border-amber-200'
            )}>
              {bpmConfig.qsourceId
                ? <CheckCircle className="w-4 h-4 flex-shrink-0" />
                : <AlertCircle className="w-4 h-4 flex-shrink-0" />}
              <span>
                {bpmConfig.qsourceId
                  ? 'Q-Source 已配置，待办/任务将自动推送到轻流'
                  : 'Q-Source ID 未配置，待办/任务无法推送到轻流 BPM 系统'}
              </span>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                轻流服务器地址
              </label>
              <Input
                value={bpmConfig.baseUrl}
                onChange={(e) => setBpmConfig(f => ({ ...f, baseUrl: e.target.value }))}
                placeholder="https://your-company.qingflow.com"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Q-Source ID
              </label>
              <Input
                value={bpmConfig.qsourceId}
                onChange={(e) => setBpmConfig(f => ({ ...f, qsourceId: e.target.value }))}
                placeholder="在轻流后台「数据源 → Q-Source」中获取的 UUID"
              />
              <p className="text-xs text-slate-400 mt-1">
                登录轻流 → 设置 → 数据源 → Q-Source → 复制接口地址中的 UUID 部分
              </p>
            </div>

            {bpmTestResult && (
              <div className={cn(
                'flex items-center gap-2 px-3 py-2 rounded-lg text-sm',
                bpmTestResult.success
                  ? 'bg-green-50 text-green-700 border border-green-200'
                  : 'bg-red-50 text-red-700 border border-red-200'
              )}>
                {bpmTestResult.success
                  ? <CheckCircle className="w-4 h-4 flex-shrink-0" />
                  : <AlertCircle className="w-4 h-4 flex-shrink-0" />}
                <span>{bpmTestResult.message}</span>
              </div>
            )}

            <div className="flex gap-2">
              <Button size="sm" onClick={handleBpmSave} disabled={bpmSaving}>
                <Save className="w-4 h-4" />
                {bpmSaving ? '保存中...' : '保存配置'}
              </Button>
              <Button size="sm" variant="outline" onClick={handleBpmTest} disabled={bpmTesting || !bpmConfig.qsourceId}>
                <Zap className="w-4 h-4" />
                {bpmTesting ? '测试中...' : '测试连接'}
              </Button>
            </div>

            <div className="text-xs text-slate-400 border-t border-slate-100 pt-3">
              <p className="font-medium text-slate-500 mb-1">字段映射说明</p>
              <ul className="space-y-0.5 ml-4">
                <li>• 待办标题 → bt（标题）</li>
                <li>• 待办描述 → ms（描述）</li>
                <li>• 负责人 → zrr（责任人邮箱，自动从人员库解析）</li>
                <li>• 优先级 → yxj（紧急/高/中/低）</li>
                <li>• 截止日期 → jzrq</li>
                <li>• 所属项目 → ssxm</li>
              </ul>
            </div>
          </div>
        </Card>
      </div>
    </PageContainer>
  );
}
