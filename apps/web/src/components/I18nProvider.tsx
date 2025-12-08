'use client';

/**
 * I18n Provider - 通过 Context 提供多语言配置
 */
import { createContext, useCallback, useContext, useMemo } from 'react';
import type { Locale } from '@/i18n';

export interface I18nContextValue {
  /**
   * 当前语言环境
   */
  locale: Locale;
  /**
   * 翻译消息对象
   */
  messages: Record<string, string>;
  /** 多语言key 与 多语言翻译 映射 */
  I18N: Record<string, string>;
  /**
   * 获取翻译文本
   * @param key 翻译key
   * @param params 参数对象，用于替换占位符 {title: 'xxx'} 会替换 {title}
   */
  t: (key: string, params?: Record<string, string | number>) => string;
  getText: (key: string, defaultText?: string) => string;
}

const I18nContext = createContext<I18nContextValue | null>(null);

export interface I18nProviderProps {
  children: React.ReactNode;
  locale: Locale;
  messages: Record<string, string>;
}

export function I18nProvider({ children, locale, messages }: I18nProviderProps) {
  // 创建 t 函数
  const t = useMemo(() => {
    return (key: string, params?: Record<string, string | number>): string => {
      let text = messages[key];
      
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
    };
  }, [messages]);

  const getText = useCallback((key: string, defaultText: string = '') => t(key) || defaultText, [t]);
  const value = useMemo<I18nContextValue>(
    () => ({
      locale,
      messages,
      I18N: messages,
      t,
      getText,
    }),
    [locale, messages, t]
  );

  // 同时将 I18N 数据注入到 window 对象，保持向后兼容
  const i18nScript = `
    (function() {
      window.__APP_INITIAL_STATE__ = window.__APP_INITIAL_STATE__ || {};
      window.__APP_INITIAL_STATE__.I18N = ${JSON.stringify(messages)};
      console.log('[I18N] Loaded locale: ${locale}, keys count:', Object.keys(window.__APP_INITIAL_STATE__.I18N).length);
    })();
  `;

  return (
    <I18nContext.Provider value={value}>
      <script
        dangerouslySetInnerHTML={{
          __html: i18nScript,
        }}
        suppressHydrationWarning
      />
      {children}
    </I18nContext.Provider>
  );
}

/**
 * 获取 I18N Context 的 hook
 * @throws 如果不在 I18nProvider 内部使用会抛出错误
 */
export function useI18N(): I18nContextValue {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error('useI18N must be used within I18nProvider');
  }
  return context;
}

