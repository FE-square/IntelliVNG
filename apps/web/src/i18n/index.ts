/**
 * 多语言配置和工具函数
 */

export type Locale = 'zh-CN' | 'zh-HK' | 'en-US';

export const DEFAULT_LOCALE: Locale = 'zh-CN';
export const SUPPORTED_LOCALES: Locale[] = ['zh-CN', 'zh-HK', 'en-US'];

/**
 * 从URL参数或headers中获取locale
 */
export function getLocaleFromRequest(searchParams?: URLSearchParams, headers?: Headers): Locale {
  // 优先从URL参数获取
  if (searchParams) {
    const localeParam = searchParams.get('locale');
    if (localeParam && SUPPORTED_LOCALES.includes(localeParam as Locale)) {
      return localeParam as Locale;
    }
  }

  // 从Accept-Language header获取
  if (headers) {
    const acceptLanguage = headers.get('accept-language');
    if (acceptLanguage) {
      // 简单解析，优先匹配完整locale
      for (const locale of SUPPORTED_LOCALES) {
        if (acceptLanguage.includes(locale)) {
          return locale;
        }
      }
      // 匹配语言代码
      if (acceptLanguage.includes('zh')) {
        // 默认使用简体中文
        return 'zh-CN';
      }
      if (acceptLanguage.includes('en')) {
        return 'en-US';
      }
    }
  }

  return DEFAULT_LOCALE;
}

/**
 * 加载指定locale的语言包
 */
export async function loadLocaleMessages(locale: Locale): Promise<Record<string, string>> {
  try {
    const messages = await import(`./locales/${locale}.json`);
    return messages.default || messages;
  } catch (error) {
    console.error(`Failed to load locale ${locale}:`, error);
    // 如果加载失败，尝试加载默认locale
    if (locale !== DEFAULT_LOCALE) {
      const defaultMessages = await import(`./locales/${DEFAULT_LOCALE}.json`);
      return defaultMessages.default || defaultMessages;
    }
    return {};
  }
}

/**
 * 同步加载语言包（用于服务端）
 */
export function loadLocaleMessagesSync(locale: Locale): Record<string, string> {
  try {
    // 在Next.js中，我们可以使用require来同步加载
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const messages = require(`./locales/${locale}.json`);
    return messages.default || messages;
  } catch (error) {
    console.error(`Failed to load locale ${locale}:`, error);
    if (locale !== DEFAULT_LOCALE) {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const defaultMessages = require(`./locales/${DEFAULT_LOCALE}.json`);
      return defaultMessages.default || defaultMessages;
    }
    return {};
  }
}

