import { create } from 'zustand';
import {
    Node,
    Edge,
    OnNodesChange,
    OnEdgesChange,
    applyNodeChanges,
    applyEdgeChanges,
} from 'reactflow';
import { GameProject, StoryNode, Character, Background } from '@vng/core';

interface EditorState {
    // Project Data
    project: GameProject | null;

    // React Flow State
    nodes: Node<StoryNode>[];
    edges: Edge[];

    // Selection
    selectedNodeId: string | null;

    // Actions
    setProject: (project: GameProject) => void;

    onNodesChange: OnNodesChange;
    onEdgesChange: OnEdgesChange;

    addNode: (node: StoryNode) => void;
    updateNode: (nodeId: string, data: Partial<StoryNode>) => void;
    deleteNode: (nodeId: string) => void;

    addEdge: (source: string, target: string, sourceHandle?: string) => void;

    selectNode: (nodeId: string | null) => void;

    // Character Management
    addCharacter: (character: Character) => void;
    updateCharacter: (characterId: string, data: Partial<Character>) => void;

    // Background Management
    addBackground: (background: Background) => void;
    updateBackground: (backgroundId: string, data: Partial<Background>) => void;

    // Export
    exportProject: () => GameProject;
}

export const useEditorStore = create<EditorState>((set, get) => ({
    project: null,
    nodes: [],
    edges: [],
    selectedNodeId: null,

    setProject: (project) => {
        // Convert StoryNode[] to React Flow Node[]
        const nodes = project.script.map(node => ({
            id: node.id,
            type: 'storyNode',  // 统一使用 storyNode 类型
            position: node.position,
            data: node,
        }));

        // Generate edges from nextNodeId and choices
        const edges = generateEdgesFromStoryNodes(project.script);

        set({ project, nodes, edges });
    },

    onNodesChange: (changes) => {
        set({ nodes: applyNodeChanges(changes, get().nodes) });
    },

    onEdgesChange: (changes) => {
        set({ edges: applyEdgeChanges(changes, get().edges) });
    },

    addNode: (storyNode) => {
        const node: Node<StoryNode> = {
            id: storyNode.id,
            type: 'storyNode',
            position: storyNode.position,
            data: storyNode,
        };
        set({ nodes: [...get().nodes, node] });
    },

    updateNode: (nodeId, data) => {
        set({
            nodes: get().nodes.map(node =>
                node.id === nodeId
                    ? { ...node, data: { ...node.data, ...data } }
                    : node
            ),
        });
    },

    deleteNode: (nodeId) => {
        set({
            nodes: get().nodes.filter(n => n.id !== nodeId),
            edges: get().edges.filter(e => e.source !== nodeId && e.target !== nodeId),
        });
    },

    addEdge: (source, target, sourceHandle) => {
        const edge: Edge = {
            id: `${source}-${target}`,
            source,
            target,
            sourceHandle,
        };
        set({ edges: [...get().edges, edge] });
    },

    selectNode: (nodeId) => set({ selectedNodeId: nodeId }),

    addCharacter: (character) => {
        const project = get().project;
        if (project) {
            set({
                project: {
                    ...project,
                    characters: [...project.characters, character],
                },
            });
        }
    },

    updateCharacter: (characterId, data) => {
        const project = get().project;
        if (project) {
            set({
                project: {
                    ...project,
                    characters: project.characters.map(c =>
                        c.id === characterId ? { ...c, ...data } : c
                    ),
                },
            });
        }
    },

    addBackground: (background) => {
        const project = get().project;
        if (project) {
            set({
                project: {
                    ...project,
                    backgrounds: [...project.backgrounds, background],
                },
            });
        }
    },

    updateBackground: (backgroundId, data) => {
        const project = get().project;
        if (project) {
            set({
                project: {
                    ...project,
                    backgrounds: project.backgrounds.map(b =>
                        b.id === backgroundId ? { ...b, ...data } : b
                    ),
                },
            });
        }
    },

    exportProject: () => {
        const { project, nodes } = get();
        if (!project) throw new Error('No project loaded');

        // Convert React Flow nodes back to StoryNode[]
        const script: StoryNode[] = nodes.map(node => ({
            ...node.data,
            position: node.position,
        }));

        return { ...project, script };
    },
}));

// Helper: Generate edges from StoryNode[]
function generateEdgesFromStoryNodes(nodes: StoryNode[]): Edge[] {
    const edges: Edge[] = [];

    nodes.forEach(node => {
        // scene 类型: 单线连接
        if (node.nextNodeId) {
            edges.push({
                id: `${node.id}-${node.nextNodeId}`,
                source: node.id,
                target: node.nextNodeId,
            });
        }

        // branch 类型: 多个选项连接
        if (node.choices && node.choices.length > 0) {
            node.choices.forEach((choice, index) => {
                if (choice.targetNodeId) {
                    edges.push({
                        id: `${node.id}-choice-${index}`,
                        source: node.id,
                        target: choice.targetNodeId,
                        sourceHandle: `choice-${index}`,
                        label: choice.text,
                    });
                }
            });
        }
    });

    return edges;
}
