'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Card, CardContent, useToast } from '@vng/ui';
import { ArrowLeft, Plus, Trash2, Wand2, Edit2, Sparkles, Loader2 } from 'lucide-react';
import { useSetupStore } from '@/stores/setupStore';
import { createId } from '@vng/core';
import type { Scene } from '@vng/core';
import { useFormAutocomplete } from '@/hooks/useFormAutocomplete';
import { I18N, t } from '@/i18n/client';

export default function ScenesPage() {
    const router = useRouter();
    const toast = useToast();
    const { scenes, addScene, updateScene, removeScene, worldSetting, themeSetting } = useSetupStore();
    const { isLoading: isAutocompleting, autocomplete } = useFormAutocomplete<Scene>('scene');
    
    const [editingId, setEditingId] = useState<string | null>(null);
    const [currentScene, setCurrentScene] = useState<Scene>({
        id: createId(),
        name: '',
        type: '',
        atmosphere: '',
        details: '',
        function: '',
        description: '',
        imageUrl: '',
    });
    const [isGeneratingBackground, setIsGeneratingBackground] = useState(false);

    // AI 自动补全场景表单
    const handleAutocomplete = async () => {
        const result = await autocomplete(currentScene, {
            genre: themeSetting?.themes?.[0],
            worldSetting: worldSetting?.name,
            existingItems: scenes.map(s => s.name),
        });
        
        if (result) {
            setCurrentScene({
                ...currentScene,
                ...result,
                // 保留已有的背景图
                imageUrl: currentScene.imageUrl || result.imageUrl,
            });
        }
    };

    const handleSaveScene = () => {
        if (currentScene.name && currentScene.type && currentScene.atmosphere) {
            if (editingId) {
                // 编辑模式
                updateScene(editingId, currentScene);
                toast.success(t('key.scenes.save.updateSuccess'), t('key.scenes.save.assetsSync'));
                setEditingId(null);
            } else {
                // 添加模式
                addScene(currentScene);
                toast.success(t('key.scenes.save.addSuccess'), t('key.scenes.save.assetsAdded'));
            }
            
            // 重置表单
            setCurrentScene({
                id: createId(),
                name: '',
                type: '',
                atmosphere: '',
                details: '',
                function: '',
                description: '',
                imageUrl: '',
            });
        }
    };

    const handleEditScene = (scene: Scene) => {
        setEditingId(scene.id);
        setCurrentScene({ ...scene });
    };

    const handleCancelEdit = () => {
        setEditingId(null);
        setCurrentScene({
            id: createId(),
            name: '',
            type: '',
            atmosphere: '',
            details: '',
            function: '',
            description: '',
            imageUrl: '',
        });
    };

    // AI生成场景背景图
    const handleGenerateBackground = async () => {
        if (!currentScene.name || !currentScene.type) {
            toast.warning(t('key.scenes.warning.fillNameType'));
            return;
        }

        setIsGeneratingBackground(true);
        try {
            // 构建prompt
            const prompt = `${currentScene.name}, ${currentScene.type}, ${currentScene.atmosphere}, ${currentScene.details || ''}, 场景背景图, 横屏, 高质量, 细节丰富`;
            
            // 调用通义万相API生成背景图
            const response = await fetch('/api/generate-image', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ prompt, type: 'background' })
            });
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.details || t('key.scenes.generate.failed'));
            }
            
            const { imageUrl } = await response.json();
            
            if (!imageUrl) {
                throw new Error(t('key.scenes.generate.noUrl'));
            }
            
            setCurrentScene({
                ...currentScene,
                imageUrl,
            });
            
            toast.success(t('key.scenes.generate.success'), t('key.scenes.generate.saveHint'));
        } catch (error) {
            console.error('生成失败:', error);
            toast.error(t('key.scenes.generate.failed'), error instanceof Error ? error.message : t('key.scenes.generate.retry'));
        } finally {
            setIsGeneratingBackground(false);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-green-50 to-teal-50 p-8">
            <div className="max-w-4xl mx-auto">
                <div className="mb-6 flex items-center justify-between">
                    <div>
                        <div className="flex items-center gap-3 mb-3">
                            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-green-500 to-teal-500 flex items-center justify-center shadow-lg">
                                <Wand2 className="w-8 h-8 text-white" />
                            </div>
                            <div>
                                <h1 className="text-4xl font-bold bg-gradient-to-r from-green-600 to-teal-600 bg-clip-text text-transparent mb-1" suppressHydrationWarning>
                                    {I18N['key.scenes.pageTitle'] || '场景设定'}
                                </h1>
                                <p className="text-slate-600" suppressHydrationWarning>
                                    {I18N['key.scenes.pageDescription'] || '定义故事发生的空间背景'}
                                </p>
                            </div>
                        </div>
                    </div>
                    <Button
                        variant="outline"
                        className="border-slate-300 hover:bg-slate-100"
                        onClick={() => router.push('/setup')}
                    >
                        <ArrowLeft className="w-4 h-4 mr-2" />
                        <span suppressHydrationWarning>{I18N['key.scenes.back'] || '返回'}</span>
                    </Button>
                </div>

                <div className="grid gap-6 md:grid-cols-2">
                    {/* 添加场景表单 */}
                    <Card className="shadow-lg border-2 border-slate-200">
                        <CardContent className="p-6">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="font-semibold text-lg text-slate-800" suppressHydrationWarning>
                                    {editingId ? ('✏️ ' + (I18N['key.scenes.editScene'] || '编辑场景')) : ('🌟 添加新场景')}
                                </h3>
                                {/* AI 自动补全按钮 */}
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={handleAutocomplete}
                                    disabled={isAutocompleting}
                                    className="gap-2 bg-gradient-to-r from-amber-50 to-orange-50 border-amber-300 hover:from-amber-100 hover:to-orange-100 shadow-sm"
                                >
                                    {isAutocompleting ? (
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                    ) : (
                                        <Sparkles className="w-4 h-4 text-amber-600" />
                                    )}
                                    <span className="text-amber-700 font-medium" suppressHydrationWarning>
                                        {isAutocompleting ? 'AI补全中...' : 'AI帮我填'}
                                    </span>
                                </Button>
                            </div>
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium mb-1">
                                        场景名称 <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        className="w-full border rounded px-3 py-2"
                                        value={currentScene.name}
                                        onChange={(e) => setCurrentScene({ ...currentScene, name: e.target.value })}
                                        placeholder="例如：主角卧室、学校走廊、战场"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium mb-1">
                                        场景类型 <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        className="w-full border rounded px-3 py-2"
                                        value={currentScene.type}
                                        onChange={(e) => setCurrentScene({ ...currentScene, type: e.target.value })}
                                        placeholder="例如：卧室、会议室、街道、森林"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium mb-1">
                                        氛围 <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        className="w-full border rounded px-3 py-2"
                                        value={currentScene.atmosphere}
                                        onChange={(e) => setCurrentScene({ ...currentScene, atmosphere: e.target.value })}
                                        placeholder="例如：压抑、轻松、紧张、神秘"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium mb-1">关键环境细节</label>
                                    <textarea
                                        className="w-full border rounded px-3 py-2 min-h-[80px]"
                                        value={currentScene.details || ''}
                                        onChange={(e) => setCurrentScene({ ...currentScene, details: e.target.value })}
                                        placeholder="例如：墙上挂着褪色的锦旗、桌上摆放着古老的魔法书"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium mb-1">场景功能</label>
                                    <input
                                        type="text"
                                        className="w-full border rounded px-3 py-2"
                                        value={currentScene.function || ''}
                                        onChange={(e) => setCurrentScene({ ...currentScene, function: e.target.value })}
                                        placeholder="例如：触发关键线索、冲突爆发点、情感升温场景"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium mb-1">场景描述</label>
                                    <textarea
                                        className="w-full border rounded px-3 py-2 min-h-[80px]"
                                        value={currentScene.description || ''}
                                        onChange={(e) => setCurrentScene({ ...currentScene, description: e.target.value })}
                                        placeholder="其他场景信息"
                                    />
                                </div>

                                {/* 场景背景图AI生成 */}
                                <div className="border-t pt-4">
                                    <label className="block text-sm font-medium mb-2">🏞️ 场景背景图</label>
                                    <div className="space-y-3">
                                        {/* AI生成 */}
                                        <div className="bg-gradient-to-r from-amber-50 to-orange-50 p-4 rounded-lg border border-amber-200">
                                            <p className="text-sm text-gray-600 mb-3">
                                                基于场景描述生成背景图(横屏1920x1080)
                                            </p>
                                            <Button
                                                onClick={handleGenerateBackground}
                                                disabled={isGeneratingBackground || !currentScene.name}
                                                className="w-full gap-2 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700"
                                            >
                                                <Wand2 className="w-4 h-4" />
                                                <span suppressHydrationWarning>
                                                    {isGeneratingBackground ? (I18N['key.scenes.generating'] || 'AI生成中...') : (I18N['key.scenes.generateBackground'] || 'AI生成背景图')}
                                                </span>
                                            </Button>
                                        </div>
                                        
                                        {/* 手动输入URL */}
                                        <div>
                                            <label className="block text-xs text-gray-500 mb-1">或手动输入背景图URL</label>
                                            <input
                                                type="text"
                                                className="w-full border rounded px-3 py-2"
                                                value={currentScene.imageUrl || ''}
                                                onChange={(e) => setCurrentScene({ ...currentScene, imageUrl: e.target.value })}
                                                placeholder="粘贴背景图片链接"
                                            />
                                        </div>
                                        
                                        {/* 背景图预览 */}
                                        {currentScene.imageUrl && (
                                            <div className="bg-gray-50 p-3 rounded">
                                                <img 
                                                    src={currentScene.imageUrl} 
                                                    alt="背景预览" 
                                                    className="w-full aspect-video object-cover rounded border-2 border-gray-300"
                                                />
                                                <p className="text-xs text-gray-500 mt-2 text-center">当前背景预览</p>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="flex gap-2">
                                    {editingId && (
                                        <Button
                                            onClick={handleCancelEdit}
                                            variant="outline"
                                            className="flex-1"
                                        >
                                            <span suppressHydrationWarning>{I18N['key.scenes.cancel'] || '取消编辑'}</span>
                                        </Button>
                                    )}
                                    <Button
                                        onClick={handleSaveScene}
                                        className="flex-1"
                                        disabled={!currentScene.name || !currentScene.type || !currentScene.atmosphere}
                                    >
                                        <Plus className="w-4 h-4 mr-2" />
                                        <span suppressHydrationWarning>
                                            {editingId ? (I18N['key.scenes.updateScene'] || '保存修改') : (I18N['key.scenes.addScene'] || '添加场景')}
                                        </span>
                                    </Button>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* 已添加的场景列表 */}
                    <div className="space-y-4">
                        <h3 className="font-semibold text-lg text-slate-800" suppressHydrationWarning>
                            {I18N['key.scenes.scenesList'] || '场景列表'} ({scenes.length})
                        </h3>
                        {scenes.length === 0 ? (
                            <Card className="p-8 text-center text-slate-500 shadow-lg border-2 border-slate-200 bg-gradient-to-br from-slate-50 to-green-50">
                                <Wand2 className="w-16 h-16 mx-auto mb-3 text-slate-300" />
                                <p className="font-medium" suppressHydrationWarning>
                                    {I18N['key.scenes.noScenes'] || '还没有添加场景'}
                                </p>
                                <p className="text-sm mt-1" suppressHydrationWarning>点击左侧表单添加第一个场景</p>
                            </Card>
                        ) : (
                            scenes.map((scene) => (
                                <Card key={scene.id} className="p-4 shadow-lg border-2 border-slate-200 hover:shadow-xl transition-shadow">
                                    <div className="flex items-start justify-between gap-4">
                                        {/* 场景背景预览 */}
                                        {scene.imageUrl && (
                                            <div className="w-32 h-20 flex-shrink-0">
                                                <img 
                                                    src={scene.imageUrl} 
                                                    alt={scene.name}
                                                    className="w-full h-full object-cover rounded border"
                                                />
                                            </div>
                                        )}
                                        
                                        <div className="flex-1">
                                            <h4 className="font-semibold text-lg">{scene.name}</h4>
                                            <div className="mt-2 space-y-1 text-sm text-gray-600">
                                                <div><span className="font-medium">类型：</span>{scene.type}</div>
                                                <div><span className="font-medium">氛围：</span>{scene.atmosphere}</div>
                                                {scene.function && (
                                                    <div><span className="font-medium">功能：</span>{scene.function}</div>
                                                )}
                                                {scene.details && (
                                                    <div><span className="font-medium">细节：</span>{scene.details}</div>
                                                )}
                                            </div>
                                        </div>
                                        <div className="flex gap-2">
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                onClick={() => handleEditScene(scene)}
                                            >
                                                <Edit2 className="w-4 h-4" />
                                            </Button>
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                onClick={() => removeScene(scene.id)}
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </Button>
                                        </div>
                                    </div>
                                </Card>
                            ))
                        )}
                    </div>
                </div>

                <div className="mt-8 flex justify-between">
                    <Button
                        variant="outline"
                        className="border-slate-300 hover:bg-slate-100"
                        onClick={() => router.push('/setup')}
                    >
                        <span suppressHydrationWarning>← 返回设置</span>
                    </Button>
                    <Button
                        className="bg-gradient-to-r from-teal-600 to-cyan-600 hover:from-teal-700 hover:to-cyan-700 shadow-lg"
                        onClick={() => router.push('/setup/characters')}
                    >
                        <span suppressHydrationWarning>下一步:定义角色 →</span>
                    </Button>
                </div>
            </div>
        </div>
    );
}
