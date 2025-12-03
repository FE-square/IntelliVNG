'use client';

import { useState, useEffect } from 'react';
import { Globe, MessageCircle } from 'lucide-react';
import { LocaleSwitcher } from './LocaleSwitcher';
import { I18N } from '@/i18n/client';

const i18nMap = {
  switchLanguage: 'key.toolbar.switchLanguage',
  documentQa: 'key.toolbar.documentQa',
};

/**
 * 悬浮工具栏 - 固定在页面右下角
 * 包含语言切换、文档问答等功能
 */
export function FloatingToolbar() {
  const [showLocaleMenu, setShowLocaleMenu] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <div className="fixed bottom-4 right-4 md:bottom-6 md:right-6 z-[9999] flex flex-col gap-3">
      {/* 语言切换按钮 */}
      <div className="relative">
        <button
          onClick={() => setShowLocaleMenu(!showLocaleMenu)}
          className="w-12 h-12 md:w-14 md:h-14 rounded-full bg-white shadow-lg hover:shadow-xl transition-all flex items-center justify-center group hover:scale-110 active:scale-95"
          title={mounted ? (I18N[i18nMap.switchLanguage] || '切换语言') : '切换语言'}
          aria-label={mounted ? (I18N[i18nMap.switchLanguage] || '切换语言') : '切换语言'}
        >
          <Globe className="w-5 h-5 md:w-6 md:h-6 text-indigo-600 group-hover:text-indigo-700" />
        </button>
        {showLocaleMenu && (
          <LocaleSwitcher onClose={() => setShowLocaleMenu(false)} />
        )}
      </div>

      {/* 文档问答机器人按钮 (TODO) */}
      <button
        className="w-12 h-12 md:w-14 md:h-14 rounded-full bg-white shadow-lg hover:shadow-xl transition-all flex items-center justify-center group hover:scale-110 active:scale-95 opacity-50 cursor-not-allowed"
        title={mounted ? (I18N[i18nMap.documentQa] || '工具问答机器人 (即将推出)') : '工具问答机器人 (即将推出)'}
        aria-label={mounted ? (I18N[i18nMap.documentQa] || '工具问答机器人') : '工具问答机器人'}
        disabled
      >
        <MessageCircle className="w-5 h-5 md:w-6 md:h-6 text-purple-600 group-hover:text-purple-700" />
      </button>
    </div>
  );
}

