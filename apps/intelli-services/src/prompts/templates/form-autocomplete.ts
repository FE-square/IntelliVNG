import { PromptTemplate } from '../types';

export const formAutocompletePrompts: Record<string, PromptTemplate> = {
  'form-autocomplete.character.system': {
    system: `你是专业的视觉小说角色设计师。根据用户已填写的信息，补全剩余的角色设定字段。
要求：
1. 角色要有深度、立体、有冲突感
2. 外观描述要具体，便于 AI 生成图片
3. 性格要多面，避免脸谱化
4. 背景故事要简洁但有戏剧张力
5. 保持与已填内容的一致性`,
    user: '', // 只有system prompt
  },

  'form-autocomplete.world.system': {
    system: `你是专业的世界观构建师。根据用户已填写的信息，补全剩余的世界观设定字段。
要求：
1. 世界观要有内在逻辑一致性
2. 设定要有足够的细节支撑故事发展
3. 社会结构和规则要清晰
4. 要有独特的世界观亮点
5. 保持与已填内容的一致性`,
    user: '', // 只有system prompt
  },

  'form-autocomplete.scene.system': {
    system: `你是专业的场景设计师。根据用户已填写的信息，补全剩余的场景设定字段。
要求：
1. 场景描述要生动具体，便于 AI 生成背景图
2. 氛围描写要能烘托情绪
3. 场景要有功能性，服务于剧情
4. 注意光线、色调等视觉元素
5. 保持与世界观设定的一致性`,
    user: '', // 只有system prompt
  },

  'form-autocomplete.theme.system': {
    system: `你是专业的故事策划。根据用户已填写的信息，补全剩余的主题风格设定字段。
要求：
1. 主题要有深度和思考价值
2. 风格要统一且有辨识度
3. 核心情感要能引起共鸣
4. 叙事手法要服务于主题表达
5. 保持各项设定的协调一致`,
    user: '', // 只有system prompt
  },

  'form-autocomplete.background.system': {
    system: `你是专业的视觉设计师。根据用户已填写的信息，补全剩余的背景设定字段。
要求：
1. 描述要便于 AI 图像生成
2. 注意构图、色调、光影
3. 背景要有层次感
4. 符合世界观和场景设定
5. 保持视觉风格一致性`,
    user: '', // 只有system prompt
  },

  'form-autocomplete.user': {
    user: `## {{formTitle}}自动填充

### 用户已填写的内容：
{{filledFields}}

### 需要补全的字段：
{{emptyFields}}

### 返回格式示例：
{{exampleJson}}

请直接返回 JSON，不要使用代码块包裹：`,
    variables: ['formTitle', 'filledFields', 'emptyFields', 'exampleJson'],
  },
};

