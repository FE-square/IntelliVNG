import { NextRequest, NextResponse } from 'next/server';

/**
 * 角色信息自动补全 API 代理
 * 转发请求到 intelli-services 后端
 */

const BACKEND_URL = process.env.INTELLI_SERVICES_URL || 'http://localhost:4000';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();

        const response = await fetch(`${BACKEND_URL}/api/game/autocomplete-character`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(body),
        });

        const data = await response.json();

        if (!response.ok) {
            return NextResponse.json(
                { error: data.error || '自动补全失败', details: data.details },
                { status: response.status }
            );
        }

        return NextResponse.json(data);
    } catch (error) {
        console.error('[autocomplete-character proxy] 错误:', error);
        return NextResponse.json(
            { 
                error: '自动补全服务不可用',
                details: error instanceof Error ? error.message : '未知错误'
            },
            { status: 500 }
        );
    }
}

