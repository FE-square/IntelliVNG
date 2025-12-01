'use client';

import { useState } from 'react';
import { Card, CardContent, Button } from '@vng/ui';
import { Plus, Trash2, GripVertical, Edit2, Save, X, User } from 'lucide-react';
import type { GameProject } from '@vng/core';

interface SceneCardEditorProps {
    project: GameProject;
    onUpdate?: (project: GameProject) => void;
}

export function SceneCardEditor({ project, onUpdate }: SceneCardEditorProps) {
    const [scenes, setScenes] = useState(project.script || []);
    const [editingId, setEditingId] = useState<string | null>(null);

    // 删除场景
    const handleDelete = (id: string) => {
        if (confirm('确定要删除这个场景吗？')) {
            const newScenes = scenes.filter(s => s.id !== id);
            setScenes(newScenes);
            onUpdate?.({ ...project, script: newScenes });
        }
    };

    // 保存编辑
    const handleSave = (id: string, newText: string) => {
        const newScenes = scenes.map(s => {
            if (s.id === id && s.type === 'dialogue') {
                return { ...s, text: newText };
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
                        <h2 className="text-2xl font-bold text-gray-900">场景卡片编辑器</h2>
                        <p className="text-sm text-gray-500">共 {scenes.length} 个场景卡片</p>
                    </div>
                </div>

                {/* 场景卡片列表 */}
                <div className="space-y-4">
                    {scenes.map((scene, index) => {
                        const character = scene.type === 'dialogue' ? getCharacter(scene.characterId || '') : undefined;
                        const isEditing = editingId === scene.id;
                        
                        return (
                            <SceneCard
                                key={scene.id}
                                scene={scene}
                                index={index}
                                character={character}
                                isEditing={isEditing}
                                onEdit={() => setEditingId(scene.id)}
                                onSave={(newText) => handleSave(scene.id, newText)}
                                onCancel={() => setEditingId(null)}
                                onDelete={() => handleDelete(scene.id)}
                            />
                        );
                    })}
                </div>

                {scenes.length === 0 && (
                    <div className="text-center py-12 text-gray-500">
                        <p>还没有场景卡片</p>
                    </div>
                )}
            </div>
        </div>
    );
}

// 单个场景卡片组件
interface SceneCardProps {
    scene: any;
    index: number;
    character?: any;
    isEditing: boolean;
    onEdit: () => void;
    onSave: (newText: string) => void;
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
    const [editText, setEditText] = useState(scene.text || '');

    if (isEditing) {
        return (
            <Card className="border-2 border-blue-500 shadow-lg">
                <CardContent className="p-6">
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium mb-2">对话内容</label>
                            <textarea
                                className="w-full border rounded px-3 py-2 min-h-[100px] focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                value={editText}
                                onChange={(e) => setEditText(e.target.value)}
                            />
                        </div>
                        <div className="flex gap-2">
                            <Button
                                className="flex-1 bg-blue-600 hover:bg-blue-700"
                                onClick={() => onSave(editText)}
                            >
                                <Save className="w-4 h-4 mr-2" />
                                保存
                            </Button>
                            <Button variant="outline" onClick={onCancel}>
                                <X className="w-4 h-4 mr-2" />
                                取消
                            </Button>
                        </div>
                    </div>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className="hover:shadow-lg transition-shadow border-l-4 border-l-indigo-500">
            <CardContent className="p-6">
                <div className="flex items-start gap-4">
                    {/* 序号 */}
                    <div className="flex-shrink-0 w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-lg">
                        {index + 1}
                    </div>

                    {/* 内容区 */}
                    <div className="flex-1 min-w-0">
                        {/* 角色信息 */}
                        {character && (
                            <div className="flex items-center gap-3 mb-3 bg-gradient-to-r from-purple-50 to-pink-50 rounded-lg p-3">
                                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center text-white font-bold shadow-md">
                                    {character.displayName?.[0] || <User className="w-6 h-6" />}
                                </div>
                                <div>
                                    <div className="font-semibold text-gray-900">{character.displayName}</div>
                                    <div className="text-xs text-gray-500 flex gap-2">
                                        {character.identity && <span>身份: {character.identity}</span>}
                                        {character.gender && <span>· {character.gender === 'male' ? '男' : character.gender === 'female' ? '女' : '其他'}</span>}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* 对话内容 */}
                        <div className="bg-white border-2 border-gray-200 rounded-lg p-4 mb-3 shadow-sm">
                            <p className="text-gray-800 text-base leading-relaxed whitespace-pre-wrap">
                                {scene.text || '(无内容)'}
                            </p>
                        </div>

                        {/* 元信息 */}
                        <div className="flex items-center gap-4 text-xs text-gray-500">
                            <span className="px-2 py-1 bg-gray-100 rounded">类型: {scene.type}</span>
                            {scene.nextNodeId && (
                                <span className="px-2 py-1 bg-green-100 text-green-700 rounded">→ 有下一场景</span>
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
