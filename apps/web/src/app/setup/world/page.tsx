'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Card, CardHeader, CardTitle, CardContent, Input, useToast } from '@vng/ui';
import { ArrowLeft, Globe, Save, Sparkles, Loader2 } from 'lucide-react';
import { useSetupStore } from '@/stores/setupStore';
import { createId } from '@vng/core';
import type { WorldSetting } from '@vng/core';
import { useFormAutocomplete } from '@/hooks/useFormAutocomplete';
import { t } from '@/i18n/client';

export default function WorldSetupPage() {
    const router = useRouter();
    const toast = useToast();
    const { worldSetting, setWorldSetting, themeSetting } = useSetupStore();
    const { isLoading: isAutocompleting, autocomplete } = useFormAutocomplete<WorldSetting>('world');
    
    const [formData, setFormData] = useState<Partial<WorldSetting>>({
        name: '',
        era: '',
        location: '',
        rules: '',
        socialStructure: '',
        history: '',
        description: '',
    });

    // 加载已有设置
    useEffect(() => {
        if (worldSetting) {
            setFormData(worldSetting);
        }
    }, [worldSetting]);

    // AI 自动补全
    const handleAutocomplete = async () => {
        const result = await autocomplete(formData, {
            genre: themeSetting?.themes?.[0],
        });
        
        if (result) {
            setFormData({
                ...formData,
                ...result,
            });
        }
    };

    const handleSave = () => {
        if (!formData.name || !formData.era || !formData.location) {
            toast.warning(t('key.world.warning.fillRequired'));
            return;
        }

        const newWorldSetting: WorldSetting = {
            id: worldSetting?.id || createId(),
            name: formData.name,
            era: formData.era,
            location: formData.location,
            rules: formData.rules,
            socialStructure: formData.socialStructure,
            history: formData.history,
            description: formData.description,
        };

        setWorldSetting(newWorldSetting);
        toast.success(t('key.world.save.success'));
    };

    return (
        <main className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-purple-50 p-8">
            <div className="max-w-4xl mx-auto">
                {/* 标题栏 */}
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <div className="flex items-center gap-3 mb-3">
                            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center shadow-lg">
                                <Globe className="w-8 h-8 text-white" />
                            </div>
                            <div>
                                <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent mb-1">世界观设定</h1>
                                <p className="text-slate-600">构建故事的宏观背景框架</p>
                            </div>
                        </div>
                    </div>
                    <Button
                        variant="outline"
                        className="border-slate-300 hover:bg-slate-100"
                        onClick={() => router.push('/setup')}
                    >
                        <ArrowLeft className="w-4 h-4 mr-2" />
                        返回
                    </Button>
                </div>

                <Card className="shadow-lg border-2 border-slate-200">
                    <CardHeader className="bg-gradient-to-br from-purple-50 to-blue-50">
                        <div className="flex items-center justify-between">
                            <CardTitle className="flex items-center gap-2 text-slate-800">
                                <Globe className="w-5 h-5" />
                                定义世界观
                            </CardTitle>
                            {/* AI 自动补全按钮 */}
                            <Button
                                variant="outline"
                                onClick={handleAutocomplete}
                                disabled={isAutocompleting}
                                className="gap-2 bg-gradient-to-r from-amber-50 to-orange-50 border-amber-300 hover:from-amber-100 hover:to-orange-100 shadow-sm"
                            >
                                {isAutocompleting ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                    <Sparkles className="w-4 h-4 text-amber-600" />
                                )}
                                <span className="text-amber-700 font-medium">
                                    {isAutocompleting ? 'AI补全中...' : 'AI帮我填'}
                                </span>
                            </Button>
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        {/* 基础信息 */}
                        <div>
                            <h3 className="font-semibold text-lg mb-3 text-purple-900">基础设定</h3>
                            <div className="grid md:grid-cols-2 gap-4">
                                <div className="md:col-span-2">
                                    <label className="block text-sm font-medium mb-1">世界观名称 *</label>
                                    <Input
                                        value={formData.name || ''}
                                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                        placeholder="如：灵纪元、赛博都市2077"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1">时代背景 *</label>
                                    <Input
                                        value={formData.era || ''}
                                        onChange={(e) => setFormData({ ...formData, era: e.target.value })}
                                        placeholder="如：古风武侠、近现代都市、未来科幻"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1">地域范围 *</label>
                                    <Input
                                        value={formData.location || ''}
                                        onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                                        placeholder="如：架空大陆、真实城市、异次元空间"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* 核心规则 */}
                        <div>
                            <h3 className="font-semibold text-lg mb-3 text-indigo-900">核心规则</h3>
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium mb-1">规则体系</label>
                                    <textarea
                                        className="w-full border rounded px-3 py-2 min-h-[100px]"
                                        value={formData.rules || ''}
                                        onChange={(e) => setFormData({ ...formData, rules: e.target.value })}
                                        placeholder="描述魔法体系/科技上限/超能力限制/特殊规则等，如：修仙体系分为炼气、筑基、金丹..."
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1">社会结构</label>
                                    <textarea
                                        className="w-full border rounded px-3 py-2 min-h-[80px]"
                                        value={formData.socialStructure || ''}
                                        onChange={(e) => setFormData({ ...formData, socialStructure: e.target.value })}
                                        placeholder="如：王权统治、贵族阶级、公会体系、种族关系等"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* 历史背景 */}
                        <div>
                            <h3 className="font-semibold text-lg mb-3 text-blue-900">历史背景</h3>
                            <textarea
                                className="w-full border rounded px-3 py-2 min-h-[120px]"
                                value={formData.history || ''}
                                onChange={(e) => setFormData({ ...formData, history: e.target.value })}
                                placeholder="描述关键历史事件、王朝更迭、文明起源等，如：三百年前大灾变导致文明倒退..."
                            />
                        </div>

                        {/* 补充说明 */}
                        <div>
                            <h3 className="font-semibold text-lg mb-3 text-purple-900">补充说明</h3>
                            <textarea
                                className="w-full border rounded px-3 py-2 min-h-[100px]"
                                value={formData.description || ''}
                                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                placeholder="补充任何你希望加入的世界观细节..."
                            />
                        </div>

                        {/* 保存按钮 */}
                        <div className="pt-4 border-t">
                            <Button
                                className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 h-12 text-lg shadow-lg"
                                onClick={handleSave}
                            >
                                <Save className="w-5 h-5 mr-2" />
                                保存世界观设定
                            </Button>
                        </div>
                    </CardContent>
                </Card>

                {/* 底部导航 */}
                <div className="mt-8 flex justify-between">
                    <Button
                        variant="outline"
                        className="border-slate-300 hover:bg-slate-100"
                        onClick={() => router.push('/setup')}
                    >
                        ← 返回设置
                    </Button>
                    <Button
                        className="bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 shadow-lg"
                        onClick={() => router.push('/setup/theme')}
                    >
                        下一步:主题风格 →
                    </Button>
                </div>
            </div>
        </main>
    );
}
