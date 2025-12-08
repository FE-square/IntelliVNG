'use client';

import { useState, useEffect } from 'react';
import { Globe, FileText, X, ExternalLink } from 'lucide-react';
import { LocaleSwitcher } from './LocaleSwitcher';
import { I18N } from '@/i18n/client';

const i18nMap = {
  switchLanguage: 'key.toolbar.switchLanguage',
  documentQa: 'key.toolbar.documentQa',
  docsTitle: 'key.toolbar.docsTitle', //'项目文档',
  docsDesc: 'key.toolbar.docsDesc', //'这里可以找到关于项目的详细说明文档',
  docFlow: 'key.toolbar.docFlow', //'全流程说明文档',
  docTech: 'key.toolbar.docTech', //'AI 技术设计文档',
};

/**
 * 悬浮工具栏 - 固定在页面右下角
 * 包含语言切换、文档问答等功能
 */
export function FloatingToolbar() {
  const [showLocaleMenu, setShowLocaleMenu] = useState(false);
  const [showDocsModal, setShowDocModal] = useState(false);
  const [isClosingDocModal, setIsClosingDocModal] = useState(false);

  // 文档链接配置
  const docLinks = [
    {
      title: I18N[i18nMap.docFlow],
      url: 'https://fe-square.feishu.cn/wiki/Ki4hwhwOeieN9ykDk71cvGFznle#Q0Rudviofo3F7ExisBlcfK1vnTb',
      color: 'bg-blue-50 text-blue-600 hover:bg-blue-100'
    },
    {
      title: I18N[i18nMap.docTech],
      url: 'https://fe-square.feishu.cn/wiki/OEbVwhnZtiyI8pkhzEQcYPirnxi',
      color: 'bg-purple-50 text-purple-600 hover:bg-purple-100'
    }
  ];

  useEffect(() => {
    window.addEventListener('FloatingToolbar:OpenDocs', (e) => {
      setShowDocModal(true);
    });
  }, []);

  // 当Modal打开时，确保关闭状态被重置
  useEffect(() => {
    if (showDocsModal) {
      setIsClosingDocModal(false);
    }
  }, [showDocsModal]);

  const hideDocsModal = () => {
    // 触发关闭动画
    setIsClosingDocModal(true);
    // 动画完成后隐藏Modal
    setTimeout(() => {
      setShowDocModal(false);
      setIsClosingDocModal(false);
    }, 300);
  };

  return (
    <>
      <div className="fixed bottom-4 right-4 md:bottom-6 md:right-6 z-[9999] flex flex-col gap-3">
        {/* 语言切换按钮 */}
        <div className="relative">
          <button
            onClick={() => setShowLocaleMenu(!showLocaleMenu)}
            className="w-12 h-12 md:w-14 md:h-14 rounded-full bg-white shadow-lg hover:shadow-xl transition-all flex items-center justify-center group hover:scale-110 active:scale-95"
            title={I18N[i18nMap.switchLanguage] || '切换语言'}
            aria-label={I18N[i18nMap.switchLanguage] || '切换语言'}
          suppressHydrationWarning
          >
            <Globe className="w-5 h-5 md:w-6 md:h-6 text-indigo-600 group-hover:text-indigo-700" />
          </button>
          {showLocaleMenu && (
            <LocaleSwitcher onClose={() => setShowLocaleMenu(false)} />
          )}
        </div>

        {/* 文档查看按钮 */}
        <button
          onClick={() => setShowDocModal(true)}
          className="w-12 h-12 md:w-14 md:h-14 rounded-full bg-white shadow-lg hover:shadow-xl transition-all flex items-center justify-center group hover:scale-110 active:scale-95"
          title={I18N[i18nMap.documentQa]}
          aria-label={I18N[i18nMap.documentQa]}
        >
          <FileText className="w-5 h-5 md:w-6 md:h-6 text-emerald-600 group-hover:text-emerald-700" />
        </button>
      </div>

      {/* 文档弹窗 */}
      {showDocsModal && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4">
          {/* 背景遮罩 */}
          <div 
            className={`absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity duration-300 ${
              isClosingDocModal ? 'opacity-0' : 'opacity-100'
            }`}
            onClick={hideDocsModal}
          />
          
          {/* 弹窗内容 */}
          <div 
            className={`relative bg-white rounded-xl shadow-2xl max-w-md w-full overflow-hidden transition-all duration-300 ease-in-out ${
              isClosingDocModal ? 'opacity-0' : 'opacity-100'
            }`}
            style={isClosingDocModal ? {
              transform: 'scale(0.05) translate(50vw, 50vh)',
              transformOrigin: 'center center',
            } : {
              transform: 'scale(1) translate(0, 0)',
            }}
          >
            {/* 标题栏 */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-50/50">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <FileText className="w-5 h-5 text-emerald-600" />
                {I18N[i18nMap.docsTitle] || '项目文档'}
              </h3>
              <button
                onClick={hideDocsModal}
                className="p-1 rounded-full hover:bg-gray-200 text-gray-500 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            {/* 内容区 */}
            <div className="p-6">
              <p className="text-sm text-gray-500 mb-4">
                {I18N[i18nMap.docsDesc] || '这里可以找到关于项目的详细说明文档'}
              </p>
              
              <div className="space-y-3">
                {docLinks.map((link, index) => (
                  <a
                    key={index}
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`flex items-center justify-between p-4 rounded-lg transition-all hover:shadow-md border border-transparent hover:border-gray-200 group ${link.color}`}
                  >
                    <span className="font-medium">{link.title || link.url}</span>
                    <ExternalLink className="w-4 h-4 opacity-70 group-hover:opacity-100" />
                  </a>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

