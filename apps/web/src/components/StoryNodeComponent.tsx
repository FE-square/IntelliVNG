'use client';

import { memo } from 'react';
import { Handle, Position } from 'reactflow';
import type { StoryNode, Character } from '@vng/core';
import { FileText, GitBranch, Flag } from 'lucide-react';

interface StoryNodeData {
    storyNode: StoryNode;
    characters: Character[];
}

export const StoryNodeComponent = memo(({ data }: { data: StoryNodeData }) => {
    const { storyNode, characters } = data;
    
    // 获取节点颜色
    const getNodeColor = () => {
        // 开头节点 - 绿色框
        if (storyNode.isStart) {
            return 'bg-green-50 border-green-500 shadow-green-200';
        }
        // 结尾节点 - 红色框
        if (storyNode.isEnding) {
            return 'bg-red-50 border-red-500 shadow-red-200';
        }
        // 普通节点样式
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
        <div className={`px-4 py-3 rounded-lg border-2 shadow-md min-w-[200px] max-w-[300px] ${getNodeColor()}`}>
            {/* 输入句柄 */}
            <Handle type="target" position={Position.Top} className="w-3 h-3" />
            
            {/* 节点头部 */}
            <div className="flex items-center gap-2 mb-2">
                {getNodeIcon()}
                <div className="flex-1">
                    <div className="font-semibold text-sm truncate">{storyNode.title}</div>
                    {/* 场景名称优先展示 */}
                    {storyNode.sceneName && (
                        <div className="text-xs text-gray-500 truncate">🏞️ {storyNode.sceneName}</div>
                    )}
                </div>
                {/* 节点类型标签 */}
                {storyNode.isStart && (
                    <span className="text-xs px-2 py-0.5 bg-green-600 text-white rounded-full">开始</span>
                )}
                {storyNode.isEnding && (
                    <span className="text-xs px-2 py-0.5 bg-red-600 text-white rounded-full">结尾</span>
                )}
            </div>
            
            {/* 节点内容预览 */}
            <div className="text-xs text-gray-600 space-y-1">
                {/* 视觉素材缩略图 */}
                {storyNode.visualAssets && (
                    <div className="mb-2">
                        {/* 背景图缩略图 */}
                        {storyNode.visualAssets.backgroundImageUrl && (
                            <div className="mb-1">
                                <img
                                    src={storyNode.visualAssets.backgroundImageUrl}
                                    alt="背景"
                                    className="w-full h-16 object-cover rounded border border-gray-300"
                                />
                            </div>
                        )}
                        {/* 角色立绘缩略图 */}
                        {storyNode.visualAssets.characters && storyNode.visualAssets.characters.length > 0 && (
                            <div className="flex gap-1">
                                {storyNode.visualAssets.characters.slice(0, 3).map((char, idx) => (
                                    <div key={idx} className="w-8 h-10 flex-shrink-0">
                                        {char.spriteUrl && (
                                            <img
                                                src={char.spriteUrl}
                                                alt="立绘"
                                                className="w-full h-full object-cover rounded border border-gray-300"
                                            />
                                        )}
                                    </div>
                                ))}
                                {storyNode.visualAssets.characters.length > 3 && (
                                    <div className="w-8 h-10 flex items-center justify-center bg-gray-200 rounded text-xs">
                                        +{storyNode.visualAssets.characters.length - 3}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}
                
                {storyNode.narration && (
                    <div className="italic line-clamp-2">{storyNode.narration}</div>
                )}
                {storyNode.dialogues.length > 0 && (
                    <div className="flex items-center gap-1">
                        <span className="font-medium">{storyNode.dialogues.length}</span>
                        <span>段对话</span>
                    </div>
                )}
                {storyNode.choices && storyNode.choices.length > 0 && (
                    <div className="flex items-center gap-1 text-amber-700">
                        <span className="font-medium">{storyNode.choices.length}</span>
                        <span>个分支</span>
                    </div>
                )}
            </div>
            
            {/* 输出句柄 */}
            <Handle type="source" position={Position.Bottom} className="w-3 h-3" />
        </div>
    );
});

StoryNodeComponent.displayName = 'StoryNodeComponent';
