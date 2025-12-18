'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Card, CardHeader, CardTitle, CardContent, Input, useToast, useConfirmDialog } from '@vng/ui';
import { Plus, Trash2, Save, ArrowLeft, Image } from 'lucide-react';
import { useSetupStore } from '@/stores/setupStore';
import { createId } from '@vng/core';
import type { Background } from '@vng/core';
import { useI18N } from '@/components/I18nProvider';

export default function BackgroundsPage() {
    const { I18N } = useI18N();
    const router = useRouter();
    const toast = useToast();
    const { confirm, DialogComponent } = useConfirmDialog();
    const { backgrounds, addBackground, updateBackground, deleteBackground } = useSetupStore();
    
    const [editingId, setEditingId] = useState<string | null>(null);
    const [formData, setFormData] = useState<Partial<Background>>({
        name: '',
        description: '',
        imageUrl: '',
        worldSetting: {
            era: '现代',
            location: '城市',
            rules: '',
            specialElements: [],
        },
        sceneDetails: {
            type: '室内',
            specificLocation: '',
            atmosphere: '',
            timeOfDay: '上午',
            weather: '',
            lighting: '',
        },
    });

    const handleNewBackground = () => {
        setEditingId('new');
        setFormData({
            name: '',
            description: '',
            imageUrl: '',
            worldSetting: {},
            sceneDetails: {},
        });
    };

    const handleSave = () => {
        if (!formData.name) {
            toast.warning(I18N['key.backgrounds.nameRequired'] || '请至少填写背景名称');
            return;
        }

        const background: Background = {
            id: editingId === 'new' ? createId() : editingId!,
            name: formData.name,
            description: formData.description || '',
            imageUrl: formData.imageUrl || '',
            worldSetting: formData.worldSetting,
            sceneDetails: formData.sceneDetails,
        };

        if (editingId === 'new') {
            addBackground(background);
        } else {
            updateBackground(editingId!, background);
        }

        setEditingId(null);
    };

    const handleEdit = (background: Background) => {
        setEditingId(background.id);
        setFormData(background);
    };

    const handleDelete = async (id: string) => {
        const confirmed = await confirm({
            title: I18N['key.backgrounds.deleteTitle'] || '删除背景',
            message: I18N['key.backgrounds.deleteMessage'] || '确定要删除这个背景吗？此操作不可恢复。',
            confirmText: I18N['key.common.delete'] || '删除',
            cancelText: I18N['key.common.cancel'] || '取消',
            variant: 'danger',
        });
        if (confirmed) {
            deleteBackground(id);
            toast.success(I18N['key.backgrounds.deleteSuccess'] || '背景已删除');
        }
    };

    return (
        <main className="min-h-screen bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 p-8">
            <div className="max-w-6xl mx-auto">
                {/* 标题栏 */}
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <h1 className="text-4xl font-bold text-white mb-2">{I18N['key.backgrounds.title'] || '🎨 背景定义'}</h1>
                        <p className="text-white/80">{I18N['key.backgrounds.subtitle'] || '设置游戏世界观与场景细节'}</p>
                    </div>
                    <Button
                        variant="outline"
                        className="bg-white/20 text-white border-white/40 hover:bg-white/30"
                        onClick={() => router.push('/setup')}
                    >
                        <ArrowLeft className="w-4 h-4 mr-2" />
                        {I18N['key.common.back'] || '返回'}
                    </Button>
                </div>

                <div className="grid md:grid-cols-3 gap-6">
                    {/* 左侧：背景列表 */}
                    <div className="md:col-span-1 space-y-4">
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center justify-between">
                                    <span>{(I18N['key.backgrounds.list'] || '背景列表 ({count})').replace('{count}', backgrounds.length.toString())}</span>
                                    <Button size="sm" onClick={handleNewBackground}>
                                        <Plus className="w-4 h-4 mr-1" />
                                        {I18N['key.common.add'] || '新增'}
                                    </Button>
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-2">
                                {backgrounds.length === 0 && (
                                    <p className="text-gray-500 text-sm text-center py-4">
                                        {I18N['key.backgrounds.empty'] || '还没有背景，点击「新增」创建第一个背景'}
                                    </p>
                                )}
                                {backgrounds.map((bg) => (
                                    <div
                                        key={bg.id}
                                        className={`p-3 rounded border-2 cursor-pointer transition-all ${
                                            editingId === bg.id
                                                ? 'border-purple-500 bg-purple-50'
                                                : 'border-gray-200 hover:border-purple-300'
                                        }`}
                                        onClick={() => handleEdit(bg)}
                                    >
                                        <div className="flex items-center justify-between">
                                            <div className="flex-1">
                                                <h3 className="font-medium text-gray-900">{bg.name}</h3>
                                                <p className="text-xs text-gray-500">
                                                    {bg.sceneDetails?.specificLocation || '未设置具体场景'}
                                                </p>
                                            </div>
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleDelete(bg.id);
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
                                        {editingId === 'new' ? '创建新背景' : '编辑背景'}
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-6">
                                    {/* 基础信息 */}
                                    <div>
                                        <h3 className="font-semibold text-lg mb-3 text-indigo-900">基础信息</h3>
                                        <div className="space-y-4">
                                            <div>
                                                <label className="block text-sm font-medium mb-1">背景名称 *</label>
                                                <Input
                                                    value={formData.name || ''}
                                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                                    placeholder="如：学校教室、咖啡店、城堡大厅"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium mb-1">背景描述</label>
                                                <textarea
                                                    className="w-full border rounded px-3 py-2 min-h-[80px]"
                                                    value={formData.description || ''}
                                                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                                    placeholder="简要描述这个背景的特点..."
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    {/* 世界观基础 */}
                                    <div>
                                        <h3 className="font-semibold text-lg mb-3 text-purple-900">世界观基础</h3>
                                        <div className="grid md:grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-sm font-medium mb-1">时代背景</label>
                                                <select
                                                    className="w-full border rounded px-3 py-2"
                                                    value={formData.worldSetting?.era || '现代'}
                                                    onChange={(e) =>
                                                        setFormData({
                                                            ...formData,
                                                            worldSetting: { ...formData.worldSetting, era: e.target.value as any },
                                                        })
                                                    }
                                                >
                                                    <option value="古代">古代</option>
                                                    <option value="现代">现代</option>
                                                    <option value="未来">未来</option>
                                                    <option value="科幻">科幻</option>
                                                    <option value="奇幻">奇幻</option>
                                                    <option value="其他">其他</option>
                                                </select>
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium mb-1">地域设定</label>
                                                <select
                                                    className="w-full border rounded px-3 py-2"
                                                    value={formData.worldSetting?.location || '城市'}
                                                    onChange={(e) =>
                                                        setFormData({
                                                            ...formData,
                                                            worldSetting: { ...formData.worldSetting, location: e.target.value as any },
                                                        })
                                                    }
                                                >
                                                    <option value="城市">城市</option>
                                                    <option value="乡村">乡村</option>
                                                    <option value="异世界">异世界</option>
                                                    <option value="宇宙">宇宙</option>
                                                    <option value="海洋">海洋</option>
                                                    <option value="其他">其他</option>
                                                </select>
                                            </div>
                                            <div className="md:col-span-2">
                                                <label className="block text-sm font-medium mb-1">社会规则</label>
                                                <Input
                                                    value={formData.worldSetting?.rules || ''}
                                                    onChange={(e) =>
                                                        setFormData({
                                                            ...formData,
                                                            worldSetting: { ...formData.worldSetting, rules: e.target.value },
                                                        })
                                                    }
                                                    placeholder="如：魔法存在、科技发达、阶级制度"
                                                />
                                            </div>
                                            <div className="md:col-span-2">
                                                <label className="block text-sm font-medium mb-1">特殊元素</label>
                                                <Input
                                                    value={formData.worldSetting?.specialElements?.join(', ') || ''}
                                                    onChange={(e) =>
                                                        setFormData({
                                                            ...formData,
                                                            worldSetting: {
                                                                ...formData.worldSetting,
                                                                specialElements: e.target.value.split(',').map((s) => s.trim()).filter(Boolean),
                                                            },
                                                        })
                                                    }
                                                    placeholder="用逗号分隔，如：魔法, 机甲, 超能力"
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    {/* 场景细节 */}
                                    <div>
                                        <h3 className="font-semibold text-lg mb-3 text-pink-900">场景细节</h3>
                                        <div className="grid md:grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-sm font-medium mb-1">场景类型</label>
                                                <select
                                                    className="w-full border rounded px-3 py-2"
                                                    value={formData.sceneDetails?.type || '室内'}
                                                    onChange={(e) =>
                                                        setFormData({
                                                            ...formData,
                                                            sceneDetails: { ...formData.sceneDetails, type: e.target.value as any },
                                                        })
                                                    }
                                                >
                                                    <option value="室内">室内</option>
                                                    <option value="室外">室外</option>
                                                    <option value="半开放">半开放</option>
                                                </select>
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium mb-1">具体场景</label>
                                                <Input
                                                    value={formData.sceneDetails?.specificLocation || ''}
                                                    onChange={(e) =>
                                                        setFormData({
                                                            ...formData,
                                                            sceneDetails: { ...formData.sceneDetails, specificLocation: e.target.value },
                                                        })
                                                    }
                                                    placeholder="如：教室、城堡、太空舱"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium mb-1">环境氛围</label>
                                                <Input
                                                    value={formData.sceneDetails?.atmosphere || ''}
                                                    onChange={(e) =>
                                                        setFormData({
                                                            ...formData,
                                                            sceneDetails: { ...formData.sceneDetails, atmosphere: e.target.value },
                                                        })
                                                    }
                                                    placeholder="如：温馨、诡异、紧张"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium mb-1">时间段</label>
                                                <select
                                                    className="w-full border rounded px-3 py-2"
                                                    value={formData.sceneDetails?.timeOfDay || '上午'}
                                                    onChange={(e) =>
                                                        setFormData({
                                                            ...formData,
                                                            sceneDetails: { ...formData.sceneDetails, timeOfDay: e.target.value as any },
                                                        })
                                                    }
                                                >
                                                    <option value="清晨">清晨</option>
                                                    <option value="上午">上午</option>
                                                    <option value="下午">下午</option>
                                                    <option value="黄昏">黄昏</option>
                                                    <option value="晚上">晚上</option>
                                                    <option value="深夜">深夜</option>
                                                </select>
                                            </div>
                                        </div>
                                    </div>

                                    {/* 操作按钮 */}
                                    <div className="flex gap-3 pt-4 border-t">
                                        <Button
                                            className="flex-1 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
                                            onClick={handleSave}
                                        >
                                            <Save className="w-4 h-4 mr-2" />
                                            保存背景
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
                                    <Image className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                                    <p>请从左侧选择一个背景进行编辑</p>
                                    <p className="text-sm mt-2">或点击「新增」按钮创建新背景</p>
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
                        onClick={() => router.push('/setup/characters')}
                    >
                        ← 上一步：角色定义
                    </Button>
                    <Button
                        className="bg-gradient-to-r from-green-600 to-teal-600 hover:from-green-700 hover:to-teal-700"
                        onClick={() => router.push('/setup/summary')}
                    >
                        下一步：查看汇总 →
                    </Button>
                </div>
            </div>
            {DialogComponent}
        </main>
    );
}
