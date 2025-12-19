import { NextRequest, NextResponse } from 'next/server';

const SERVICES_URL = process.env.INTELLI_SERVICES_URL || 'http://localhost:4000';

// SSE 请求超时时间：5 分钟
const SSE_TIMEOUT_MS = 5 * 60 * 1000;

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Next.js 路由配置：最大执行时间 5 分钟
export const maxDuration = 300;

export async function POST(request: NextRequest) {
    // 创建 AbortController 用于超时控制
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
        controller.abort();
        console.error('[API/game/idea-to-draft-stream] 请求超时 (5分钟)');
    }, SSE_TIMEOUT_MS);

    try {
        const body = await request.text();

        const response = await fetch(`${SERVICES_URL}/api/game/idea-to-draft-stream`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body,
            signal: controller.signal,
        });

        // 请求成功，清除超时定时器
        clearTimeout(timeoutId);

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            return NextResponse.json(
                {
                    success: false,
                    error: errorData.error || '草稿生成服务请求失败',
                },
                { status: response.status }
            );
        }

        const headers = new Headers(response.headers);
        headers.set('Cache-Control', 'no-cache');
        headers.set('Content-Type', 'text/event-stream');
        headers.set('Connection', 'keep-alive');
        headers.set('X-Accel-Buffering', 'no');
        headers.delete('content-length');

        return new Response(response.body, {
            status: response.status,
            headers,
        });
    } catch (error) {
        // 清除超时定时器
        clearTimeout(timeoutId);

        // 处理超时错误
        if (error instanceof Error && error.name === 'AbortError') {
            console.error('[API/game/idea-to-draft-stream] 请求被中止（超时或客户端断开）');
            const encoder = new TextEncoder();
            const errorPayload = JSON.stringify({
                event: 'error',
                success: false,
                error: '服务器处理超时，请重试',
            });
            return new Response(
                encoder.encode(`data: ${errorPayload}\n\n`),
                {
                    status: 200,
                    headers: {
                        'Content-Type': 'text/event-stream',
                        'Cache-Control': 'no-cache',
                        'Connection': 'keep-alive',
                    },
                }
            );
        }

        console.error('[API/game/idea-to-draft-stream] Error:', error);
        return NextResponse.json(
            { success: false, error: '无法连接草稿生成服务，请稍后重试' },
            { status: 500 }
        );
    }
}



