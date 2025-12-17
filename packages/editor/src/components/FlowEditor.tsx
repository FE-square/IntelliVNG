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
import { Button, useConfirmDialog, ConfirmDialog, useToast } from '@vng/ui';
import { ZoomIn, ZoomOut, Maximize2, AlertCircle, Plus, Undo, Redo, Wand2 } from 'lucide-react';
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
    onGenerateImage?: (characterId: string, prompt: string, refImageUrl?: string, type?: 'sprite' | 'avatar' | 'background') => Promise<string>;
    i18n?: {
        undo?: string;
        redo?: string;
        addNode?: string;
        startNode?: string;
        sceneNode?: string;
        branchNode?: string;
        endingNode?: string;
        zoomIn?: string;
        zoomOut?: string;
        fitView?: string;
        logicCheck?: string;
        logicCheckResult?: string;
        noIssues?: string;
        completeAssets?: string;
        generating?: string;
        assetsComplete?: string;
        nodeEditTitle?: string;
        nodeEditStoryInfo?: string;
        nodeEditNodeTitle?: string;
        nodeEditDialogues?: string;
        nodeEditAddDialogue?: string;
        nodeEditSave?: string;
        nodeEditScene?: string;
        nodeEditNoScene?: string;
        nodeEditHasBackground?: string;
        nodeEditBackgroundLinked?: string;
        nodeEditNarration?: string;
        nodeEditNarrationPlaceholder?: string;
        nodeEditAudioAssets?: string;
        nodeEditBgm?: string;
        nodeEditBgmPlaceholder?: string;
        nodeEditSelectFromLibrary?: string;
        nodeEditEmotionalWarm?: string;
        nodeEditRomanticPiano?: string;
        nodeEditSuspenseTense?: string;
        nodeEditMysteriousAtmosphere?: string;
        nodeEditVolume?: string;
        nodeEditLoop?: string;
        nodeEditChoices?: string;
        nodeEditChoicesCount?: string;
        nodeEditChoicesDesc?: string;
        nodeEditAddChoice?: string;
        nodeEditNoChoices?: string;
        nodeEditChoice?: string;
        nodeEditChoiceText?: string;
        nodeEditChoiceTextPlaceholder?: string;
        nodeEditTargetNode?: string;
        nodeEditSelectTargetNode?: string;
        nodeEditCreateNewNode?: string;
        nodeEditCreateSceneNode?: string;
        nodeEditCreateBranchNode?: string;
        nodeEditCreateEndingNode?: string;
        nodeEditExistingNodes?: string;
        nodeEditSceneType?: string;
        nodeEditBranchType?: string;
        nodeEditEndingType?: string;
        nodeEditWillJumpTo?: string;
        nodeEditSceneLabel?: string;
        nodeEditCondition?: string;
        nodeEditConditionOptional?: string;
        nodeEditConditionPlaceholder?: string;
        nodeEditConditionDesc?: string;
        nodeEditMoveUp?: string;
        nodeEditMoveDown?: string;
        nodeEditDelete?: string;
        nodeEditNodeTitlePlaceholder?: string;
        nodeEditSelectedCount?: string;
        nodeEditCancelSelection?: string;
        nodeEditBatchSetCharacter?: string;
        nodeEditSelectCharacter?: string;
        nodeEditNoCharacterSelected?: string;
        nodeEditDialoguePlaceholder?: string;
        nodeEditNoDialogues?: string;
        // StoryNodeComponent i18n
        nodeStart?: string;
        nodeEnding?: string;
        nodeDialogues?: string;
        nodeBranches?: string;
        nodeAppearingCharacters?: string;
        // 逻辑检查相关
        issueNoStartNode?: string;
        issueMultipleStartNodes?: string;
        issueNoEndingNode?: string;
        issueCharactersWithoutAvatar?: string;
        // 补全素材相关
        generateNotConfigured?: string;
        generateNotConfiguredDesc?: string;
        generatingAvatar?: string;
        generatingAvatarDesc?: string;
        completeSuccess?: string;
        completeSuccessDesc?: string;
        noNeedToComplete?: string;
        noNeedToCompleteDesc?: string;
        completeFailed?: string;
        completeFailedDesc?: string;
        avatarPrompt?: string;
        // 创建节点相关
        startNodeAlreadyExists?: string;
        newNodeStart?: string;
        newNodeScene?: string;
        newNodeBranch?: string;
        newNodeEnding?: string;
        // 删除节点相关
        cannotDelete?: string;
        cannotDeleteStartNode?: string;
        gotIt?: string;
        deleteNodeConfirm?: string;
        deleteNodeTitle?: string;
        deleteNodeMessage?: string;
        deleteNodeWithConnections?: string;
        delete?: string;
        cancel?: string;
        // UI 相关
        undoShortcut?: string;
        redoShortcut?: string;
        zoomInTitle?: string;
        zoomOutTitle?: string;
        fitViewTitle?: string;
        logicCheckTitle?: string;
        completeAssetsTitle?: string;
        defaultSceneType?: string;
    };
}

// 简单的字符串模板替换函数
function formatTemplate(template: string, vars: Record<string, string | number>): string {
    return template.replace(/\{(\w+)\}/g, (_, key) => String(vars[key] || ''));
}

export function FlowEditor({ project, onUpdate, onSelectNode, onGenerateImage, i18n }: FlowEditorProps) {
    const { zoomIn, zoomOut, fitView, getViewport } = useReactFlow();
    const { confirm, DialogComponent } = useConfirmDialog();
    const toast = useToast();
    const [isGeneratingAssets, setIsGeneratingAssets] = useState(false);
    
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
            i18n: {
                start: i18n?.nodeStart,
                ending: i18n?.nodeEnding,
                dialogues: i18n?.nodeDialogues,
                branches: i18n?.nodeBranches,
                appearingCharacters: i18n?.nodeAppearingCharacters,
            },
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
                    handleDeleteNode(selectedNode.id);
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
                        i18n: {
                            start: i18n?.nodeStart,
                            ending: i18n?.nodeEnding,
                            dialogues: i18n?.nodeDialogues,
                            branches: i18n?.nodeBranches,
                            appearingCharacters: i18n?.nodeAppearingCharacters,
                        },
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
    }, [storyNodes, project.characters, setNodes, setEdges, i18n]);

    // ✅ 逻辑检查 - 只检查影响游戏播放的关键问题
    const checkIssues = useCallback(() => {
        const issues: string[] = [];
        
        // 检查开始节点（必须有且只有一个）
        const startNodes = storyNodes.filter(n => n.isStart);
        if (startNodes.length === 0) {
            issues.push(i18n?.issueNoStartNode || '❌ 缺少开始节点（游戏无法启动）');
        } else if (startNodes.length > 1) {
            issues.push(i18n?.issueMultipleStartNodes 
                ? formatTemplate(i18n.issueMultipleStartNodes, { count: startNodes.length })
                : `⚠️ 存在多个开始节点 (${startNodes.length}个)`);
        }
        
        // 检查结尾节点（至少要有一个）
        const endingNodes = storyNodes.filter(n => n.isEnding);
        if (endingNodes.length === 0) {
            issues.push(i18n?.issueNoEndingNode || '⚠️ 缺少结尾节点（玩家可能无法正常结束游戏）');
        }
        
        // ✅ 检查节点中对话的角色是否缺失素材（影响播放）
        const dialogueCharacterIds = new Set<string>();
        storyNodes.forEach(node => {
            node.dialogues?.forEach(d => {
                if (d.characterId && d.characterId !== 'narrator') {
                    dialogueCharacterIds.add(d.characterId);
                }
            });
        });
        
        const charactersWithoutAvatar: string[] = [];
        dialogueCharacterIds.forEach(charId => {
            const char = project.characters.find(c => c.id === charId);
            if (char && !char.avatarUrl) {
                charactersWithoutAvatar.push(char.displayName);
            }
        });
        
        if (charactersWithoutAvatar.length > 0) {
            const message = i18n?.issueCharactersWithoutAvatar 
                ? formatTemplate(i18n.issueCharactersWithoutAvatar, { 
                    count: charactersWithoutAvatar.length,
                    characters: charactersWithoutAvatar.join('、')
                })
                : `⚠️ ${charactersWithoutAvatar.length}个对话角色缺少头像: ${charactersWithoutAvatar.join('、')}`;
            issues.push(message);
        }
        
        return issues;
    }, [storyNodes, project.characters, i18n]);
    
    // ✅ 一键补全视觉素材 - 只补全影响游戏播放的必要素材
    const handleCompleteAssets = useCallback(async () => {
        if (!onGenerateImage) {
            toast.warning(
                i18n?.generateNotConfigured || '未配置生成功能',
                i18n?.generateNotConfiguredDesc || '请检查配置'
            );
            return;
        }
        
        setIsGeneratingAssets(true);
        try {
            let generatedCount = 0;
            const updatedCharacters = [...project.characters];
            
            // ✅ 只补全对话中用到的角色的头像（游戏播放必需）
            const dialogueCharacterIds = new Set<string>();
            project.script.forEach(node => {
                node.dialogues?.forEach(d => {
                    if (d.characterId && d.characterId !== 'narrator') {
                        dialogueCharacterIds.add(d.characterId);
                    }
                });
            });
            
            for (let i = 0; i < updatedCharacters.length; i++) {
                const char = updatedCharacters[i];
                
                // 只处理在对话中出现的角色
                if (!dialogueCharacterIds.has(char.id)) {
                    continue;
                }
                
                // 补全头像（游戏播放必需）
                if (!char.avatarUrl) {
                    const generatingDesc = i18n?.generatingAvatarDesc
                        ? formatTemplate(i18n.generatingAvatarDesc, { name: char.displayName })
                        : `正在生成 ${char.displayName} 的头像...`;
                    toast.info(i18n?.generatingAvatar || '生成中', generatingDesc);
                    try {
                        // 如果有立绘，使用立绘作为参考生成头像
                        const refImageUrl = char.sprites?.[0]?.imageUrl;
                        const prompt = i18n?.avatarPrompt
                            ? formatTemplate(i18n.avatarPrompt, { 
                                name: char.displayName,
                                description: char.description || ''
                            })
                            : `头像特写, ${char.displayName}, ${char.description || ''}, 头像, 肖像`;
                        const avatarUrl = await onGenerateImage('avatar-' + char.id, prompt, refImageUrl, 'avatar');
                        updatedCharacters[i] = { ...updatedCharacters[i], avatarUrl };
                        generatedCount++;
                    } catch (error) {
                        console.error(`生成 ${char.displayName} 头像失败:`, error);
                    }
                }
            }
            
            // 更新项目
            if (generatedCount > 0) {
                const updatedProject = {
                    ...project,
                    characters: updatedCharacters,
                };
                onUpdate?.(updatedProject);
                const successDesc = i18n?.completeSuccessDesc
                    ? formatTemplate(i18n.completeSuccessDesc, { count: generatedCount })
                    : `成功生成 ${generatedCount} 个头像 ✨`;
                toast.success(i18n?.completeSuccess || '补全完成', successDesc);
            } else {
                toast.info(
                    i18n?.noNeedToComplete || '无需补全',
                    i18n?.noNeedToCompleteDesc || '游戏播放所需素材都已完整'
                );
            }
        } catch (error) {
            console.error('[FlowEditor] 补全素材失败:', error);
            toast.error(
                i18n?.completeFailed || '补全失败',
                i18n?.completeFailedDesc || '请重试'
            );
        } finally {
            setIsGeneratingAssets(false);
        }
    }, [project, onGenerateImage, onUpdate, toast, i18n]);

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
                alert(i18n?.startNodeAlreadyExists || '⚠️ 已存在开始节点，不能创建多个开始节点!');
                setShowAddNodeMenu(false);
                return;
            }
        }
        
        // 构建新节点标题
        let newNodeTitle = '';
        if (isStart) {
            newNodeTitle = i18n?.newNodeStartTitle || '新开始';
        } else if (type === 'scene') {
            newNodeTitle = i18n?.newNodeSceneTitle || '新场景';
        } else if (type === 'branch') {
            newNodeTitle = i18n?.newNodeBranchTitle || '新分支';
        } else {
            newNodeTitle = i18n?.newNodeEndingTitle || '新结局';
        }
        
        const newNode: StoryNode = {
            id: newNodeId,
            type: type,
            title: newNodeTitle,
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
        
        return newNodeId;
    }, [project, onUpdate, storyNodes, onSelectNode, getViewport, saveHistory, i18n]);

    const handleDeleteNode = useCallback(async (nodeId: string) => {
        const nodeToDelete = storyNodes.find(n => n.id === nodeId);
        if (!nodeToDelete) return;
        
        const startNodes = storyNodes.filter(n => n.isStart);
        if (nodeToDelete.isStart && startNodes.length === 1) {
            await confirm({
                title: i18n?.cannotDelete || '无法删除',
                message: i18n?.cannotDeleteStartNode || '不能删除唯一的开始节点！',
                variant: 'danger',
                confirmText: i18n?.gotIt || '知道了',
                cancelText: '',
            });
            return;
        }
        
        const incomingConnections = storyNodes.filter(n => 
            n.nextNodeId === nodeId || 
            n.choices?.some(c => c.targetNodeId === nodeId)
        );
        
        let message = i18n?.deleteNodeConfirm
            ? formatTemplate(i18n.deleteNodeConfirm, { title: nodeToDelete.title })
            : `确定要删除节点「${nodeToDelete.title}」吗？`;
        if (incomingConnections.length > 0) {
            const connectionWarning = i18n?.deleteNodeWithConnections
                ? formatTemplate(i18n.deleteNodeWithConnections, { count: incomingConnections.length })
                : `\n\n⚠️ 有 ${incomingConnections.length} 个节点连接到此节点，删除后这些连接将断开。`;
            message += connectionWarning;
        }
        
        const confirmed = await confirm({
            title: i18n?.deleteNodeTitle || '删除节点',
            message,
            variant: 'danger',
            confirmText: i18n?.delete || '删除',
            cancelText: i18n?.cancel || '取消',
        });
        
        if (!confirmed) return;
        
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
    }, [project, onUpdate, storyNodes, selectedNode, saveHistory, confirm, i18n]);

    // 从选项创建新节点
    const handleCreateNodeFromChoice = useCallback(async (type: 'scene' | 'branch' | 'ending'): Promise<string> => {
        const newNodeId = handleAddNode(type, false);
        return newNodeId || '';
    }, [handleAddNode]);

    const scenes: Scene[] = (project.backgrounds || []).map(bg => ({
        id: bg.id,
        name: bg.name,
        type: bg.sceneDetails?.type || (i18n?.defaultSceneType || '室内'),
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
                                title={i18n?.undoShortcut || '撤销 (Ctrl+Z)'}
                            >
                                <Undo className="w-4 h-4" />
                                <span className="text-xs">{i18n?.undo || '撤销'}</span>
                            </Button>
                            <Button
                                size="sm"
                                variant="outline"
                                onClick={handleRedo}
                                disabled={historyIndex >= history.length - 1}
                                className="flex-1 gap-1"
                                title={i18n?.redoShortcut || '重做 (Ctrl+Y)'}
                            >
                                <Redo className="w-4 h-4" />
                                <span className="text-xs">{i18n?.redo || '重做'}</span>
                            </Button>
                        </div>
                        
                        <div className="pb-2 border-b border-gray-200 relative add-node-menu-container">
                            <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setShowAddNodeMenu(!showAddNodeMenu)}
                                className="w-full gap-2"
                            >
                                <Plus className="w-4 h-4" />
                                {i18n?.addNode || '新增节点'}
                            </Button>
                            
                            {showAddNodeMenu && (
                                <div className="absolute left-full top-0 ml-2 w-48 bg-white rounded-lg shadow-xl border border-gray-200 overflow-hidden z-50">
                                    <button
                                        onClick={() => handleAddNode('scene', true)}
                                        className="w-full px-4 py-2 text-left hover:bg-green-50 flex items-center gap-2 border-b border-gray-100"
                                    >
                                        <span className="text-lg">🟢</span>
                                        <span className="text-sm font-medium">{i18n?.startNode || '开始节点'}</span>
                                    </button>
                                    <button
                                        onClick={() => handleAddNode('scene')}
                                        className="w-full px-4 py-2 text-left hover:bg-indigo-50 flex items-center gap-2 border-b border-gray-100"
                                    >
                                        <span className="text-lg">📖</span>
                                        <span className="text-sm font-medium">{i18n?.sceneNode || '场景节点'}</span>
                                    </button>
                                    <button
                                        onClick={() => handleAddNode('branch')}
                                        className="w-full px-4 py-2 text-left hover:bg-amber-50 flex items-center gap-2 border-b border-gray-100"
                                    >
                                        <span className="text-lg">🔀</span>
                                        <span className="text-sm font-medium">{i18n?.branchNode || '分支节点'}</span>
                                    </button>
                                    <button
                                        onClick={() => handleAddNode('ending')}
                                        className="w-full px-4 py-2 text-left hover:bg-red-50 flex items-center gap-2"
                                    >
                                        <span className="text-lg">🏁</span>
                                        <span className="text-sm font-medium">{i18n?.endingNode || '结局节点'}</span>
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
                                {i18n?.zoomIn || '放大'}
                            </Button>
                            <Button
                                size="sm"
                                variant="outline"
                                onClick={() => zoomOut()}
                                className="w-full gap-2"
                                title={i18n?.zoomOutTitle || '缩小'}
                            >
                                <ZoomOut className="w-4 h-4" />
                                {i18n?.zoomOut || '缩小'}
                            </Button>
                            <Button
                                size="sm"
                                variant="outline"
                                onClick={() => fitView({ padding: 0.2 })}
                                className="w-full gap-2"
                                title={i18n?.fitViewTitle || '适应屏幕'}
                            >
                                <Maximize2 className="w-4 h-4" />
                                {i18n?.fitView || '适应屏幕'}
                            </Button>
                        </div>
                        
                        <div className="relative">
                            <Button
                                size="sm"
                                variant={showIssues ? 'default' : 'outline'}
                                onClick={() => setShowIssues(!showIssues)}
                                className="w-full gap-2"
                                title={i18n?.logicCheckTitle || '逻辑检查'}
                            >
                                <AlertCircle className="w-4 h-4" />
                                {i18n?.logicCheck || '逻辑检查'}
                            </Button>
                            
                            {showIssues && (
                                <div className="absolute left-full top-0 ml-2 w-64 bg-white rounded-lg shadow-xl border border-gray-200 p-3 z-50">
                                    <h4 className="font-semibold text-sm mb-2 flex items-center gap-1">
                                        <AlertCircle className="w-4 h-4 text-amber-600" />
                                        {i18n?.logicCheckResult || '逻辑检查结果'}
                                    </h4>
                                    {checkIssues().length === 0 ? (
                                        <p className="text-xs text-green-600">{i18n?.noIssues || '✔ 没有发现问题'}</p>
                                    ) : (
                                        <ul className="text-xs text-amber-700 space-y-1">
                                            {checkIssues().map((issue, idx) => (
                                                <li key={idx}>{issue}</li>
                                            ))}
                                        </ul>
                                    )}
                                </div>
                            )}
                        </div>
                        
                        {/* ✅ 一键补全视觉素材按钮 - 只补全游戏播放必需的素材 */}
                        {onGenerateImage && (() => {
                            // ✅ 只检查对话中用到的角色是否缺少头像
                            const dialogueCharacterIds = new Set<string>();
                            storyNodes.forEach(node => {
                                node.dialogues?.forEach(d => {
                                    if (d.characterId && d.characterId !== 'narrator') {
                                        dialogueCharacterIds.add(d.characterId);
                                    }
                                });
                            });
                            
                            const missingAvatars = Array.from(dialogueCharacterIds).filter(charId => {
                                const char = project.characters.find(c => c.id === charId);
                                return char && !char.avatarUrl;
                            }).length;
                            
                            return (
                                <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={handleCompleteAssets}
                                    disabled={isGeneratingAssets || missingAvatars === 0}
                                    className="w-full gap-2 bg-gradient-to-r from-green-50 to-emerald-50 border-green-300 hover:from-green-100 hover:to-emerald-100 disabled:opacity-50 disabled:cursor-not-allowed text-green-700"
                                    title={i18n?.completeAssetsTitle || '自动补全对话角色缺失的头像（游戏播放必需）'}
                                >
                                    <Wand2 className="w-4 h-4" />
                                    {isGeneratingAssets ? (i18n?.generating || '生成中...') : missingAvatars > 0 ? `${i18n?.completeAssets || '补全头像'} (${missingAvatars})` : (i18n?.assetsComplete || '素材完整')}
                                </Button>
                            );
                        })()}
                    </div>
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
                    onDelete={handleDeleteNode}
                    onCreateNodeFromChoice={handleCreateNodeFromChoice}
                    allNodes={storyNodes}
                    i18n={{
                        title: i18n?.nodeEditTitle || '编辑情节节点',
                        storyInfo: i18n?.nodeEditStoryInfo || '🎬 情节信息',
                        nodeTitle: i18n?.nodeEditNodeTitle || '情节标题',
                        dialogues: i18n?.nodeEditDialogues || '角色对话',
                        addDialogue: i18n?.nodeEditAddDialogue || '添加对话',
                        save: i18n?.nodeEditSave || '保存修改',
                        scene: i18n?.nodeEditScene || '🏞️ 所在场景',
                        noScene: i18n?.nodeEditNoScene || '未指定场景',
                        hasBackground: i18n?.nodeEditHasBackground || ' ✓ 有背景图',
                        backgroundLinked: i18n?.nodeEditBackgroundLinked || '✓ 场景背景图已关联',
                        narration: i18n?.nodeEditNarration || '旁白/背景交代',
                        narrationPlaceholder: i18n?.nodeEditNarrationPlaceholder || '例：夜幕降临，雨声止息，旧巷深处传来脚步声...',
                        audioAssets: i18n?.nodeEditAudioAssets || '🎵 音频配乐',
                        bgm: i18n?.nodeEditBgm || '🎼 背景音乐 (BGM)',
                        bgmPlaceholder: i18n?.nodeEditBgmPlaceholder || '输入音乐URL (支持 mp3, ogg, wav)',
                        selectFromLibrary: i18n?.nodeEditSelectFromLibrary || '从预设音乐库选择',
                        emotionalWarm: i18n?.nodeEditEmotionalWarm || '情感/温馨',
                        romanticPiano: i18n?.nodeEditRomanticPiano || '浪漫钢琴',
                        suspenseTense: i18n?.nodeEditSuspenseTense || '悬疑/紧张',
                        mysteriousAtmosphere: i18n?.nodeEditMysteriousAtmosphere || '神秘氛围',
                        volume: i18n?.nodeEditVolume || '🔊 音量',
                        loop: i18n?.nodeEditLoop || '循环播放',
                        choices: i18n?.nodeEditChoices || '🔀 选项与分支',
                        choicesCount: i18n?.nodeEditChoicesCount || '{count} 个选项',
                        choicesDesc: i18n?.nodeEditChoicesDesc || '为该节点添加分支选项，每个选项可以跳转到不同的后续节点',
                        addChoice: i18n?.nodeEditAddChoice || '添加选项',
                        noChoices: i18n?.nodeEditNoChoices || '还没有分支选项，点击上方按钮添加',
                        choice: i18n?.nodeEditChoice || '选项',
                        choiceText: i18n?.nodeEditChoiceText || '选项文本',
                        choiceTextPlaceholder: i18n?.nodeEditChoiceTextPlaceholder || '例：跟随她、报警、转身离开',
                        targetNode: i18n?.nodeEditTargetNode || '跳转到节点',
                        selectTargetNode: i18n?.nodeEditSelectTargetNode || '选择目标节点',
                        createNewNode: i18n?.nodeEditCreateNewNode || '➕ 创建新节点',
                        createSceneNode: i18n?.nodeEditCreateSceneNode || '🆕 创建普通节点',
                        createBranchNode: i18n?.nodeEditCreateBranchNode || '🔀 创建分支节点',
                        createEndingNode: i18n?.nodeEditCreateEndingNode || '🏁 创建结局节点',
                        existingNodes: i18n?.nodeEditExistingNodes || '📋 选择现有节点',
                        sceneType: i18n?.nodeEditSceneType || '场景',
                        branchType: i18n?.nodeEditBranchType || '分支',
                        endingType: i18n?.nodeEditEndingType || '结局',
                        willJumpTo: i18n?.nodeEditWillJumpTo || '将跳转到:',
                        sceneLabel: i18n?.nodeEditSceneLabel || '场景:',
                        condition: i18n?.nodeEditCondition || '触发条件',
                        conditionOptional: i18n?.nodeEditConditionOptional || '(选填)',
                        conditionPlaceholder: i18n?.nodeEditConditionPlaceholder || '例：拥有道具:钥匙、好感度>50',
                        conditionDesc: i18n?.nodeEditConditionDesc || '设置该选项的显示条件，例如要求特定道具或属性值',
                        moveUp: i18n?.nodeEditMoveUp || '上移',
                        moveDown: i18n?.nodeEditMoveDown || '下移',
                        delete: i18n?.nodeEditDelete || '删除',
                        nodeTitlePlaceholder: i18n?.nodeEditNodeTitlePlaceholder || '例:初次相遇、危机爆发...',
                        selectedCount: i18n?.nodeEditSelectedCount || '已选择 {count} 条对话',
                        cancelSelection: i18n?.nodeEditCancelSelection || '取消选择',
                        batchSetCharacter: i18n?.nodeEditBatchSetCharacter || '批量设置角色：',
                        selectCharacter: i18n?.nodeEditSelectCharacter || '选择角色',
                        noCharacterSelected: i18n?.nodeEditNoCharacterSelected || '未选择角色',
                        dialoguePlaceholder: i18n?.nodeEditDialoguePlaceholder || '输入对话内容...',
                        noDialogues: i18n?.nodeEditNoDialogues || '还没有对话，点击上方按钮添加',
                    }}
                />
            )}
            
            {/* 确认对话框 */}
            {DialogComponent}
        </div>
    );
}
