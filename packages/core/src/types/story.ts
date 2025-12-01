/**
 * 新的故事节点数据结构 - 支持流程图式编辑
 * 
 * 核心概念:
 * - 节点 = 情节 (一个故事单元)
 * - 每个情节可包含:
 *   1. 场景信息 (发生在哪里)
 *   2. 多段对话 (角色交流)
 *   3. 旁白描述 (背景交代)
 *   4. 分支选择 (剧情分支)
 */

// 故事节点 (情节)
export interface StoryNode {
    id: string;
    type: 'scene' | 'branch' | 'ending';
    isStart?: boolean;                 // 是否为开头节点(绿色框)
    isEnding?: boolean;                // 是否为结尾节点(红色框)
    
    // 节点在流程图中的位置
    position: { x: number; y: number };
    
    // 情节信息
    title: string;                    // 情节标题 (如:"初次相遇")
    sceneName?: string;                // 所在场景 (如:"学校花园")
    backgroundId?: string;             // 关联的场景背景 ID
    
    // 视觉素材配置
    visualAssets?: {
        backgroundImageUrl?: string;   // 场景背景图URL
        characters?: Array<{           // 出场角色及立绘配置
            characterId: string;
            spriteUrl?: string;        // 立绘图片URL
            position?: { x: number; y: number }; // 在场景中的位置(百分比)
            scale?: number;            // 缩放比例(默认1.0)
        }>;
    };
    
    // 故事内容
    narration?: string;                // 旁白/背景交代
    dialogues: Dialogue[];             // 角色对话列表
    
    // 分支逻辑
    choices?: Choice[];                // 分支选项（仅branch类型有）
    nextNodeId?: string;               // 单线剧情的下一个节点（scene类型）
    
    // 元数据
    notes?: string;                    // 节点备注
    tags?: string[];                   // 标签（用于分类）
}

// 对话条目
export interface Dialogue {
    id: string;
    characterId: string;               // 说话的角色ID
    text: string;                      // 对话内容
    emotion?: EmotionType;             // 角色表情
}

// 分支选项
export interface Choice {
    id: string;
    text: string;                      // 选项文本
    targetNodeId: string;              // 指向的目标节点ID
    condition?: string;                // 触发条件描述（可选）
}

// 表情类型
export type EmotionType =
    | 'neutral'
    | 'happy'
    | 'sad'
    | 'angry'
    | 'surprised'
    | 'embarrassed'
    | 'thinking';

// 连接线（用于流程图展示）
export interface StoryConnection {
    id: string;
    sourceNodeId: string;
    targetNodeId: string;
    label?: string;                    // 连接线上的标签（如选项文本）
    type: 'normal' | 'choice';         // 连接类型
}
