'use client';

import { useRouter } from 'next/navigation';
import { Button, Card, CardHeader, CardTitle, CardDescription, CardContent } from '@vng/ui';
import { Users, Globe, Image, FileText, Palette, FolderOpen } from 'lucide-react';
import { t } from '@/i18n/client';

/**
 * 设置引导页 - 让用户选择开始定义角色还是背景
 */
export default function SetupPage() {
    const router = useRouter();

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
                        {t('key.setup.backToHome')}
                    </Button>
                </div>

                <div className="text-center mb-12">
                    <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-gradient-to-br from-indigo-500 to-purple-500 mb-6 shadow-xl">
                        <Palette className="w-10 h-10 text-white" />
                    </div>
                    <h1 className="text-5xl font-bold bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 bg-clip-text text-transparent mb-4">
                        {t('key.setup.title')}
                    </h1>
                    <p className="text-slate-600 text-lg max-w-2xl mx-auto">
                        {t('key.setup.description')}
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
                                <CardTitle className="text-xl text-slate-800">{t('key.setup.world.title')}</CardTitle>
                            </div>
                            <CardDescription className="text-sm text-slate-600">
                                {t('key.setup.world.description')}
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <ul className="space-y-1 text-xs text-slate-500">
                                <li>{t('key.setup.world.item1')}</li>
                                <li>{t('key.setup.world.item2')}</li>
                                <li>{t('key.setup.world.item3')}</li>
                                <li>{t('key.setup.world.item4')}</li>
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
                                <CardTitle className="text-xl text-slate-800">{t('key.setup.theme.title')}</CardTitle>
                            </div>
                            <CardDescription className="text-sm text-slate-600">
                                {t('key.setup.theme.description')}
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <ul className="space-y-1 text-xs text-slate-500">
                                <li>{t('key.setup.theme.item1')}</li>
                                <li>{t('key.setup.theme.item2')}</li>
                                <li>{t('key.setup.theme.item3')}</li>
                                <li>{t('key.setup.theme.item4')}</li>
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
                                <CardTitle className="text-xl text-slate-800">{t('key.setup.scenes.title')}</CardTitle>
                            </div>
                            <CardDescription className="text-sm text-slate-600">
                                {t('key.setup.scenes.description')}
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <ul className="space-y-1 text-xs text-slate-500">
                                <li>{t('key.setup.scenes.item1')}</li>
                                <li>{t('key.setup.scenes.item2')}</li>
                                <li>{t('key.setup.scenes.item3')}</li>
                                <li>{t('key.setup.scenes.item4')}</li>
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
                                <CardTitle className="text-xl text-slate-800">{t('key.setup.characters.title')}</CardTitle>
                            </div>
                            <CardDescription className="text-sm text-slate-600">
                                {t('key.setup.characters.description')}
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <ul className="space-y-1 text-xs text-slate-500">
                                <li>{t('key.setup.characters.item1')}</li>
                                <li>{t('key.setup.characters.item2')}</li>
                                <li>{t('key.setup.characters.item3')}</li>
                                <li>{t('key.setup.characters.item4')}</li>
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
                            <CardTitle className="text-xl text-slate-800">{t('key.setup.summary.title')}</CardTitle>
                        </div>
                        <CardDescription className="text-sm text-slate-600">
                            {t('key.setup.summary.description')}
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <ul className="space-y-1 text-xs text-slate-500">
                            <li>{t('key.setup.summary.item1')}</li>
                            <li>{t('key.setup.summary.item2')}</li>
                            <li>{t('key.setup.summary.item3')}</li>
                            <li>{t('key.setup.summary.item4')}</li>
                        </ul>
                    </CardContent>
                </Card>
            </div>
        </main>
    );
}
