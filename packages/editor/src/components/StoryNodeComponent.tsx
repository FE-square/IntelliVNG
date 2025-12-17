'use client';

import { memo } from 'react';
import { Handle, Position } from 'reactflow';
import type { StoryNode, Character } from '@vng/core';
import { FileText, GitBranch, Flag } from 'lucide-react';

interface StoryNodeData {
    storyNode: StoryNode;
    characters: Character[];
    i18n?: {
        start?: string;
        ending?: string;
        dialogues?: string;
        branches?: string;
        appearingCharacters?: string;
    };
}

export const StoryNodeComponent = memo(({ data }: { data: StoryNodeData }) => {
    const { storyNode, characters, i18n } = data;
    
    // 多语言文本，带 fallback
    const t = {
        start: i18n?.start || '开始',
        ending: i18n?.ending || '结尾',
        dialogues: i18n?.dialogues || '段对话',
        branches: i18n?.branches || '个分支',
        appearingCharacters: i18n?.appearingCharacters || '出场人物:',
    };
    
    // ✅ 获取出场角色列表（去重）
    const appearingCharacters = Array.from(
        new Set(
            storyNode.dialogues
                .map(d => d.characterId)
                .filter(id => id && id !== 'narrator') // 过滤旁白
        )
    ).map(characterId => 
        characters.find(c => c.id === characterId)
    ).filter(Boolean) as Character[];
    
    // 获取节点颜色
    const getNodeColor = () => {
        if (storyNode.isStart) {
            return 'bg-green-50 border-green-500 shadow-green-200';
        }
        if (storyNode.isEnding) {
            return 'bg-red-50 border-red-500 shadow-red-200';
        }
        switch (storyNode.type) {
            case 'scene':
                return 'bg-blue-100 border-blue-400';
            case 'branch':
                return 'bg-amber-100 border-amber-400';
            case 'ending':
                return 'bg-red-100 border-red-400';
            default:
                return 'bg-gray-100 border-gray-400';
        }
    };

    // 获取节点图标
    const getNodeIcon = () => {
        switch (storyNode.type) {
            case 'scene':
                return <FileText className="w-4 h-4" />;
            case 'branch':
                return <GitBranch className="w-4 h-4" />;
            case 'ending':
                return <Flag className="w-4 h-4" />;
        }
    };

    return (
        <div className={`rounded-lg border-2 shadow-md min-w-[240px] max-w-[320px] overflow-hidden ${getNodeColor()}`}>
            <Handle type="target" position={Position.Top} className="w-3 h-3" />
            
            {/* 节点头部 */}
            <div className="px-4 py-3">
                <div className="flex items-center gap-2 mb-2">
                    {getNodeIcon()}
                    <div className="flex-1">
                        <div className="font-semibold text-sm truncate">{storyNode.title}</div>
                        {storyNode.sceneName && (
                            <div className="text-xs text-gray-500 truncate">🏞️ {storyNode.sceneName}</div>
                        )}
                    </div>
                    {storyNode.isStart && (
                        <span className="text-xs px-2 py-0.5 bg-green-600 text-white rounded-full">{t.start}</span>
                    )}
                    {storyNode.isEnding && (
                        <span className="text-xs px-2 py-0.5 bg-red-600 text-white rounded-full">{t.ending}</span>
                    )}
                </div>
                
                {/* 节点内容预览 */}
                <div className="text-xs text-gray-600 space-y-1">
                {storyNode.narration && (
                    <div className="italic line-clamp-2">{storyNode.narration}</div>
                )}
                {storyNode.dialogues.length > 0 && (
                    <div className="flex items-center gap-1">
                        <span className="font-medium">{storyNode.dialogues.length}</span>
                        <span>{t.dialogues}</span>
                    </div>
                )}
                {storyNode.choices && storyNode.choices.length > 0 && (
                    <div className="flex items-center gap-1 text-amber-700">
                        <span className="font-medium">{storyNode.choices.length}</span>
                        <span>{t.branches}</span>
                    </div>
                )}
                </div>
                
                {/* ✅ 出场人物头像 */}
                {appearingCharacters.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-gray-200">
                        <div className="text-xs text-gray-500 mb-2">{t.appearingCharacters}</div>
                        <div className="flex flex-wrap gap-2">
                            {appearingCharacters.map((char) => (
                                <div key={char.id} className="group relative">
                                    {char.avatarUrl ? (
                                        <img
                                            src={char.avatarUrl}
                                            alt={char.displayName}
                                            className="w-8 h-8 rounded-full object-cover border-2 border-white shadow-sm hover:scale-110 transition-transform"
                                            title={char.displayName}
                                        />
                                    ) : (
                                        <div 
                                            className="w-8 h-8 rounded-full flex items-center justify-center bg-gradient-to-br from-indigo-400 to-purple-400 text-white font-bold text-xs border-2 border-white shadow-sm hover:scale-110 transition-transform"
                                            title={char.displayName}
                                        >
                                            {char.displayName.charAt(0)}
                                        </div>
                                    )}
                                    {/* ✅ 悬停显示角色名 */}
                                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 bg-gray-800 text-white text-xs rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                                        {char.displayName}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
            
            <Handle type="source" position={Position.Bottom} className="w-3 h-3" />
        </div>
    );
});

StoryNodeComponent.displayName = 'StoryNodeComponent';

