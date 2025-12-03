import { NextRequest, NextResponse } from 'next/server';

const SERVICES_URL = process.env.INTELLI_SERVICES_URL || 'http://localhost:4000';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
    try {
        const body = await request.text();

        const response = await fetch(`${SERVICES_URL}/api/game/generate-by-agents`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body,
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            return NextResponse.json(
                {
                    success: false,
                    error: errorData.error || 'Agent 服务请求失败',
                },
                { status: response.status }
            );
        }

        const headers = new Headers(response.headers);
        headers.set('Cache-Control', 'no-cache');
        headers.set('Content-Type', 'text/event-stream');
        headers.set('Connection', 'keep-alive');
        headers.delete('content-length');

        return new Response(response.body, {
            status: response.status,
            headers,
        });
    } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
            return new Response(null, { status: 499 });
        }

        console.error('[API/game/generate-by-agents] Error:', error);
        return NextResponse.json(
            { success: false, error: '无法连接智能体服务，请稍后重试' },
            { status: 500 }
        );
    }
}

