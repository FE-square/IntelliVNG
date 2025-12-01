'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Card, CardHeader, CardTitle, CardContent, Input } from '@vng/ui';
import { Plus, Trash2, Save, ArrowLeft, Users, Image, Wand2 } from 'lucide-react';
import { useSetupStore } from '@/stores/setupStore';
import { createId } from '@vng/core';
import type { Character } from '@vng/core';

export default function CharactersPage() {
    const router = useRouter();
    const { characters, addCharacter, updateCharacter, removeCharacter } = useSetupStore();
    
    const [editingId, setEditingId] = useState<string | null>(null);
    const [formData, setFormData] = useState<Partial<Character>>({
        name: '',
        displayName: '',
        description: '',
        gender: 'male',
        age: '',
        identity: '',
        avatarUrl: '',
        appearance: {
            hairStyle: '',
            clothing: '',
            facialFeatures: '',
            bodyType: '',
            height: '',
            otherFeatures: '',
        },
        personality: {
            traits: [],
            temperament: '',
            values: '',
        },
        coreTraits: {
            specialSkills: [],
            obsession: '',
            relationships: [],
            backstory: '',
        },
    });
    const [isGeneratingSprite, setIsGeneratingSprite] = useState(false);
    const [isGeneratingAvatar, setIsGeneratingAvatar] = useState(false);

    const handleNewCharacter = () => {
        setEditingId('new');
        setFormData({
            name: '',
            displayName: '',
            description: '',
            gender: 'male',
            age: '',
            identity: '',
            avatarUrl: '',
            appearance: {},
            personality: {},
            coreTraits: {},
        });
    };

    // AI生成角色立绘(通义万相)
    const handleGenerateSprite = async () => {
        if (!formData.displayName || !formData.description) {
            alert('请先填写角色名称和描述');
            return;
        }

        setIsGeneratingSprite(true);
        try {
            // 构建prompt 
            // TODO 提示词等逻辑应该包在后端代码内，前端只传一些必要的输入；
            // 如果允许直接将提示词传入接口，可能会有接口被当作通用API 恶意滥用的安全风险。
            const prompt = `${formData.displayName}, ${formData.description}, ${formData.appearance?.hairStyle || ''}, ${formData.appearance?.clothing || ''}；生成一个单人的全身立绘, 动漫风格, 纯白色背景, 人物居中, 高质量, 清晰`;
            
            // 调用通义万相API生成图片
            // TODO 这里接口允许的参数应该设计成具体的ActionType，比如根据关键词生成角色立绘、根据关键词生成场景背景、根据立绘生成角色头像等
            // 那么参数就类似于 actionType, actionPayload: { description, refImageUrl }等，而不是像现在这样直接传入prompt。
            const response = await fetch('/api/generate-image', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ prompt, type: 'sprite' })
            });
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.details || '生成失败');
            }
            
            const { imageUrl } = await response.json();
            
            if (!imageUrl) {
                throw new Error('未获取到图片URL');
            }
            
            // 添加到sprites
            const newSprite = {
                id: createId(),
                emotion: 'neutral' as const,
                imageUrl,
                generationPrompt: prompt,
            };
            
            setFormData({
                ...formData,
                sprites: [...(formData.sprites || []), newSprite],
                defaultSpriteId: formData.defaultSpriteId || newSprite.id,
            });
            
            alert('✅ 立绘生成成功!\n\n💾 请点击「保存」按钮以保存到素材库');
        } catch (error) {
            console.error('生成失败:', error);
            alert(`生成失败: ${error instanceof Error ? error.message : '请重试'}`);
        } finally {
            setIsGeneratingSprite(false);
        }
    };

    // AI生成角色头像
    const handleGenerateAvatar = async () => {
        if (!formData.displayName || !formData.description) {
            alert('请先填写角色名称和描述');
            return;
        }

        setIsGeneratingAvatar(true);
        try {
            // 构建prompt - 头像特化 - ✅ 强化纯色背景
            const prompt = `${formData.displayName}, ${formData.description}, 头像特写, 圆形头像, 动漫风格, ${formData.appearance?.facialFeatures || ''}, 纯白色背景, 简洁, 高质量`;
            
            // 调用通义万相API生成头像
            const response = await fetch('/api/generate-image', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ prompt, type: 'avatar' })
            });
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.details || '生成失败');
            }
            
            const { imageUrl } = await response.json();
            
            if (!imageUrl) {
                throw new Error('未获取到图片URL');
            }
            
            setFormData({
                ...formData,
                avatarUrl: imageUrl,
            });
            
            alert('✅ 头像生成成功!\n\n💾 请点击「保存」按钮以保存到素材库');
        } catch (error) {
            console.error('生成失败:', error);
            alert(`生成失败: ${error instanceof Error ? error.message : '请重试'}`);
        } finally {
            setIsGeneratingAvatar(false);
        }
    };

    const handleSave = () => {
        if (!formData.name || !formData.displayName) {
            alert('请至少填写角色姓名和显示名称');
            return;
        }

        const character: Character = {
            id: editingId === 'new' ? createId() : editingId!,
            name: formData.name,
            displayName: formData.displayName,
            description: formData.description || '',
            gender: formData.gender,
            age: formData.age,
            identity: formData.identity,
            avatarUrl: formData.avatarUrl, // 保存头像
            appearance: formData.appearance,
            personality: formData.personality,
            coreTraits: formData.coreTraits,
            sprites: formData.sprites || [], // 保存立绘
            defaultSpriteId: formData.defaultSpriteId || '',
        };

        if (editingId === 'new') {
            addCharacter(character);
            alert('✅ 角色创建成功!\n\n立绘和头像已自动添加到素材库 🎨');
        } else {
            updateCharacter(editingId!, character);
            alert('✅ 角色更新成功!\n\n立绘和头像已自动同步到素材库 🎨');
        }

        setEditingId(null);
    };

    const handleEdit = (character: Character) => {
        setEditingId(character.id);
        setFormData(character);
    };

    const handleDelete = (id: string) => {
        if (confirm('确定要删除这个角色吗？')) {
            removeCharacter(id);
        }
    };

    return (
        <main className="min-h-screen bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 p-8">
            <div className="max-w-6xl mx-auto">
                {/* 标题栏 */}
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <h1 className="text-4xl font-bold text-white mb-2">👤 角色定义</h1>
                        <p className="text-white/80">设置角色的详细信息，让 AI 更好地理解你的角色</p>
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

                <div className="grid md:grid-cols-3 gap-6">
                    {/* 左侧：角色列表 */}
                    <div className="md:col-span-1 space-y-4">
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center justify-between">
                                    <span>角色列表 ({characters.length})</span>
                                    <Button size="sm" onClick={handleNewCharacter}>
                                        <Plus className="w-4 h-4 mr-1" />
                                        新增
                                    </Button>
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-2">
                                {characters.length === 0 && (
                                    <p className="text-gray-500 text-sm text-center py-4">
                                        还没有角色，点击「新增」创建第一个角色
                                    </p>
                                )}
                                {characters.map((char) => (
                                    <div
                                        key={char.id}
                                        className={`p-3 rounded border-2 cursor-pointer transition-all ${
                                            editingId === char.id
                                                ? 'border-indigo-500 bg-indigo-50'
                                                : 'border-gray-200 hover:border-indigo-300'
                                        }`}
                                        onClick={() => handleEdit(char)}
                                    >
                                        <div className="flex items-center gap-3">
                                            {/* 角色头像 */}
                                            <div className="w-12 h-12 flex-shrink-0">
                                                {char.avatarUrl ? (
                                                    <img
                                                        src={char.avatarUrl}
                                                        alt={char.displayName}
                                                        className="w-full h-full rounded-full object-cover border-2 border-gray-300"
                                                    />
                                                ) : (
                                                    <div className="w-full h-full rounded-full bg-gradient-to-br from-indigo-400 to-purple-400 flex items-center justify-center text-white font-bold text-lg">
                                                        {char.displayName.charAt(0)}
                                                    </div>
                                                )}
                                            </div>
                                            
                                            <div className="flex-1 min-w-0">
                                                <h3 className="font-medium text-gray-900 truncate">{char.displayName}</h3>
                                                <p className="text-xs text-gray-500 truncate">{char.identity || '未设置身份'}</p>
                                            </div>
                                            
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleDelete(char.id);
                                                }}
                                            >
                                                <Trash2 className="w-3 h-3" />
                                            </Button>
                                        </div>
                                    </div>
                                ))}
                            </CardContent>
                        </Card>
                    </div>

                    {/* 右侧：编辑表单 */}
                    <div className="md:col-span-2">
                        {editingId ? (
                            <Card>
                                <CardHeader>
                                    <CardTitle>
                                        {editingId === 'new' ? '创建新角色' : '编辑角色'}
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-6">
                                    {/* 基础信息 */}
                                    <div>
                                        <h3 className="font-semibold text-lg mb-3 text-indigo-900">基础信息</h3>
                                        <div className="grid md:grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-sm font-medium mb-1">角色姓名 *</label>
                                                <Input
                                                    value={formData.name || ''}
                                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                                    placeholder="如：张三、Alice"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium mb-1">显示名称 *</label>
                                                <Input
                                                    value={formData.displayName || ''}
                                                    onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
                                                    placeholder="如：勇敢的骑士、神秘女孩"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium mb-1">性别</label>
                                                <select
                                                    className="w-full border rounded px-3 py-2"
                                                    value={formData.gender || 'male'}
                                                    onChange={(e) => setFormData({ ...formData, gender: e.target.value as any })}
                                                >
                                                    <option value="male">男</option>
                                                    <option value="female">女</option>
                                                    <option value="other">其他</option>
                                                </select>
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium mb-1">年龄</label>
                                                <Input
                                                    value={formData.age || ''}
                                                    onChange={(e) => setFormData({ ...formData, age: e.target.value })}
                                                    placeholder="如：18、青年、中年"
                                                />
                                            </div>
                                            <div className="md:col-span-2">
                                                <label className="block text-sm font-medium mb-1">身份/职业</label>
                                                <Input
                                                    value={formData.identity || ''}
                                                    onChange={(e) => setFormData({ ...formData, identity: e.target.value })}
                                                    placeholder="如：学生、侦探、骑士、魔法师"
                                                />
                                            </div>
                                            <div className="md:col-span-2">
                                                <label className="block text-sm font-medium mb-1">角色描述</label>
                                                <textarea
                                                    className="w-full border rounded px-3 py-2 min-h-[80px]"
                                                    value={formData.description || ''}
                                                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                                    placeholder="简要描述这个角色的特点..."
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    {/* 外观特征 */}
                                    <div>
                                        <h3 className="font-semibold text-lg mb-3 text-purple-900">外观特征</h3>
                                        <div className="grid md:grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-sm font-medium mb-1">发型</label>
                                                <Input
                                                    value={formData.appearance?.hairStyle || ''}
                                                    onChange={(e) =>
                                                        setFormData({
                                                            ...formData,
                                                            appearance: { ...formData.appearance, hairStyle: e.target.value },
                                                        })
                                                    }
                                                    placeholder="如：长发、短发、卷发"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium mb-1">服饰</label>
                                                <Input
                                                    value={formData.appearance?.clothing || ''}
                                                    onChange={(e) =>
                                                        setFormData({
                                                            ...formData,
                                                            appearance: { ...formData.appearance, clothing: e.target.value },
                                                        })
                                                    }
                                                    placeholder="如：校服、盔甲、西装"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium mb-1">五官风格</label>
                                                <Input
                                                    value={formData.appearance?.facialFeatures || ''}
                                                    onChange={(e) =>
                                                        setFormData({
                                                            ...formData,
                                                            appearance: { ...formData.appearance, facialFeatures: e.target.value },
                                                        })
                                                    }
                                                    placeholder="如：温柔、锐利、稚嫩"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium mb-1">体型</label>
                                                <Input
                                                    value={formData.appearance?.bodyType || ''}
                                                    onChange={(e) =>
                                                        setFormData({
                                                            ...formData,
                                                            appearance: { ...formData.appearance, bodyType: e.target.value },
                                                        })
                                                    }
                                                    placeholder="如：纤细、健壮、匀称"
                                                />
                                            </div>
                                            <div className="md:col-span-2">
                                                <label className="block text-sm font-medium mb-1">其他特征</label>
                                                <Input
                                                    value={formData.appearance?.otherFeatures || ''}
                                                    onChange={(e) =>
                                                        setFormData({
                                                            ...formData,
                                                            appearance: { ...formData.appearance, otherFeatures: e.target.value },
                                                        })
                                                    }
                                                    placeholder="如：戴眼镜、有疤痕、佩戴项链"
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    {/* 视觉素材配置 */}
                                    <div>
                                        <h3 className="font-semibold text-lg mb-3 text-blue-900">🎨 视觉素材</h3>
                                        <div className="space-y-4">
                                            {/* 头像URL */}
                                            <div>
                                                <label className="block text-sm font-medium mb-2">角色头像</label>
                                                <div className="space-y-3">
                                                    {/* AI生成头像 */}
                                                    <div className="bg-gradient-to-r from-green-50 to-emerald-50 p-4 rounded-lg border border-green-200">
                                                        <p className="text-sm text-gray-600 mb-3">
                                                            使用AI生成角色头像(圆形头像特写)
                                                        </p>
                                                        <Button
                                                            onClick={handleGenerateAvatar}
                                                            disabled={isGeneratingAvatar || !formData.displayName}
                                                            className="w-full gap-2 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700"
                                                        >
                                                            <Wand2 className="w-4 h-4" />
                                                            {isGeneratingAvatar ? 'AI生成中...' : 'AI生成头像'}
                                                        </Button>
                                                    </div>
                                                    
                                                    {/* 手动输入URL */}
                                                    <div>
                                                        <label className="block text-xs text-gray-500 mb-1">或手动输入头像URL</label>
                                                        <Input
                                                            value={formData.avatarUrl || ''}
                                                            onChange={(e) => setFormData({ ...formData, avatarUrl: e.target.value })}
                                                            placeholder="粘贴头像图片链接"
                                                        />
                                                    </div>
                                                    
                                                    {/* 头像预览 */}
                                                    {formData.avatarUrl && (
                                                        <div className="flex items-center gap-3 bg-gray-50 p-3 rounded">
                                                            <img 
                                                                src={formData.avatarUrl} 
                                                                alt="头像预览" 
                                                                className="w-16 h-16 rounded-full object-cover border-2 border-gray-300"
                                                            />
                                                            <span className="text-sm text-gray-600">当前头像</span>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            {/* AI生成立绘 */}
                                            <div>
                                                <label className="block text-sm font-medium mb-2">角色立绘</label>
                                                <div className="bg-gradient-to-r from-blue-50 to-purple-50 p-4 rounded-lg border border-blue-200">
                                                    <p className="text-sm text-gray-600 mb-3">
                                                        基于角色外观描述，使用通义万相AI生成立绘图片
                                                    </p>
                                                    <Button
                                                        onClick={handleGenerateSprite}
                                                        disabled={isGeneratingSprite || !formData.displayName}
                                                        className="w-full gap-2 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
                                                    >
                                                        <Wand2 className="w-4 h-4" />
                                                        {isGeneratingSprite ? 'AI生成中...' : 'AI生成立绘'}
                                                    </Button>
                                                    <p className="text-xs text-gray-500 mt-2">
                                                        提示：请先填写角色名称和外观特征再生成
                                                    </p>
                                                </div>

                                                {/* 已生成的立绘列表 */}
                                                {formData.sprites && formData.sprites.length > 0 && (
                                                    <div className="mt-4 space-y-2">
                                                        <p className="text-sm font-medium">已生成立绘 ({formData.sprites.length})</p>
                                                        <div className="grid grid-cols-3 gap-2">
                                                            {formData.sprites.map((sprite, idx) => (
                                                                <div 
                                                                    key={sprite.id}
                                                                    className="relative group border-2 rounded overflow-hidden"
                                                                >
                                                                    <img 
                                                                        src={sprite.imageUrl} 
                                                                        alt={`立绘 ${idx + 1}`}
                                                                        className="w-full aspect-[2/3] object-cover"
                                                                    />
                                                                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                                                        <button
                                                                            onClick={() => {
                                                                                setFormData({
                                                                                    ...formData,
                                                                                    sprites: formData.sprites?.filter(s => s.id !== sprite.id),
                                                                                });
                                                                            }}
                                                                            className="p-2 bg-red-600 text-white rounded hover:bg-red-700"
                                                                        >
                                                                            <Trash2 className="w-4 h-4" />
                                                                        </button>
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {/* 性格属性 */}
                                    <div>
                                        <h3 className="font-semibold text-lg mb-3 text-pink-900">性格属性</h3>
                                        <div className="space-y-4">
                                            <div>
                                                <label className="block text-sm font-medium mb-1">性格标签</label>
                                                <Input
                                                    value={formData.personality?.traits?.join(', ') || ''}
                                                    onChange={(e) =>
                                                        setFormData({
                                                            ...formData,
                                                            personality: {
                                                                ...formData.personality,
                                                                traits: e.target.value.split(',').map((s) => s.trim()).filter(Boolean),
                                                            },
                                                        })
                                                    }
                                                    placeholder="用逗号分隔，如：开朗, 勇敢, 好奇"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium mb-1">性情倾向</label>
                                                <Input
                                                    value={formData.personality?.temperament || ''}
                                                    onChange={(e) =>
                                                        setFormData({
                                                            ...formData,
                                                            personality: { ...formData.personality, temperament: e.target.value },
                                                        })
                                                    }
                                                    placeholder="如：外向、内向、理性、感性"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium mb-1">价值观</label>
                                                <Input
                                                    value={formData.personality?.values || ''}
                                                    onChange={(e) =>
                                                        setFormData({
                                                            ...formData,
                                                            personality: { ...formData.personality, values: e.target.value },
                                                        })
                                                    }
                                                    placeholder="如：正义、自由、家庭"
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    {/* 核心特质 */}
                                    <div>
                                        <h3 className="font-semibold text-lg mb-3 text-green-900">核心特质</h3>
                                        <div className="space-y-4">
                                            <div>
                                                <label className="block text-sm font-medium mb-1">特殊技能</label>
                                                <Input
                                                    value={formData.coreTraits?.specialSkills?.join(', ') || ''}
                                                    onChange={(e) =>
                                                        setFormData({
                                                            ...formData,
                                                            coreTraits: {
                                                                ...formData.coreTraits,
                                                                specialSkills: e.target.value.split(',').map((s) => s.trim()).filter(Boolean),
                                                            },
                                                        })
                                                    }
                                                    placeholder="用逗号分隔，如：剑术, 魔法, 侦查"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium mb-1">执念/目标</label>
                                                <Input
                                                    value={formData.coreTraits?.obsession || ''}
                                                    onChange={(e) =>
                                                        setFormData({
                                                            ...formData,
                                                            coreTraits: { ...formData.coreTraits, obsession: e.target.value },
                                                        })
                                                    }
                                                    placeholder="如：寻找真相、保护家人"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium mb-1">背景故事</label>
                                                <textarea
                                                    className="w-full border rounded px-3 py-2 min-h-[100px]"
                                                    value={formData.coreTraits?.backstory || ''}
                                                    onChange={(e) =>
                                                        setFormData({
                                                            ...formData,
                                                            coreTraits: { ...formData.coreTraits, backstory: e.target.value },
                                                        })
                                                    }
                                                    placeholder="简要描述角色的过去经历..."
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    {/* 操作按钮 */}
                                    <div className="flex gap-3 pt-4 border-t">
                                        <Button
                                            className="flex-1 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700"
                                            onClick={handleSave}
                                        >
                                            <Save className="w-4 h-4 mr-2" />
                                            保存角色
                                        </Button>
                                        <Button
                                            variant="outline"
                                            onClick={() => setEditingId(null)}
                                        >
                                            取消
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>
                        ) : (
                            <Card className="h-full flex items-center justify-center min-h-[400px]">
                                <div className="text-center text-gray-500">
                                    <Users className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                                    <p>请从左侧选择一个角色进行编辑</p>
                                    <p className="text-sm mt-2">或点击「新增」按钮创建新角色</p>
                                </div>
                            </Card>
                        )}
                    </div>
                </div>

                {/* 底部导航 */}
                <div className="mt-8 flex justify-between">
                    <Button
                        variant="outline"
                        className="bg-white/20 text-white border-white/40 hover:bg-white/30"
                        onClick={() => router.push('/setup')}
                    >
                        返回设置
                    </Button>
                    <Button
                        className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
                        onClick={() => router.push('/setup/backgrounds')}
                    >
                        下一步：定义背景 →
                    </Button>
                </div>
            </div>
        </main>
    );
}
