import { GameProject, ScriptNode, Choice } from '@vng/core';

export class GameEngine {
    private project: GameProject;
    private currentNodeId: string | null = null;
    private variables: Record<string, any> = {};

    constructor(project: GameProject) {
        this.project = project;
        // Find start node (usually the first one or defined in meta)
        this.currentNodeId = project.script[0]?.id || null;
    }

    public getCurrentNode(): ScriptNode | undefined {
        if (!this.currentNodeId) return undefined;
        return this.project.script.find(n => n.id === this.currentNodeId);
    }

    public next(): ScriptNode | undefined {
        const currentNode = this.getCurrentNode();
        if (!currentNode) return undefined;

        // Simple linear progression for now
        if ('nextNodeId' in currentNode && currentNode.nextNodeId) {
            this.currentNodeId = currentNode.nextNodeId;
            return this.getCurrentNode();
        }

        return undefined;
    }

    public makeChoice(choice: Choice) {
        this.currentNodeId = choice.nextNodeId;
        // Handle variable setting here
    }

    public getCharacter(id: string) {
        return this.project.characters.find(c => c.id === id);
    }

    public getBackground(id: string) {
        return this.project.backgrounds.find(b => b.id === id);
    }
}
