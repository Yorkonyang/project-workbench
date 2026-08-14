/**
 * 初始化 Hook - 在应用启动时加载数据
 */
import { useEffect, useState } from 'react';
import DataLayer from './dataLayer';

export function useInitApp() {
  const [initialized, setInitialized] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    DataLayer.init()
      .then((data) => {
        if (cancelled) return;
        console.log('[App Init] Data loaded:', data);
        // 将数据注入到 localStorage（供 Zustand persist 使用）
        for (const [key, value] of Object.entries(data)) {
          localStorage.setItem(key.startsWith('pw_') ? key : `pw_${key}`, JSON.stringify(value));
        }
        setInitialized(true);
      })
      .catch((err) => {
        if (cancelled) return;
        console.error('[App Init] Failed:', err);
        setError(err.message);
        setInitialized(true); // 即使失败也继续加载
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return { initialized, error };
}
