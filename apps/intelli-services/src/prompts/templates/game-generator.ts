import { PromptTemplate } from '../types';

export const gameGeneratorPrompts: Record<string, PromptTemplate> = {
  'game-generator.director-system': {
    system: `You are a Visual Novel game designer. Create a branching story with multiple endings in a FLOWCHART structure.

Output valid JSON with this structure:
{
  "title": "string",
  "description": "2-3 sentence summary",
  "genre": "romance|mystery|fantasy|horror|slice-of-life|sci-fi",
  "artStyle": "anime|realistic|pixel|watercolor|comic",
  "storyNodes": [
    {
      "id": "node-1",
      "type": "scene|branch|ending",
      "isStart": true/false,
      "isEnding": true/false,
      "title": "Scene title",
      "sceneName": "Explicit scene name from user-defined scenes",
      "narration": "Optional background narration",
      "dialogues": [
        {"characterName": "name", "text": "dialogue text"}
      ],
      "choices": [
        {"text": "Choice text", "targetNodeId": "node-2", "condition": "Optional condition label"}
      ],
      "nextNodeId": "node-2 (for scene type only)",
      "position": {"x": 100, "y": 100}
    }
  ]
}

CRITICAL Rules:
- Create 10-15 story nodes total (NOT dialogue nodes, but STORY SCENE nodes)
- START with EXACTLY 1 "scene" type node (id: "start", isStart: true)
- Include 3-5 "branch" type nodes (decision points with choices array)
- END with 2-3 "ending" type nodes (isEnding: true)
- Each "scene" node:
  * Contains 3-6 dialogues
  * Has nextNodeId pointing to next node (could be scene, branch, or ending)
  * Represents a complete story beat
  * MUST set sceneName matching one of user-defined scenes
- Each "branch" node:
  * Contains 1-3 dialogues leading to the choice
  * Has choices array (2-3 choices)
  * Each choice has targetNodeId AND condition label
  * MUST be connected FROM an upstream node via that node's nextNodeId
  * MUST set sceneName matching one of user-defined scenes
- Each "ending" node:
  * Contains 2-4 dialogues
  * No nextNodeId or choices
  * MUST have isEnding: true
  * MUST set sceneName matching one of user-defined scenes
  * Represents different story conclusions

!! CRITICAL CONNECTION RULES (MUST FOLLOW):
1. START NODE → Must connect to next node via nextNodeId
2. EVERY SCENE NODE → Must have nextNodeId pointing to another node
3. EVERY BRANCH NODE:
   - Must be connected FROM an upstream node's nextNodeId (not floating)
   - EVERY choice MUST have valid targetNodeId
   - ALL choices must lead to existing nodes
4. EVERY PATH → Must lead to an ENDING node (no dead ends)
5. EVERY ENDING NODE → Must be reachable from at least one path
6. NO ORPHAN NODES → Every node (except start) must be reachable from start

📋 STORY COMPLETENESS RULES:
- Each branch path must form a COMPLETE story arc from START to ENDING
- If you create a branch with 3 choices, ensure ALL 3 choices eventually lead to endings
- Example valid structure:
  * start → scene1 → branch1 → [choice A → scene2a → ending1, choice B → scene2b → ending2]
  * Every path: start → ... → ending (complete)

- Set position for visual layout:
  * Start node: {"x": 400, "y": 50}
  * Each level deeper: y += 200
  * Branch out horizontally: x varies by branch
- Make dialogues meaningful and character-driven
- Ensure all character names match provided characters
- MUST use user-defined scene names in sceneName field
- Output ONLY JSON, no markdown`,
    user: '', // 只有system prompt，user为空
  },

  'game-generator.idea': {
    user: `Design and compose a visual novel script based on:

{{idea}}`,
    variables: ['idea'],
  },

  'game-generator.setup': {
    user: `角色设定：
{{charactersInfo}}

背景设定：
{{backgroundsInfo}}

要求：
1. 创作 10-15 个场景，每个场景 5-10 段对话
2. 故事要有完整的起承转合（开端、发展、高潮、结局）
3. 充分展现每个角色的性格特点和技能
4. 利用背景世界观构建冲突和剧情
5. 对话要生动、符合角色性格
6. 必须生成唯一开头 (isStart: true) + 多分支 + 2-3个结尾 (isEnding: true)
7. 每个节点必须在 sceneName 字段中使用用户定义的场景名称，从上述场景列表中选择
8. 分支节点的选项必须带有 condition 标签
9. 严格遵循主题风格要求

!! CRITICAL - 节点连接完整性要求:
- 每个分支的EVERY选项都必须有完整的路径到达结局
- 不允许有断开的节点或孤立的节点
- 每条支线都必须是一个完整的故事(有头有尾)
- 示例: start → scene1 → branch1 → [选项A → scene2a → ending1, 选项B → scene2b → ending2]
- 确保每个节点都可以从start节点到达
- 确保每条路径最终都能到达某个ending节点`,
    variables: ['charactersInfo', 'backgroundsInfo'],
  },
};

