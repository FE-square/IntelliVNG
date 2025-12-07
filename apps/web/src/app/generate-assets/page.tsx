'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button, Card, CardContent, CardHeader, CardTitle, useToast } from '@vng/ui';
import { Wand2, Loader2, Image, Users, MapPin, ArrowRight, SkipForward, CheckCircle2 } from 'lucide-react';
import { GameProject } from '@vng/core';

/**
 * 视觉素材生成页面
 * 在AI生成剧本后，给用户机会一键生成所有视觉素材（立绘、头像、背景图）
 */
function GenerateAssetsPageContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const toast = useToast();
    const projectId = searchParams.get('projectId');

    const [project, setProject] = useState<GameProject | null>(null);
    const [loading, setLoading] = useState(true);
    const [isGenerating, setIsGenerating] = useState(false);
    const [generationProgress, setGenerationProgress] = useState<{
        current: number;
        total: number;
        message: string;
        type: 'avatar' | 'sprite' | 'background' | '';
    }>({ current: 0, total: 0, message: '', type: '' });
    const [completed, setCompleted] = useState(false);
    const [generatingItems, setGeneratingItems] = useState<Array<{
        id: string;
        name: string;
        type: 'avatar' | 'sprite' | 'background';
        status: 'pending' | 'generating' | 'success' | 'error';
        imageUrl?: string;
    }>>([]);

    // 加载项目
    useEffect(() => {
        if (!projectId) {
            toast.error('缺少项目ID');
            router.push('/');
            return;
        }

        const loadProject = async () => {
            try {
                const response = await fetch(`/api/projects/${projectId}`);
                if (!response.ok) {
                    throw new Error('加载项目失败');
                }
                const data = await response.json();
                setProject(data);
            } catch (error) {
                console.error('加载项目失败:', error);
                toast.error('加载项目失败', '请重试');
            } finally {
                setLoading(false);
            }
        };

        loadProject();
    }, [projectId, router, toast]);

    // 统计需要生成的素材数量
    const getAssetsCount = () => {
        if (!project) return { avatars: 0, sprites: 0, backgrounds: 0 };
        
        const avatars = project.characters.filter(c => !c.avatarUrl).length;
        const sprites = project.characters.filter(c => !c.sprites || c.sprites.length === 0).length;
        const backgrounds = project.backgrounds.filter(b => !b.imageUrl).length;
        
        return { avatars, sprites, backgrounds };
    };

    const assetsCount = getAssetsCount();
    const totalAssets = assetsCount.avatars + assetsCount.sprites + assetsCount.backgrounds;

    // 一键生成所有视觉素材（批量并行，限制并发数）
    const handleGenerateAll = async () => {
        if (!project || !projectId) return;

        setIsGenerating(true);
        setGenerationProgress({ current: 0, total: totalAssets, message: '开始批量生成...', type: '' });

        try {
            // 准备生成任务列表
            const tasks: Array<{
                id: string;
                name: string;
                type: 'avatar' | 'sprite' | 'background';
                characterId?: string;
                backgroundId?: string;
                prompt: string;
            }> = [];

            // 收集角色头像任务
            project.characters.forEach(character => {
                if (!character.avatarUrl) {
                    tasks.push({
                        id: `avatar-${character.id}`,
                        name: `${character.displayName} 头像`,
                        type: 'avatar',
                        characterId: character.id,
                        prompt: `${character.displayName}, ${character.description}, 头像特写, 圆形头像, 动漫风格, 纯白色背景, 简洁, 高质量`,
                    });
                }
            });

            // 收集角色立绘任务
            project.characters.forEach(character => {
                if (!character.sprites || character.sprites.length === 0) {
                    tasks.push({
                        id: `sprite-${character.id}`,
                        name: `${character.displayName} 立绘`,
                        type: 'sprite',
                        characterId: character.id,
                        prompt: `${character.displayName}, ${character.description}, 全身立绘, 动漫风格, 纯白色背景, 人物居中, 高质量, 清晰`,
                    });
                }
            });

            // 收集场景背景任务
            project.backgrounds.forEach(background => {
                if (!background.imageUrl) {
                    tasks.push({
                        id: `background-${background.id}`,
                        name: `${background.name} 背景`,
                        type: 'background',
                        backgroundId: background.id,
                        prompt: `${background.name}, ${background.description}, 场景背景图, 横屏1920x1080, 动漫风格, 高质量, 无人物`,
                    });
                }
            });

            // 初始化生成列表
            setGeneratingItems(tasks.map(task => ({
                id: task.id,
                name: task.name,
                type: task.type,
                status: 'pending',
            })));

            let completedCount = 0;

            // 批量处理函数（限制并发数）
            const CONCURRENT_LIMIT = 2; // 每次最多2个并发请求
            const processBatch = async (batchTasks: typeof tasks) => {
                for (let i = 0; i < batchTasks.length; i += CONCURRENT_LIMIT) {
                    const batch = batchTasks.slice(i, i + CONCURRENT_LIMIT);
                    const batchPromises = batch.map(task => generateSingleAsset(task));
                    await Promise.all(batchPromises);
                    
                    // 每批次间隔等待一下，避免请求过快
                    if (i + CONCURRENT_LIMIT < batchTasks.length) {
                        await new Promise(resolve => setTimeout(resolve, 1000));
                    }
                }
            };

            // 生成单个素材的函数
            const generateSingleAsset = async (task: typeof tasks[0]) => {
                // 更新为生成中
                setGeneratingItems(prev => prev.map(item => 
                    item.id === task.id ? { ...item, status: 'generating' } : item
                ));

                try {
                    const response = await fetch('/api/generate-image', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ prompt: task.prompt, type: task.type }),
                    });

                    if (!response.ok) {
                        const errorData = await response.json();
                        throw new Error(errorData.details || errorData.error || '生成失败');
                    }

                    const result = await response.json();
                    
                    if (!result.imageUrl) {
                        throw new Error('未返回图片URL');
                    }
                    
                    // 更新项目数据
                    if (task.type === 'avatar' && task.characterId) {
                        const char = project.characters.find(c => c.id === task.characterId);
                        if (char) {
                            char.avatarUrl = result.imageUrl;
                            console.log(`[GenerateAssets] 已生成头像: ${char.displayName} -> ${result.imageUrl}`);
                        }
                    } else if (task.type === 'sprite' && task.characterId) {
                        const char = project.characters.find(c => c.id === task.characterId);
                        if (char) {
                            const spriteId = `sprite-${task.characterId}-${Date.now()}`;
                            char.sprites = [{
                                id: spriteId,
                                emotion: 'neutral',
                                imageUrl: result.imageUrl,
                            }];
                            char.defaultSpriteId = spriteId;
                            console.log(`[GenerateAssets] 已生成立绘: ${char.displayName} -> ${result.imageUrl}`);
                        }
                    } else if (task.type === 'background' && task.backgroundId) {
                        const bg = project.backgrounds.find(b => b.id === task.backgroundId);
                        if (bg) {
                            bg.imageUrl = result.imageUrl;
                            console.log(`[GenerateAssets] 已生成背景: ${bg.name} -> ${result.imageUrl}`);
                        }
                    }

                    // 更新为成功
                    setGeneratingItems(prev => prev.map(item => 
                        item.id === task.id ? { ...item, status: 'success', imageUrl: result.imageUrl } : item
                    ));

                    completedCount++;
                    setGenerationProgress({
                        current: completedCount,
                        total: tasks.length,
                        message: `已完成 ${completedCount}/${tasks.length}`,
                        type: task.type
                    });
                } catch (error) {
                    console.error(`[GenerateAssets] 生成 ${task.name} 失败:`, error);
                    setGeneratingItems(prev => prev.map(item => 
                        item.id === task.id ? { ...item, status: 'error' } : item
                    ));
                    toast.error(`${task.name} 生成失败`, error instanceof Error ? error.message : '未知错误');
                }
            };

            // 执行批量生成
            await processBatch(tasks);

            // 保存更新后的项目
            setGenerationProgress({
                current: tasks.length,
                total: tasks.length,
                message: '保存项目到后端...',
                type: ''
            });

            console.log('[GenerateAssets] 保存项目数据:', {
                projectId,
                characters: project.characters.map(c => ({ 
                    id: c.id, 
                    name: c.displayName, 
                    avatarUrl: c.avatarUrl, 
                    sprites: c.sprites?.length 
                })),
                backgrounds: project.backgrounds.map(b => ({ 
                    id: b.id, 
                    name: b.name, 
                    imageUrl: b.imageUrl 
                }))
            });

            const saveResponse = await fetch(`/api/projects/${projectId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(project),
            });

            if (!saveResponse.ok) {
                const errorData = await saveResponse.json();
                throw new Error(errorData.error || '保存项目失败');
            }

            const savedData = await saveResponse.json();
            console.log('[GenerateAssets] 项目保存成功:', savedData);

            setCompleted(true);
            
            const successCount = tasks.length - generatingItems.filter(i => i.status === 'error').length;
            if (successCount === tasks.length) {
                toast.success('所有视觉素材生成完成！', '项目已保存，可以进入编辑器了');
            } else {
                toast.warning(`部分素材生成失败`, `成功 ${successCount}/${tasks.length}，可在编辑器中手动生成`);
            }

        } catch (error) {
            console.error('[GenerateAssets] 生成素材失败:', error);
            toast.error('生成失败', error instanceof Error ? error.message : '请重试');
        } finally {
            setIsGenerating(false);
        }
    };

    // 跳过，直接进入编辑器
    const handleSkip = () => {
        router.push(`/editor?projectId=${projectId}`);
    };

    // 进入编辑器
    const handleGoToEditor = () => {
        router.push(`/editor?projectId=${projectId}`);
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100">
                <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
            </div>
        );
    }

    if (!project) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100">
                <Card className="max-w-md">
                    <CardContent className="p-6 text-center">
                        <p className="text-red-600">项目加载失败</p>
                        <Button onClick={() => router.push('/')} className="mt-4">返回首页</Button>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
            <div className="max-w-4xl mx-auto">
                <Card className="shadow-xl">
                    <CardHeader className="bg-gradient-to-r from-indigo-500 to-purple-500 text-white">
                        <CardTitle className="text-2xl flex items-center gap-2">
                            <Wand2 className="w-6 h-6" />
                            视觉素材生成
                        </CardTitle>
                        <p className="text-indigo-100 mt-2">
                            剧本已生成完成！现在可以为 <strong>{project.title}</strong> 生成视觉素材
                        </p>
                    </CardHeader>

                    <CardContent className="p-6 space-y-6">
                        {/* 素材统计 */}
                        {!completed && !isGenerating && (
                            <div className="grid grid-cols-3 gap-4">
                                <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
                                    <CardContent className="p-4 text-center">
                                        <Users className="w-8 h-8 mx-auto mb-2 text-blue-600" />
                                        <p className="text-sm text-gray-600">角色头像</p>
                                        <p className="text-2xl font-bold text-blue-700">{assetsCount.avatars}</p>
                                    </CardContent>
                                </Card>

                                <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
                                    <CardContent className="p-4 text-center">
                                        <Image className="w-8 h-8 mx-auto mb-2 text-purple-600" />
                                        <p className="text-sm text-gray-600">角色立绘</p>
                                        <p className="text-2xl font-bold text-purple-700">{assetsCount.sprites}</p>
                                    </CardContent>
                                </Card>

                                <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
                                    <CardContent className="p-4 text-center">
                                        <MapPin className="w-8 h-8 mx-auto mb-2 text-green-600" />
                                        <p className="text-sm text-gray-600">场景背景</p>
                                        <p className="text-2xl font-bold text-green-700">{assetsCount.backgrounds}</p>
                                    </CardContent>
                                </Card>
                            </div>
                        )}

                        {/* 提示信息 */}
                        {!completed && !isGenerating && totalAssets > 0 && (
                            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                                <p className="text-sm text-amber-800">
                                    💡 <strong>提示：</strong>点击"一键生成"将<strong>批量并行</strong>为所有角色和场景生成视觉素材（每次最多2个并发，避免API限制）。
                                    如果想稍后手动生成，可以点击"跳过"直接进入编辑器。
                                </p>
                            </div>
                        )}

                        {/* 生成进度 */}
                        {isGenerating && (
                            <div className="space-y-4">
                                <div className="bg-gradient-to-r from-indigo-50 to-purple-50 p-6 rounded-lg border border-indigo-200">
                                    <div className="flex items-center gap-3 mb-4">
                                        <Loader2 className="w-5 h-5 animate-spin text-indigo-600" />
                                        <p className="font-medium text-indigo-900">{generationProgress.message}</p>
                                    </div>
                                    
                                    {/* 进度条 */}
                                    <div className="w-full bg-gray-200 rounded-full h-3 mb-2">
                                        <div 
                                            className="bg-gradient-to-r from-indigo-500 to-purple-500 h-3 rounded-full transition-all duration-300"
                                            style={{ width: `${(generationProgress.current / generationProgress.total) * 100}%` }}
                                        />
                                    </div>
                                    <p className="text-sm text-gray-600 text-right">
                                        {generationProgress.current} / {generationProgress.total}
                                    </p>
                                </div>

                                {/* 可视化生成列表 */}
                                <div className="bg-white rounded-lg border border-slate-200 p-4 max-h-96 overflow-y-auto">
                                    <h3 className="font-semibold text-slate-800 mb-3">生成详情</h3>
                                    <div className="space-y-2">
                                        {generatingItems.map(item => (
                                            <div 
                                                key={item.id} 
                                                className="flex items-center gap-3 p-3 rounded-lg border transition-all"
                                                style={{
                                                    borderColor: 
                                                        item.status === 'success' ? 'rgb(34 197 94)' :
                                                        item.status === 'error' ? 'rgb(239 68 68)' :
                                                        item.status === 'generating' ? 'rgb(99 102 241)' :
                                                        'rgb(226 232 240)',
                                                    backgroundColor:
                                                        item.status === 'success' ? 'rgb(240 253 244)' :
                                                        item.status === 'error' ? 'rgb(254 242 242)' :
                                                        item.status === 'generating' ? 'rgb(238 242 255)' :
                                                        'rgb(248 250 252)'
                                                }}
                                            >
                                                {/* 状态图标 */}
                                                <div className="flex-shrink-0">
                                                    {item.status === 'pending' && (
                                                        <div className="w-5 h-5 rounded-full border-2 border-slate-300" />
                                                    )}
                                                    {item.status === 'generating' && (
                                                        <Loader2 className="w-5 h-5 animate-spin text-indigo-600" />
                                                    )}
                                                    {item.status === 'success' && (
                                                        <CheckCircle2 className="w-5 h-5 text-green-600" />
                                                    )}
                                                    {item.status === 'error' && (
                                                        <div className="w-5 h-5 rounded-full bg-red-500 flex items-center justify-center">
                                                            <span className="text-white text-xs font-bold">×</span>
                                                        </div>
                                                    )}
                                                </div>

                                                {/* 类型图标 */}
                                                <div className="flex-shrink-0">
                                                    {item.type === 'avatar' && <Users className="w-5 h-5 text-blue-600" />}
                                                    {item.type === 'sprite' && <Image className="w-5 h-5 text-purple-600" />}
                                                    {item.type === 'background' && <MapPin className="w-5 h-5 text-green-600" />}
                                                </div>

                                                {/* 名称 */}
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-medium text-slate-800 truncate">{item.name}</p>
                                                </div>

                                                {/* 预览图 */}
                                                {item.status === 'success' && item.imageUrl && (
                                                    <img 
                                                        src={item.imageUrl} 
                                                        alt={item.name}
                                                        className="w-12 h-12 object-cover rounded border border-slate-200"
                                                    />
                                                )}

                                                {/* 状态文字 */}
                                                <div className="flex-shrink-0">
                                                    <span className="text-xs font-medium"
                                                        style={{
                                                            color:
                                                                item.status === 'success' ? 'rgb(34 197 94)' :
                                                                item.status === 'error' ? 'rgb(239 68 68)' :
                                                                item.status === 'generating' ? 'rgb(99 102 241)' :
                                                                'rgb(148 163 184)'
                                                        }}
                                                    >
                                                        {item.status === 'pending' && '等待中'}
                                                        {item.status === 'generating' && '生成中'}
                                                        {item.status === 'success' && '已完成'}
                                                        {item.status === 'error' && '失败'}
                                                    </span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* 完成状态 */}
                        {completed && (
                            <div className="bg-gradient-to-r from-green-50 to-emerald-50 p-6 rounded-lg border-2 border-green-300 text-center">
                                <CheckCircle2 className="w-16 h-16 mx-auto mb-4 text-green-600" />
                                <h3 className="text-2xl font-bold text-green-900 mb-2">生成完成！</h3>
                                <p className="text-green-700">所有视觉素材已成功生成</p>
                            </div>
                        )}

                        {/* 操作按钮 */}
                        <div className="flex gap-3 pt-4">
                            {!completed && !isGenerating && totalAssets === 0 && (
                                <Button
                                    onClick={handleGoToEditor}
                                    className="flex-1 h-12 text-lg bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600"
                                >
                                    <ArrowRight className="w-5 h-5 mr-2" />
                                    进入编辑器
                                </Button>
                            )}

                            {!completed && !isGenerating && totalAssets > 0 && (
                                <>
                                    <Button
                                        variant="outline"
                                        onClick={handleSkip}
                                        className="flex-1 h-12 text-lg"
                                    >
                                        <SkipForward className="w-5 h-5 mr-2" />
                                        跳过（稍后手动生成）
                                    </Button>
                                    <Button
                                        onClick={handleGenerateAll}
                                        disabled={isGenerating}
                                        className="flex-1 h-12 text-lg bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600"
                                    >
                                        <Wand2 className="w-5 h-5 mr-2" />
                                        一键生成所有素材
                                    </Button>
                                </>
                            )}

                            {completed && (
                                <Button
                                    onClick={handleGoToEditor}
                                    className="w-full h-12 text-lg bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600"
                                >
                                    <ArrowRight className="w-5 h-5 mr-2" />
                                    进入编辑器
                                </Button>
                            )}
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}

export default function GenerateAssetsPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100">
                <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
            </div>
        }>
            <GenerateAssetsPageContent />
        </Suspense>
    );
}
