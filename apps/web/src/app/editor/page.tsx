"use client";
/** 故事脚本可视化编辑器 */
import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { ScriptCanvas, useEditorStore } from '@vng/editor';
import { GamePlayer } from '@vng/player';
import { Button, Card } from '@vng/ui';
import { GameProject } from '@vng/core';
import { Loader2, AlertCircle, Home } from 'lucide-react';

// Mock Project for testing (fallback)
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
            nextNodeId: null,
            position: { x: 100, y: 500 },
        },
    ]
};

export default function EditorPage() {
    const searchParams = useSearchParams();
    const projectId = searchParams.get('project');
    
    const { setProject, project } = useEditorStore();
    const [activeTab, setActiveTab] = useState<'editor' | 'preview'>('editor');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const loadProject = async () => {
            setLoading(true);
            setError(null);

            // 如果没有 projectId，使用 Mock 数据
            if (!projectId) {
                console.log('[Editor] No projectId, using mock project');
                setProject(MOCK_PROJECT);
                setLoading(false);
                return;
            }

            try {
                console.log('[Editor] Loading project:', projectId);
                
                const response = await fetch(`/api/projects/${projectId}`);
                
                if (!response.ok) {
                    const errorData = await response.json().catch(() => ({}));
                    throw new Error(errorData.error || `HTTP ${response.status}`);
                }

                const projectData = await response.json();
                console.log('[Editor] Loaded project:', projectData.title);
                
                setProject(projectData);
            } catch (err) {
                const message = err instanceof Error ? err.message : 'Failed to load project';
                console.error('[Editor] Error loading project:', message);
                setError(message);
                
                // 出错时使用 Mock 数据作为 fallback
                setProject(MOCK_PROJECT);
            } finally {
                setLoading(false);
            }
        };

        loadProject();
    }, [projectId, setProject]);

    if (loading) {
        return (
            <div className="flex h-screen w-full items-center justify-center bg-slate-100">
                <div className="flex flex-col items-center gap-4">
                    <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                    <p className="text-slate-600">Loading project...</p>
                </div>
            </div>
        );
    }

    if (!project) {
        return (
            <div className="flex h-screen w-full items-center justify-center bg-slate-100">
                <div className="flex flex-col items-center gap-4">
                    <AlertCircle className="h-8 w-8 text-red-500" />
                    <p className="text-slate-600">Failed to load project</p>
                    <a href="/" className="text-blue-600 hover:underline">Go back home</a>
                </div>
            </div>
        );
    }

    return (
        <div className="flex h-screen w-full flex-col bg-slate-100">
            {/* Header */}
            <header className="flex h-14 items-center justify-between border-b bg-white px-6">
                <div className="flex items-center gap-4">
                    <a href="/" className="text-slate-400 hover:text-slate-600">
                        <Home className="h-5 w-5" />
                    </a>
                    <div>
                        <div className="font-bold text-lg">{project.title}</div>
                        {projectId && (
                            <div className="text-xs text-slate-400">ID: {projectId}</div>
                        )}
                    </div>
                </div>
                
                {/* Error notification */}
                {error && (
                    <div className="flex items-center gap-2 text-amber-600 text-sm">
                        <AlertCircle className="h-4 w-4" />
                        <span>Using demo data (project not found)</span>
                    </div>
                )}
                
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

            {/* Project Info Bar */}
            <div className="flex h-10 items-center justify-between border-b bg-slate-50 px-6 text-sm text-slate-600">
                <div className="flex gap-6">
                    <span>{project.characters?.length || 0} Characters</span>
                    <span>{project.backgrounds?.length || 0} Backgrounds</span>
                    <span>{project.script?.length || 0} Script Nodes</span>
                </div>
                <div className="flex gap-4">
                    <span>Genre: {project.meta?.genre}</span>
                    <span>Style: {project.meta?.artStyle}</span>
                </div>
            </div>

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
