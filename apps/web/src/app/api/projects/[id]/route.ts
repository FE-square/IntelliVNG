import { NextResponse } from 'next/server';

const SERVICES_URL = process.env.INTELLI_SERVICES_URL || 'http://localhost:4000';

// GET /api/projects/:id - 获取项目详情
export async function GET(
    request: Request,
    { params }: { params: { id: string } }
) {
    try {
        const projectId = params.id;

        if (!projectId) {
            return NextResponse.json({ error: 'Project ID is required' }, { status: 400 });
        }
        
        console.log(`[API/projects] GET请求 - projectId: ${projectId}`);
        console.log(`[API/projects] 后端URL: ${SERVICES_URL}`);

        const response = await fetch(`${SERVICES_URL}/api/game/projects/${projectId}`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
        });
        
        console.log(`[API/projects] 后端响应状态: ${response.status}`);

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            return NextResponse.json(
                { error: errorData.error || 'Failed to get project' },
                { status: response.status }
            );
        }

        const data = await response.json();
        
        console.log(`[API/projects] 后端返回数据:`, {
            success: data.success,
            hasData: !!data.data,
            characters: data.data?.characters?.map((c: any) => ({
                id: c.id,
                name: c.displayName,
                avatarUrl: c.avatarUrl,
            })),
            backgrounds: data.data?.backgrounds?.map((b: any) => ({
                id: b.id,
                name: b.name,
                imageUrl: b.imageUrl,
            }))
        });
        
        // 🔍 检查原始数据
        console.log(`[API/projects] characters[0]完整数据:`, JSON.stringify(data.data?.characters?.[0]).substring(0, 300));
        console.log(`[API/projects] characters[0].avatarUrl:`, data.data?.characters?.[0]?.avatarUrl);
        console.log(`[API/projects] characters[0].sprites:`, data.data?.characters?.[0]?.sprites);

        if (!data.success) {
            return NextResponse.json(
                { error: data.error || 'Failed to get project' },
                { status: 500 }
            );
        }
        
        console.log(`[API/projects] 返回给前端的数据:`, {
            characters: data.data?.characters?.length,
            backgrounds: data.data?.backgrounds?.length
        });
        
        // 🔍 验证返回数据
        const result = data.data;
        console.log(`[API/projects] result.characters[0]:`, JSON.stringify(result?.characters?.[0]).substring(0, 400));

        return NextResponse.json(result);
    } catch (error) {
        console.error('[API/projects] Error:', error);
        return NextResponse.json({ error: 'Failed to get project' }, { status: 500 });
    }
}

// PUT /api/projects/:id - 更新项目
export async function PUT(
    request: Request,
    { params }: { params: { id: string } }
) {
    try {
        const projectId = params.id;
        const body = await request.json();

        if (!projectId) {
            return NextResponse.json({ error: 'Project ID is required' }, { status: 400 });
        }

        const response = await fetch(`${SERVICES_URL}/api/game/projects/${projectId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            return NextResponse.json(
                { error: errorData.error || 'Failed to update project' },
                { status: response.status }
            );
        }

        const data = await response.json();

        if (!data.success) {
            return NextResponse.json(
                { error: data.error || 'Failed to update project' },
                { status: 500 }
            );
        }

        return NextResponse.json(data.data);
    } catch (error) {
        console.error('[API/projects] Error:', error);
        return NextResponse.json({ error: 'Failed to update project' }, { status: 500 });
    }
}





