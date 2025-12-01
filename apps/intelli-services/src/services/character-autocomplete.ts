/**
 * 角色信息AI自动补全服务
 * 基于已填写的字段，使用LLM自动补全剩余字段
 */

import OpenAI from 'openai';

interface CharacterFormData {
    name?: string;
    displayName?: string;
    description?: string;
    gender?: string;
    age?: string;
    identity?: string;
    appearance?: {
        hairStyle?: string;
        clothing?: string;
        facialFeatures?: string;
        bodyType?: string;
        height?: string;
        otherFeatures?: string;
    };
    personality?: {
        traits?: string[];
        temperament?: string;
        values?: string;
    };
    coreTraits?: {
        specialSkills?: string[];
        obsession?: string;
        backstory?: string;
    };
}

interface AutocompleteResult {
    success: boolean;
    data?: CharacterFormData;
    error?: string;
}

export class CharacterAutocomplete {
    private openai: OpenAI;
    private modelName: string;
    constructor() {
        this.openai = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY,
            baseURL: process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1',
        });
        this.modelName = process.env.OPENAI_MODEL_NAME || 'gpt-4-turbo';
    }

    /**
     * 根据已填写的字段自动补全角色信息
     * @param partialData 用户已填写的部分数据
     * @param context 额外上下文（如故事类型、世界观等）
     */
    async autocomplete(
        partialData: CharacterFormData,
        context?: {
            storyGenre?: string;
            worldSetting?: string;
            existingCharacters?: string[];
        }
    ): Promise<AutocompleteResult> {
        console.log('[CharacterAutocomplete] 开始自动补全角色信息');
        console.log('[CharacterAutocomplete] 已有数据:', JSON.stringify(partialData, null, 2));

        // 构建已填写字段的描述
        const filledFields: string[] = [];
        const emptyFields: string[] = [];

        // 基础信息
        if (partialData.name) filledFields.push(`姓名: ${partialData.name}`);
        else emptyFields.push('姓名(name)');
        
        if (partialData.displayName) filledFields.push(`显示名称: ${partialData.displayName}`);
        else emptyFields.push('显示名称(displayName)');
        
        if (partialData.description) filledFields.push(`描述: ${partialData.description}`);
        else emptyFields.push('角色描述(description)');
        
        if (partialData.gender) filledFields.push(`性别: ${partialData.gender}`);
        else emptyFields.push('性别(gender: male/female/other)');
        
        if (partialData.age) filledFields.push(`年龄: ${partialData.age}`);
        else emptyFields.push('年龄(age)');
        
        if (partialData.identity) filledFields.push(`身份: ${partialData.identity}`);
        else emptyFields.push('身份/职业(identity)');

        // 外观
        if (partialData.appearance?.hairStyle) filledFields.push(`发型: ${partialData.appearance.hairStyle}`);
        else emptyFields.push('发型(appearance.hairStyle)');
        
        if (partialData.appearance?.clothing) filledFields.push(`服饰: ${partialData.appearance.clothing}`);
        else emptyFields.push('服饰(appearance.clothing)');
        
        if (partialData.appearance?.facialFeatures) filledFields.push(`五官: ${partialData.appearance.facialFeatures}`);
        else emptyFields.push('五官风格(appearance.facialFeatures)');
        
        if (partialData.appearance?.bodyType) filledFields.push(`体型: ${partialData.appearance.bodyType}`);
        else emptyFields.push('体型(appearance.bodyType)');
        
        if (partialData.appearance?.otherFeatures) filledFields.push(`其他特征: ${partialData.appearance.otherFeatures}`);
        else emptyFields.push('其他特征(appearance.otherFeatures)');

        // 性格
        if (partialData.personality?.traits?.length) filledFields.push(`性格标签: ${partialData.personality.traits.join(', ')}`);
        else emptyFields.push('性格标签数组(personality.traits)');
        
        if (partialData.personality?.temperament) filledFields.push(`性情: ${partialData.personality.temperament}`);
        else emptyFields.push('性情倾向(personality.temperament)');
        
        if (partialData.personality?.values) filledFields.push(`价值观: ${partialData.personality.values}`);
        else emptyFields.push('价值观(personality.values)');

        // 核心特质
        if (partialData.coreTraits?.specialSkills?.length) filledFields.push(`技能: ${partialData.coreTraits.specialSkills.join(', ')}`);
        else emptyFields.push('特殊技能数组(coreTraits.specialSkills)');
        
        if (partialData.coreTraits?.obsession) filledFields.push(`执念: ${partialData.coreTraits.obsession}`);
        else emptyFields.push('执念/目标(coreTraits.obsession)');
        
        if (partialData.coreTraits?.backstory) filledFields.push(`背景: ${partialData.coreTraits.backstory}`);
        else emptyFields.push('背景故事(coreTraits.backstory)');

        // 如果没有需要补全的字段
        if (emptyFields.length === 0) {
            console.log('[CharacterAutocomplete] 所有字段已填写，无需补全');
            return { success: true, data: partialData };
        }

        // 构建 prompt
        const systemPrompt = `你是一个专业的视觉小说角色设计师。用户正在创建一个小说角色，已经填写了部分信息，需要你帮助补全剩余字段。

规则：
1. 根据已填写的信息推断角色特点，保持一致性
2. 生成有趣、立体、有深度的角色设定
3. 外观描述要具体，方便后续AI生成图片
4. 性格要多面，不要过于单一
5. 背景故事要简洁但有冲突感
6. 返回纯JSON格式，不要添加markdown代码块

${context?.storyGenre ? `故事类型: ${context.storyGenre}` : ''}
${context?.worldSetting ? `世界观: ${context.worldSetting}` : ''}
${context?.existingCharacters?.length ? `已有角色: ${context.existingCharacters.join(', ')}（请设计有区分度的角色）` : ''}`;

        const userPrompt = `用户已填写的角色信息：
${filledFields.length > 0 ? filledFields.join('\n') : '(用户尚未填写任何信息)'}

请补全以下空缺字段，并返回完整的角色JSON数据：
${emptyFields.join('\n')}

返回格式示例：
{
  "name": "张三",
  "displayName": "神秘剑客",
  "description": "一位沉默寡言的剑客...",
  "gender": "male",
  "age": "25",
  "identity": "流浪剑客",
  "appearance": {
    "hairStyle": "黑色长发，高马尾",
    "clothing": "深蓝色剑士服，黑色披风",
    "facialFeatures": "锐利的眼神，剑眉",
    "bodyType": "修长健壮",
    "otherFeatures": "左手有一道旧伤疤"
  },
  "personality": {
    "traits": ["沉稳", "正义", "孤傲"],
    "temperament": "内向但有强烈的正义感",
    "values": "守护弱者，追求公义"
  },
  "coreTraits": {
    "specialSkills": ["剑术", "轻功"],
    "obsession": "寻找杀害师父的凶手",
    "backstory": "自幼被师父收养..."
  }
}

请直接返回JSON，不要使用代码块包裹：`;

        try {
            const response = await this.openai.chat.completions.create({
                model: this.modelName,
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userPrompt },
                ],
                temperature: 0.8,
                max_tokens: 4000,
            });

            const content = response.choices[0]?.message?.content;
            if (!content) {
                throw new Error('AI返回内容为空');
            }

            console.log('[CharacterAutocomplete] AI返回:', content);

            // 解析 JSON
            let parsed: CharacterFormData;
            try {
                // 尝试直接解析
                parsed = JSON.parse(content);
            } catch {
                // 尝试提取 JSON 块
                const jsonMatch = content.match(/\{[\s\S]*\}/);
                if (jsonMatch) {
                    parsed = JSON.parse(jsonMatch[0]);
                } else {
                    throw new Error('无法解析AI返回的JSON');
                }
            }

            // 合并用户已填写的数据（用户数据优先）
            const merged: CharacterFormData = {
                name: partialData.name || parsed.name,
                displayName: partialData.displayName || parsed.displayName,
                description: partialData.description || parsed.description,
                gender: partialData.gender || parsed.gender,
                age: partialData.age || parsed.age,
                identity: partialData.identity || parsed.identity,
                appearance: {
                    hairStyle: partialData.appearance?.hairStyle || parsed.appearance?.hairStyle,
                    clothing: partialData.appearance?.clothing || parsed.appearance?.clothing,
                    facialFeatures: partialData.appearance?.facialFeatures || parsed.appearance?.facialFeatures,
                    bodyType: partialData.appearance?.bodyType || parsed.appearance?.bodyType,
                    height: partialData.appearance?.height || parsed.appearance?.height,
                    otherFeatures: partialData.appearance?.otherFeatures || parsed.appearance?.otherFeatures,
                },
                personality: {
                    traits: partialData.personality?.traits?.length ? partialData.personality.traits : parsed.personality?.traits,
                    temperament: partialData.personality?.temperament || parsed.personality?.temperament,
                    values: partialData.personality?.values || parsed.personality?.values,
                },
                coreTraits: {
                    specialSkills: partialData.coreTraits?.specialSkills?.length ? partialData.coreTraits.specialSkills : parsed.coreTraits?.specialSkills,
                    obsession: partialData.coreTraits?.obsession || parsed.coreTraits?.obsession,
                    backstory: partialData.coreTraits?.backstory || parsed.coreTraits?.backstory,
                },
            };

            console.log('[CharacterAutocomplete] 补全完成');
            return { success: true, data: merged };

        } catch (error) {
            console.error('[CharacterAutocomplete] 错误:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : '自动补全失败',
            };
        }
    }
}

