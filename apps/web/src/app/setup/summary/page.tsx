'use client';

import { useRouter } from 'next/navigation';
import { Button, Card, CardHeader, CardTitle, CardContent } from '@vng/ui';
import { ArrowLeft, Wand2, Users, Globe, Image, AlertCircle, Palette } from 'lucide-react';
import { useSetupStore } from '@/stores/setupStore';
import { useState } from 'react';
import { saveProject } from '@/lib/projectStorage';

export default function SummaryPage() {
    const router = useRouter();
    const { characters, worldSetting, scenes, themeSetting } = useSetupStore();
    const [isGenerating, setIsGenerating] = useState(false);

    const handleGenerate = async () => {
        // 验证必要信息
        if (characters.length === 0) {
            alert('请至少定义一个角色');
            return;
        }
        if (!worldSetting) {
            alert('请定义世界观');
            return;
        }
        if (scenes.length === 0) {
            alert('请至少定义一个场景');
            return;
        }
        if (!themeSetting || themeSetting.themes.length === 0 || themeSetting.styles.length === 0) {
            alert('请定义故事主题风格');
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

            // 调用 API 生成游戏
            const response = await fetch('/api/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    characters,
                    worldSetting,
                    scenes,
                    themeSetting,
                }),
            });

            console.log('[Summary] Response status:', response.status);

            const result = await response.json();
            console.log('[Summary] Response data:', result);

            if (result.success) {
                console.log('[Summary] Generation successful, projectId:', result.data.id);
                
                // ✅ 保存项目到本地存储
                const saved = saveProject(result.data);
                if (saved) {
                    console.log('[Summary] 项目已保存到本地存储');
                } else {
                    console.warn('[Summary] 项目保存失败,但仍可继续编辑');
                }
                
                // 跳转到编辑器页面
                router.push(`/editor?projectId=${result.data.id}`);
            } else {
                console.error('[Summary] Generation failed:', result.error);
                alert('生成失败：' + (result.error || '未知错误'));
            }
        } catch (error) {
            console.error('[Summary] Exception:', error);
            alert('生成失败，请检查网络连接和后端服务。错误：' + (error instanceof Error ? error.message : String(error)));
        } finally {
            setIsGenerating(false);
        }
    };

    const canGenerate = characters.length > 0 && worldSetting !== null && scenes.length > 0 && themeSetting !== null && themeSetting.themes.length > 0 && themeSetting.styles.length > 0;

    return (
        <main className="min-h-screen bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 p-8">
            <div className="max-w-5xl mx-auto">
                {/* 标题栏 */}
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <h1 className="text-4xl font-bold text-white mb-2">📋 设定汇总</h1>
                        <p className="text-white/80">确认你的角色、世界观、场景和主题风格设定，准备生成剧情</p>
                    </div>
                    <Button
                        variant="outline"
                        className="bg-white/20 text-white border-white/40 hover:bg-white/30"
                        onClick={() => router.push('/setup')}
                    >
                        <ArrowLeft className="w-4 h-4 mr-2" />
                        返回
                    </Button>
                </div>

                {/* 角色汇总 */}
                <Card className="mb-6">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Users className="w-5 h-5" />
                            角色列表 ({characters.length})
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {characters.length === 0 ? (
                            <div className="flex items-center gap-2 text-amber-600 bg-amber-50 p-4 rounded">
                                <AlertCircle className="w-5 h-5" />
                                <span>还没有定义角色，请先创建至少一个角色</span>
                            </div>
                        ) : (
                            <div className="grid md:grid-cols-2 gap-4">
                                {characters.map((char) => (
                                    <div key={char.id} className="border rounded-lg p-4 bg-gray-50">
                                        <div className="flex items-start justify-between mb-2">
                                            <h3 className="font-semibold text-lg text-gray-900">{char.displayName}</h3>
                                            <span className="text-xs px-2 py-1 bg-indigo-100 text-indigo-700 rounded">
                                                {char.gender === 'male' || char.gender === '男' ? '男' : char.gender === 'female' || char.gender === '女' ? '女' : '其他'}
                                            </span>
                                        </div>
                                        <p className="text-sm text-gray-600 mb-2">{char.description || '无描述'}</p>
                                        <div className="text-xs text-gray-500 space-y-1">
                                            {char.identity && <div>身份：{char.identity}</div>}
                                            {char.age && <div>年龄：{char.age}</div>}
                                            {char.personality?.traits && char.personality.traits.length > 0 && (
                                                <div>性格：{char.personality.traits.join('、')}</div>
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
                                + 添加/编辑角色
                            </Button>
                        </div>
                    </CardContent>
                </Card>

                {/* 世界观汇总 */}
                <Card className="mb-6">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Globe className="w-5 h-5" />
                            世界观设定
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {!worldSetting ? (
                            <div className="flex items-center gap-2 text-amber-600 bg-amber-50 p-4 rounded">
                                <AlertCircle className="w-5 h-5" />
                                <span>还没有定义世界观，请先设定世界观</span>
                            </div>
                        ) : (
                            <div className="border rounded-lg p-4 bg-gray-50">
                                <h3 className="font-semibold text-lg text-gray-900 mb-3">{worldSetting.name}</h3>
                                <div className="grid md:grid-cols-2 gap-3 text-sm">
                                    <div>
                                        <span className="font-medium text-gray-700">时代：</span>
                                        <span className="text-gray-600">{worldSetting.era}</span>
                                    </div>
                                    <div>
                                        <span className="font-medium text-gray-700">地域：</span>
                                        <span className="text-gray-600">{worldSetting.location}</span>
                                    </div>
                                    {worldSetting.rules && (
                                        <div className="md:col-span-2">
                                            <span className="font-medium text-gray-700">核心规则：</span>
                                            <span className="text-gray-600">{worldSetting.rules}</span>
                                        </div>
                                    )}
                                    {worldSetting.socialStructure && (
                                        <div className="md:col-span-2">
                                            <span className="font-medium text-gray-700">社会结构：</span>
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
                                {worldSetting ? '编辑世界观' : '+ 设定世界观'}
                            </Button>
                        </div>
                    </CardContent>
                </Card>

                {/* 场景汇总 */}
                <Card className="mb-6">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Image className="w-5 h-5" />
                            场景列表 ({scenes.length})
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {scenes.length === 0 ? (
                            <div className="flex items-center gap-2 text-amber-600 bg-amber-50 p-4 rounded">
                                <AlertCircle className="w-5 h-5" />
                                <span>还没有定义场景，请先创建至少一个场景</span>
                            </div>
                        ) : (
                            <div className="grid md:grid-cols-2 gap-4">
                                {scenes.map((scene) => (
                                    <div key={scene.id} className="border rounded-lg p-4 bg-gray-50">
                                        <h3 className="font-semibold text-lg text-gray-900 mb-2">{scene.name}</h3>
                                        <div className="text-sm text-gray-600 space-y-1">
                                            <div><span className="font-medium">类型：</span>{scene.type}</div>
                                            <div><span className="font-medium">氛围：</span>{scene.atmosphere}</div>
                                            {scene.details && (
                                                <div className="text-xs"><span className="font-medium">细节：</span>{scene.details}</div>
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
                                + 添加/编辑场景
                            </Button>
                        </div>
                    </CardContent>
                </Card>

                {/* 主题风格汇总 */}
                <Card className="mb-6">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Palette className="w-5 h-5" />
                            故事主题风格
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {!themeSetting || themeSetting.themes.length === 0 ? (
                            <div className="flex items-center gap-2 text-amber-600 bg-amber-50 p-4 rounded">
                                <AlertCircle className="w-5 h-5" />
                                <span>还没有定义主题风格，请先设定主题风格</span>
                            </div>
                        ) : (
                            <div className="border rounded-lg p-4 bg-gray-50">
                                <div className="space-y-3 text-sm">
                                    <div>
                                        <span className="font-medium text-gray-700">核心主题：</span>
                                        <div className="flex flex-wrap gap-2 mt-1">
                                            {themeSetting.themes.map((theme, idx) => (
                                                <span key={idx} className="px-2 py-1 bg-pink-100 text-pink-700 rounded text-xs">
                                                    {theme}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                    <div>
                                        <span className="font-medium text-gray-700">剧情风格：</span>
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
                                            <span className="font-medium text-gray-700">整体基调：</span>
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
                                {themeSetting ? '编辑主题风格' : '+ 设定主题风格'}
                            </Button>
                        </div>
                    </CardContent>
                </Card>

                {/* 生成按钮 */}
                <Card className="border-2 border-green-400 bg-white/95">
                    <CardContent className="pt-6">
                        <div className="text-center mb-6">
                            <h3 className="text-2xl font-bold text-gray-900 mb-2">准备好了吗？</h3>
                            <p className="text-gray-600">
                                AI 将基于你定义的 {characters.length} 个角色、世界观设定、{scenes.length} 个场景和主题风格，
                                生成一个包含单开头+多分支+多结尾的完整故事
                            </p>
                        </div>
                        <Button
                            className="w-full h-14 text-xl bg-gradient-to-r from-green-500 to-teal-500 hover:from-green-600 hover:to-teal-600"
                            onClick={handleGenerate}
                            disabled={isGenerating || !canGenerate}
                        >
                            <Wand2 className="w-5 h-5 mr-2" />
                            {isGenerating ? '正在生成剧情...' : '开始 AI 生成 ✨'}
                        </Button>
                        {isGenerating && (
                            <p className="text-center text-sm text-gray-500 mt-3">
                                这可能需要 10-30 秒，请耐心等待...
                            </p>
                        )}
                        {!canGenerate && (
                            <p className="text-center text-sm text-amber-600 mt-3">
                                请完成角色、世界观、场景和主题风格的设定
                            </p>
                        )}
                    </CardContent>
                </Card>

                {/* 底部导航 */}
                <div className="mt-8 flex justify-between">
                    <Button
                        variant="outline"
                        className="bg-white/20 text-white border-white/40 hover:bg-white/30"
                        onClick={() => router.push('/setup/theme')}
                    >
                        ← 返回主题风格
                    </Button>
                </div>
            </div>
        </main>
    );
}
