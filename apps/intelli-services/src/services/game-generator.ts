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
const DIRECTOR_SYSTEM_PROMPT = `You are the Director of a Visual Novel production team.
Your goal is to take a user's high-level idea and turn it into a concrete game design.

You are responsible for:
1. Defining the game title, genre, and art style.
2. Creating the main characters (3-4 characters with distinct personalities).
3. Designing the key locations/backgrounds (3-5 locations).
4. Outlining the main plot with dialogue scenes.

Output strictly valid JSON matching this schema:
{
  "title": "string",
  "description": "string (2-3 sentences)",
  "genre": "romance" | "mystery" | "fantasy" | "horror" | "slice-of-life" | "sci-fi",
  "artStyle": "anime" | "realistic" | "pixel" | "watercolor" | "comic",
  "characters": [
    {
      "name": "string",
      "displayName": "string",
      "description": "string (appearance and background)",
      "personality": "string",
      "role": "protagonist" | "love_interest" | "antagonist" | "supporting"
    }
  ],
  "backgrounds": [
    {
      "name": "string",
      "description": "string (detailed visual description)"
    }
  ],
  "scenes": [
    {
      "background": "background name",
      "dialogues": [
        {
          "speaker": "character name or Narrator",
          "text": "dialogue text"
        }
      ]
    }
  ]
}

Important:
- Do NOT include markdown formatting or code blocks
- Output ONLY the raw JSON object
- Ensure all JSON is valid and properly escaped`;

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
                { role: 'user', content: `Create a visual novel based on this idea:\n\n${idea}` },
            ],
            temperature: 0.8,
            max_tokens: 3000,
        });

        const content = response.choices[0]?.message?.content;
        
        if (!content) {
            throw new Error('No response from AI model');
        }

        console.log(`[GameGenerator] Received response from AI (${content.length} chars)`);

        // Parse the JSON response
        const generated = this.parseResponse(content);

        // Transform to GameProject format
        return this.transformToGameProject(generated);
    }

    private parseResponse(content: string): GeneratedContent {
        try {
            // Clean the response (remove potential markdown code blocks)
            let cleanedContent = content
                .replace(/```json\n?/g, '')
                .replace(/```\n?/g, '')
                .trim();
            
            // Find the JSON object boundaries
            const startIndex = cleanedContent.indexOf('{');
            const endIndex = cleanedContent.lastIndexOf('}');
            
            if (startIndex !== -1 && endIndex !== -1) {
                cleanedContent = cleanedContent.slice(startIndex, endIndex + 1);
            }
            
            return JSON.parse(cleanedContent);
        } catch (parseError) {
            console.error('[GameGenerator] Failed to parse AI response:', content.slice(0, 500));
            throw new Error('Failed to parse AI response as JSON');
        }
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

