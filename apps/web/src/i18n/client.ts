/**
 * 客户端I18N工具
 * 从window.__APP_INITIAL_STATE__.I18N读取多语言配置
 * 支持 SSR 和客户端，通过模块级变量在 SSR 时提供数据
 */

declare global {
  interface Window {
    __APP_INITIAL_STATE__?: {
      I18N?: Record<string, string>;
    };
  }
}


/**
 * 获取I18N对象
 * - 客户端时：从 window.__APP_INITIAL_STATE__.I18N 读取
 * 这样确保 SSR 和客户端使用相同的数据，避免水合不一致
 */
export function getI18N(): Record<string, string> {
  // SSR 环境：从模块变量读取
  if (typeof window === 'undefined') {
    return {};
  }
  
  // 客户端环境：从 window.__APP_INITIAL_STATE__ 读取
  const i18n = window.__APP_INITIAL_STATE__?.I18N || {};
  
  // 在开发环境下输出调试信息
  if (process.env.NODE_ENV === 'development' && Object.keys(i18n).length === 0) {
    console.warn('[I18N] window.__APP_INITIAL_STATE__.I18N is empty or not loaded');
  }
  
  return i18n;
}

/**
 * 获取翻译文本
 * @param key 翻译key
 * @param params 参数对象，用于替换占位符 {title: 'xxx'} 会替换 {title}
 */
export function t(key: string, params?: Record<string, string | number>): string {
  const i18n = getI18N();
  let text = i18n[key];
  
  // 如果没有找到翻译
  if (!text) {
    return key;
  }

  // 替换占位符
  if (params) {
    Object.entries(params).forEach(([paramKey, value]) => {
      text = text.replace(new RegExp(`\\{${paramKey}\\}`, 'g'), String(value));
    });
  }

  return text;
}

/**
 * 导出I18N对象供直接使用
 * 注意：这是一个getter，每次访问时都会重新读取window对象
 * 在组件中使用时，建议使用 getI18N() 函数或 t() 函数
 */
export const I18N = new Proxy({} as Record<string, string>, {
  get(_target, prop: string) {
    const i18n = getI18N();
    // SSR 时返回空字符串，避免显示 key
    // CSR 时返回翻译文本或空字符串
    return i18n[prop] || '';
  },
  has(_target, prop: string) {
    const i18n = getI18N();
    return prop in i18n;
  },
  ownKeys(_target) {
    const i18n = getI18N();
    return Object.keys(i18n);
  },
});

