import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import '@vng/ui/src/styles/globals.css' // Import UI package styles
import { Providers } from '@/components/Providers'
import { I18nProvider } from '@/components/I18nProvider'
import { FloatingToolbar } from '@/components/FloatingToolbar'
import { headers } from 'next/headers'
import { SUPPORTED_LOCALES, DEFAULT_LOCALE, type Locale, loadLocaleMessagesSync } from '@/i18n'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
    title: 'IntelliVNG Studio',
    description: 'AI-Powered Visual Novel Generator',
}

export default function RootLayout({
    children,
}: {
    children: React.ReactNode
}) {
    // 从middleware设置的header中获取locale用于设置html lang属性
    const headersList = headers();
    const localeHeader = headersList.get('x-locale');
    const locale: Locale = (localeHeader && SUPPORTED_LOCALES.includes(localeHeader as Locale))
        ? (localeHeader as Locale)
        : DEFAULT_LOCALE;
    const lang = locale.split('-')[0]; // 提取语言代码，如 'zh', 'en'
    
    // 在 SSR 时加载对应 locale 的语言包
    const i18nMessages = loadLocaleMessagesSync(locale);
    
    // 将 I18N 数据序列化为 JSON，用于注入到 window.__APP_INITIAL_STATE__
    const initialState = {
        I18N: i18nMessages,
    };
    const initialStateJson = JSON.stringify(initialState).replace(/</g, '\\u003c');

    return (
        <html lang={lang}>
            <script
                dangerouslySetInnerHTML={{
                    __html: `window.__APP_INITIAL_STATE__ = ${initialStateJson};`,
                }}
            />
            <body className={inter.className}>
                <I18nProvider>
                    <Providers>
                        {children}
                        <FloatingToolbar />
                    </Providers>
                </I18nProvider>
            </body>
        </html>
    )
}
