'use client';

import { useState } from 'react';
import { X, Save, Plus, Trash2, ArrowUp, ArrowDown, ChevronDown, ChevronUp, Music, GitBranch } from 'lucide-react';
import type { StoryNode, Character, Dialogue, Scene, Choice } from '@vng/core';
import { createId } from '@vng/core';
import { Button, Card } from '@vng/ui';

interface NodeEditPanelProps {
    node: StoryNode;
    characters: Character[];
    scenes?: Scene[];
    onSave: (node: StoryNode) => void;
    onClose: () => void;
    onGenerateImage?: (characterId: string, prompt: string, refImageUrl?: string) => Promise<string>;
    onDelete?: (nodeId: string) => void;
    onAddNodeAfter?: (nodeId: string) => void;
    onCreateNodeFromChoice?: (type: 'scene' | 'branch' | 'ending') => Promise<string>;
    allNodes?: StoryNode[];
    i18n?: Record<string, string>;
}

export function NodeEditPanel({ node, characters, scenes = [], onSave, onClose, onGenerateImage, allNodes, onCreateNodeFromChoice, i18n = {} }: NodeEditPanelProps) {
    const [editedNode, setEditedNode] = useState<StoryNode>({
        ...node,
        dialogues: node.dialogues || [],
        choices: node.choices || [],
        visualAssets: node.visualAssets ? { ...node.visualAssets } : undefined,
    });
    const [selectedDialogues, setSelectedDialogues] = useState<Set<number>>(new Set());
    const [showAudioAssets, setShowAudioAssets] = useState(false);
    const [showChoices, setShowChoices] = useState(false);
    
    const currentScene = scenes.find(s => s.name === editedNode.sceneName);
    
    const handleSceneChange = (sceneName: string) => {
        const selectedScene = scenes.find(s => s.name === sceneName);
        setEditedNode({
            ...editedNode,
            sceneName,
            visualAssets: {
                ...editedNode.visualAssets,
                backgroundImageUrl: selectedScene?.imageUrl || editedNode.visualAssets?.backgroundImageUrl,
            },
        });
    };
    

    


    const handleSave = () => {
        onSave(editedNode);
    };

    const handleAddDialogue = () => {
        const newDialogue: Dialogue = {
            id: createId(),
            characterId: characters[0]?.id || '',
            text: '',
        };
        setEditedNode({
            ...editedNode,
            dialogues: [...editedNode.dialogues, newDialogue],
        });
    };

    const handleUpdateDialogue = (index: number, field: keyof Dialogue, value: string) => {
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



    // 分支选项管理
    const handleAddChoice = () => {
        const newChoice: Choice = {
            id: createId(),
            text: '',
            targetNodeId: '',
        };
        setEditedNode({
            ...editedNode,
            choices: [...(editedNode.choices || []), newChoice],
        });
    };

    const handleUpdateChoice = async (index: number, field: keyof Choice, value: string) => {
        const newChoices = [...(editedNode.choices || [])];
        
        // 如果选择"创建新节点",调用回调函数创建节点
        if (field === 'targetNodeId' && value.startsWith('__CREATE_')) {
            const nodeType = value.replace('__CREATE_', '') as 'scene' | 'branch' | 'ending';
            if (onCreateNodeFromChoice) {
                const newNodeId = await onCreateNodeFromChoice(nodeType);
                newChoices[index] = { ...newChoices[index], targetNodeId: newNodeId };
            }
        } else {
            newChoices[index] = { ...newChoices[index], [field]: value };
        }
        
        setEditedNode({
            ...editedNode,
            choices: newChoices,
        });
    };

    const handleDeleteChoice = (index: number) => {
        const newChoices = [...(editedNode.choices || [])];
        newChoices.splice(index, 1);
        setEditedNode({
            ...editedNode,
            choices: newChoices,
        });
    };

    const handleMoveChoice = (index: number, direction: 'up' | 'down') => {
        const newChoices = [...(editedNode.choices || [])];
        const targetIndex = direction === 'up' ? index - 1 : index + 1;
        [newChoices[index], newChoices[targetIndex]] = [newChoices[targetIndex], newChoices[index]];
        setEditedNode({
            ...editedNode,
            choices: newChoices,
        });
    };



    return (
        <div className="absolute top-0 right-0 h-full w-96 bg-white shadow-2xl border-l z-10 overflow-y-auto">
            <div className="sticky top-0 bg-white border-b p-4 flex items-center justify-between z-20">
                <h3 className="font-semibold text-lg">{i18n.title || '编辑情节节点'}</h3>
                <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
                    <X className="w-5 h-5" />
                </button>
            </div>

            <div className="p-4 space-y-6">
                {/* 情节基本信息 */}
                <div className="space-y-4">
                    <h4 className="font-medium text-gray-900 border-b pb-2">{i18n.storyInfo || '🎬 情节信息'}</h4>
                    
                    <div>
                        <label className="block text-sm font-medium mb-1">
                            {i18n.nodeTitle || '情节标题'} <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="text"
                            className="w-full border rounded px-3 py-2"
                            value={editedNode.title}
                            onChange={(e) => setEditedNode({ ...editedNode, title: e.target.value })}
                            placeholder="例:初次相遇、危机爆发..."
                        />
                    </div>
                    
                    <div>
                        <label className="block text-sm font-medium mb-1">{i18n.scene || '🏞️ 所在场景'}</label>
                        <select
                            className="w-full border rounded px-3 py-2 bg-white"
                            value={editedNode.sceneName || ''}
                            onChange={(e) => handleSceneChange(e.target.value)}
                        >
                            <option value="">{i18n.noScene || '未指定场景'}</option>
                            {scenes.map(scene => (
                                <option key={scene.id} value={scene.name}>
                                    {scene.name} - {scene.type}
                                    {scene.imageUrl ? (i18n.hasBackground || ' ✓ 有背景图') : ''}
                                </option>
                            ))}
                        </select>
                        
                        {currentScene?.imageUrl && (
                            <div className="mt-3 border-2 border-teal-300 rounded-lg overflow-hidden">
                                <img
                                    src={currentScene.imageUrl}
                                    alt={currentScene.name}
                                    className="w-full aspect-video object-cover"
                                />
                                <div className="bg-teal-50 px-2 py-1 text-xs text-teal-800">
                                    {i18n.backgroundLinked || '✓ 场景背景图已关联'}
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* 旁白区 */}
                <div className="space-y-2">
                    <h4 className="font-medium text-gray-900 border-b pb-2">{i18n.narration || '旁白/背景交代'}</h4>
                    <textarea
                        className="w-full border rounded px-3 py-2 min-h-[80px] italic text-center"
                        value={editedNode.narration || ''}
                        onChange={(e) => setEditedNode({ ...editedNode, narration: e.target.value })}
                        placeholder={i18n.narrationPlaceholder || '例：夜幕降临，雨声止息，旧巷深处传来脚步声...'}
                    />
                </div>

                {/* 角色对话区 */}
                <div className="space-y-3">
                    <div className="flex items-center justify-between border-b pb-2">
                        <h4 className="font-medium text-gray-900">{i18n.dialogues || '角色对话'}</h4>
                        <Button size="sm" onClick={handleAddDialogue} className="gap-1">
                            <Plus className="w-4 h-4" />
                            {i18n.addDialogue || '添加对话'}
                        </Button>
                    </div>
                    
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
                                            <input
                                                type="checkbox"
                                                checked={isSelected}
                                                onChange={() => toggleDialogueSelection(index)}
                                                className="w-4 h-4"
                                            />
                                            
                                            <div className="flex-1 flex items-center gap-2">
                                                {character ? (
                                                    <div className="flex items-center gap-2 flex-1">
                                                        {character.avatarUrl ? (
                                                            <img
                                                                src={character.avatarUrl}
                                                                alt={character.displayName}
                                                                className="w-8 h-8 rounded-full object-cover border-2"
                                                            />
                                                        ) : (
                                                            <div className="w-8 h-8 rounded-full flex items-center justify-center bg-gray-400 text-white font-bold text-xs">
                                                                {character.displayName.charAt(0)}
                                                            </div>
                                                        )}
                                                        <span className="font-medium text-sm">{character.displayName}</span>
                                                    </div>
                                                ) : (
                                                    <span className="text-gray-400 text-sm">未选择角色</span>
                                                )}
                                                
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
                                            
                                            <div className="flex flex-col gap-1">
                                                <button
                                                    onClick={() => handleMoveDialogue(index, 'up')}
                                                    disabled={index === 0}
                                                    className="p-0.5 hover:bg-gray-100 rounded disabled:opacity-30"
                                                >
                                                    <ArrowUp className="w-3 h-3" />
                                                </button>
                                                <button
                                                    onClick={() => handleMoveDialogue(index, 'down')}
                                                    disabled={index === editedNode.dialogues.length - 1}
                                                    className="p-0.5 hover:bg-gray-100 rounded disabled:opacity-30"
                                                >
                                                    <ArrowDown className="w-3 h-3" />
                                                </button>
                                            </div>
                                            <button
                                                onClick={() => handleDeleteDialogue(index)}
                                                className="p-1 hover:bg-red-50 rounded text-red-600"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                        <textarea
                                            className="w-full border rounded px-2 py-1 text-sm min-h-[60px]"
                                            value={dialogue.text}
                                            onChange={(e) => handleUpdateDialogue(index, 'text', e.target.value)}
                                            placeholder="输入对话内容..."
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

                {/* 音频配乐区 */}
                <div className="space-y-3 border-t pt-4">
                    <button
                        onClick={() => setShowAudioAssets(!showAudioAssets)}
                        className="w-full flex items-center justify-between p-3 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-200"
                    >
                        <div className="flex items-center gap-2">
                            <Music className="w-5 h-5 text-blue-600" />
                            <span className="font-medium text-blue-900">{i18n.audioAssets || '🎵 音频配乐'}</span>
                        </div>
                        {showAudioAssets ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                    </button>

                    {showAudioAssets && (
                        <div className="space-y-4 bg-blue-50/50 p-4 rounded-lg">
                            <div>
                                <label className="block text-sm font-medium mb-2">{i18n.bgm || '🎼 背景音乐 (BGM)'}</label>
                                <input
                                    type="text"
                                    className="w-full border rounded px-3 py-2 text-sm"
                                    placeholder={i18n.bgmPlaceholder || '输入音乐URL (支持 mp3, ogg, wav)'}
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
                                
                                <select
                                    className="w-full border rounded px-3 py-2 text-sm bg-white mt-2"
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
                                    <option value="">{i18n.selectFromLibrary || '从预设音乐库选择'}</option>
                                    <optgroup label={i18n.emotionalWarm || '情感/温馨'}>
                                        <option value="https://cdn.pixabay.com/audio/2022/05/27/audio_1808fbf07a.mp3">{i18n.romanticPiano || '浪漫钢琴'}</option>
                                    </optgroup>
                                    <optgroup label={i18n.suspenseTense || '悬疑/紧张'}>
                                        <option value="https://cdn.pixabay.com/audio/2022/03/15/audio_a2c792e3ff.mp3">{i18n.mysteriousAtmosphere || '神秘氛围'}</option>
                                    </optgroup>
                                </select>
                                
                                <div className="flex items-center gap-3 mt-2">
                                    <label className="text-sm text-gray-600 w-16">{i18n.volume || '🔊 音量'}</label>
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
                                
                                <label className="flex items-center gap-2 text-sm mt-2">
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
                                    <span className="text-gray-700">{i18n.loop || '循环播放'}</span>
                                </label>
                                
                                {editedNode.audioAssets?.bgmUrl && (
                                    <audio
                                        controls
                                        className="w-full mt-2"
                                        src={editedNode.audioAssets.bgmUrl}
                                    />
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {/* 分支选项区 */}
                {(editedNode.type === 'branch' || editedNode.choices && editedNode.choices.length > 0) && (
                    <div className="space-y-3 border-t pt-4">
                        <button
                            onClick={() => setShowChoices(!showChoices)}
                            className="w-full flex items-center justify-between p-3 bg-gradient-to-r from-amber-50 to-orange-50 rounded-lg border border-amber-200"
                        >
                            <div className="flex items-center gap-2">
                                <GitBranch className="w-5 h-5 text-amber-600" />
                                <span className="font-medium text-amber-900">{i18n.choices || '🔀 选项与分支'}</span>
                                {editedNode.choices && editedNode.choices.length > 0 && (
                                    <span className="text-xs px-2 py-0.5 bg-amber-200 text-amber-800 rounded-full">
                                        {(i18n.choicesCount || '{count} 个选项').replace('{count}', String(editedNode.choices.length))}
                                    </span>
                                )}
                            </div>
                            {showChoices ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                        </button>

                        {showChoices && (
                            <div className="space-y-4 bg-amber-50/50 p-4 rounded-lg">
                                <div className="flex items-center justify-between mb-3">
                                    <p className="text-sm text-gray-600">
                                        {i18n.choicesDesc || '为该节点添加分支选项，每个选项可以跳转到不同的后续节点'}
                                    </p>
                                    <Button size="sm" onClick={handleAddChoice} className="gap-1 bg-amber-600 hover:bg-amber-700">
                                        <Plus className="w-4 h-4" />
                                        {i18n.addChoice || '添加选项'}
                                    </Button>
                                </div>

                                {editedNode.choices && editedNode.choices.length === 0 && (
                                    <div className="text-center py-8 text-gray-500 text-sm">
                                        {i18n.noChoices || '还没有分支选项，点击上方按钮添加'}
                                    </div>
                                )}

                                <div className="space-y-3">
                                    {editedNode.choices?.map((choice, index) => {
                                        const targetNode = allNodes?.find(n => n.id === choice.targetNodeId);
                                        
                                        return (
                                            <Card key={choice.id} className="p-3 bg-white">
                                                <div className="space-y-3">
                                                    {/* 选项标题栏 */}
                                                    <div className="flex items-center justify-between">
                                                        <div className="flex items-center gap-2">
                                                            <span className="px-2 py-1 bg-amber-100 text-amber-800 rounded text-xs font-medium">
                                                                {i18n.choice || '选项'} {index + 1}
                                                            </span>
                                                        </div>
                                                        <div className="flex items-center gap-1">
                                                            <button
                                                                onClick={() => handleMoveChoice(index, 'up')}
                                                                disabled={index === 0}
                                                                className="p-1 hover:bg-gray-100 rounded disabled:opacity-30"
                                                                title={i18n.moveUp || '上移'}
                                                            >
                                                                <ArrowUp className="w-3 h-3" />
                                                            </button>
                                                            <button
                                                                onClick={() => handleMoveChoice(index, 'down')}
                                                                disabled={index === (editedNode.choices?.length || 0) - 1}
                                                                className="p-1 hover:bg-gray-100 rounded disabled:opacity-30"
                                                                title={i18n.moveDown || '下移'}
                                                            >
                                                                <ArrowDown className="w-3 h-3" />
                                                            </button>
                                                            <button
                                                                onClick={() => handleDeleteChoice(index)}
                                                                className="p-1 hover:bg-red-50 rounded text-red-600"
                                                                title={i18n.delete || '删除'}
                                                            >
                                                                <Trash2 className="w-4 h-4" />
                                                            </button>
                                                        </div>
                                                    </div>

                                                    {/* 选项文本 */}
                                                    <div>
                                                        <label className="block text-sm font-medium mb-1">
                                                            {i18n.choiceText || '选项文本'} <span className="text-red-500">*</span>
                                                        </label>
                                                        <input
                                                            type="text"
                                                            className="w-full border rounded px-3 py-2 text-sm"
                                                            placeholder={i18n.choiceTextPlaceholder || '例：跟随她、报警、转身离开'}
                                                            value={choice.text}
                                                            onChange={(e) => handleUpdateChoice(index, 'text', e.target.value)}
                                                        />
                                                    </div>

                                                    {/* 目标节点 */}
                                                    <div>
                                                        <label className="block text-sm font-medium mb-1">
                                                            {i18n.targetNode || '跳转到节点'} <span className="text-red-500">*</span>
                                                        </label>
                                                        <select
                                                            className="w-full border rounded px-3 py-2 text-sm bg-white"
                                                            value={choice.targetNodeId}
                                                            onChange={(e) => handleUpdateChoice(index, 'targetNodeId', e.target.value)}
                                                        >
                                                            <option value="">{i18n.selectTargetNode || '选择目标节点'}</option>
                                                            
                                                            {/* 创建新节点选项 */}
                                                            <optgroup label={i18n.createNewNode || '➕ 创建新节点'}>
                                                                <option value="__CREATE_scene">{i18n.createSceneNode || '🆕 创建普通节点'}</option>
                                                                <option value="__CREATE_branch">{i18n.createBranchNode || '🔀 创建分支节点'}</option>
                                                                <option value="__CREATE_ending">{i18n.createEndingNode || '🏁 创建结局节点'}</option>
                                                            </optgroup>
                                                            
                                                            {/* 现有节点 */}
                                                            {allNodes && allNodes.length > 1 && (
                                                                <optgroup label={i18n.existingNodes || '📋 选择现有节点'}>
                                                                    {allNodes.filter(n => n.id !== editedNode.id).map(n => (
                                                                        <option key={n.id} value={n.id}>
                                                                            {n.title} ({n.type === 'scene' ? (i18n.sceneType || '场景') : n.type === 'branch' ? (i18n.branchType || '分支') : (i18n.endingType || '结局')})
                                                                        </option>
                                                                    ))}
                                                                </optgroup>
                                                            )}
                                                        </select>
                                                        {targetNode && (
                                                            <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded text-xs">
                                                                <div className="flex items-center gap-2">
                                                                    <span className="text-blue-600">✓</span>
                                                                    <span className="text-blue-900">
                                                                        {i18n.willJumpTo || '将跳转到:'} <strong>{targetNode.title}</strong>
                                                                    </span>
                                                                </div>
                                                                {targetNode.sceneName && (
                                                                    <div className="text-blue-700 ml-5 mt-1">
                                                                        {i18n.sceneLabel || '场景:'} {targetNode.sceneName}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>

                                                    {/* 触发条件 (高级) */}
                                                    <div>
                                                        <label className="block text-sm font-medium mb-1">
                                                            {i18n.condition || '触发条件'} <span className="text-gray-400 text-xs">{i18n.conditionOptional || '(选填)'}</span>
                                                        </label>
                                                        <input
                                                            type="text"
                                                            className="w-full border rounded px-3 py-2 text-sm"
                                                            placeholder={i18n.conditionPlaceholder || '例：拥有道具:钥匙、好感度>50'}
                                                            value={choice.condition || ''}
                                                            onChange={(e) => handleUpdateChoice(index, 'condition', e.target.value)}
                                                        />
                                                        <p className="text-xs text-gray-500 mt-1">
                                                            {i18n.conditionDesc || '设置该选项的显示条件，例如要求特定道具或属性值'}
                                                        </p>
                                                    </div>
                                                </div>
                                            </Card>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* 保存按钮 */}
                <div className="sticky bottom-0 bg-white pt-4 border-t">
                    <Button onClick={handleSave} className="w-full gap-2">
                        <Save className="w-4 h-4" />
                        {i18n.save || '保存修改'}
                    </Button>
                </div>
            </div>
        </div>
    );
}

