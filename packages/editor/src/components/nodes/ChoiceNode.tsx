import { memo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { ChoiceNode as ChoiceNodeType } from '@vng/core';

export const ChoiceNode = memo(({ id, data, selected }: NodeProps<ChoiceNodeType>) => {
    return (
        <div className={`
      px-4 py-3 rounded-lg border-2 min-w-[220px]
      bg-amber-50 shadow-md
      ${selected ? 'border-amber-500 ring-2 ring-amber-200' : 'border-amber-200'}
    `}>
            <Handle
                type="target"
                position={Position.Top}
                className="w-3 h-3 bg-amber-500"
            />

            <div className="mb-2 font-medium text-amber-900">
                Branching Point
            </div>

            {data.prompt && (
                <p className="text-sm text-amber-800 mb-3 italic">
                    "{data.prompt}"
                </p>
            )}

            <div className="space-y-2">
                {data.choices.map((choice, index) => (
                    <div key={choice.id} className="relative">
                        <div className="text-xs bg-white border border-amber-200 rounded px-2 py-1 text-amber-700">
                            {choice.text}
                        </div>
                        <Handle
                            type="source"
                            position={Position.Right}
                            id={`choice-${index}`}
                            className="w-2 h-2 bg-amber-500 !right-[-6px]"
                        />
                    </div>
                ))}
            </div>
        </div>
    );
});

ChoiceNode.displayName = 'ChoiceNode';
