/**
 * 通用表单自动填充服务
 * 
 * 支持所有表单类型的 AI 智能补全：
 * - character: 角色设定
 * - world: 世界观设定
 * - scene: 场景设定
 * - theme: 主题风格
 * - background: 背景设定
 */

import OpenAI from 'openai';

// 支持的表单类型
export type FormType = 'character' | 'world' | 'scene' | 'theme' | 'background';

// 表单字段 Schema
interface FormFieldSchema {
    key: string;
    label: string;
    type: 'string' | 'string[]' | 'object' | 'number';
    description?: string;
    required?: boolean;
    nested?: FormFieldSchema[];
}

// 表单 Schema 定义
interface FormSchema {
    type: FormType;
    title: string;
    description: string;
    fields: FormFieldSchema[];
    systemPrompt: string;
}

// 自动填充请求
export interface AutocompleteRequest {
    formType: FormType;
    partialData: Record<string, any>;
    context?: {
        projectTitle?: string;
        genre?: string;
        worldSetting?: string;
        existingItems?: string[];  // 已有的同类项目名称，用于差异化
    };
}

// 自动填充结果
export interface AutocompleteResult {
    success: boolean;
    data?: Record<string, any>;
    error?: string;
}

// 表单 Schema 定义库
const FORM_SCHEMAS: Record<FormType, FormSchema> = {
    character: {
        type: 'character',
        title: '角色设定',
        description: '视觉小说角色的详细设定',
        systemPrompt: `你是专业的视觉小说角色设计师。根据用户已填写的信息，补全剩余的角色设定字段。
要求：
1. 角色要有深度、立体、有冲突感
2. 外观描述要具体，便于 AI 生成图片
3. 性格要多面，避免脸谱化
4. 背景故事要简洁但有戏剧张力
5. 保持与已填内容的一致性`,
        fields: [
            { key: 'name', label: '角色姓名', type: 'string', required: true },
            { key: 'displayName', label: '显示名称', type: 'string', required: true },
            { key: 'description', label: '角色描述', type: 'string' },
            { key: 'gender', label: '性别', type: 'string', description: 'male/female/other' },
            { key: 'age', label: '年龄', type: 'string' },
            { key: 'identity', label: '身份/职业', type: 'string' },
            { key: 'appearance', label: '外观特征', type: 'object', nested: [
                { key: 'hairStyle', label: '发型', type: 'string' },
                { key: 'clothing', label: '服饰', type: 'string' },
                { key: 'facialFeatures', label: '五官风格', type: 'string' },
                { key: 'bodyType', label: '体型', type: 'string' },
                { key: 'otherFeatures', label: '其他特征', type: 'string' },
            ]},
            { key: 'personality', label: '性格属性', type: 'object', nested: [
                { key: 'traits', label: '性格标签', type: 'string[]' },
                { key: 'temperament', label: '性情倾向', type: 'string' },
                { key: 'values', label: '价值观', type: 'string' },
            ]},
            { key: 'coreTraits', label: '核心特质', type: 'object', nested: [
                { key: 'specialSkills', label: '特殊技能', type: 'string[]' },
                { key: 'obsession', label: '执念/目标', type: 'string' },
                { key: 'backstory', label: '背景故事', type: 'string' },
            ]},
        ],
    },

    world: {
        type: 'world',
        title: '世界观设定',
        description: '故事发生的世界背景设定',
        systemPrompt: `你是专业的世界观构建师。根据用户已填写的信息，补全剩余的世界观设定字段。
要求：
1. 世界观要有内在逻辑一致性
2. 设定要有足够的细节支撑故事发展
3. 社会结构和规则要清晰
4. 要有独特的世界观亮点
5. 保持与已填内容的一致性`,
        fields: [
            { key: 'name', label: '世界名称', type: 'string', required: true },
            { key: 'era', label: '时代背景', type: 'string', required: true },
            { key: 'location', label: '地域设定', type: 'string', required: true },
            { key: 'rules', label: '世界规则', type: 'string', description: '魔法、科技、超能力等特殊规则' },
            { key: 'socialStructure', label: '社会结构', type: 'string' },
            { key: 'keyLocations', label: '关键地点', type: 'string' },
            { key: 'history', label: '历史背景', type: 'string' },
            { key: 'conflicts', label: '主要矛盾', type: 'string' },
            { key: 'culture', label: '文化特色', type: 'string' },
        ],
    },

    scene: {
        type: 'scene',
        title: '场景设定',
        description: '故事中的具体场景',
        systemPrompt: `你是专业的场景设计师。根据用户已填写的信息，补全剩余的场景设定字段。
要求：
1. 场景描述要生动具体，便于 AI 生成背景图
2. 氛围描写要能烘托情绪
3. 场景要有功能性，服务于剧情
4. 注意光线、色调等视觉元素
5. 保持与世界观设定的一致性`,
        fields: [
            { key: 'name', label: '场景名称', type: 'string', required: true },
            { key: 'type', label: '场景类型', type: 'string', required: true, description: '如：室内、室外、校园、城市等' },
            { key: 'atmosphere', label: '氛围描述', type: 'string' },
            { key: 'timeOfDay', label: '时间段', type: 'string', description: '如：清晨、正午、黄昏、深夜' },
            { key: 'weather', label: '天气', type: 'string' },
            { key: 'lighting', label: '光线', type: 'string' },
            { key: 'keyElements', label: '关键元素', type: 'string', description: '场景中的重要物品或特征' },
            { key: 'emotionalTone', label: '情感基调', type: 'string' },
            { key: 'description', label: '详细描述', type: 'string' },
        ],
    },

    theme: {
        type: 'theme',
        title: '主题风格',
        description: '故事的主题和风格设定',
        systemPrompt: `你是专业的故事策划。根据用户已填写的信息，补全剩余的主题风格设定字段。
要求：
1. 主题要有深度和思考价值
2. 风格要统一且有辨识度
3. 核心情感要能引起共鸣
4. 叙事手法要服务于主题表达
5. 保持各项设定的协调一致`,
        fields: [
            { key: 'themes', label: '故事主题', type: 'string[]', required: true, description: '如：成长、救赎、爱情等' },
            { key: 'styles', label: '叙事风格', type: 'string[]', required: true, description: '如：轻松日常、悬疑推理等' },
            { key: 'tone', label: '整体基调', type: 'string' },
            { key: 'targetEmotion', label: '目标情感', type: 'string', description: '希望带给玩家的核心情感体验' },
            { key: 'pacing', label: '节奏感', type: 'string', description: '如：紧凑、舒缓、跌宕起伏' },
            { key: 'visualStyle', label: '视觉风格', type: 'string', description: '如：清新、阴郁、复古等' },
            { key: 'narrativeDevice', label: '叙事手法', type: 'string', description: '如：第一人称、多视角等' },
        ],
    },

    background: {
        type: 'background',
        title: '背景设定',
        description: '游戏背景图像设定',
        systemPrompt: `你是专业的视觉设计师。根据用户已填写的信息，补全剩余的背景设定字段。
要求：
1. 描述要便于 AI 图像生成
2. 注意构图、色调、光影
3. 背景要有层次感
4. 符合世界观和场景设定
5. 保持视觉风格一致性`,
        fields: [
            { key: 'name', label: '背景名称', type: 'string', required: true },
            { key: 'description', label: '背景描述', type: 'string' },
            { key: 'worldSetting', label: '世界设定', type: 'object', nested: [
                { key: 'era', label: '时代', type: 'string' },
                { key: 'location', label: '地点', type: 'string' },
            ]},
            { key: 'visualElements', label: '视觉元素', type: 'string' },
            { key: 'colorPalette', label: '色调', type: 'string' },
            { key: 'mood', label: '氛围', type: 'string' },
            { key: 'composition', label: '构图建议', type: 'string' },
        ],
    },
};

export class FormAutocomplete {
    private openai: OpenAI;

    constructor() {
        this.openai = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY,
            baseURL: process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1',
        });
    }

    /**
     * 通用表单自动填充
     */
    async autocomplete(request: AutocompleteRequest): Promise<AutocompleteResult> {
        const { formType, partialData, context } = request;
        
        const schema = FORM_SCHEMAS[formType];
        if (!schema) {
            return { success: false, error: `不支持的表单类型: ${formType}` };
        }

        console.log(`[FormAutocomplete] 开始自动填充: ${formType}`);

        // 分析已填写和未填写的字段
        const { filledFields, emptyFields } = this.analyzeFields(schema.fields, partialData);

        if (emptyFields.length === 0) {
            console.log('[FormAutocomplete] 所有字段已填写，无需补全');
            return { success: true, data: partialData };
        }

        // 构建 prompt
        const systemPrompt = this.buildSystemPrompt(schema, context);
        const userPrompt = this.buildUserPrompt(schema, filledFields, emptyFields, context);

        try {
            const response = await this.openai.chat.completions.create({
                model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userPrompt },
                ],
                temperature: 0.8,
                max_tokens: 2000,
            });

            const content = response.choices[0]?.message?.content;
            if (!content) {
                throw new Error('AI 返回内容为空');
            }

            console.log('[FormAutocomplete] AI 返回:', content.substring(0, 200) + '...');

            // 解析并合并数据
            const parsed = this.parseResponse(content);
            const merged = this.mergeData(partialData, parsed, schema.fields);

            console.log('[FormAutocomplete] 补全完成');
            return { success: true, data: merged };

        } catch (error) {
            console.error('[FormAutocomplete] 错误:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : '自动补全失败',
            };
        }
    }

    /**
     * 分析字段填写状态
     */
    private analyzeFields(
        fields: FormFieldSchema[],
        data: Record<string, any>,
        prefix = ''
    ): { filledFields: string[]; emptyFields: string[] } {
        const filledFields: string[] = [];
        const emptyFields: string[] = [];

        for (const field of fields) {
            const fullKey = prefix ? `${prefix}.${field.key}` : field.key;
            const value = prefix ? data[prefix.split('.')[0]]?.[field.key] : data[field.key];

            if (field.type === 'object' && field.nested) {
                // 递归处理嵌套对象
                const nested = this.analyzeFields(field.nested, data[field.key] || {}, '');
                filledFields.push(...nested.filledFields.map(k => `${fullKey}.${k}`));
                emptyFields.push(...nested.emptyFields.map(k => `${fullKey}.${k}`));
            } else if (field.type === 'string[]') {
                if (Array.isArray(value) && value.length > 0) {
                    filledFields.push(`${field.label}: ${value.join(', ')}`);
                } else {
                    emptyFields.push(`${field.label}(${fullKey}): 数组类型`);
                }
            } else {
                if (value !== undefined && value !== '' && value !== null) {
                    filledFields.push(`${field.label}: ${value}`);
                } else {
                    const desc = field.description ? ` - ${field.description}` : '';
                    emptyFields.push(`${field.label}(${fullKey})${desc}`);
                }
            }
        }

        return { filledFields, emptyFields };
    }

    /**
     * 构建系统 prompt
     */
    private buildSystemPrompt(schema: FormSchema, context?: AutocompleteRequest['context']): string {
        let prompt = schema.systemPrompt;

        if (context) {
            prompt += '\n\n上下文信息：';
            if (context.projectTitle) prompt += `\n- 项目名称: ${context.projectTitle}`;
            if (context.genre) prompt += `\n- 故事类型: ${context.genre}`;
            if (context.worldSetting) prompt += `\n- 世界观: ${context.worldSetting}`;
            if (context.existingItems?.length) {
                prompt += `\n- 已有${schema.title}: ${context.existingItems.join(', ')}（请设计有区分度的内容）`;
            }
        }

        prompt += '\n\n规则：\n1. 返回纯 JSON 格式，不要使用 markdown 代码块\n2. 只填写空缺字段，保持已填内容不变';

        return prompt;
    }

    /**
     * 构建用户 prompt
     */
    private buildUserPrompt(
        schema: FormSchema,
        filledFields: string[],
        emptyFields: string[],
        context?: AutocompleteRequest['context']
    ): string {
        const exampleJson = this.generateExampleJson(schema.fields);

        return `## ${schema.title}自动填充

### 用户已填写的内容：
${filledFields.length > 0 ? filledFields.join('\n') : '(用户尚未填写任何内容)'}

### 需要补全的字段：
${emptyFields.join('\n')}

### 返回格式示例：
${JSON.stringify(exampleJson, null, 2)}

请直接返回 JSON，不要使用代码块包裹：`;
    }

    /**
     * 生成示例 JSON
     */
    private generateExampleJson(fields: FormFieldSchema[]): Record<string, any> {
        const result: Record<string, any> = {};

        for (const field of fields) {
            if (field.type === 'object' && field.nested) {
                result[field.key] = this.generateExampleJson(field.nested);
            } else if (field.type === 'string[]') {
                result[field.key] = ['示例1', '示例2'];
            } else if (field.type === 'number') {
                result[field.key] = 0;
            } else {
                result[field.key] = `示例${field.label}`;
            }
        }

        return result;
    }

    /**
     * 解析 AI 响应
     */
    private parseResponse(content: string): Record<string, any> {
        try {
            return JSON.parse(content);
        } catch {
            // 尝试提取 JSON 块
            const jsonMatch = content.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                return JSON.parse(jsonMatch[0]);
            }
            throw new Error('无法解析 AI 返回的 JSON');
        }
    }

    /**
     * 合并数据（用户数据优先）
     */
    private mergeData(
        original: Record<string, any>,
        generated: Record<string, any>,
        fields: FormFieldSchema[]
    ): Record<string, any> {
        const result: Record<string, any> = { ...original };

        for (const field of fields) {
            if (field.type === 'object' && field.nested) {
                result[field.key] = this.mergeData(
                    original[field.key] || {},
                    generated[field.key] || {},
                    field.nested
                );
            } else if (field.type === 'string[]') {
                const origArr = original[field.key];
                if (Array.isArray(origArr) && origArr.length > 0) {
                    result[field.key] = origArr;
                } else {
                    result[field.key] = generated[field.key] || [];
                }
            } else {
                const origVal = original[field.key];
                if (origVal !== undefined && origVal !== '' && origVal !== null) {
                    result[field.key] = origVal;
                } else {
                    result[field.key] = generated[field.key];
                }
            }
        }

        return result;
    }

    /**
     * 获取支持的表单类型
     */
    static getSupportedFormTypes(): FormType[] {
        return Object.keys(FORM_SCHEMAS) as FormType[];
    }

    /**
     * 获取表单 Schema
     */
    static getFormSchema(formType: FormType): FormSchema | undefined {
        return FORM_SCHEMAS[formType];
    }
}


