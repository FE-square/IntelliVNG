'use client';

import { useRouter, usePathname } from 'next/navigation';
import { SUPPORTED_LOCALES, DEFAULT_LOCALE, type Locale } from '@/i18n';
import { I18N } from '@/i18n/client';
import { useEffect, useRef, useState } from 'react';

const i18nMap = {
  switchLanguage: 'key.toolbar.switchLanguage',
  currentLanguage: 'key.toolbar.currentLanguage',
};

const localeLabels: Record<Locale, string> = {
  'zh-CN': '简体中文',
  'zh-HK': '繁體中文',
  'en-US': 'English',
};

interface LocaleSwitcherProps {
  onClose: () => void;
}

/**
 * 语言切换菜单组件
 */
export function LocaleSwitcher({ onClose }: LocaleSwitcherProps) {
  const router = useRouter();
  const pathname = usePathname();
  const menuRef = useRef<HTMLDivElement>(null);

    // 获取当前locale
    const currentLocale = typeof window !== 'undefined' 
    ? (new URLSearchParams(window.location.search).get('locale') || 'zh-CN')
    : 'zh-CN';
    
  // 点击外部关闭菜单
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [onClose]);

  const handleLocaleChange = (locale: Locale) => {
    onClose();
    
    // 构建新的URL，保留现有参数并更新locale
    const currentParams = typeof window !== 'undefined' 
      ? new URLSearchParams(window.location.search)
      : new URLSearchParams();
    currentParams.set('locale', locale);
    
    // 直接使用window.location跳转，确保完全刷新页面以应用新的locale
    const newUrl = `${pathname}?${currentParams.toString()}`;
    window.location.href = newUrl;
  };



  return (
    <div
      ref={menuRef}
      className="absolute bottom-full right-0 mb-2 w-44 md:w-48 bg-white rounded-lg shadow-xl border border-gray-200 overflow-hidden"
    >
      <div className="px-3 md:px-4 py-2 bg-indigo-50 border-b border-indigo-100">
        <p className="text-xs font-semibold text-indigo-700" suppressHydrationWarning>
          {I18N[i18nMap.switchLanguage] || '切换语言'}
        </p>
      </div>
      <div className="py-1">
        {SUPPORTED_LOCALES.map((locale) => {
          const isActive = locale === currentLocale;
          return (
            <button
              key={locale}
              onClick={() => handleLocaleChange(locale)}
              className={`w-full px-3 md:px-4 py-2.5 text-left text-sm transition-colors ${
                isActive
                  ? 'bg-indigo-50 text-indigo-700 font-medium'
                  : 'text-gray-700 hover:bg-gray-50'
              }`}
            >
              <div className="flex items-center justify-between">
                <span>{localeLabels[locale]}</span>
                {isActive && (
                  <span className="text-indigo-600 font-bold">✓</span>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

