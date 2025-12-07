import { NextRequest, NextResponse } from 'next/server';

/**
 * AI图片生成API代理
 * 转发请求到 intelli-services 后端
 * 
 * 支持两种模式：
 * 1. 普通模式：等待完成后返回结果
 * 2. 流式模式：实时返回生成状态（通过 stream=true 参数）
 */

const BACKEND_URL = process.env.INTELLI_SERVICES_URL || 'http://localhost:4000';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const isStream = body.stream === true;

        // 流式模式：转发 SSE 流
        if (isStream) {
            const response = await fetch(`${BACKEND_URL}/api/game/generate-image-stream`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(body),
            });

            if (!response.ok) {
                const errorData = await response.json();
                return NextResponse.json(
                    { error: errorData.error || '图片生成失败', details: errorData.details },
                    { status: response.status }
                );
            }

            // 转发 SSE 流
            return new Response(response.body, {
                headers: {
                    'Content-Type': 'text/event-stream',
                    'Cache-Control': 'no-cache',
                    'Connection': 'keep-alive',
                },
            });
        }

        // 普通模式：等待完成后返回
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
            maskUrl: data.maskUrl,  // ✅ 添加 maskUrl 字段
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
