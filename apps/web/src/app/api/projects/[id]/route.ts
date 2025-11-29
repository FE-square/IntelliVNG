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

        const response = await fetch(`${SERVICES_URL}/api/game/projects/${projectId}`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            return NextResponse.json(
                { error: errorData.error || 'Failed to get project' },
                { status: response.status }
            );
        }

        const data = await response.json();

        if (!data.success) {
            return NextResponse.json(
                { error: data.error || 'Failed to get project' },
                { status: 500 }
            );
        }

        return NextResponse.json(data.data);
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


