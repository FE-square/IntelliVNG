'use client';

import { useState } from 'react';
import { X, Save, Plus, Trash2, ArrowUp, ArrowDown, Image as ImageIcon, ChevronDown, ChevronUp, Wand2, Music } from 'lucide-react';
import type { StoryNode, Character, StoryDialogue, Scene } from '@vng/core';
import { createId } from '@vng/core';
import { Button, Card, CardContent } from '@vng/ui';

interface NodeEditPanelProps {
    node: StoryNode;
    characters: Character[];
    scenes?: Scene[];
    onSave: (node: StoryNode) => void;
    onClose: () => void;
}

export function NodeEditPanel({ node, characters, scenes = [], onSave, onClose }: NodeEditPanelProps) {
    console.log('[NodeEditPanel] 初始化节点:', {
        id: node.id,
        title: node.title,
        dialogues: node.dialogues,
        sceneName: node.sceneName,
        visualAssets: node.visualAssets
    });
    
    // 深拷贝节点数据,确保 dialogues 数组正确传递
    const [editedNode, setEditedNode] = useState<StoryNode>({
        ...node,
        dialogues: node.dialogues || [],
        visualAssets: node.visualAssets ? { ...node.visualAssets } : undefined,
    });
    const [selectedDialogues, setSelectedDialogues] = useState<Set<number>>(new Set());
    const [showVisualAssets, setShowVisualAssets] = useState(false);
    const [showAudioAssets, setShowAudioAssets] = useState(false);  // ✅ 音频配置折叠状态
    const [generatingCharacterId, setGeneratingCharacterId] = useState<string | null>(null);
    
    // 根据 sceneName 获取对应场景
    const currentScene = scenes.find(s => s.name === editedNode.sceneName);
    
    // 自动关联场景背景图
    const handleSceneChange = (sceneName: string) => {
        const selectedScene = scenes.find(s => s.name === sceneName);
        
        setEditedNode({
            ...editedNode,
            sceneName,
            visualAssets: {
                ...editedNode.visualAssets,
                // 如果场景有背景图,自动填充
                backgroundImageUrl: selectedScene?.imageUrl || editedNode.visualAssets?.backgroundImageUrl,
            },
        });
    };
    
    // 自动添加出场角色的立绘
    const autoAddCharacterSprites = () => {
        // 获取对话中出现的所有角色
        const dialogueCharacterIds = new Set(
            editedNode.dialogues.map(d => d.characterId).filter(id => id && id !== 'narrator')
        );
        
        // 已经添加的角色
        const existingCharacterIds = new Set(
            (editedNode.visualAssets?.characters || []).map(c => c.characterId)
        );
        
        // 找出还没有添加立绘的角色
        const newCharacterSprites = Array.from(dialogueCharacterIds)
            .filter(id => !existingCharacterIds.has(id))
            .map((characterId, index) => {
                const character = characters.find(c => c.id === characterId);
                return {
                    characterId,
                    spriteUrl: character?.sprites?.[0]?.imageUrl || character?.avatarUrl || '',
                    position: { x: 30 + index * 25, y: 50 },
                    scale: 1,
                };
            });
        
        if (newCharacterSprites.length > 0) {
            setEditedNode({
                ...editedNode,
                visualAssets: {
                    ...editedNode.visualAssets,
                    characters: [
                        ...(editedNode.visualAssets?.characters || []),
                        ...newCharacterSprites,
                    ],
                },
            });
        }
    };
    
    // ✅ AI生成角色立绘
    const handleGenerateCharacterSprite = async (characterId: string) => {
        const character = characters.find(c => c.id === characterId);
        if (!character || !character.displayName) {
            alert('角色信息不完整');
            return;
        }
        
        setGeneratingCharacterId(characterId);
        try {
            // 构建 prompt
            const prompt = `${character.displayName}, ${character.description || ''}, 全身立绘, 动漫风格, 高质量`;
            
            // 调用通义万相API生成图片
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
            
            // 更新角色立绘URL
            const existingCharIndex = (editedNode.visualAssets?.characters || []).findIndex(
                c => c.characterId === characterId
            );
            
            if (existingCharIndex >= 0) {
                // 更新现有立绘
                const newCharacters = [...(editedNode.visualAssets?.characters || [])];
                newCharacters[existingCharIndex] = {
                    ...newCharacters[existingCharIndex],
                    spriteUrl: imageUrl,
                };
                setEditedNode({
                    ...editedNode,
                    visualAssets: {
                        ...editedNode.visualAssets,
                        characters: newCharacters,
                    },
                });
            } else {
                // 添加新立绘
                setEditedNode({
                    ...editedNode,
                    visualAssets: {
                        ...editedNode.visualAssets,
                        characters: [
                            ...(editedNode.visualAssets?.characters || []),
                            {
                                characterId,
                                spriteUrl: imageUrl,
                                position: { x: 50, y: 50 },
                                scale: 1,
                            },
                        ],
                    },
                });
            }
            
            alert('立绘生成成功!');
        } catch (error) {
            console.error('生成失败:', error);
            alert(`生成失败: ${error instanceof Error ? error.message : '请重试'}`);
        } finally {
            setGeneratingCharacterId(null);
        }
    };

    const handleSave = () => {
        onSave(editedNode);
    };

    const handleAddDialogue = () => {
        const newDialogue: StoryDialogue = {
            id: createId(),
            characterId: characters[0]?.id || '',
            text: '',
        };
        setEditedNode({
            ...editedNode,
            dialogues: [...editedNode.dialogues, newDialogue],
        });
    };

    const handleUpdateDialogue = (index: number, field: keyof StoryDialogue, value: string) => {
        const newDialogues = [...editedNode.dialogues];
        newDialogues[index] = {
            ...newDialogues[index],
            [field]: value,
        };
        setEditedNode({
            ...editedNode,
            dialogues: newDialogues,
        });
    };

    const handleDeleteDialogue = (index: number) => {
        setEditedNode({
            ...editedNode,
            dialogues: editedNode.dialogues.filter((_, i) => i !== index),
        });
        // 清除选中状态
        const newSelected = new Set(selectedDialogues);
        newSelected.delete(index);
        setSelectedDialogues(newSelected);
    };

    const handleMoveDialogue = (index: number, direction: 'up' | 'down') => {
        if (direction === 'up' && index === 0) return;
        if (direction === 'down' && index === editedNode.dialogues.length - 1) return;
        
        const newDialogues = [...editedNode.dialogues];
        const targetIndex = direction === 'up' ? index - 1 : index + 1;
        [newDialogues[index], newDialogues[targetIndex]] = [newDialogues[targetIndex], newDialogues[index]];
        
        setEditedNode({
            ...editedNode,
            dialogues: newDialogues,
        });
    };

    // 批量修改角色
    const handleBatchUpdateCharacter = (characterId: string) => {
        const newDialogues = editedNode.dialogues.map((dialogue, index) => 
            selectedDialogues.has(index) ? { ...dialogue, characterId } : dialogue
        );
        setEditedNode({
            ...editedNode,
            dialogues: newDialogues,
        });
        setSelectedDialogues(new Set());
    };

    const toggleDialogueSelection = (index: number) => {
        const newSelected = new Set(selectedDialogues);
        if (newSelected.has(index)) {
            newSelected.delete(index);
        } else {
            newSelected.add(index);
        }
        setSelectedDialogues(newSelected);
    };

    const getCharacterNameById = (id: string) => {
        return characters.find(c => c.id === id)?.displayName || '未选择';
    };

    // 视觉素材管理
    const handleUpdateBackground = (imageUrl: string) => {
        setEditedNode({
            ...editedNode,
            visualAssets: {
                ...editedNode.visualAssets,
                backgroundImageUrl: imageUrl,
            },
        });
    };

    const handleAddCharacterSprite = (characterId: string) => {
        const character = characters.find(c => c.id === characterId);
        if (!character) return;

        const newCharacterSprite = {
            characterId,
            spriteUrl: character.sprites?.[0]?.imageUrl || character.avatarUrl || '',
            position: { x: 50, y: 50 },
            scale: 1,
        };

        setEditedNode({
            ...editedNode,
            visualAssets: {
                ...editedNode.visualAssets,
                characters: [...(editedNode.visualAssets?.characters || []), newCharacterSprite],
            },
        });
    };

    const handleRemoveCharacterSprite = (index: number) => {
        const newCharacters = [...(editedNode.visualAssets?.characters || [])];
        newCharacters.splice(index, 1);
        setEditedNode({
            ...editedNode,
            visualAssets: {
                ...editedNode.visualAssets,
                characters: newCharacters,
            },
        });
    };

    return (
        <div className="absolute top-0 right-0 h-full w-96 bg-white shadow-2xl border-l z-10 overflow-y-auto">
            <div className="sticky top-0 bg-white border-b p-4 flex items-center justify-between z-20">
                <h3 className="font-semibold text-lg">编辑情节节点</h3>
                <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
                    <X className="w-5 h-5" />
                </button>
            </div>

            <div className="p-4 space-y-6">
                {/* 情节基本信息 */}
                <div className="space-y-4">
                    <h4 className="font-medium text-gray-900 border-b pb-2">🎬 情节信息</h4>
                    
                    {/* 情节标题 */}
                    <div>
                        <label className="block text-sm font-medium mb-1">
                            情节标题 <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="text"
                            className="w-full border rounded px-3 py-2"
                            value={editedNode.title}
                            onChange={(e) => setEditedNode({ ...editedNode, title: e.target.value })}
                            placeholder="例:初次相遇、危机爆发..."
                        />
                        <p className="text-xs text-gray-500 mt-1">这个情节的名称,用于流程图显示</p>
                    </div>
                    
                    {/* 场景选择 */}
                    <div>
                        <label className="block text-sm font-medium mb-1">
                            🏞️ 所在场景
                        </label>
                        <select
                            className="w-full border rounded px-3 py-2 bg-white"
                            value={editedNode.sceneName || ''}
                            onChange={(e) => handleSceneChange(e.target.value)}
                        >
                            <option value="">未指定场景</option>
                            {scenes.map(scene => (
                                <option key={scene.id} value={scene.name}>
                                    {scene.name} - {scene.type}
                                    {scene.imageUrl ? ' ✓ 有背景图' : ''}
                                </option>
                            ))}
                        </select>
                        <p className="text-xs text-gray-500 mt-1">选择场景会自动关联背景图</p>
                        
                        {/* 场景背景图预览 */}
                        {currentScene?.imageUrl && (
                            <div className="mt-3 border-2 border-teal-300 rounded-lg overflow-hidden">
                                <img
                                    src={currentScene.imageUrl}
                                    alt={currentScene.name}
                                    className="w-full aspect-video object-cover"
                                />
                                <div className="bg-teal-50 px-2 py-1 text-xs text-teal-800">
                                    ✓ 场景背景图已关联
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* 旁白/背景交代区 */}
                <div className="space-y-2">
                    <h4 className="font-medium text-gray-900 border-b pb-2">旁白/背景交代</h4>
                    <p className="text-xs text-gray-500">场景背景描述或旁白，无角色关联，以斜体居中展示</p>
                    <textarea
                        className="w-full border rounded px-3 py-2 min-h-[80px] italic text-center"
                        value={editedNode.narration || ''}
                        onChange={(e) => setEditedNode({ ...editedNode, narration: e.target.value })}
                        placeholder="例：夜幕降临，雨声止息，旧巷深处传来脚步声..."
                    />
                </div>

                {/* 角色对话区 */}
                <div className="space-y-3">
                    <div className="flex items-center justify-between border-b pb-2">
                        <h4 className="font-medium text-gray-900">角色对话</h4>
                        <Button size="sm" onClick={handleAddDialogue} className="gap-1">
                            <Plus className="w-4 h-4" />
                            添加对话
                        </Button>
                    </div>
                    <p className="text-xs text-gray-500">带角色名称的对话，展示时会明显区分</p>
                    
                    {/* 批量操作 */}
                    {selectedDialogues.size > 0 && (
                        <div className="bg-blue-50 p-3 rounded border border-blue-200">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-sm font-medium text-blue-900">
                                    已选择 {selectedDialogues.size} 条对话
                                </span>
                                <button
                                    onClick={() => setSelectedDialogues(new Set())}
                                    className="text-xs text-blue-600 hover:text-blue-800"
                                >
                                    取消选择
                                </button>
                            </div>
                            <div className="flex items-center gap-2">
                                <label className="text-sm">批量设置角色：</label>
                                <select
                                    className="flex-1 border rounded px-2 py-1 text-sm"
                                    onChange={(e) => {
                                        if (e.target.value) {
                                            handleBatchUpdateCharacter(e.target.value);
                                        }
                                    }}
                                    defaultValue=""
                                >
                                    <option value="">选择角色</option>
                                    {characters.map(char => (
                                        <option key={char.id} value={char.id}>
                                            {char.displayName}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    )}
                    
                    <div className="space-y-3">
                        {editedNode.dialogues.map((dialogue, index) => {
                            const character = characters.find(c => c.id === dialogue.characterId);
                            const isSelected = selectedDialogues.has(index);
                            
                            return (
                                <Card 
                                    key={dialogue.id} 
                                    className={`p-3 transition-all ${
                                        isSelected ? 'ring-2 ring-blue-400 bg-blue-50' : ''
                                    }`}
                                >
                                    <div className="space-y-2">
                                        <div className="flex items-center gap-2">
                                            {/* 选择框 */}
                                            <input
                                                type="checkbox"
                                                checked={isSelected}
                                                onChange={() => toggleDialogueSelection(index)}
                                                className="w-4 h-4"
                                            />
                                            
                                            {/* 角色显示/选择 */}
                                            <div className="flex-1 flex items-center gap-2">
                                                {/* 如果有角色,显示头像+名称 */}
                                                {character ? (
                                                    <div className="flex items-center gap-2 flex-1">
                                                        {/* 头像 */}
                                                        {character.avatarUrl ? (
                                                            <img
                                                                src={character.avatarUrl}
                                                                alt={character.displayName}
                                                                className="w-8 h-8 rounded-full object-cover border-2"
                                                                style={{ borderColor: `#${character.id.slice(0,6)}` }}
                                                            />
                                                        ) : (
                                                            <div 
                                                                className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-xs"
                                                                style={{ backgroundColor: `#${character.id.slice(0,6)}` }}
                                                            >
                                                                {character.displayName.charAt(0)}
                                                            </div>
                                                        )}
                                                        {/* 角色名称 */}
                                                        <span className="font-medium text-sm">{character.displayName}</span>
                                                    </div>
                                                ) : (
                                                    <span className="text-gray-400 text-sm">未选择角色</span>
                                                )}
                                                
                                                {/* 修改角色按钮 */}
                                                <select
                                                    className="border rounded px-2 py-1 text-xs"
                                                    value={dialogue.characterId}
                                                    onChange={(e) => handleUpdateDialogue(index, 'characterId', e.target.value)}
                                                >
                                                    <option value="">选择角色</option>
                                                    {characters.map(char => (
                                                        <option key={char.id} value={char.id}>
                                                            {char.displayName}
                                                        </option>
                                                    ))}
                                                </select>
                                            </div>
                                            
                                            {/* 上下移动 */}
                                            <div className="flex flex-col gap-1">
                                                <button
                                                    onClick={() => handleMoveDialogue(index, 'up')}
                                                    disabled={index === 0}
                                                    className="p-0.5 hover:bg-gray-100 rounded disabled:opacity-30"
                                                    title="上移"
                                                >
                                                    <ArrowUp className="w-3 h-3" />
                                                </button>
                                                <button
                                                    onClick={() => handleMoveDialogue(index, 'down')}
                                                    disabled={index === editedNode.dialogues.length - 1}
                                                    className="p-0.5 hover:bg-gray-100 rounded disabled:opacity-30"
                                                    title="下移"
                                                >
                                                    <ArrowDown className="w-3 h-3" />
                                                </button>
                                            </div>
                                            {/* 删除 */}
                                            <button
                                                onClick={() => handleDeleteDialogue(index)}
                                                className="p-1 hover:bg-red-50 rounded text-red-600"
                                                title="删除"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                        <textarea
                                            className="w-full border rounded px-2 py-1 text-sm min-h-[60px]"
                                            value={dialogue.text}
                                            onChange={(e) => handleUpdateDialogue(index, 'text', e.target.value)}
                                            placeholder="输入对话内容..."
                                            style={{
                                                borderLeft: character ? `4px solid #${character.id.slice(0,6)}` : 'none',
                                            }}
                                        />
                                    </div>
                                </Card>
                            );
                        })}
                        
                        {editedNode.dialogues.length === 0 && (
                            <div className="text-center py-8 text-gray-500 text-sm">
                                还没有对话，点击上方按钮添加
                            </div>
                        )}
                    </div>
                </div>

                {/* 视觉素材调整区 */}
                <div className="space-y-3 border-t pt-4">
                    <button
                        onClick={() => setShowVisualAssets(!showVisualAssets)}
                        className="w-full flex items-center justify-between p-3 bg-gradient-to-r from-purple-50 to-pink-50 rounded-lg border border-purple-200 hover:border-purple-300 transition-colors"
                    >
                        <div className="flex items-center gap-2">
                            <ImageIcon className="w-5 h-5 text-purple-600" />
                            <span className="font-medium text-purple-900">🎨 视觉素材调整</span>
                        </div>
                        {showVisualAssets ? (
                            <ChevronUp className="w-5 h-5 text-purple-600" />
                        ) : (
                            <ChevronDown className="w-5 h-5 text-purple-600" />
                        )}
                    </button>

                    {showVisualAssets && (
                        <div className="space-y-4 bg-purple-50/50 p-4 rounded-lg">
                            {/* 自动关联按钮 */}
                            <div className="bg-blue-50 p-3 rounded border border-blue-200">
                                <p className="text-xs text-blue-900 mb-2">
                                    ✨ 自动根据对话添加出场角色立绘
                                </p>
                                <Button
                                    size="sm"
                                    onClick={autoAddCharacterSprites}
                                    className="w-full gap-2 bg-blue-600 hover:bg-blue-700"
                                >
                                    🪄 自动关联出场角色
                                </Button>
                            </div>
                            
                            {/* 场景背景图 */}
                            <div>
                                <label className="block text-sm font-medium mb-2">🌄 场景背景</label>
                                <div className="space-y-2">
                                    {/* 从场景库选择 */}
                                    <select
                                        className="w-full border rounded px-3 py-2 text-sm"
                                        value={editedNode.visualAssets?.backgroundImageUrl || ''}
                                        onChange={(e) => handleUpdateBackground(e.target.value)}
                                    >
                                        <option value="">从场景库选择背景</option>
                                        {scenes.filter(s => s.imageUrl).map(scene => (
                                            <option key={scene.id} value={scene.imageUrl}>
                                                {scene.name} - {scene.type}
                                            </option>
                                        ))}
                                    </select>
                                    
                                    {/* 或手动输入URL */}
                                    <input
                                        type="text"
                                        className="w-full border rounded px-3 py-2 text-sm"
                                        placeholder="或直接输入背景图URL"
                                        value={editedNode.visualAssets?.backgroundImageUrl || ''}
                                        onChange={(e) => handleUpdateBackground(e.target.value)}
                                    />
                                    
                                    {/* 背景预览 */}
                                    {editedNode.visualAssets?.backgroundImageUrl && (
                                        <div className="mt-2">
                                            <img
                                                src={editedNode.visualAssets.backgroundImageUrl}
                                                alt="背景预览"
                                                className="w-full aspect-video object-cover rounded border-2 border-purple-300"
                                            />
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* 角色立绘 */}
                            <div>
                                <div className="flex items-center justify-between mb-2">
                                    <label className="text-sm font-medium">👥 出场角色立绘</label>
                                    <select
                                        className="border rounded px-2 py-1 text-xs"
                                        onChange={(e) => {
                                            if (e.target.value) {
                                                handleAddCharacterSprite(e.target.value);
                                                e.target.value = '';
                                            }
                                        }}
                                        defaultValue=""
                                    >
                                        <option value="">添加角色</option>
                                        {characters.map(char => (
                                            <option key={char.id} value={char.id}>
                                                {char.displayName}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div className="space-y-2">
                                    {editedNode.visualAssets?.characters?.map((charSprite, index) => {
                                        const character = characters.find(c => c.id === charSprite.characterId);
                                        const isGenerating = generatingCharacterId === charSprite.characterId;
                                        const hasSprite = !!charSprite.spriteUrl;
                                        
                                        return (
                                            <Card key={index} className="p-3">
                                                <div className="flex items-start gap-3">
                                                    {/* 立绘缩略图 */}
                                                    <div className="w-12 h-16 flex-shrink-0">
                                                        {charSprite.spriteUrl ? (
                                                            <img
                                                                src={charSprite.spriteUrl}
                                                                alt={character?.displayName}
                                                                className="w-full h-full object-cover rounded border"
                                                            />
                                                        ) : (
                                                            <div className="w-full h-full bg-gray-100 border-2 border-dashed border-gray-300 rounded flex items-center justify-center text-gray-400 text-xs">
                                                                无
                                                            </div>
                                                        )}
                                                    </div>
                                                    
                                                    <div className="flex-1 space-y-2">
                                                        <div className="flex items-center justify-between">
                                                            <span className="text-sm font-medium">
                                                                {character?.displayName}
                                                            </span>
                                                            <div className="flex items-center gap-1">
                                                                {/* ✅ AI生成立绘按钮 */}
                                                                <button
                                                                    onClick={() => handleGenerateCharacterSprite(charSprite.characterId)}
                                                                    disabled={isGenerating}
                                                                    className="px-2 py-1 text-xs bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded hover:from-purple-600 hover:to-pink-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                                                                    title="AI生成立绘"
                                                                >
                                                                    <Wand2 className="w-3 h-3" />
                                                                    {isGenerating ? '生成中...' : '生成'}
                                                                </button>
                                                                <button
                                                                    onClick={() => handleRemoveCharacterSprite(index)}
                                                                    className="text-red-600 hover:text-red-800 p-1"
                                                                >
                                                                    <Trash2 className="w-4 h-4" />
                                                                </button>
                                                            </div>
                                                        </div>
                                                        
                                                        {/* 位置和缩放调整 */}
                                                        <div className="grid grid-cols-2 gap-2 text-xs">
                                                            <div>
                                                                <label className="text-gray-600">X位置</label>
                                                                <input
                                                                    type="number"
                                                                    min="0"
                                                                    max="100"
                                                                    className="w-full border rounded px-2 py-1"
                                                                    value={charSprite.position?.x || 50}
                                                                    onChange={(e) => {
                                                                        const newChars = [...(editedNode.visualAssets?.characters || [])];
                                                                        newChars[index] = {
                                                                            ...newChars[index],
                                                                            position: {
                                                                                ...newChars[index].position,
                                                                                x: Number(e.target.value),
                                                                                y: newChars[index].position?.y || 50,
                                                                            },
                                                                        };
                                                                        setEditedNode({
                                                                            ...editedNode,
                                                                            visualAssets: {
                                                                                ...editedNode.visualAssets,
                                                                                characters: newChars,
                                                                            },
                                                                        });
                                                                    }}
                                                                />
                                                            </div>
                                                            <div>
                                                                <label className="text-gray-600">Y位置</label>
                                                                <input
                                                                    type="number"
                                                                    min="0"
                                                                    max="100"
                                                                    className="w-full border rounded px-2 py-1"
                                                                    value={charSprite.position?.y || 50}
                                                                    onChange={(e) => {
                                                                        const newChars = [...(editedNode.visualAssets?.characters || [])];
                                                                        newChars[index] = {
                                                                            ...newChars[index],
                                                                            position: {
                                                                                x: newChars[index].position?.x || 50,
                                                                                y: Number(e.target.value),
                                                                            },
                                                                        };
                                                                        setEditedNode({
                                                                            ...editedNode,
                                                                            visualAssets: {
                                                                                ...editedNode.visualAssets,
                                                                                characters: newChars,
                                                                            },
                                                                        });
                                                                    }}
                                                                />
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </Card>
                                        );
                                    })}
                                    
                                    {(!editedNode.visualAssets?.characters || editedNode.visualAssets.characters.length === 0) && (
                                        <div className="text-center py-4 text-gray-500 text-xs">
                                            点击上方下拉框添加角色立绘
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* ✅ 音频素材配置区 */}
                <div className="space-y-3 border-t pt-4">
                    <button
                        onClick={() => setShowAudioAssets(!showAudioAssets)}
                        className="w-full flex items-center justify-between p-3 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-200 hover:border-blue-300 transition-colors"
                    >
                        <div className="flex items-center gap-2">
                            <Music className="w-5 h-5 text-blue-600" />
                            <span className="font-medium text-blue-900">🎵 音频配乐</span>
                        </div>
                        {showAudioAssets ? (
                            <ChevronUp className="w-5 h-5 text-blue-600" />
                        ) : (
                            <ChevronDown className="w-5 h-5 text-blue-600" />
                        )}
                    </button>

                    {showAudioAssets && (
                        <div className="space-y-4 bg-blue-50/50 p-4 rounded-lg">
                            {/* 背景音乐 */}
                            <div>
                                <label className="block text-sm font-medium mb-2">🎼 背景音乐 (BGM)</label>
                                <div className="space-y-2">
                                    {/* 音乐URL输入 */}
                                    <input
                                        type="text"
                                        className="w-full border rounded px-3 py-2 text-sm"
                                        placeholder="输入音乐URL (支持 mp3, ogg, wav)"
                                        value={editedNode.audioAssets?.bgmUrl || ''}
                                        onChange={(e) => {
                                            setEditedNode({
                                                ...editedNode,
                                                audioAssets: {
                                                    ...editedNode.audioAssets,
                                                    bgmUrl: e.target.value,
                                                    bgmLoop: editedNode.audioAssets?.bgmLoop ?? true,
                                                    bgmVolume: editedNode.audioAssets?.bgmVolume ?? 0.5,
                                                },
                                            });
                                        }}
                                    />
                                    
                                    {/* 快捷选择 - 免费音乐库 */}
                                    <select
                                        className="w-full border rounded px-3 py-2 text-sm bg-white"
                                        value={editedNode.audioAssets?.bgmUrl || ''}
                                        onChange={(e) => {
                                            if (e.target.value) {
                                                setEditedNode({
                                                    ...editedNode,
                                                    audioAssets: {
                                                        ...editedNode.audioAssets,
                                                        bgmUrl: e.target.value,
                                                        bgmLoop: editedNode.audioAssets?.bgmLoop ?? true,
                                                        bgmVolume: editedNode.audioAssets?.bgmVolume ?? 0.5,
                                                    },
                                                });
                                            }
                                        }}
                                    >
                                        <option value="">从预设音乐库选择 (30秒纯音乐)</option>
                                        <optgroup label="情感/温馨">
                                            <option value="https://cdn.pixabay.com/audio/2022/05/27/audio_1808fbf07a.mp3">浪漫钢琴 (29s)</option>
                                            <option value="https://cdn.pixabay.com/audio/2021/08/09/audio_12b0c7443c.mp3">温馨回忆 (30s)</option>
                                        </optgroup>
                                        <optgroup label="悬疑/紧张">
                                            <option value="https://cdn.pixabay.com/audio/2022/03/15/audio_a2c792e3ff.mp3">神秘氛围 (32s)</option>
                                            <option value="https://cdn.pixabay.com/audio/2022/11/22/audio_0c2c26542e.mp3">紧张时刻 (28s)</option>
                                        </optgroup>
                                        <optgroup label="欢快/轻松">
                                            <option value="https://cdn.pixabay.com/audio/2022/03/23/audio_c8a9027dc1.mp3">欢快节奏 (31s)</option>
                                            <option value="https://cdn.pixabay.com/audio/2021/11/23/audio_ce0ca8693f.mp3">轻松愉快 (30s)</option>
                                        </optgroup>
                                        <optgroup label="史诗/壮阔">
                                            <option value="https://cdn.pixabay.com/audio/2022/09/14/audio_730c175ac3.mp3">史诗配乐 (33s)</option>
                                            <option value="https://cdn.pixabay.com/audio/2023/02/28/audio_4135c14c6f.mp3">冒险旅程 (29s)</option>
                                        </optgroup>
                                        <optgroup label="日常/平静">
                                            <option value="https://cdn.pixabay.com/audio/2022/08/02/audio_884fe25f21.mp3">宁静时光 (30s)</option>
                                            <option value="https://cdn.pixabay.com/audio/2023/06/12/audio_9a3b8f2d53.mp3">午后茶点 (31s)</option>
                                        </optgroup>
                                    </select>
                                    
                                    {/* 音量控制 */}
                                    <div className="flex items-center gap-3">
                                        <label className="text-sm text-gray-600 w-16">🔊 音量</label>
                                        <input
                                            type="range"
                                            min="0"
                                            max="100"
                                            className="flex-1"
                                            value={(editedNode.audioAssets?.bgmVolume ?? 0.5) * 100}
                                            onChange={(e) => {
                                                setEditedNode({
                                                    ...editedNode,
                                                    audioAssets: {
                                                        ...editedNode.audioAssets,
                                                        bgmUrl: editedNode.audioAssets?.bgmUrl,
                                                        bgmVolume: Number(e.target.value) / 100,
                                                        bgmLoop: editedNode.audioAssets?.bgmLoop ?? true,
                                                    },
                                                });
                                            }}
                                        />
                                        <span className="text-sm text-gray-600 w-12">
                                            {Math.round((editedNode.audioAssets?.bgmVolume ?? 0.5) * 100)}%
                                        </span>
                                    </div>
                                    
                                    {/* 循环播放 */}
                                    <label className="flex items-center gap-2 text-sm">
                                        <input
                                            type="checkbox"
                                            checked={editedNode.audioAssets?.bgmLoop ?? true}
                                            onChange={(e) => {
                                                setEditedNode({
                                                    ...editedNode,
                                                    audioAssets: {
                                                        ...editedNode.audioAssets,
                                                        bgmUrl: editedNode.audioAssets?.bgmUrl,
                                                        bgmVolume: editedNode.audioAssets?.bgmVolume ?? 0.5,
                                                        bgmLoop: e.target.checked,
                                                    },
                                                });
                                            }}
                                            className="rounded"
                                        />
                                        <span className="text-gray-700">循环播放</span>
                                    </label>
                                    
                                    {/* 音乐预览 */}
                                    {editedNode.audioAssets?.bgmUrl && (
                                        <div className="mt-2 p-3 bg-white rounded border">
                                            <audio
                                                controls
                                                className="w-full"
                                                src={editedNode.audioAssets.bgmUrl}
                                            />
                                        </div>
                                    )}
                                    
                                    {/* 提示 */}
                                    <p className="text-xs text-gray-500 mt-2">
                                        💡 提示：当玩家进入此节点时，将自动播放此背景音乐（30秒左右纯音乐）
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* 保存按钮 */}
                <div className="sticky bottom-0 bg-white pt-4 border-t">
                    <Button onClick={handleSave} className="w-full gap-2">
                        <Save className="w-4 h-4" />
                        保存修改
                    </Button>
                </div>
            </div>
        </div>
    );
}
