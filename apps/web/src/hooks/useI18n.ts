'use client';

import { useState, useEffect } from 'react';
import { getI18N } from '@/i18n/client';

/**
 * 客户端 i18n hook
 * 在客户端加载时获取翻译数据，避免 SSR/CSR 不匹配
 */
export function useI18n() {
  const [i18n, setI18n] = useState<Record<string, string>>({});
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    // 客户端加载翻译数据
    const translations = getI18N();
    setI18n(translations);
    setIsReady(true);
  }, []);

  /**
   * 获取翻译文本
   * @param key 翻译 key
   * @param defaultText 默认文本（SSR 时显示）
   */
  const getText = (key: string, defaultText: string = '') => {
    if (!isReady) {
      return defaultText;
    }
    return i18n[key] || defaultText;
  };

  return {
    isReady,
    i18n,
    getText,
  };
}
