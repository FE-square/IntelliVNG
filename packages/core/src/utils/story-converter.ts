/**
 * 将旧的 ScriptNode[] 转换为新的 StoryNode[] 格式
 * 用于在不修改后端的情况下支持流程图编辑
 */

import type { ScriptNode } from '../types/script';
import type { StoryNode, Dialogue as StoryDialogue, Choice as StoryChoice } from '../types/story';
import { createId } from './id';

export function convertScriptToStoryNodes(script: ScriptNode[]): StoryNode[] {
    const storyNodes: StoryNode[] = [];
    const nodeMap = new Map<string, ScriptNode>();
    
    // 建立节点映射
    script.forEach(node => {
        nodeMap.set(node.id, node);
    });

    // 按顺序处理节点，每 3-5 个对话节点合并为一个场景
    let i = 0;
    let nodeIndex = 0;
    
    while (i < script.length) {
        const dialoguesPerScene = 3 + Math.floor(Math.random() * 3); // 3-5个对话
        const sceneDialogues: StoryDialogue[] = [];
        let currentBg: string | undefined;
        
        // 收集对话
        for (let j = 0; j < dialoguesPerScene && i < script.length; j++, i++) {
            const node = script[i];
            
            if (node.type === 'dialogue') {
                sceneDialogues.push({
                    id: createId(),
                    characterId: node.characterId || '',
                    text: node.text || '',
                });
            } else if (node.type === 'scene-change') {
                currentBg = node.backgroundId;
            } else if (node.type === 'choice') {
                // 遇到选择节点，创建分支节点
                const choices: StoryChoice[] = node.choices?.map(c => ({
                    id: createId(),
                    text: c.text,
                    targetNodeId: c.nextNodeId,
                })) || [];
                
                const branchNode: StoryNode = {
                    id: createId(),
                    type: 'branch',
                    position: {
                        x: 100 + (nodeIndex % 3) * 400,
                        y: 100 + Math.floor(nodeIndex / 3) * 300,
                    },
                    title: `分支选择 ${nodeIndex + 1}`,
                    narration: node.prompt,
                    dialogues: sceneDialogues,
                    choices,
                };
                
                storyNodes.push(branchNode);
                nodeIndex++;
                sceneDialogues.length = 0; // 清空对话
                continue;
            }
        }
        
        // 创建场景节点
        if (sceneDialogues.length > 0) {
            const nextNodeId = i < script.length ? script[i].id : undefined;
            
            const sceneNode: StoryNode = {
                id: createId(),
                type: i >= script.length - 1 ? 'ending' : 'scene',
                position: {
                    x: 100 + (nodeIndex % 3) * 400,
                    y: 100 + Math.floor(nodeIndex / 3) * 300,
                },
                title: `场景 ${nodeIndex + 1}`,
                backgroundId: currentBg,
                dialogues: sceneDialogues,
                nextNodeId: i >= script.length - 1 ? undefined : 'next',
            };
            
            storyNodes.push(sceneNode);
            nodeIndex++;
        }
    }
    
    // 连接节点（为 scene 类型的节点设置 nextNodeId）
    for (let i = 0; i < storyNodes.length - 1; i++) {
        if (storyNodes[i].type === 'scene' && storyNodes[i].nextNodeId === 'next') {
            storyNodes[i].nextNodeId = storyNodes[i + 1].id;
        }
    }
    
    // 清理最后一个节点的 nextNodeId
    if (storyNodes.length > 0) {
        const lastNode = storyNodes[storyNodes.length - 1];
        if (lastNode.type === 'scene') {
            lastNode.type = 'ending';
            lastNode.nextNodeId = undefined;
        }
    }

    return storyNodes;
}

/**
 * 将 StoryNode[] 转换回 ScriptNode[] 格式
 * 用于保存时兼容旧格式
 */
export function convertStoryNodesToScript(storyNodes: StoryNode[]): ScriptNode[] {
    const script: ScriptNode[] = [];
    
    storyNodes.forEach(node => {
        // 添加对话节点
        node.dialogues.forEach((dialogue, index) => {
            const scriptNode: ScriptNode = {
                id: dialogue.id,
                type: 'dialogue',
                position: node.position,
                characterId: dialogue.characterId,
                text: dialogue.text,
                nextNodeId: null,
            } as any;
            
            // 链接前一个节点
            if (script.length > 0) {
                (script[script.length - 1] as any).nextNodeId = scriptNode.id;
            }
            
            script.push(scriptNode);
        });
        
        // 如果是分支节点，添加选择节点
        if (node.type === 'branch' && node.choices) {
            const choiceNode: ScriptNode = {
                id: createId(),
                type: 'choice',
                position: node.position,
                prompt: node.narration,
                choices: node.choices.map(c => ({
                    id: c.id,
                    text: c.text,
                    nextNodeId: c.targetNodeId,
                })),
            } as any;
            
            if (script.length > 0) {
                (script[script.length - 1] as any).nextNodeId = choiceNode.id;
            }
            
            script.push(choiceNode);
        }
    });

    return script;
}
