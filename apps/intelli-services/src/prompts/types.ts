/**
 * Prompt模板接口
 */
export interface PromptTemplate {
  system?: string;
  user: string;
  variables?: string[]; // 模板变量列表，用于验证
}

