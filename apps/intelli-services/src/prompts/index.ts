/**
 * 统一的Prompt管理系统
 * 
 * 将所有LLM调用的prompt集中管理，便于：
 * 1. 统一添加语言提示
 * 2. 版本控制和更新
 * 3. A/B测试不同prompt版本
 * 4. 统一格式和风格
 */

import { addLocaleToSystemPrompt, addLocaleToUserPrompt, type Locale, DEFAULT_LOCALE } from '../utils/locale';
import { PromptTemplate } from './types';

// 导入所有prompt模板
import { gameGeneratorPrompts } from './templates/game-generator';
import { storyPlannerPrompts } from './templates/story-planner';
import { nodeWriterPrompts } from './templates/node-writer';
import { storyReviewerPrompts } from './templates/story-reviewer';
import { workflowPrompts } from './templates/workflow';
import { formAutocompletePrompts } from './templates/form-autocomplete';

// 重新导出类型定义，以便其他模块可以使用
export type { PromptTemplate };

/**
 * Prompt构建器接口
 */
export interface PromptBuilder {
  build(params: Record<string, any>, locale?: Locale): {
    system?: string;
    user: string;
  };
}

/**
 * Prompt管理器
 * 统一管理所有prompt模板
 */
export class PromptManager {
  private templates: Map<string, PromptTemplate> = new Map();

  /**
   * 注册prompt模板
   */
  register(name: string, template: PromptTemplate): void {
    this.templates.set(name, template);
  }

  /**
   * 批量注册prompt模板
   */
  registerBatch(templates: Record<string, PromptTemplate>): void {
    Object.entries(templates).forEach(([name, template]) => {
      this.register(name, template);
    });
  }

  /**
   * 获取prompt模板
   */
  get(name: string): PromptTemplate | undefined {
    return this.templates.get(name);
  }

  /**
   * 构建prompt（带语言支持）
   */
  build(
    name: string,
    params: Record<string, any> = {},
    locale: Locale = DEFAULT_LOCALE
  ): { system?: string; user: string } {
    const template = this.templates.get(name);
    if (!template) {
      throw new Error(`Prompt template "${name}" not found`);
    }

    // 替换模板变量
    let systemPrompt = template.system;
    let userPrompt = template.user;

    if (systemPrompt) {
      systemPrompt = this.replaceVariables(systemPrompt, params);
      systemPrompt = addLocaleToSystemPrompt(systemPrompt, locale);
    }

    userPrompt = this.replaceVariables(userPrompt, params);
    userPrompt = addLocaleToUserPrompt(userPrompt, locale);

    return {
      system: systemPrompt,
      user: userPrompt,
    };
  }

  /**
   * 替换模板变量
   * 支持 {{variable}} 格式
   */
  private replaceVariables(template: string, params: Record<string, any>): string {
    return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
      const value = params[key];
      if (value === undefined) {
        console.warn(`[PromptManager] Variable "${key}" not provided, using placeholder`);
        return match;
      }
      // 如果是对象，转换为JSON字符串
      if (typeof value === 'object') {
        return JSON.stringify(value, null, 2);
      }
      return String(value);
    });
  }
}

// 创建全局prompt管理器实例
export const promptManager = new PromptManager();

/**
 * 注册所有prompt模板
 */
export function registerAllPrompts() {
  // 批量注册各个模块的prompt
  promptManager.registerBatch(gameGeneratorPrompts);
  promptManager.registerBatch(storyPlannerPrompts);
  promptManager.registerBatch(nodeWriterPrompts);
  promptManager.registerBatch(storyReviewerPrompts);
  promptManager.registerBatch(workflowPrompts);
  promptManager.registerBatch(formAutocompletePrompts);
  
  console.log('[PromptManager] ✅ 已注册所有prompt模板');
}

// 自动注册所有prompt
registerAllPrompts();
