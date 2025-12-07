"use client";
/** 故事脚本可视化编辑器 */
import { useEffect, useState, useRef, useCallback, Suspense } from 'react';
import { Loader2, AlertCircle, Home, Save, Clock } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { ReactFlowProvider } from 'reactflow';
import { GamePlayer } from '@vng/player';
import { Button, Card, useToast } from '@vng/ui';
import { GameProject } from '@vng/core';
import { FlowEditor } from '@vng/editor';
import { saveProject, saveDraft, clearDraft } from '@/lib/projectStorage';
import { exportProjectAsJson, exportProjectAsPlayableHtml, exportProjectAsPlayableHtmlWithImages } from '@/lib/projectExport';
import { t } from '@/i18n/client';

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
            type: 'scene',
            isStart: true,
            title: '初次相遇',
            backgroundId: 'bg-1',
            sceneName: 'City Street',
            nextNodeId: 'node-2',
            position: { x: 100, y: 100 },
            dialogues: [
                {
                    id: 'd1-1',
                    characterId: 'char-1',
                    text: 'Hello! Welcome to IntelliVNG.',
                }
            ],
        },
        {
            id: 'node-2',
            type: 'scene',
            title: '对话继续',
            backgroundId: 'bg-1',
            nextNodeId: 'node-3',
            position: { x: 100, y: 300 },
            dialogues: [
                {
                    id: 'd2-1',
                    characterId: 'char-2',
                    text: 'This is a demo of the engine.',
                }
            ],
        },
        {
            id: 'node-3',
            type: 'ending',
            isEnding: true,
            title: '结局',
            position: { x: 100, y: 500 },
            dialogues: [],
        },
    ]
};

function EditorPageContent() {
    const searchParams = useSearchParams();
    const toast = useToast();
    // 支持两种参数名：projectId 和 project
    const projectId = searchParams.get('projectId') || searchParams.get('project');
    
    const [project, setProject] = useState<GameProject | null>(null);
    const [activeTab, _setActiveTab] = useState<'editor' | 'preview'>('editor');
    const setActiveTab = useCallback((tab: 'editor' | 'preview') => {
        _setActiveTab((tabInput: 'editor' | 'preview') => {
            if (tabInput === tab) {
                toast.warning(t('key.editor.alreadyInView'));
                return tabInput;
            }
            return tab;
        });
    }, [_setActiveTab]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
    const [previewMode, setPreviewMode] = useState<'from-start' | 'from-current'>('from-start');
    const [showPreviewMenu, setShowPreviewMenu] = useState(false);
    const [showCharactersDropdown, setShowCharactersDropdown] = useState(false);
    const [showScenesDropdown, setShowScenesDropdown] = useState(false);
    const [showNodesDropdown, setShowNodesDropdown] = useState(false);
    const [selectedCharacter, setSelectedCharacter] = useState<any>(null); // 选中的角色（用于查看立绘）
    const [selectedBackground, setSelectedBackground] = useState<any>(null); // 选中的场景（用于重新生成）
    const [isGeneratingAvatar, setIsGeneratingAvatar] = useState(false); // 是否正在生成头像
    const [isGeneratingSprite, setIsGeneratingSprite] = useState(false); // 是否正在生成立绘
    const [isGeneratingBackground, setIsGeneratingBackground] = useState(false); // 是否正在生成背景
    const [showAvatarUrlInput, setShowAvatarUrlInput] = useState(false); // 显示头像URL输入框
    const [showSpriteUrlInput, setShowSpriteUrlInput] = useState(false); // 显示立绘URL输入框
    const [showBackgroundUrlInput, setShowBackgroundUrlInput] = useState(false); // 显示背景URL输入框
    const [avatarUrlValue, setAvatarUrlValue] = useState(''); // 头像URL值
    const [spriteUrlValue, setSpriteUrlValue] = useState(''); // 立绘URL值
    const [backgroundUrlValue, setBackgroundUrlValue] = useState(''); // 背景URL值
    const [previewKey, setPreviewKey] = useState(0);  // ✅ 用于强制重新挂载GamePlayer
    const [lastSaveTime, setLastSaveTime] = useState<Date | null>(null);  // ✅ 最后保存时间
    const [isSaving, setIsSaving] = useState(false);  // ✅ 正在保存
    const [showSaveNoteDialog, setShowSaveNoteDialog] = useState(false);  // ✅ 显示保存备注对话框
    const [saveNote, setSaveNote] = useState('');  // ✅ 保存备注
    const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);  // ✅ 自动保存定时器
    const [exportProgress, setExportProgress] = useState<{ show: boolean; current: number; total: number; message: string }>({
        show: false,
        current: 0,
        total: 100,
        message: ''
    });

    useEffect(() => {
        const loadProject = async () => {
            setLoading(true);
            setError(null);

            // 如果没有 projectId，使用 Mock 数据
            if (!projectId) {
                setProject(MOCK_PROJECT);
                setLoading(false);
                return;
            }

            try {
                // 🔧 直接调用后端API，绕过前端Next.js API路由
                const BACKEND_URL = process.env.NEXT_PUBLIC_INTELLI_SERVICES_URL || 'http://localhost:4000';
                const response = await fetch(`${BACKEND_URL}/api/game/projects/${projectId}`);
                
                if (!response.ok) {
                    const errorData = await response.json().catch(() => ({}));
                    throw new Error(errorData.error || `HTTP ${response.status}`);
                }

                const data = await response.json();
                console.log('[Editor] 后端返回数据:', {
                    success: data.success,
                    characters: data.data?.characters?.map((c: any) => ({
                        id: c.id,
                        avatarUrl: c.avatarUrl,
                        sprites: c.sprites?.length
                    }))
                });
                
                const projectData = data.data;
                console.log('[Editor] 加载项目数据:', {
                    projectId,
                    title: projectData.title,
                    characters: projectData.characters?.map((c: any) => ({
                        id: c.id,
                        name: c.displayName,
                        avatarUrl: c.avatarUrl,
                        sprites: c.sprites?.length || 0
                    })),
                    backgrounds: projectData.backgrounds?.map((b: any) => ({
                        id: b.id,
                        name: b.name,
                        hasImage: !!b.imageUrl
                    }))
                });
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
    
    // ✅ 点击外部关闭预览菜单
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            const target = e.target as HTMLElement;
            if (showPreviewMenu && !target.closest('.preview-menu-container')) {
                setShowPreviewMenu(false);
            }
        };
        
        if (showPreviewMenu) {
            document.addEventListener('click', handleClickOutside);
            return () => document.removeEventListener('click', handleClickOutside);
        }
    }, [showPreviewMenu]);
    
    // ✅ 点击外部关闭下拉菜单
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            const target = e.target as HTMLElement;
            if (!target.closest('.dropdown-container')) {
                setShowCharactersDropdown(false);
                setShowScenesDropdown(false);
                setShowNodesDropdown(false);
            }
        };
        
        if (showCharactersDropdown || showScenesDropdown || showNodesDropdown) {
            document.addEventListener('click', handleClickOutside);
            return () => document.removeEventListener('click', handleClickOutside);
        }
    }, [showCharactersDropdown, showScenesDropdown, showNodesDropdown]);
    
    // 自动保存草稿 - 每30秒保存到本地
    useEffect(() => {
        if (!project || !projectId) return;
        
        if (autoSaveTimerRef.current) {
            clearInterval(autoSaveTimerRef.current);
        }
        
        autoSaveTimerRef.current = setInterval(() => {
            // 保存草稿到本地（不阻塞）
            saveDraft(projectId, project);
            setLastSaveTime(new Date());
        }, 30000);
        
        return () => {
            if (autoSaveTimerRef.current) {
                clearInterval(autoSaveTimerRef.current);
            }
        };
    }, [project, projectId]);
    
    // 手动保存到后端
    const handleManualSave = async (note?: string) => {
        if (!project || !projectId) return;
        
        setIsSaving(true);
        try {
            // 更新项目的updatedAt时间戳
            const updatedProject = {
                ...project,
                updatedAt: new Date().toISOString(),
            };
            
            const success = await saveProject(updatedProject);
            
            if (success) {
                // 更新本地project状态
                setProject(updatedProject);
                setLastSaveTime(new Date());
                setShowSaveNoteDialog(false);
                setSaveNote('');
                clearDraft(projectId);  // 清除草稿
                toast.success('保存成功', '项目已保存到我的项目 🎉');
            } else {
                toast.error('保存失败', '请重试');
            }
        } catch (error) {
            console.error('[Editor] 保存失败:', error);
            toast.error('保存失败', '请重试');
        } finally {
            setIsSaving(false);
        }
    };
    

    const handleGenerateImage = async (
        characterId: string, 
        prompt: string, 
        refImageUrl?: string,
        explicitType?: 'sprite' | 'avatar' | 'background'
    ): Promise<{ imageUrl: string; maskUrl?: string }> => {
        try {
            // ✅ 优先使用显式传入的 type，否则根据 characterId 和 prompt 推断
            let type: 'sprite' | 'avatar' | 'background' = explicitType || 'sprite';
            if (!explicitType) {
                if (characterId === 'cover') {
                    type = 'background';
                } else if (characterId === 'scene' || characterId.startsWith('background-')) {
                    type = 'background';
                } else if (prompt.includes('头像') || prompt.includes('avatar')) {
                    type = 'avatar';
                }
            }
            
            toast.info('生成中', `正在生成${type === 'sprite' ? '角色立绘' : type === 'avatar' ? '角色头像' : '场景背景'},请稍候...`);
            
            const response = await fetch('/api/generate-image', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    prompt,
                    type,  // ✅ 后端根据此区分是否需要抠图（type='sprite' 时触发）
                    refImageUrl,
                    refStrength: refImageUrl ? 0.7 : undefined  // 使用参考图时保持70%相似度
                }),
            });
            
            const data = await response.json();
            
            if (!response.ok) {
                // ✅ 显示详细的错误信息
                const errorMessage = data.details || data.error || '图片生成失败';
                console.error('[Editor] 图片生成失败:', {
                    status: response.status,
                    error: data.error,
                    details: data.details,
                    prompt,
                    type
                });
                throw new Error(errorMessage);
            }
            
            if (!data.imageUrl) {
                throw new Error('未返回图片URL');
            }
            
            toast.success('生成成功', `${type === 'sprite' ? '角色立绘' : type === 'avatar' ? '角色头像' : '场景背景'}已生成 ✨`);
            return {
                imageUrl: data.imageUrl,
                maskUrl: data.maskUrl,  // ✅ 返回 maskUrl（如果有）
            };
        } catch (error) {
            console.error('[Editor] 图片生成失败:', error);
            toast.error('生成失败', error instanceof Error ? error.message : '请重试');
            throw error;
        }
    };
    
    // 重新生成角色立绘
    const handleRegenerateSprite = async (character: any) => {
        if (isGeneratingSprite || !project) return;
        
        setIsGeneratingSprite(true);
        try {
            const prompt = `${character.displayName || character.name}, ${character.description}, 全身立绘, 动漫风格, 纯白色背景, 人物居中, 高质量`;
            // ✅ 不使用参考图,让后端走抠图流程 generateSpriteWithTransparency
            const result = await handleGenerateImage(character.id, prompt, undefined, 'sprite');
            
            // 更新项目数据
            const updatedCharacters = project.characters?.map(c => {
                if (c.id === character.id) {
                    const newSprite = {
                        id: `sprite-${Date.now()}`,
                        emotion: 'neutral' as const,
                        imageUrl: result.imageUrl,
                        maskUrl: result.maskUrl,  // ✅ 保存 maskUrl
                    };
                    return {
                        ...c,
                        sprites: [newSprite, ...(c.sprites || [])],
                        defaultSpriteId: newSprite.id,
                    };
                }
                return c;
            });
            
            setProject({ ...project, characters: updatedCharacters } as GameProject);
            setSelectedCharacter({ ...character, sprites: updatedCharacters?.find(c => c.id === character.id)?.sprites });
            toast.success('立绘重新生成', '已替换为最新的立绘');
        } catch (error) {
            console.error('[Editor] 立绘重新生成失败:', error);
        } finally {
            setIsGeneratingSprite(false);
        }
    };
    
    // 重新生成角色头像
    const handleRegenerateAvatar = async (character: any) => {
        if (isGeneratingAvatar || !project) return;
        
        setIsGeneratingAvatar(true);
        try {
            const prompt = `${character.displayName || character.name}, ${character.description}, 头像特写, 圆形头像, 动漫风格, 纯白色背景, 简洁, 高质量`;
            // 如果有立绘，使用立绘作为参考图
            const refImageUrl = character.sprites?.[0]?.imageUrl;
            const result = await handleGenerateImage(character.id, prompt, refImageUrl, 'avatar');
            
            // 更新项目数据
            const updatedCharacters = project.characters?.map(c => {
                if (c.id === character.id) {
                    return { ...c, avatarUrl: result.imageUrl };
                }
                return c;
            });
            
            setProject({ ...project, characters: updatedCharacters } as GameProject);
            setSelectedCharacter({ ...character, avatarUrl: result.imageUrl });
            toast.success('头像重新生成', '已替换为最新的头像');
        } catch (error) {
            console.error('[Editor] 头像重新生成失败:', error);
        } finally {
            setIsGeneratingAvatar(false);
        }
    };
    
    // 重新生成场景背景
    const handleRegenerateBackground = async (background: any) => {
        if (isGeneratingBackground || !project) return;
        
        setIsGeneratingBackground(true);
        try {
            const prompt = `${background.name}, ${background.description || ''}, 场景背景, 动漫风格, 高质量, 细节丰富`;
            const result = await handleGenerateImage(background.id, prompt, undefined, 'background');
            
            // 更新项目数据
            const updatedBackgrounds = project.backgrounds?.map(bg => {
                if (bg.id === background.id) {
                    return { ...bg, imageUrl: result.imageUrl };
                }
                return bg;
            });
            
            setProject({ ...project, backgrounds: updatedBackgrounds } as GameProject);
            setSelectedBackground({ ...background, imageUrl: result.imageUrl });
            toast.success('背景重新生成', '已替换为最新的背景');
        } catch (error) {
            console.error('[Editor] 背景重新生成失败:', error);
        } finally {
            setIsGeneratingBackground(false);
        }
    };
    
    // 删除角色立绘
    const handleDeleteSprite = async (character: any, spriteId: string) => {
        if (!project) return;
        
        try {
            // 更新项目数据
            const updatedCharacters = project.characters?.map(c => {
                if (c.id === character.id) {
                    const remainingSprites = (c.sprites || []).filter(s => s.id !== spriteId);
                    return {
                        ...c,
                        sprites: remainingSprites,
                        // 如果删除的是默认立绘，更新默认立绘ID
                        defaultSpriteId: c.defaultSpriteId === spriteId 
                            ? (remainingSprites[0]?.id || undefined)
                            : c.defaultSpriteId,
                    };
                }
                return c;
            });
            
            setProject({ ...project, characters: updatedCharacters } as GameProject);
            setSelectedCharacter({ ...character, sprites: updatedCharacters?.find(c => c.id === character.id)?.sprites });
            toast.success('删除成功', '立绘已删除');
        } catch (error) {
            console.error('[Editor] 立绘删除失败:', error);
            toast.error('删除失败', '请重试');
        }
    };
    
    // ✅ 格式化最后保存时间
    const formatLastSaveTime = () => {
        if (!lastSaveTime) return '未保存';
        const now = new Date();
        const diff = Math.floor((now.getTime() - lastSaveTime.getTime()) / 1000);  // 秒
        
        if (diff < 60) return `${diff}秒前`;
        if (diff < 3600) return `${Math.floor(diff / 60)}分钟前`;
        return lastSaveTime.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
    };
    
    // ✅ 为 FlowEditor 提供的包装函数（只返回 imageUrl）
    const handleGenerateImageForEditor = async (
        characterId: string,
        prompt: string,
        refImageUrl?: string,
        type?: 'sprite' | 'avatar' | 'background'
    ): Promise<string> => {
        const result = await handleGenerateImage(characterId, prompt, refImageUrl, type);
        return result.imageUrl;
    };

    if (loading) {
        return (
            <div className="flex h-screen w-full items-center justify-center bg-gradient-to-br from-slate-50 via-indigo-50 to-purple-50">
                <div className="flex flex-col items-center gap-6 p-8 bg-white rounded-3xl shadow-2xl border-2 border-slate-200">
                    <div className="relative">
                        <div className="w-16 h-16 rounded-full bg-gradient-to-r from-indigo-500 to-pink-500 animate-pulse" />
                        <Loader2 className="absolute inset-0 m-auto h-10 w-10 animate-spin text-white" />
                    </div>
                    <div className="text-center">
                        <p className="text-lg font-semibold text-slate-800 mb-1">加载项目中...</p>
                        <p className="text-sm text-slate-500">请稍候</p>
                    </div>
                </div>
            </div>
        );
    }

    if (!project) {
        return (
            <div className="flex h-screen w-full items-center justify-center bg-gradient-to-br from-slate-50 via-indigo-50 to-purple-50">
                <div className="flex flex-col items-center gap-6 p-8 bg-white rounded-3xl shadow-2xl border-2 border-slate-200 max-w-md">
                    <div className="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center">
                        <AlertCircle className="h-8 w-8 text-red-500" />
                    </div>
                    <div className="text-center">
                        <p className="text-xl font-bold text-slate-800 mb-2">项目加载失败</p>
                        <p className="text-sm text-slate-500 mb-4">无法加载指定的项目数据</p>
                        <a 
                            href="/" 
                            className="inline-flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 text-white rounded-lg transition-all shadow-lg"
                        >
                            <Home className="w-4 h-4" />
                            返回首页
                        </a>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="flex h-screen w-full flex-col bg-gradient-to-br from-slate-50 via-indigo-50 to-purple-50">
            {/* Header - 现代化工具栏 */}
            <header className="flex h-16 items-center justify-between border-b border-slate-200 bg-white px-6 shadow-md">
                <div className="flex items-center gap-4">
                    <a href="/" className="text-slate-600 hover:text-slate-800 transition-colors">
                        <Home className="h-5 w-5" />
                    </a>
                    <div className="h-8 w-px bg-slate-300" />
                    <div>
                        <div className="font-bold text-xl bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">{project.title}</div>
                        {projectId && (
                            <div className="text-xs text-slate-500">ID: {projectId}</div>
                        )}
                    </div>
                </div>
                
                {/* Error notification */}
                {error && (
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-amber-50 text-amber-700 text-sm border border-amber-200">
                        <AlertCircle className="h-4 w-4" />
                        <span>使用演示数据 (项目未找到)</span>
                    </div>
                )}
                
                <div className="flex gap-2 items-center">
                    {/* ✅ 最后保存时间 */}
                    {projectId && (
                        <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 rounded-lg border border-slate-200 text-slate-600 text-xs">
                            <Clock className="w-3 h-3" />
                            <span>最后保存: {formatLastSaveTime()}</span>
                        </div>
                    )}
                    
                    {/* ✅ 手动保存按钮 */}
                    {projectId && (
                        <Button
                            variant="outline"
                            onClick={() => setShowSaveNoteDialog(true)}
                            disabled={isSaving}
                            className="border-slate-300 hover:bg-slate-50 text-slate-700 font-medium"
                        >
                            <Save className="w-4 h-4 mr-1" />
                            {isSaving ? '保存中...' : '保存'}
                        </Button>
                    )}
                    
                    <Button
                        variant="outline"
                        onClick={() => setActiveTab('editor')}
                        className="border-slate-300 hover:bg-slate-50 text-slate-700 font-medium"
                    >
                        📝 脚本编辑器
                    </Button>
                    
                    {/* ✅ 预览游戏下拉菜单 */}
                    <div className="relative preview-menu-container">
                        <Button
                            variant="outline"
                            onClick={() => {
                                // ✅ 如果已经在预览页面,直接打开菜单切换模式
                                // 如果不在预览页面,也打开菜单选择模式
                                setShowPreviewMenu(!showPreviewMenu);
                            }}
                            className="border-slate-300 hover:bg-slate-50 text-slate-700 font-medium"
                        >
                            ▶️ 预览游戏 ▼
                        </Button>
                        
                        {/* 下拉菜单 */}
                        {showPreviewMenu && (
                            <div className="absolute top-full mt-1 right-0 bg-white rounded-lg shadow-xl border border-slate-200 overflow-hidden z-50 min-w-[200px]">
                                <button
                                    onClick={() => {
                                        setPreviewMode('from-start');
                                        setActiveTab('preview');
                                        setShowPreviewMenu(false);
                                        setPreviewKey(prev => prev + 1);  // ✅ 强制重新挂载
                                    }}
                                    className="w-full px-4 py-3 text-left hover:bg-indigo-50 transition-colors border-b border-slate-100 flex items-center gap-3"
                                >
                                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white">
                                        🏁
                                    </div>
                                    <div>
                                        <div className="font-semibold text-slate-800">从头预览</div>
                                        <div className="text-xs text-slate-500">从开始节点的开头开始</div>
                                    </div>
                                </button>
                                <button
                                    onClick={() => {
                                        if (!selectedNodeId) {
                                            toast.warning('请先在编辑器中选中一个节点');
                                            setShowPreviewMenu(false);
                                            return;
                                        }
                                        setPreviewMode('from-current');
                                        setActiveTab('preview');
                                        setShowPreviewMenu(false);
                                        setPreviewKey(prev => prev + 1);  // ✅ 强制重新挂载
                                    }}
                                    disabled={!selectedNodeId}
                                    className="w-full px-4 py-3 text-left hover:bg-green-50 transition-colors flex items-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center text-white">
                                        ▶️
                                    </div>
                                    <div>
                                        <div className="font-semibold text-slate-800">从当前节点预览</div>
                                        <div className="text-xs text-slate-500">
                                            {selectedNodeId ? `从节点 ${selectedNodeId} 的开头开始` : '请先选择节点'}
                                        </div>
                                    </div>
                                </button>
                            </div>
                        )}
                    </div>
                    
                    <div className="relative export-menu-container group">
                        <Button 
                            variant="outline"
                            className="border-slate-300 hover:bg-slate-50 text-slate-700 font-medium"
                        >
                            📦 导出 ▼
                        </Button>
                        <div className="absolute top-full right-0 mt-1 hidden group-hover:block bg-white rounded-lg shadow-xl border border-slate-200 overflow-hidden z-50 min-w-[200px]">
                            <button
                                onClick={() => {
                                    if (project) {
                                        exportProjectAsJson(project);
                                        toast.success('导出成功', '项目 JSON 文件已下载');
                                    }
                                }}
                                className="w-full px-4 py-3 text-left hover:bg-slate-50 transition-colors border-b border-slate-100 flex items-center gap-3"
                            >
                                <div className="w-8 h-8 rounded bg-slate-100 flex items-center justify-center text-xl">📄</div>
                                <div>
                                    <div className="font-semibold text-slate-800">导出 JSON</div>
                                    <div className="text-xs text-slate-500">项目源文件，用于备份或导入</div>
                                    </div>
                            </button>
                            <button
                                onClick={() => {
                                    if (project) {
                                        toast.info('正在打包', '正在生成独立可玩 HTML 文件...');
                                        exportProjectAsPlayableHtml(project)
                                            .then(() => toast.success('导出成功', '独立游戏文件已下载'))
                                            .catch(() => toast.error('导出失败', '请重试'));
                                    }
                                }}
                                className="w-full px-4 py-3 text-left hover:bg-slate-50 transition-colors border-b border-slate-100 flex items-center gap-3"
                            >
                                <div className="w-8 h-8 rounded bg-slate-100 flex items-center justify-center text-xl">🎮</div>
                                <div>
                                    <div className="font-semibold text-slate-800">导出 HTML 游戏</div>
                                    <div className="text-xs text-slate-500">单文件播放器，图片需联网加载</div>
                                </div>
                            </button>
                            <button
                                onClick={async () => {
                                    if (project) {
                                        setExportProgress({ show: true, current: 0, total: 100, message: '准备导出...' });
                                        try {
                                            await exportProjectAsPlayableHtmlWithImages(
                                                project,
                                                (current, total, message) => {
                                                    setExportProgress({ show: true, current, total, message });
                                                }
                                            );
                                            toast.success('导出成功', '完全离线的游戏文件已下载');
                                        } catch (error) {
                                            toast.error('导出失败', '请重试');
                                        } finally {
                                            setTimeout(() => setExportProgress({ show: false, current: 0, total: 100, message: '' }), 1000);
                                        }
                                    }
                                }}
                                className="w-full px-4 py-3 text-left hover:bg-slate-50 transition-colors flex items-center gap-3"
                            >
                                <div className="w-8 h-8 rounded bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center text-white text-sm">📦</div>
                                <div>
                                    <div className="font-semibold text-slate-800">导出 HTML 游戏 (含图片)</div>
                                    <div className="text-xs text-slate-500">内嵌所有资源，完全离线可玩</div>
                                </div>
                            </button>
                        </div>
                    </div>
                </div>
            </header>

            {/* Project Info Bar - 美化 + 下拉预览 */}
            <div className="flex h-12 items-center justify-between border-b border-slate-200 bg-white px-6 text-sm">
                <div className="flex gap-6">
                    {/* ✅ 角色下拉 */}
                    <div className="relative dropdown-container">
                        <span 
                            className="flex items-center gap-2 cursor-pointer hover:bg-slate-50 px-3 py-1.5 rounded transition-colors" 
                            title="查看角色列表"
                            onClick={() => {
                                setShowCharactersDropdown(!showCharactersDropdown);
                                setShowScenesDropdown(false);
                                setShowNodesDropdown(false);
                            }}
                        >
                            <div className="w-2 h-2 rounded-full bg-indigo-500" />
                            <strong className="text-slate-700">{project.characters?.length || 0}</strong>
                            <span className="text-slate-500">角色</span>
                            <span className="text-slate-400 text-xs">▼</span>
                        </span>
                        {showCharactersDropdown && (
                            <div className="absolute top-full mt-1 left-0 bg-white rounded-lg shadow-xl border border-slate-200 overflow-hidden z-50 min-w-[280px] max-h-[400px] overflow-y-auto">
                                {project.characters && project.characters.length > 0 ? (
                                    project.characters.map((char, idx) => (
                                        <div 
                                            key={idx} 
                                            className="px-4 py-3 hover:bg-indigo-50 transition-colors border-b border-slate-100 last:border-0 cursor-pointer"
                                            onClick={() => {
                                                setSelectedCharacter(char);
                                                setShowCharactersDropdown(false);
                                            }}
                                        >
                                            <div className="flex items-center gap-3">
                                                {char.avatarUrl ? (
                                                    <img src={char.avatarUrl} alt={char.name} className="w-10 h-10 rounded-full object-cover flex-shrink-0" />
                                                ) : (
                                                    <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-semibold flex-shrink-0">
                                                        {char.name.charAt(0)}
                                                    </div>
                                                )}
                                                <div className="flex-1 min-w-0">
                                                    <div className="font-semibold text-slate-800">{char.name}</div>
                                                    <div className="text-xs text-slate-500 line-clamp-1">
                                                        {char.description || 
                                                         (typeof char.personality === 'string' ? char.personality : 
                                                          char.personality?.traits?.join('、') || '暂无描述')}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <div className="px-4 py-6 text-center text-slate-400 text-sm">暂无角色</div>
                                )}
                            </div>
                        )}
                    </div>
                    
                    {/* ✅ 场景下拉 */}
                    <div className="relative dropdown-container">
                        <span 
                            className="flex items-center gap-2 cursor-pointer hover:bg-slate-50 px-3 py-1.5 rounded transition-colors" 
                            title="查看场景列表"
                            onClick={() => {
                                setShowScenesDropdown(!showScenesDropdown);
                                setShowCharactersDropdown(false);
                                setShowNodesDropdown(false);
                            }}
                        >
                            <div className="w-2 h-2 rounded-full bg-purple-500" />
                            <strong className="text-slate-700">{project.backgrounds?.length || 0}</strong>
                            <span className="text-slate-500">场景</span>
                            <span className="text-slate-400 text-xs">▼</span>
                        </span>
                        {showScenesDropdown && (
                            <div className="absolute top-full mt-1 left-0 bg-white rounded-lg shadow-xl border border-slate-200 overflow-hidden z-50 min-w-[280px] max-h-[400px] overflow-y-auto">
                                {project.backgrounds && project.backgrounds.length > 0 ? (
                                    project.backgrounds.map((bg, idx) => (
                                        <div 
                                            key={idx} 
                                            className="px-4 py-3 hover:bg-purple-50 transition-colors border-b border-slate-100 last:border-0 cursor-pointer"
                                            onClick={() => {
                                                setSelectedBackground(bg);
                                                setShowScenesDropdown(false);
                                            }}
                                        >
                                            <div className="flex items-center gap-3">
                                                {bg.imageUrl ? (
                                                    <img 
                                                        src={bg.imageUrl} 
                                                        alt={bg.name} 
                                                        className="w-16 h-10 rounded object-cover flex-shrink-0" 
                                                    />
                                                ) : (
                                                    <div className="w-16 h-10 rounded bg-purple-100 flex items-center justify-center text-purple-600 text-xs flex-shrink-0">
                                                        🏞️
                                                    </div>
                                                )}
                                                <div className="flex-1 min-w-0">
                                                    <div className="font-semibold text-slate-800">{bg.name}</div>
                                                    <div className="text-xs text-slate-500 line-clamp-1">{bg.description || '暂无描述'}</div>
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <div className="px-4 py-6 text-center text-slate-400 text-sm">暂无场景</div>
                                )}
                            </div>
                        )}
                    </div>
                    
                    {/* ✅ 故事情节下拉 */}
                    <div className="relative dropdown-container">
                        <span 
                            className="flex items-center gap-2 cursor-pointer hover:bg-slate-50 px-3 py-1.5 rounded transition-colors" 
                            title="查看故事情节列表"
                            onClick={() => {
                                setShowNodesDropdown(!showNodesDropdown);
                                setShowCharactersDropdown(false);
                                setShowScenesDropdown(false);
                            }}
                        >
                            <div className="w-2 h-2 rounded-full bg-pink-500" />
                            <strong className="text-slate-700">{project.script?.length || 0}</strong>
                            <span className="text-slate-500">故事情节</span>
                            <span className="text-slate-400 text-xs">▼</span>
                        </span>
                        {showNodesDropdown && (
                            <div className="absolute top-full mt-1 left-0 bg-white rounded-lg shadow-xl border border-slate-200 overflow-hidden z-50 min-w-[320px] max-h-[400px] overflow-y-auto">
                                {project.script && project.script.length > 0 ? (
                                    project.script.map((node: any, idx) => (
                                        <div 
                                            key={idx} 
                                            className="px-4 py-3 hover:bg-pink-50 transition-colors border-b border-slate-100 last:border-0 cursor-pointer"
                                            onClick={() => {
                                                setSelectedNodeId(node.id);
                                                setActiveTab('editor');
                                                setShowNodesDropdown(false);
                                            }}
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded bg-gradient-to-br from-pink-500 to-pink-600 flex items-center justify-center text-white text-xs font-semibold">
                                                    {idx + 1}
                                                </div>
                                                <div className="flex-1">
                                                    <div className="font-semibold text-slate-800">{node.title || `节点 ${node.id}`}</div>
                                                    <div className="text-xs text-slate-500">
                                                        {node.sceneName && <span className="text-purple-600">📍 {node.sceneName}</span>}
                                                        {node.isStart && <span className="ml-2 text-green-600">🟢 开头</span>}
                                                        {node.isEnding && <span className="ml-2 text-red-600">🔴 结尾</span>}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <div className="px-4 py-6 text-center text-slate-400 text-sm">暂无故事情节</div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
                <div className="flex gap-4 text-slate-600">
                    <span className="flex items-center gap-1.5 px-2 py-1 bg-slate-50 rounded" title="故事类型">
                        <span>🎭</span>
                        <span className="text-sm">
                            {(() => {
                                const genre = project.meta?.genre || '未设定';
                                // ✅ 将英文genre转为中文
                                const genreMap: Record<string, string> = {
                                    'romance': '言情',
                                    'fantasy': '奇幻',
                                    'slice-of-life': '日常',
                                    'mystery': '悬疑',
                                    'horror': '恐怖',
                                    'action': '动作',
                                    'comedy': '喜剧',
                                    'drama': '剧情',
                                    'sci-fi': '科幻',
                                    'adventure': '冒险',
                                };
                                // 处理多个类型，用|分隔
                                return genre.split('|').map(g => genreMap[g.trim()] || g.trim()).join('、');
                            })()}
                        </span>
                    </span>
                    <span className="flex items-center gap-1.5 px-2 py-1 bg-slate-50 rounded" title="美术风格">
                        <span>🎨</span>
                        <span className="text-sm">
                            {(() => {
                                const artStyle = project.meta?.artStyle || '未设定';
                                // ✅ 将英文artStyle转为中文
                                const styleMap: Record<string, string> = {
                                    'anime': '动漫',
                                    'realistic': '写实',
                                    'pixel': '像素',
                                    'watercolor': '水彩',
                                    'cartoon': '卡通',
                                    'sketch': '素描',
                                    '2d': '2D',
                                    '3d': '3D',
                                };
                                return styleMap[artStyle.trim()] || artStyle;
                            })()}
                        </span>
                    </span>
                </div>
            </div>

            {/* Main Content */}
            <main className="flex-1 overflow-hidden">
                {activeTab === 'editor' ? (
                    <ReactFlowProvider>
                        <FlowEditor 
                            project={project} 
                            onUpdate={(updatedProject) => {
                                setProject(updatedProject);
                                // ✅ 不再在这里自动保存,由定时器处理
                            }}
                            onSelectNode={setSelectedNodeId}  // ✅ 传递选中节点回调
                            onGenerateImage={handleGenerateImageForEditor}  // ✅ 传递AI生成立绘回调
                        />
                    </ReactFlowProvider>
                ) : (
                    <div className="flex flex-col h-full">
                        {/* 游戏预览区 */}
                        <div className="flex-1 flex items-center justify-center p-8 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
                            <div className="w-full max-w-6xl">
                                {/* ✅ 顶部提示条 - 显示当前预览模式 */}
                                <div className="mb-4 px-4 py-2 bg-slate-800/80 backdrop-blur-sm rounded-lg border border-slate-700/50 flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className={`w-2 h-2 rounded-full ${
                                            previewMode === 'from-start' ? 'bg-blue-500' : 'bg-green-500'
                                        } animate-pulse`} />
                                        <span className="text-sm text-slate-300">
                                            {previewMode === 'from-start' 
                                                ? '🏁 从开始节点的开头预览' 
                                                : `▶️ 从节点 ${selectedNodeId} 的开头预览`}
                                        </span>
                                    </div>
                                    <div className="flex gap-2">
                                        {/* ✅ 快捷切换按钮 */}
                                        <button
                                            onClick={() => {
                                                setPreviewMode('from-start');
                                                setPreviewKey(prev => prev + 1);  // ✅ 强制重新挂载
                                            }}
                                            className={`px-3 py-1 rounded text-xs transition-all ${
                                                previewMode === 'from-start'
                                                    ? 'bg-blue-500 text-white'
                                                    : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                                            }`}
                                        >
                                            🏁 从头
                                        </button>
                                        <button
                                            onClick={() => {
                                                if (!selectedNodeId) {
                                                    toast.warning('请先在编辑器中选中一个节点');
                                                    return;
                                                }
                                                setPreviewMode('from-current');
                                                setPreviewKey(prev => prev + 1);  // ✅ 强制重新挂载
                                            }}
                                            disabled={!selectedNodeId}
                                            className={`px-3 py-1 rounded text-xs transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
                                                previewMode === 'from-current'
                                                    ? 'bg-green-500 text-white'
                                                    : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                                            }`}
                                        >
                                            ▶️ 从当前
                                        </button>
                                    </div>
                                </div>
                                
                                <Card className="aspect-video w-full overflow-hidden border-0 shadow-2xl ring-1 ring-white/10">
                                    <GamePlayer
                                        key={previewKey}  // ✅ 通过key强制重新挂载
                                        project={project}
                                        startNodeId={previewMode === 'from-current' ? selectedNodeId || undefined : undefined}
                                    />
                                </Card>
                            </div>
                        </div>
                    </div>
                )}
            </main>
            
            {/* ✅ 保存备注对话框 */}
            {showSaveNoteDialog && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 border border-slate-200">
                        <h3 className="text-xl font-bold text-slate-800 mb-4">💾 保存项目</h3>
                        <p className="text-sm text-slate-600 mb-4">添加版本备注(可选),方便后续查看和管理</p>
                        
                        <input
                            type="text"
                            placeholder="例如: 调整分支逻辑、添加新场景...或留空"
                            value={saveNote}
                            onChange={(e) => setSaveNote(e.target.value)}
                            className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent mb-6"
                            maxLength={100}
                            autoFocus
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    handleManualSave(saveNote.trim() || undefined);
                                }
                            }}
                        />
                        
                        <div className="flex gap-3">
                            <Button
                                variant="outline"
                                onClick={() => {
                                    setShowSaveNoteDialog(false);
                                    setSaveNote('');
                                }}
                                className="flex-1"
                            >
                                取消
                            </Button>
                            <Button
                                onClick={() => handleManualSave(saveNote.trim() || undefined)}
                                disabled={isSaving}
                                className="flex-1 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700"
                            >
                                <Save className="w-4 h-4 mr-1" />
                                {isSaving ? '保存中...' : '确定保存'}
                            </Button>
                        </div>
                    </div>
                </div>
            )}
            
            {/* ✅ 导出进度对话框 */}
            {exportProgress.show && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 border border-slate-200">
                        <h3 className="text-xl font-bold text-slate-800 mb-4">📦 正在导出</h3>
                        
                        {/* 进度条 */}
                        <div className="mb-4">
                            <div className="flex justify-between text-sm text-slate-600 mb-2">
                                <span>{exportProgress.message}</span>
                                <span>{exportProgress.current}%</span>
                            </div>
                            <div className="w-full h-3 bg-slate-200 rounded-full overflow-hidden">
                                <div 
                                    className="h-full bg-gradient-to-r from-green-500 to-green-600 transition-all duration-300 ease-out"
                                    style={{ width: `${exportProgress.current}%` }}
                                />
                            </div>
                        </div>
                        
                        <p className="text-xs text-slate-500">
                            正在将所有图片转换为 Base64 并内嵌到 HTML 中...
                        </p>
                    </div>
                </div>
            )}
            
            {/* ✅ 角色立绘查看弹窗 */}
            {selectedCharacter && (
                <div 
                    className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
                    onClick={() => setSelectedCharacter(null)}
                >
                    <div 
                        className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full p-6 border border-slate-200"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-start justify-between mb-6 gap-4">
                            <div className="flex items-center gap-4 flex-1 min-w-0">
                                {selectedCharacter.avatarUrl && (
                                    <img src={selectedCharacter.avatarUrl} alt={selectedCharacter.name} className="w-16 h-16 rounded-full object-cover flex-shrink-0" />
                                )}
                                <div className="flex-1 min-w-0">
                                    <h3 className="text-2xl font-bold text-slate-800">{selectedCharacter.name}</h3>
                                    <p className="text-sm text-slate-500">
                                        {selectedCharacter.description || 
                                         (typeof selectedCharacter.personality === 'string' ? selectedCharacter.personality : 
                                          selectedCharacter.personality?.traits?.join('、') || '暂无描述')}
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={() => setSelectedCharacter(null)}
                                className="text-slate-400 hover:text-slate-600 transition-colors text-2xl leading-none flex-shrink-0"
                            >
                                ✕
                            </button>
                        </div>
                        
                        {/* ✅ 操作按钮区 - 分两行显示 */}
                        <div className="mb-6 space-y-3">
                            {/* 第一行：头像相关 */}
                            <div className="flex items-center gap-3">
                                <div className="flex items-center gap-2 flex-1">
                                    <span className="text-sm font-medium text-slate-600 whitespace-nowrap">👤 头像：</span>
                                    <button
                                        onClick={() => handleRegenerateAvatar(selectedCharacter)}
                                        disabled={isGeneratingAvatar}
                                        className="flex-1 px-4 py-2.5 bg-white border-2 border-blue-200 text-slate-700 text-sm rounded-lg hover:border-blue-400 hover:bg-blue-50 transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-slate-50"
                                    >
                                        📷 {isGeneratingAvatar ? '生成中...' : 'AI生成'}
                                    </button>
                                    <button
                                        onClick={() => {
                                            setShowAvatarUrlInput(!showAvatarUrlInput);
                                            setShowSpriteUrlInput(false);
                                            setAvatarUrlValue('');
                                        }}
                                        className="flex-1 px-4 py-2.5 bg-white border-2 border-green-200 text-slate-700 text-sm rounded-lg hover:border-green-400 hover:bg-green-50 transition-all shadow-sm"
                                    >
                                        🔗 URL添加
                                    </button>
                                </div>
                            </div>
                            
                            {/* 第二行：立绘相关 */}
                            <div className="flex items-center gap-3">
                                <div className="flex items-center gap-2 flex-1">
                                    <span className="text-sm font-medium text-slate-600 whitespace-nowrap">🖼️ 立绘：</span>
                                    <button
                                        onClick={() => handleRegenerateSprite(selectedCharacter)}
                                        disabled={isGeneratingSprite}
                                        className="flex-1 px-4 py-2.5 bg-white border-2 border-purple-200 text-slate-700 text-sm rounded-lg hover:border-purple-400 hover:bg-purple-50 transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-slate-50"
                                    >
                                        ✨ {isGeneratingSprite ? '生成中...' : 'AI生成'}
                                    </button>
                                    <button
                                        onClick={() => {
                                            setShowSpriteUrlInput(!showSpriteUrlInput);
                                            setShowAvatarUrlInput(false);
                                            setSpriteUrlValue('');
                                        }}
                                        className="flex-1 px-4 py-2.5 bg-white border-2 border-orange-200 text-slate-700 text-sm rounded-lg hover:border-orange-400 hover:bg-orange-50 transition-all shadow-sm"
                                    >
                                        🔗 URL添加
                                    </button>
                                </div>
                            </div>
                        </div>
                        
                        {/* ✅ 头像URL输入框 */}
                        {showAvatarUrlInput && (
                            <div className="mb-4 p-4 bg-green-50 rounded-lg border border-green-200">
                                <label className="block text-sm font-medium text-slate-700 mb-2">输入头像图片URL</label>
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        value={avatarUrlValue}
                                        onChange={(e) => setAvatarUrlValue(e.target.value)}
                                        placeholder="https://example.com/avatar.png"
                                        className="flex-1 px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' && avatarUrlValue.trim()) {
                                                const url = avatarUrlValue.trim();
                                                const updatedCharacters = project.characters?.map(c => {
                                                    if (c.id === selectedCharacter.id) {
                                                        return { ...c, avatarUrl: url };
                                                    }
                                                    return c;
                                                });
                                                setProject({ ...project, characters: updatedCharacters } as GameProject);
                                                setSelectedCharacter({ ...selectedCharacter, avatarUrl: url });
                                                toast.success('头像添加成功', '已更新为指定URL的图片');
                                                setShowAvatarUrlInput(false);
                                                setAvatarUrlValue('');
                                            }
                                        }}
                                    />
                                    <button
                                        onClick={() => {
                                            if (!avatarUrlValue.trim()) {
                                                toast.warning('请输入URL');
                                                return;
                                            }
                                            const url = avatarUrlValue.trim();
                                            const updatedCharacters = project.characters?.map(c => {
                                                if (c.id === selectedCharacter.id) {
                                                    return { ...c, avatarUrl: url };
                                                }
                                                return c;
                                            });
                                            setProject({ ...project, characters: updatedCharacters } as GameProject);
                                            setSelectedCharacter({ ...selectedCharacter, avatarUrl: url });
                                            toast.success('头像添加成功', '已更新为指定URL的图片');
                                            setShowAvatarUrlInput(false);
                                            setAvatarUrlValue('');
                                        }}
                                        className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors whitespace-nowrap"
                                    >
                                        确定
                                    </button>
                                    <button
                                        onClick={() => {
                                            setShowAvatarUrlInput(false);
                                            setAvatarUrlValue('');
                                        }}
                                        className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 transition-colors whitespace-nowrap"
                                    >
                                        取消
                                    </button>
                                </div>
                            </div>
                        )}
                        
                        {/* ✅ 立绘URL输入框 */}
                        {showSpriteUrlInput && (
                            <div className="mb-4 p-4 bg-orange-50 rounded-lg border border-orange-200">
                                <label className="block text-sm font-medium text-slate-700 mb-2">输入立绘图片URL</label>
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        value={spriteUrlValue}
                                        onChange={(e) => setSpriteUrlValue(e.target.value)}
                                        placeholder="https://example.com/sprite.png"
                                        className="flex-1 px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' && spriteUrlValue.trim()) {
                                                const url = spriteUrlValue.trim();
                                                const newSprite = {
                                                    id: `sprite-${Date.now()}`,
                                                    emotion: 'neutral' as const,
                                                    imageUrl: url,
                                                };
                                                const updatedCharacters = project.characters?.map(c => {
                                                    if (c.id === selectedCharacter.id) {
                                                        return {
                                                            ...c,
                                                            sprites: [newSprite, ...(c.sprites || [])],
                                                            defaultSpriteId: c.defaultSpriteId || newSprite.id,
                                                        };
                                                    }
                                                    return c;
                                                });
                                                setProject({ ...project, characters: updatedCharacters } as GameProject);
                                                const updatedChar = updatedCharacters?.find(c => c.id === selectedCharacter.id);
                                                if (updatedChar) {
                                                    setSelectedCharacter(updatedChar);
                                                }
                                                toast.success('立绘添加成功', '已添加到立绘列表');
                                                setShowSpriteUrlInput(false);
                                                setSpriteUrlValue('');
                                            }
                                        }}
                                    />
                                    <button
                                        onClick={() => {
                                            if (!spriteUrlValue.trim()) {
                                                toast.warning('请输入URL');
                                                return;
                                            }
                                            const url = spriteUrlValue.trim();
                                            const newSprite = {
                                                id: `sprite-${Date.now()}`,
                                                emotion: 'neutral' as const,
                                                imageUrl: url,
                                            };
                                            const updatedCharacters = project.characters?.map(c => {
                                                if (c.id === selectedCharacter.id) {
                                                    return {
                                                        ...c,
                                                        sprites: [newSprite, ...(c.sprites || [])],
                                                        defaultSpriteId: c.defaultSpriteId || newSprite.id,
                                                    };
                                                }
                                                return c;
                                            });
                                            setProject({ ...project, characters: updatedCharacters } as GameProject);
                                            const updatedChar = updatedCharacters?.find(c => c.id === selectedCharacter.id);
                                            if (updatedChar) {
                                                setSelectedCharacter(updatedChar);
                                            }
                                            toast.success('立绘添加成功', '已添加到立绘列表');
                                            setShowSpriteUrlInput(false);
                                            setSpriteUrlValue('');
                                        }}
                                        className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors whitespace-nowrap"
                                    >
                                        确定
                                    </button>
                                    <button
                                        onClick={() => {
                                            setShowSpriteUrlInput(false);
                                            setSpriteUrlValue('');
                                        }}
                                        className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 transition-colors whitespace-nowrap"
                                    >
                                        取消
                                    </button>
                                </div>
                            </div>
                        )}
                        
                        {selectedCharacter.sprites && selectedCharacter.sprites.length > 0 ? (
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 max-h-[60vh] overflow-y-auto">
                                {selectedCharacter.sprites.map((sprite: any, idx: number) => (
                                    <div key={idx} className="group relative aspect-[3/4] bg-slate-100 rounded-lg overflow-hidden">
                                        <img 
                                            src={sprite.imageUrl} 
                                            alt={`${selectedCharacter.name} - ${sprite.emotion}`}
                                            className="w-full h-full object-contain"
                                            style={{ mixBlendMode: 'multiply' }}
                                        />
                                        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <span className="text-white text-xs">{sprite.emotion}</span>
                                        </div>
                                        {/* ✅ 删除按钮 */}
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleDeleteSprite(selectedCharacter, sprite.id);
                                            }}
                                            className="absolute top-2 right-2 w-8 h-8 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600 flex items-center justify-center"
                                            title="删除立绘"
                                        >
                                            🗑️
                                        </button>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                                <div className="text-6xl mb-4">🖼️</div>
                                <p className="text-lg">该角色暂无立绘</p>
                                <button
                                    onClick={() => handleRegenerateSprite(selectedCharacter)}
                                    disabled={isGeneratingSprite}
                                    className="mt-4 px-4 py-2 bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {isGeneratingSprite ? '生成中...' : '生成立绘'}
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}
            
            {/* ✅ 场景背景查看弹窗 */}
            {selectedBackground && (
                <div 
                    className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
                    onClick={() => setSelectedBackground(null)}
                >
                    <div 
                        className="bg-white rounded-2xl shadow-2xl max-w-5xl w-full p-6 border border-slate-200"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-start justify-between mb-6 gap-4">
                            <div className="flex-1 min-w-0">
                                <h3 className="text-2xl font-bold text-slate-800">{selectedBackground.name}</h3>
                                <p className="text-sm text-slate-500">{selectedBackground.description || '暂无描述'}</p>
                            </div>
                            <button
                                onClick={() => setSelectedBackground(null)}
                                className="text-slate-400 hover:text-slate-600 transition-colors text-2xl leading-none flex-shrink-0"
                            >
                                ✕
                            </button>
                        </div>
                        
                        {/* ✅ 操作按钮区 */}
                        <div className="mb-6">
                            <div className="flex items-center gap-3">
                                <div className="flex items-center gap-2 flex-1">
                                    <span className="text-sm font-medium text-slate-600 whitespace-nowrap">🌄 背景：</span>
                                    <button
                                        onClick={() => handleRegenerateBackground(selectedBackground)}
                                        disabled={isGeneratingBackground}
                                        className="flex-1 px-4 py-2.5 bg-white border-2 border-purple-200 text-slate-700 text-sm rounded-lg hover:border-purple-400 hover:bg-purple-50 transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-slate-50"
                                    >
                                        ✨ {isGeneratingBackground ? '生成中...' : 'AI生成'}
                                    </button>
                                    <button
                                        onClick={() => {
                                            setShowBackgroundUrlInput(!showBackgroundUrlInput);
                                            setBackgroundUrlValue('');
                                        }}
                                        className="flex-1 px-4 py-2.5 bg-white border-2 border-cyan-200 text-slate-700 text-sm rounded-lg hover:border-cyan-400 hover:bg-cyan-50 transition-all shadow-sm"
                                    >
                                        🔗 URL添加
                                    </button>
                                </div>
                            </div>
                        </div>
                        
                        {/* ✅ 背景URL输入框 */}
                        {showBackgroundUrlInput && (
                            <div className="mb-4 p-4 bg-cyan-50 rounded-lg border border-cyan-200">
                                <label className="block text-sm font-medium text-slate-700 mb-2">输入背景图片URL</label>
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        value={backgroundUrlValue}
                                        onChange={(e) => setBackgroundUrlValue(e.target.value)}
                                        placeholder="https://example.com/background.png"
                                        className="flex-1 px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500"
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' && backgroundUrlValue.trim()) {
                                                const url = backgroundUrlValue.trim();
                                                const updatedBackgrounds = project.backgrounds?.map(bg => {
                                                    if (bg.id === selectedBackground.id) {
                                                        return { ...bg, imageUrl: url };
                                                    }
                                                    return bg;
                                                });
                                                setProject({ ...project, backgrounds: updatedBackgrounds } as GameProject);
                                                setSelectedBackground({ ...selectedBackground, imageUrl: url });
                                                toast.success('背景添加成功', '已更新为指定URL的图片');
                                                setShowBackgroundUrlInput(false);
                                                setBackgroundUrlValue('');
                                            }
                                        }}
                                    />
                                    <button
                                        onClick={() => {
                                            if (!backgroundUrlValue.trim()) {
                                                toast.warning('请输入URL');
                                                return;
                                            }
                                            const url = backgroundUrlValue.trim();
                                            const updatedBackgrounds = project.backgrounds?.map(bg => {
                                                if (bg.id === selectedBackground.id) {
                                                    return { ...bg, imageUrl: url };
                                                }
                                                return bg;
                                            });
                                            setProject({ ...project, backgrounds: updatedBackgrounds } as GameProject);
                                            setSelectedBackground({ ...selectedBackground, imageUrl: url });
                                            toast.success('背景添加成功', '已更新为指定URL的图片');
                                            setShowBackgroundUrlInput(false);
                                            setBackgroundUrlValue('');
                                        }}
                                        className="px-4 py-2 bg-cyan-500 text-white rounded-lg hover:bg-cyan-600 transition-colors whitespace-nowrap"
                                    >
                                        确定
                                    </button>
                                    <button
                                        onClick={() => {
                                            setShowBackgroundUrlInput(false);
                                            setBackgroundUrlValue('');
                                        }}
                                        className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 transition-colors whitespace-nowrap"
                                    >
                                        取消
                                    </button>
                                </div>
                            </div>
                        )}
                        
                        {selectedBackground.imageUrl ? (
                            <div className="bg-slate-100 rounded-lg overflow-hidden max-h-[70vh]">
                                <img 
                                    src={selectedBackground.imageUrl} 
                                    alt={selectedBackground.name}
                                    className="w-full h-full object-contain"
                                />
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center py-12 text-slate-400 bg-slate-100 rounded-lg">
                                <div className="text-6xl mb-4">🏞️</div>
                                <p className="text-lg">该场景暂无背景图</p>
                                <button
                                    onClick={() => handleRegenerateBackground(selectedBackground)}
                                    disabled={isGeneratingBackground}
                                    className="mt-4 px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {isGeneratingBackground ? '生成中...' : '生成背景'}
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

// 默认导出：用 Suspense 包裹以支持 useSearchParams
export default function EditorPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen bg-gradient-to-br from-slate-50 via-indigo-50 to-purple-50 flex items-center justify-center">
                <div className="text-slate-600 text-center">
                    <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-indigo-500" />
                    <p className="font-medium">加载编辑器中...</p>
                </div>
            </div>
        }>
            <EditorPageContent />
        </Suspense>
    );
}
