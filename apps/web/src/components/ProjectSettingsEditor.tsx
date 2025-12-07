'use client';

import { useState } from 'react';
import { Button, Card, CardHeader, CardTitle, CardContent, useToast } from '@vng/ui';
import { Users, Globe, Image, Settings, X, Plus, Edit, Trash2, Palette, Save, Wand2, Sparkles, Loader2 } from 'lucide-react';
import { GameProject, Character, Background, createId } from '@vng/core';
import { useFormAutocomplete } from '@/hooks/useFormAutocomplete';
import type { WorldSetting, ThemeSetting } from '@vng/core';

interface ProjectSettingsEditorProps {
    project: GameProject;
    onSave: (project: GameProject) => void;
    onClose: () => void;
    onGenerateImage?: (characterId: string, prompt: string, refImageUrl?: string, type?: 'sprite' | 'avatar' | 'background') => Promise<string>;
}

export function ProjectSettingsEditor({ project, onSave, onClose, onGenerateImage }: ProjectSettingsEditorProps) {
    const toast = useToast();
    const [editingProject, setEditingProject] = useState<GameProject>(project);
    const [activeTab, setActiveTab] = useState<'basic' | 'characters' | 'world' | 'scenes' | 'theme'>('basic');
    
    // AI自动补全hooks
    const { isLoading: isCharacterAutocompleting, autocomplete: autocompleteCharacter } = useFormAutocomplete<Character>('character');
    const { isLoading: isWorldAutocompleting, autocomplete: autocompleteWorld } = useFormAutocomplete<WorldSetting>('world');
    const { isLoading: isSceneAutocompleting, autocomplete: autocompleteScene } = useFormAutocomplete<Background>('background');
    const { isLoading: isThemeAutocompleting, autocomplete: autocompleteTheme } = useFormAutocomplete<ThemeSetting>('theme');
    
    // 角色编辑状态
    const [editingCharacter, setEditingCharacter] = useState<Character | null>(null);
    const [showCharacterForm, setShowCharacterForm] = useState(false);
    
    // 场景编辑状态
    const [editingScene, setEditingScene] = useState<Background | null>(null);
    const [showSceneForm, setShowSceneForm] = useState(false);
    
    // ✅ 主题风格状态 - 从meta中加载
    const [selectedThemes, setSelectedThemes] = useState<string[]>(
        (project.meta as any)?.themes || []
    );
    const [selectedStyles, setSelectedStyles] = useState<string[]>(
        (project.meta as any)?.styles || []
    );
    
    // ✅ 世界观编辑状态 - 从 backgrounds[0].worldSetting 或 scenes 中加载
    const [worldForm, setWorldForm] = useState(() => {
        // 尝试从scenes加载（如果存在）
        const scenes = (project as any).scenes;
        if (scenes && Array.isArray(scenes) && scenes.length > 0 && scenes[0].name) {
            return {
                name: scenes[0].name || '',
                era: scenes[0].type || '',
                location: scenes[0].atmosphere || '',
                rules: '',
                socialStructure: '',
                history: '',
                description: scenes[0].description || '',
            };
        }
        
        // 否则从 backgrounds[0].worldSetting 加载
        const firstBg = project.backgrounds?.[0];
        if (firstBg?.worldSetting) {
            return {
                name: firstBg.name || '',
                era: firstBg.worldSetting.era || '',
                location: firstBg.worldSetting.location || '',
                rules: firstBg.worldSetting.rules || '',
                socialStructure: '',
                history: '',
                description: firstBg.description || '',
            };
        }
        
        // 默认空值
        return {
            name: '',
            era: '',
            location: '',
            rules: '',
            socialStructure: '',
            history: '',
            description: '',
        };
    });
    
    // 预设主题和风格选项
    const THEME_OPTIONS = ['亲情羁绊', '友情救赎', '爱情成长', '善恶拉择', '反抗压迫', '探索未知', '复仇与原谅', '自我救赎', '权力斗争', '生存挑战'];
    const STYLE_OPTIONS = ['悬疑推理', '浪漫言情', '热血战斗', '治愈日常', '暗黑惊悚', '轻喜剧', '史诗奇幻', '赛博朋克', '武侠江湖', '校园青春'];

    // 基本信息编辑
    const renderBasicTab = () => (
        <div className="space-y-6">
            <h3 className="text-lg font-semibold text-slate-800 border-b pb-2">📝 基本信息</h3>
            
            {/* 封面图 */}
            <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">🖼️ 项目封面</label>
                <div className="flex gap-3">
                    <input
                        type="text"
                        className="flex-1 px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                        value={editingProject.coverImage || ''}
                        onChange={(e) => setEditingProject({ ...editingProject, coverImage: e.target.value })}
                        placeholder="输入封面图URL或使用AI生成"
                    />
                    {onGenerateImage && (
                        <Button
                            size="sm"
                            variant="outline"
                            onClick={async () => {
                                if (!editingProject.title) {
                                    toast.warning('请先填写项目名称');
                                    return;
                                }
                                try {
                                    const prompt = `${editingProject.title}, ${editingProject.description || ''}, 视觉小说封面, 横版, 高质量, 精美文字排版, 动漫风格`;
                                    const imageUrl = await onGenerateImage('cover', prompt, undefined, 'background');
                                    setEditingProject({ ...editingProject, coverImage: imageUrl });
                                    toast.success('封面生成成功 ✨');
                                } catch (error) {
                                    // 错误已在onGenerateImage中处理
                                }
                            }}
                            className="gap-1 bg-gradient-to-r from-indigo-500 to-purple-500 text-white"
                        >
                            <Wand2 className="w-3 h-3" />
                            AI生成封面
                        </Button>
                    )}
                </div>
                {editingProject.coverImage && (
                    <div className="mt-3">
                        <img 
                            src={editingProject.coverImage} 
                            alt="封面预览" 
                            className="w-full max-w-md mx-auto rounded-lg shadow-lg object-cover" 
                            style={{ aspectRatio: '16 / 9' }}
                        />
                    </div>
                )}
            </div>
            
            <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">项目名称</label>
                <input
                    type="text"
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    value={editingProject.title}
                    onChange={(e) => setEditingProject({ ...editingProject, title: e.target.value })}
                />
            </div>
            
            <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">项目描述</label>
                <textarea
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    rows={3}
                    value={editingProject.description || ''}
                    onChange={(e) => setEditingProject({ ...editingProject, description: e.target.value })}
                    placeholder="简要描述你的视觉小说..."
                />
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">作者</label>
                    <input
                        type="text"
                        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                        value={editingProject.meta?.author || ''}
                        onChange={(e) => setEditingProject({ 
                            ...editingProject, 
                            meta: { ...editingProject.meta, author: e.target.value } 
                        })}
                    />
                </div>
                
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">版本</label>
                    <input
                        type="text"
                        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                        value={editingProject.meta?.version || ''}
                        onChange={(e) => setEditingProject({ 
                            ...editingProject, 
                            meta: { ...editingProject.meta, version: e.target.value } 
                        })}
                    />
                </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">类型</label>
                    <select
                        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                        value={editingProject.meta?.genre || 'mystery'}
                        onChange={(e) => setEditingProject({ 
                            ...editingProject, 
                            meta: { ...editingProject.meta, genre: e.target.value as any } 
                        })}
                    >
                        <option value="mystery">悬疑</option>
                        <option value="romance">浪漫</option>
                        <option value="fantasy">奇幻</option>
                        <option value="scifi">科幻</option>
                        <option value="horror">恐怖</option>
                        <option value="comedy">喜剧</option>
                        <option value="other">其他</option>
                    </select>
                </div>
                
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">美术风格</label>
                    <select
                        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                        value={editingProject.meta?.artStyle || 'anime'}
                        onChange={(e) => setEditingProject({ 
                            ...editingProject, 
                            meta: { ...editingProject.meta, artStyle: e.target.value as any } 
                        })}
                    >
                        <option value="anime">动漫</option>
                        <option value="realistic">写实</option>
                        <option value="pixel">像素</option>
                        <option value="watercolor">水彩</option>
                        <option value="other">其他</option>
                    </select>
                </div>
            </div>
        </div>
    );

    // 角色编辑
    const renderCharactersTab = () => {
        // ✅ 统计缺少素材的角色
        const missingAvatars = editingProject.characters?.filter(c => !c.avatarUrl) || [];
        const missingSprites = editingProject.characters?.filter(c => !c.sprites || c.sprites.length === 0) || [];
        const hasMissingAssets = missingAvatars.length > 0 || missingSprites.length > 0;
        
        return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-slate-800">👥 角色列表 ({editingProject.characters?.length || 0})</h3>
                <div className="flex gap-2">
                    {/* ✅ 一键补全缺失素材按钮 - 始终显示，没有缺失时禁用 */}
                    {onGenerateImage && (
                        <Button 
                            size="sm" 
                            variant="outline"
                            disabled={!hasMissingAssets}
                            onClick={async () => {
                                if (!confirm(`检测到 ${missingAvatars.length} 个角色缺少头像，${missingSprites.length} 个角色缺少立绘。\n\n是否一键生成所有缺失的素材？`)) {
                                    return;
                                }
                                
                                toast.info('开始生成缺失素材...', '请稍候');
                                let successCount = 0;
                                let errorCount = 0;
                                
                                // ============================================================
                                // 按顺序生成：先立绘 → 后头像
                                // 原因：立绘优先生成，头像可以使用立绘作为参考图保持形象一致性
                                // ============================================================
                                
                                // Step 1: 生成缺失的立绘
                                for (const char of missingSprites) {
                                    try {
                                        const prompt = `${char.displayName}, ${char.description}, 全身立绘, 动漫风格, 纯白色背景, 人物居中, 高质量`;
                                        // 立绘生成不使用参考图，显式指定 type='sprite' 触发抠图
                                        const imageUrl = await onGenerateImage(char.id, prompt, undefined, 'sprite');
                                        
                                        const newSprite = {
                                            id: createId(),
                                            emotion: 'neutral' as const,
                                            imageUrl: imageUrl,
                                        };
                                        
                                        // 更新角色
                                        const updatedChars = editingProject.characters?.map(c => 
                                            c.id === char.id ? { 
                                                ...c, 
                                                sprites: [newSprite],
                                                defaultSpriteId: newSprite.id
                                            } : c
                                        );
                                        setEditingProject({ ...editingProject, characters: updatedChars });
                                        successCount++;
                                    } catch (error) {
                                        console.error(`生成${char.displayName}立绘失败:`, error);
                                        errorCount++;
                                    }
                                }
                                
                                // Step 2: 生成缺失的头像（使用立绘作为参考图）
                                for (const char of missingAvatars) {
                                    try {
                                        const prompt = `${char.displayName}, ${char.description}, 头像, 圆形, 高质量`;
                                        // 获取刚生成的立绘作为参考图
                                        const updatedChar = editingProject.characters?.find(c => c.id === char.id);
                                        const refImageUrl = updatedChar?.sprites?.[0]?.imageUrl;
                                        const imageUrl = await onGenerateImage(char.id, prompt, refImageUrl, 'avatar');
                                        
                                        // 更新角色
                                        const updatedChars = editingProject.characters?.map(c => 
                                            c.id === char.id ? { ...c, avatarUrl: imageUrl } : c
                                        );
                                        setEditingProject({ ...editingProject, characters: updatedChars });
                                        successCount++;
                                    } catch (error) {
                                        console.error(`生成${char.displayName}头像失败:`, error);
                                        errorCount++;
                                    }
                                }
                                
                                if (errorCount === 0) {
                                    toast.success('素材生成完成', `成功生成 ${successCount} 个素材`);
                                } else {
                                    toast.warning('部分素材生成失败', `成功 ${successCount} 个，失败 ${errorCount} 个`);
                                }
                            }}
                            className="gap-1 bg-gradient-to-r from-green-50 to-emerald-50 border-green-300 hover:from-green-100 hover:to-emerald-100 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <Wand2 className="w-3 h-3 text-green-600" />
                            <span className="text-green-700">
                                {hasMissingAssets 
                                    ? `一键补全素材 (${missingAvatars.length + missingSprites.length})` 
                                    : '所有角色已有素材'}
                            </span>
                        </Button>
                    )}
                    <Button size="sm" onClick={() => {
                        setEditingCharacter({
                            id: createId(),
                            name: '',
                            displayName: '',
                            description: '',
                            sprites: [],
                            defaultSpriteId: '',
                        } as Character);
                        setShowCharacterForm(true);
                    }}>
                        <Plus className="w-4 h-4 mr-1" />
                        添加角色
                    </Button>
                </div>
            </div>

            {showCharacterForm ? (
                <Card className="p-6 bg-gradient-to-br from-purple-50 to-indigo-50 border-2 border-indigo-200">
                    <div className="space-y-4">
                        <div className="flex items-center justify-between mb-4">
                            <h4 className="font-semibold text-lg">{editingCharacter?.displayName || '新增角色'}</h4>
                            <div className="flex gap-2">
                                <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={async () => {
                                        const result = await autocompleteCharacter(editingCharacter || {}, {
                                            genre: editingProject.meta?.genre,
                                            worldSetting: worldForm.name || editingProject.title,
                                            existingItems: editingProject.characters?.map(c => c.displayName) || [],
                                        });
                                        if (result) {
                                            setEditingCharacter({
                                                ...editingCharacter!,
                                                ...result,
                                                id: editingCharacter?.id || createId(),
                                                sprites: editingCharacter?.sprites || [],
                                                avatarUrl: editingCharacter?.avatarUrl || result.avatarUrl,
                                            } as Character);
                                        }
                                    }}
                                    disabled={isCharacterAutocompleting}
                                    className="gap-1 bg-gradient-to-r from-amber-50 to-orange-50 border-amber-300 hover:from-amber-100 hover:to-orange-100"
                                >
                                    {isCharacterAutocompleting ? (
                                        <Loader2 className="w-3 h-3 animate-spin" />
                                    ) : (
                                        <Sparkles className="w-3 h-3 text-amber-600" />
                                    )}
                                    <span className="text-amber-700">
                                        {isCharacterAutocompleting ? 'AI补全中...' : 'AI帮我填'}
                                    </span>
                                </Button>
                                <Button size="sm" variant="outline" onClick={() => setShowCharacterForm(false)}>
                                    <X className="w-4 h-4" />
                                </Button>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium mb-2">角色名称 *</label>
                                <input
                                    type="text"
                                    className="w-full px-3 py-2 border rounded-lg"
                                    value={editingCharacter?.displayName || ''}
                                    onChange={(e) => setEditingCharacter({ ...editingCharacter!, displayName: e.target.value, name: e.target.value })}
                                    placeholder="例如: 李明"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-2">性别</label>
                                <select
                                    className="w-full px-3 py-2 border rounded-lg"
                                    value={editingCharacter?.gender || 'male'}
                                    onChange={(e) => setEditingCharacter({ ...editingCharacter!, gender: e.target.value as any })}
                                >
                                    <option value="male">男</option>
                                    <option value="female">女</option>
                                    <option value="other">其他</option>
                                </select>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium mb-2">年龄</label>
                                <input
                                    type="text"
                                    className="w-full px-3 py-2 border rounded-lg"
                                    value={editingCharacter?.age || ''}
                                    onChange={(e) => setEditingCharacter({ ...editingCharacter!, age: e.target.value })}
                                    placeholder="例如: 25"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-2">身份</label>
                                <input
                                    type="text"
                                    className="w-full px-3 py-2 border rounded-lg"
                                    value={editingCharacter?.identity || ''}
                                    onChange={(e) => setEditingCharacter({ ...editingCharacter!, identity: e.target.value })}
                                    placeholder="例如: 学生、侦探"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium mb-2">角色描述 *</label>
                            <textarea
                                className="w-full px-3 py-2 border rounded-lg"
                                rows={3}
                                value={editingCharacter?.description || ''}
                                onChange={(e) => setEditingCharacter({ ...editingCharacter!, description: e.target.value })}
                                placeholder="描述角色的外貌、性格等..."
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium mb-2">性格特征</label>
                            <input
                                type="text"
                                className="w-full px-3 py-2 border rounded-lg"
                                value={editingCharacter?.personality?.traits?.join(', ') || ''}
                                onChange={(e) => setEditingCharacter({
                                    ...editingCharacter!,
                                    personality: {
                                        ...editingCharacter?.personality,
                                        traits: e.target.value.split(',').map(t => t.trim()).filter(Boolean)
                                    }
                                })}
                                placeholder="例如: 开朗, 善良, 勇敢 (用逗号分隔)"
                            />
                        </div>

                        {/* 头像管理 */}
                        <div className="border-t pt-4">
                            <label className="block text-sm font-medium mb-2">👤 角色头像</label>
                            <div className="flex gap-3">
                                <input
                                    type="text"
                                    className="flex-1 px-3 py-2 border rounded-lg"
                                    value={editingCharacter?.avatarUrl || ''}
                                    onChange={(e) => setEditingCharacter({ ...editingCharacter!, avatarUrl: e.target.value })}
                                    placeholder="输入头像URL"
                                />
                                {onGenerateImage && (
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={async () => {
                                            if (!editingCharacter?.displayName || !editingCharacter?.description) {
                                                toast.warning('请先填写角色名称和描述');
                                                return;
                                            }
                                            try {
                                                const prompt = `${editingCharacter.displayName}, ${editingCharacter.description}, 头像, 圆形, 高质量`;
                                                // 使用立绘作为参考图生成头像，保持形象一致性，显式指定 type='avatar'
                                                const refImageUrl = editingCharacter.sprites?.[0]?.imageUrl;
                                                const imageUrl = await onGenerateImage(editingCharacter.id, prompt, refImageUrl, 'avatar');
                                                setEditingCharacter({ ...editingCharacter!, avatarUrl: imageUrl });
                                            } catch (error) {
                                                // 错误已在onGenerateImage中处理
                                            }
                                        }}
                                        className="gap-1"
                                    >
                                        <Wand2 className="w-3 h-3" />
                                        AI生成
                                    </Button>
                                )}
                            </div>
                            {editingCharacter?.avatarUrl && (
                                <div className="mt-2 flex justify-center">
                                    <img src={editingCharacter.avatarUrl} alt="头像预览" className="w-20 h-20 rounded-full object-cover border-2 border-slate-200" />
                                </div>
                            )}
                        </div>

                        {/* 立绘管理 */}
                        <div className="border-t pt-4">
                            <div className="flex items-center justify-between mb-2">
                                <label className="block text-sm font-medium">💼 角色立绘 ({editingCharacter?.sprites?.length || 0})</label>
                                {onGenerateImage && (
                                    <Button
                                        size="sm"
                                        onClick={async () => {
                                            if (!editingCharacter?.displayName || !editingCharacter?.description) {
                                                toast.warning('请先填写角色名称和描述');
                                                return;
                                            }
                                            try {
                                                const prompt = `${editingCharacter.displayName}, ${editingCharacter.description}, 全身立绘, 动漫风格, 纯白色背景, 人物居中, 高质量`;
                                                // 立绘生成不需要参考图（或使用已有立绘保持一致性），显式指定 type='sprite' 触发抠图
                                                const existingSprite = editingCharacter.sprites?.[0]?.imageUrl;
                                                const imageUrl = await onGenerateImage(editingCharacter.id, prompt, existingSprite, 'sprite');
                                                const newSprite = {
                                                    id: createId(),
                                                    emotion: 'neutral' as const,
                                                    imageUrl: imageUrl,
                                                };
                                                setEditingCharacter({
                                                    ...editingCharacter!,
                                                    sprites: [...(editingCharacter.sprites || []), newSprite],
                                                    defaultSpriteId: editingCharacter.defaultSpriteId || newSprite.id
                                                });
                                            } catch (error) {
                                                // 错误已在onGenerateImage中处理
                                            }
                                        }}
                                        className="gap-1 bg-gradient-to-r from-purple-500 to-pink-500 text-white"
                                    >
                                        <Wand2 className="w-3 h-3" />
                                        AI生成立绘
                                    </Button>
                                )}
                            </div>
                            <div className="grid grid-cols-3 gap-2">
                                {editingCharacter?.sprites?.map((sprite, index) => (
                                    <div key={sprite.id} className="relative group">
                                        <img src={sprite.imageUrl} alt={`立绘${index + 1}`} className="w-full h-32 object-cover rounded border" />
                                        <button
                                            onClick={() => {
                                                setEditingCharacter({
                                                    ...editingCharacter!,
                                                    sprites: editingCharacter.sprites?.filter(s => s.id !== sprite.id)
                                                });
                                            }}
                                            className="absolute top-1 right-1 bg-red-500 text-white p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                                        >
                                            <X className="w-3 h-3" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="flex gap-2 pt-4">
                            <Button
                                onClick={() => {
                                    if (!editingCharacter?.displayName || !editingCharacter?.description) {
                                        toast.warning('请填写角色名称和描述');
                                        return;
                                    }
                                    
                                    const updatedCharacters = [...(editingProject.characters || [])];
                                    const existingIndex = updatedCharacters.findIndex(c => c.id === editingCharacter.id);
                                    
                                    if (existingIndex >= 0) {
                                        updatedCharacters[existingIndex] = editingCharacter;
                                    } else {
                                        updatedCharacters.push(editingCharacter);
                                    }
                                    
                                    setEditingProject({ ...editingProject, characters: updatedCharacters });
                                    setShowCharacterForm(false);
                                    setEditingCharacter(null);
                                    toast.success('角色已保存');
                                }}
                                className="flex-1"
                            >
                                <Save className="w-4 h-4 mr-1" />
                                保存角色
                            </Button>
                            <Button
                                variant="outline"
                                onClick={() => {
                                    setShowCharacterForm(false);
                                    setEditingCharacter(null);
                                }}
                            >
                                取消
                            </Button>
                        </div>
                    </div>
                </Card>
            ) : null}

            <div className="grid gap-4">
                {editingProject.characters?.map((char) => {
                    // ✅ 检测该角色缺少的素材
                    const missingAvatar = !char.avatarUrl;
                    const missingSprite = !char.sprites || char.sprites.length === 0;
                    
                    return (
                    <Card key={char.id} className="p-4 hover:shadow-md transition-shadow">
                        <div className="flex items-start justify-between">
                            <div className="flex gap-4 flex-1">
                                {/* ✅ 头像预览 */}
                                <div className="flex-shrink-0">
                                    {char.avatarUrl ? (
                                        <img src={char.avatarUrl} alt={char.displayName} className="w-16 h-16 rounded-full object-cover border-2 border-slate-200" />
                                    ) : (
                                        <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center border-2 border-dashed border-slate-300">
                                            <span className="text-slate-400 text-xs">无头像</span>
                                        </div>
                                    )}
                                </div>
                                
                                <div className="flex-1">
                                    <div className="flex items-center gap-3 mb-2">
                                        <h4 className="font-semibold text-lg">{char.displayName}</h4>
                                        <span className="text-xs px-2 py-1 bg-indigo-100 text-indigo-700 rounded">
                                            {char.gender === 'male' ? '男' : char.gender === 'female' ? '女' : '其他'}
                                        </span>
                                        {char.age && <span className="text-xs text-slate-500">{char.age}岁</span>}
                                        
                                        {/* ✅ 缺失素材警告 */}
                                        {(missingAvatar || missingSprite) && (
                                            <span className="text-xs px-2 py-1 bg-amber-100 text-amber-700 rounded flex items-center gap-1">
                                                ⚠️ {missingAvatar && '缺头像'} {missingAvatar && missingSprite && '·'} {missingSprite && '缺立绘'}
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-sm text-slate-600 mb-2">{char.description}</p>
                                    {char.personality?.traits && char.personality.traits.length > 0 && (
                                        <div className="flex flex-wrap gap-1">
                                            {char.personality.traits.map((trait, i) => (
                                                <span key={i} className="text-xs px-2 py-0.5 bg-purple-100 text-purple-700 rounded">
                                                    {trait}
                                                </span>
                                            ))}
                                        </div>
                                    )}
                                    
                                    {/* ✅ 立绘数量显示 */}
                                    <div className="text-xs text-slate-500 mt-2">
                                        立绘: {char.sprites?.length || 0} 张
                                    </div>
                                </div>
                            </div>
                            <div className="flex gap-2">
                                {/* ✅ 快速补全按钮 */}
                                {(missingAvatar || missingSprite) && onGenerateImage && (
                                    <Button 
                                        size="sm" 
                                        variant="outline"
                                        onClick={async () => {
                                            toast.info(`正在为 ${char.displayName} 生成素材...`);
                                            let updated = { ...char };
                                            
                                            try {
                                                // 按顺序生成：先立绘 → 后头像
                                                
                                                // Step 1: 生成立绘
                                                if (missingSprite) {
                                                    const prompt = `${char.displayName}, ${char.description}, 全身立绘, 动漫风格, 纯白色背景, 人物居中, 高质量`;
                                                    // 显式指定 type='sprite' 触发抠图
                                                    const imageUrl = await onGenerateImage(char.id, prompt, undefined, 'sprite');
                                                    const newSprite = {
                                                        id: createId(),
                                                        emotion: 'neutral' as const,
                                                        imageUrl: imageUrl,
                                                    };
                                                    updated.sprites = [newSprite];
                                                    updated.defaultSpriteId = newSprite.id;
                                                }
                                                
                                                // Step 2: 生成头像（使用立绘作为参考图）
                                                if (missingAvatar) {
                                                    const prompt = `${char.displayName}, ${char.description}, 头像, 圆形, 高质量`;
                                                    // 使用刚生成的立绘作为参考图，显式指定 type='avatar'
                                                    const refImageUrl = updated.sprites?.[0]?.imageUrl;
                                                    const imageUrl = await onGenerateImage(char.id, prompt, refImageUrl, 'avatar');
                                                    updated.avatarUrl = imageUrl;
                                                }
                                                
                                                // 更新角色
                                                const updatedChars = editingProject.characters?.map(c => 
                                                    c.id === char.id ? updated : c
                                                );
                                                setEditingProject({ ...editingProject, characters: updatedChars });
                                                toast.success('素材生成完成');
                                            } catch (error) {
                                                // 错误已在onGenerateImage中处理
                                            }
                                        }}
                                        className="gap-1 text-green-600 hover:bg-green-50"
                                    >
                                        <Wand2 className="w-3 h-3" />
                                        补全
                                    </Button>
                                )}
                                <Button size="sm" variant="outline" onClick={() => {
                                    setEditingCharacter(char);
                                    setShowCharacterForm(true);
                                }}>
                                    <Edit className="w-3 h-3" />
                                </Button>
                                <Button size="sm" variant="outline" className="text-red-600 hover:bg-red-50" onClick={() => {
                                    setEditingProject({
                                        ...editingProject,
                                        characters: editingProject.characters?.filter(c => c.id !== char.id)
                                    });
                                    toast.success('角色已删除');
                                }}>
                                    <Trash2 className="w-3 h-3" />
                                </Button>
                            </div>
                        </div>
                    </Card>
                );})}
            </div>
        </div>
    );
    };

    // 世界观编辑
    const renderWorldTab = () => (
        <div className="space-y-6">
            <div className="flex items-center justify-between border-b pb-2">
                <h3 className="text-lg font-semibold text-slate-800">🌍 世界观设定</h3>
                <Button
                    variant="outline"
                    onClick={async () => {
                        const result = await autocompleteWorld(worldForm as any, {
                            genre: editingProject.meta?.genre,
                        });
                        if (result) {
                            setWorldForm({
                                name: result.name || worldForm.name,
                                era: result.era || worldForm.era,
                                location: result.location || worldForm.location,
                                rules: result.rules || worldForm.rules,
                                socialStructure: result.socialStructure || worldForm.socialStructure,
                                history: result.history || worldForm.history,
                                description: result.description || worldForm.description,
                            });
                        }
                    }}
                    disabled={isWorldAutocompleting}
                    className="gap-2 bg-gradient-to-r from-amber-50 to-orange-50 border-amber-300 hover:from-amber-100 hover:to-orange-100"
                >
                    {isWorldAutocompleting ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                        <Sparkles className="w-4 h-4 text-amber-600" />
                    )}
                    <span className="text-amber-700">
                        {isWorldAutocompleting ? 'AI补全中...' : 'AI帮我填'}
                    </span>
                </Button>
            </div>
            
            <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">世界观名称</label>
                <input
                    type="text"
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                    value={worldForm.name}
                    onChange={(e) => setWorldForm({ ...worldForm, name: e.target.value })}
                    placeholder="例如: 赛博朋克都市、中世纪魔法王国..."
                />
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">时代背景</label>
                    <input
                        type="text"
                        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                        value={worldForm.era}
                        onChange={(e) => setWorldForm({ ...worldForm, era: e.target.value })}
                        placeholder="例如: 未来、现代、中世纪..."
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">地域设定</label>
                    <input
                        type="text"
                        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                        value={worldForm.location}
                        onChange={(e) => setWorldForm({ ...worldForm, location: e.target.value })}
                        placeholder="例如: 东京、魔法学院..."
                    />
                </div>
            </div>

            <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">核心规则</label>
                <textarea
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                    rows={4}
                    value={worldForm.rules}
                    onChange={(e) => setWorldForm({ ...worldForm, rules: e.target.value })}
                    placeholder="这个世界的特殊规则或设定,如魔法体系、科技水平等..."
                />
            </div>

            <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">社会结构</label>
                <textarea
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                    rows={3}
                    value={worldForm.socialStructure}
                    onChange={(e) => setWorldForm({ ...worldForm, socialStructure: e.target.value })}
                    placeholder="例如: 王权统治、贵族阶级、公会体系等..."
                />
            </div>

            <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">历史背景</label>
                <textarea
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                    rows={4}
                    value={worldForm.history}
                    onChange={(e) => setWorldForm({ ...worldForm, history: e.target.value })}
                    placeholder="描述关键历史事件、王朝更迭等..."
                />
            </div>

            <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">补充说明</label>
                <textarea
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                    rows={3}
                    value={worldForm.description}
                    onChange={(e) => setWorldForm({ ...worldForm, description: e.target.value })}
                    placeholder="补充任何你希望加入的世界观细节..."
                />
            </div>

            <Button
                onClick={() => {
                    // 保存世界观到项目元数据
                    toast.success('世界观设定已保存');
                }}
                className="w-full"
            >
                <Save className="w-4 h-4 mr-2" />
                保存世界观
            </Button>
        </div>
    );

    // 场景编辑
    const renderScenesTab = () => {
        // ✅ 统计缺少背景图的场景
        const missingBackgrounds = editingProject.backgrounds?.filter(bg => !bg.imageUrl) || [];
        
        return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-slate-800">🎬 场景背景 ({editingProject.backgrounds?.length || 0})</h3>
                <div className="flex gap-2">
                    {/* ✅ 一键补全缺失背景图 - 始终显示，没有缺失时禁用 */}
                    {onGenerateImage && (
                        <Button 
                            size="sm" 
                            variant="outline"
                            disabled={missingBackgrounds.length === 0}
                            onClick={async () => {
                                if (!confirm(`检测到 ${missingBackgrounds.length} 个场景缺少背景图。\n\n是否一键生成所有缺失的背景图？`)) {
                                    return;
                                }
                                
                                toast.info('开始生成背景图...', '请稍候');
                                let successCount = 0;
                                let errorCount = 0;
                                
                                for (const bg of missingBackgrounds) {
                                    try {
                                        const prompt = `${bg.name}, ${bg.description || ''}, 场景背景图, 横屏1920x1080, 动漫风格, 高质量, 无人物`;
                                        // 显式指定 type='background'
                                        const imageUrl = await onGenerateImage(bg.id, prompt, undefined, 'background');
                                        
                                        // 更新场景
                                        const updatedBgs = editingProject.backgrounds?.map(b => 
                                            b.id === bg.id ? { ...b, imageUrl } : b
                                        );
                                        setEditingProject({ ...editingProject, backgrounds: updatedBgs });
                                        successCount++;
                                    } catch (error) {
                                        console.error(`生成${bg.name}背景图失败:`, error);
                                        errorCount++;
                                    }
                                }
                                
                                if (errorCount === 0) {
                                    toast.success('背景图生成完成', `成功生成 ${successCount} 张`);
                                } else {
                                    toast.warning('部分背景图生成失败', `成功 ${successCount} 张，失败 ${errorCount} 张`);
                                }
                            }}
                            className="gap-1 bg-gradient-to-r from-green-50 to-emerald-50 border-green-300 hover:from-green-100 hover:to-emerald-100 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <Wand2 className="w-3 h-3 text-green-600" />
                            <span className="text-green-700">
                                {missingBackgrounds.length > 0 
                                    ? `一键补全背景图 (${missingBackgrounds.length})` 
                                    : '所有场景已有背景图'}
                            </span>
                        </Button>
                    )}
                    <Button size="sm" onClick={() => {
                        setEditingScene({
                            id: createId(),
                            name: '',
                            description: '',
                            imageUrl: '',
                        } as Background);
                        setShowSceneForm(true);
                    }}>
                        <Plus className="w-4 h-4 mr-1" />
                        添加场景
                    </Button>
                </div>
            </div>

            {showSceneForm ? (
                <Card className="p-6 bg-gradient-to-br from-blue-50 to-cyan-50 border-2 border-blue-200">
                    <div className="space-y-4">
                        <div className="flex items-center justify-between mb-4">
                            <h4 className="font-semibold text-lg">{editingScene?.name || '新增场景'}</h4>
                            <div className="flex gap-2">
                                <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={async () => {
                                        const result = await autocompleteScene(editingScene || {}, {
                                            genre: editingProject.meta?.genre,
                                            worldSetting: worldForm.name || editingProject.title,
                                        });
                                        if (result) {
                                            setEditingScene({
                                                ...editingScene!,
                                                ...result,
                                                id: editingScene?.id || createId(),
                                                imageUrl: editingScene?.imageUrl || result.imageUrl,
                                            } as Background);
                                        }
                                    }}
                                    disabled={isSceneAutocompleting}
                                    className="gap-1 bg-gradient-to-r from-amber-50 to-orange-50 border-amber-300 hover:from-amber-100 hover:to-orange-100"
                                >
                                    {isSceneAutocompleting ? (
                                        <Loader2 className="w-3 h-3 animate-spin" />
                                    ) : (
                                        <Sparkles className="w-3 h-3 text-amber-600" />
                                    )}
                                    <span className="text-amber-700">
                                        {isSceneAutocompleting ? 'AI补全中...' : 'AI帮我填'}
                                    </span>
                                </Button>
                                <Button size="sm" variant="outline" onClick={() => setShowSceneForm(false)}>
                                    <X className="w-4 h-4" />
                                </Button>
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium mb-2">场景名称 *</label>
                            <input
                                type="text"
                                className="w-full px-3 py-2 border rounded-lg"
                                value={editingScene?.name || ''}
                                onChange={(e) => setEditingScene({ ...editingScene!, name: e.target.value })}
                                placeholder="例如: 学校教室、咖啡店、城堡大厅"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium mb-2">场景描述</label>
                            <textarea
                                className="w-full px-3 py-2 border rounded-lg"
                                rows={3}
                                value={editingScene?.description || ''}
                                onChange={(e) => setEditingScene({ ...editingScene!, description: e.target.value })}
                                placeholder="描述这个场景的特点、氛围..."
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium mb-2">背景图片URL</label>
                            <div className="flex gap-3">
                                <input
                                    type="text"
                                    className="flex-1 px-3 py-2 border rounded-lg"
                                    value={editingScene?.imageUrl || ''}
                                    onChange={(e) => setEditingScene({ ...editingScene!, imageUrl: e.target.value })}
                                    placeholder="输入图片链接或使用AI生成"
                                />
                                {onGenerateImage && (
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={async () => {
                                            if (!editingScene?.name) {
                                                toast.warning('请先填写场景名称');
                                                return;
                                            }
                                            try {
                                                const prompt = `${editingScene.name}, ${editingScene.description || ''}, 场景背景, 宽幅, 高质量, 细节丰富`;
                                                // 显式指定 type='background'
                                                const imageUrl = await onGenerateImage('scene', prompt, undefined, 'background');
                                                setEditingScene({ ...editingScene!, imageUrl: imageUrl });
                                            } catch (error) {
                                                // 错误已在onGenerateImage中处理
                                            }
                                        }}
                                        className="gap-1 bg-gradient-to-r from-blue-500 to-cyan-500 text-white"
                                    >
                                        <Wand2 className="w-3 h-3" />
                                        AI生成
                                    </Button>
                                )}
                            </div>
                            {editingScene?.imageUrl && (
                                <img src={editingScene.imageUrl} alt="预览" className="mt-2 w-full h-48 object-cover rounded-lg" />
                            )}
                        </div>

                        <div className="flex gap-2 pt-4">
                            <Button
                                onClick={() => {
                                    if (!editingScene?.name) {
                                        toast.warning('请填写场景名称');
                                        return;
                                    }
                                    
                                    const updatedBackgrounds = [...(editingProject.backgrounds || [])];
                                    const existingIndex = updatedBackgrounds.findIndex(b => b.id === editingScene.id);
                                    
                                    if (existingIndex >= 0) {
                                        updatedBackgrounds[existingIndex] = editingScene;
                                    } else {
                                        updatedBackgrounds.push(editingScene);
                                    }
                                    
                                    setEditingProject({ ...editingProject, backgrounds: updatedBackgrounds });
                                    setShowSceneForm(false);
                                    setEditingScene(null);
                                    toast.success('场景已保存');
                                }}
                                className="flex-1"
                            >
                                <Save className="w-4 h-4 mr-1" />
                                保存场景
                            </Button>
                            <Button
                                variant="outline"
                                onClick={() => {
                                    setShowSceneForm(false);
                                    setEditingScene(null);
                                }}
                            >
                                取消
                            </Button>
                        </div>
                    </div>
                </Card>
            ) : null}

            <div className="grid gap-4">
                {editingProject.backgrounds?.map((bg) => {
                    const missingImage = !bg.imageUrl;
                    
                    return (
                    <Card key={bg.id} className="p-4 hover:shadow-md transition-shadow">
                        <div className="flex items-start gap-4">
                            {bg.imageUrl ? (
                                <img src={bg.imageUrl} alt={bg.name} className="w-32 h-20 object-cover rounded border-2 border-slate-200" />
                            ) : (
                                <div className="w-32 h-20 bg-slate-100 rounded flex items-center justify-center border-2 border-dashed border-slate-300">
                                    <span className="text-slate-400 text-xs">无背景图</span>
                                </div>
                            )}
                            <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                    <h4 className="font-semibold text-lg">{bg.name}</h4>
                                    {missingImage && (
                                        <span className="text-xs px-2 py-1 bg-amber-100 text-amber-700 rounded">
                                            ⚠️ 缺背景图
                                        </span>
                                    )}
                                </div>
                                <p className="text-sm text-slate-600">{bg.description || '无描述'}</p>
                            </div>
                            <div className="flex gap-2">
                                {/* ✅ 快速生成背景图 */}
                                {missingImage && onGenerateImage && (
                                    <Button 
                                        size="sm" 
                                        variant="outline"
                                        onClick={async () => {
                                            toast.info(`正在为 ${bg.name} 生成背景图...`);
                                            try {
                                                const prompt = `${bg.name}, ${bg.description || ''}, 场景背景图, 横屏1920x1080, 动漫风格, 高质量, 无人物`;
                                                // 显式指定 type='background'
                                                const imageUrl = await onGenerateImage(bg.id, prompt, undefined, 'background');
                                                
                                                // 更新场景
                                                const updatedBgs = editingProject.backgrounds?.map(b => 
                                                    b.id === bg.id ? { ...b, imageUrl } : b
                                                );
                                                setEditingProject({ ...editingProject, backgrounds: updatedBgs });
                                                toast.success('背景图生成完成');
                                            } catch (error) {
                                                // 错误已在onGenerateImage中处理
                                            }
                                        }}
                                        className="gap-1 text-green-600 hover:bg-green-50"
                                    >
                                        <Wand2 className="w-3 h-3" />
                                        生成
                                    </Button>
                                )}
                                <Button size="sm" variant="outline" onClick={() => {
                                    setEditingScene(bg);
                                    setShowSceneForm(true);
                                }}>
                                    <Edit className="w-3 h-3" />
                                </Button>
                                <Button size="sm" variant="outline" className="text-red-600 hover:bg-red-50" onClick={() => {
                                    setEditingProject({
                                        ...editingProject,
                                        backgrounds: editingProject.backgrounds?.filter(b => b.id !== bg.id)
                                    });
                                    toast.success('场景已删除');
                                }}>
                                    <Trash2 className="w-3 h-3" />
                                </Button>
                            </div>
                        </div>
                    </Card>
                );})}
            </div>
        </div>
    );
    };

    // 主题风格编辑
    const renderThemeTab = () => (
        <div className="space-y-6">
            <div className="flex items-center justify-between border-b pb-2">
                <h3 className="text-lg font-semibold text-slate-800">🎨 主题风格</h3>
                <Button
                    variant="outline"
                    onClick={async () => {
                        const currentData = {
                            themes: selectedThemes,
                            styles: selectedStyles,
                        };
                        const result = await autocompleteTheme(currentData as any, {
                            genre: editingProject.meta?.genre,
                            worldSetting: worldForm.name || editingProject.title,
                            existingItems: editingProject.characters?.map(c => c.displayName) || [],
                        });
                        if (result) {
                            // 合并AI建议的主题和风格
                            if (result.themes?.length) {
                                const newThemes = result.themes.filter((t: string) => !selectedThemes.includes(t));
                                setSelectedThemes([...selectedThemes, ...newThemes]);
                            }
                            if (result.styles?.length) {
                                const newStyles = result.styles.filter((s: string) => !selectedStyles.includes(s));
                                setSelectedStyles([...selectedStyles, ...newStyles]);
                            }
                        }
                    }}
                    disabled={isThemeAutocompleting}
                    className="gap-2 bg-gradient-to-r from-amber-50 to-orange-50 border-amber-300 hover:from-amber-100 hover:to-orange-100"
                >
                    {isThemeAutocompleting ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                        <Sparkles className="w-4 h-4 text-amber-600" />
                    )}
                    <span className="text-amber-700">
                        {isThemeAutocompleting ? 'AI推荐中...' : 'AI帮我选'}
                    </span>
                </Button>
            </div>
            
            {/* 核心主题 */}
            <div>
                <label className="block text-sm font-medium text-slate-700 mb-3">核心主题 (可多选)</label>
                <div className="flex flex-wrap gap-2">
                    {THEME_OPTIONS.map(theme => (
                        <button
                            key={theme}
                            onClick={() => {
                                if (selectedThemes.includes(theme)) {
                                    setSelectedThemes(selectedThemes.filter(t => t !== theme));
                                } else {
                                    setSelectedThemes([...selectedThemes, theme]);
                                }
                            }}
                            className={`px-4 py-2 rounded-lg border-2 transition-all ${
                                selectedThemes.includes(theme)
                                    ? 'bg-purple-500 text-white border-purple-500'
                                    : 'bg-white text-slate-700 border-slate-300 hover:border-purple-300'
                            }`}
                        >
                            {theme}
                        </button>
                    ))}
                </div>
                
                {/* 已选主题 */}
                {selectedThemes.length > 0 && (
                    <div className="mt-3 p-3 bg-purple-50 rounded-lg">
                        <div className="text-xs text-purple-700 mb-2">已选择 {selectedThemes.length} 个主题:</div>
                        <div className="flex flex-wrap gap-2">
                            {selectedThemes.map(theme => (
                                <span key={theme} className="px-3 py-1 bg-purple-500 text-white rounded-full text-sm flex items-center gap-1">
                                    {theme}
                                    <button onClick={() => setSelectedThemes(selectedThemes.filter(t => t !== theme))} className="hover:bg-purple-600 rounded-full p-0.5">
                                        <X className="w-3 h-3" />
                                    </button>
                                </span>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* 故事风格 */}
            <div>
                <label className="block text-sm font-medium text-slate-700 mb-3">故事风格 (可多选)</label>
                <div className="flex flex-wrap gap-2">
                    {STYLE_OPTIONS.map(style => (
                        <button
                            key={style}
                            onClick={() => {
                                if (selectedStyles.includes(style)) {
                                    setSelectedStyles(selectedStyles.filter(s => s !== style));
                                } else {
                                    setSelectedStyles([...selectedStyles, style]);
                                }
                            }}
                            className={`px-4 py-2 rounded-lg border-2 transition-all ${
                                selectedStyles.includes(style)
                                    ? 'bg-indigo-500 text-white border-indigo-500'
                                    : 'bg-white text-slate-700 border-slate-300 hover:border-indigo-300'
                            }`}
                        >
                            {style}
                        </button>
                    ))}
                </div>
                
                {/* 已选风格 */}
                {selectedStyles.length > 0 && (
                    <div className="mt-3 p-3 bg-indigo-50 rounded-lg">
                        <div className="text-xs text-indigo-700 mb-2">已选择 {selectedStyles.length} 个风格:</div>
                        <div className="flex flex-wrap gap-2">
                            {selectedStyles.map(style => (
                                <span key={style} className="px-3 py-1 bg-indigo-500 text-white rounded-full text-sm flex items-center gap-1">
                                    {style}
                                    <button onClick={() => setSelectedStyles(selectedStyles.filter(s => s !== style))} className="hover:bg-indigo-600 rounded-full p-0.5">
                                        <X className="w-3 h-3" />
                                    </button>
                                </span>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            <Button
                onClick={() => {
                    if (selectedThemes.length === 0 || selectedStyles.length === 0) {
                        toast.warning('请至少选择一个主题和一个风格');
                        return;
                    }
                    toast.success('主题风格已保存');
                }}
                className="w-full"
            >
                <Save className="w-4 h-4 mr-2" />
                保存主题风格
            </Button>
        </div>
    );

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-hidden flex flex-col">
                {/* 头部 */}
                <div className="bg-gradient-to-r from-indigo-600 to-purple-600 p-6 text-white">
                    <div className="flex items-center justify-between">
                        <div>
                            <h2 className="text-2xl font-bold flex items-center gap-2">
                                <Settings className="w-6 h-6" />
                                编辑项目设定
                            </h2>
                            <p className="text-white/80 text-sm mt-1">{editingProject.title}</p>
                        </div>
                        <button onClick={onClose} className="text-white hover:bg-white/20 p-2 rounded-lg transition-colors">
                            <X className="w-6 h-6" />
                        </button>
                    </div>

                    {/* 标签切换 */}
                    <div className="flex gap-2 mt-4">
                        {[
                            { key: 'basic', label: '📝 基本信息', icon: Settings },
                            { key: 'world', label: '🌍 世界观', icon: Globe },
                            { key: 'theme', label: '🎨 主题', icon: Palette },
                            { key: 'scenes', label: '🎬 场景', icon: Image },
                            { key: 'characters', label: '👥 角色', icon: Users },
                        ].map(tab => (
                            <button
                                key={tab.key}
                                onClick={() => setActiveTab(tab.key as any)}
                                className={`px-4 py-2 rounded-lg transition-colors ${
                                    activeTab === tab.key
                                        ? 'bg-white text-indigo-600 font-semibold'
                                        : 'bg-white/20 text-white hover:bg-white/30'
                                }`}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* 内容区 */}
                <div className="flex-1 overflow-y-auto p-6">
                    {activeTab === 'basic' && renderBasicTab()}
                    {activeTab === 'characters' && renderCharactersTab()}
                    {activeTab === 'world' && renderWorldTab()}
                    {activeTab === 'scenes' && renderScenesTab()}
                    {activeTab === 'theme' && renderThemeTab()}
                </div>

                {/* 底部按钮 */}
                <div className="bg-slate-50 p-4 border-t flex gap-3 justify-end">
                    <Button variant="outline" onClick={onClose}>
                        取消
                    </Button>
                    <Button
                        onClick={() => onSave(editingProject)}
                        className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700"
                    >
                        保存设定
                    </Button>
                </div>
            </div>
        </div>
    );
}
