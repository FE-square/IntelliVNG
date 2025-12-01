'use client';

import { useCallback, useMemo, useState, useEffect } from 'react';
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
import type { GameProject, StoryNode, Scene } from '@vng/core';
import { StoryNodeComponent } from './StoryNodeComponent';
import { NodeEditPanel } from './NodeEditPanel';

interface FlowEditorProps {
    project: GameProject;
    onUpdate?: (project: GameProject) => void;
    onSelectNode?: (nodeId: string | null) => void;
    onGenerateImage?: (characterId: string, prompt: string) => Promise<string>;  // 图片生成回调
}

export function FlowEditor({ project, onUpdate, onSelectNode, onGenerateImage }: FlowEditorProps) {
    const { zoomIn, zoomOut, fitView } = useReactFlow();
    
    // 直接使用 project.script 作为 StoryNode[]
    const storyNodes: StoryNode[] = useMemo(() => {
        if (!project.script || project.script.length === 0) {
            return [];
        }
        return project.script;
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
        
        if (node.choices && node.choices.length > 0) {
            node.choices.forEach((choice, index) => {
                if (choice.targetNodeId) {
                    initialEdges.push({
                        id: `${node.id}-choice-${index}`,
                        source: node.id,
                        target: choice.targetNodeId,
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
    
    const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
    const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
    const [selectedNode, setSelectedNode] = useState<StoryNode | null>(null);
    const [showIssues, setShowIssues] = useState(false);
    
    // 当 storyNodes 更新时，重新同步 React Flow 节点
    useEffect(() => {
        const newNodes: Node[] = storyNodes.map(node => ({
            id: node.id,
            type: 'storyNode',
            position: node.position,
            data: { 
                storyNode: node,
                characters: project.characters,
            },
        }));
        setNodes(newNodes);
        
        const newEdges: Edge[] = [];
        storyNodes.forEach(node => {
            if (node.nextNodeId) {
                newEdges.push({
                    id: `${node.id}-${node.nextNodeId}`,
                    source: node.id,
                    target: node.nextNodeId,
                    type: 'smoothstep',
                    animated: true,
                    markerEnd: { type: MarkerType.ArrowClosed },
                });
            }
            
            if (node.choices && node.choices.length > 0) {
                node.choices.forEach((choice, index) => {
                    if (choice.targetNodeId) {
                        newEdges.push({
                            id: `${node.id}-choice-${index}`,
                            source: node.id,
                            target: choice.targetNodeId,
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
        setEdges(newEdges);
    }, [storyNodes, project.characters, setNodes, setEdges]);

    // 逻辑检查
    const checkIssues = useCallback(() => {
        const issues: string[] = [];
        
        const connectedNodes = new Set<string>();
        edges.forEach(edge => {
            connectedNodes.add(edge.source);
            connectedNodes.add(edge.target);
        });
        
        const orphanNodes = nodes.filter(n => !connectedNodes.has(n.id) && !storyNodes.find(sn => sn.id === n.id && sn.isStart));
        if (orphanNodes.length > 0) {
            issues.push(`发现 ${orphanNodes.length} 个孤立节点（无连接）`);
        }
        
        const startNodes = storyNodes.filter(n => n.isStart);
        if (startNodes.length === 0) {
            issues.push('缺少开始节点');
        } else if (startNodes.length > 1) {
            issues.push(`存在多个开始节点 (${startNodes.length}个)`);
        }
        
        const endingNodes = storyNodes.filter(n => n.isEnding);
        if (endingNodes.length === 0) {
            issues.push('缺少结尾节点');
        }
        
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

    const nodeTypes: NodeTypes = useMemo(() => ({
        storyNode: StoryNodeComponent,
    }), []);

    const onConnect = useCallback(
        (params: Connection) => setEdges((eds) => addEdge(params, eds)),
        [setEdges]
    );

    const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
        const storyNode = storyNodes.find(n => n.id === node.id);
        if (storyNode) {
            setSelectedNode(storyNode);
            onSelectNode?.(node.id);
        }
    }, [storyNodes, onSelectNode]);

    const handleUpdateNode = useCallback((updatedNode: StoryNode) => {
        const newScript = project.script.map(node => 
            node.id === updatedNode.id ? updatedNode : node
        );
        
        onUpdate?.({
            ...project,
            script: newScript,
        });
        
        setSelectedNode(null);
    }, [project, onUpdate]);

    // 将 backgrounds 转换为 scenes 格式（兼容）
    const scenes: Scene[] = (project.backgrounds || []).map(bg => ({
        id: bg.id,
        name: bg.name,
        type: bg.sceneDetails?.type || '室内',
        atmosphere: bg.sceneDetails?.atmosphere || '',
        details: bg.description,
        imageUrl: bg.imageUrl,
    }));

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

            {selectedNode && (
                <NodeEditPanel
                    node={selectedNode}
                    characters={project.characters}
                    scenes={scenes}
                    onSave={handleUpdateNode}
                    onClose={() => setSelectedNode(null)}
                    onGenerateImage={onGenerateImage}
                />
            )}
        </div>
    );
}

