'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Card, CardContent } from '@vng/ui';
import { ArrowLeft, Image as ImageIcon, Users, MapPin, Trash2 } from 'lucide-react';
import { useSetupStore } from '@/stores/setupStore';

/**
 * 素材仓库 - 集中管理所有视觉素材
 * 包含:角色立绘、角色头像、场景背景图
 */
export default function AssetsPage() {
    const router = useRouter();
    const { characters, scenes } = useSetupStore();
    const [activeTab, setActiveTab] = useState<'sprites' | 'avatars' | 'backgrounds'>('sprites');

    // 收集所有角色立绘
    const allSprites = characters.flatMap(char => 
        (char.sprites || []).map(sprite => ({
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
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
            <div className="container mx-auto px-4 py-8">
                {/* 头部 */}
                <div className="mb-8">
                    <Button
                        variant="outline"
                        className="mb-4 bg-white/10 text-white border-white/20"
                        onClick={() => router.back()}
                    >
                        <ArrowLeft className="w-4 h-4 mr-2" />
                        返回
                    </Button>
                    <h1 className="text-4xl font-bold text-white mb-2">🎨 素材仓库</h1>
                    <p className="text-white/60">集中管理所有角色立绘、头像和场景背景图</p>
                </div>

                {/* Tab切换 */}
                <div className="flex gap-2 mb-6">
                    <Button
                        onClick={() => setActiveTab('sprites')}
                        className={activeTab === 'sprites' 
                            ? 'bg-blue-600 text-white' 
                            : 'bg-white/10 text-white/70 hover:bg-white/20'
                        }
                    >
                        <Users className="w-4 h-4 mr-2" />
                        角色立绘 ({allSprites.length})
                    </Button>
                    <Button
                        onClick={() => setActiveTab('avatars')}
                        className={activeTab === 'avatars' 
                            ? 'bg-green-600 text-white' 
                            : 'bg-white/10 text-white/70 hover:bg-white/20'
                        }
                    >
                        <ImageIcon className="w-4 h-4 mr-2" />
                        角色头像 ({allAvatars.length})
                    </Button>
                    <Button
                        onClick={() => setActiveTab('backgrounds')}
                        className={activeTab === 'backgrounds' 
                            ? 'bg-amber-600 text-white' 
                            : 'bg-white/10 text-white/70 hover:bg-white/20'
                        }
                    >
                        <MapPin className="w-4 h-4 mr-2" />
                        场景背景 ({allBackgrounds.length})
                    </Button>
                </div>

                {/* 内容区 */}
                <Card className="bg-white/95 backdrop-blur">
                    <CardContent className="p-6">
                        {/* 角色立绘 */}
                        {activeTab === 'sprites' && (
                            <div className="space-y-4">
                                <h2 className="text-xl font-semibold mb-4">角色立绘库</h2>
                                {allSprites.length === 0 ? (
                                    <div className="text-center text-gray-500 py-12">
                                        暂无立绘素材,请在角色设定中生成
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                                        {allSprites.map((sprite) => (
                                            <div key={sprite.id} className="group relative">
                                                <div className="aspect-[2/3] bg-gray-100 rounded-lg overflow-hidden border-2 border-gray-200 hover:border-blue-400 transition-colors">
                                                    <img
                                                        src={sprite.imageUrl}
                                                        alt={sprite.characterName}
                                                        className="w-full h-full object-cover"
                                                    />
                                                </div>
                                                <div className="mt-2">
                                                    <p className="text-sm font-medium truncate">{sprite.characterName}</p>
                                                    <p className="text-xs text-gray-500">{sprite.emotion}</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* 角色头像 */}
                        {activeTab === 'avatars' && (
                            <div className="space-y-4">
                                <h2 className="text-xl font-semibold mb-4">角色头像库</h2>
                                {allAvatars.length === 0 ? (
                                    <div className="text-center text-gray-500 py-12">
                                        暂无头像素材,请在角色设定中生成
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-3 md:grid-cols-6 lg:grid-cols-8 gap-4">
                                        {allAvatars.map((avatar) => (
                                            <div key={avatar.id} className="group text-center">
                                                <div className="w-20 h-20 mx-auto bg-gray-100 rounded-full overflow-hidden border-2 border-gray-200 hover:border-green-400 transition-colors">
                                                    <img
                                                        src={avatar.avatarUrl}
                                                        alt={avatar.name}
                                                        className="w-full h-full object-cover"
                                                    />
                                                </div>
                                                <p className="mt-2 text-sm font-medium truncate">{avatar.name}</p>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* 场景背景 */}
                        {activeTab === 'backgrounds' && (
                            <div className="space-y-4">
                                <h2 className="text-xl font-semibold mb-4">场景背景库</h2>
                                {allBackgrounds.length === 0 ? (
                                    <div className="text-center text-gray-500 py-12">
                                        暂无背景素材,请在场景设定中生成
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                        {allBackgrounds.map((bg) => (
                                            <div key={bg.id} className="group">
                                                <div className="aspect-video bg-gray-100 rounded-lg overflow-hidden border-2 border-gray-200 hover:border-amber-400 transition-colors">
                                                    <img
                                                        src={bg.imageUrl}
                                                        alt={bg.name}
                                                        className="w-full h-full object-cover"
                                                    />
                                                </div>
                                                <div className="mt-2">
                                                    <p className="text-sm font-medium">{bg.name}</p>
                                                    <p className="text-xs text-gray-500">{bg.type}</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* 统计信息 */}
                <div className="mt-6 grid grid-cols-3 gap-4">
                    <Card className="bg-blue-50">
                        <CardContent className="p-4 text-center">
                            <p className="text-3xl font-bold text-blue-600">{allSprites.length}</p>
                            <p className="text-sm text-gray-600">角色立绘</p>
                        </CardContent>
                    </Card>
                    <Card className="bg-green-50">
                        <CardContent className="p-4 text-center">
                            <p className="text-3xl font-bold text-green-600">{allAvatars.length}</p>
                            <p className="text-sm text-gray-600">角色头像</p>
                        </CardContent>
                    </Card>
                    <Card className="bg-amber-50">
                        <CardContent className="p-4 text-center">
                            <p className="text-3xl font-bold text-amber-600">{allBackgrounds.length}</p>
                            <p className="text-sm text-gray-600">场景背景</p>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
