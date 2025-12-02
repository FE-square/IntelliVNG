/**
 * 测试 GameGeneratorAgent 多智能体系统
 * 
 * 使用方法:
 *   npx tsx test-agent-api.ts [mode] [options]
 * 
 * 模式:
 *   agent  - 使用多智能体模式（默认，支持缓存）
 *   fast   - 使用快速模式（单次 LLM 调用）
 * 
 * 选项:
 *   --clear-cache    清除所有 LLM 缓存
 *   --no-cache       禁用缓存（强制重新生成）
 *   --cache-stats    显示缓存统计信息
 * 
 * 示例:
 *   npx tsx test-agent-api.ts agent              # 使用缓存的 agent 模式
 *   npx tsx test-agent-api.ts agent --no-cache   # 不使用缓存
 *   npx tsx test-agent-api.ts --clear-cache      # 清除缓存后退出
 *   npx tsx test-agent-api.ts --cache-stats      # 显示缓存统计
 * 
 * 缓存说明:
 *   - 默认启用缓存，缓存文件存储在 .cache/llm/ 目录
 *   - 缓存基于 agent + prompt 生成唯一键
 *   - 成功解析的 LLM 响应会自动缓存
 *   - 下次相同请求直接返回缓存结果，跳过 LLM 调用
 */

import { clearAllCache, getCacheStats } from './src/utils/structured-output-helper';

// 处理命令行参数
const args = process.argv.slice(2);
const shouldClearCache = args.includes('--clear-cache');
const shouldShowStats = args.includes('--cache-stats');
const noCache = args.includes('--no-cache');

// 设置环境变量禁用缓存
if (noCache) {
  process.env.LLM_CACHE_ENABLED = 'false';
  console.log('🚫 缓存已禁用');
}

// 处理特殊命令
if (shouldClearCache) {
  console.log('🗑️ 正在清除缓存...');
  clearAllCache();
  if (!args.some(a => a === 'agent' || a === 'fast')) {
    process.exit(0);
  }
}

if (shouldShowStats) {
  const stats = getCacheStats();
  console.log('\n📊 缓存统计:');
  console.log(`   文件数: ${stats.count}`);
  console.log(`   总大小: ${(stats.size / 1024).toFixed(2)} KB`);
  if (stats.files.length > 0) {
    console.log(`   文件列表:`);
    stats.files.forEach(f => console.log(`     - ${f}`));
  }
  if (!args.some(a => a === 'agent' || a === 'fast')) {
    process.exit(0);
  }
}

// 模拟数据：角色
const mockCharacters = [
  {
    id: 'char_001',
    name: '林晓晨',
    displayName: '晓晨',
    gender: 'female',
    identity: '大学生 / 业余侦探',
    description: '性格开朗但细心，有着敏锐的观察力。父亲是退休刑警，从小耳濡目染学会了推理技巧。',
    personality: {
      traits: ['好奇心强', '正义感', '有点冒失'],
      speakingStyle: '语气活泼，偶尔会说一些推理术语',
    },
    coreTraits: {
      motivation: '想要证明自己的推理能力',
      fear: '害怕辜负父亲的期望',
    },
  },
  {
    id: 'char_002',
    name: '陆修远',
    displayName: '修远',
    gender: 'male',
    identity: '图书馆管理员 / 神秘的知情者',
    description: '沉默寡言，总是戴着眼镜读书。似乎知道很多不为人知的秘密，但从不主动透露。',
    personality: {
      traits: ['冷静', '博学', '神秘'],
      speakingStyle: '说话简洁，常用隐喻和典故',
    },
    coreTraits: {
      motivation: '守护某个重要的秘密',
      fear: '真相被揭露后的后果',
    },
  },
  {
    id: 'char_003',
    name: '方雨萱',
    displayName: '雨萱',
    gender: 'female',
    identity: '校报记者 / 晓晨的室友',
    description: '热情开朗的新闻系学生，嗅觉灵敏，总能挖到第一手消息。',
    personality: {
      traits: ['热情', '八卦', '讲义气'],
      speakingStyle: '语速快，喜欢用夸张的表情',
    },
    coreTraits: {
      motivation: '追求真相和新闻自由',
      fear: '失去朋友的信任',
    },
  },
];

// 模拟数据：世界观
const mockWorldSetting = {
  name: '青云大学',
  era: '现代（2024年）',
  location: '中国某沿海城市的著名综合大学',
  rules: `
    1. 这是一所历史悠久的大学，有着许多未解之谜和校园传说
    2. 校园内有一座百年图书馆，据说藏有不为人知的秘密
    3. 最近校园内发生了一系列奇怪的事件，引起了学生们的注意
    4. 学校有着严格的门禁制度，但总有人能神出鬼没
  `,
};

// 模拟数据：场景
const mockScenes = [
  {
    id: 'scene_001',
    name: '图书馆阅览室',
    type: 'indoor',
    atmosphere: '安静、神秘、略带压抑',
    details: '百年历史的老式建筑，高耸的书架，昏黄的灯光，空气中弥漫着书香和灰尘的味道。',
  },
  {
    id: 'scene_002',
    name: '校园林荫道',
    type: 'outdoor',
    atmosphere: '清新、活泼',
    details: '两旁种满了梧桐树的小路，阳光透过树叶洒下斑驳的光影。',
  },
  {
    id: 'scene_003',
    name: '学生宿舍',
    type: 'indoor',
    atmosphere: '温馨、日常',
    details: '四人间的女生宿舍，贴满了海报和照片，桌上散落着书本和零食。',
  },
  {
    id: 'scene_004',
    name: '图书馆地下室',
    type: 'indoor',
    atmosphere: '阴暗、紧张、危险',
    details: '被遗忘的档案室，布满灰尘的旧文件，隐藏着学校不愿公开的历史。',
  },
];

// 模拟数据：主题风格
const mockThemeSetting = {
  themes: ['校园悬疑', '友情', '成长', '真相与谎言'],
  styles: ['推理', '日常', '轻度恐怖'],
  tone: '整体基调轻松但带有悬疑色彩，随着剧情深入逐渐紧张',
};

// 获取命令行参数决定模式（排除选项参数）
const testMode = args.find(a => a === 'agent' || a === 'fast') || 'agent';

// 请求体
const requestBody = {
  characters: mockCharacters,
  worldSetting: mockWorldSetting,
  scenes: mockScenes,
  themeSetting: mockThemeSetting,
  locale: 'zh-CN',
  mode: testMode as 'agent' | 'fast', // 从命令行参数读取模式
};

// 颜色工具
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

function log(color: string, prefix: string, message: string) {
  console.log(`${color}${prefix}${colors.reset} ${message}`);
}

async function testAgentAPI() {
  console.log('\n' + '='.repeat(60));
  console.log(`${colors.bright}${colors.cyan}🧪 测试 GameGeneratorAgent 多智能体系统${colors.reset}`);
  console.log('='.repeat(60) + '\n');

  console.log(`${colors.dim}📝 请求数据:${colors.reset}`);
  console.log(`   角色数量: ${mockCharacters.length}`);
  console.log(`   场景数量: ${mockScenes.length}`);
  console.log(`   世界观: ${mockWorldSetting.name}`);
  console.log(`   主题: ${mockThemeSetting.themes.join(', ')}`);
  console.log(`   语言: ${requestBody.locale}`);
  console.log(`   模式: ${requestBody.mode}`);
  console.log(`   ${colors.dim}(使用 'npx tsx test-agent-api.ts fast' 测试 fast 模式)${colors.reset}`);
  console.log('');

  const startTime = Date.now();

  try {
    console.log(`${colors.yellow}📡 发送请求到 http://localhost:4000/api/game/generate-by-agents${colors.reset}\n`);

    const response = await fetch('http://localhost:4000/api/game/generate-by-agents', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    // fast 模式返回普通 JSON，agent 模式返回 SSE
    if (requestBody.mode === 'fast') {
      // 处理 fast 模式 (JSON)
      const result = await response.json();
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

      console.log('='.repeat(60));
      console.log(`${colors.bright}📋 测试结果 (Fast 模式)${colors.reset}`);
      console.log('='.repeat(60) + '\n');

      if (result.success && result.data) {
        displayResult(result.data, elapsed);
      } else {
        console.log(`${colors.red}❌ 生成失败${colors.reset}`);
        console.log(`错误: ${result.error || '未知错误'}`);
      }
      return;
    }

    // agent 模式 (SSE)
    if (!response.body) {
      throw new Error('Response body is null');
    }

    // 处理 SSE 流
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let finalResult: any = null;

    console.log(`${colors.bright}📊 实时进度:${colors.reset}\n`);

    while (true) {
      const { done, value } = await reader.read();

      if (done) {
        break;
      }

      buffer += decoder.decode(value, { stream: true });

      // 解析 SSE 事件
      const lines = buffer.split('\n\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const jsonStr = line.slice(6);
            const event = JSON.parse(jsonStr);

            // 根据事件类型显示不同的信息
            switch (event.event) {
              case 'session':
                if (event.status === 'started') {
                  log(colors.green, '🚀', event.message);
                } else if (event.status === 'ended') {
                  log(colors.green, '✅', `会话结束，总耗时: ${event.elapsedTime}`);
                }
                break;

              case 'progress':
                const stageIcon = getStageIcon(event.stage);
                const statusColor = event.status === 'completed' ? colors.green :
                                   event.status === 'failed' ? colors.red :
                                   event.status === 'in_progress' ? colors.yellow : colors.dim;
                
                if (event.status === 'in_progress') {
                  const progress = event.progress !== undefined ? ` [${event.progress}%]` : '';
                  log(statusColor, stageIcon, `${event.message}${progress}`);
                  if (event.details) {
                    console.log(`   ${colors.dim}${event.details}${colors.reset}`);
                  }
                } else if (event.status === 'completed') {
                  log(statusColor, '✅', `${event.message}`);
                  if (event.details) {
                    console.log(`   ${colors.dim}${event.details}${colors.reset}`);
                  }
                } else if (event.status === 'failed') {
                  log(statusColor, '❌', `${event.message}: ${event.details}`);
                }
                break;

              case 'result':
                finalResult = event;
                if (event.success) {
                  log(colors.green, '🎉', '剧本生成成功！');
                }
                break;

              case 'error':
                log(colors.red, '❌', `错误: ${event.error}`);
                break;

              default:
                console.log(`${colors.dim}未知事件: ${JSON.stringify(event)}${colors.reset}`);
            }
          } catch (e) {
            // 跳过无法解析的行
          }
        }
      }
    }

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

    console.log('\n' + '='.repeat(60));
    console.log(`${colors.bright}📋 测试结果 (Agent 模式)${colors.reset}`);
    console.log('='.repeat(60) + '\n');

    if (finalResult?.success && finalResult.data) {
      displayResult(finalResult.data, elapsed);
    } else {
      console.log(`${colors.red}❌ 生成失败${colors.reset}`);
      if (finalResult) {
        console.log(`错误: ${finalResult.error || '未知错误'}`);
      }
    }

  } catch (error) {
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`\n${colors.red}❌ 测试失败 (耗时 ${elapsed}s)${colors.reset}`);
    console.error(error);
  }

  console.log('\n');
}

async function displayResult(data: any, elapsed: string) {
  console.log(`${colors.green}✅ 生成成功！${colors.reset}\n`);
  console.log(`📖 标题: ${data.title}`);
  console.log(`📝 描述: ${data.description?.slice(0, 100)}...`);
  console.log(`👥 角色数: ${data.characters?.length || 0}`);
  console.log(`🎬 场景数: ${data.backgrounds?.length || 0}`);
  console.log(`📜 节点数: ${data.script?.length || 0}`);
  console.log(`⏱️  总耗时: ${elapsed}s`);

  // 显示故事结构
  if (data.script && data.script.length > 0) {
    console.log(`\n${colors.cyan}📊 故事结构:${colors.reset}`);
    data.script.forEach((node: any, idx: number) => {
      const icon = node.isStart ? '🏁' : node.isEnding ? '🎌' : node.type === 'branch' ? '🔀' : '📄';
      const choiceInfo = node.choices?.length ? ` [${node.choices.length}个选项]` : '';
      console.log(`   ${icon} ${idx + 1}. ${node.title}${choiceInfo}`);
    });
  }

  // 保存结果到文件
  const fs = await import('fs');
  const outputPath = './test-agent-result.json';
  fs.writeFileSync(outputPath, JSON.stringify(data, null, 2), 'utf-8');
  console.log(`\n${colors.dim}💾 完整结果已保存到: ${outputPath}${colors.reset}`);
}

function getStageIcon(stage: string): string {
  const icons: Record<string, string> = {
    init: '🔧',
    planning: '📋',
    plan_validate: '🔍',
    writing: '✍️',
    reviewing: '👀',
    rewriting: '🔄',
    finalizing: '📦',
    completed: '🎉',
    failed: '❌',
  };
  return icons[stage] || '📍';
}

// 运行测试
testAgentAPI();

