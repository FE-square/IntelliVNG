import { create } from 'zustand';
import {
    Node,
    Edge,
    OnNodesChange,
    OnEdgesChange,
    applyNodeChanges,
    applyEdgeChanges,
} from 'reactflow';
import { GameProject, ScriptNode, Character, Background } from '@vng/core';

interface EditorState {
    // Project Data
    project: GameProject | null;

    // React Flow State
    nodes: Node<ScriptNode>[];
    edges: Edge[];

    // Selection
    selectedNodeId: string | null;

    // Actions
    setProject: (project: GameProject) => void;

    onNodesChange: OnNodesChange;
    onEdgesChange: OnEdgesChange;

    addNode: (node: ScriptNode) => void;
    updateNode: (nodeId: string, data: Partial<ScriptNode>) => void;
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
        // Convert ScriptNode[] to React Flow Node[]
        const nodes = project.script.map(node => ({
            id: node.id,
            type: node.type,
            position: node.position,
            data: node,
        }));

        // Generate edges from nextNodeId
        const edges = generateEdgesFromScript(project.script);

        set({ project, nodes, edges });
    },

    onNodesChange: (changes) => {
        set({ nodes: applyNodeChanges(changes, get().nodes) });
    },

    onEdgesChange: (changes) => {
        set({ edges: applyEdgeChanges(changes, get().edges) });
    },

    addNode: (scriptNode) => {
        const node: Node<ScriptNode> = {
            id: scriptNode.id,
            type: scriptNode.type,
            position: scriptNode.position,
            data: scriptNode,
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
        const { project, nodes, edges } = get();
        if (!project) throw new Error('No project loaded');

        // Convert React Flow nodes back to ScriptNode[]
        const script = nodes.map(node => ({
            ...node.data,
            position: node.position,
        }));

        return { ...project, script };
    },
}));

// Helper: Generate edges from script nodes
function generateEdgesFromScript(script: ScriptNode[]): Edge[] {
    const edges: Edge[] = [];

    script.forEach(node => {
        if ('nextNodeId' in node && node.nextNodeId) {
            edges.push({
                id: `${node.id}-${node.nextNodeId}`,
                source: node.id,
                target: node.nextNodeId,
            });
        }

        if (node.type === 'choice') {
            node.choices.forEach((choice, index) => {
                edges.push({
                    id: `${node.id}-${choice.nextNodeId}-${index}`,
                    source: node.id,
                    target: choice.nextNodeId,
                    sourceHandle: `choice-${index}`,
                    label: choice.text,
                });
            });
        }

        if (node.type === 'condition') {
            edges.push({
                id: `${node.id}-true`,
                source: node.id,
                target: node.trueNodeId,
                sourceHandle: 'true',
                label: 'True',
            });
            edges.push({
                id: `${node.id}-false`,
                source: node.id,
                target: node.falseNodeId,
                sourceHandle: 'false',
                label: 'False',
            });
        }
    });

    return edges;
}
