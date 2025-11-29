import { useCallback } from 'react';
import ReactFlow, {
    Background,
    Controls,
    MiniMap,
    NodeTypes,
} from 'reactflow';
import 'reactflow/dist/style.css';

import { useEditorStore } from '../store/editorStore';
import { DialogueNode } from './nodes/DialogueNode';
import { ChoiceNode } from './nodes/ChoiceNode';

const nodeTypes: NodeTypes = {
    dialogue: DialogueNode,
    choice: ChoiceNode,
};

export function ScriptCanvas() {
    const {
        nodes,
        edges,
        onNodesChange,
        onEdgesChange,
        selectNode,
    } = useEditorStore();

    const onNodeClick = useCallback((_: any, node: any) => {
        selectNode(node.id);
    }, [selectNode]);

    const onPaneClick = useCallback(() => {
        selectNode(null);
    }, [selectNode]);

    return (
        <div className="w-full h-full bg-slate-50">
            <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onNodeClick={onNodeClick}
                onPaneClick={onPaneClick}
                nodeTypes={nodeTypes}
                fitView
            >
                <Background />
                <Controls />
                <MiniMap />
            </ReactFlow>
        </div>
    );
}
