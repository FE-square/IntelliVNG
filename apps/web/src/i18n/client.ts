/**
 * 客户端I18N工具
 * 从window.__APP_INITIAL_STATE__.I18N读取多语言配置
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
 * 每次调用时动态读取，确保获取最新的I18N数据
 */
export function getI18N(): Record<string, string> {
  if (typeof window === 'undefined') {
    return {};
  }
  return window.__APP_INITIAL_STATE__?.I18N || {};
}

/**
 * 获取翻译文本
 * @param key 翻译key
 * @param params 参数对象，用于替换占位符 {title: 'xxx'} 会替换 {title}
 */
export function t(key: string, params?: Record<string, string | number>): string {
  const i18n = getI18N();
  let text = i18n[key];
  
  // 如果没有找到翻译，返回空字符串而不是key，避免水合错误
  if (!text) {
    return '';
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
    return i18n[prop] || prop;
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

