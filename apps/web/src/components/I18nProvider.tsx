/**
 * I18n Provider - 在SSR时注入多语言配置到window对象
 */
import { headers } from 'next/headers';
import { loadLocaleMessagesSync, SUPPORTED_LOCALES, DEFAULT_LOCALE, type Locale } from '@/i18n';

export function I18nProvider({ children }: { children: React.ReactNode }) {
  // 从middleware设置的header中获取locale
  const headersList = headers();
  const localeHeader = headersList.get('x-locale');
  const locale: Locale = (localeHeader && SUPPORTED_LOCALES.includes(localeHeader as Locale))
    ? (localeHeader as Locale)
    : DEFAULT_LOCALE;
  
  const messages = loadLocaleMessagesSync(locale);

  // 将I18N数据注入到window对象
  // 使用立即执行函数确保在页面加载时立即执行
  const i18nScript = `
    (function() {
      window.__APP_INITIAL_STATE__ = window.__APP_INITIAL_STATE__ || {};
      window.__APP_INITIAL_STATE__.I18N = ${JSON.stringify(messages)};
    })();
  `;

  return (
    <>
      <script
        dangerouslySetInnerHTML={{
          __html: i18nScript,
        }}
        suppressHydrationWarning
      />
      {children}
    </>
  );
}

