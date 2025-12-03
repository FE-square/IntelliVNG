/**
 * 语言工具函数
 */

export type Locale = 'zh-CN' | 'zh-HK' | 'en-US';

export const DEFAULT_LOCALE: Locale = 'zh-CN';
export const SUPPORTED_LOCALES: Locale[] = ['zh-CN', 'zh-HK', 'en-US'];

/**
 * 获取语言名称
 */
export function getLocaleName(locale: Locale): string {
  const names: Record<Locale, string> = {
    'zh-CN': '简体中文',
    'zh-HK': '繁體中文',
    'en-US': 'English',
  };
  return names[locale] || locale;
}

/**
 * 构建语言提示，添加到prompt中
 * @param locale 用户语言
 * @returns 语言提示字符串
 */
export function buildLocalePrompt(locale: Locale = DEFAULT_LOCALE): string {
  const localeName = getLocaleName(locale);
  return `\n\n重要提示：用户的语言是 ${locale} (${localeName})，请使用 ${localeName} 进行创作和回答。所有生成的内容（包括对话、旁白、描述等）都必须使用 ${localeName}。`;
}

const getTodayDatePrompt = () => {
  const date = new Date();
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  return `\nToday is ${year}-${month}-${day}.`;
}

/**
 * 在system prompt中添加语言提示
 * @param systemPrompt 原始system prompt
 * @param locale 用户语言
 * @returns 添加了语言提示的system prompt
 */
export function addLocaleToSystemPrompt(systemPrompt: string, locale: Locale = DEFAULT_LOCALE): string {

  return systemPrompt + buildLocalePrompt(locale) + getTodayDatePrompt();
}

/**
 * 在user prompt中添加语言提示
 * @param userPrompt 原始user prompt
 * @param locale 用户语言
 * @returns 添加了语言提示的user prompt
 */
export function addLocaleToUserPrompt(userPrompt: string, locale: Locale = DEFAULT_LOCALE): string {
  
  return userPrompt + buildLocalePrompt(locale) + getTodayDatePrompt();
}

/**
 * 从请求中获取locale
 * @param localeParam URL参数或请求体中的locale
 * @returns 有效的locale
 */
export function getLocaleFromRequest(localeParam?: string | null): Locale {
  if (localeParam && SUPPORTED_LOCALES.includes(localeParam as Locale)) {
    return localeParam as Locale;
  }
  return DEFAULT_LOCALE;
}

