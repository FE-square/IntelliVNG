export interface Background {
    id: string;
    name: string;
    description: string;           // Description for AI generation
    imageUrl: string;

    // 世界观基础
    worldSetting?: {
        era?: '古代' | '现代' | '未来' | '科幻' | '奇幻' | '其他'; // 时代背景
        location?: '城市' | '乡村' | '异世界' | '宇宙' | '海洋' | '其他'; // 地域设定
        rules?: string;            // 社会规则（如：魔法存在、科技水平、阶级制度等）
        specialElements?: string[]; // 特殊元素（如：['魔法', '机甲', '超能力']）
    };

    // 场景细节
    sceneDetails?: {
        type?: '室内' | '室外' | '半开放';  // 场景类型
        specificLocation?: string;  // 具体场景（如：教室、城堡、太空舱、咸鱼家）
        atmosphere?: string;        // 环境氛围（如：温馨、诡异、紧张、愉悦）
        timeOfDay?: '清晨' | '上午' | '下午' | '黄昏' | '晚上' | '深夜'; // 时间段
        weather?: string;           // 天气情况（如：晴朗、下雨、下雪）
        lighting?: string;          // 光线效果（如：明亮、暗淡、烛光）
    };

    // Scene variants (e.g., day/night)
    variants?: BackgroundVariant[];

    generationPrompt?: string;
}

export interface BackgroundVariant {
    id: string;
    name: string;                  // e.g., "night", "sunset"
    imageUrl: string;
}
