'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Card, CardContent } from '@vng/ui';
import { ArrowLeft, Image as ImageIcon, Users, MapPin, Sparkles, Database } from 'lucide-react';
import { useSetupStore } from '@/stores/setupStore';

// Mock 数据 - 用于无数据时的展示调试
const MOCK_DATA = {
    characters: [
        {
            id: 'mock-char-1',
            displayName: '星野·亚特拉斯',
            avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Felix',
            sprites: [
                { id: 's1', imageUrl: 'https://placehold.co/400x600/6366f1/ffffff/png?text=Hoshino+Normal', emotion: '常态' },
                { id: 's2', imageUrl: 'https://placehold.co/400x600/818cf8/ffffff/png?text=Hoshino+Happy', emotion: '开心' },
                { id: 's3', imageUrl: 'https://placehold.co/400x600/4f46e5/ffffff/png?text=Hoshino+Angry', emotion: '生气' }
            ]
        },
        {
            id: 'mock-char-2',
            displayName: '月咏·希尔',
            avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Luna',
            sprites: [
                { id: 's4', imageUrl: 'https://placehold.co/400x600/ec4899/ffffff/png?text=Tsukuyomi+Normal', emotion: '常态' },
                { id: 's5', imageUrl: 'https://placehold.co/400x600/db2777/ffffff/png?text=Tsukuyomi+Shy', emotion: '害羞' }
            ]
        },
        {
            id: 'mock-char-3',
            displayName: 'K-99',
            avatarUrl: 'https://api.dicebear.com/7.x/bottts/svg?seed=Robot',
            sprites: [
                { id: 's6', imageUrl: 'https://placehold.co/400x600/64748b/ffffff/png?text=Mecha+Active', emotion: '运行中' }
            ]
        }
    ],
    scenes: [
        { id: 'sc1', name: '新都中央广场', imageUrl: 'https://placehold.co/800x450/e0e7ff/4f46e5/png?text=Central+City', type: '城市' },
        { id: 'sc2', name: '量子研究所', imageUrl: 'https://placehold.co/800x450/f0f9ff/0ea5e9/png?text=Quantum+Lab', type: '科幻' },
        { id: 'sc3', name: '旧城区遗址', imageUrl: 'https://placehold.co/800x450/fff7ed/ea580c/png?text=Ruins', type: '废土' },
        { id: 'sc4', name: '深海回廊', imageUrl: 'https://placehold.co/800x450/0f172a/94a3b8/png?text=Deep+Sea', type: '自然' },
    ]
};

/**
 * 素材仓库 - 集中管理所有视觉素材
 * 包含:角色立绘、角色头像、场景背景图
 */
export default function AssetsPage() {
    const router = useRouter();
    const { characters: storeCharacters, scenes: storeScenes } = useSetupStore();
    const [activeTab, setActiveTab] = useState<'sprites' | 'avatars' | 'backgrounds'>('sprites');
    const [isClient, setIsClient] = useState(false);

    useEffect(() => {
        setIsClient(true);
    }, []);

    // 只有在客户端加载完成后，且 Store 为空时，才启用 Mock 数据
    const useMock = isClient && storeCharacters.length === 0 && storeScenes.length === 0;

    const characters = useMock ? (MOCK_DATA.characters as any[]) : storeCharacters;
    const scenes = useMock ? (MOCK_DATA.scenes as any[]) : storeScenes;

    // 收集所有角色立绘
    const allSprites = characters.flatMap(char =>
        (char.sprites || []).map((sprite: any) => ({
            ...sprite,
            characterId: char.id,
            characterName: char.displayName,
        }))
    );

    // 收集所有头像
    const allAvatars = characters
        .filter(char => char.avatarUrl)
        .map(char => ({
            id: char.id,
            name: char.displayName,
            avatarUrl: char.avatarUrl,
        }));

    // 收集所有场景背景
    const allBackgrounds = scenes
        .filter(scene => scene.imageUrl)
        .map(scene => ({
            id: scene.id,
            name: scene.name,
            imageUrl: scene.imageUrl,
            type: scene.type,
        }));

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-indigo-50 to-purple-50 p-8">
            <div className="container mx-auto max-w-7xl">
                {/* 头部 */}
                <div className="mb-8">
                    <Button
                        variant="outline"
                        className="mb-6 border-slate-200 text-slate-600 hover:bg-slate-100"
                        onClick={() => router.back()}
                    >
                        <ArrowLeft className="w-4 h-4 mr-2" />
                        返回
                    </Button>

                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-600 to-pink-600 flex items-center justify-center shadow-lg">
                                <Sparkles className="w-6 h-6 text-white" />
                            </div>
                            <div>
                                <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-pink-600">
                                    素材仓库
                                </h1>
                                <p className="text-slate-600 mt-1">
                                    集中管理所有角色立绘、头像和场景背景图
                                </p>
                            </div>
                        </div>
                        {useMock && (
                            <div className="flex items-center gap-2 px-4 py-2 bg-amber-50 border border-amber-200 rounded-full text-amber-700 text-sm animate-pulse">
                                <Database className="w-4 h-4" />
                                预览模式 (Mock数据)
                            </div>
                        )}
                    </div>
                </div>

                {/* Tab切换 */}
                <div className="flex gap-3 mb-6">
                    <Button
                        onClick={() => setActiveTab('sprites')}
                        variant={activeTab === 'sprites' ? 'default' : 'outline'}
                        className={activeTab === 'sprites'
                            ? 'bg-indigo-600 hover:bg-indigo-700 shadow-md'
                            : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                        }
                    >
                        <Users className="w-4 h-4 mr-2" />
                        角色立绘
                        <span className="ml-2 bg-white/20 px-2 py-0.5 rounded-full text-xs">
                            {allSprites.length}
                        </span>
                    </Button>
                    <Button
                        onClick={() => setActiveTab('avatars')}
                        variant={activeTab === 'avatars' ? 'default' : 'outline'}
                        className={activeTab === 'avatars'
                            ? 'bg-indigo-600 hover:bg-indigo-700 shadow-md'
                            : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                        }
                    >
                        <ImageIcon className="w-4 h-4 mr-2" />
                        角色头像
                        <span className="ml-2 bg-white/20 px-2 py-0.5 rounded-full text-xs">
                            {allAvatars.length}
                        </span>
                    </Button>
                    <Button
                        onClick={() => setActiveTab('backgrounds')}
                        variant={activeTab === 'backgrounds' ? 'default' : 'outline'}
                        className={activeTab === 'backgrounds'
                            ? 'bg-indigo-600 hover:bg-indigo-700 shadow-md'
                            : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                        }
                    >
                        <MapPin className="w-4 h-4 mr-2" />
                        场景背景
                        <span className="ml-2 bg-white/20 px-2 py-0.5 rounded-full text-xs">
                            {allBackgrounds.length}
                        </span>
                    </Button>
                </div>
                {/* 统计信息 */}
                <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                    <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-100 shadow-sm hover:shadow-md transition-shadow">
                        <CardContent className="p-6 flex items-center justify-between">
                            <div>
                                <p className="text-slate-500 text-sm font-medium mb-1">角色立绘总数</p>
                                <p className="text-4xl font-bold text-indigo-600">{allSprites.length}</p>
                            </div>
                            <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center text-indigo-500 shadow-sm">
                                <Users className="w-6 h-6" />
                            </div>
                        </CardContent>
                    </Card>
                    <Card className="bg-gradient-to-br from-emerald-50 to-teal-50 border-emerald-100 shadow-sm hover:shadow-md transition-shadow">
                        <CardContent className="p-6 flex items-center justify-between">
                            <div>
                                <p className="text-slate-500 text-sm font-medium mb-1">角色头像总数</p>
                                <p className="text-4xl font-bold text-emerald-600">{allAvatars.length}</p>
                            </div>
                            <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center text-emerald-500 shadow-sm">
                                <ImageIcon className="w-6 h-6" />
                            </div>
                        </CardContent>
                    </Card>
                    <Card className="bg-gradient-to-br from-amber-50 to-orange-50 border-amber-100 shadow-sm hover:shadow-md transition-shadow">
                        <CardContent className="p-6 flex items-center justify-between">
                            <div>
                                <p className="text-slate-500 text-sm font-medium mb-1">场景背景总数</p>
                                <p className="text-4xl font-bold text-amber-600">{allBackgrounds.length}</p>
                            </div>
                            <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center text-amber-500 shadow-sm">
                                <MapPin className="w-6 h-6" />
                            </div>
                        </CardContent>
                    </Card>
                </div>
                {/* 内容区 */}
                <Card className="bg-white shadow-xl border-slate-200">
                    <CardContent className="p-6 min-h-[500px]">
                        {/* 角色立绘 */}
                        {activeTab === 'sprites' && (
                            <div className="space-y-6">
                                <div className="flex items-center justify-between">
                                    <h2 className="text-xl font-semibold text-slate-800 flex items-center gap-2">
                                        <Users className="w-5 h-5 text-indigo-500" />
                                        角色立绘库
                                    </h2>
                                </div>
                                {allSprites.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center py-20 text-slate-400 bg-slate-50 rounded-xl border-2 border-dashed border-slate-200">
                                        <Users className="w-12 h-12 mb-4 opacity-50" />
                                        <p>暂无立绘素材</p>
                                        <p className="text-sm mt-2">请在角色设定中生成</p>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
                                        {allSprites.map((sprite) => (
                                            <div key={sprite.id} className="group relative bg-slate-50 rounded-xl p-3 border border-slate-200 hover:shadow-lg hover:border-indigo-300 transition-all duration-300">
                                                <div className="aspect-[2/3] bg-white rounded-lg overflow-hidden border border-slate-100 shadow-sm relative">
                                                    <img
                                                        src={sprite.imageUrl}
                                                        alt={sprite.characterName}
                                                        className="w-full h-full object-cover transform group-hover:scale-105 transition-transform duration-500"
                                                    />
                                                </div>
                                                <div className="mt-3 text-center">
                                                    <p className="font-semibold text-slate-800 truncate">{sprite.characterName}</p>
                                                    <span className="inline-block mt-1 px-2 py-0.5 bg-indigo-50 text-indigo-600 text-xs rounded-full border border-indigo-100">
                                                        {sprite.emotion}
                                                    </span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* 角色头像 */}
                        {activeTab === 'avatars' && (
                            <div className="space-y-6">
                                <div className="flex items-center justify-between">
                                    <h2 className="text-xl font-semibold text-slate-800 flex items-center gap-2">
                                        <ImageIcon className="w-5 h-5 text-indigo-500" />
                                        角色头像库
                                    </h2>
                                </div>
                                {allAvatars.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center py-20 text-slate-400 bg-slate-50 rounded-xl border-2 border-dashed border-slate-200">
                                        <ImageIcon className="w-12 h-12 mb-4 opacity-50" />
                                        <p>暂无头像素材</p>
                                        <p className="text-sm mt-2">请在角色设定中生成</p>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-3 md:grid-cols-5 lg:grid-cols-7 xl:grid-cols-8 gap-6">
                                        {allAvatars.map((avatar) => (
                                            <div key={avatar.id} className="group flex flex-col items-center bg-slate-50 rounded-xl p-4 border border-slate-200 hover:shadow-lg hover:border-indigo-300 transition-all duration-300">
                                                <div className="w-20 h-20 bg-white rounded-full overflow-hidden border-2 border-white shadow-md group-hover:border-indigo-200 transition-colors relative">
                                                    <img
                                                        src={avatar.avatarUrl}
                                                        alt={avatar.name}
                                                        className="w-full h-full object-cover transform group-hover:scale-105 transition-transform duration-500"
                                                    />
                                                </div>
                                                <p className="mt-3 font-semibold text-slate-800 text-sm truncate w-full text-center">{avatar.name}</p>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* 场景背景 */}
                        {activeTab === 'backgrounds' && (
                            <div className="space-y-6">
                                <div className="flex items-center justify-between">
                                    <h2 className="text-xl font-semibold text-slate-800 flex items-center gap-2">
                                        <MapPin className="w-5 h-5 text-indigo-500" />
                                        场景背景库
                                    </h2>
                                </div>
                                {allBackgrounds.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center py-20 text-slate-400 bg-slate-50 rounded-xl border-2 border-dashed border-slate-200">
                                        <MapPin className="w-12 h-12 mb-4 opacity-50" />
                                        <p>暂无背景素材</p>
                                        <p className="text-sm mt-2">请在场景设定中生成</p>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                        {allBackgrounds.map((bg) => (
                                            <div key={bg.id} className="group bg-slate-50 rounded-xl p-3 border border-slate-200 hover:shadow-lg hover:border-indigo-300 transition-all duration-300">
                                                <div className="aspect-video bg-white rounded-lg overflow-hidden border border-slate-100 shadow-sm relative">
                                                    <img
                                                        src={bg.imageUrl}
                                                        alt={bg.name}
                                                        className="w-full h-full object-cover transform group-hover:scale-105 transition-transform duration-500"
                                                    />
                                                </div>
                                                <div className="mt-3 flex items-center justify-between px-1">
                                                    <p className="font-semibold text-slate-800">{bg.name}</p>
                                                    <span className="px-2 py-0.5 bg-indigo-50 text-indigo-600 text-xs rounded-full border border-indigo-100">
                                                        {bg.type}
                                                    </span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </CardContent>
                </Card>

            </div>
        </div>
    );
}
