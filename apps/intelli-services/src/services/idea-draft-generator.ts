import OpenAI from 'openai';
import { z } from 'zod';
import type { Character, Scene, ThemeSetting, WorldSetting } from '@vng/core';
import { promptManager } from '../prompts';
import { DEFAULT_LOCALE, type Locale } from '../utils/locale';
import { extractAndValidateJson } from '../utils/structured-output-helper';
import { hasLLMProfile, isRecoverableLLMError, resolveLLMConfig, type LLMProfile } from '../utils/llm-config';

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
        console.error(`[IdeaDraftGenerator] (${profile}) 原始响应Base64:\n${base64}`);
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

