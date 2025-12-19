import OpenAI from 'openai';
import { z } from 'zod';
import type { Character, Scene, ThemeSetting, WorldSetting } from '@vng/core';
import { promptManager } from '../prompts';
import { DEFAULT_LOCALE, type Locale } from '../utils/locale';
import { extractAndValidateJson } from '../utils/structured-output-helper';
import { hasLLMProfile, isRecoverableLLMError, resolveLLMConfig, type LLMProfile } from '../utils/llm-config';
import { tokenTracker } from './token-tracker';

const createId = () => Math.random().toString(36).substring(2, 12);

const CharacterSchema = z.object({
  id: z.string().optional(),
  name: z.string(),
  displayName: z.string().optional(),
  gender: z.string().optional(),
  age: z.union([z.string(), z.number()]).optional(),
  identity: z.string().optional(),
  description: z.string().optional(),
  appearance: z.object({
    hairStyle: z.string().optional(),
    clothing: z.string().optional(),
    facialFeatures: z.string().optional(),
    bodyType: z.string().optional(),
    height: z.string().optional(),
    otherFeatures: z.string().optional(),
  }).partial().optional(),
  personality: z.object({
    traits: z.array(z.string()).optional(),
    temperament: z.string().optional(),
    values: z.string().optional(),
  }).partial().optional(),
  coreTraits: z.object({
    specialSkills: z.array(z.string()).optional(),
    obsession: z.string().optional(),
    relationships: z.array(z.object({
      targetCharacterId: z.string().optional(),
      targetCharacterName: z.string().optional(),
      relation: z.string(),
    })).optional(),
    backstory: z.string().optional(),
  }).partial().optional(),
});

const SceneSchema = z.object({
  id: z.string().optional(),
  name: z.string(),
  type: z.string().optional(),
  atmosphere: z.string().optional(),
  details: z.string().optional(),
  function: z.string().optional(),
  imageUrl: z.string().optional(),
  description: z.string().optional(),
});

const WorldSettingSchema = z.object({
  id: z.string().optional(),
  name: z.string(),
  era: z.string(),
  location: z.string(),
  rules: z.string().optional(),
  socialStructure: z.string().optional(),
  history: z.string().optional(),
  description: z.string().optional(),
});

const ThemeSettingSchema = z.object({
  id: z.string().optional(),
  themes: z.array(z.string()).min(1),
  styles: z.array(z.string()).min(1),
  tone: z.string().optional(),
  description: z.string().optional(),
});

const IdeaDraftSchema = z.object({
  projectTitle: z.string(),
  hook: z.string().optional(),
  summary: z.string(),
  creativeDirection: z.string().optional(),
  worldSetting: WorldSettingSchema,
  themeSetting: ThemeSettingSchema,
  characters: z.array(CharacterSchema).min(2),
  scenes: z.array(SceneSchema).min(3),
});

type RawIdeaDraft = z.infer<typeof IdeaDraftSchema>;

const ALLOWED_GENDERS: Array<Character['gender']> = ['男', '女', '其他', 'male', 'female', 'other'];

function normalizeGender(value?: string): Character['gender'] {
  if (!value) return undefined;
  return ALLOWED_GENDERS.includes(value as Character['gender']) ? (value as Character['gender']) : undefined;
}

export interface IdeaDraftResult {
  projectTitle: string;
  summary: string;
  hook?: string;
  creativeDirection?: string;
  worldSetting: WorldSetting;
  themeSetting: ThemeSetting;
  characters: Character[];
  scenes: Scene[];
}

/**
 * 流式生成事件类型
 */
export interface DraftStreamEvent {
  event: 'thinking' | 'content' | 'result' | 'error';
  data: any;
}

export class IdeaDraftGenerator {
  private readonly maxAttempts = Number(process.env.IDEA_DRAFT_MAX_ATTEMPTS || 2);

  async generateDraft(idea: string, locale: Locale = DEFAULT_LOCALE): Promise<IdeaDraftResult> {
    if (!idea?.trim()) {
      throw new Error('idea is required');
    }

    let lastError: unknown = null;
    for (let attempt = 1; attempt <= this.maxAttempts; attempt++) {
      try {
        if (attempt > 1) {
          console.log(`[IdeaDraftGenerator] 第 ${attempt}/${this.maxAttempts} 次重试...`);
        }
        return await this.tryGenerateDraft(idea, locale, 'primary', true);
      } catch (error) {
        lastError = error;
        console.warn(`[IdeaDraftGenerator] 生成草稿失败 (attempt ${attempt}/${this.maxAttempts}):`, error instanceof Error ? error.message : error);
        if (attempt === this.maxAttempts) {
          break;
        }
      }
    }

    throw lastError instanceof Error ? lastError : new Error('Idea draft generation failed');
  }

  /**
   * 流式生成草稿，实时推送 thinking 内容
   * 
   * @param idea 用户输入的故事创意
   * @param locale 用户语言
   * @param onEvent 事件回调函数，用于接收流式事件
   */
  async generateDraftStream(
    idea: string,
    locale: Locale = DEFAULT_LOCALE,
    onEvent: (event: DraftStreamEvent) => void
  ): Promise<IdeaDraftResult> {
    if (!idea?.trim()) {
      throw new Error('idea is required');
    }

    const config = resolveLLMConfig('primary');
    console.log(`[IdeaDraftGenerator] (streaming) Generating draft via ${config.modelName}`);

    const client = new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseURL,
    });

    const { system, user } = promptManager.build('game-generator.idea-to-draft', { idea }, locale);

    try {
      // 检查模型是否支持深度思考（Qwen 模型）
      const isQwenModel = config.modelName.toLowerCase().includes('qwen');
      
      console.log(`[IdeaDraftGenerator] (streaming) 模型: ${config.modelName}, 启用思考模式: ${isQwenModel}`);
      
      // 使用流式API
      // 参考：https://help.aliyun.com/zh/model-studio/deep-thinking
      // enable_thinking 非 OpenAI 标准参数，需要通过额外参数传入
      const requestBody: any = {
        model: config.modelName,
        messages: [
          ...(system ? [{ role: 'system' as const, content: system }] : []),
          { role: 'user' as const, content: user },
        ],
        temperature: 0.7,
        max_tokens: 4096,
        stream: true, // 启用流式输出
        // 启用流式返回的最后一个数据包包含Token消耗信息
        stream_options: {
          include_usage: true,
        },
      };
      
      // 对于 Qwen 模型，启用深度思考模式
      // 参考文档：https://help.aliyun.com/zh/model-studio/deep-thinking
      if (isQwenModel) {
        requestBody.enable_thinking = true;
        console.log('[IdeaDraftGenerator] 已启用 Qwen 深度思考模式 (enable_thinking: true)');
      }
      
      // 强制使用 stream 类型，因为 enable_thinking 是非标准参数
      const stream = await client.chat.completions.create(requestBody) as unknown as AsyncIterable<any>;

      let fullContent = '';
      let thinkingContent = '';
      let isInThinking = false;
      let usageInfo: any = null;

      // 处理流式响应
      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta;
        
        // 保存 usage 信息（在最后一个 chunk 中）
        if ((chunk as any).usage) {
          usageInfo = (chunk as any).usage;
        }
        
        // 检查 Qwen 的 reasoning_content（思考过程）
        // 参考文档：思考内容通过 reasoning_content 字段返回
        const reasoningDelta = (delta as any)?.reasoning_content;
        if (reasoningDelta) {
          thinkingContent += reasoningDelta;
          onEvent({
            event: 'thinking',
            data: { content: reasoningDelta, full: thinkingContent },
          });
          isInThinking = true;
        }

        // 检查常规 content（回复内容通过 content 字段返回）
        if (delta?.content) {
          // 如果之前在 thinking 阶段，现在切换到 content 阶段
          if (isInThinking) {
            isInThinking = false;
            console.log('\n[IdeaDraftGenerator] 思考完成，开始生成草稿...');
            onEvent({
              event: 'content',
              data: { message: '思考完成，正在生成设定草稿...' },
            });
          }
          fullContent += delta.content;
        }
      }
      
      // 如果有思考内容，输出换行
      if (thinkingContent) {
        console.log(`\n[IdeaDraftGenerator] 思考内容总长度: ${thinkingContent.length} 字符`);
      }

      // 如果没有收到任何 content
      if (!fullContent) {
        throw new Error('Idea draft generator did not return any content');
      }

      // 追踪 Token 使用
      if (usageInfo) {
        // 使用实际的 usage 信息
        tokenTracker.track({
          source: 'openai-sdk',
          model: config.modelName,
          operation: 'idea-to-draft-stream',
          usage: {
            promptTokens: usageInfo.prompt_tokens || 0,
            completionTokens: usageInfo.completion_tokens || 0,
            totalTokens: usageInfo.total_tokens || 0,
          },
          metadata: { locale, streaming: true, hasThinking: thinkingContent.length > 0 },
        });
      } else {
        // 回退到估算
        const estimatedTokens = Math.ceil((fullContent.length + thinkingContent.length) / 2);
        tokenTracker.track({
          source: 'openai-sdk',
          model: config.modelName,
          operation: 'idea-to-draft-stream',
          usage: {
            promptTokens: Math.ceil(user.length / 4),
            completionTokens: estimatedTokens,
            totalTokens: Math.ceil(user.length / 4) + estimatedTokens,
          },
          metadata: { locale, streaming: true, estimated: true },
        });
      }

      // 解析最终结果
      const parsed = extractAndValidateJson(fullContent, IdeaDraftSchema);
      const result = this.normalizeDraft(parsed);
      
      onEvent({
        event: 'result',
        data: { success: true, draft: result },
      });

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('[IdeaDraftGenerator] (streaming) 调用失败:', errorMessage);
      
      onEvent({
        event: 'error',
        data: { error: errorMessage },
      });

      throw error;
    }
  }

  private async tryGenerateDraft(
    idea: string,
    locale: Locale,
    profile: LLMProfile,
    allowFallback: boolean
  ): Promise<IdeaDraftResult> {
    const config = resolveLLMConfig(profile);
    console.log(`[IdeaDraftGenerator] (${profile}) Generating draft via ${config.modelName}`);

    const client = new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseURL,
    });

    const { system, user } = promptManager.build('game-generator.idea-to-draft', { idea }, locale);

    let rawResponse: string | undefined;
    try {
      const response = await client.chat.completions.create({
        model: config.modelName,
        messages: [
          ...(system ? [{ role: 'system' as const, content: system }] : []),
          { role: 'user' as const, content: user },
        ],
        temperature: 0.7,
        max_tokens: 4096,
      });

      // 追踪 Token 使用
      if (response.usage) {
        tokenTracker.track({
          source: 'openai-sdk',
          model: config.modelName,
          operation: 'idea-to-draft',
          usage: {
            promptTokens: response.usage.prompt_tokens || 0,
            completionTokens: response.usage.completion_tokens || 0,
            totalTokens: response.usage.total_tokens || 0,
          },
          metadata: { profile, locale },
        });
      }

      const choice = response.choices[0];
      const content = choice?.message?.content;
      rawResponse = content ?? undefined;

      if (!content) {
        throw new Error('Idea draft generator did not return any content');
      }

      const parsed = extractAndValidateJson(content, IdeaDraftSchema);
      return this.normalizeDraft(parsed);
    } catch (error) {
      if (typeof rawResponse === 'string') {
        const preview = rawResponse.slice(0, 4000);
        const base64 = Buffer.from(rawResponse, 'utf8').toString('base64');
        console.error(`[IdeaDraftGenerator] (${profile}) 原始响应预览(前4k):\n${preview}`);
        // 避免打印过长的base64字符串，只显示长度
        console.error(`[IdeaDraftGenerator] (${profile}) 原始响应Base64长度: ${base64.length} 字符`);
      }
      console.error(`[IdeaDraftGenerator] (${profile}) 调用失败:`, error instanceof Error ? error.message : error);
      if (allowFallback && profile === 'primary' && hasLLMProfile('backup') && isRecoverableLLMError(error)) {
        console.warn('[IdeaDraftGenerator] 主模型不可用，尝试备用模型...');
        return this.tryGenerateDraft(idea, locale, 'backup', false);
      }
      throw error instanceof Error ? error : new Error('Idea draft generation failed');
    }
  }

  private normalizeDraft(raw: RawIdeaDraft): IdeaDraftResult {
    const ensureId = (prefix: string) => `${prefix}_${createId()}`;

    const worldSetting: WorldSetting = {
      id: raw.worldSetting.id?.trim() || ensureId('world'),
      name: raw.worldSetting.name || '未命名世界',
      era: raw.worldSetting.era || '现代',
      location: raw.worldSetting.location || '未知地点',
      rules: raw.worldSetting.rules,
      socialStructure: raw.worldSetting.socialStructure,
      history: raw.worldSetting.history,
      description: raw.worldSetting.description,
    };

    const themeSetting: ThemeSetting = {
      id: raw.themeSetting.id?.trim() || ensureId('theme'),
      themes: raw.themeSetting.themes?.length ? raw.themeSetting.themes : ['情感羁绊'],
      styles: raw.themeSetting.styles?.length ? raw.themeSetting.styles : ['剧情向'],
      tone: raw.themeSetting.tone,
      description: raw.themeSetting.description,
    };

    const characters: Character[] = raw.characters.map((character, index) => {
      const id = character.id?.trim() || ensureId(`char${index + 1}`);
      const defaultSpriteId = (character as any).defaultSpriteId || `${id}-default`;

      return {
        id,
        name: character.name.trim(),
        displayName: character.displayName?.trim() || character.name.trim(),
        description: character.description?.trim() || `${character.name}的角色描述`,
        gender: normalizeGender(character.gender),
        age: character.age,
        identity: character.identity,
        appearance: character.appearance,
        personality: character.personality,
        coreTraits: character.coreTraits,
        sprites: (character as any).sprites?.length ? (character as any).sprites : [],
        defaultSpriteId,
        avatarUrl: (character as any).avatarUrl,
        attributes: (character as any).attributes,
        dialogueStyle: (character as any).dialogueStyle,
      };
    });

    const scenes: Scene[] = raw.scenes.map((scene, index) => ({
      id: scene.id?.trim() || ensureId(`scene${index + 1}`),
      name: scene.name,
      type: scene.type || 'location',
      atmosphere: scene.atmosphere || 'balanced',
      details: scene.details,
      function: scene.function,
      imageUrl: scene.imageUrl,
      description: scene.description,
    }));

    return {
      projectTitle: raw.projectTitle,
      summary: raw.summary,
      hook: raw.hook,
      creativeDirection: raw.creativeDirection,
      worldSetting,
      themeSetting,
      characters,
      scenes,
    };
  }
}

export const ideaDraftGenerator = new IdeaDraftGenerator();

