'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Card, CardHeader, CardTitle, CardDescription, CardContent, useToast } from '@vng/ui';
import { Sparkles, FolderOpen, Zap, Settings } from 'lucide-react';

export default function Home() {
    const router = useRouter();
    const toast = useToast();
    const [quickPrompt, setQuickPrompt] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);
    const [showQuickMode, setShowQuickMode] = useState(false);

    // 快速生成处理
    const handleQuickGenerate = async () => {
        if (!quickPrompt.trim()) {
            toast.warning('请输入故事描述');
            return;
        }

        setIsGenerating(true);
        try {
            toast.info('AI创作中', '正在基于你的描述生成完整游戏...');
            
            // 调用快速生成API
            const response = await fetch('/api/quick-generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt: quickPrompt }),
            });

            const result = await response.json();
            
            if (result.success) {
                toast.success('生成成功', '正在跳转到编辑器...');
                router.push(`/editor?projectId=${result.data.id}`);
            } else {
                toast.error('生成失败', result.error || '请重试');
            }
        } catch (error) {
            console.error('Quick generate error:', error);
            toast.error('生成失败', '请检查网络连接');
        } finally {
            setIsGenerating(false);
        }
    };

    return (
        <main className="flex min-h-screen flex-col items-center justify-center p-8 bg-gradient-to-br from-slate-50 via-indigo-50 to-purple-50">
            <Card className="w-full max-w-3xl shadow-2xl border-2 border-slate-200 bg-white">
                <CardHeader className="text-center pb-4">
                    <div className="flex justify-center mb-4">
                        <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-indigo-600 to-pink-600 flex items-center justify-center shadow-lg">
                            <Sparkles className="w-10 h-10 text-white" />
                        </div>
                    </div>
                    <CardTitle className="text-5xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-pink-600">
                        IntelliVNG Studio
                    </CardTitle>
                    <CardDescription className="text-xl mt-3 text-slate-600">
                        用 AI 讲述你的故事
                    </CardDescription>
                    <p className="text-sm mt-2 text-slate-500">
                        一句话创作完整视觉小说，从灵感到成品只需几分钟
                    </p>
                </CardHeader>
                
                <CardContent className="space-y-6 pt-6">
                    {/* 开始按钮 */}
                    <div className="space-y-3">
                        {!showQuickMode ? (
                            <>
                                {/* 快速模式 - 主推荐 */}
                                <Card className="bg-gradient-to-br from-amber-50 to-orange-50 border-2 border-amber-300">
                                    <CardContent className="p-4">
                                        <div className="flex items-center gap-2 mb-3">
                                            <Zap className="w-5 h-5 text-amber-600" />
                                            <h3 className="font-semibold text-amber-900">快速创作模式</h3>
                                            <span className="px-2 py-0.5 bg-amber-500 text-white text-xs rounded-full">推荐</span>
                                        </div>
                                        <p className="text-sm text-amber-700 mb-3">描述你的故事创意，AI 自动生成完整的多分支剧情游戏</p>
                                        <div className="space-y-2">
                                            <textarea
                                                className="w-full px-4 py-3 border-2 border-amber-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent resize-none"
                                                rows={3}
                                                value={quickPrompt}
                                                onChange={(e) => setQuickPrompt(e.target.value)}
                                                placeholder="例如：写一个关于失忆少女在未来城市寻找记忆的悬疑故事，包含多个结局..."
                                                disabled={isGenerating}
                                            />
                                            <Button
                                                className="w-full h-12 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 shadow-lg"
                                                onClick={handleQuickGenerate}
                                                disabled={isGenerating || !quickPrompt.trim()}
                                            >
                                                <Zap className="w-5 h-5 mr-2" />
                                                {isGenerating ? 'AI 正在创作...' : '✨ 开始创作'}
                                            </Button>
                                        </div>
                                    </CardContent>
                                </Card>

                                {/* 详细设定模式 */}
                                <Button
                                    variant="outline"
                                    className="w-full h-12 text-lg border-2 border-slate-300 text-slate-700 hover:bg-slate-50"
                                    onClick={() => router.push('/setup')}
                                >
                                    <Settings className="w-5 h-5 mr-2" />
                                    专业模式（完全自定义）
                                </Button>
                            </>
                        ) : (
                            <>
                                <Button
                                    className="w-full h-14 text-xl bg-gradient-to-r from-indigo-600 to-pink-600 hover:from-indigo-700 hover:to-pink-700 shadow-lg"
                                    onClick={() => router.push('/setup')}
                                >
                                    开始创作 ✨
                                </Button>
                            </>
                        )}
                        
                        <Button
                            variant="outline"
                            className="w-full h-12 text-lg border-2 border-slate-300 text-slate-700 hover:bg-slate-50"
                            onClick={() => router.push('/dashboard')}
                        >
                            <FolderOpen className="w-5 h-5 mr-2" />
                            查看我的项目
                        </Button>
                    </div>

                    {/* 额外说明 */}
                    <div className="text-center text-sm text-slate-500 pt-2">
                        <p>💡 AI 自动生成角色、场景、对话和分支剧情 | 🎨 支持自定义立绘和背景</p>
                    </div>
                </CardContent>
            </Card>

            {/* 页脚 */}
            <p className="text-slate-600 mt-8 text-sm">
                Made with ❤️ by IntelliVNG Team
            </p>
        </main>
    );
}
