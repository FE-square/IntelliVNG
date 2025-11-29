import { NextResponse } from 'next/server';
import { mastra } from '@vng/agent';

export async function POST(request: Request) {
    try {
        const { idea } = await request.json();

        if (!idea) {
            return NextResponse.json({ error: 'Idea is required' }, { status: 400 });
        }

        // Execute the workflow
        // Note: This assumes mastra.getWorkflow returns the workflow instance and execute returns a promise
        const workflow = mastra.getWorkflow('createGame');
        if (!workflow) {
            return NextResponse.json({ error: 'Workflow not found' }, { status: 500 });
        }

        const result = await workflow.execute({
            triggerData: { idea },
        });

        return NextResponse.json(result);
    } catch (error) {
        console.error('Generation error:', error);
        return NextResponse.json({ error: 'Failed to generate game' }, { status: 500 });
    }
}
