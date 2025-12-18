'use client';

import { useState } from 'react';
import { Card, CardContent, Button, useConfirmDialog } from '@vng/ui';
import { Trash2, Edit2, Save, X, User, MessageSquare } from 'lucide-react';
import type { GameProject, StoryNode } from '@vng/core';
import { useI18N } from '@/components/I18nProvider';

interface SceneCardEditorProps {
    project: GameProject;
    onUpdate?: (project: GameProject) => void;
}

export function SceneCardEditor({ project, onUpdate }: SceneCardEditorProps) {
    const { I18N } = useI18N();
    const { confirm, DialogComponent } = useConfirmDialog();
    const [scenes, setScenes] = useState<StoryNode[]>(project.script || []);
    const [editingId, setEditingId] = useState<string | null>(null);

    // 删除场景
    const handleDelete = async (id: string) => {
        const confirmed = await confirm({
            title: I18N['key.sceneEditor.deleteTitle'] || '删除场景',
            message: I18N['key.sceneEditor.deleteMessage'] || '确定要删除这个场景吗？',
            confirmText: I18N['key.common.delete'] || '删除',
            cancelText: I18N['key.common.cancel'] || '取消',
            variant: 'danger',
        });
        if (confirmed) {
            const newScenes = scenes.filter(s => s.id !== id);
            setScenes(newScenes);
            onUpdate?.({ ...project, script: newScenes });
        }
    };

    // 保存编辑 - 更新节点的 title 或 narration
    const handleSave = (id: string, updates: Partial<StoryNode>) => {
        const newScenes = scenes.map(s => {
            if (s.id === id) {
                return { ...s, ...updates };
            }
            return s;
        });
        setScenes(newScenes);
        onUpdate?.({ ...project, script: newScenes });
        setEditingId(null);
    };

    // 获取角色信息
    const getCharacter = (characterId: string) => {
        return project.characters.find(c => c.id === characterId);
    };

    return (
        <div className="h-full overflow-y-auto bg-slate-50 p-6">
            <div className="max-w-4xl mx-auto space-y-4">
                {/* 标题 */}
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h2 className="text-2xl font-bold text-gray-900">{I18N['key.sceneEditor.title'] || '场景卡片编辑器'}</h2>
                        <p className="text-sm text-gray-500">{(I18N['key.sceneEditor.count'] || '共 {count} 个场景卡片').replace('{count}', scenes.length.toString())}</p>
                    </div>
                </div>

                {/* 场景卡片列表 */}
                <div className="space-y-4">
                    {scenes.map((scene, index) => {
                        // 获取第一个对话的角色
                        const firstDialogue = scene.dialogues?.[0];
                        const character = firstDialogue ? getCharacter(firstDialogue.characterId) : undefined;
                        const isEditing = editingId === scene.id;
                        
                        return (
                            <SceneCard
                                key={scene.id}
                                scene={scene}
                                index={index}
                                character={character}
                                isEditing={isEditing}
                                onEdit={() => setEditingId(scene.id)}
                                onSave={(updates) => handleSave(scene.id, updates)}
                                onCancel={() => setEditingId(null)}
                                onDelete={() => handleDelete(scene.id)}
                            />
                        );
                    })}
                </div>

                {scenes.length === 0 && (
                    <div className="text-center py-12 text-gray-500">
                        <p>{I18N['key.sceneEditor.empty'] || '还没有场景卡片'}</p>
                    </div>
                )}
            </div>
            {DialogComponent}
        </div>
    );
}

// 单个场景卡片组件
interface SceneCardProps {
    scene: StoryNode;
    index: number;
    character?: ReturnType<typeof Array.prototype.find>;
    isEditing: boolean;
    onEdit: () => void;
    onSave: (updates: Partial<StoryNode>) => void;
    onCancel: () => void;
    onDelete: () => void;
}

function SceneCard({ 
    scene, 
    index, 
    character, 
    isEditing, 
    onEdit, 
    onSave, 
    onCancel, 
    onDelete
}: SceneCardProps) {
    const { I18N } = useI18N();
    const [editTitle, setEditTitle] = useState(scene.title || '');
    const [editNarration, setEditNarration] = useState(scene.narration || '');

    if (isEditing) {
        return (
            <Card className="border-2 border-blue-500 shadow-lg">
                <CardContent className="p-6">
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium mb-2">{I18N['key.sceneEditor.sceneTitle'] || '场景标题'}</label>
                            <input
                                type="text"
                                className="w-full border rounded px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                value={editTitle}
                                onChange={(e) => setEditTitle(e.target.value)}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-2">{I18N['key.sceneEditor.narration'] || '旁白/描述'}</label>
                            <textarea
                                className="w-full border rounded px-3 py-2 min-h-[100px] focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                value={editNarration}
                                onChange={(e) => setEditNarration(e.target.value)}
                                placeholder={I18N['key.sceneEditor.narrationPlaceholder'] || '场景旁白或背景描述...'}
                            />
                        </div>
                        <div className="flex gap-2">
                            <Button
                                className="flex-1 bg-blue-600 hover:bg-blue-700"
                                onClick={() => onSave({ title: editTitle, narration: editNarration })}
                            >
                                <span className="flex items-center">
                                    <Save className="w-4 h-4 mr-2" />
                                    {I18N['key.common.save'] || '保存'}
                                </span>
                            </Button>
                            <Button variant="outline" onClick={onCancel}>
                                <span className="flex items-center">
                                    <X className="w-4 h-4 mr-2" />
                                    {I18N['key.common.cancel'] || '取消'}
                                </span>
                            </Button>
                        </div>
                    </div>
                </CardContent>
            </Card>
        );
    }

    const typeLabels: Record<string, string> = {
        'scene': I18N['key.sceneEditor.type.scene'] || '场景',
        'branch': I18N['key.sceneEditor.type.branch'] || '分支',
        'ending': I18N['key.sceneEditor.type.ending'] || '结局',
    };

    const typeBorderColors: Record<string, string> = {
        'scene': 'border-l-indigo-500',
        'branch': 'border-l-amber-500',
        'ending': 'border-l-red-500',
    };

    return (
        <Card className={`hover:shadow-lg transition-shadow border-l-4 ${typeBorderColors[scene.type] || 'border-l-gray-500'}`}>
            <CardContent className="p-6">
                <div className="flex items-start gap-4">
                    {/* 序号 */}
                    <div className="flex-shrink-0 w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-lg">
                        {index + 1}
                    </div>

                    {/* 内容区 */}
                    <div className="flex-1 min-w-0">
                        {/* 标题 */}
                        <h3 className="text-lg font-semibold text-gray-900 mb-2">
                            {scene.title || `(${I18N['key.sceneEditor.noTitle'] || '无标题'})`}
                        </h3>

                        {/* 旁白 */}
                        {scene.narration && (
                            <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 mb-3 italic text-gray-600">
                                {scene.narration}
                            </div>
                        )}

                        {/* 对话列表 */}
                        {scene.dialogues && scene.dialogues.length > 0 && (
                            <div className="space-y-2 mb-3">
                                {scene.dialogues.slice(0, 3).map((dialogue, idx) => {
                                    const dialogueChar = character?.id === dialogue.characterId 
                                        ? character 
                                        : undefined;
                                    return (
                                        <div key={dialogue.id || idx} className="flex items-start gap-2 bg-white border rounded-lg p-2">
                                            <MessageSquare className="w-4 h-4 text-indigo-500 mt-1 flex-shrink-0" />
                                            <div className="flex-1">
                                                {dialogueChar && (
                                                    <span className="font-medium text-indigo-600 text-sm">
                                                        {(dialogueChar as any).displayName}:
                                                    </span>
                                                )}
                                                <p className="text-gray-700 text-sm">{dialogue.text}</p>
                                            </div>
                                        </div>
                                    );
                                })}
                                {scene.dialogues.length > 3 && (
                                    <p className="text-xs text-gray-500 text-center">
                                        {(I18N['key.sceneEditor.moreDialogues'] || '还有 {count} 条对话...').replace('{count}', (scene.dialogues.length - 3).toString())}
                                    </p>
                                )}
                            </div>
                        )}

                        {/* 元信息 */}
                        <div className="flex items-center gap-4 text-xs text-gray-500">
                            <span className="px-2 py-1 bg-gray-100 rounded">
                                {I18N['key.sceneEditor.typeLabel'] || '类型'}: {typeLabels[scene.type] || scene.type}
                            </span>
                            {scene.isStart && (
                                <span className="px-2 py-1 bg-green-100 text-green-700 rounded">{I18N['key.sceneEditor.startNode'] || '开始节点'}</span>
                            )}
                            {scene.isEnding && (
                                <span className="px-2 py-1 bg-red-100 text-red-700 rounded">{I18N['key.sceneEditor.ending'] || '结局'}</span>
                            )}
                            {scene.nextNodeId && (
                                <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded">{I18N['key.sceneEditor.hasNextScene'] || '→ 有下一场景'}</span>
                            )}
                            {scene.choices && scene.choices.length > 0 && (
                                <span className="px-2 py-1 bg-amber-100 text-amber-700 rounded">
                                    {(I18N['key.sceneEditor.choicesCount'] || '{count} 个选项').replace('{count}', scene.choices.length.toString())}
                                </span>
                            )}
                        </div>
                    </div>

                    {/* 操作按钮 */}
                    <div className="flex flex-col gap-2">
                        <Button size="sm" variant="outline" onClick={onEdit} className="hover:bg-blue-50">
                            <Edit2 className="w-4 h-4" />
                        </Button>
                        <Button size="sm" variant="outline" onClick={onDelete} className="hover:bg-red-50 hover:text-red-600">
                            <Trash2 className="w-4 h-4" />
                        </Button>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
