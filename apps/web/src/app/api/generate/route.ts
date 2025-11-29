import { NextResponse } from 'next/server';

// IntelliVNG Services URL
const SERVICES_URL = process.env.INTELLI_SERVICES_URL || 'http://localhost:4000';

export async function POST(request: Request) {
    try {
        const { idea } = await request.json();

        if (!idea) {
            return NextResponse.json({ error: 'Idea is required' }, { status: 400 });
        }

        // Forward request to IntelliVNG Services
        const response = await fetch(`${SERVICES_URL}/api/game/generate`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ idea }),
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
                { error: data.error || 'Generation failed' },
                { status: 500 }
            );
        }

        return NextResponse.json(data.data);
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
