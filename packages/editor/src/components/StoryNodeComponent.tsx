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
    const { storyNode } = data;
    
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
                        <span className="text-xs px-2 py-0.5 bg-green-600 text-white rounded-full">开始</span>
                    )}
                    {storyNode.isEnding && (
                        <span className="text-xs px-2 py-0.5 bg-red-600 text-white rounded-full">结尾</span>
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
            </div>
            
            <Handle type="source" position={Position.Bottom} className="w-3 h-3" />
        </div>
    );
});

StoryNodeComponent.displayName = 'StoryNodeComponent';

