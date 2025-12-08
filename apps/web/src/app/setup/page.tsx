'use client';

import { Suspense } from 'react';
import { Button, Card, CardHeader, CardTitle, CardDescription, CardContent } from '@vng/ui';
import { Users, Globe, Image, FileText, Palette, FolderOpen } from 'lucide-react';
import { useI18N } from '@/components/I18nProvider';
import { useRouterWithParams } from '@/hooks/useRouterWithParams';

/**
 * 设置引导页 - 让用户选择开始定义角色还是背景
 */
function SetupPageContent() {
    const router = useRouterWithParams();
    const { t, I18N } = useI18N();
    return (
        <main className="min-h-screen bg-gradient-to-br from-slate-50 via-indigo-50 to-purple-50 p-8">
            <div className="max-w-4xl mx-auto">
                {/* 返回首页按钮 */}
                <div className="mb-6">
                    <Button
                        variant="outline"
                        className="border-slate-300 hover:bg-slate-100"
                        onClick={() => router.push('/')}
                    >
                        <span suppressHydrationWarning>{I18N['key.setup.backToHome'] || '← 返回首页'}</span>
                    </Button>
                </div>

                <div className="text-center mb-12">
                    <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-gradient-to-br from-indigo-500 to-purple-500 mb-6 shadow-xl">
                        <Palette className="w-10 h-10 text-white" />
                    </div>
                    <h1 className="text-5xl font-bold bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 bg-clip-text text-transparent mb-4" suppressHydrationWarning>
                        {I18N['key.setup.title'] || '开始创作你的视觉小说'}
                    </h1>
                    <p className="text-slate-600 text-lg max-w-2xl mx-auto" suppressHydrationWarning>
                        {I18N['key.setup.description'] || '先定义角色、世界观和场景，AI 将基于你的设定生成精彩的多分支剧情'}
                    </p>
                </div>

                <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                    {/* 世界观设定卡片 */}
                    <Card 
                        className="hover:shadow-2xl hover:scale-105 transition-all cursor-pointer border-2 border-slate-200 bg-white group"
                        onClick={() => router.push('/setup/world')}
                    >
                        <CardHeader>
                            <div className="flex items-center gap-3 mb-2">
                                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center group-hover:scale-110 transition-transform shadow-md">
                                    <Globe className="w-6 h-6 text-white" />
                                </div>
                                <CardTitle className="text-xl text-slate-800" suppressHydrationWarning>
                                    {I18N['key.setup.world.title'] || '世界观设定'}
                                </CardTitle>
                            </div>
                            <CardDescription className="text-sm text-slate-600" suppressHydrationWarning>
                                {I18N['key.setup.world.description'] || '定义时代、地域、社会规则'}
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <ul className="space-y-1 text-xs text-slate-500">
                                <li suppressHydrationWarning>{I18N['key.setup.world.item1'] || '✓ 时代背景'}</li>
                                <li suppressHydrationWarning>{I18N['key.setup.world.item2'] || '✓ 地域设定'}</li>
                                <li suppressHydrationWarning>{I18N['key.setup.world.item3'] || '✓ 核心规则'}</li>
                                <li suppressHydrationWarning>{I18N['key.setup.world.item4'] || '✓ 社会结构'}</li>
                            </ul>
                        </CardContent>
                    </Card>

                    {/* 故事主题风格卡片 */}
                    <Card 
                        className="hover:shadow-2xl hover:scale-105 transition-all cursor-pointer border-2 border-slate-200 bg-white group"
                        onClick={() => router.push('/setup/theme')}
                    >
                        <CardHeader>
                            <div className="flex items-center gap-3 mb-2">
                                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-pink-500 to-rose-500 flex items-center justify-center group-hover:scale-110 transition-transform shadow-md">
                                    <Palette className="w-6 h-6 text-white" />
                                </div>
                                <CardTitle className="text-xl text-slate-800" suppressHydrationWarning>
                                    {I18N['key.setup.theme.title'] || '故事主题风格'}
                                </CardTitle>
                            </div>
                            <CardDescription className="text-sm text-slate-600" suppressHydrationWarning>
                                {I18N['key.setup.theme.description'] || '核心主题与整体风格基调'}
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <ul className="space-y-1 text-xs text-slate-500">
                                <li suppressHydrationWarning>{I18N['key.setup.theme.item1'] || '✓ 核心主题'}</li>
                                <li suppressHydrationWarning>{I18N['key.setup.theme.item2'] || '✓ 剧情风格'}</li>
                                <li suppressHydrationWarning>{I18N['key.setup.theme.item3'] || '✓ 整体基调'}</li>
                                <li suppressHydrationWarning>{I18N['key.setup.theme.item4'] || '✓ 情感氛围'}</li>
                            </ul>
                        </CardContent>
                    </Card>

                    {/* 场景设定卡片 */}
                    <Card 
                        className="hover:shadow-2xl hover:scale-105 transition-all cursor-pointer border-2 border-slate-200 bg-white group"
                        onClick={() => router.push('/setup/scenes')}
                    >
                        <CardHeader>
                            <div className="flex items-center gap-3 mb-2">
                                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-green-500 to-teal-500 flex items-center justify-center group-hover:scale-110 transition-transform shadow-md">
                                    <Image className="w-6 h-6 text-white" />
                                </div>
                                <CardTitle className="text-xl text-slate-800" suppressHydrationWarning>
                                    {I18N['key.setup.scenes.title'] || '场景设定'}
                                </CardTitle>
                            </div>
                            <CardDescription className="text-sm text-slate-600" suppressHydrationWarning>
                                {I18N['key.setup.scenes.description'] || '关键场景的类型与氛围'}
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <ul className="space-y-1 text-xs text-slate-500">
                                <li suppressHydrationWarning>{I18N['key.setup.scenes.item1'] || '✓ 场景类型'}</li>
                                <li suppressHydrationWarning>{I18N['key.setup.scenes.item2'] || '✓ 氛围设定'}</li>
                                <li suppressHydrationWarning>{I18N['key.setup.scenes.item3'] || '✓ 环境细节'}</li>
                                <li suppressHydrationWarning>{I18N['key.setup.scenes.item4'] || '✓ 场景描述'}</li>
                            </ul>
                        </CardContent>
                    </Card>

                    {/* 角色设定卡片 */}
                    <Card 
                        className="hover:shadow-2xl hover:scale-105 transition-all cursor-pointer border-2 border-slate-200 bg-white group"
                        onClick={() => router.push('/setup/characters')}
                    >
                        <CardHeader>
                            <div className="flex items-center gap-3 mb-2">
                                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center group-hover:scale-110 transition-transform shadow-md">
                                    <Users className="w-6 h-6 text-white" />
                                </div>
                                <CardTitle className="text-xl text-slate-800" suppressHydrationWarning>
                                    {I18N['key.setup.characters.title'] || '角色设定'}
                                </CardTitle>
                            </div>
                            <CardDescription className="text-sm text-slate-600" suppressHydrationWarning>
                                {I18N['key.setup.characters.description'] || '角色的外观、性格、技能'}
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <ul className="space-y-1 text-xs text-slate-500">
                                <li suppressHydrationWarning>{I18N['key.setup.characters.item1'] || '✓ 基础信息'}</li>
                                <li suppressHydrationWarning>{I18N['key.setup.characters.item2'] || '✓ 外观特征'}</li>
                                <li suppressHydrationWarning>{I18N['key.setup.characters.item3'] || '✓ 性格属性'}</li>
                                <li suppressHydrationWarning>{I18N['key.setup.characters.item4'] || '✓ 核心特质'}</li>
                            </ul>
                        </CardContent>
                    </Card>
                </div>

                {/* 汇总确认卡片 */}
                <Card className="hover:shadow-2xl hover:scale-105 transition-all cursor-pointer border-2 border-amber-300 bg-white group"
                    onClick={() => router.push('/setup/summary')}
                >
                    <CardHeader>
                        <div className="flex items-center gap-3 mb-2">
                            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center group-hover:scale-110 transition-transform shadow-md">
                                <FileText className="w-6 h-6 text-white" />
                            </div>
                            <CardTitle className="text-xl text-slate-800" suppressHydrationWarning>
                                {I18N['key.setup.summary.title'] || '确认并生成'}
                            </CardTitle>
                        </div>
                        <CardDescription className="text-sm text-slate-600" suppressHydrationWarning>
                            {I18N['key.setup.summary.description'] || '查看汇总并生成AI剧情'}
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <ul className="space-y-1 text-xs text-slate-500">
                            <li suppressHydrationWarning>{I18N['key.setup.summary.item1'] || '✓ 查看设定汇总'}</li>
                            <li suppressHydrationWarning>{I18N['key.setup.summary.item2'] || '✓ 生成多分支剧情'}</li>
                            <li suppressHydrationWarning>{I18N['key.setup.summary.item3'] || '✓ 视觉化编辑器'}</li>
                            <li suppressHydrationWarning>{I18N['key.setup.summary.item4'] || '✓ 导出游戏项目'}</li>
                        </ul>
                    </CardContent>
                </Card>
            </div>
        </main>
    );
}

// 用 Suspense 包裹以支持 useSearchParams
export default function SetupPage() {
    return (
        <Suspense fallback={<div className="min-h-screen bg-gradient-to-br from-slate-50 via-indigo-50 to-purple-50 flex items-center justify-center"><div className="text-lg">加载中...</div></div>}>
            <SetupPageContent />
        </Suspense>
    );
}
