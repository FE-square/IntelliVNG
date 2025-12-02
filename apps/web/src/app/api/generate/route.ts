import { NextResponse } from 'next/server';

// IntelliVNG Services URL
const SERVICES_URL = process.env.INTELLI_SERVICES_URL || 'http://localhost:4000';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { idea, characters, worldSetting, scenes, backgrounds, locale } = body;
        
        // 获取locale，如果没有则从URL参数获取
        const userLocale = locale || 'zh-CN';

        // 支持三种模式：
        // 1. 旧的 idea 模式
        // 2. 旧的 characters/backgrounds 模式
        // 3. 新的 characters/worldSetting/scenes 模式
        if (!idea && !characters) {
            return NextResponse.json({ error: 'characters is required' }, { status: 400 });
        }

        // Forward request to IntelliVNG Services
        const response = await fetch(`${SERVICES_URL}/api/game/generate`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(body),
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            console.error('[API/generate] Service error:', errorData);
            return NextResponse.json(
                { error: errorData.error || 'Failed to generate game' },
                { status: response.status }
            );
        }

        const data = await response.json();

        if (!data.success) {
            return NextResponse.json(
                { success: false, error: data.error || 'Generation failed' },
                { status: 500 }
            );
        }

        return NextResponse.json({
            success: true,
            data: data.data,
        });
    } catch (error) {
        console.error('[API/generate] Error:', error);
        
        // Check if it's a connection error
        if (error instanceof Error && (error.cause as any)?.code === 'ECONNREFUSED') {
            return NextResponse.json(
                { error: 'IntelliVNG Services is not running. Please start it with: pnpm dev:serv' },
                { status: 503 }
            );
        }

        return NextResponse.json(
            { error: 'Failed to generate game' },
            { status: 500 }
        );
    }
}
