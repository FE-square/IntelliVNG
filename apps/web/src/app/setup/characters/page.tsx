'use client';

import { useState, Suspense } from 'react';
import { Button, Card, CardHeader, CardTitle, CardContent, Input, useToast, useConfirmDialog } from '@vng/ui';
import { Plus, Trash2, Save, ArrowLeft, Users, Wand2, Sparkles, Loader2 } from 'lucide-react';
import { useSetupStore } from '@/stores/setupStore';
import { createId } from '@vng/core';
import type { Character, GameProject } from '@vng/core';
import { useFormAutocomplete } from '@/hooks/useFormAutocomplete';
import { saveProject } from '@/lib/projectStorage';
import { getEditingProjectBase, buildFullProject } from '@/lib/setupUtils';
import { useI18N } from '@/components/I18nProvider';
import { useRouterWithParams } from '@/hooks/useRouterWithParams';

// 生成状态类型
interface GenerationStatus {
    status: 'idle' | 'pending' | 'running' | 'succeeded' | 'failed';
    message: string;
    progress: number;
}

function CharactersPageContent() {
    const router = useRouterWithParams();
    const toast = useToast();
    const { confirm, DialogComponent } = useConfirmDialog();
    const { characters, addCharacter, updateCharacter, removeCharacter, worldSetting, themeSetting } = useSetupStore();
    const { isLoading: isAutocompleting, autocomplete } = useFormAutocomplete<Character>('character');
    const { t, getText } = useI18N();
    
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
    
    // 生成状态
    const [spriteStatus, setSpriteStatus] = useState<GenerationStatus>({ status: 'idle', message: '', progress: 0 });
    const [avatarStatus, setAvatarStatus] = useState<GenerationStatus>({ status: 'idle', message: '', progress: 0 });

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
        setSpriteStatus({ status: 'idle', message: '', progress: 0 });
        setAvatarStatus({ status: 'idle', message: '', progress: 0 });
    };

    // AI自动补全表单（使用通用 Hook）
    const handleAutocomplete = async () => {
        const result = await autocomplete(formData, {
            genre: themeSetting?.themes?.[0],
            worldSetting: worldSetting?.name,
            existingItems: characters.map(c => c.displayName),
        });
        
        if (result) {
            setFormData({
                ...formData,
                ...result,
                // 保留已有的立绘和头像
                sprites: formData.sprites,
                avatarUrl: formData.avatarUrl || result.avatarUrl,
                defaultSpriteId: formData.defaultSpriteId,
            });
        }
    };

    // AI生成角色立绘（流式状态）
    const handleGenerateSprite = async () => {
        if (!formData.displayName || !formData.description) {
            toast.warning(t('key.characters.warning.fillNameDesc') || '请先填写角色名称和描述');
            return;
        }

        setSpriteStatus({ status: 'pending', message: t('key.characters.sprite.preparing') || '准备生成...', progress: 0 });
        
        try {
            // 构建prompt 
            // TODO 提示词等逻辑应该包在后端代码内，前端只传一些必要的输入；
            // 如果允许直接将提示词传入接口，可能会有接口被当作通用API 恶意滥用的安全风险。
            const prompt = `${formData.displayName}, ${formData.description}, ${formData.appearance?.hairStyle || ''}, ${formData.appearance?.clothing || ''}；生成一个单人的全身立绘, 动漫风格, 纯白色背景, 人物居中, 高质量, 清晰`;
            
            // API生成图片
            // TODO 这里接口允许的参数应该设计成具体的ActionType，比如根据关键词生成角色立绘、根据关键词生成场景背景、根据立绘生成角色头像等
            // 那么参数就类似于 actionType, actionPayload: { description, refImageUrl }等，而不是像现在这样直接传入prompt。
            const response = await fetch('/api/generate-image', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt, type: 'sprite', stream: true }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.details || '生成失败');
            }

            // 处理 SSE 流
            const reader = response.body?.getReader();
            if (!reader) throw new Error('无法读取响应流');

            const decoder = new TextDecoder();
            let buffer = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';

                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        try {
                            const data = JSON.parse(line.slice(6));
                            
                            if (data.status === 'COMPLETED' && data.imageUrl) {
                                // 生成成功
                                const newSprite = {
                                    id: createId(),
                                    emotion: 'neutral' as const,
                                    imageUrl: data.imageUrl,
                                    generationPrompt: prompt,
                                };
                                
                                setFormData(prev => ({
                                    ...prev,
                                    sprites: [...(prev.sprites || []), newSprite],
                                    defaultSpriteId: prev.defaultSpriteId || newSprite.id,
                                }));
                                
                                setSpriteStatus({ status: 'succeeded', message: t('key.characters.sprite.completed') || '生成完成', progress: 100 });
                            } else if (data.status === 'FAILED') {
                                throw new Error(data.error || t('key.characters.sprite.failed') || '生成失败');
                            } else if (data.status) {
                                // 更新进度
                                // 优先使用 messageCode（错误码），如果没有则使用 message，最后使用默认值
                                let displayMessage = getText('key.characters.sprite.generating', '生成中...');
                                if (data.messageCode) {
                                    // 根据错误码获取多语言消息
                                    displayMessage = getText(`key.error.${data.messageCode}`, data.message || displayMessage);
                                } else if (data.message) {
                                    displayMessage = data.message;
                                }
                                
                                setSpriteStatus({
                                    status: data.status.toLowerCase() as any,
                                    message: displayMessage,
                                    progress: data.progress || 0,
                                });
                            }
                        } catch (parseError) {
                            // 忽略解析错误，继续处理
                        }
                    }
                }
            }
        } catch (error) {
            console.error('生成失败:', error);
            setSpriteStatus({ 
                status: 'failed', 
                message: error instanceof Error ? error.message : getText('key.characters.sprite.failed', '生成失败'), 
                progress: 0 
            });
            toast.error(getText('key.characters.sprite.failed', '立绘生成失败'), error instanceof Error ? error.message : getText('key.characters.sprite.retry', '请重试'));
        }
    };

    // AI生成角色头像（基于立绘参考图）
    const handleGenerateAvatar = async () => {
        if (!formData.displayName || !formData.description) {
            toast.warning(getText('key.characters.warning.fillNameDesc', '请先填写角色名称和描述'));
            return;
        }

        // 检查是否有立绘可以作为参考图
        const latestSprite = formData.sprites?.[formData.sprites.length - 1];
        const hasReference = !!latestSprite?.imageUrl;

        setAvatarStatus({ 
            status: 'pending', 
            message: hasReference ? getText('key.characters.avatar.preparingRef', '基于立绘准备生成...') : getText('key.characters.avatar.preparing', '准备生成...'), 
            progress: 0 
        });
        
        try {
            const prompt = `${formData.displayName}, ${formData.description}, 头像特写, 圆形头像, 动漫风格, ${formData.appearance?.facialFeatures || ''}, 纯白色背景, 简洁, 高质量`;
            
            // 使用流式 API，如果有立绘则传入参考图
            const response = await fetch('/api/generate-image', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    prompt, 
                    type: 'avatar', 
                    stream: true,
                    ...(hasReference && {
                        refImageUrl: latestSprite.imageUrl,
                        refStrength: 0.7,
                    }),
                }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.details || '生成失败');
            }

            // 处理 SSE 流
            const reader = response.body?.getReader();
            if (!reader) throw new Error('无法读取响应流');

            const decoder = new TextDecoder();
            let buffer = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';

                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        try {
                            const data = JSON.parse(line.slice(6));
                            
                            if (data.status === 'COMPLETED' && data.imageUrl) {
                                setFormData(prev => ({
                                    ...prev,
                                    avatarUrl: data.imageUrl,
                                }));
                                
                                setAvatarStatus({ status: 'succeeded', message: getText('key.characters.avatar.completed', '生成完成'), progress: 100 });
                            } else if (data.status === 'FAILED') {
                                throw new Error(data.error || getText('key.characters.avatar.failed', '生成失败'));
                            } else if (data.status) {
                                // 优先使用 messageCode（错误码），如果没有则使用 message，最后使用默认值
                                let displayMessage = getText('key.characters.avatar.generating', '生成中...');
                                if (data.messageCode) {
                                    // 根据错误码获取多语言消息
                                    displayMessage = getText(`key.error.${data.messageCode}`, data.message || displayMessage);
                                } else if (data.message) {
                                    displayMessage = data.message;
                                }
                                
                                setAvatarStatus({
                                    status: data.status.toLowerCase() as any,
                                    message: displayMessage,
                                    progress: data.progress || 0,
                                });
                            }
                        } catch (parseError) {
                            // 忽略解析错误
                        }
                    }
                }
            }
        } catch (error) {
            console.error('生成失败:', error);
            setAvatarStatus({ 
                status: 'failed', 
                message: error instanceof Error ? error.message : getText('key.characters.avatar.failed', '生成失败'), 
                progress: 0 
            });
            toast.error(getText('key.characters.avatar.failed', '头像生成失败'), error instanceof Error ? error.message : getText('key.characters.avatar.retry', '请重试'));
        }
    };

    // 一键生成：先立绘后头像
    const handleGenerateAll = async () => {
        if (!formData.displayName || !formData.description) {
            toast.warning(getText('key.characters.warning.fillNameDesc', '请先填写角色名称和描述'));
            return;
        }

        // 先生成立绘
        await handleGenerateSprite();
        
        // 等待一下让状态更新
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // 再生成头像（会自动使用刚生成的立绘作为参考）
        await handleGenerateAvatar();
    };

    const handleSaveCharacter = async () => {
        if (!formData.name || !formData.displayName) {
            toast.warning(getText('key.characters.warning.fillRequired', '请填写必填项'));
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
            toast.success(getText('key.characters.save.createSuccess', '角色创建成功'), getText('key.characters.save.assetsAdded', '立绘和头像已添加'));
        } else {
            updateCharacter(editingId!, character);
            toast.success(getText('key.characters.save.updateSuccess', '角色更新成功'), getText('key.characters.save.assetsSync', '素材已同步'));
        }

        // ✅ 如果是编辑已有项目，同步更新sessionStorage中的项目数据
        const editingProjectData = sessionStorage.getItem('editing_project');
        if (editingProjectData) {
            try {
                const project: GameProject = JSON.parse(editingProjectData);
                // 使用当前setupStore中的最新角色列表（包含刚保存的角色）
                const currentCharacters = editingId === 'new' 
                    ? [...characters, character]
                    : characters.map(c => c.id === character.id ? character : c);
                
                const updatedProject = {
                    ...project,
                    characters: currentCharacters,
                    updatedAt: new Date().toISOString(),
                };
                sessionStorage.setItem('editing_project', JSON.stringify(updatedProject));
                console.log('[角色编辑] 已同步更新到sessionStorage，角色数:', currentCharacters.length);
                
                // ✅ 直接保存到后端
                const baseProject = getEditingProjectBase();
                if (baseProject) {
                    const { worldSetting, scenes, themeSetting } = useSetupStore.getState();
                    const fullProject = buildFullProject(baseProject, currentCharacters, worldSetting, scenes, themeSetting);
                    const success = await saveProject(fullProject);
                    if (success) {
                        console.log('[角色编辑] 项目已保存到后端');
                        // 同时更新sessionStorage
                        sessionStorage.setItem('editing_project', JSON.stringify(fullProject));
                    } else {
                        console.error('[角色编辑] 保存到后端失败');
                    }
                }
            } catch (error) {
                console.error('[角色编辑] 更新sessionStorage失败:', error);
            }
        }

        setEditingId(null);
    };

    const handleEdit = (character: Character) => {
        setEditingId(character.id);
        setFormData(character);
        setSpriteStatus({ status: 'idle', message: '', progress: 0 });
        setAvatarStatus({ status: 'idle', message: '', progress: 0 });
    };

    const handleDelete = async (id: string) => {
        const confirmed = await confirm({
            title: getText('key.characters.delete.title', '删除角色'),
            message: getText('key.characters.delete.message', '确定要删除这个角色吗？'),
            confirmText: getText('key.characters.delete.confirm', '删除'),
            cancelText: getText('key.characters.delete.cancel', '取消'),
            variant: 'danger',
        });
        if (confirmed) {
            removeCharacter(id);
            toast.success(getText('key.characters.delete.success', '角色已删除'));
            
            // ✅ 如果是编辑已有项目，同步更新sessionStorage
            const editingProjectData = sessionStorage.getItem('editing_project');
            if (editingProjectData) {
                try {
                    const project: GameProject = JSON.parse(editingProjectData);
                    const updatedCharacters = characters.filter(c => c.id !== id);
                    const updatedProject = {
                        ...project,
                        characters: updatedCharacters,
                        updatedAt: new Date().toISOString(),
                    };
                    sessionStorage.setItem('editing_project', JSON.stringify(updatedProject));
                    console.log('[角色删除] 已同步更新到sessionStorage，剩余角色:', updatedCharacters.length);
                    
                    // ✅ 直接保存到后端
                    const baseProject = getEditingProjectBase();
                    if (baseProject) {
                        const { worldSetting, scenes, themeSetting } = useSetupStore.getState();
                        const fullProject = buildFullProject(baseProject, updatedCharacters, worldSetting, scenes, themeSetting);
                        const success = await saveProject(fullProject);
                        if (success) {
                            console.log('[角色删除] 项目已保存到后端');
                            // 同时更新sessionStorage
                            sessionStorage.setItem('editing_project', JSON.stringify(fullProject));
                        } else {
                            console.error('[角色删除] 保存到后端失败');
                        }
                    }
                } catch (error) {
                    console.error('[角色删除] 更新sessionStorage失败:', error);
                }
            }
        }
    };

    const handleCancel = () => {
        setEditingId(null);
    };

    // 状态指示器组件
    const StatusIndicator = ({ status, label }: { status: GenerationStatus; label: string }) => {
        if (status.status === 'idle') return null;
        
        const statusColors = {
            pending: 'bg-yellow-100 text-yellow-800 border-yellow-300',
            running: 'bg-blue-100 text-blue-800 border-blue-300',
            succeeded: 'bg-green-100 text-green-800 border-green-300',
            failed: 'bg-red-100 text-red-800 border-red-300',
        };

        return (
            <div className={`mt-3 p-3 rounded-lg border ${statusColors[status.status as keyof typeof statusColors] || 'bg-gray-100'}`}>
                <div className="flex items-center gap-2">
                    {status.status === 'running' && (
                        <Loader2 className="w-4 h-4 animate-spin" />
                    )}
                    <span className="text-sm font-medium">{label}</span>
                </div>
                <p className="text-sm mt-1">{status.message}</p>
                {status.progress > 0 && status.status === 'running' && (
                    <div className="mt-2 h-2 bg-white/50 rounded-full overflow-hidden">
                        <div 
                            className="h-full bg-current transition-all duration-300 rounded-full"
                            style={{ width: `${status.progress}%` }}
                        />
                    </div>
                )}
            </div>
        );
    };

    return (
        <main className="min-h-screen bg-gradient-to-br from-slate-50 via-purple-50 to-pink-50 p-8">
            <div className="max-w-6xl mx-auto">
                {/* 标题栏 */}
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <div className="flex items-center gap-3 mb-3">
                            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center shadow-lg">
                                <Users className="w-8 h-8 text-white" />
                            </div>
                            <div>
                                <h1 className="text-4xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent mb-1" suppressHydrationWarning>
                                    {getText('key.characters.pageTitle', '角色定义')}
                                </h1>
                                <p className="text-slate-600" suppressHydrationWarning>
                                    {getText('key.characters.pageDescription', '设置角色的详细信息,让 AI 更好地理解你的角色')}
                                </p>
                            </div>
                        </div>
                    </div>
                    <Button
                        variant="outline"
                        className="border-slate-300 hover:bg-slate-100"
                        onClick={() => router.back()}
                    >
                        <ArrowLeft className="w-4 h-4 mr-2" />
                        <span suppressHydrationWarning>{getText('key.common.back', '返回')}</span>
                    </Button>
                </div>

                <div className="grid md:grid-cols-3 gap-6">
                    {/* 左侧:角色列表 */}
                    <div className="md:col-span-1 space-y-4">
                        <div className="flex items-center justify-between mb-3">
                            <h3 className="font-semibold text-lg text-slate-800">
                                <span className="text-slate-800" suppressHydrationWarning>{getText('key.characters.charactersList', '角色列表')} ({characters.length})</span>
                            </h3>
                            <Button
                                onClick={handleNewCharacter}
                                size="sm"
                                className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700"
                            >
                                <Plus className="w-4 h-4 mr-1" />
                                <span suppressHydrationWarning>{getText('key.characters.addCharacter', '新增')}</span>
                            </Button>
                        </div>
                        {characters.length === 0 ? (
                            <div className="p-8 text-center text-slate-500 rounded-lg border-2 border-dashed">
                                <p suppressHydrationWarning>
                                    {getText('key.characters.noCharacters', '还没有角色，点击「新增」创建第一个角色')}
                                </p>
                            </div>
                        ) : (
                            <div className="space-y-2 max-h-[600px] overflow-y-auto">
                                {characters.map((char) => (
                                    <div
                                        key={char.id}
                                        className={`p-3 rounded-xl border-2 cursor-pointer transition-all hover:shadow-md ${
                                            editingId === char.id
                                                ? 'border-indigo-500 bg-gradient-to-br from-indigo-50 to-purple-50 shadow-md'
                                                : 'border-slate-200 hover:border-indigo-300 bg-white'
                                        }`}
                                        onClick={() => handleEdit(char)}
                                    >
                                        <div className="flex items-center gap-3">
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
                                                <p className="text-xs text-gray-500 truncate">{char.identity || getText('key.characters.noIdentity', '未设置身份')}</p>
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
                            </div>
                        )}
                    </div>

                    {/* 右侧:编辑表单 */}
                    <div className="md:col-span-2">
                        {editingId ? (
                            <Card className="shadow-lg border-2 border-slate-200">
                                <CardHeader className="bg-gradient-to-br from-purple-50 to-pink-50">
                                    <div className="flex items-center justify-between">
                                        <CardTitle className="text-slate-800" suppressHydrationWarning>
                                            {editingId === 'new' ? getText('key.characters.createNew', '🌟 创建新角色') : getText('key.characters.edit', '✏️ 编辑角色')}
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
                                            <span className="text-amber-700 font-medium" suppressHydrationWarning>
                                                {isAutocompleting ? getText('key.common.aiAutocompleting', 'AI补全中...') : getText('key.common.aiAutocomplete', 'AI帮我填')}
                                            </span>
                                        </Button>
                                    </div>
                                </CardHeader>
                                <CardContent className="space-y-6 max-h-[700px] overflow-y-auto">
                                    {/* 基础信息 */}
                                    <div>
                                        <h3 className="font-semibold text-lg mb-3 text-indigo-900" suppressHydrationWarning>
                                            {getText('key.characters.basicInfo', '基础信息')}
                                        </h3>
                                        <div className="grid md:grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-sm font-medium mb-1" suppressHydrationWarning>
                                                    {getText('key.characters.nameLabel', '角色姓名 *')}
                                                </label>
                                                <Input
                                                    value={formData.name || ''}
                                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                                    placeholder="如：张三、Alice"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium mb-1" suppressHydrationWarning>
                                                    {getText('key.characters.displayNameLabel', '显示名称 *')}
                                                </label>
                                                <Input
                                                    value={formData.displayName || ''}
                                                    onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
                                                    placeholder="如：勇敢的骑士、神秘女孩"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium mb-1" suppressHydrationWarning>
                                                    {getText('key.characters.genderLabel', '性别')}
                                                </label>
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
                                                <label className="block text-sm font-medium mb-1" suppressHydrationWarning>
                                                    {getText('key.characters.ageLabel', '年龄')}
                                                </label>
                                                <Input
                                                    value={formData.age || ''}
                                                    onChange={(e) => setFormData({ ...formData, age: e.target.value })}
                                                    placeholder="如：18、青年、中年"
                                                />
                                            </div>
                                            <div className="md:col-span-2">
                                                <label className="block text-sm font-medium mb-1" suppressHydrationWarning>
                                                    {getText('key.characters.identityLabel', '身份/职业')}
                                                </label>
                                                <Input
                                                    value={formData.identity || ''}
                                                    onChange={(e) => setFormData({ ...formData, identity: e.target.value })}
                                                    placeholder="如：学生、侦探、骑士、魔法师"
                                                />
                                            </div>
                                            <div className="md:col-span-2">
                                                <label className="block text-sm font-medium mb-1" suppressHydrationWarning>
                                                    {getText('key.characters.descriptionLabel', '角色描述')}
                                                </label>
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
                                        <h3 className="font-semibold text-lg mb-3 text-purple-900" suppressHydrationWarning>
                                            {getText('key.characters.appearanceLabel', '外观特征')}
                                        </h3>
                                        <div className="grid md:grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-sm font-medium mb-1" suppressHydrationWarning>
                                                    {getText('key.characters.hairStyleLabel', '发型')}
                                                </label>
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
                                                <label className="block text-sm font-medium mb-1" suppressHydrationWarning>
                                                    {getText('key.characters.clothingLabel', '服饰')}
                                                </label>
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
                                                <label className="block text-sm font-medium mb-1" suppressHydrationWarning>
                                                    {getText('key.characters.facialFeaturesLabel', '五官风格')}
                                                </label>
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
                                                <label className="block text-sm font-medium mb-1" suppressHydrationWarning>
                                                    {getText('key.characters.bodyTypeLabel', '体型')}
                                                </label>
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
                                                <label className="block text-sm font-medium mb-1" suppressHydrationWarning>
                                                    {getText('key.characters.otherFeaturesLabel', '其他特征')}
                                                </label>
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
                                        <h3 className="font-semibold text-lg mb-3 text-blue-900" suppressHydrationWarning>
                                            {getText('key.characters.visualAssetsLabel', '🎨 视觉素材')}
                                        </h3>
                                        
                                        {/* 一键生成提示 */}
                                        <div className="bg-gradient-to-r from-indigo-50 to-purple-50 p-4 rounded-lg border border-indigo-200 mb-4">
                                            <p className="text-sm text-gray-700 mb-3">
                                                💡 <strong>推荐流程</strong>：先生成立绘，再基于立绘生成头像，保持角色形象一致性
                                            </p>
                                            <Button
                                                onClick={handleGenerateAll}
                                                disabled={spriteStatus.status === 'running' || avatarStatus.status === 'running'}
                                                className="w-full gap-2 bg-gradient-to-r from-purple-600 to-pink-600"
                                            >
                                                <Sparkles className="w-4 h-4" />
                                                <span suppressHydrationWarning>
                                                    {getText('key.characters.generateAll', '一键生成立绘 + 头像')}
                                                </span>
                                            </Button>

                                            {/* AI生成立绘 */}
                                            <div>
                                                <label className="block text-sm font-medium mb-2" suppressHydrationWarning>
                                                    {getText('key.characters.spriteLabel', '角色立绘')}
                                                </label>
                                                <div className="bg-gradient-to-r from-blue-50 to-purple-50 p-4 rounded-lg border border-blue-200">
                                                    <p className="text-sm text-gray-600 mb-3">
                                                        基于角色外观描述，使用通义万相AI生成全身立绘
                                                    </p>
                                                    <Button
                                                        onClick={handleGenerateSprite}
                                                        disabled={spriteStatus.status === 'running' || !formData.displayName}
                                                        className="w-full gap-2 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
                                                    >
                                                        {spriteStatus.status === 'running' ? (
                                                            <Loader2 className="w-4 h-4 animate-spin" />
                                                        ) : (
                                                            <Wand2 className="w-4 h-4" />
                                                        )}
                                                        <span suppressHydrationWarning>
                                                            {spriteStatus.status === 'running' ? getText('key.characters.sprite.generating', '生成中...') : getText('key.characters.generateSprite', 'AI生成立绘')}
                                                        </span>
                                                    </Button>
                                                    
                                                    <StatusIndicator status={spriteStatus} label="立绘生成" />
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

                                            {/* AI生成头像 */}
                                            <div>
                                                <label className="block text-sm font-medium mb-2" suppressHydrationWarning>
                                                    {getText('key.characters.avatarLabel', '角色头像')}
                                                </label>
                                                <div className="bg-gradient-to-r from-green-50 to-emerald-50 p-4 rounded-lg border border-green-200">
                                                    <p className="text-sm text-gray-600 mb-3">
                                                        {formData.sprites?.length ? 
                                                            '✨ 将基于最新立绘生成一致性头像' : 
                                                            '使用AI生成角色头像(圆形头像特写)'
                                                        }
                                                    </p>
                                                    <Button
                                                        onClick={handleGenerateAvatar}
                                                        disabled={avatarStatus.status === 'running' || !formData.displayName}
                                                        className="w-full gap-2 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700"
                                                    >
                                                        {avatarStatus.status === 'running' ? (
                                                            <Loader2 className="w-4 h-4 animate-spin" />
                                                        ) : (
                                                            <Wand2 className="w-4 h-4" />
                                                        )}
                                                        <span suppressHydrationWarning>
                                                            {avatarStatus.status === 'running' ? getText('key.characters.avatar.generating', '生成中...') : getText('key.characters.generateAvatar', 'AI生成头像')}
                                                        </span>
                                                    </Button>
                                                    
                                                    <StatusIndicator status={avatarStatus} label="头像生成" />
                                                </div>
                                                
                                                {/* 手动输入URL */}
                                                <div className="mt-3">
                                                    <label className="block text-xs text-gray-500 mb-1" suppressHydrationWarning>
                                                        {getText('key.characters.avatarUrlLabel', '或手动输入头像URL')}
                                                    </label>
                                                    <Input
                                                        value={formData.avatarUrl || ''}
                                                        onChange={(e) => setFormData({ ...formData, avatarUrl: e.target.value })}
                                                        placeholder="粘贴头像图片链接"
                                                    />
                                                </div>
                                                
                                                {/* 头像预览 */}
                                                {formData.avatarUrl && (
                                                    <div className="flex items-center gap-3 bg-gray-50 p-3 rounded mt-3">
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
                                    </div>

                                    {/* 性格属性 */}
                                    <div>
                                        <h3 className="font-semibold text-lg mb-3 text-pink-900" suppressHydrationWarning>
                                            {t('key.characters.personalityLabel') || '性格属性'}
                                        </h3>
                                        <div className="space-y-4">
                                            <div>
                                                <label className="block text-sm font-medium mb-1" suppressHydrationWarning>
                                                    {t('key.characters.traitsLabel') || '性格标签'}
                                                </label>
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
                                                <label className="block text-sm font-medium mb-1" suppressHydrationWarning>
                                                    {t('key.characters.temperamentLabel') || '性情倾向'}
                                                </label>
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
                                                <label className="block text-sm font-medium mb-1" suppressHydrationWarning>
                                                    {t('key.characters.valuesLabel') || '价值观'}
                                                </label>
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
                                        <h3 className="font-semibold text-lg mb-3 text-green-900" suppressHydrationWarning>
                                            {t('key.characters.coreTraitsLabel') || '核心特质'}
                                        </h3>
                                        <div className="space-y-4">
                                            <div>
                                                <label className="block text-sm font-medium mb-1" suppressHydrationWarning>
                                                    {t('key.characters.specialSkillsLabel') || '特殊技能'}
                                                </label>
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
                                                <label className="block text-sm font-medium mb-1" suppressHydrationWarning>
                                                    {t('key.characters.obsessionLabel') || '执念/目标'}
                                                </label>
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
                                                <label className="block text-sm font-medium mb-1" suppressHydrationWarning>
                                                    {t('key.characters.backstoryLabel') || '背景故事'}
                                                </label>
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
                                        {editingId && (
                                            <Button
                                                onClick={handleCancel}
                                                variant="outline"
                                                className="flex-1"
                                            >
                                                <span suppressHydrationWarning>{t('key.characters.cancel') || '取消编辑'}</span>
                                            </Button>
                                        )}
                                        <Button
                                            onClick={handleSaveCharacter}
                                            className="flex-1 bg-gradient-to-r from-indigo-600 to-purple-600"
                                            disabled={!formData.name || !formData.displayName}
                                        >
                                            <Save className="w-4 h-4 mr-2" />
                                            <span suppressHydrationWarning>
                                                {editingId && editingId !== 'new' ? t('key.characters.updateCharacter') || '更新角色' : t('key.characters.addCharacter') || '添加角色'}
                                            </span>
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>
                        ) : (
                            <Card className="h-full flex items-center justify-center min-h-[400px] shadow-lg border-2 border-slate-200 bg-gradient-to-br from-slate-50 to-purple-50">
                                <div className="text-center text-slate-500">
                                    <Users className="w-20 h-20 mx-auto mb-4 text-slate-300" />
                                    <p className="text-lg font-medium" suppressHydrationWarning>
                                        {t('key.characters.selectHint') || '请从左侧选择一个角色进行编辑'}
                                    </p>
                                    <p className="text-sm mt-2" suppressHydrationWarning>
                                        {t('key.characters.addHint') || '或点击「新增」按钮创建新角色'}
                                    </p>
                                </div>
                            </Card>
                        )}
                    </div>
                </div>

                {/* 底部导航 */}
                <div className="mt-8 flex justify-between">
                    <Button
                        variant="outline"
                        className="border-slate-300 hover:bg-slate-100"
                        onClick={() => router.push('/setup')}
                    >
                        <span suppressHydrationWarning>{t('key.common.backToSetup') || '← 返回设置'}</span>
                    </Button>
                    <Button
                        className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 shadow-lg"
                        onClick={() => router.push('/setup/summary')}
                    >
                        <span suppressHydrationWarning>{t('key.characters.nextStep') || '下一步:查看汇总 →'}</span>
                    </Button>
                </div>
            </div>
            {DialogComponent}
        </main>
    );
}

// 用 Suspense 包裹以支持 useSearchParams
export default function CharactersPage() {
    return (
        <Suspense fallback={<div className="min-h-screen bg-gradient-to-br from-slate-50 via-indigo-50 to-purple-50 flex items-center justify-center"><div className="text-lg">加载中...</div></div>}>
            <CharactersPageContent />
        </Suspense>
    );
}
