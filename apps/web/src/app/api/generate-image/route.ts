import { NextRequest, NextResponse } from 'next/server';

/**
 * AI图片生成API代理
 * 转发请求到 intelli-services 后端
 */

const BACKEND_URL = process.env.INTELLI_SERVICES_URL || 'http://localhost:4000';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();

        // 转发到后端服务
        const response = await fetch(`${BACKEND_URL}/api/game/generate-image`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(body),
        });

        const data = await response.json();

        if (!response.ok) {
            return NextResponse.json(
                { error: data.error || '图片生成失败', details: data.details },
                { status: response.status }
            );
        }

        return NextResponse.json({
            imageUrl: data.imageUrl,
            prompt: data.prompt,
            type: data.type,
            taskId: data.taskId,
        });
    } catch (error) {
        console.error('[generate-image proxy] 错误:', error);
        return NextResponse.json(
            { 
                error: '图片生成服务不可用',
                details: error instanceof Error ? error.message : '未知错误'
            },
            { status: 500 }
        );
    }
}
