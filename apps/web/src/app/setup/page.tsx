'use client';

import { useRouter } from 'next/navigation';
import { Button, Card, CardHeader, CardTitle, CardDescription, CardContent } from '@vng/ui';
import { Users, Globe, Image, FileText, Palette, FolderOpen } from 'lucide-react';

/**
 * 设置引导页 - 让用户选择开始定义角色还是背景
 */
export default function SetupPage() {
    const router = useRouter();

    return (
        <main className="min-h-screen bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 p-8">
            <div className="max-w-4xl mx-auto">
                <div className="text-center mb-12">
                    <h1 className="text-5xl font-bold text-white mb-4">
                        🎨 开始创作你的立绘游戏
                    </h1>
                    <p className="text-white/90 text-lg">
                        先定义角色、世界观和场景，AI 将基于你的设定生成精彩的多分支剧情
                    </p>
                </div>

                <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                    {/* 世界观设定卡片 */}
                    <Card 
                        className="hover:shadow-2xl transition-all cursor-pointer border-2 hover:border-purple-400"
                        onClick={() => router.push('/setup/world')}
                    >
                        <CardHeader>
                            <div className="flex items-center gap-3 mb-2">
                                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                                    <Globe className="w-6 h-6 text-white" />
                                </div>
                                <CardTitle className="text-xl">世界观设定</CardTitle>
                            </div>
                            <CardDescription className="text-sm">
                                定义故事的时代、地域、社会规则等
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <ul className="space-y-1 text-xs text-gray-600">
                                <li>✓ 时代背景（古风/现代/未来）</li>
                                <li>✓ 地域设定（城邦/校园/宇宙）</li>
                                <li>✓ 核心规则（魔法/科技）</li>
                                <li>✓ 社会结构（阶级/权力）</li>
                            </ul>
                        </CardContent>
                    </Card>

                    {/* 故事主题风格卡片 */}
                    <Card 
                        className="hover:shadow-2xl transition-all cursor-pointer border-2 hover:border-pink-400"
                        onClick={() => router.push('/setup/theme')}
                    >
                        <CardHeader>
                            <div className="flex items-center gap-3 mb-2">
                                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-pink-500 to-rose-500 flex items-center justify-center">
                                    <Palette className="w-6 h-6 text-white" />
                                </div>
                                <CardTitle className="text-xl">故事主题风格</CardTitle>
                            </div>
                            <CardDescription className="text-sm">
                                明确故事的核心主题与风格基调
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <ul className="space-y-1 text-xs text-gray-600">
                                <li>✓ 主题选择（亲情/友情/善恶）</li>
                                <li>✓ 风格选择（悬疑/言情/热血）</li>
                                <li>✓ 多选组合（悬疑+亲情）</li>
                                <li>✓ 自定义主题描述</li>
                            </ul>
                        </CardContent>
                    </Card>

                    {/* 场景定义卡片 */}
                    <Card 
                        className="hover:shadow-2xl transition-all cursor-pointer border-2 hover:border-green-400"
                        onClick={() => router.push('/setup/scenes')}
                    >
                        <CardHeader>
                            <div className="flex items-center gap-3 mb-2">
                                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-green-500 to-teal-500 flex items-center justify-center">
                                    <Image className="w-6 h-6 text-white" />
                                </div>
                                <CardTitle className="text-xl">场景定义</CardTitle>
                            </div>
                            <CardDescription className="text-sm">
                                设定关键场景的类型、氛围、细节等
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <ul className="space-y-1 text-xs text-gray-600">
                                <li>✓ 场景类型（卧室/街道/森林）</li>
                                <li>✓ 氛围设定（压抑/轻松/紧张）</li>
                                <li>✓ 环境细节（关键道具/特征）</li>
                                <li>✓ 场景描述（补充说明）</li>
                            </ul>
                        </CardContent>
                    </Card>

                    {/* 角色设定卡片 */}
                    <Card 
                        className="hover:shadow-2xl transition-all cursor-pointer border-2 hover:border-indigo-400"
                        onClick={() => router.push('/setup/characters')}
                    >
                        <CardHeader>
                            <div className="flex items-center gap-3 mb-2">
                                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center">
                                    <Users className="w-6 h-6 text-white" />
                                </div>
                                <CardTitle className="text-xl">角色设定</CardTitle>
                            </div>
                            <CardDescription className="text-sm">
                                设置角色的姓名、外观、性格、技能等属性
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <ul className="space-y-1 text-xs text-gray-600">
                                <li>✓ 基础信息（姓名、性别、年龄）</li>
                                <li>✓ 外观特征（发型、服饰）</li>
                                <li>✓ 性格属性（性格标签）</li>
                                <li>✓ 核心特质（技能、执念）</li>
                            </ul>
                        </CardContent>
                    </Card>
                </div>

                {/* 汇总确认卡片 */}
                <Card className="border-2 border-amber-400 bg-white/95">
                    <CardHeader>
                        <div className="flex items-center gap-3 mb-2">
                            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center">
                                <FileText className="w-6 h-6 text-white" />
                            </div>
                            <CardTitle className="text-2xl">确认并生成</CardTitle>
                        </div>
                        <CardDescription className="text-base">
                            完成角色、世界观、场景和主题风格定义后，查看汇总信息并生成剧情
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-3">
                            <Button
                                className="w-full h-12 text-lg bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600"
                                onClick={() => router.push('/setup/summary')}
                            >
                                查看汇总并生成 AI 剧情 ✨
                            </Button>
                            
                            <Button
                                variant="outline"
                                className="w-full h-10 gap-2"
                                onClick={() => router.push('/assets')}
                            >
                                <FolderOpen className="w-4 h-4" />
                                查看素材仓库
                            </Button>
                        </div>
                    </CardContent>
                </Card>

                {/* 返回首页 */}
                <div className="text-center mt-6">
                    <Button
                        variant="outline"
                        className="bg-white/20 text-white border-white/40 hover:bg-white/30"
                        onClick={() => router.push('/')}
                    >
                        ← 返回首页
                    </Button>
                </div>
            </div>
        </main>
    );
}
