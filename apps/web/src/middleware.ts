import { NextRequest, NextResponse } from 'next/server';
import { SUPPORTED_LOCALES, DEFAULT_LOCALE, type Locale } from '@/i18n';

export function middleware(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;
  
  // 从URL参数获取locale
  const localeParam = searchParams.get('locale');
  let locale: Locale = DEFAULT_LOCALE;
  
  if (localeParam && SUPPORTED_LOCALES.includes(localeParam as Locale)) {
    locale = localeParam as Locale;
  } else {
    // 从Accept-Language header获取
    const acceptLanguage = request.headers.get('accept-language');
    if (acceptLanguage) {
      for (const supportedLocale of SUPPORTED_LOCALES) {
        if (acceptLanguage.includes(supportedLocale)) {
          locale = supportedLocale;
          break;
        }
      }
      if (acceptLanguage.includes('zh') && !localeParam) {
        locale = 'zh-CN';
      }
      if (acceptLanguage.includes('en') && !localeParam) {
        locale = 'en-US';
      }
    }
  }

  // 如果URL中没有locale参数或locale参数无效，重定向到带有效locale参数的URL
  if (!localeParam || !SUPPORTED_LOCALES.includes(localeParam as Locale)) {
    const newUrl = new URL(request.url);
    // 设置或更新locale参数，保留其他查询参数
    newUrl.searchParams.set('locale', locale);
    return NextResponse.redirect(newUrl);
  }

  // 将locale添加到请求header中，供服务端组件使用
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-locale', locale);

  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};

