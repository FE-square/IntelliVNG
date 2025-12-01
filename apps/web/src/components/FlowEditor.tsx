'use client';

import { useCallback, useMemo, useState } from 'react';
import ReactFlow, {
    Node,
    Edge,
    Controls,
    Background,
    useNodesState,
    useEdgesState,
    addEdge,
    Connection,
    MarkerType,
    NodeTypes,
    useReactFlow,
    Panel,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { Button } from '@vng/ui';
import { ZoomIn, ZoomOut, Maximize2, AlertCircle } from 'lucide-react';
import type { GameProject, StoryNode } from '@vng/core';
import { convertScriptToStoryNodes, convertStoryNodesToScript } from '@vng/core';
import { StoryNodeComponent } from './StoryNodeComponent';
import { NodeEditPanel } from './NodeEditPanel';

interface FlowEditorProps {
    project: GameProject;
    onUpdate?: (project: GameProject) => void;
    onSelectNode?: (nodeId: string | null) => void;  // ✅ 添加选中节点回调
}

export function FlowEditor({ project, onUpdate, onSelectNode }: FlowEditorProps) {
    const { zoomIn, zoomOut, fitView } = useReactFlow();
    
    // AI 已经直接生成流程图节点格式，不需要转换
    const storyNodes: StoryNode[] = useMemo(() => {
        // 检查 script 中的节点是否已经包含 title 和 dialogues
        const firstNode = project.script?.[0] as any;
        if (firstNode && firstNode.title && firstNode.dialogues) {
            // 已经是新格式，转换为 StoryNode 格式
            return project.script.map((node: any) => {
                // ✅ 转换 choices: ScriptNode 用 nextNodeId, StoryNode 用 targetNodeId
                const convertedChoices = node.choices?.map((choice: any) => ({
                    id: choice.id,
                    text: choice.text,
                    targetNodeId: choice.nextNodeId || choice.targetNodeId,  // ✅ 兼容两种格式
                    condition: choice.condition,
                }));
                
                return {
                    id: node.id,
                    type: (node.type === 'choice' ? 'branch' : node.type === 'ending' ? 'ending' : 'scene') as 'scene' | 'branch' | 'ending',
                    isStart: node.isStart,
                    isEnding: node.isEnding,
                    position: node.position || { x: 0, y: 0 },
                    title: node.title || `节点 ${node.id}`,
                    sceneName: node.sceneName,
                    narration: node.narration,
                    dialogues: node.dialogues || [],
                    choices: convertedChoices,
                    nextNodeId: node.nextNodeId,
                    visualAssets: node.visualAssets,
                };
            });
        }
        // 旧格式，使用转换
        return convertScriptToStoryNodes(project.script || []);
    }, [project.script]);

    // 转换为 React Flow 节点和边
    const initialNodes: Node[] = storyNodes.map(node => ({
        id: node.id,
        type: 'storyNode',
        position: node.position,
        data: { 
            storyNode: node,
            characters: project.characters,
        },
    }));

    const initialEdges: Edge[] = [];
    storyNodes.forEach(node => {
        // 普通节点的单线连接 (包括指向分支节点的连接)
        // ✅ 兼容: 分支节点没有nextNodeId，只有choices
        if (node.nextNodeId) {
            initialEdges.push({
                id: `${node.id}-${node.nextNodeId}`,
                source: node.id,
                target: node.nextNodeId,
                type: 'smoothstep',
                animated: true,
                markerEnd: { type: MarkerType.ArrowClosed },
            });
        }
        
        // 分支节点的多个选项连接
        if (node.choices && node.choices.length > 0) {
            node.choices.forEach((choice, index) => {
                if (choice.targetNodeId) {  // ✅ 确保 targetNodeId存在
                    initialEdges.push({
                        id: `${node.id}-choice-${index}`,
                        source: node.id,
                        target: choice.targetNodeId,  // ✅ StoryNode的Choice使用targetNodeId
                        type: 'smoothstep',
                        label: choice.text,
                        animated: true,
                        markerEnd: { type: MarkerType.ArrowClosed },
                        style: { stroke: '#f59e0b', strokeWidth: 2 },
                        labelBgStyle: { fill: '#fef3c7' },
                        labelStyle: { fill: '#92400e', fontSize: 12, fontWeight: 600 },
                    });
                }
            });
        }
    });
    
    console.log('[FlowEditor] Generated edges:', initialEdges.length);
    console.log('[FlowEditor] Story nodes:', storyNodes.map(n => ({
        id: n.id,
        type: n.type,
        title: n.title,
        sceneName: n.sceneName,
        dialogues: n.dialogues?.length || 0,
        nextNodeId: n.nextNodeId,
        choices: n.choices?.length || 0,
        choicesDetail: n.choices?.map(c => ({ text: c.text, targetNodeId: c.targetNodeId }))  // ✅ 详细choices信息
    })));
    
    // ✅ 检查分支节点的连线
    storyNodes.forEach(node => {
        if (node.type === 'branch' && node.choices) {
            console.log(`[FlowEditor] 分支节点 ${node.id} (${node.title}):`);
            console.log(`  - choices 数量: ${node.choices.length}`);
            node.choices.forEach((choice, idx) => {
                console.log(`  - 选项${idx + 1}: "${choice.text}" -> ${choice.targetNodeId}`);
            });
        }
    });
    
    // 检查第一个节点的对话详情
    if (storyNodes.length > 0 && storyNodes[0].dialogues) {
        console.log('[FlowEditor] 第一个节点的对话:', storyNodes[0].dialogues);
    }

    const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
    const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
    const [selectedNode, setSelectedNode] = useState<StoryNode | null>(null);
    const [showIssues, setShowIssues] = useState(false);

    // 逻辑检查
    const checkIssues = useCallback(() => {
        const issues: string[] = [];
        
        // 检查孤立节点
        const connectedNodes = new Set<string>();
        edges.forEach(edge => {
            connectedNodes.add(edge.source);
            connectedNodes.add(edge.target);
        });
        
        const orphanNodes = nodes.filter(n => !connectedNodes.has(n.id) && !storyNodes.find(sn => sn.id === n.id && sn.isStart));
        if (orphanNodes.length > 0) {
            issues.push(`发现 ${orphanNodes.length} 个孤立节点（无连接）`);
        }
        
        // 检查是否有开始节点
        const startNodes = storyNodes.filter(n => n.isStart);
        if (startNodes.length === 0) {
            issues.push('缺少开始节点');
        } else if (startNodes.length > 1) {
            issues.push(`存在多个开始节点 (${startNodes.length}个)`);
        }
        
        // 检查是否有结尾节点
        const endingNodes = storyNodes.filter(n => n.isEnding);
        if (endingNodes.length === 0) {
            issues.push('缺少结尾节点');
        }
        
        // 检查未指定视觉素材的节点
        const nodesWithoutAssets = storyNodes.filter(n => 
            !n.visualAssets || 
            (!n.visualAssets.backgroundImageUrl && 
             (!n.visualAssets.characters || n.visualAssets.characters.length === 0))
        );
        if (nodesWithoutAssets.length > 0) {
            issues.push(`${nodesWithoutAssets.length} 个节点未设置视觉素材`);
        }
        
        return issues;
    }, [nodes, edges, storyNodes]);

    // 自定义节点类型
    const nodeTypes: NodeTypes = useMemo(() => ({
        storyNode: StoryNodeComponent,
    }), []);

    // 连接处理
    const onConnect = useCallback(
        (params: Connection) => setEdges((eds) => addEdge(params, eds)),
        [setEdges]
    );

    // 节点点击
    const onNodeClick = useCallback((_: any, node: Node) => {
        const storyNode = storyNodes.find(n => n.id === node.id);
        if (storyNode) {
            setSelectedNode(storyNode);
            onSelectNode?.(node.id);  // ✅ 通知父组件
        }
    }, [storyNodes, onSelectNode]);

    // 更新节点
    const handleUpdateNode = useCallback((updatedNode: StoryNode) => {
        // 更新 storyNodes
        const newStoryNodes = storyNodes.map(n => 
            n.id === updatedNode.id ? updatedNode : n
        );
        
        // 转换回 ScriptNode 并更新项目
        const newScript = convertStoryNodesToScript(newStoryNodes);
        onUpdate?.({
            ...project,
            script: newScript,
        });
        
        setSelectedNode(null);
    }, [storyNodes, project, onUpdate]);

    return (
        <div className="h-full w-full relative">
            <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onConnect={onConnect}
                onNodeClick={onNodeClick}
                nodeTypes={nodeTypes}
                fitView
                className="bg-slate-50"
            >
                <Background />
                <Controls />
                
                {/* 自定义控制面板 */}
                <Panel position="top-right" className="flex flex-col gap-2">
                    <div className="bg-white rounded-lg shadow-lg p-2 space-y-2">
                        <Button
                            size="sm"
                            variant="outline"
                            onClick={() => zoomIn()}
                            className="w-full gap-2"
                        >
                            <ZoomIn className="w-4 h-4" />
                            放大
                        </Button>
                        <Button
                            size="sm"
                            variant="outline"
                            onClick={() => zoomOut()}
                            className="w-full gap-2"
                        >
                            <ZoomOut className="w-4 h-4" />
                            缩小
                        </Button>
                        <Button
                            size="sm"
                            variant="outline"
                            onClick={() => fitView({ padding: 0.2 })}
                            className="w-full gap-2"
                        >
                            <Maximize2 className="w-4 h-4" />
                            适应屏幕
                        </Button>
                        <Button
                            size="sm"
                            variant={showIssues ? 'default' : 'outline'}
                            onClick={() => setShowIssues(!showIssues)}
                            className="w-full gap-2"
                        >
                            <AlertCircle className="w-4 h-4" />
                            逻辑检查
                        </Button>
                    </div>
                    
                    {/* 问题提示 */}
                    {showIssues && (
                        <div className="bg-white rounded-lg shadow-lg p-3 max-w-xs">
                            <h4 className="font-semibold text-sm mb-2 flex items-center gap-1">
                                <AlertCircle className="w-4 h-4 text-amber-600" />
                                逻辑检查结果
                            </h4>
                            {checkIssues().length === 0 ? (
                                <p className="text-xs text-green-600">✔ 没有发现问题</p>
                            ) : (
                                <ul className="text-xs text-amber-700 space-y-1">
                                    {checkIssues().map((issue, idx) => (
                                        <li key={idx}>⚠️ {issue}</li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    )}
                </Panel>
            </ReactFlow>

            {/* 右侧编辑面板 */}
            {selectedNode && (
                <NodeEditPanel
                    node={selectedNode}
                    characters={project.characters}
                    scenes={project.backgrounds || []}
                    onSave={handleUpdateNode}
                    onClose={() => setSelectedNode(null)}
                />
            )}
        </div>
    );
}
