export interface AmapMap {
  destroy(): void;
}

export interface AmapApi {
  Map: new (container: string | HTMLElement, options?: Record<string, unknown>) => AmapMap;
}

declare global {
  interface ImportMetaEnv {
    readonly VITE_AMAP_KEY?: string;
    readonly VITE_AMAP_SECURITY_JS_CODE?: string;
  }

  interface ImportMeta {
    readonly env: ImportMetaEnv;
  }

  interface Window {
    AMap?: AmapApi;
    _AMapSecurityConfig?: { securityJsCode: string };
  }
}

const amapScriptSelector = 'script[data-amap-js-api="true"]';
let amapPromise: Promise<AmapApi> | undefined;

export function loadAmap(): Promise<AmapApi> {
  if (amapPromise) return amapPromise;

  const key = import.meta.env.VITE_AMAP_KEY;
  const securityJsCode = import.meta.env.VITE_AMAP_SECURITY_JS_CODE;

  if (!key || !securityJsCode) {
    return Promise.reject(new Error('高德地图配置缺失'));
  }

  window._AMapSecurityConfig = { securityJsCode };

  if (window.AMap) {
    amapPromise = Promise.resolve(window.AMap);
    return amapPromise;
  }

  amapPromise = new Promise<AmapApi>((resolve, reject) => {
    let script = document.querySelector<HTMLScriptElement>(amapScriptSelector);

    const resolveAmap = () => {
      if (script) script.dataset.amapLoadState = 'loaded';
      if (window.AMap) {
        resolve(window.AMap);
      } else {
        reject(new Error('高德地图加载失败'));
      }
    };

    const rejectAmap = () => {
      if (script) script.dataset.amapLoadState = 'failed';
      reject(new Error('高德地图加载失败'));
    };

    if (!script) {
      script = document.createElement('script');
      script.dataset.amapJsApi = 'true';
      script.dataset.amapLoadState = 'loading';
      script.src = `https://webapi.amap.com/maps?v=2.0&plugin=AMap.ToolBar&key=${encodeURIComponent(key)}`;
      script.async = true;
      script.addEventListener('load', resolveAmap, { once: true });
      script.addEventListener('error', rejectAmap, { once: true });
      document.head.append(script);
      return;
    }

    if (script.dataset.amapLoadState === 'loaded' || script.dataset.amapLoadState === 'failed') {
      reject(new Error('高德地图加载失败'));
      return;
    }

    script.addEventListener('load', resolveAmap, { once: true });
    script.addEventListener('error', rejectAmap, { once: true });
  });

  return amapPromise;
}

export function resetAmapLoaderForTests(): void {
  amapPromise = undefined;
  document.querySelector<HTMLScriptElement>(amapScriptSelector)?.remove();
}
