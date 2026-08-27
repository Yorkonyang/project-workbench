import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

// 提醒规则默认配置
export const DEFAULT_REMINDER_CONFIG = {
  // 到期前提醒：提前几天开始提醒
  preDueDays: [7, 3, 1], // 提前7天、3天、1天各提醒一次
  // 到期当天提醒
  enableDueDay: true,
  // 逾期提醒
  enableOverdue: true,
  // 逾期几天后开始催办
  escalationDays: 3,
  // 催办间隔（天）
  escalationInterval: 2,
  // 检查间隔（秒）
  checkIntervalSec: 60,
  // 是否启用浏览器桌面通知
  enableBrowserNotif: false,
  // 是否启用声音提醒
  enableSound: false,
  // 里程碑提前提醒天数
  milestonePreDays: [14, 7, 3, 1],
  // 提醒时间（每天几点检查到期项）
  dailyCheckHour: 8,
  // 是否启用停滞任务检测
  enableStalled: true,
  // 任务超过多少天未更新则触发风险提示（实际严重程度由引擎根据天数动态判断）
  stalledDays: 1,
};

export const useReminderConfigStore = create(
  persist(
    (set, get) => ({
      config: { ...DEFAULT_REMINDER_CONFIG },

      updateConfig: (updates) =>
        set((state) => ({
          config: { ...state.config, ...updates },
        })),

      resetConfig: () => set({ config: { ...DEFAULT_REMINDER_CONFIG } }),

      getConfig: () => get().config,
    }),
    {
      name: 'pw_reminder_config',
      storage: createJSONStorage(() => localStorage),
    }
  )
);
