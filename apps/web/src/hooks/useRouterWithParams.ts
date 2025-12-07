'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback } from 'react';

/**
 * 自定义路由 hook，自动保留 URL 参数（如 locale）
 */
export function useRouterWithParams() {
    const router = useRouter();
    const searchParams = useSearchParams();

    /**
     * 跳转到新页面，保留现有的 URL 参数
     */
    const push = useCallback((path: string) => {
        const params = new URLSearchParams(searchParams.toString());
        const paramsString = params.toString();
        const fullPath = paramsString ? `${path}?${paramsString}` : path;
        router.push(fullPath);
    }, [router, searchParams]);

    /**
     * 替换当前页面，保留现有的 URL 参数
     */
    const replace = useCallback((path: string) => {
        const params = new URLSearchParams(searchParams.toString());
        const paramsString = params.toString();
        const fullPath = paramsString ? `${path}?${paramsString}` : path;
        router.replace(fullPath);
    }, [router, searchParams]);

    return {
        push,
        replace,
        back: router.back,
        forward: router.forward,
        refresh: router.refresh,
        prefetch: router.prefetch,
    };
}
