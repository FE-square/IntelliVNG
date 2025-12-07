'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Card, CardHeader, CardTitle, CardContent, Input, useToast } from '@vng/ui';
import { ArrowLeft, Palette, Plus, X, Sparkles, Loader2 } from 'lucide-react';
import { useSetupStore } from '@/stores/setupStore';
import { createId } from '@vng/core';
import type { ThemeSetting } from '@vng/core';
import { useFormAutocomplete } from '@/hooks/useFormAutocomplete';
import { t } from '@/i18n/client';

// 预设主题选项
const THEME_OPTIONS = [
    '亲情羁绊',
    '友情救赎',
    '爱情成长',
    '善恶抉择',
    '反抗压迫',
    '探索未知',
    '复仇与原谅',
    '自我救赎',
    '权力斗争',
    '生存挑战',
];

// 预设风格选项
const STYLE_OPTIONS = [
    '悬疑推理',
    '浪漫言情',
    '热血战斗',
    '治愈日常',
    '暗黑惊悚',
    '轻喜剧',
    '史诗奇幻',
    '赛博朋克',
    '武侠江湖',
    '校园青春',
];

export default function ThemeSetupPage() {
    const router = useRouter();
    const toast = useToast();
    const { themeSetting, setThemeSetting, worldSetting, characters } = useSetupStore();
    const { isLoading: isAutocompleting, autocomplete } = useFormAutocomplete<ThemeSetting>('theme');
    
    const [selectedThemes, setSelectedThemes] = useState<string[]>([]);
    const [selectedStyles, setSelectedStyles] = useState<string[]>([]);
    const [customTheme, setCustomTheme] = useState('');
    const [customStyle, setCustomStyle] = useState('');
    const [tone, setTone] = useState('');
    const [description, setDescription] = useState('');

    // 加载已有设置
    useEffect(() => {
        if (themeSetting) {
            setSelectedThemes(themeSetting.themes || []);
            setSelectedStyles(themeSetting.styles || []);
            setTone(themeSetting.tone || '');
            setDescription(themeSetting.description || '');
        }
    }, [themeSetting]);

    const toggleTheme = (theme: string) => {
        setSelectedThemes(prev => 
            prev.includes(theme) ? prev.filter(t => t !== theme) : [...prev, theme]
        );
    };

    const toggleStyle = (style: string) => {
        setSelectedStyles(prev => 
            prev.includes(style) ? prev.filter(s => s !== style) : [...prev, style]
        );
    };

    const addCustomTheme = () => {
        if (customTheme.trim() && !selectedThemes.includes(customTheme.trim())) {
            setSelectedThemes([...selectedThemes, customTheme.trim()]);
            setCustomTheme('');
        }
    };

    const addCustomStyle = () => {
        if (customStyle.trim() && !selectedStyles.includes(customStyle.trim())) {
            setSelectedStyles([...selectedStyles, customStyle.trim()]);
            setCustomStyle('');
        }
    };

    const removeTheme = (theme: string) => {
        setSelectedThemes(selectedThemes.filter(t => t !== theme));
    };

    const removeStyle = (style: string) => {
        setSelectedStyles(selectedStyles.filter(s => s !== style));
    };

    // AI 自动建议主题和风格
    const handleAutocomplete = async () => {
        const currentData = {
            themes: selectedThemes,
            styles: selectedStyles,
            tone,
            description,
        };
        
        const result = await autocomplete(currentData, {
            worldSetting: worldSetting?.name,
            existingItems: characters.map(c => c.displayName),
        });
        
        if (result) {
            // 合并 AI 建议的主题和风格
            if (result.themes?.length) {
                setSelectedThemes(prev => {
                    const newThemes = result.themes.filter(t => !prev.includes(t));
                    return [...prev, ...newThemes];
                });
            }
            if (result.styles?.length) {
                setSelectedStyles(prev => {
                    const newStyles = result.styles.filter(s => !prev.includes(s));
                    return [...prev, ...newStyles];
                });
            }
            if (result.tone && !tone) {
                setTone(result.tone);
            }
            if (result.description && !description) {
                setDescription(result.description);
            }
        }
    };

    const handleSave = () => {
        if (selectedThemes.length === 0 || selectedStyles.length === 0) {
            toast.warning(t('key.theme.warning.selectRequired'));
            return;
        }

        const newThemeSetting: ThemeSetting = {
            id: themeSetting?.id || createId(),
            themes: selectedThemes,
            styles: selectedStyles,
            tone,
            description,
        };

        setThemeSetting(newThemeSetting);
        toast.success(t('key.theme.save.success'));
    };

    return (
        <main className="min-h-screen bg-gradient-to-br from-slate-50 via-pink-50 to-orange-50 p-8">
            <div className="max-w-5xl mx-auto">
                {/* 标题栏 */}
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <div className="flex items-center gap-3 mb-3">
                            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-pink-500 to-orange-500 flex items-center justify-center shadow-lg">
                                <Palette className="w-8 h-8 text-white" />
                            </div>
                            <div>
                                <h1 className="text-4xl font-bold bg-gradient-to-r from-pink-600 to-orange-600 bg-clip-text text-transparent mb-1">故事主题风格</h1>
                                <p className="text-slate-600">明确故事的核心主题与风格基调,让 AI 生成符合预期的剧情</p>
                            </div>
                        </div>
                    </div>
                    <div className="flex gap-3">
                        {/* AI 自动建议按钮 */}
                        <Button
                            variant="outline"
                            onClick={handleAutocomplete}
                            disabled={isAutocompleting}
                            className="gap-2 bg-gradient-to-r from-amber-50 to-orange-50 border-amber-300 hover:from-amber-100 hover:to-orange-100 shadow-sm"
                        >
                            {isAutocompleting ? (
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            ) : (
                                <Sparkles className="w-4 h-4 mr-2 text-amber-600" />
                            )}
                            <span className="text-amber-700 font-medium">
                                {isAutocompleting ? 'AI推荐中...' : 'AI帮我选'}
                            </span>
                        </Button>
                        <Button
                            variant="outline"
                            className="border-slate-300 hover:bg-slate-100"
                            onClick={() => router.push('/setup')}
                        >
                            <ArrowLeft className="w-4 h-4 mr-2" />
                            返回
                        </Button>
                    </div>
                </div>

                <div className="space-y-6">
                    {/* 主题选择 */}
                    <Card className="shadow-lg border-2 border-slate-200">
                        <CardHeader className="bg-gradient-to-br from-pink-50 to-rose-50">
                            <CardTitle className="flex items-center gap-2 text-slate-800">
                                <Palette className="w-5 h-5" />
                                核心主题(可多选)
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex flex-wrap gap-2">
                                {THEME_OPTIONS.map(theme => (
                                    <button
                                        key={theme}
                                        onClick={() => toggleTheme(theme)}
                                        className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                                            selectedThemes.includes(theme)
                                                ? 'bg-pink-600 text-white shadow-lg scale-105'
                                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                        }`}
                                    >
                                        {theme}
                                    </button>
                                ))}
                            </div>

                            {/* 自定义主题 */}
                            <div>
                                <label className="block text-sm font-medium mb-2">自定义主题</label>
                                <div className="flex gap-2">
                                    <Input
                                        value={customTheme}
                                        onChange={(e) => setCustomTheme(e.target.value)}
                                        placeholder="输入自定义主题，如：时间旅行"
                                        onKeyPress={(e) => e.key === 'Enter' && addCustomTheme()}
                                    />
                                    <Button onClick={addCustomTheme} size="sm">
                                        <Plus className="w-4 h-4" />
                                    </Button>
                                </div>
                            </div>

                            {/* 已选主题标签 */}
                            {selectedThemes.length > 0 && (
                                <div>
                                    <label className="block text-sm font-medium mb-2">已选择的主题</label>
                                    <div className="flex flex-wrap gap-2">
                                        {selectedThemes.map(theme => (
                                            <div
                                                key={theme}
                                                className="flex items-center gap-1 px-3 py-1 bg-pink-100 text-pink-800 rounded-full text-sm"
                                            >
                                                <span>{theme}</span>
                                                <button
                                                    onClick={() => removeTheme(theme)}
                                                    className="hover:bg-pink-200 rounded-full p-0.5"
                                                >
                                                    <X className="w-3 h-3" />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* 风格选择 */}
                    <Card className="shadow-lg border-2 border-slate-200">
                        <CardHeader className="bg-gradient-to-br from-purple-50 to-blue-50">
                            <CardTitle className="flex items-center gap-2 text-slate-800">
                                <Palette className="w-5 h-5" />
                                剧情风格(可多选)
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex flex-wrap gap-2">
                                {STYLE_OPTIONS.map(style => (
                                    <button
                                        key={style}
                                        onClick={() => toggleStyle(style)}
                                        className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                                            selectedStyles.includes(style)
                                                ? 'bg-purple-600 text-white shadow-lg scale-105'
                                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                        }`}
                                    >
                                        {style}
                                    </button>
                                ))}
                            </div>

                            {/* 自定义风格 */}
                            <div>
                                <label className="block text-sm font-medium mb-2">自定义风格</label>
                                <div className="flex gap-2">
                                    <Input
                                        value={customStyle}
                                        onChange={(e) => setCustomStyle(e.target.value)}
                                        placeholder="输入自定义风格，如：蒸汽朋克"
                                        onKeyPress={(e) => e.key === 'Enter' && addCustomStyle()}
                                    />
                                    <Button onClick={addCustomStyle} size="sm">
                                        <Plus className="w-4 h-4" />
                                    </Button>
                                </div>
                            </div>

                            {/* 已选风格标签 */}
                            {selectedStyles.length > 0 && (
                                <div>
                                    <label className="block text-sm font-medium mb-2">已选择的风格</label>
                                    <div className="flex flex-wrap gap-2">
                                        {selectedStyles.map(style => (
                                            <div
                                                key={style}
                                                className="flex items-center gap-1 px-3 py-1 bg-purple-100 text-purple-800 rounded-full text-sm"
                                            >
                                                <span>{style}</span>
                                                <button
                                                    onClick={() => removeStyle(style)}
                                                    className="hover:bg-purple-200 rounded-full p-0.5"
                                                >
                                                    <X className="w-3 h-3" />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* 基调与补充说明 */}
                    <Card className="shadow-lg border-2 border-slate-200">
                        <CardHeader className="bg-gradient-to-br from-amber-50 to-yellow-50">
                            <CardTitle className="text-slate-800">补充说明(可选)</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium mb-2">整体基调</label>
                                <Input
                                    value={tone}
                                    onChange={(e) => setTone(e.target.value)}
                                    placeholder="如：压抑悲伤、轻松幽默、紧张刺激"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-2">其他说明</label>
                                <textarea
                                    className="w-full border rounded px-3 py-2 min-h-[100px]"
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    placeholder="补充任何你希望 AI 了解的主题风格要求..."
                                />
                            </div>
                        </CardContent>
                    </Card>

                    {/* 保存按钮 */}
                    <div className="flex gap-4">
                        <Button
                            className="flex-1 bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-700 hover:to-purple-700 h-12 text-lg shadow-lg"
                            onClick={handleSave}
                        >
                            保存主题风格设定
                        </Button>
                    </div>
                </div>

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
                        className="bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 shadow-lg"
                        onClick={() => router.push('/setup/scenes')}
                    >
                        下一步:定义场景 →
                    </Button>
                </div>
            </div>
        </main>
    );
}
