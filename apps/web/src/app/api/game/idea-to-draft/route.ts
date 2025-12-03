import { NextRequest, NextResponse } from 'next/server';

const SERVICES_URL = process.env.INTELLI_SERVICES_URL || 'http://localhost:4000';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { idea, locale } = body || {};

        if (!idea || typeof idea !== 'string') {
            return NextResponse.json(
                { success: false, error: 'idea is required' },
                { status: 400 }
            );
        }

        const response = await fetch(`${SERVICES_URL}/api/game/idea-to-draft`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ idea, locale }),
        });

        const data = await response.json().catch(() => ({
            success: false,
            error: 'Invalid response from idea-to-draft service',
        }));

        return NextResponse.json(data, { status: response.status });
    } catch (error) {
        console.error('[API/game/idea-to-draft] Error:', error);

        if (error instanceof Error && (error as any)?.cause?.code === 'ECONNREFUSED') {
            return NextResponse.json(
                { success: false, error: 'IntelliVNG Services 未启动，请先运行 pnpm dev:serv' },
                { status: 503 }
            );
        }

        return NextResponse.json(
            { success: false, error: 'Idea to draft 请求失败，请稍后再试' },
            { status: 500 }
        );
    }
}

