'use client';

import { Button, Card, CardHeader, CardTitle, CardContent, useToast } from '@vng/ui';
import { ArrowLeft, Wand2, Users, Globe, Image, AlertCircle, Palette } from 'lucide-react';
import { useSetupStore } from '@/stores/setupStore';
import { useState, Suspense } from 'react';
import { saveProject } from '@/lib/projectStorage';
import { useI18N } from '@/components/I18nProvider';
import { useRouterWithParams } from '@/hooks/useRouterWithParams';

function SummaryPageContent() {
    const router = useRouterWithParams();
    const toast = useToast();
    const { characters, worldSetting, scenes, themeSetting } = useSetupStore();
    const [isGenerating, setIsGenerating] = useState(false);
    const { t, getText } = useI18N();

    const handleGenerate = async () => {
        // 验证必要信息
        if (characters.length === 0) {
            toast.warning(t('key.summary.validateCharacters'));
            return;
        }
        if (!worldSetting) {
            toast.warning(t('key.summary.validateWorld'));
            return;
        }
        if (scenes.length === 0) {
            toast.warning(t('key.summary.validateScenes'));
            return;
        }
        if (!themeSetting || themeSetting.themes.length === 0 || themeSetting.styles.length === 0) {
            toast.warning(t('key.summary.validateTheme'));
            return;
        }

        setIsGenerating(true);

        try {
            console.log('[Summary] Sending request with:', {
                characters: characters.length,
                worldSetting: worldSetting.name,
                scenes: scenes.length,
                themeSetting: themeSetting,
            });

            // 获取当前locale
            const currentLocale = typeof window !== 'undefined' 
                ? (new URLSearchParams(window.location.search).get('locale') || 'zh-CN')
                : 'zh-CN';

            // 调用 API 生成游戏
            const response = await fetch('/api/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    characters,
                    worldSetting,
                    scenes,
                    themeSetting,
                    locale: currentLocale,
                }),
            });

            console.log('[Summary] Response status:', response.status);

            const result = await response.json();
            console.log('[Summary] Response data:', result);

            if (result.success) {
                console.log('[Summary] Generation successful, projectId:', result.data.id);
                
                // ✅ 保存项目到后端
                const saved = await saveProject(result.data);
                if (saved) {
                    console.log('[Summary] 项目已保存');
                } else {
                    console.warn('[Summary] 项目保存失败,但仍可继续编辑');
                }
                
                // 直接跳转到编辑页面
                router.push(`/editor?projectId=${result.data.id}`);
            } else {
                console.error('[Summary] Generation failed:', result.error);
                toast.error(t('key.summary.generateFailed'), result.error || '未知错误');
            }
        } catch (error) {
            console.error('[Summary] Exception:', error);
            toast.error(t('key.summary.generateFailed'), t('key.summary.networkError') + (error instanceof Error ? error.message : String(error)));
        } finally {
            setIsGenerating(false);
        }
    };

    const canGenerate = characters.length > 0 && worldSetting !== null && scenes.length > 0 && themeSetting !== null && themeSetting.themes.length > 0 && themeSetting.styles.length > 0;

    return (
        <main className="min-h-screen bg-gradient-to-br from-slate-50 via-amber-50 to-orange-50 p-8">
            <div className="max-w-5xl mx-auto">
                {/* 标题栏 */}
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <div className="flex items-center gap-3 mb-3">
                            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center shadow-lg">
                                <Wand2 className="w-8 h-8 text-white" />
                            </div>
                            <div>
                                <h1 className="text-4xl font-bold bg-gradient-to-r from-amber-600 to-orange-600 bg-clip-text text-transparent mb-1" suppressHydrationWarning>
                                    {getText('key.summary.pageTitle', '汇总预览')}
                                </h1>
                                <p className="text-slate-600" suppressHydrationWarning>
                                    {getText('key.summary.pageDescription', '查看所有设置,确认后生成游戏')}
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
                        <span suppressHydrationWarning>{getText('key.summary.back', '返回')}</span>
                    </Button>
                </div>

                {/* 世界观汇总 */}
                <Card className="mb-6 shadow-lg border-2 border-slate-200">
                    <CardHeader className="bg-gradient-to-br from-purple-50 to-blue-50">
                        <CardTitle className="flex items-center gap-2 text-slate-800" suppressHydrationWarning>
                            <Globe className="w-5 h-5" />
                            {getText('key.summary.worldSetting', '世界观设定')}
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {!worldSetting ? (
                            <div className="flex items-center gap-2 text-amber-600 bg-amber-50 p-4 rounded">
                                <AlertCircle className="w-5 h-5" />
                                <span suppressHydrationWarning>{getText('key.summary.noWorld', '未设置世界观')}</span>
                            </div>
                        ) : (
                            <div className="border rounded-lg p-4 bg-gray-50">
                                <h3 className="font-semibold text-lg text-gray-900 mb-3">{worldSetting.name}</h3>
                                <div className="grid md:grid-cols-2 gap-3 text-sm">
                                    <div>
                                        <span className="font-medium text-gray-700" suppressHydrationWarning>{getText('key.summary.era', '时代：')}</span>
                                        <span className="text-gray-600">{worldSetting.era}</span>
                                    </div>
                                    <div>
                                        <span className="font-medium text-gray-700" suppressHydrationWarning>{getText('key.summary.location', '地点：')}</span>
                                        <span className="text-gray-600">{worldSetting.location}</span>
                                    </div>
                                    {worldSetting.rules && (
                                        <div className="md:col-span-2">
                                            <span className="font-medium text-gray-700" suppressHydrationWarning>{getText('key.summary.coreRules', '核心规则：')}</span>
                                            <span className="text-gray-600">{worldSetting.rules}</span>
                                        </div>
                                    )}
                                    {worldSetting.socialStructure && (
                                        <div className="md:col-span-2">
                                            <span className="font-medium text-gray-700" suppressHydrationWarning>{getText('key.summary.socialStructure', '社会结构：')}</span>
                                            <span className="text-gray-600">{worldSetting.socialStructure}</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                        <div className="mt-4 text-center">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => router.push('/setup/world')}
                            >
                                <span suppressHydrationWarning>
                                    {worldSetting ? getText('key.summary.editWorld', '编辑世界观') : getText('key.summary.addWorld', '添加世界观')}
                                </span>
                            </Button>
                        </div>
                    </CardContent>
                </Card>

                {/* 主题风格汇总 */}
                <Card className="mb-6 shadow-lg border-2 border-slate-200">
                    <CardHeader className="bg-gradient-to-br from-pink-50 to-rose-50">
                        <CardTitle className="flex items-center gap-2 text-slate-800" suppressHydrationWarning>
                            <Palette className="w-5 h-5" />
                            {getText('key.summary.themeSetting', '主题风格设定')}
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {!themeSetting || themeSetting.themes.length === 0 ? (
                            <div className="flex items-center gap-2 text-amber-600 bg-amber-50 p-4 rounded">
                                <AlertCircle className="w-5 h-5" />
                                <span suppressHydrationWarning>{getText('key.summary.noTheme', '未设置主题风格')}</span>
                            </div>
                        ) : (
                            <div className="border rounded-lg p-4 bg-gray-50">
                                <div className="space-y-3 text-sm">
                                    <div>
                                        <span className="font-medium text-gray-700" suppressHydrationWarning>{getText('key.summary.coreThemes', '核心主题：')}</span>
                                        <div className="flex flex-wrap gap-2 mt-1">
                                            {themeSetting.themes.map((theme, idx) => (
                                                <span key={idx} className="px-2 py-1 bg-pink-100 text-pink-700 rounded text-xs">
                                                    {theme}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                    <div>
                                        <span className="font-medium text-gray-700" suppressHydrationWarning>{getText('key.summary.plotStyles', '剧情风格：')}</span>
                                        <div className="flex flex-wrap gap-2 mt-1">
                                            {themeSetting.styles.map((style, idx) => (
                                                <span key={idx} className="px-2 py-1 bg-purple-100 text-purple-700 rounded text-xs">
                                                    {style}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                    {themeSetting.tone && (
                                        <div>
                                            <span className="font-medium text-gray-700" suppressHydrationWarning>{getText('key.summary.overallTone', '整体调性：')}</span>
                                            <span className="text-gray-600">{themeSetting.tone}</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                        <div className="mt-4 text-center">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => router.push('/setup/theme')}
                            >
                                <span suppressHydrationWarning>
                                    {themeSetting ? getText('key.summary.editTheme', '编辑主题') : getText('key.summary.addTheme', '添加主题')}
                                </span>
                            </Button>
                        </div>
                    </CardContent>
                </Card>

                {/* 场景汇总 */}
                <Card className="mb-6 shadow-lg border-2 border-slate-200">
                    <CardHeader className="bg-gradient-to-br from-green-50 to-teal-50">
                        <CardTitle className="flex items-center gap-2 text-slate-800" suppressHydrationWarning>
                            <Image className="w-5 h-5" />
                            {getText('key.summary.scenesList', '场景列表').replace('{count}', scenes.length.toString()) || `场景列表 (${scenes.length}个)`}
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {scenes.length === 0 ? (
                            <div className="flex items-center gap-2 text-amber-600 bg-amber-50 p-4 rounded">
                                <AlertCircle className="w-5 h-5" />
                                <span suppressHydrationWarning>{getText('key.summary.noScenes', '未添加场景')}</span>
                            </div>
                        ) : (
                            <div className="grid md:grid-cols-2 gap-4">
                                {scenes.map((scene) => (
                                    <div key={scene.id} className="border rounded-lg p-4 bg-gray-50">
                                        <h3 className="font-semibold text-lg text-gray-900 mb-2">{scene.name}</h3>
                                        <div className="text-sm text-gray-600 space-y-1">
                                            <div><span className="font-medium" suppressHydrationWarning>{getText('key.summary.sceneType', '类型：')}</span>{scene.type}</div>
                                            <div><span className="font-medium" suppressHydrationWarning>{getText('key.summary.sceneAtmosphere', '氛围：')}</span>{scene.atmosphere}</div>
                                            {scene.details && (
                                                <div className="text-xs"><span className="font-medium" suppressHydrationWarning>{getText('key.summary.sceneDetails', '详情：')}</span>{scene.details}</div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                        <div className="mt-4 text-center">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => router.push('/setup/scenes')}
                            >
                                <span suppressHydrationWarning>{getText('key.summary.editScenes', '编辑场景')}</span>
                            </Button>
                        </div>
                    </CardContent>
                </Card>

                {/* 角色汇总 */}
                <Card className="mb-6 shadow-lg border-2 border-slate-200">
                    <CardHeader className="bg-gradient-to-br from-indigo-50 to-purple-50">
                        <CardTitle className="flex items-center gap-2 text-slate-800" suppressHydrationWarning>
                            <Users className="w-5 h-5" />
                            {getText('key.summary.charactersList', '角色列表').replace('{count}', characters.length.toString()) || `角色列表 (${characters.length}个)`}
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {characters.length === 0 ? (
                            <div className="flex items-center gap-2 text-amber-600 bg-amber-50 p-4 rounded">
                                <AlertCircle className="w-5 h-5" />
                                <span suppressHydrationWarning>{getText('key.summary.noCharacters', '未添加角色')}</span>
                            </div>
                        ) : (
                            <div className="grid md:grid-cols-2 gap-4">
                                {characters.map((char) => (
                                    <div key={char.id} className="border rounded-lg p-4 bg-gray-50">
                                        <div className="flex items-start justify-between mb-2">
                                            <h3 className="font-semibold text-lg text-gray-900">{char.displayName}</h3>
                                            <span className="text-xs px-2 py-1 bg-indigo-100 text-indigo-700 rounded" suppressHydrationWarning>
                                                {char.gender === 'male' || char.gender === '男' ? getText('key.summary.genderMale', '男') : char.gender === 'female' || char.gender === '女' ? getText('key.summary.genderFemale', '女') : getText('key.summary.genderOther', '其他')}
                                            </span>
                                        </div>
                                        <p className="text-sm text-gray-600 mb-2">{char.description || getText('key.summary.noDescription', '未设置描述')}</p>
                                        <div className="text-xs text-gray-500 space-y-1">
                                            {char.identity && <div suppressHydrationWarning>{getText('key.summary.identity', '身份：')}{char.identity}</div>}
                                            {char.age && <div suppressHydrationWarning>{getText('key.summary.age', '年龄：')}{char.age}</div>}
                                            {char.personality?.traits && char.personality.traits.length > 0 && (
                                                <div suppressHydrationWarning>{getText('key.summary.personality', '性格：')}{char.personality.traits.join('、')}</div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                        <div className="mt-4 text-center">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => router.push('/setup/characters')}
                            >
                                <span suppressHydrationWarning>{getText('key.summary.editCharacters', '编辑角色')}</span>
                            </Button>
                        </div>
                    </CardContent>
                </Card>

                {/* 生成按钮 */}
                <Card className="mb-6 shadow-lg border-2 border-green-300">
                    <CardHeader className="bg-gradient-to-br from-green-50 to-teal-50">
                        <CardTitle className="flex items-center gap-2 text-slate-800" suppressHydrationWarning>
                            <Wand2 className="w-5 h-5" />
                            {getText('key.summary.confirmAndGenerate', '确认并生成')}
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-center mb-6">
                            <h3 className="text-2xl font-bold text-slate-900 mb-2" suppressHydrationWarning>
                                {getText('key.summary.readyQuestion', '准备好了吗？')}
                            </h3>
                            <p className="text-slate-600" suppressHydrationWarning>
                                {getText('key.summary.generateHint', 'AI 将基于你定义的角色、世界观设定、场景和主题风格，生成一个包含单开头+多分支+多结尾的完整故事')
                                    .replace('{characters}', characters.length.toString())
                                    .replace('{scenes}', scenes.length.toString()) || `系统将基于 ${characters.length} 个角色、${scenes.length} 个场景生成故事`}
                            </p>
                        </div>
                        <Button
                            className="w-full h-14 text-xl bg-gradient-to-r from-green-500 to-teal-500 hover:from-green-600 hover:to-teal-600 shadow-lg"
                            onClick={handleGenerate}
                            disabled={isGenerating || !canGenerate}
                        >
                            <Wand2 className="w-5 h-5 mr-2" />
                            <span suppressHydrationWarning>
                                {isGenerating ? getText('key.summary.generating', 'AI生成中...') : getText('key.summary.generateStory', '开始生成故事')}
                            </span>
                        </Button>
                        {isGenerating && (
                            <p className="text-center text-sm text-slate-500 mt-3" suppressHydrationWarning>
                                {getText('key.summary.generatingWait', '正在生成中,请稍候...')}
                            </p>
                        )}
                        {!canGenerate && (
                            <p className="text-center text-sm text-amber-600 mt-3" suppressHydrationWarning>
                                {getText('key.summary.completeSettings', '请先完成所有必填设置')}
                            </p>
                        )}
                    </CardContent>
                </Card>
            </div>
        </main>
    );
}

// 用 Suspense 包裹以支持 useSearchParams
export default function SummaryPage() {
    return (
        <Suspense fallback={<div className="min-h-screen bg-gradient-to-br from-slate-50 via-amber-50 to-orange-50 flex items-center justify-center"><div className="text-lg">加载中...</div></div>}>
            <SummaryPageContent />
        </Suspense>
    );
}
