import { memo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { DialogueNode as DialogueNodeType } from '@vng/core';
import { useEditorStore } from '../../store/editorStore';

export const DialogueNode = memo(({ id, data, selected }: NodeProps<DialogueNodeType>) => {
    const project = useEditorStore(state => state.project);
    const character = project?.characters.find(c => c.id === data.characterId);

    return (
        <div className={`
      px-4 py-3 rounded-lg border-2 min-w-[200px] max-w-[300px]
      bg-white shadow-md
      ${selected ? 'border-blue-500 ring-2 ring-blue-200' : 'border-gray-200'}
    `}>
            {/* Input Handle */}
            <Handle
                type="target"
                position={Position.Top}
                className="w-3 h-3 bg-blue-500"
            />

            {/* Node Content */}
            <div className="flex items-center gap-2 mb-2">
                <div
                    className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center text-white text-xs font-bold"
                >
                    {character?.name?.[0] || '?'}
                </div>
                <span className="font-medium text-gray-800">
                    {character?.displayName || 'Unknown Character'}
                </span>
            </div>

            <p className="text-sm text-gray-600 line-clamp-3">
                {data.text || 'Click to edit dialogue...'}
            </p>

            {/* Output Handle */}
            <Handle
                type="source"
                position={Position.Bottom}
                className="w-3 h-3 bg-blue-500"
            />
        </div>
    );
});

DialogueNode.displayName = 'DialogueNode';
