'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Loader2, Bot, User, ChevronDown, Sparkles, AlertCircle, CheckCircle2, RotateCcw } from 'lucide-react';
import type { GameProject, StoryNode } from '@vng/core';

// ============ 类型定义 ============

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  status?: 'sending' | 'streaming' | 'done' | 'error';
  actions?: Array<{
    type: 'patch' | 'analysis' | 'query-result' | 'error' | 'generate-image';
    payload: any;
  }>;
  thinkingSteps?: Array<{
    stepIndex: number;
    content: string;
    timestamp: number;
  }>;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

interface ChatBotProps {
  project: GameProject;
  projectId: string;
  onUpdate: (project: GameProject) => void;
  // 生图回调 - 接受目标对象作为参数
  onGenerateSprite?: (character: any) => Promise<void>;
  onGenerateAvatar?: (character: any) => Promise<void>;
  onGenerateBackground?: (background: any) => Promise<void>;
  backendUrl?: string;
  locale?: string;
  i18n?: {
    title?: string;
    placeholder?: string;
    send?: string;
    thinking?: string;
    errorRetry?: string;
    noMessages?: string;
    collapse?: string;
    expand?: string;
    generatingImage?: string;
    imageGenerated?: string;
    targetNotFound?: string;
    retry?: string;
    actionApplied?: string;
    operationsExecuted?: string;
    sprite?: string;
    avatar?: string;
    background?: string;
    generatingSprite?: string;
    generatingAvatar?: string;
    generatingBackground?: string;
    spriteGenerated?: string;
    avatarGenerated?: string;
    backgroundGenerated?: string;
    generationFailed?: string;
    sendFailed?: string;
    exampleAddScene?: string;
    exampleGenerateSprite?: string;
    exampleCheckStructure?: string;
    toolCall?: string;
    // 分析结果相关
    analysisValid?: string;
    analysisIssuesFound?: string;
    analysisPaths?: string;
    analysisDialogueQuality?: string;
    analysisBranchDistribution?: string;
    analysisNonlinearScore?: string;
    analysisComplete?: string;
    queryResult?: string;
    patchApplied?: string;
    // 其他
    operationFailed?: string;
    generateImageWithName?: string;
    generateImage?: string;
    choiceDefault?: string;
    resizeHeight?: string;
    // Token 统计
    tokenInput?: string;
    tokenOutput?: string;
    tokenTotal?: string;
    sessionTokens?: string;
    // 思考步骤
    thinkingStepsLabel?: string;
    stepLabel?: string;
  };
}

// ============ 辅助函数 ============

function generateId(): string {
  return `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

function formatTime(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
}

// 简单的字符串模板替换函数
function formatTemplate(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, key) => String(vars[key] || ''));
}

// 格式化操作描述
function formatActionDescription(action: any, i18n?: ChatBotProps['i18n']): string {
  const type = action.type;
  const payload = action.payload;
  
  switch (type) {
    case 'analysis': {
      // 分析结果 - MCP 返回的字段名: valid, orphans, deadEnds, invalidLinks
      const results: string[] = [];
      if (payload?.validate) {
        const v = payload.validate;
        // 计算问题总数 - MCP 字段: orphans, deadEnds, invalidLinks
        const orphanCount = v.orphans?.length || v.orphanNodes?.length || 0;
        const deadEndCount = v.deadEnds?.length || 0;
        const invalidLinkCount = v.invalidLinks?.length || 0;
        const totalIssues = orphanCount + deadEndCount + invalidLinkCount;
        
        // MCP 字段是 valid 而不是 isValid
        if (v.valid === true || v.isValid === true || totalIssues === 0) {
          results.push(`✅ ${i18n?.analysisValid || '结构验证通过'}`);
        } else {
          results.push(i18n?.analysisIssuesFound 
            ? formatTemplate(i18n.analysisIssuesFound, { totalIssues })
            : `⚠️ 发现 ${totalIssues} 个问题`);
        }
      }
      if (payload?.paths) {
        const p = payload.paths;
        // MCP 字段: pathCount, endingCount
        const totalPaths = p.pathCount || p.totalPaths || 0;
        const endings = p.endingCount || p.endings || 0;
        results.push(i18n?.analysisPaths
          ? formatTemplate(i18n.analysisPaths, { totalPaths, endings })
          : `📊 共 ${totalPaths} 条路径, ${endings} 个结局`);
      }
      if (payload?.dialogue) {
        const d = payload.dialogue;
        // MCP 字段: qualityScore
        const score = d.qualityScore !== undefined ? d.qualityScore : (d.averageQuality || d.quality || d.score);
        if (score !== undefined) {
          results.push(i18n?.analysisDialogueQuality
            ? formatTemplate(i18n.analysisDialogueQuality, { score })
            : `💬 对话质量: ${score}`);
        }
      }
      if (payload?.branch) {
        const b = payload.branch;
        // MCP 字段: distributionScore
        const score = b.distributionScore !== undefined ? b.distributionScore : (b.branchDensity || b.density || b.distribution);
        if (score !== undefined) {
          results.push(i18n?.analysisBranchDistribution
            ? formatTemplate(i18n.analysisBranchDistribution, { score })
            : `🌿 分支分布: ${score}`);
        }
      }
      if (payload?.score) {
        const s = payload.score;
        // MCP 字段: overallScore 或 score
        const score = s.overallScore || s.score || s.total || 'N/A';
        results.push(i18n?.analysisNonlinearScore
          ? formatTemplate(i18n.analysisNonlinearScore, { score })
          : `⭐ 非线性评分: ${score}`);
      }
      return results.join('; ') || (i18n?.analysisComplete || '分析完成');
    }
    
    case 'query-result': {
      const nodes = payload?.nodes || [];
      return i18n?.queryResult 
        ? formatTemplate(i18n.queryResult, { count: nodes.length })
        : `查询到 ${nodes.length} 个节点`;
    }
    
    case 'patch': {
      // 补丁操作
      const ops = payload?.operations || [];
      if (ops.length === 0) return i18n?.patchApplied || '已应用修改';
      const opTypes = ops.map((op: any) => op.op).join(', ');
      return `${i18n?.patchApplied || '已应用修改'}: ${opTypes}`;
    }
    
    case 'generate-image': {
      const imgType = payload?.imageType || payload?.type;
      const targetName = payload?.targetName;
      const typeLabel = imgType === 'sprite' ? (i18n?.sprite || '立绘')
        : imgType === 'avatar' ? (i18n?.avatar || '头像')
        : (i18n?.background || '背景');
      if (targetName) {
        return i18n?.generateImageWithName
          ? formatTemplate(i18n.generateImageWithName, { typeLabel, targetName })
          : `🎨 生成${typeLabel}: ${targetName}`;
      }
      return i18n?.generateImage
        ? formatTemplate(i18n.generateImage, { typeLabel })
        : `🎨 生成${typeLabel}`;
    }
    
    case 'error': {
      return `❌ ${payload?.message || (i18n?.operationFailed || '操作失败')}`;
    }
    
    default:
      return JSON.stringify(action).slice(0, 50) + '...';
  }
}

// 简单的 Markdown 加粗解析
function renderMessageContent(content: string) {
  const parts = content.split(/(\*\*.*?\*\*)/g);
  return parts.map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={index} className="font-bold">{part.slice(2, -2)}</strong>;
    }
    return part;
  });
}

// ============ 组件 ============

export function ChatBot({
  project,
  projectId,
  onUpdate,
  onGenerateSprite,
  onGenerateAvatar,
  onGenerateBackground,
  backendUrl,
  locale = 'zh-CN',
  i18n,
}: ChatBotProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [showActionIndicator, setShowActionIndicator] = useState(false);
  const [totalUsage, setTotalUsage] = useState({ promptTokens: 0, completionTokens: 0, totalTokens: 0 });
  
  // 高度调整相关
  const CHATBOT_HEIGHT_KEY = 'vng_chatbot_height';
  const DEFAULT_HEIGHT = 384; // h-96 = 384px
  const MIN_HEIGHT = 300;
  
  const getMaxHeight = useCallback(() => {
    if (typeof window === 'undefined') return DEFAULT_HEIGHT * 2;
    return window.innerHeight * 0.8; // 最大高度为屏幕的 80%
  }, []);
  
  const [chatHeight, setChatHeight] = useState(() => {
    if (typeof window === 'undefined') return DEFAULT_HEIGHT;
    const saved = localStorage.getItem(CHATBOT_HEIGHT_KEY);
    const maxH = getMaxHeight();
    return saved ? Math.max(MIN_HEIGHT, Math.min(maxH, parseInt(saved, 10))) : DEFAULT_HEIGHT;
  });
  
  const [isResizing, setIsResizing] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const resizeRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  
  const BACKEND_URL = backendUrl || process.env.NEXT_PUBLIC_INTELLI_SERVICES_URL || 'http://localhost:4000';
  
  // 滚动到底部
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);
  
  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);
  
  // 展开时聚焦输入框
  useEffect(() => {
    if (isExpanded) {
      inputRef.current?.focus();
    }
  }, [isExpanded]);
  
  // 处理生图动作 - 根据 targetId 从项目数据中找到目标
  const handleGenerateImageAction = useCallback(async (payload: { 
    imageType: string; 
    targetId: string; 
    targetName: string;
    prompt?: string;
  }) => {
    const { imageType, targetId, targetName, prompt } = payload;
    
    // 从项目数据中找到目标对象
    let target: any = null;
    if (imageType === 'sprite' || imageType === 'avatar') {
      target = project.characters?.find(c => c.id === targetId);
    } else if (imageType === 'background') {
      target = project.backgrounds?.find(b => b.id === targetId);
    }
    
    if (!target) {
      // 目标不存在（理论上后端已经验证过，这里是兜底）
      const errorMessage: ChatMessage = {
        id: generateId(),
        role: 'assistant',
        content: i18n?.targetNotFound 
          ? formatTemplate(i18n.targetNotFound, { name: targetName })
          : `❌ 找不到目标"${targetName}"，请检查是否已从项目中删除。`,
        timestamp: Date.now(),
        status: 'error',
      };
      setMessages(prev => [...prev, errorMessage]);
      return;
    }
    
    // 开始生成
    setIsGeneratingImage(true);
    const displayName = imageType === 'background' ? target.name : (target.displayName || target.name);
    
    // 根据类型选择对应的 i18n key
    let generatingTemplate: string;
    let generatedTemplate: string;
    if (imageType === 'sprite') {
      generatingTemplate = i18n?.generatingSprite || `🎨 正在为「{name}」生成立绘...`;
      generatedTemplate = i18n?.spriteGenerated || `✨ 「{name}」的立绘生成完成！`;
    } else if (imageType === 'avatar') {
      generatingTemplate = i18n?.generatingAvatar || `🎨 正在为「{name}」生成头像...`;
      generatedTemplate = i18n?.avatarGenerated || `✨ 「{name}」的头像生成完成！`;
    } else {
      generatingTemplate = i18n?.generatingBackground || `🎨 正在为「{name}」生成背景...`;
      generatedTemplate = i18n?.backgroundGenerated || `✨ 「{name}」的背景生成完成！`;
    }
    
    const statusMessage: ChatMessage = {
      id: generateId(),
      role: 'assistant',
      content: formatTemplate(generatingTemplate, { name: displayName }),
      timestamp: Date.now(),
      status: 'streaming',
    };
    setMessages(prev => [...prev, statusMessage]);
    
    try {
      if (imageType === 'sprite' && onGenerateSprite) {
        await onGenerateSprite(target);
      } else if (imageType === 'avatar' && onGenerateAvatar) {
        await onGenerateAvatar(target);
      } else if (imageType === 'background' && onGenerateBackground) {
        await onGenerateBackground(target);
      } else {
        throw new Error(i18n?.generationFailed?.split(':')[0] || '生图回调未配置');
      }
      
      // 更新消息状态
      setMessages(prev => prev.map(m => 
        m.id === statusMessage.id 
          ? { ...m, content: formatTemplate(generatedTemplate, { name: displayName }), status: 'done' as const }
          : m
      ));
    } catch (error) {
      console.error('[ChatBot] 生成图片失败:', error);
      const errorMsg = i18n?.generationFailed 
        ? formatTemplate(i18n.generationFailed, { error: (error as Error).message })
        : `❌ ${i18n?.operationFailed || '生成失败'}: ${(error as Error).message}`;
      setMessages(prev => prev.map(m => 
        m.id === statusMessage.id 
          ? { ...m, content: errorMsg, status: 'error' as const }
          : m
      ));
    } finally {
      setIsGeneratingImage(false);
    }
  }, [project, onGenerateSprite, onGenerateAvatar, onGenerateBackground, i18n]);
  
  // 应用动作到项目
  const applyAction = useCallback((action: { type: string; payload: any }) => {
    const { type, payload } = action;
    
    // 处理生图动作
    if (type === 'generate-image') {
      handleGenerateImageAction(payload);
      return;
    }
    
    // 处理错误消息
    if (type === 'error') {
      const errorMessage: ChatMessage = {
        id: generateId(),
        role: 'assistant',
        content: `⚠️ ${payload.message}`,
        timestamp: Date.now(),
        status: 'error',
      };
      setMessages(prev => [...prev, errorMessage]);
      return;
    }
    
    if (type !== 'patch' || !payload) return;
    
    const { action: actionType, ...data } = payload;
    
    setShowActionIndicator(true);
    setTimeout(() => setShowActionIndicator(false), 2000);
    
    switch (actionType) {
      case 'add-node': {
        const newScript = [...(project.script || []), data.node];
        onUpdate({ ...project, script: newScript });
        break;
      }
      
      case 'update-node': {
        const newScript = (project.script || []).map((node: StoryNode) => {
          if (node.id === data.nodeId) {
            return { ...node, ...data.updates };
          }
          return node;
        });
        onUpdate({ ...project, script: newScript });
        break;
      }
      
      case 'delete-node': {
        const newScript = (project.script || [])
          .filter((node: StoryNode) => node.id !== data.nodeId)
          .map((node: StoryNode) => ({
            ...node,
            nextNodeId: node.nextNodeId === data.nodeId ? undefined : node.nextNodeId,
            choices: node.choices?.filter((c: any) => c.targetNodeId !== data.nodeId),
          }));
        onUpdate({ ...project, script: newScript });
        break;
      }
      
      case 'connect-nodes': {
        const newScript = (project.script || []).map((node: StoryNode) => {
          if (node.id === data.sourceNodeId) {
            if (data.connectionType === 'next') {
              return { ...node, nextNodeId: data.targetNodeId };
            } else if (data.connectionType === 'choice') {
              const newChoice = {
                id: `choice-${Date.now()}`,
                text: data.choiceText || (i18n?.choiceDefault || '选项'),
                targetNodeId: data.targetNodeId,
              };
              return {
                ...node,
                choices: [...(node.choices || []), newChoice],
              };
            }
          }
          return node;
        });
        onUpdate({ ...project, script: newScript });
        break;
      }
      
      case 'generate-dialogue': {
        console.log('[ChatBot] 触发对白生成:', data);
        break;
      }
    }
  }, [project, onUpdate, handleGenerateImageAction, i18n]);
  
  // 发送消息（核心逻辑，支持重试）
  const sendMessageCore = useCallback(async (messageContent: string, userMessageId?: string) => {
    if (!messageContent.trim() || isLoading) return;
    
    const trimmedInput = messageContent.trim();
    
    // 如果不是重试，添加新的用户消息
    if (!userMessageId) {
      const userMessage: ChatMessage = {
        id: generateId(),
        role: 'user',
        content: trimmedInput,
        timestamp: Date.now(),
        status: 'done',
      };
      setMessages((prev) => [...prev, userMessage]);
      userMessageId = userMessage.id;
    }
    
    setInputValue('');
    setIsLoading(true);
    
    // 创建 AI 消息占位符
    const assistantMessageId = generateId();
    const assistantMessage: ChatMessage = {
      id: assistantMessageId,
      role: 'assistant',
      content: '',
      timestamp: Date.now(),
      status: 'streaming',
      actions: [],
    };
    
    setMessages((prev) => [...prev, assistantMessage]);
    
    // 取消之前的请求
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();
    
    try {
      const response = await fetch(`${BACKEND_URL}/api/game/editor-chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          projectId,
          message: trimmedInput,
          currentScript: project.script,
          characters: project.characters,
          backgrounds: project.backgrounds,
          projectTitle: project.title,
          locale,
        }),
        signal: abortControllerRef.current.signal,
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('No response body');
      }
      
      const decoder = new TextDecoder();
      let buffer = '';
      const collectedActions: any[] = [];
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n\n');
        buffer = lines.pop() || '';
        
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          
          try {
            const data = JSON.parse(line.slice(6));
            
            switch (data.event) {
              case 'thinking':
                // ✅ 添加思考步骤到消息
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantMessageId
                      ? { 
                          ...m, 
                          content: i18n?.thinking || '正在思考...',
                          thinkingSteps: [
                            ...(m.thinkingSteps || []),
                            {
                              stepIndex: data.stepIndex,
                              content: data.content,
                              timestamp: data.timestamp,
                            }
                          ]
                        }
                      : m
                  )
                );
                break;
                
              case 'tool_call':
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantMessageId
                      ? { 
                          ...m, 
                          content: i18n?.toolCall 
                            ? formatTemplate(i18n.toolCall, { tool: data.tool })
                            : `🔧 调用工具: ${data.tool}` 
                      }
                      : m
                  )
                );
                break;
                
              case 'message':
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantMessageId
                      ? { ...m, content: data.content }
                      : m
                  )
                );
                break;
                
              case 'action':
                collectedActions.push(data);
                // 自动应用动作
                applyAction(data);
                break;
                
              case 'usage':
                // ✅ 添加 Token 使用信息到当前消息
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantMessageId
                      ? { 
                          ...m, 
                          usage: {
                            promptTokens: data.promptTokens,
                            completionTokens: data.completionTokens,
                            totalTokens: data.totalTokens,
                          }
                        }
                      : m
                  )
                );
                // ✅ 累加会话总计 Token
                setTotalUsage((prev) => ({
                  promptTokens: prev.promptTokens + (data.promptTokens || 0),
                  completionTokens: prev.completionTokens + (data.completionTokens || 0),
                  totalTokens: prev.totalTokens + (data.totalTokens || 0),
                }));
                break;
              
              case 'done':
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantMessageId
                      ? { ...m, status: 'done', actions: collectedActions }
                      : m
                  )
                );
                break;
                
              case 'error':
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantMessageId
                      ? { ...m, content: `❌ ${data.message}`, status: 'error' }
                      : m
                  )
                );
                break;
            }
          } catch (parseError) {
            console.warn('[ChatBot] 解析 SSE 数据失败:', parseError);
          }
        }
      }
    } catch (error) {
      if ((error as Error).name === 'AbortError') {
        return;
      }
      
      console.error('[ChatBot] 发送消息失败:', error);
      const errorMsg = i18n?.sendFailed 
        ? formatTemplate(i18n.sendFailed, { error: (error as Error).message })
        : `❌ ${i18n?.operationFailed || '生成失败'}: ${(error as Error).message}`;
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantMessageId
            ? {
                ...m,
                content: errorMsg,
                status: 'error',
              }
            : m
        )
      );
    } finally {
      setIsLoading(false);
    }
  }, [isLoading, projectId, project, BACKEND_URL, applyAction, i18n, locale]);
  
  // 发送新消息
  const sendMessage = useCallback(async () => {
    await sendMessageCore(inputValue);
  }, [inputValue, sendMessageCore]);
  
  // 重试用户消息
  const retryMessage = useCallback(async (userMessage: ChatMessage) => {
    if (isLoading) return;
    
    // 找到这条用户消息后面的 AI 回复并移除
    setMessages(prev => {
      const userMsgIndex = prev.findIndex(m => m.id === userMessage.id);
      if (userMsgIndex === -1) return prev;
      
      // 移除用户消息之后的所有消息（包括 AI 回复）
      return prev.slice(0, userMsgIndex + 1);
    });
    
    // 重新发送
    await sendMessageCore(userMessage.content, userMessage.id);
  }, [isLoading, sendMessageCore]);
  
  // 处理键盘事件
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }, [sendMessage]);
  
  // 高度调整逻辑
  useEffect(() => {
    if (!isResizing) return;
    
    let currentHeight = chatHeight;
    
    const handleMouseMove = (e: MouseEvent) => {
      // 计算新高度：从底部到鼠标位置
      const newHeight = window.innerHeight - e.clientY;
      const maxH = getMaxHeight();
      const clampedHeight = Math.max(MIN_HEIGHT, Math.min(maxH, newHeight));
      currentHeight = clampedHeight;
      setChatHeight(clampedHeight);
    };
    
    const handleMouseUp = () => {
      setIsResizing(false);
      // 保存到 localStorage
      if (typeof window !== 'undefined') {
        localStorage.setItem(CHATBOT_HEIGHT_KEY, currentHeight.toString());
      }
    };
    
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing, chatHeight, MIN_HEIGHT, getMaxHeight]);
  
  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  }, []);
  
  // 窗口大小变化时，调整高度不超过最大值
  useEffect(() => {
    const handleResize = () => {
      const maxH = getMaxHeight();
      if (chatHeight > maxH) {
        setChatHeight(maxH);
        if (typeof window !== 'undefined') {
          localStorage.setItem(CHATBOT_HEIGHT_KEY, maxH.toString());
        }
      }
    };
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [chatHeight, getMaxHeight]);
  
  return (
    <div className="fixed bottom-0 left-0 z-50 flex items-end">
      {/* 展开/收起按钮 */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className={`flex items-center justify-center transition-all duration-300 ${
          isExpanded 
            ? 'w-12 h-12 mb-4 ml-4 bg-white border border-slate-200 rounded-full shadow-lg hover:shadow-xl hover:bg-slate-50' 
            : 'w-12 h-12 mb-4 ml-4 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full shadow-lg hover:shadow-xl hover:scale-105'
        }`}
      >
        {isExpanded ? (
          <ChevronDown className="w-5 h-5 text-slate-500" />
        ) : (
          <Sparkles className="w-5 h-5 text-white" />
        )}
      </button>
      
      {/* 聊天面板 - 1/3 屏幕宽度 */}
      <div
        className={`bg-white border border-slate-200 shadow-2xl transition-all duration-300 ease-in-out rounded-tr-xl overflow-hidden flex flex-col ${
          isExpanded ? 'w-[33vw] min-w-[360px] max-w-[480px] opacity-100' : 'w-0 h-0 opacity-0'
        }`}
        style={isExpanded ? { height: `${chatHeight}px` } : undefined}
      >
        {isExpanded && (
          <>
            {/* 拖拽调整高度的条 */}
            <div
              ref={resizeRef}
              onMouseDown={handleResizeStart}
              className={`h-5 w-full bg-slate-100 hover:bg-indigo-100 cursor-ns-resize flex items-center justify-center border-b border-slate-300 transition-colors shrink-0 z-10 select-none ${
                isResizing ? 'bg-indigo-200' : ''
              }`}
              title={i18n?.resizeHeight || '拖拽调整高度'}
            >
              <div className="w-12 h-1.5 bg-slate-400 rounded-full" />
            </div>

            {/* 头部栏 */}
            <div className="h-12 px-4 flex items-center justify-between border-b border-slate-100 bg-gradient-to-r from-indigo-50 to-purple-50 shrink-0">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                  <Sparkles className="w-3.5 h-3.5 text-white" />
                </div>
                <div>
                  <span className="font-semibold text-slate-800 text-sm">
                    {i18n?.title || 'AI 编辑助手'}
                  </span>
                  {showActionIndicator && (
                    <span className="ml-2 inline-flex items-center gap-1 text-xs text-green-600 animate-pulse">
                      <CheckCircle2 className="w-3 h-3" />
                      {i18n?.actionApplied || '已应用'}
                    </span>
                  )}
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                {(isLoading || isGeneratingImage) && (
                  <Loader2 className="w-4 h-4 animate-spin text-indigo-500" />
                )}
              </div>
            </div>
            
            {/* 聊天内容区 */}
            <div className="flex flex-col flex-1 min-h-0">
              {/* 消息列表 */}
              <div className="flex-1 overflow-y-auto p-3 space-y-3">
                {messages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-slate-400">
                    <Bot className="w-10 h-10 mb-2 opacity-50" />
                    <p className="text-sm text-center px-4">
                      {i18n?.noMessages || '你好！我可以帮你编辑剧情、分析剧本、生成立绘和背景。'}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2 justify-center">
                      <span className="px-2 py-1 bg-slate-100 rounded text-xs">{i18n?.exampleAddScene || '添加新场景'}</span>
                      <span className="px-2 py-1 bg-slate-100 rounded text-xs">{i18n?.exampleGenerateSprite || '给小红生成立绘'}</span>
                      <span className="px-2 py-1 bg-slate-100 rounded text-xs">{i18n?.exampleCheckStructure || '检查结构'}</span>
                    </div>
                  </div>
                ) : (
                  messages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`flex gap-2 ${
                        msg.role === 'user' ? 'flex-row-reverse' : ''
                      }`}
                    >
                      {/* 头像 */}
                      <div
                        className={`flex-shrink-0 w-7 h-7 rounded flex items-center justify-center ${
                          msg.role === 'user'
                            ? 'bg-indigo-100'
                            : 'bg-gradient-to-br from-indigo-500 to-purple-600'
                        }`}
                      >
                        {msg.role === 'user' ? (
                          <User className="w-3.5 h-3.5 text-indigo-600" />
                        ) : (
                          <Bot className="w-3.5 h-3.5 text-white" />
                        )}
                      </div>
                      
                      {/* 消息内容 */}
                      <div
                        className={`max-w-[80%] rounded-xl px-3 py-2 ${
                          msg.role === 'user'
                            ? 'bg-indigo-500 text-white'
                            : 'bg-slate-100 text-slate-800'
                        }`}
                      >
                        <p className="text-sm whitespace-pre-wrap leading-relaxed">
                          {renderMessageContent(msg.content)}
                        </p>
                        
                        {/* 思考过程显示 */}
                        {msg.thinkingSteps && msg.thinkingSteps.length > 0 && msg.role === 'assistant' && (() => {
                          // 过滤掉空内容的步骤
                          const validSteps = msg.thinkingSteps.filter(step => step.content && step.content.trim());
                          if (validSteps.length === 0) return null;
                          
                          return (
                            <details className="mt-1.5 pt-1.5 border-t border-slate-200/50">
                              <summary className="text-xs text-slate-500 cursor-pointer hover:text-slate-700 flex items-center gap-1">
                                <Sparkles className="w-3 h-3" />
                                {i18n?.thinkingStepsLabel || '思考步骤'} ({validSteps.length})
                              </summary>
                              <div className="mt-1 space-y-1 pl-4">
                                {validSteps.map((step, idx) => (
                                  <div key={idx} className="text-xs text-slate-600 border-l-2 border-slate-300 pl-2 py-0.5">
                                    <span className="font-medium">{i18n?.stepLabel || '步骤'} {(typeof step.stepIndex === 'number' ? step.stepIndex : idx) + 1}: </span>
                                    <span className="whitespace-pre-wrap">{renderMessageContent(step.content)}</span>
                                  </div>
                                ))}
                              </div>
                            </details>
                          );
                        })()}
                        
                        {/* Token 使用信息 */}
                        {msg.usage && msg.role === 'assistant' && (
                          <div className="mt-1.5 pt-1.5 border-t border-slate-200/50 text-xs text-slate-400 flex items-center gap-1.5">
                            <span className="opacity-70">📊</span>
                            <span className="text-blue-500">{msg.usage.promptTokens.toLocaleString()}</span>
                            <span className="opacity-50">{i18n?.tokenInput || 'in'}</span>
                            <span className="opacity-50">+</span>
                            <span className="text-green-500">{msg.usage.completionTokens.toLocaleString()}</span>
                            <span className="opacity-50">{i18n?.tokenOutput || 'out'}</span>
                            <span className="opacity-50">=</span>
                            <span className="font-medium text-slate-600">{msg.usage.totalTokens.toLocaleString()}</span>
                            <span className="opacity-50">{i18n?.tokenTotal || 'tokens'}</span>
                          </div>
                        )}
                        
                        {/* 动作指示器 - 显示详细内容 */}
                        {msg.actions && msg.actions.length > 0 && (
                          <div className="mt-1.5 pt-1.5 border-t border-slate-200/50 space-y-1">
                            <p className="text-xs text-slate-500 flex items-center gap-1 mb-1">
                              <CheckCircle2 className="w-3 h-3 text-green-500" />
                              {i18n?.operationsExecuted 
                                ? formatTemplate(i18n.operationsExecuted, { count: msg.actions.length })
                                : `已执行 ${msg.actions.length} 个操作`}
                            </p>
                            {/* 显示每个操作的详情 */}
                            <div className="space-y-0.5">
                              {msg.actions.map((action: any, idx: number) => (
                                <div key={idx} className="text-xs text-slate-500 pl-4 flex items-start gap-1">
                                  <span className="text-slate-400">•</span>
                                  <span>{formatActionDescription(action, i18n)}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        
                        {/* 时间戳和重试按钮 */}
                        <div
                          className={`text-xs mt-1 flex items-center gap-2 ${
                            msg.role === 'user' ? 'text-indigo-200 justify-end' : 'text-slate-400'
                          }`}
                        >
                          <span>{formatTime(msg.timestamp)}</span>
                          {msg.status === 'streaming' && (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          )}
                          {msg.status === 'error' && (
                            <AlertCircle className="w-3 h-3 text-red-400" />
                          )}
                          {/* 用户消息重试按钮 */}
                          {msg.role === 'user' && msg.status === 'done' && !isLoading && (
                            <button
                              onClick={() => retryMessage(msg)}
                              className="p-0.5 hover:bg-white/20 rounded transition-colors"
                              title={i18n?.retry || '重试'}
                            >
                              <RotateCcw className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                )}
                <div ref={messagesEndRef} />
              </div>
              
              {/* 输入区 */}
              <div className="p-2 border-t border-slate-100 bg-slate-50">
                <div className="flex gap-2">
                  <textarea
                    ref={inputRef}
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={i18n?.placeholder || '输入消息...'}
                    className="flex-1 px-3 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm bg-white resize-none"
                    disabled={isLoading || isGeneratingImage}
                    rows={1}
                    style={{ minHeight: '38px', maxHeight: '80px' }}
                  />
                  <button
                    onClick={sendMessage}
                    disabled={!inputValue.trim() || isLoading || isGeneratingImage}
                    className="px-3 py-2 rounded-lg bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-medium text-sm hover:from-indigo-600 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center"
                  >
                    {isLoading || isGeneratingImage ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Send className="w-4 h-4" />
                    )}
                  </button>
                </div>
                
                {/* 会话总计 Token 统计 */}
                {totalUsage.totalTokens > 0 && (
                  <div className="mt-2 pt-2 border-t border-slate-200/50 flex items-center justify-center gap-2 text-xs">
                    <span className="text-slate-400">📊 {i18n?.sessionTokens || '会话总计'}:</span>
                    <span className="text-blue-500 font-medium">{totalUsage.promptTokens.toLocaleString()}</span>
                    <span className="text-slate-300">{i18n?.tokenInput || 'in'}</span>
                    <span className="text-slate-300">+</span>
                    <span className="text-green-500 font-medium">{totalUsage.completionTokens.toLocaleString()}</span>
                    <span className="text-slate-300">{i18n?.tokenOutput || 'out'}</span>
                    <span className="text-slate-300">=</span>
                    <span className="font-semibold text-indigo-600">{totalUsage.totalTokens.toLocaleString()}</span>
                    <span className="text-slate-400">{i18n?.tokenTotal || 'tokens'}</span>
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default ChatBot;
