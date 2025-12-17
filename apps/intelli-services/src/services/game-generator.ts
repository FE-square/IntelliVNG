import OpenAI from 'openai';
import { type Locale, DEFAULT_LOCALE } from '../utils/locale';
import { promptManager } from '../prompts';
import { tokenTracker } from './token-tracker';

// Types - 统一使用 StoryNode 格式（与 @vng/core 保持一致）
interface GameProject {
    id: string;
    title: string;
    description: string;
    coverImage?: string;
    createdAt: string;
    updatedAt: string;
    meta: {
        author: string;
        version: string;
        genre: string;
        artStyle: string;
    };
    characters: Character[];
    backgrounds: Background[];
    script: StoryNode[];  // 统一使用 StoryNode
    settings: {
        textSpeed: number;
        autoPlayDelay: number;
        defaultTransition: string;
    };
}

interface Character {
    id: string;
    name: string;
    displayName: string;
    description: string;
    avatarUrl?: string;
    sprites: any[];
    defaultSpriteId: string;
}

interface Background {
    id: string;
    name: string;
    description: string;
    imageUrl: string;
}

// StoryNode - 场景导向的故事节点结构
interface StoryNode {
    id: string;
    type: 'scene' | 'branch' | 'ending';
    isStart?: boolean;
    isEnding?: boolean;
    position: { x: number; y: number };
    title: string;
    sceneName?: string;
    backgroundId?: string;
    visualAssets?: {
        backgroundImageUrl?: string;
        characters?: Array<{
            characterId: string;
            spriteUrl?: string;
            position?: { x: number; y: number };
            scale?: number;
        }>;
    };
    audioAssets?: {
        bgmUrl?: string;
        bgmVolume?: number;
        bgmLoop?: boolean;
    };
    narration?: string;
    dialogues: Dialogue[];
    choices?: Choice[];
    nextNodeId?: string;
    notes?: string;
    tags?: string[];
}

interface Dialogue {
    id: string;
    characterId: string;
    text: string;
    emotion?: string;
}

interface Choice {
    id: string;
    text: string;
    targetNodeId: string;
    condition?: string;
}

// Simple ID generator
const createId = () => Math.random().toString(36).substring(2, 12);

interface GeneratedContent {
    title: string;
    description: string;
    genre: string;
    artStyle: string;
    storyNodes: Array<{
        id: string;
        type: 'scene' | 'branch' | 'ending';
        isStart?: boolean;
        isEnding?: boolean;
        title: string;
        sceneName?: string;
        narration?: string;
        dialogues: Array<{
            characterName: string;
            text: string;
        }>;
        choices?: Array<{
            text: string;
            targetNodeId: string;
            condition?: string;
        }>;
        nextNodeId?: string;
        position: { x: number; y: number };
    }>;
}

export class GameGenerator {
    private openai: OpenAI;
    private modelName: string;

    constructor() {
        this.openai = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY,
            baseURL: process.env.OPENAI_BASE_URL,
        });
        this.modelName = process.env.OPENAI_MODEL_NAME || 'gpt-5';
    }

    async generate(idea: string, locale: Locale = DEFAULT_LOCALE): Promise<GameProject> {
        console.log(`[GameGenerator] Starting generation for: "${idea}"`);
        console.log(`[GameGenerator] Using model: ${this.modelName}`);
        console.log(`[GameGenerator] User locale: ${locale}`);

        // 使用统一的prompt管理器
        const { system, user } = promptManager.build('game-generator.idea', {
            idea,
        }, locale);
        
        // 获取系统prompt
        const { system: systemPrompt } = promptManager.build('game-generator.director-system', {}, locale);
        
        const response = await this.openai.chat.completions.create({
            model: this.modelName,
            messages: [
                ...(system ? [{ role: 'system' as const, content: system }] : []),
                { role: 'user' as const, content: user },
            ],
            temperature: 0.8,
            max_tokens: 10000,  // 增加 token 限制以避免截断
        });

        // ✅ 追踪 Token 使用
        tokenTracker.trackOpenAI({
            model: this.modelName,
            response,
            operation: 'game-generator.idea',
        });

        const choice = response.choices[0];
        const content = choice?.message?.content;
        
        if (!content) {
            throw new Error('No response from AI model');
        }

        // 检查是否被截断
        if (choice.finish_reason === 'length') {
            console.warn('[GameGenerator] Response was truncated due to max_tokens limit');
        }

        console.log(`[GameGenerator] Received response (${content.length} chars, finish_reason: ${choice.finish_reason})`);

        // Parse the JSON response
        const generated = this.parseResponse(content);

        // Transform to GameProject format
        return this.transformToGameProject(generated);
    }

    /**
     * 新方法：基于用户自定义的角色、世界观、场景和主题风格生成游戏
     */
    async generateFromSetup(characters: any[], worldSettingOrBackgrounds: any, scenes?: any[], themeSetting?: any, locale: Locale = DEFAULT_LOCALE): Promise<GameProject> {
        // 兼容旧模式：如果没有 scenes，说明是旧模式 (characters + backgrounds)
        const isLegacyMode = !scenes || !Array.isArray(scenes);
        const backgrounds = isLegacyMode ? worldSettingOrBackgrounds : [];
        const worldSetting = isLegacyMode ? null : worldSettingOrBackgrounds;
        const actualScenes = scenes || [];
        
        console.log(`[GameGenerator] Starting generation with ${characters.length} characters`);
        if (isLegacyMode) {
            console.log(`[GameGenerator] Legacy mode: ${backgrounds.length} backgrounds`);
        } else {
            console.log(`[GameGenerator] New mode: world setting "${worldSetting?.name}" and ${actualScenes.length} scenes`);
        }
        console.log(`[GameGenerator] Using model: ${this.modelName}`);
        console.log(`[GameGenerator] User locale: ${locale}`);

        // 构建角色信息
        const charactersInfo = characters.map((char, i) => {
            const traits = char.personality?.traits?.join(', ') || '未知';
            const skills = char.coreTraits?.specialSkills?.join(', ') || '无';
            return `${i + 1}. ${char.displayName || char.name} (性别: ${char.gender || '未知'}, 身份: ${char.identity || '未知'})
   - 性格: ${traits}
   - 特殊技能: ${skills}
   - 描述: ${char.description || '无'}
   - 执念: ${char.coreTraits?.obsession || '无'}`;
        }).join('\n\n');

        // 构建背景/场景信息
        let backgroundsInfo = '';
        if (isLegacyMode) {
            // 旧模式：背景
            backgroundsInfo = backgrounds.map((bg: any, i: number) => {
                return `${i + 1}. ${bg.name}
   - 世界观: ${bg.worldSetting || '未知'}
   - 场景描述: ${bg.sceneDetails || bg.description || '无'}`;
            }).join('\n\n');
        } else {
            // 新模式：世界观 + 场景
            const worldInfo = `世界观：${worldSetting.name}
- 时代: ${worldSetting.era}
- 地域: ${worldSetting.location}
- 规则: ${worldSetting.rules || '无'}
- 社会结构: ${worldSetting.socialStructure || '无'}`;
            
        // 构建场景信息
        const scenesInfo = actualScenes.map((scene: any, i: number) => {
            return `${i + 1}. ${scene.name} (类型: ${scene.type}, 氛围: ${scene.atmosphere})
   - 细节: ${scene.details || '无'}
   - 功能: ${scene.function || '无'}`;
        }).join('\n');
        
        // 构建主题风格信息
        let themeInfo = '';
        if (themeSetting) {
            const themes = themeSetting.themes?.join('、') || '无';
            const styles = themeSetting.styles?.join('、') || '无';
            const tone = themeSetting.tone || '无';
            themeInfo = `\n\n故事主题风格：
- 核心主题: ${themes}
- 剧情风格: ${styles}
- 整体基调: ${tone}`;
        }
        
        backgroundsInfo = `${worldInfo}\n\n场景设定：\n${scenesInfo}${themeInfo}`;
        }

        // 使用统一的prompt管理器
        const { user } = promptManager.build('game-generator.setup', {
            charactersInfo,
            backgroundsInfo,
        }, locale);
        
        // 获取系统prompt
        const { system: directorSystem } = promptManager.build('game-generator.director-system', {}, locale);
        
        const response = await this.openai.chat.completions.create({
            model: this.modelName,
            messages: [
                ...(directorSystem ? [{ role: 'system' as const, content: directorSystem }] : []),
                { role: 'user' as const, content: user },
            ],
            temperature: 0.8,
            max_tokens: 10000,
        });

        // ✅ 追踪 Token 使用
        tokenTracker.trackOpenAI({
            model: this.modelName,
            response,
            operation: 'game-generator.setup',
        });

        const choice = response.choices[0];
        const content = choice?.message?.content;
        
        if (!content) {
            throw new Error('No response from AI model');
        }

        if (choice.finish_reason === 'length') {
            console.warn('[GameGenerator] Response was truncated due to max_tokens limit');
        }

        console.log(`[GameGenerator] Received response (${content.length} chars, finish_reason: ${choice.finish_reason})`);

        // Parse the JSON response
        const generated = this.parseResponse(content);

        // 将新模式的数据转换为旧格式的 backgrounds 数组
        let finalBackgrounds = backgrounds;
        if (!isLegacyMode && worldSetting && actualScenes.length > 0) {
            // 合并世界观和场景为backgrounds
            finalBackgrounds = actualScenes.map((scene: any) => ({
                id: scene.id,
                name: scene.name,
                description: scene.description || '',
                imageUrl: scene.imageUrl || '',  // ✅ 添加场景背景图URL
                worldSetting: `${worldSetting.era} · ${worldSetting.location}`,
                sceneDetails: `${scene.type} · ${scene.atmosphere}${scene.details ? ' · ' + scene.details : ''}`,
            }));
        }

        // Transform with user-provided characters and backgrounds
        return this.transformToGameProjectWithSetup(generated, characters, finalBackgrounds);
    }

    private parseResponse(content: string): GeneratedContent {
        // Clean the response (remove potential markdown code blocks)
        let cleanedContent = content
            .replace(/```json\n?/g, '')
            .replace(/```\n?/g, '')
            .trim();
        
        // Find the JSON object boundaries
        const startIndex = cleanedContent.indexOf('{');
        const endIndex = cleanedContent.lastIndexOf('}');
        
        if (startIndex === -1 || endIndex === -1 || endIndex <= startIndex) {
            console.error('[GameGenerator] No valid JSON boundaries found');
            console.error('[GameGenerator] Content preview:', content.slice(0, 300));
            throw new Error('AI response does not contain valid JSON structure');
        }
        
        cleanedContent = cleanedContent.slice(startIndex, endIndex + 1);
        
        // 修复常见的 JSON 格式问题
        cleanedContent = this.fixJsonFormat(cleanedContent);
        
        try {
            return JSON.parse(cleanedContent);
        } catch (parseError) {
            console.error('[GameGenerator] JSON parse failed');
            console.error('[GameGenerator] Content preview:', cleanedContent.slice(0, 500));
            console.error('[GameGenerator] Parse error:', parseError);
            
            if (!cleanedContent.endsWith('}')) {
                throw new Error('AI response was truncated - JSON is incomplete');
            }
            
            throw new Error(`Failed to parse AI response: ${parseError}`);
        }
    }

    // 修复 AI 返回的 JSON 常见格式问题
    private fixJsonFormat(json: string): string {
        // 1. 将单引号替换为双引号（但要注意不要替换字符串内容中的单引号）
        // 这是一个简化的处理，可能不完美但能处理大部分情况
        let fixed = json;
        
        // 2. 移除尾部逗号 (trailing commas)
        fixed = fixed.replace(/,(\s*[}\]])/g, '$1');
        
        // 3. 修复没有引号的属性名
        fixed = fixed.replace(/(\{|\,)\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g, '$1"$2":');
        
        // 4. 处理换行符在字符串中的问题
        fixed = fixed.replace(/:\s*"([^"]*)\n([^"]*)"/g, (match, p1, p2) => {
            return `:"${p1}\\n${p2}"`;
        });
        
        return fixed;
    }

    // 旧的 transformToGameProject 已废弃，不再使用
    private transformToGameProject(generated: GeneratedContent): GameProject {
        throw new Error('该方法已废弃，请使用 generateFromSetup');
    }

    /**
     * 使用用户自定义的角色和背景转换为 GameProject
     */
    private transformToGameProjectWithSetup(generated: GeneratedContent, userCharacters: any[], userBackgrounds: any[]): GameProject {
        const now = new Date().toISOString();
        const projectId = createId();

        // 1️⃣ 收集 AI 生成的所有角色名称
        const aiCharacterNames = new Set<string>();
        generated.storyNodes.forEach(node => {
            node.dialogues?.forEach(d => {
                if (d.characterName && d.characterName !== '旁白' && d.characterName !== 'Narrator') {
                    aiCharacterNames.add(d.characterName);
                }
            });
        });
        console.log('[GameGenerator] AI生成的角色:', Array.from(aiCharacterNames));

        // 2️⃣ 使用用户定义的角色，补充 ID
        const characters: Character[] = userCharacters.map((char) => ({
            ...char,
            id: char.id || createId(),
            sprites: char.sprites || [],
            defaultSpriteId: char.defaultSpriteId || '',
        }));

        // 3️⃣ 检测并创建新角色
        const existingNames = new Set<string>();
        characters.forEach(c => {
            existingNames.add(c.name.toLowerCase());
            if (c.displayName) existingNames.add(c.displayName.toLowerCase());
        });

        aiCharacterNames.forEach(aiName => {
            if (!existingNames.has(aiName.toLowerCase())) {
                // 创建新角色(头像和立绘留空,等待后续生成)
                const newCharacter: Character = {
                    id: createId(),
                    name: aiName,
                    displayName: aiName,
                    description: `AI生成的角色: ${aiName}`,
                    avatarUrl: '', // ✅ 留空,等待生成
                    sprites: [],   // ✅ 留空,等待生成
                    defaultSpriteId: '',
                };
                characters.push(newCharacter);
                console.log(`[GameGenerator] ✅ 自动创建新角色: ${aiName}`);
            }
        });

        // 4️⃣ Create character lookup map (by name and displayName)
        const characterMap = new Map<string, Character>();
        characters.forEach(c => {
            // 同时支持 name 和 displayName 匹配
            characterMap.set(c.name.toLowerCase(), c);
            if (c.displayName) {
                characterMap.set(c.displayName.toLowerCase(), c);
            }
        });
        characterMap.set('narrator', { id: 'narrator', name: 'Narrator', displayName: '旁白' } as any);
        characterMap.set('旁白', { id: 'narrator', name: 'Narrator', displayName: '旁白' } as any);
        
        console.log('[GameGenerator] Character map keys:', Array.from(characterMap.keys()));
        console.log('[GameGenerator] Final characters:', characters.map(c => ({ name: c.name, displayName: c.displayName })));

        // ✅ 5️⃣ 创建场景名称到ID的映射 (从userBackgrounds/场景列表中提取)
        const sceneNameToId = new Map<string, string>();
        userBackgrounds.forEach((bg: any) => {
            if (bg.name) {
                sceneNameToId.set(bg.name.toLowerCase(), bg.id);
            }
        });
        console.log('[GameGenerator] Scene name to ID map:', Array.from(sceneNameToId.entries()));

        // 使用用户定义的场景列表 (backgrounds为兼容旧代码,实际是场景)
        const backgrounds: Background[] = userBackgrounds.map((bg) => ({
            ...bg,
            id: bg.id || createId(),
            imageUrl: bg.imageUrl || '',  // 场景背景图
        }));

        // 直接输出 StoryNode[] 格式（不再转换为旧的 ScriptNode）
        const script: StoryNode[] = generated.storyNodes.map(node => {
            // 匹配角色ID
            const dialogues: Dialogue[] = node.dialogues?.map(d => {
                const charName = d.characterName.toLowerCase();
                const char = characterMap.get(charName);
                
                if (!char) {
                    console.warn(`[GameGenerator] 警告: 未找到角色 "${d.characterName}"`);
                }
                
                return {
                    id: createId(),
                    characterId: char?.id || '',
                    text: d.text,
                };
            }) || [];
            
            // 匹配场景背景ID
            const backgroundId = node.sceneName ? sceneNameToId.get(node.sceneName.toLowerCase()) : undefined;

            // 构建 StoryNode
            const storyNode: StoryNode = {
                id: node.id,
                type: node.type,
                isStart: node.isStart,
                isEnding: node.isEnding,
                position: node.position || { x: 0, y: 0 },
                title: node.title,
                sceneName: node.sceneName,
                backgroundId,
                narration: node.narration,
                dialogues,
            };

            // 分支节点：添加 choices
            if (node.type === 'branch' && node.choices) {
                storyNode.choices = node.choices.map(c => ({
                    id: createId(),
                    text: c.text,
                    targetNodeId: c.targetNodeId,
                    condition: c.condition,
                }));
            }
            
            // 非分支节点：添加 nextNodeId
            if (node.type !== 'branch' && node.nextNodeId) {
                storyNode.nextNodeId = node.nextNodeId;
            }

            return storyNode;
        });

        const gameProject: GameProject = {
            id: projectId,
            title: generated.title,
            description: generated.description,
            createdAt: now,
            updatedAt: now,
            meta: {
                author: 'IntelliVNG',
                version: '1.0.0',
                genre: generated.genre as any,
                artStyle: generated.artStyle as any,
            },
            characters,
            backgrounds,
            script,
            settings: {
                textSpeed: 50,
                autoPlayDelay: 3000,
                defaultTransition: 'fade',
            },
        };

        console.log(`[GameGenerator] Created project from setup: "${gameProject.title}" with ${characters.length} characters, ${backgrounds.length} backgrounds, ${script.length} story nodes`);

        // ✅ 验证节点连接完整性
        this.validateNodeConnections(generated.storyNodes);

        return gameProject;
    }

    /**
     * 验证节点连接完整性
     */
    private validateNodeConnections(storyNodes: GeneratedContent['storyNodes']): void {
        console.log('[GameGenerator] 🔍 开始验证节点连接完整性...');
        
        const nodeIds = new Set(storyNodes.map(n => n.id));
        const reachableFromStart = new Set<string>();
        const canReachEnding = new Set<string>();
        
        // 1. 找到开始节点
        const startNode = storyNodes.find(n => n.isStart);
        if (!startNode) {
            console.error('❌ 错误: 没有找到开始节点 (isStart: true)');
            return;
        }
        
        // 2. 找到所有结局节点
        const endingNodes = storyNodes.filter(n => n.isEnding);
        if (endingNodes.length === 0) {
            console.error('❌ 错误: 没有找到结局节点 (isEnding: true)');
            return;
        }
        console.log(`✅ 找到 ${endingNodes.length} 个结局节点`);
        
        // 3. 从开始节点开始 BFS 遍历，找到所有可达节点
        const queue = [startNode.id];
        reachableFromStart.add(startNode.id);
        
        while (queue.length > 0) {
            const currentId = queue.shift()!;
            const currentNode = storyNodes.find(n => n.id === currentId);
            if (!currentNode) continue;
            
            // 添加 nextNodeId
            if (currentNode.nextNodeId) {
                if (!reachableFromStart.has(currentNode.nextNodeId)) {
                    reachableFromStart.add(currentNode.nextNodeId);
                    queue.push(currentNode.nextNodeId);
                }
            }
            
            // 添加 choices
            if (currentNode.choices) {
                currentNode.choices.forEach(choice => {
                    if (choice.targetNodeId && !reachableFromStart.has(choice.targetNodeId)) {
                        reachableFromStart.add(choice.targetNodeId);
                        queue.push(choice.targetNodeId);
                    }
                });
            }
        }
        
        // 4. 检查孤立节点
        const orphanNodes = storyNodes.filter(n => !reachableFromStart.has(n.id));
        if (orphanNodes.length > 0) {
            console.error(`❌ 发现 ${orphanNodes.length} 个孤立节点(从 start 无法到达):`);
            orphanNodes.forEach(n => {
                console.error(`   - ${n.id}: ${n.title} (type: ${n.type})`);
            });
            // ✅ 抛出错误,阻止生成
            throw new Error(`AI生成的脚本包含 ${orphanNodes.length} 个孤立节点,请重新生成。孤立节点: ${orphanNodes.map(n => n.id).join(', ')}`);
        } else {
            console.log('✅ 所有节点都可以从 start 节点到达');
        }
        
        // 5. 检查每个节点是否能到达 ending
        endingNodes.forEach(ending => canReachEnding.add(ending.id));
        
        // 反向 BFS: 从 ending 节点反向搜索
        const reverseMap = new Map<string, string[]>();
        storyNodes.forEach(node => {
            if (node.nextNodeId) {
                if (!reverseMap.has(node.nextNodeId)) {
                    reverseMap.set(node.nextNodeId, []);
                }
                reverseMap.get(node.nextNodeId)!.push(node.id);
            }
            node.choices?.forEach(choice => {
                if (choice.targetNodeId) {
                    if (!reverseMap.has(choice.targetNodeId)) {
                        reverseMap.set(choice.targetNodeId, []);
                    }
                    reverseMap.get(choice.targetNodeId)!.push(node.id);
                }
            });
        });
        
        const reverseQueue = [...endingNodes.map(n => n.id)];
        while (reverseQueue.length > 0) {
            const currentId = reverseQueue.shift()!;
            const parents = reverseMap.get(currentId) || [];
            parents.forEach(parentId => {
                if (!canReachEnding.has(parentId)) {
                    canReachEnding.add(parentId);
                    reverseQueue.push(parentId);
                }
            });
        }
        
        // 6. 找到死胡同(无法到达 ending)
        const deadEnds = storyNodes.filter(n => !n.isEnding && !canReachEnding.has(n.id));
        if (deadEnds.length > 0) {
            console.error(`❌ 发现 ${deadEnds.length} 个死胡同节点(无法到达 ending):`);
            deadEnds.forEach(n => {
                console.error(`   - ${n.id}: ${n.title} (type: ${n.type})`);
            });
            // ✅ 抛出错误,阻止生成
            throw new Error(`AI生成的脚本包含 ${deadEnds.length} 个死胡同节点,请重新生成。死胡同节点: ${deadEnds.map(n => n.id).join(', ')}`);
        } else {
            console.log('✅ 所有节点都能到达 ending 节点');
        }
        
        // 7. 检查 nextNodeId 和 choices 的有效性
        const invalidLinks: string[] = [];
        storyNodes.forEach(node => {
            if (node.nextNodeId && !nodeIds.has(node.nextNodeId)) {
                const error = `${node.id} 的 nextNodeId "${node.nextNodeId}" 不存在`;
                console.error(`❌ 错误: ${error}`);
                invalidLinks.push(error);
            }
            node.choices?.forEach(choice => {
                if (choice.targetNodeId && !nodeIds.has(choice.targetNodeId)) {
                    const error = `${node.id} 的选项 "${choice.text}" 指向不存在的节点 "${choice.targetNodeId}"`;
                    console.error(`❌ 错误: ${error}`);
                    invalidLinks.push(error);
                }
            });
        });
        
        if (invalidLinks.length > 0) {
            // ✅ 抛出错误,阻止生成
            throw new Error(`AI生成的脚本包含 ${invalidLinks.length} 个无效连接,请重新生成。错误: ${invalidLinks.join('; ')}`);
        } else {
            console.log('✅ 所有连接都指向有效节点');
        }
        
        // 8. 汇总 - 此时如果有任何问题,已经抛出错误,所以这里只会执行到无问题的情况
        console.log('✅✅✅ 节点连接验证通过! 所有支线都完整且连通!');
    }
}

