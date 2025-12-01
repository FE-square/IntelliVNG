import { GameProject, Choice, StoryNode } from '@vng/core';

export class GameEngine {
    private project: GameProject;
    private currentNodeId: string | null = null;
    private currentDialogueIndex: number = 0; // 当前对话索引
    private variables: Record<string, any> = {};

    constructor(project: GameProject, startNodeId?: string) {
        this.project = project;
        // ✅ 如果指定了 startNodeId, 使用它; 否则查找开始节点
        if (startNodeId) {
            this.currentNodeId = startNodeId;
        } else {
            const startNode = (project.script as any[]).find((n: any) => n.isStart);
            this.currentNodeId = startNode?.id || project.script[0]?.id || null;
        }
    }

    public getCurrentNode(): StoryNode | undefined {
        if (!this.currentNodeId) return undefined;
        return this.project.script.find(n => n.id === this.currentNodeId) as unknown as StoryNode;
    }

    public getCurrentDialogueIndex(): number {
        return this.currentDialogueIndex;
    }

    public next(): StoryNode | undefined {
        const currentNode = this.getCurrentNode();
        if (!currentNode) return undefined;

        // 如果当前节点有多段对话,先播放完所有对话
        if (currentNode.dialogues && this.currentDialogueIndex < currentNode.dialogues.length - 1) {
            this.currentDialogueIndex++;
            return currentNode;
        }

        // ✅ 对话播放完毕,如果是分支节点,留在当前节点等待选择
        const nodeType = (currentNode as any)?.type;
        const isBranchNode = nodeType === 'branch' || nodeType === 'choice';
        if (isBranchNode && currentNode.choices && currentNode.choices.length > 0) {
            // ✅ 分支节点,不移动,但要确保dialogueIndex超出范围(这样currentDialogue才为undefined)
            this.currentDialogueIndex = (currentNode.dialogues?.length || 0);
            return currentNode;
        }
        
        // 普通节点,前往下一个节点
        this.currentDialogueIndex = 0;
        
        if (currentNode.nextNodeId) {
            this.currentNodeId = currentNode.nextNodeId;
            return this.getCurrentNode();
        }

        return undefined;
    }

    public makeChoice(choice: Choice) {
        this.currentNodeId = choice.targetNodeId;
        this.currentDialogueIndex = 0;
    }

    public getCharacter(id: string) {
        return this.project.characters.find(c => c.id === id);
    }

    public getBackground(id: string) {
        return this.project.backgrounds.find(b => b.id === id);
    }
}
