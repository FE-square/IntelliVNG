import OpenAI from 'openai';

// Types (inline to avoid ESM module resolution issues with workspace packages)
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
    script: ScriptNode[];
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
    sprites: any[];
    defaultSpriteId: string;
}

interface Background {
    id: string;
    name: string;
    description: string;
    imageUrl: string;
}

interface ScriptNode {
    id: string;
    type: string;
    position: { x: number; y: number };
    characterId?: string;
    text?: string;
    nextNodeId?: string | null;
}

// Simple ID generator
const createId = () => Math.random().toString(36).substring(2, 12);

// System prompt for the Director Agent
const DIRECTOR_SYSTEM_PROMPT = `You are a Visual Novel game designer. Create a game design from the user's idea.

Output valid JSON with this structure:
{
  "title": "string",
  "description": "2-3 sentence summary",
  "genre": "romance|mystery|fantasy|horror|slice-of-life|sci-fi",
  "artStyle": "anime|realistic|pixel|watercolor|comic",
  "characters": [
    {"name": "string", "displayName": "string", "description": "brief appearance", "personality": "brief", "role": "protagonist|love_interest|antagonist|supporting"}
  ],
  "backgrounds": [
    {"name": "string", "description": "brief visual description"}
  ],
  "scenes": [
    {"background": "bg name", "dialogues": [{"speaker": "name or Narrator", "text": "dialogue"}]}
  ]
}

Rules:
- 3-4 characters, 3-4 backgrounds, 3-5 scenes with 3-5 dialogues each
- Keep descriptions SHORT (under 50 words each)
- Output ONLY the JSON, no markdown`;

interface GeneratedContent {
    title: string;
    description: string;
    genre: string;
    artStyle: string;
    characters: Array<{
        name: string;
        displayName: string;
        description: string;
        personality: string;
        role: string;
    }>;
    backgrounds: Array<{
        name: string;
        description: string;
    }>;
    scenes: Array<{
        background: string;
        dialogues: Array<{
            speaker: string;
            text: string;
        }>;
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
        this.modelName = process.env.OPENAI_MODEL_NAME || 'gpt-4-turbo';
    }

    async generate(idea: string): Promise<GameProject> {
        console.log(`[GameGenerator] Starting generation for: "${idea}"`);
        console.log(`[GameGenerator] Using model: ${this.modelName}`);

        // Call OpenAI to generate the game design
        const response = await this.openai.chat.completions.create({
            model: this.modelName,
            messages: [
                { role: 'system', content: DIRECTOR_SYSTEM_PROMPT },
                { role: 'user', content: `Design and compose a visual novel script based on:\n\n${idea}` },
            ],
            temperature: 0.8,
            max_tokens: 10000,  // 增加 token 限制以避免截断
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

    private transformToGameProject(generated: GeneratedContent): GameProject {
        const now = new Date().toISOString();
        const projectId = createId();

        // Create characters
        const characters: Character[] = generated.characters.map((char) => ({
            id: createId(),
            name: char.name,
            displayName: char.displayName || char.name,
            description: char.description,
            sprites: [], // Will be populated when images are generated
            defaultSpriteId: '',
        }));

        // Create character lookup map
        const characterMap = new Map(characters.map(c => [c.name.toLowerCase(), c]));

        // Create backgrounds
        const backgrounds: Background[] = generated.backgrounds.map((bg) => ({
            id: createId(),
            name: bg.name,
            description: bg.description,
            imageUrl: '', // Will be populated when images are generated
        }));

        // Create background lookup map
        const backgroundMap = new Map(backgrounds.map(b => [b.name.toLowerCase(), b]));

        // Create script nodes from scenes
        const script: ScriptNode[] = [];
        let nodeIndex = 0;

        for (const scene of generated.scenes) {
            // Find background
            const bg = backgroundMap.get(scene.background.toLowerCase());
            
            for (const dialogue of scene.dialogues) {
                const isNarrator = dialogue.speaker.toLowerCase() === 'narrator';
                const character = isNarrator ? null : characterMap.get(dialogue.speaker.toLowerCase());
                
                const node: ScriptNode = {
                    id: createId(),
                    type: 'dialogue',
                    position: { x: 100 + (nodeIndex % 5) * 250, y: 100 + Math.floor(nodeIndex / 5) * 150 },
                    characterId: character?.id || '',
                    text: dialogue.text,
                    nextNodeId: null, // Will be linked in post-processing
                };
                
                // Link previous node to this one
                if (script.length > 0) {
                    const prevNode = script[script.length - 1];
                    prevNode.nextNodeId = node.id;
                }
                
                script.push(node);
                nodeIndex++;
            }
        }

        const gameProject: GameProject = {
            id: projectId,
            title: generated.title,
            description: generated.description,
            createdAt: now,
            updatedAt: now,
            meta: {
                author: 'IntelliVNG',
                version: '1.0.0',
                genre: generated.genre as GameProject['meta']['genre'],
                artStyle: generated.artStyle as GameProject['meta']['artStyle'],
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

        console.log(`[GameGenerator] Created project: "${gameProject.title}" with ${characters.length} characters, ${backgrounds.length} backgrounds, ${script.length} dialogue nodes`);

        return gameProject;
    }
}

