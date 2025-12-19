import { NextRequest, NextResponse } from 'next/server';

const SERVICES_URL = process.env.INTELLI_SERVICES_URL || 'http://localhost:4000';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { sessionId } = body || {};

        if (!sessionId || typeof sessionId !== 'string') {
            return NextResponse.json(
                { success: false, error: 'sessionId is required' },
                { status: 400 }
            );
        }

        const response = await fetch(`${SERVICES_URL}/api/game/abort-generation`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sessionId }),
        });

        const data = await response.json().catch(() => ({
            success: false,
            error: 'Invalid response from abort-generation service',
        }));

        return NextResponse.json(data, { status: response.status });
    } catch (error) {
        console.error('[API/game/abort-generation] Error:', error);

        if (error instanceof Error && (error as any)?.cause?.code === 'ECONNREFUSED') {
            return NextResponse.json(
                { success: false, error: 'IntelliVNG Services 未启动' },
                { status: 503 }
            );
        }

        return NextResponse.json(
            { success: false, error: '中断请求失败' },
            { status: 500 }
        );
    }
}



