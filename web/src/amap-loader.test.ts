import { afterEach, describe, expect, test, vi } from 'vitest';
import { loadAmap, resetAmapLoaderForTests, type AmapApi } from './amap-loader.js';

const scriptSelector = 'script[data-amap-js-api="true"]';

function removeAmapScripts() {
  document.querySelectorAll(scriptSelector).forEach((script) => script.remove());
}

afterEach(() => {
  resetAmapLoaderForTests();
  removeAmapScripts();
  delete window.AMap;
  delete window._AMapSecurityConfig;
  vi.unstubAllEnvs();
});

describe('loadAmap', () => {
  test('rejects missing configuration before inserting a script', async () => {
    vi.stubEnv('VITE_AMAP_KEY', '');
    vi.stubEnv('VITE_AMAP_SECURITY_JS_CODE', 'security-code');

    await expect(loadAmap()).rejects.toThrow('高德地图配置缺失');

    expect(document.querySelector(scriptSelector)).toBeNull();
    expect(window._AMapSecurityConfig).toBeUndefined();
  });

  test('sets security configuration and shares one script promise', async () => {
    vi.stubEnv('VITE_AMAP_KEY', 'test key&?');
    vi.stubEnv('VITE_AMAP_SECURITY_JS_CODE', 'security-code');

    const first = loadAmap();
    const second = loadAmap();
    const script = document.querySelector<HTMLScriptElement>(scriptSelector);
    const api = { Map: class {} } as unknown as AmapApi;

    expect(second).toBe(first);
    expect(document.querySelectorAll(scriptSelector)).toHaveLength(1);
    expect(script?.getAttribute('src')).toBe(
      'https://webapi.amap.com/maps?v=2.0&plugin=AMap.ToolBar&key=test%20key%26%3F',
    );
    expect(window._AMapSecurityConfig).toEqual({ securityJsCode: 'security-code' });

    window.AMap = api;
    script?.dispatchEvent(new Event('load'));

    await expect(first).resolves.toBe(api);
  });

  test('resolves immediately when a tagged script already exposed AMap', async () => {
    vi.stubEnv('VITE_AMAP_KEY', 'test-key');
    vi.stubEnv('VITE_AMAP_SECURITY_JS_CODE', 'security-code');

    const script = document.createElement('script');
    script.dataset.amapJsApi = 'true';
    document.head.append(script);
    const api = { Map: class {} } as unknown as AmapApi;
    window.AMap = api;

    const result = await Promise.race([loadAmap(), Promise.resolve('pending')]);

    expect(result).toBe(api);
    expect(document.querySelectorAll(scriptSelector)).toHaveLength(1);
  });

  test.each(['loaded', 'failed'])('rejects an existing %s script without AMap', async (state) => {
    vi.stubEnv('VITE_AMAP_KEY', 'test-key');
    vi.stubEnv('VITE_AMAP_SECURITY_JS_CODE', 'security-code');

    const script = document.createElement('script');
    script.dataset.amapJsApi = 'true';
    script.dataset.amapLoadState = state;
    document.head.append(script);

    await expect(loadAmap()).rejects.toThrow('高德地图加载失败');
  });

  test('rejects when the API script loads without exposing AMap', async () => {
    vi.stubEnv('VITE_AMAP_KEY', 'test-key');
    vi.stubEnv('VITE_AMAP_SECURITY_JS_CODE', 'security-code');

    const loading = loadAmap();
    document.querySelector<HTMLScriptElement>(scriptSelector)?.dispatchEvent(new Event('load'));

    await expect(loading).rejects.toThrow('高德地图加载失败');
  });

  test('rejects when the API script errors', async () => {
    vi.stubEnv('VITE_AMAP_KEY', 'test-key');
    vi.stubEnv('VITE_AMAP_SECURITY_JS_CODE', 'security-code');

    const loading = loadAmap();
    document.querySelector<HTMLScriptElement>(scriptSelector)?.dispatchEvent(new Event('error'));

    await expect(loading).rejects.toThrow('高德地图加载失败');
  });

  test('resets the cached loader promise for the next test', () => {
    vi.stubEnv('VITE_AMAP_KEY', 'test-key');
    vi.stubEnv('VITE_AMAP_SECURITY_JS_CODE', 'security-code');

    const first = loadAmap();
    resetAmapLoaderForTests();
    const second = loadAmap();

    expect(second).not.toBe(first);
    expect(document.querySelectorAll(scriptSelector)).toHaveLength(1);
  });
});
