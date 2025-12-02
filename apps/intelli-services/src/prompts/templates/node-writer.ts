import { PromptTemplate } from '../types';

export const nodeWriterPrompts: Record<string, PromptTemplate> = {
  'node-writer.write': {
    user: `## 当前要写的节点
{{planNode}}

## 前序节点摘要
{{previousNodeSummary}}

## 角色档案
{{characters}}

## 风格指南
{{styleGuide}}

请为这个节点撰写对话和旁白。
- 如果是 branch 类型，必须包含 choices
- 如果是 scene 类型，必须包含 nextNodeId
- ending 类型不需要 choices 和 nextNodeId
- summary 必须填写，这对保证故事连贯性非常重要`,
    variables: ['planNode', 'previousNodeSummary', 'characters', 'styleGuide'],
  },

  'node-writer.rewrite': {
    user: `## 原始草稿
{{originalDraft}}

## 审稿人的修改建议
{{suggestion}}

## 问题类型
{{issueType}} - {{issueDescription}}

## 角色档案
{{characters}}

## 风格指南
{{styleGuide}}

请根据审稿人的修改建议重写这个节点。`,
    variables: ['originalDraft', 'suggestion', 'issueType', 'issueDescription', 'characters', 'styleGuide'],
  },
};

