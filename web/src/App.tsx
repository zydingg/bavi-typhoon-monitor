import { useEffect, useState } from 'react';
import { getCurrentTyphoon } from './api.js';
import { Dashboard } from './dashboard.js';
import type { TyphoonSnapshot } from './types.js';

export interface AppProps {
  initialSnapshot?: TyphoonSnapshot;
}

export function App({ initialSnapshot }: AppProps) {
  const [snapshot, setSnapshot] = useState<TyphoonSnapshot | undefined>(initialSnapshot);
  const [error, setError] = useState<string>();

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      try {
        const nextSnapshot = await getCurrentTyphoon();
        if (mounted) {
          setSnapshot(nextSnapshot);
          setError(undefined);
        }
      } catch (caughtError) {
        if (mounted) {
          setError(caughtError instanceof Error ? caughtError.message : '未知请求错误');
        }
      }
    };

    void load();
    const intervalId = window.setInterval(() => void load(), 60_000);

    return () => {
      mounted = false;
      window.clearInterval(intervalId);
    };
  }, []);

  if (error && !snapshot) {
    return <main className="state state-error">实时数据暂不可用：{error}</main>;
  }

  if (snapshot?.status === 'empty') {
    return <main className="state">当前暂无活动台风</main>;
  }

  if (!snapshot?.selected) {
    return <main className="state">正在获取台风监测数据…</main>;
  }

  return <Dashboard snapshot={snapshot} requestError={error} />;
}
