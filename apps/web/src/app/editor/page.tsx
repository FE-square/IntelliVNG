"use client";

import { useEffect, useState } from 'react';
import { ScriptCanvas, useEditorStore } from '@vng/editor';
import { GamePlayer } from '@vng/player';
import { Button, Card } from '@vng/ui';
import { GameProject } from '@vng/core';

// Mock Project for testing
const MOCK_PROJECT: GameProject = {
    id: 'demo-1',
    title: 'Demo Project',
    description: 'A demo visual novel',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    meta: {
        author: 'User',
        version: '1.0.0',
        genre: 'mystery',
        artStyle: 'anime',
    },
    settings: {
        textSpeed: 50,
        autoPlayDelay: 2000,
        defaultTransition: 'fade',
    },
    characters: [
        {
            id: 'char-1',
            name: 'Alice',
            displayName: 'Alice',
            description: 'A cheerful detective',
            defaultSpriteId: 'sprite-1',
            sprites: [],
        },
        {
            id: 'char-2',
            name: 'Bob',
            displayName: 'Bob',
            description: 'A mysterious stranger',
            defaultSpriteId: 'sprite-2',
            sprites: [],
        }
    ],
    backgrounds: [
        {
            id: 'bg-1',
            name: 'City Street',
            description: 'A busy city street at night',
            imageUrl: 'https://images.unsplash.com/photo-1519501025264-65ba15a82390?q=80&w=1000&auto=format&fit=crop',
        }
    ],
    script: [
        {
            id: 'node-1',
            type: 'scene-change',
            backgroundId: 'bg-1',
            transition: 'fade',
            nextNodeId: 'node-2',
            position: { x: 100, y: 100 },
        },
        {
            id: 'node-2',
            type: 'dialogue',
            characterId: 'char-1',
            text: 'Hello! Welcome to IntelliVNG.',
            nextNodeId: 'node-3',
            position: { x: 100, y: 300 },
        },
        {
            id: 'node-3',
            type: 'dialogue',
            characterId: 'char-2',
            text: 'This is a demo of the engine.',
            nextNodeId: 'node-4',
            position: { x: 100, y: 500 },
        },
        {
            id: 'node-4',
            type: 'choice',
            prompt: 'What do you think?',
            choices: [
                { id: 'c1', text: 'It is cool!', nextNodeId: 'node-5' },
                { id: 'c2', text: 'Needs more work.', nextNodeId: 'node-6' }
            ],
            position: { x: 100, y: 700 },
        },
        {
            id: 'node-5',
            type: 'dialogue',
            characterId: 'char-1',
            text: 'Glad you liked it!',
            nextNodeId: null,
            position: { x: -100, y: 900 },
        },
        {
            id: 'node-6',
            type: 'dialogue',
            characterId: 'char-2',
            text: 'We will keep improving it.',
            nextNodeId: null,
            position: { x: 300, y: 900 },
        }
    ]
};

export default function EditorPage() {
    const { setProject, project } = useEditorStore();
    const [activeTab, setActiveTab] = useState<'editor' | 'preview'>('editor');

    useEffect(() => {
        // Load mock project on mount
        setProject(MOCK_PROJECT);
    }, [setProject]);

    if (!project) return <div>Loading...</div>;

    return (
        <div className="flex h-screen w-full flex-col bg-slate-100">
            {/* Header */}
            <header className="flex h-14 items-center justify-between border-b bg-white px-6">
                <div className="font-bold text-lg">IntelliVNG Editor</div>
                <div className="flex gap-4">
                    <Button
                        variant={activeTab === 'editor' ? 'default' : 'ghost'}
                        onClick={() => setActiveTab('editor')}
                    >
                        Script Editor
                    </Button>
                    <Button
                        variant={activeTab === 'preview' ? 'default' : 'ghost'}
                        onClick={() => setActiveTab('preview')}
                    >
                        Preview Game
                    </Button>
                    <Button variant="outline">Export</Button>
                </div>
            </header>

            {/* Main Content */}
            <main className="flex-1 overflow-hidden">
                {activeTab === 'editor' ? (
                    <div className="h-full w-full">
                        <ScriptCanvas />
                    </div>
                ) : (
                    <div className="flex h-full items-center justify-center p-8 bg-slate-900">
                        <Card className="aspect-video w-full max-w-6xl overflow-hidden border-0 shadow-2xl">
                            <GamePlayer project={project} />
                        </Card>
                    </div>
                )}
            </main>
        </div>
    );
}
