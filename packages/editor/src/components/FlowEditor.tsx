'use client';

import { useCallback, useMemo, useState, useEffect, useRef } from 'react';
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
import { ZoomIn, ZoomOut, Maximize2, AlertCircle, Plus, Undo, Redo } from 'lucide-react';
import type { GameProject, StoryNode, Scene } from '@vng/core';
import { StoryNodeComponent } from './StoryNodeComponent';
import { NodeEditPanel } from './NodeEditPanel';

const nodeTypes: NodeTypes = {
    storyNode: StoryNodeComponent,
};

interface FlowEditorProps {
    project: GameProject;
    onUpdate?: (project: GameProject) => void;
    onSelectNode?: (nodeId: string | null) => void;
    onGenerateImage?: (characterId: string, prompt: string, refImageUrl?: string) => Promise<string>;
}

export function FlowEditor({ project, onUpdate, onSelectNode, onGenerateImage }: FlowEditorProps) {
    const { zoomIn, zoomOut, fitView, getViewport } = useReactFlow();
    
    const storyNodes: StoryNode[] = useMemo(() => {
        if (!project.script || project.script.length === 0) {
            return [];
        }
        return project.script;
    }, [project.script]);

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
    const [showAddNodeMenu, setShowAddNodeMenu] = useState(false);
    const [selectedEdge, setSelectedEdge] = useState<string | null>(null);
    
    const [history, setHistory] = useState<GameProject[]>([]);
    const [historyIndex, setHistoryIndex] = useState(-1);
    const isUndoingRef = useRef(false);
    
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            const target = e.target as HTMLElement;
            if (showAddNodeMenu && !target.closest('.add-node-menu-container')) {
                setShowAddNodeMenu(false);
            }
        };
        
        if (showAddNodeMenu) {
            document.addEventListener('click', handleClickOutside);
            return () => document.removeEventListener('click', handleClickOutside);
        }
    }, [showAddNodeMenu]);
    
    useEffect(() => {
        if (history.length === 0 && project) {
            setHistory([JSON.parse(JSON.stringify(project))]);
            setHistoryIndex(0);
        }
    }, []);
    
    const saveHistory = useCallback((newProject: GameProject) => {
        if (isUndoingRef.current) {
            return;
        }
        
        setHistoryIndex(currentIndex => {
            setHistory(prev => {
                const newHistory = prev.slice(0, currentIndex + 1);
                newHistory.push(JSON.parse(JSON.stringify(newProject)));
                if (newHistory.length > 20) {
                    newHistory.shift();
                }
                return newHistory;
            });
            
            const newHistoryLength = Math.min(currentIndex + 2, 20);
            return Math.min(currentIndex + 1, newHistoryLength - 1);
        });
    }, []);
    
    const handleUndo = useCallback(() => {
        if (historyIndex > 0) {
            isUndoingRef.current = true;
            const prevProject = history[historyIndex - 1];
            setHistoryIndex(historyIndex - 1);
            onUpdate?.(prevProject);
            setTimeout(() => {
                isUndoingRef.current = false;
            }, 100);
        }
    }, [history, historyIndex, onUpdate]);
    
    const handleRedo = useCallback(() => {
        if (historyIndex < history.length - 1) {
            isUndoingRef.current = true;
            const nextProject = history[historyIndex + 1];
            setHistoryIndex(historyIndex + 1);
            onUpdate?.(nextProject);
            setTimeout(() => {
                isUndoingRef.current = false;
            }, 100);
        }
    }, [history, historyIndex, onUpdate]);
    
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
                e.preventDefault();
                handleUndo();
            } else if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
                e.preventDefault();
                handleRedo();
            }
            else if (e.key === 'Delete' || e.key === 'Backspace') {
                e.preventDefault();
                
                if (selectedEdge) {
                    const parts = selectedEdge.split('-');
                    const sourceId = parts[0];
                    
                    const newScript = project.script.map(node => {
                        if (node.id === sourceId) {
                            if (selectedEdge.includes('-choice-')) {
                                const choiceIndex = parseInt(parts[2]);
                                return {
                                    ...node,
                                    choices: node.choices?.filter((_, idx) => idx !== choiceIndex),
                                };
                            } else {
                                return {
                                    ...node,
                                    nextNodeId: undefined,
                                };
                            }
                        }
                        return node;
                    });
                    
                    const newProject = {
                        ...project,
                        script: newScript,
                    };
                    
                    onUpdate?.(newProject);
                    saveHistory(newProject);
                    setSelectedEdge(null);
                } else if (selectedNode) {
                    const nodeToDelete = storyNodes.find(n => n.id === selectedNode.id);
                    if (!nodeToDelete) return;
                    
                    const startNodes = storyNodes.filter(n => n.isStart);
                    if (nodeToDelete.isStart && startNodes.length === 1) {
                        alert('⚠️ 不能删除唯一的开始节点!');
                        return;
                    }
                    
                    const incomingConnections = storyNodes.filter(n => 
                        n.nextNodeId === selectedNode.id || 
                        n.choices?.some(c => c.targetNodeId === selectedNode.id)
                    );
                    
                    let confirmMessage = `确定要删除节点「${nodeToDelete.title}」吗?`;
                    if (incomingConnections.length > 0) {
                        confirmMessage += `\n\n⚠️ 有 ${incomingConnections.length} 个节点连接到此节点,删除后这些连接将断开。`;
                    }
                    
                    if (!confirm(confirmMessage)) return;
                    
                    const newScript = project.script
                        .filter(n => n.id !== selectedNode.id)
                        .map(node => ({
                            ...node,
                            nextNodeId: node.nextNodeId === selectedNode.id ? undefined : node.nextNodeId,
                            choices: node.choices?.filter(c => c.targetNodeId !== selectedNode.id),
                        }));
                    
                    const newProject = {
                        ...project,
                        script: newScript,
                    };
                    
                    onUpdate?.(newProject);
                    saveHistory(newProject);
                    setSelectedNode(null);
                }
            }
        };
        
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [handleUndo, handleRedo, selectedNode, selectedEdge, storyNodes, project, onUpdate, saveHistory]);
    
    useEffect(() => {
        setNodes(currentNodes => {
            return storyNodes.map(storyNode => {
                const existingNode = currentNodes.find(n => n.id === storyNode.id);
                
                return {
                    id: storyNode.id,
                    type: 'storyNode',
                    position: existingNode?.position || storyNode.position,
                    data: { 
                        storyNode: storyNode,
                        characters: project.characters,
                    },
                };
            });
        });
        
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

    const onConnect = useCallback(
        (params: Connection) => {
            const newEdge = {
                ...params,
                type: 'smoothstep',
                animated: true,
                markerEnd: { type: MarkerType.ArrowClosed },
            };
            setEdges((eds) => addEdge(newEdge, eds));
        },
        [setEdges]
    );

    const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
        const storyNode = storyNodes.find(n => n.id === node.id);
        if (storyNode) {
            setSelectedNode(storyNode);
            onSelectNode?.(node.id);
        }
    }, [storyNodes, onSelectNode]);
    
    const onEdgeClick = useCallback((_: React.MouseEvent, edge: any) => {
        setSelectedEdge(edge.id);
    }, []);
    
    const handleNodesChange = useCallback((changes: any[]) => {
        onNodesChange(changes);
        
        const positionChanges = changes.filter(change => 
            change.type === 'position' && change.dragging === false && change.position
        );
        
        if (positionChanges.length > 0 && onUpdate) {
            const newScript = project.script.map(node => {
                const posChange = positionChanges.find(c => c.id === node.id);
                if (posChange) {
                    return { ...node, position: posChange.position };
                }
                return node;
            });
            
            onUpdate({
                ...project,
                script: newScript,
            });
        }
    }, [onNodesChange, project, onUpdate]);

    const handleUpdateNode = useCallback((updatedNode: StoryNode) => {
        const newScript = project.script.map(node => 
            node.id === updatedNode.id ? updatedNode : node
        );
        
        const newProject = {
            ...project,
            script: newScript,
        };
        
        saveHistory(newProject);
        onUpdate?.(newProject);
        
        setSelectedNode(null);
    }, [project, onUpdate, saveHistory]);

    const handleAddNode = useCallback((type: 'scene' | 'branch' | 'ending', isStart: boolean = false) => {
        const newNodeId = `node-${Date.now()}`;
        
        const viewport = getViewport();
        const centerX = -viewport.x / viewport.zoom + (window.innerWidth / 2) / viewport.zoom;
        const centerY = -viewport.y / viewport.zoom + (window.innerHeight / 2) / viewport.zoom;
        const position = { x: centerX - 100, y: centerY - 50 };
        
        if (isStart) {
            const hasStartNode = storyNodes.some(n => n.isStart);
            if (hasStartNode) {
                alert('⚠️ 已存在开始节点，不能创建多个开始节点!');
                setShowAddNodeMenu(false);
                return;
            }
        }
        
        const newNode: StoryNode = {
            id: newNodeId,
            type: type,
            title: `新${isStart ? '开始' : type === 'scene' ? '场景' : type === 'branch' ? '分支' : '结局'}`,
            position,
            dialogues: [],
            isStart: isStart,
            isEnding: type === 'ending',
        };
        
        const newScript = [...project.script, newNode];
        
        const newProject = {
            ...project,
            script: newScript,
        };
        
        onUpdate?.(newProject);
        saveHistory(newProject);
        
        setTimeout(() => {
            setSelectedNode(newNode);
            onSelectNode?.(newNodeId);
        }, 100);
        
        setShowAddNodeMenu(false);
    }, [project, onUpdate, storyNodes, onSelectNode, getViewport, saveHistory]);

    const handleDeleteNode = useCallback((nodeId: string) => {
        const nodeToDelete = storyNodes.find(n => n.id === nodeId);
        if (!nodeToDelete) return;
        
        const startNodes = storyNodes.filter(n => n.isStart);
        if (nodeToDelete.isStart && startNodes.length === 1) {
            alert('⚠️ 不能删除唯一的开始节点!');
            return;
        }
        
        const incomingConnections = storyNodes.filter(n => 
            n.nextNodeId === nodeId || 
            n.choices?.some(c => c.targetNodeId === nodeId)
        );
        
        let confirmMessage = `确定要删除节点「${nodeToDelete.title}」吗?`;
        if (incomingConnections.length > 0) {
            confirmMessage += `\n\n⚠️ 有 ${incomingConnections.length} 个节点连接到此节点,删除后这些连接将断开。`;
        }
        
        if (!confirm(confirmMessage)) return;
        
        const newScript = project.script
            .filter(n => n.id !== nodeId)
            .map(node => ({
                ...node,
                nextNodeId: node.nextNodeId === nodeId ? undefined : node.nextNodeId,
                choices: node.choices?.filter(c => c.targetNodeId !== nodeId),
            }));
        
        const newProject = {
            ...project,
            script: newScript,
        };
        
        onUpdate?.(newProject);
        saveHistory(newProject);
        
        if (selectedNode?.id === nodeId) {
            setSelectedNode(null);
        }
    }, [project, onUpdate, storyNodes, selectedNode, saveHistory]);

    const scenes: Scene[] = (project.backgrounds || []).map(bg => ({
        id: bg.id,
        name: bg.name,
        type: bg.sceneDetails?.type || '室内',
        atmosphere: bg.sceneDetails?.atmosphere || '',
        details: bg.description,
        imageUrl: bg.imageUrl,
    }));
    
    const defaultEdgeOptions = {
        type: 'smoothstep',
        animated: true,
        markerEnd: { type: MarkerType.ArrowClosed },
    };

    return (
        <div className="h-full w-full relative">
            <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={handleNodesChange}
                onEdgesChange={onEdgesChange}
                onConnect={onConnect}
                onNodeClick={onNodeClick}
                onEdgeClick={onEdgeClick}
                nodeTypes={nodeTypes}
                defaultEdgeOptions={defaultEdgeOptions}
                deleteKeyCode={null}
                fitView
                className="bg-slate-50"
            >
                <Background />
                <Controls />
                
                <Panel position="top-left" className="!top-1/2 -translate-y-1/2">
                    <div className="bg-white rounded-lg shadow-lg p-3 space-y-2 min-w-[160px]">
                        <div className="flex gap-2 pb-2 border-b border-gray-200">
                            <Button
                                size="sm"
                                variant="outline"
                                onClick={handleUndo}
                                disabled={historyIndex <= 0}
                                className="flex-1 gap-1"
                                title="撤销 (Ctrl+Z)"
                            >
                                <Undo className="w-4 h-4" />
                                <span className="text-xs">撤销</span>
                            </Button>
                            <Button
                                size="sm"
                                variant="outline"
                                onClick={handleRedo}
                                disabled={historyIndex >= history.length - 1}
                                className="flex-1 gap-1"
                                title="重做 (Ctrl+Y)"
                            >
                                <Redo className="w-4 h-4" />
                                <span className="text-xs">重做</span>
                            </Button>
                        </div>
                        
                        <div className="pb-2 border-b border-gray-200 relative add-node-menu-container">
                            <Button
                                size="sm"
                                variant="default"
                                onClick={() => setShowAddNodeMenu(!showAddNodeMenu)}
                                className="w-full gap-2 bg-indigo-600 hover:bg-indigo-700"
                            >
                                <Plus className="w-4 h-4" />
                                新增节点
                            </Button>
                            
                            {showAddNodeMenu && (
                                <div className="absolute left-full top-0 ml-2 w-48 bg-white rounded-lg shadow-xl border border-gray-200 overflow-hidden z-50">
                                    <button
                                        onClick={() => handleAddNode('scene', true)}
                                        className="w-full px-4 py-2 text-left hover:bg-green-50 flex items-center gap-2 border-b border-gray-100"
                                    >
                                        <span className="text-lg">🟢</span>
                                        <span className="text-sm font-medium">开始节点</span>
                                    </button>
                                    <button
                                        onClick={() => handleAddNode('scene')}
                                        className="w-full px-4 py-2 text-left hover:bg-indigo-50 flex items-center gap-2 border-b border-gray-100"
                                    >
                                        <span className="text-lg">📖</span>
                                        <span className="text-sm font-medium">场景节点</span>
                                    </button>
                                    <button
                                        onClick={() => handleAddNode('branch')}
                                        className="w-full px-4 py-2 text-left hover:bg-amber-50 flex items-center gap-2 border-b border-gray-100"
                                    >
                                        <span className="text-lg">🔀</span>
                                        <span className="text-sm font-medium">分支节点</span>
                                    </button>
                                    <button
                                        onClick={() => handleAddNode('ending')}
                                        className="w-full px-4 py-2 text-left hover:bg-red-50 flex items-center gap-2"
                                    >
                                        <span className="text-lg">🏁</span>
                                        <span className="text-sm font-medium">结局节点</span>
                                    </button>
                                </div>
                            )}
                        </div>
                        
                        <div className="space-y-2 pb-2 border-b border-gray-200">
                            <Button
                                size="sm"
                                variant="outline"
                                onClick={() => zoomIn()}
                                className="w-full gap-2"
                                title="放大"
                            >
                                <ZoomIn className="w-4 h-4" />
                                放大
                            </Button>
                            <Button
                                size="sm"
                                variant="outline"
                                onClick={() => zoomOut()}
                                className="w-full gap-2"
                                title="缩小"
                            >
                                <ZoomOut className="w-4 h-4" />
                                缩小
                            </Button>
                            <Button
                                size="sm"
                                variant="outline"
                                onClick={() => fitView({ padding: 0.2 })}
                                className="w-full gap-2"
                                title="适应屏幕"
                            >
                                <Maximize2 className="w-4 h-4" />
                                适应屏幕
                            </Button>
                        </div>
                        
                        <Button
                            size="sm"
                            variant={showIssues ? 'default' : 'outline'}
                            onClick={() => setShowIssues(!showIssues)}
                            className="w-full gap-2"
                            title="逻辑检查"
                        >
                            <AlertCircle className="w-4 h-4" />
                            逻辑检查
                        </Button>
                    </div>
                </Panel>
                
                {showIssues && (
                    <Panel position="top-right">
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
                    </Panel>
                )}
            </ReactFlow>

            {selectedNode && (
                <NodeEditPanel
                    node={selectedNode}
                    characters={project.characters}
                    scenes={scenes}
                    onSave={handleUpdateNode}
                    onClose={() => setSelectedNode(null)}
                    onGenerateImage={onGenerateImage}
                    onDelete={handleDeleteNode}
                    allNodes={storyNodes}
                />
            )}
        </div>
    );
}
