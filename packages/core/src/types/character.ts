export interface Character {
    id: string;
    name: string;
    displayName: string;           // Display name (can include colors, etc.)
    description: string;           // Description for AI generation

    // 基础信息
    gender?: '男' | '女' | '其他' | 'male' | 'female' | 'other';
    age?: number | string;         // 年龄（可以是具体数字或"青年"等描述）
    identity?: string;             // 身份（如：学生、侦探、骑士等）

    // 外观特征
    appearance?: {
        hairStyle?: string;        // 发型（如：长发、短发、卷发等）
        clothing?: string;         // 服饰（如：校服、盔甲、西装等）
        facialFeatures?: string;   // 五官风格（如：温柔、锐利、稚嫩等）
        bodyType?: string;         // 体型（如：纤细、健壮、匀称等）
        height?: string;           // 身高描述
        otherFeatures?: string;    // 其他特征（如：眼镜、疤痕、配饰等）
    };

    // 性格属性
    personality?: {
        traits?: string[];         // 性格标签（如：['开朗', '勇敢', '好奇']）
        temperament?: string;      // 性情倾向（如：外向/内向、理性/感性）
        values?: string;           // 价值观（如：正义、自由、家庭等）
    };

    // 核心特质
    coreTraits?: {
        specialSkills?: string[];  // 特殊技能（如：['剑术', '魔法', '侦查']）
        obsession?: string;        // 执念/目标（如：寻找真相、保护家人）
        relationships?: Array<{    // 人际关系
            targetCharacterId?: string;
            targetCharacterName?: string;
            relation: string;      // 关系描述（如：好友、仇敌、恋人）
        }>;
        backstory?: string;        // 背景故事
    };

    // Sprites (立绘资源)
    sprites: CharacterSprite[];
    defaultSpriteId: string;
    
    // 新增：头像URL
    avatarUrl?: string;            // 角色头像图片URL

    // Attributes (optional, for advanced plot)
    attributes?: Record<string, number>;

    // Dialogue box style
    dialogueStyle?: {
        nameColor: string;
        boxStyle?: 'default' | 'thought' | 'shout';
    };
}

export interface CharacterSprite {
    id: string;
    emotion: EmotionType;
    imageUrl: string;
    // Prompt used for image generation (for regeneration)
    generationPrompt?: string;
}

export type EmotionType =
    | 'neutral'
    | 'happy'
    | 'sad'
    | 'angry'
    | 'surprised'
    | 'embarrassed'
    | 'thinking';
