'use client';

import { useRouter } from 'next/navigation';
import { Button, Card, CardHeader, CardTitle, CardDescription, CardContent } from '@vng/ui';
import { Sparkles, Users, Image, Wand2, FolderOpen } from 'lucide-react';

export default function Home() {
    const router = useRouter();

    return (
        <main className="flex min-h-screen flex-col items-center justify-center p-8 bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500">
            <Card className="w-full max-w-3xl shadow-2xl border-0 bg-white/95 backdrop-blur">
                <CardHeader className="text-center pb-4">
                    <div className="flex justify-center mb-4">
                        <div className="w-20 h-20 rounded-full bg-gradient-to-br from-indigo-600 to-pink-600 flex items-center justify-center">
                            <Sparkles className="w-10 h-10 text-white" />
                        </div>
                    </div>
                    <CardTitle className="text-5xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-pink-600">
                        IntelliVNG Studio
                    </CardTitle>
                    <CardDescription className="text-xl mt-3 text-gray-600">
                        AI 驱动的立绘游戏编辑器
                    </CardDescription>
                    <p className="text-sm mt-2 text-gray-500">
                        自定义角色与背景 → AI 生成多分支剧情 → 可视化卡片编辑 → 导出完整游戏
                    </p>
                </CardHeader>
                
                <CardContent className="space-y-6 pt-6">
                    {/* 核心流程说明 */}
                    <div className="grid md:grid-cols-3 gap-4">
                        <div className="text-center p-4 bg-indigo-50 rounded-lg">
                            <div className="w-12 h-12 rounded-full bg-indigo-500 flex items-center justify-center mx-auto mb-3">
                                <Users className="w-6 h-6 text-white" />
                            </div>
                            <h3 className="font-semibold text-indigo-900 mb-1">1. 定义角色背景</h3>
                            <p className="text-sm text-gray-600">设置角色外观、性格、技能和世界观</p>
                        </div>
                        
                        <div className="text-center p-4 bg-purple-50 rounded-lg">
                            <div className="w-12 h-12 rounded-full bg-purple-500 flex items-center justify-center mx-auto mb-3">
                                <Wand2 className="w-6 h-6 text-white" />
                            </div>
                            <h3 className="font-semibold text-purple-900 mb-1">2. AI 生成剧情</h3>
                            <p className="text-sm text-gray-600">基于设定生成多分支故事线</p>
                        </div>
                        
                        <div className="text-center p-4 bg-pink-50 rounded-lg">
                            <div className="w-12 h-12 rounded-full bg-pink-500 flex items-center justify-center mx-auto mb-3">
                                <Image className="w-6 h-6 text-white" />
                            </div>
                            <h3 className="font-semibold text-pink-900 mb-1">3. 编辑与导出</h3>
                            <p className="text-sm text-gray-600">卡片编辑调整，一键导出游戏</p>
                        </div>
                    </div>

                    {/* 开始按钮 */}
                    <div className="space-y-3">
                        <Button
                            className="w-full h-14 text-xl bg-gradient-to-r from-indigo-600 to-pink-600 hover:from-indigo-700 hover:to-pink-700 border-0"
                            onClick={() => router.push('/setup')}
                        >
                            开始创作 ✨
                        </Button>
                        
                        <Button
                            variant="outline"
                            className="w-full h-12 text-lg border-2 border-indigo-300 text-indigo-700 hover:bg-indigo-50"
                            onClick={() => router.push('/dashboard')}
                        >
                            <FolderOpen className="w-5 h-5 mr-2" />
                            查看我的项目
                        </Button>
                    </div>

                    {/* 额外说明 */}
                    <div className="text-center text-sm text-gray-500 pt-2">
                        <p>支持自定义角色立绘、背景图片，AI 辅助生成素材</p>
                    </div>
                </CardContent>
            </Card>

            {/* 页脚 */}
            <p className="text-white/80 mt-8 text-sm">
                Made with ❤️ by IntelliVNG Team
            </p>
        </main>
    );
}
