"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Button,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  useToast,
} from "@vng/ui";
import {
  Sparkles,
  FolderOpen,
  Zap,
  Settings,
  Users,
  Map,
  BookOpen,
  Globe2,
  Loader2,
  BrainCircuit,
  Edit3,
  X,
  Check,
  StopCircle,
} from "lucide-react";
import type { Character, Scene, ThemeSetting, WorldSetting } from "@vng/core";
import { useI18N } from "@/components/I18nProvider";

type ProgressStage =
  | "init"
  | "planning"
  | "planning_round1"
  | "planning_round2"
  | "planning_round3"
  | "plan_validate"
  | "writing"
  | "reviewing"
  | "rewriting"
  | "finalizing"
  | "fallback"
  | "completed"
  | "failed";

interface DraftData {
  projectTitle: string;
  summary?: string;
  hook?: string;
  creativeDirection?: string;
  worldSetting: WorldSetting;
  themeSetting: ThemeSetting;
  characters: Character[];
  scenes: Scene[];
}

interface AgentProgressEvent {
  stage: ProgressStage;
  action: string;
  status: "started" | "in_progress" | "completed" | "failed";
  progress?: number;
  message?: string;
  details?: Record<string, any>;
  timestamp: number;
}

type AgentEventPayload =
  | ({ event: "progress" } & AgentProgressEvent)
  | {
      event: "session";
      sessionId: string;
      status: "started" | "ended";
      message?: string;
      elapsedTime?: number;
    }
  | {
      event: "result";
      success: boolean;
      mode: string;
      data: { id: string; title: string };
    }
  | { event: "error"; success: false; error: string };

export default function Home() {
  const router = useRouter();
  const toast = useToast();
  const ideaRef = useRef<string>("");
  const [quickPrompt, setQuickPrompt] = useState("");
  ideaRef.current = quickPrompt;
  const [isQuickGenerating, setIsQuickGenerating] = useState(false);
  const [isAgentGenerating, setIsAgentGenerating] = useState(false);
  const [isDraftGenerating, setIsDraftGenerating] = useState(false);
  const [draftData, setDraftData] = useState<DraftData | null>(null);
  const [draftCached, setDraftCached] = useState(false);
  const [progressEvents, setProgressEvents] = useState<AgentProgressEvent[]>(
    [],
  );
  const [sessionStatus, setSessionStatus] = useState<
    "idle" | "running" | "success" | "error"
  >("idle");
  const [sessionInfo, setSessionInfo] = useState<{
    sessionId?: string;
    message?: string;
  }>({});
  const [finalProject, setFinalProject] = useState<{
    id: string;
    title: string;
  } | null>(null);
  const finalProjectRef = useRef<{ id: string; title: string } | null>(null);
  const [redirectCountdown, setRedirectCountdown] = useState<number | null>(
    null,
  );
  const redirectTimerRef = useRef<NodeJS.Timeout | null>(null);
  const controllerRef = useRef<AbortController | null>(null);
  const draftSectionRef = useRef<HTMLDivElement | null>(null);
  const agentsSectionRef = useRef<HTMLDivElement | null>(null);
  const progressListRef = useRef<HTMLDivElement | null>(null);
  const agentsSectionVisibleRef = useRef(false);
  const [lastLocale, setLastLocale] = useState("zh-CN");
  const [thinkingContent, setThinkingContent] = useState<string>("");
  const thinkingContentRef = useRef<HTMLDivElement | null>(null);
  const { t } = useI18N();

  // 编辑对话框状态
  const [editingField, setEditingField] = useState<{
    path: string;
    label: string;
    value: string;
    multiline?: boolean;
  } | null>(null);

  const stageLabels: Record<ProgressStage, string> = {
    init: t("key.home.agent.stage.init"),
    planning: t("key.home.agent.stage.planning"),
    planning_round1: t("key.home.agent.stage.planning_round1"),
    planning_round2: t("key.home.agent.stage.planning_round2"),
    planning_round3: t("key.home.agent.stage.planning_round3"),
    plan_validate: t("key.home.agent.stage.plan_validate"),
    writing: t("key.home.agent.stage.writing"),
    reviewing: t("key.home.agent.stage.reviewing"),
    rewriting: t("key.home.agent.stage.rewriting"),
    finalizing: t("key.home.agent.stage.finalizing"),
    fallback: t("key.home.agent.stage.fallback"),
    completed: t("key.home.agent.stage.completed"),
    failed: t("key.home.agent.stage.failed"),
  };

  useEffect(() => {
    // setMounted(true);
    if (!parseInt(sessionStorage.getItem("isAutoShownToolbarDocs") || "0")) {
      setTimeout(
        () => window.dispatchEvent(new CustomEvent("FloatingToolbar:OpenDocs")),
        1000,
      );
      sessionStorage.setItem("isAutoShownToolbarDocs", "1");
    }
  }, []);

  useEffect(() => {
    return () => {
      controllerRef.current?.abort();
      if (redirectTimerRef.current) {
        clearInterval(redirectTimerRef.current);
      }
    };
  }, []);

  const getUserLocale = () => {
    if (typeof window === "undefined") return "zh-CN";
    return new URLSearchParams(window.location.search).get("locale") || "zh-CN";
  };

  const clearRedirectCountdown = () => {
    if (redirectTimerRef.current) {
      clearInterval(redirectTimerRef.current);
      redirectTimerRef.current = null;
    }
    setRedirectCountdown(null);
  };

  const updateFinalProject = (
    project: { id: string; title: string } | null,
  ) => {
    finalProjectRef.current = project;
    setFinalProject(project);
  };

  const startRedirectCountdown = () => {
    if (!finalProjectRef.current) return;
    clearRedirectCountdown();
    setRedirectCountdown(5);
    redirectTimerRef.current = setInterval(() => {
      setRedirectCountdown((prev) => {
        if (prev === null) return null;
        if (prev <= 1) {
          clearRedirectCountdown();
          const project = finalProjectRef.current;
          if (project) {
            router.push(`/generate-assets?projectId=${project.id}`);
          }
          return null;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const handleViewProject = () => {
    if (!finalProjectRef.current) return;
    clearRedirectCountdown();
    router.push(`/generate-assets?projectId=${finalProjectRef.current.id}`);
  };

  /**
   * 中断当前生成流程
   * 向后端发送中断请求，同时中止本地 SSE 连接
   */
  const handleAbortGeneration = async () => {
    const sessionId = sessionInfo.sessionId;
    
    // 中止本地 SSE 连接
    if (controllerRef.current) {
      controllerRef.current.abort();
      controllerRef.current = null;
    }
    
    // 更新状态
    setIsQuickGenerating(false);
    setIsAgentGenerating(false);
    setIsDraftGenerating(false);
    setSessionStatus("idle");
    
    // 向后端发送中断请求
    if (sessionId) {
      try {
        await fetch("/api/game/abort-generation", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId }),
        });
        toast.info(t("key.home.toast.generationAborted") || "生成已中断");
      } catch (error) {
        console.warn("中断请求失败:", error);
      }
    }
    
    // 添加一个中断的进度事件
    setProgressEvents(prev => [...prev, {
      stage: "failed" as ProgressStage,
      action: "用户中断",
      status: "failed",
      message: "生成流程已被用户中断",
      timestamp: Date.now(),
    }]);
  };

  const resetAgentFlow = (options?: { keepDraft?: boolean }) => {
    controllerRef.current?.abort();
    controllerRef.current = null;
    if (!options?.keepDraft) {
      setDraftData(null);
    }
    setDraftCached(false);
    setProgressEvents([]);
    setSessionStatus("idle");
    setSessionInfo({});
    updateFinalProject(null);
    clearRedirectCountdown();
  };
  const agentStatusMeta = {
    idle: {
      label: t("key.home.agent.status.idle"),
      className: "bg-slate-100 text-slate-600",
    },
    running: {
      label: t("key.home.agent.status.running"),
      className: "bg-indigo-100 text-indigo-700",
    },
    success: {
      label: t("key.home.agent.status.success"),
      className: "bg-emerald-100 text-emerald-700",
    },
    error: {
      label: t("key.home.agent.status.error"),
      className: "bg-rose-100 text-rose-700",
    },
  }[sessionStatus];
  const recentProgressEvents = progressEvents.slice(-20);
  const showDraftSection = Boolean(draftData) || isDraftGenerating;
  const showDraftLoading = isDraftGenerating && !draftData;
  const [showFastScriptLoading, setShowFastScriptLoading] = useState(false);
  const shouldShowAgentsProgress =
    Boolean(draftData) &&
    (recentProgressEvents.length > 0 ||
      sessionStatus === "error" ||
      sessionStatus === "success" ||
      Boolean(finalProject));

  useEffect(() => {
    if (draftData && draftSectionRef.current) {
      draftSectionRef.current.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }
  }, [draftData]);

  useEffect(() => {
    if (shouldShowAgentsProgress && !agentsSectionVisibleRef.current) {
      agentsSectionVisibleRef.current = true;
      agentsSectionRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    } else if (!shouldShowAgentsProgress) {
      agentsSectionVisibleRef.current = false;
    }
  }, [shouldShowAgentsProgress]);

  useEffect(() => {
    if (progressListRef.current) {
      progressListRef.current.scrollTop = progressListRef.current.scrollHeight;
    }
  }, [recentProgressEvents]);

  // 思考内容自动滚动到底部
  useEffect(() => {
    if (thinkingContentRef.current && thinkingContent) {
      thinkingContentRef.current.scrollTop = thinkingContentRef.current.scrollHeight;
    }
  }, [thinkingContent]);

  /**
   * ============================================================
   * SSE 事件处理器（智能体模式专用）
   * ============================================================
   *
   * 处理来自 /api/game/generate-by-agents 的实时事件推送
   *
   * 事件类型：
   * 1. 'progress' - 进度事件（最频繁）
   *    - 智能体工作进度更新（规划中/写作中/评审中等）
   *    - 添加到 progressEvents 数组，供 UI 展示
   *    - 不终止流
   *
   * 2. 'session' - 会话状态事件
   *    - sessionId: 会话唯一标识
   *    - status: 'started' | 'ended'
   *    - 'ended' 时标记为成功（如果之前无错误）
   *    - 不终止流
   *
   * 3. 'result' - 最终结果事件
   *    - 包含完整剧本数据（projectId, title等）
   *    - 保存项目信息，启动跳转倒计时
   *    - 终止流
   *
   * 4. 'error' - 错误事件
   *    - 智能体生成过程中的业务错误
   *    - 标记为错误状态，显示错误提示
   *    - 终止流
   *
   * @param payload - SSE 事件载荷
   * @returns boolean - true 表示应终止流，false 表示继续接收
   */
  const handleAgentEvent = (payload: AgentEventPayload) => {
    // ========== 进度事件 ==========
    if (payload.event === "progress") {
      setProgressEvents((prev) => [...prev, payload]); // 追加进度事件
      setSessionStatus((prev) => (prev === "error" ? prev : "running")); // 保持运行状态（除非已错误）
      return false; // 继续接收
    }

    // ========== 会话状态事件 ==========
    if (payload.event === "session") {
      setSessionInfo({
        sessionId: payload.sessionId,
        message: payload.message,
      });
      if (payload.status === "ended" && sessionStatus !== "error") {
        setSessionStatus("success"); // 会话正常结束
      }
      return false; // 继续接收（可能还有 result 事件）
    }

    // ========== 最终结果事件 ==========
    if (payload.event === "result") {
      if (payload.data?.id) {
        const projectData = { id: payload.data.id, title: payload.data.title };
        updateFinalProject(projectData); // 保存项目信息
        setSessionStatus("success");
        toast.success(
          t("key.home.toast.generateSuccess"),
          t("key.home.toast.autoRedirect"),
        );
        startRedirectCountdown(); // 启动5秒倒计时跳转
      }
      return true; // 终止流
    }

    // ========== 错误事件 ==========
    if (payload.event === "error") {
      setSessionStatus("error");
      toast.error(
        t("key.home.toast.agentFailed"),
        payload.error || t("key.home.toast.retryPrompt"),
      );
      return true; // 终止流
    }

    return false; // 未知事件类型，继续接收
  };

  /**
   * ============================================================
   * SSE 流式响应处理（智能体模式专用）
   * ============================================================
   *
   * 解析 Server-Sent Events (SSE) 流，实时更新进度
   *
   * SSE 格式：
   * ```
   * data: {"event":"progress","stage":"planning","message":"..."}
   *
   * data: {"event":"result","data":{"id":"xxx","title":"..."}}
   *
   * ```
   *
   * 处理流程：
   * 1. 使用 ReadableStream 逐块读取响应体
   * 2. 按 '\n\n' 分割事件
   * 3. 提取 'data:' 后的 JSON 并解析
   * 4. 调用 handleAgentEvent 处理事件
   * 5. 收到终止信号（result/error）时停止读取
   *
   * 错误处理：
   * - 无响应体：抛出错误，重置状态
   * - JSON 解析失败：警告日志，跳过该事件，继续接收
   *
   * @param response - fetch 返回的 Response 对象
   */
  const streamAgentResponse = async (response: Response) => {
    // ========== 前置检查 ==========
    if (!response.body) {
      setIsQuickGenerating(false);
      setIsAgentGenerating(false);
      throw new Error("无法建立智能体 SSE 连接");
    }

    // ========== 初始化流读取器 ==========
    const reader = response.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let buffer = ""; // 缓冲区，存储未完成的数据
    let shouldStop = false; // 终止标志

    // ========== 循环读取流 ==========
    while (!shouldStop) {
      const { value, done } = await reader.read();
      if (done) break; // 流结束

      // 解码并追加到缓冲区
      buffer += decoder.decode(value, { stream: true });

      // 按 '\n\n' 分割事件
      let boundary = buffer.indexOf("\n\n");
      while (boundary !== -1) {
        const chunk = buffer.slice(0, boundary).trim();
        buffer = buffer.slice(boundary + 2); // 移除已处理部分

        // 解析 SSE 事件
        if (chunk.startsWith("data:")) {
          const dataStr = chunk.replace(/^data:\s*/, "");
          if (dataStr) {
            try {
              const payload = JSON.parse(dataStr) as AgentEventPayload;
              const shouldTerminate = handleAgentEvent(payload);
              if (shouldTerminate) {
                shouldStop = true; // 收到终止信号
                break;
              }
            } catch (error) {
              console.warn("解析 SSE 事件失败:", error);
              // 继续处理下一个事件
            }
          }
        }
        boundary = buffer.indexOf("\n\n");
      }
    }

    // ========== 处理剩余数据 ==========
    const trimmed = buffer.trim();
    if (trimmed.startsWith("data:")) {
      try {
        const payload = JSON.parse(
          trimmed.replace(/^data:\s*/, ""),
        ) as AgentEventPayload;
        handleAgentEvent(payload);
      } catch (error) {
        console.warn("解析剩余 SSE 数据失败:", error);
      }
    }

    // ========== 清理资源 ==========
    await reader.cancel().catch(() => {});
  };
  /**
   * ============================================================
   * 剧本生成接口调用 - 支持两种模式和自动重试
   * ============================================================
   *
   * @param draft - 设定草稿数据（角色/世界观/场景/主题）
   * @param locale - 用户语言
   * @param mode - 生成模式：
   *   - 'fast': 快速模式，单次LLM调用，约1min完成
   *   - 'agent': 智能体模式，多智能体协作+SSE实时进度，约5min完成
   * @param time - 当前重试次数（从1开始）
   *
   * 重试机制：
   * - 当 response.ok 为 false（HTTP 4xx/5xx）时自动重试
   * - 最多重试3次，第4次失败时抛出错误并重置状态
   * - 重试时递归调用自己，保持原 mode 和 draft 参数
   *
   * 状态管理：
   * - sessionStatus: 'running' - 会话运行中
   * - showFastScriptLoading: true - 快速模式专用加载UI
   * - 成功后路由跳转或触发 SSE 流式响应
   *
   * 错误处理：
   * - 超过3次重试：抛出错误，外层 catch 处理
   * - HTTP错误：自动重试，不向外抛出
   * - result.success === false：显示错误提示，不抛出（由调用方 finally 清理状态）
   */
  const requestScriptsGeneration = async (
    draft: DraftData,
    locale: string,
    mode = "fast",
  ) => {
    // ========== 初始化状态 ==========
    setSessionStatus("running");
    const controller = new AbortController();
    controllerRef.current = controller; // 存储到 ref，支持用户手动取消
    toast.info(
      t("key.home.toast.connectService"),
      t("key.home.toast.serviceMode", { mode }),
    );

    // 快速模式开启专用加载UI
    if (mode === "fast") {
      setShowFastScriptLoading(true);
    }

    let response;
    let lastError;
    let success = false;

    // ========== 循环重试逻辑 ==========
    // 最多重试 3 次
    for (let i = 0; i < 3; i++) {
      try {
        // 非首次尝试增加延迟
        if (i > 0) {
          console.log(`[Script] 准备第 ${i + 1} 次重试...`);
          await new Promise((resolve) => setTimeout(resolve, 100));

          // 检查是否已被用户取消
          if (controller.signal.aborted) {
            throw new DOMException("Aborted", "AbortError");
          }
        }

        // 发起请求
        response = await fetch("/api/game/generate-by-agents", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            idea: ideaRef.current,
            characters: draft.characters,
            worldSetting: draft.worldSetting,
            scenes: draft.scenes,
            themeSetting: draft.themeSetting,
            locale,
            mode,
          }),
          signal: controller.signal, // 支持手动取消
        });

        // 检查响应状态
        if (response.ok) {
          success = true;
          break; // 成功则跳出循环
        }

        // 记录错误并准备重试
        const errorPayload = await response.json().catch(() => ({}));
        lastError = new Error(
          errorPayload.error || `请求失败 (Status: ${response.status})`,
        );
        console.error("[智能体服务重连中]", lastError.message);
      } catch (error) {
        // 如果是用户取消，直接抛出，不再重试
        if (error instanceof DOMException && error.name === "AbortError") {
          throw error;
        }

        lastError = error instanceof Error ? error : new Error("网络请求异常");
        console.warn(`[Script] 第 ${i + 1} 次生成尝试失败:`, lastError);
      }
    }

    // ========== 失败处理 ==========
    if (!success || !response) {
      // 超过3次重试，重置所有加载状态并抛出错误
      setIsQuickGenerating(false);
      setIsAgentGenerating(false);
      setShowFastScriptLoading(false);
      throw lastError || new Error("智能体服务异常 (generate-by-agents)");
    }

    // ========== 成功响应处理 ==========
    if (mode === "fast") {
      // --- 快速模式：SSE 流式响应，带 thinking 输出 ---
      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error("无法建立流式连接");
      }

      const decoder = new TextDecoder("utf-8");
      let buffer = "";
      let scriptResult: any = null;

      // 清空之前的 thinking 内容
      setThinkingContent("");

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // 按 '\n\n' 分割事件
        let boundary = buffer.indexOf("\n\n");
        while (boundary !== -1) {
          const chunk = buffer.slice(0, boundary).trim();
          buffer = buffer.slice(boundary + 2);

          if (chunk.startsWith("data:")) {
            const dataStr = chunk.replace(/^data:\s*/, "");
            if (dataStr) {
              try {
                const payload = JSON.parse(dataStr);

                // 处理 thinking 事件
                if (payload.event === "thinking" && payload.content) {
                  setThinkingContent((prev) => prev + payload.content);
                }

                // 处理 content 事件（思考完成）
                if (payload.event === "content") {
                  console.log("[Script] ✅ 思考完成，开始生成剧本...");
                }

                // 处理 result 事件
                if (payload.event === "result") {
                  scriptResult = payload;
                }

                // 处理 error 事件
                if (payload.event === "error") {
                  throw new Error(payload.error || "剧本生成失败");
                }
              } catch (parseError) {
                if ((parseError as Error).message !== "剧本生成失败") {
                  console.warn("解析 SSE 事件失败:", parseError);
                } else {
                  throw parseError;
                }
              }
            }
          }
          boundary = buffer.indexOf("\n\n");
        }
      }

      // 清空 thinking 内容
      setThinkingContent("");
      setIsQuickGenerating(false);
      setShowFastScriptLoading(false);

      if (scriptResult?.success) {
        // 生成成功，跳转到视觉素材生成页面
        toast.success(
          t("key.home.toast.scriptSuccess"),
          t("key.home.toast.redirecting"),
        );
        setTimeout(() => {
          router.push(`/generate-assets?projectId=${scriptResult.data.id}`);
        }, 2000);
      } else {
        // 生成失败
        toast.error(
          t("key.home.toast.generateFailed"),
          scriptResult?.error || t("key.home.toast.retryPrompt"),
        );
      }
    } else {
      // --- 智能体模式：SSE 流式响应，实时进度推送 ---
      // streamAgentResponse 内部会更新 progressEvents 和 sessionStatus
      await streamAgentResponse(response);
    }
  };
  const generateModeRef = useRef<"fast" | "agent">("fast");
  /**
   * ============================================================
   * 完整创作流程：从创意到剧本（两阶段）
   * ============================================================
   *
   * 流程：
   * 1. 【草稿阶段】调用 /api/game/idea-to-draft
   *    - 输入：用户的故事创意描述（quickPrompt）
   *    - 输出：设定草稿（角色/世界观/场景/主题）
   *    - 支持缓存，相同创意会复用历史草稿
   *
   * 2. 【剧本阶段】调用 requestScriptsGeneration
   *    - 输入：草稿数据
   *    - 输出：完整剧本（多智能体协作生成的节点树）
   *
   * @param mode - 生成模式（'fast' 或 'agent'）
   *
   * 状态管理：
   * - isDraftGenerating: 草稿生成中（整个流程都为true，在finally统一关闭）
   * - isQuickGenerating: 快速模式生成中
   * - isAgentGenerating: 智能体模式生成中
   * - showFastScriptLoading: 快速模式专用加载UI
   *
   * 错误处理：
   * - 草稿失败：立即 throw，进入 catch，显示错误，重置状态
   * - 剧本失败：requestScriptsGeneration 内部已重试3次，失败后 throw 到这里
   * - AbortError：用户手动取消，显示取消提示
   * - finally：确保所有状态在任何情况下都会被重置
   */
  const handleDraftAndScripts = async (mode: "fast" | "agent" = "fast") => {
    // ========== 参数校验 ==========
    if (!quickPrompt.trim()) {
      toast.warning("请输入故事描述");
      return;
    }

    // ========== 初始化状态 ==========
    setIsDraftGenerating(true); // 整个流程标记为生成中
    generateModeRef.current = mode;
    setIsQuickGenerating(mode === "fast");
    setIsAgentGenerating(mode === "agent");
    resetAgentFlow(); // 重置智能体流程状态（清空进度事件等）

    try {
      // ========== 准备工作 ==========
      const locale = getUserLocale();
      setLastLocale(locale); // 保存语言，供重试时使用
      toast.info(
        t("key.home.toast.aiCreating"),
        t("key.home.toast.analyzingIdea"),
      );

      // 延迟滚动到草稿区域，提升用户体验
      setTimeout(() => {
        draftSectionRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      }, 500);

      // ========== 阶段1：生成设定草稿 (使用流式 API) ==========
      let draftResult: { success: boolean; cached?: boolean; data?: DraftData } | null = null;
      let lastError: Error | null = null;

      // 清空之前的 thinking 内容
      setThinkingContent("");

      // 使用流式 API 获取草稿（带 thinking 输出）
      try {
        const draftResponse = await fetch("/api/game/idea-to-draft-stream", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            idea: quickPrompt,
            locale,
          }),
        });

        if (!draftResponse.ok) {
          throw new Error(`请求失败 (Status: ${draftResponse.status})`);
        }

        // 处理 SSE 流
        const reader = draftResponse.body?.getReader();
        if (!reader) {
          throw new Error("无法建立流式连接");
        }

        const decoder = new TextDecoder("utf-8");
        let buffer = "";

        while (true) {
          const { value, done } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });

          // 按 '\n\n' 分割事件
          let boundary = buffer.indexOf("\n\n");
          while (boundary !== -1) {
            const chunk = buffer.slice(0, boundary).trim();
            buffer = buffer.slice(boundary + 2);

            if (chunk.startsWith("data:")) {
              const dataStr = chunk.replace(/^data:\s*/, "");
              if (dataStr) {
                try {
                  const payload = JSON.parse(dataStr);
                  
                  // 调试日志：打印所有收到的事件
                  console.log("[Draft] 收到事件:", payload.event, payload);
                  
                  // 处理 thinking 事件
                  if (payload.event === "thinking" && payload.content) {
                    console.log("[Draft] 🧠 思考内容:", payload.content.slice(0, 50) + "...");
                    setThinkingContent(prev => prev + payload.content);
                  }
                  
                  // 处理 content 事件（思考完成）
                  if (payload.event === "content") {
                    console.log("[Draft] ✅ 思考完成，开始生成草稿...");
                  }
                  
                  // 处理 result 事件
                  if (payload.event === "result" && payload.success) {
                    draftResult = payload;
                  }
                  
                  // 处理 cached 事件
                  if (payload.event === "cached") {
                    console.log("[Draft] 命中缓存");
                  }
                  
                  // 处理 error 事件
                  if (payload.event === "error") {
                    throw new Error(payload.error || "草稿生成失败");
                  }
                } catch (parseError) {
                  // 跳过解析错误
                  if ((parseError as Error).message !== "草稿生成失败") {
                    console.warn("解析 SSE 事件失败:", parseError);
                  } else {
                    throw parseError;
                  }
                }
              }
            }
            boundary = buffer.indexOf("\n\n");
          }
        }
      } catch (err) {
        lastError = err instanceof Error ? err : new Error("网络请求异常");
        console.error("[Draft] 流式生成失败:", lastError);
      }

      // 清空 thinking 内容（已完成）
      setThinkingContent("");

      // 检查结果
      if (!draftResult?.success || !draftResult.data) {
        throw lastError || new Error("设定草稿生成失败");
      }

      // 保存草稿数据到状态
      setDraftData(draftResult.data);
      setDraftCached(Boolean(draftResult.cached));

      // 命中缓存提示
      if (draftResult.cached) {
        console.info(
          "[命中草稿缓存]",
          "使用历史草稿加速生成流程",
          quickPrompt,
          draftResult,
        );
      }

      toast.info(
        t("key.home.toast.draftComplete"),
        t("key.home.toast.agentWriting"),
      );

      // ========== 阶段2：生成剧本 ==========
      // requestScriptsGeneration 内部有重试机制，失败会自动重试最多3次
      await requestScriptsGeneration(draftResult.data, locale, mode);
    } catch (error) {
      // ========== 错误处理 ==========
      if (error instanceof DOMException && error.name === "AbortError") {
        // 用户手动取消（通过 controllerRef.current.abort()）
        toast.info(t("key.home.toast.cancelled"));
      } else {
        // 草稿失败、剧本失败、或其他异常
        console.error("Agents generate error:", quickPrompt, error);
        toast.error(
          t("key.home.toast.generateFailed"),
          error instanceof Error
            ? error.message
            : t("key.home.toast.checkNetwork"),
        );
        setSessionStatus("error"); // 标记会话为错误状态
      }
    } finally {
      // ========== 状态清理（无论成功/失败/取消都会执行） ==========
      controllerRef.current = null; // 清空 AbortController
      setIsDraftGenerating(false); // 关闭整体生成中标记

      // 根据模式关闭对应的加载状态
      if (mode === "fast") {
        setIsQuickGenerating(false);
        setShowFastScriptLoading(false);
      } else {
        setIsAgentGenerating(false);
      }
    }
  };

  /**
   * ============================================================
   * 手动重试剧本生成（跳过草稿阶段）
   * ============================================================
   *
   * 使用场景：
   * - 剧本生成失败后，用户点击重试按钮
   * - 已有草稿数据，不需要重新生成草稿
   *
   * @param mode - 生成模式（'fast' 或 'agent'）
   *
   * 与 handleDraftAndScripts 的区别：
   * - handleDraftAndScripts: 完整流程（草稿 + 剧本）
   * - handleRetryScripts: 仅剧本阶段，复用已有草稿
   *
   * 状态管理：
   * - 只设置 isAgentGenerating，不设置 isDraftGenerating
   * - keepDraft: true，保留草稿数据，只重置进度事件
   *
   * 错误处理：
   * - 失败后标记 sessionStatus 为 'error'
   * - finally 确保状态被重置
   */
  const handleRetryScripts = async (mode: "fast" | "agent" = "fast") => {
    // ========== 前置检查 ==========
    if (!draftData) {
      handleDraftAndScripts(mode);
      return; // 必须有草稿数据才能重试
    }

    // ========== 初始化状态 ==========
    resetAgentFlow({ keepDraft: true }); // 保留草稿，重置进度
    setIsAgentGenerating(true); // 标记为生成中

    try {
      toast.info(
        t("key.home.toast.retrying"),
        t("key.home.toast.retryingAgent"),
      );

      // ========== 调用剧本生成（带重试机制） ==========
      // 使用保存的语言或当前语言
      await requestScriptsGeneration(
        draftData,
        lastLocale || getUserLocale(),
        mode,
      );
    } catch (error) {
      // ========== 错误处理 ==========
      console.error("Agents retry error:", error);
      toast.error(
        t("key.home.toast.retryFailed"),
        error instanceof Error
          ? error.message
          : t("key.home.toast.checkNetwork"),
      );
      setSessionStatus("error");
    } finally {
      // ========== 状态清理 ==========
      controllerRef.current = null;
      setIsAgentGenerating(false);
    }
  };

  /**
   * ============================================================
   * 进度面板的重试按钮处理
   * ============================================================
   *
   * 使用场景：
   * - 用户在进度面板中点击重试按钮
   *
   * 安全检查：
   * - 必须有草稿数据
   * - 不能在生成中时重复点击
   *
   * @param mode - 生成模式（'fast' 或 'agent'）
   */
  const handleProgressRetry = (mode: "fast" | "agent") => {
    // ========== 防重复点击 ==========
    if (!draftData || (mode === "agent" && isAgentGenerating)) return;

    // ========== 清空旧进度并重试 ==========
    setProgressEvents([]); // 清空旧进度事件，准备接收新进度
    handleRetryScripts(mode);
  };

  /**
   * ============================================================
   * 字段编辑功能
   * ============================================================
   */
  const handleEditField = (path: string, label: string, currentValue: string, multiline = false) => {
    setEditingField({ path, label, value: currentValue, multiline });
  };

  const handleSaveEdit = () => {
    if (!editingField || !draftData) return;
    
    const { path, value } = editingField;
    const newData = JSON.parse(JSON.stringify(draftData)); // 深拷贝
    
    // 根据路径设置值
    const pathParts = path.split('.');
    let target: any = newData;
    
    for (let i = 0; i < pathParts.length - 1; i++) {
      const part = pathParts[i];
      // 处理数组索引
      const arrayMatch = part.match(/^(.+)\[(\d+)\]$/);
      if (arrayMatch) {
        target = target[arrayMatch[1]][parseInt(arrayMatch[2])];
      } else {
        target = target[part];
      }
    }
    
    const lastPart = pathParts[pathParts.length - 1];
    const arrayMatch = lastPart.match(/^(.+)\[(\d+)\]$/);
    if (arrayMatch) {
      target[arrayMatch[1]][parseInt(arrayMatch[2])] = value;
    } else {
      target[lastPart] = value;
    }
    
    setDraftData(newData);
    setEditingField(null);
    toast.success(t("key.home.draft.edit.success"));
  };

  const handleCancelEdit = () => {
    setEditingField(null);
  };

  // 编辑按钮组件
  const EditButton = ({ onClick }: { onClick: () => void }) => (
    <button
      onClick={onClick}
      className="ml-2 inline-flex items-center justify-center w-6 h-6 rounded hover:bg-slate-200 transition-colors"
      title="Edit"
    >
      <Edit3 className="w-3.5 h-3.5 text-slate-500" />
    </button>
  );

  return (
    <>
      <main className="flex min-h-screen flex-col items-center justify-center p-8 bg-gradient-to-br from-slate-50 via-indigo-50 to-purple-50">
        <Card className="w-full max-w-3xl shadow-2xl border-2 border-slate-200 bg-white">
          <CardHeader className="text-center pb-4">
            <div className="flex justify-center mb-4">
              <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-indigo-600 to-pink-600 flex items-center justify-center shadow-lg">
                <Sparkles className="w-10 h-10 text-white" />
              </div>
            </div>
            <CardTitle className="text-5xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-pink-600">
              {t("key.home.title")}
            </CardTitle>
            <CardDescription className="text-xl mt-3 text-slate-600">
              {t("key.home.subtitle")}
            </CardDescription>
            <p className="text-sm mt-2 text-slate-500">
              {t("key.home.quickMode.description")}
            </p>
          </CardHeader>

          <CardContent className="space-y-6 pt-6">
            {/* 开始按钮 */}
            <div className="space-y-3">
              <>
                {/* 自动模式 - 主推荐 */}
                <Card className="bg-gradient-to-br from-amber-50 to-orange-50 border-2 border-amber-300">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <Zap className="w-5 h-5 text-amber-600" />
                      <h3 className="font-semibold text-amber-900">
                        {t("key.home.autoMode.title")}
                      </h3>
                      <span className="px-2 py-0.5 bg-amber-500 text-white text-xs rounded-full">
                        {t("key.home.autoMode.badge")}
                      </span>
                    </div>
                    <p className="text-sm text-amber-700 mb-3">
                      {t("key.home.autoMode.description")}
                    </p>
                    <div className="space-y-2">
                      <textarea
                        className="w-full px-4 py-3 border-2 border-amber-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent resize-none"
                        rows={3}
                        value={quickPrompt}
                        onChange={(e) => {
                          setQuickPrompt(e.target.value);
                          ideaRef.current = e.target.value;
                        }}
                        placeholder={t("key.home.autoMode.placeholder") || ""}
                        disabled={isDraftGenerating}
                      />
                      <div className="flex items-center gap-2">
                        <Button
                          className="w-full h-12 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 shadow-lg"
                          onClick={() => handleDraftAndScripts("fast")}
                          disabled={isDraftGenerating || !quickPrompt.trim()}
                        >
                          {isQuickGenerating ? (
                            <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                          ) : (
                            <Zap className="w-5 h-5 mr-2" />
                          )}
                          {isQuickGenerating
                            ? t("key.home.autoMode.generating")
                            : t("key.home.autoMode.buttonFast")}
                        </Button>
                        <Button
                          className="w-full h-12 bg-gradient-to-r from-teal-500 to-blue-500 hover:from-teal-600 hover:to-blue-600 shadow-lg"
                          onClick={() => handleDraftAndScripts("agent")}
                          disabled={isDraftGenerating || !quickPrompt.trim()}
                        >
                          {isAgentGenerating ? (
                            <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                          ) : (
                            <BrainCircuit className="w-5 h-5 mr-2" />
                          )}
                          {isAgentGenerating
                            ? t("key.home.autoMode.generatingAgent")
                            : t("key.home.autoMode.buttonAgent")}
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* 专业模式 */}
                <Button
                  variant="outline"
                  className="w-full h-12 text-lg border-2 border-slate-300 text-slate-700 hover:bg-slate-50"
                  onClick={() => router.push("/setup")}
                >
                  <Settings className="w-5 h-5 mr-2" />
                  {t("key.home.professionalMode.button")}
                </Button>
              </>

              <Button
                variant="outline"
                className="w-full h-12 text-lg border-2 border-slate-300 text-slate-700 hover:bg-slate-50"
                onClick={() => router.push("/dashboard")}
              >
                <FolderOpen className="w-5 h-5 mr-2" />
                {t("key.home.button.viewProjects")}
              </Button>
            </div>

            {/* 额外说明 */}
            <div className="text-center text-sm text-slate-500 pt-2">
              <p>{t("key.home.quickMode.info")}</p>
            </div>
          </CardContent>
        </Card>

        {showDraftSection && (
          <div ref={draftSectionRef} className="w-full max-w-4xl mt-8">
            <Card className="border border-slate-200 bg-white/90 shadow-xl">
              <CardHeader>
                <CardTitle className="text-2xl font-semibold text-slate-900 flex items-center gap-2">
                  <BookOpen className="w-6 h-6 text-indigo-500" />
                  {t("key.home.draft.title")}
                  {draftCached && draftData && (
                    <span className="px-2 py-0.5 text-xs rounded-full bg-emerald-50 text-emerald-600 border border-emerald-200">
                      {t("key.home.draft.cached")}
                    </span>
                  )}
                </CardTitle>
                <CardDescription className="text-slate-600">
                  {draftData
                    ? `${draftData.projectTitle} · ${draftData.summary || draftData.hook || t("key.home.draft.completed")}`
                    : t("key.home.draft.generating")}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <section>
                  <div className="flex items-center gap-2 text-slate-800 font-semibold">
                    <Globe2 className="w-4 h-4 text-indigo-500" />
                    {t("key.home.draft.worldSetting")}
                  </div>
                  {draftData ? (
                    <>
                      <div className="flex items-center mt-1">
                        <p className="text-sm text-slate-600">
                          {draftData.worldSetting.name} ·{" "}
                          {draftData.worldSetting.era} ·{" "}
                          {draftData.worldSetting.location}
                        </p>
                        <EditButton
                          onClick={() =>
                            handleEditField(
                              "worldSetting.name",
                              t("key.home.draft.edit.worldName"),
                              draftData.worldSetting.name
                            )
                          }
                        />
                      </div>
                      {draftData.worldSetting.rules && (
                        <div className="flex items-start mt-1">
                          <p className="text-sm text-slate-600 flex-1">
                            {draftData.worldSetting.rules}
                          </p>
                          <EditButton
                            onClick={() =>
                              handleEditField(
                                "worldSetting.rules",
                                t("key.home.draft.edit.worldRules"),
                                draftData.worldSetting.rules || "",
                                true
                              )
                            }
                          />
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="mt-2 space-y-2 text-sm text-slate-500">
                      <p>{t("key.home.draft.worldGenerating")}</p>
                      <div className="h-3 rounded bg-slate-100 animate-pulse" />
                      <div className="h-3 rounded bg-slate-100 animate-pulse w-3/4" />
                    </div>
                  )}
                </section>
                <section>
                  <div className="flex items-center gap-2 font-semibold text-slate-800">
                    <Users className="w-4 h-4 text-indigo-500" />
                    {t("key.home.draft.characters")}
                  </div>
                  {draftData ? (
                    <div className="mt-2 grid gap-3 md:grid-cols-2">
                      {draftData.characters.map((character, charIndex) => (
                        <div
                          key={character.id}
                          className="rounded-xl border border-slate-200 bg-slate-50/60 p-3"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1 flex-1">
                              <p className="font-semibold text-slate-900">
                                {character.displayName || character.name}
                              </p>
                            <EditButton
                              onClick={() =>
                                handleEditField(
                                  `characters[${charIndex}].name`,
                                  t("key.home.draft.edit.characterName"),
                                  character.displayName || character.name
                                )
                              }
                            />
                            </div>
                            {character.identity && (
                              <span className="text-xs text-slate-500">
                                {character.identity}
                              </span>
                            )}
                          </div>
                          <div className="flex items-start mt-1">
                            <p className="text-sm text-slate-600 flex-1">
                              {character.description}
                            </p>
                            <EditButton
                              onClick={() =>
                                handleEditField(
                                  `characters[${charIndex}].description`,
                                  t("key.home.draft.edit.characterDesc"),
                                  character.description,
                                  true
                                )
                              }
                            />
                          </div>
                          {character.personality?.traits &&
                            character.personality?.traits.length > 0 && (
                              <div className="mt-2 flex flex-wrap gap-1">
                                {character.personality.traits
                                  .slice(0, 3)
                                  .map((trait) => (
                                    <span
                                      key={trait}
                                      className="text-xs px-2 py-0.5 bg-white border border-slate-200 rounded-full text-slate-600"
                                    >
                                      {trait}
                                    </span>
                                  ))}
                              </div>
                            )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="mt-2 grid gap-3 md:grid-cols-2">
                      {[0, 1, 2, 3].map((index) => (
                        <div
                          key={index}
                          className="rounded-xl border border-dashed border-slate-200 bg-slate-50/60 p-3 animate-pulse h-24"
                        />
                      ))}
                    </div>
                  )}
                </section>
                <section>
                  <div className="flex items-center gap-2 font-semibold text-slate-800">
                    <Map className="w-4 h-4 text-indigo-500" />
                    {t("key.home.draft.scenes")}
                  </div>
                  {draftData ? (
                    <div className="mt-2 space-y-2">
                      {draftData.scenes.map((scene, index) => (
                        <div
                          key={scene.id}
                          className="border-l-4 border-indigo-200 pl-3"
                        >
                          <div className="flex items-start">
                            <p className="text-sm font-semibold text-slate-800 flex-1">
                              {t("key.home.draft.sceneNo", { no: index + 1 })} ·{" "}
                              {scene.name} ({scene.atmosphere})
                            </p>
                            <EditButton
                              onClick={() =>
                                handleEditField(
                                  `scenes[${index}].name`,
                                  t("key.home.draft.edit.sceneName") + ` ${index + 1}`,
                                  scene.name
                                )
                              }
                            />
                          </div>
                          <div className="flex items-start">
                            <p className="text-sm text-slate-600 flex-1">
                              {scene.description ||
                                scene.details ||
                                t("key.home.draft.sceneNoDesc")}
                            </p>
                            <EditButton
                              onClick={() =>
                                handleEditField(
                                  `scenes[${index}].description`,
                                  t("key.home.draft.edit.sceneDesc") + ` ${index + 1}`,
                                  scene.description || scene.details || "",
                                  true
                                )
                              }
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="mt-2 space-y-2">
                      {[0, 1, 2].map((index) => (
                        <div
                          key={index}
                          className="border-l-4 border-indigo-100 pl-3 space-y-2"
                        >
                          <div className="h-3 bg-slate-100 rounded animate-pulse w-1/2" />
                          <div className="h-3 bg-slate-100 rounded animate-pulse w-3/4" />
                        </div>
                      ))}
                    </div>
                  )}
                </section>
                <section>
                  <div className="flex items-center gap-2 font-semibold text-slate-800">
                    <Sparkles className="w-4 h-4 text-indigo-500" />
                    {t("key.home.draft.themeStyle")}
                  </div>
                  {draftData ? (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {draftData.themeSetting.themes?.map((theme) => (
                        <span
                          key={theme}
                          className="px-3 py-1 text-xs font-semibold rounded-full bg-indigo-50 text-indigo-600"
                        >
                          #{theme}
                        </span>
                      ))}
                      {draftData.themeSetting.styles?.map((style) => (
                        <span
                          key={style}
                          className="px-3 py-1 text-xs font-semibold rounded-full bg-amber-50 text-amber-600"
                        >
                          {style}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {[0, 1, 2].map((index) => (
                        <span
                          key={index}
                          className="px-6 py-2 text-xs font-semibold rounded-full bg-slate-100 text-slate-400 animate-pulse"
                        >
                          {t("key.home.draft.thinking")}
                        </span>
                      ))}
                    </div>
                  )}
                </section>
              </CardContent>
            </Card>
          </div>
        )}

        {shouldShowAgentsProgress && (
          <div ref={agentsSectionRef} className="w-full max-w-4xl mt-6">
            <Card className="border border-slate-200 bg-white/90 shadow-xl">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-2xl font-semibold text-slate-900 flex items-center gap-2">
                    <Sparkles className="w-6 h-6 text-indigo-500" />
                    {t("key.home.agent.progress.title")}
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    {/* 暂停按钮 - 仅在生成中时显示 */}
                    {(isAgentGenerating || isQuickGenerating) && sessionStatus === "running" && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 px-3 text-rose-600 border-rose-300 hover:bg-rose-50 hover:text-rose-700"
                        onClick={handleAbortGeneration}
                      >
                        <StopCircle className="w-4 h-4 mr-1" />
                        {t("key.home.agent.progress.abort")}
                      </Button>
                    )}
                    <span
                      className={`px-3 py-1 text-xs font-semibold rounded-full ${agentStatusMeta.className}`}
                    >
                      {agentStatusMeta.label}
                    </span>
                  </div>
                </div>
                {sessionInfo.message && (
                  <CardDescription className="text-slate-600">
                    {sessionInfo.message}
                  </CardDescription>
                )}
              </CardHeader>
              <CardContent>
                {recentProgressEvents.length === 0 ? (
                  <p className="text-sm text-slate-500">
                    {t("key.home.agent.progress.waiting")}
                  </p>
                ) : (
                  <div
                    className="space-y-3 max-h-[50vh] overflow-y-auto pr-1"
                    ref={progressListRef}
                  >
                    {recentProgressEvents.map((event) => (
                      <div
                        key={`${event.stage}-${event.timestamp}`}
                        className="rounded-lg border border-slate-200 bg-white/70 p-3 shadow-sm"
                      >
                        <div className="flex items-center text-sm font-semibold text-slate-800">
                          <span>{stageLabels[event.stage] || event.stage}</span>
                          {event.status === "completed" && event.action && (
                            <span className="ml-1 text-slate-500">· {event.action}</span>
                          )}
                          <div className="ml-auto flex items-center gap-2">
                            {typeof event.progress === "number" && (
                              <span className="text-xs text-slate-500">
                                {event.progress}%
                              </span>
                            )}
                            {event.status === "failed" && draftData && (
                              <Button
                                variant="outline"
                                className="h-7 px-2 text-xs"
                                disabled={isAgentGenerating}
                                onClick={() => handleProgressRetry("agent")}
                              >
                                {t("key.home.agent.progress.retry")}
                              </Button>
                            )}
                          </div>
                        </div>
                        {event.message && (
                          <p className="text-sm text-slate-600 mt-1">
                            {event.message}
                          </p>
                        )}
                        {event.details && (
                          <p className="text-xs text-slate-400 mt-1">
                            {event.details.nodeCount
                              ? t("key.home.agent.progress.nodeCount", {
                                  count: event.details.nodeCount,
                                })
                              : null}
                            {event.details.layer
                              ? ` · ${t("key.home.agent.progress.layer", { current: event.details.layer, total: event.details.totalLayers })}`
                              : null}
                          </p>
                        )}
                        {Array.isArray((event.details as any)?.candidates) &&
                          (event.details as any).candidates.length > 0 && (
                            <ul className="mt-2 space-y-1 text-xs text-slate-500 list-disc pl-4">
                              {(event.details as any).candidates.map(
                                (candidate: any, idx: number) => (
                                  <li
                                    key={`${event.timestamp}-candidate-${idx}`}
                                  >
                                    <span className="font-medium text-slate-600">
                                      {candidate.name || candidate.id}
                                    </span>
                                    {candidate.description
                                      ? `: ${candidate.description}`
                                      : null}
                                  </li>
                                ),
                              )}
                            </ul>
                          )}
                        {Array.isArray((event.details as any)?.nodes) &&
                          (event.details as any).nodes.length > 0 && (
                            <ul className="mt-2 space-y-1 text-xs text-slate-500 list-disc pl-4">
                              {(event.details as any).nodes.map(
                                (node: any, idx: number) => (
                                  <li key={`${event.timestamp}-node-${idx}`}>
                                    <span className="font-medium text-slate-600">
                                      {node.title || node.id}{" "}
                                      {node.isEnding
                                        ? t("key.home.agent.progress.ending")
                                        : ""}
                                    </span>
                                    {node.brief ? `: ${node.brief}` : null}
                                  </li>
                                ),
                              )}
                            </ul>
                          )}
                      </div>
                    ))}
                  </div>
                )}
                {finalProject && (
                  <div className="mt-4 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                    {redirectCountdown !== null && (
                      <p className="text-xs text-slate-500">
                        {t("key.home.agent.success.redirect", {
                          seconds: redirectCountdown,
                        })}
                      </p>
                    )}
                    <div className="flex justify-end">
                      <Button variant="outline" onClick={handleViewProject}>
                        {t("key.home.agent.success.viewProject", {
                          title: finalProject.title,
                        })}
                      </Button>
                    </div>
                  </div>
                )}
                {sessionStatus === "error" && draftData && (
                  <div className="mt-4 flex flex-col gap-2 md:flex-row md:justify-end">
                    <Button
                      variant="outline"
                      onClick={() => resetAgentFlow()}
                      disabled={isAgentGenerating}
                    >
                      {t("key.home.agent.error.retryInput")}
                    </Button>
                    <Button
                      onClick={() =>
                        handleRetryScripts(generateModeRef.current)
                      }
                      disabled={isAgentGenerating}
                    >
                      {isAgentGenerating
                        ? t("key.home.agent.error.retrying")
                        : t("key.home.agent.error.retryGenerate")}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* 页脚 */}
        <p className="text-slate-600 mt-8 text-sm">{t("key.home.footer")}</p>
      </main>
      
      {/* 编辑对话框 */}
      {editingField && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm">
          <div className="w-full max-w-lg mx-4 rounded-xl border border-slate-200 bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                <Edit3 className="w-5 h-5 text-indigo-500" />
                {t("key.home.draft.edit.title")}: {editingField.label}
              </h3>
              <button
                onClick={handleCancelEdit}
                className="p-1 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>
            
            {editingField.multiline ? (
              <textarea
                className="w-full px-4 py-3 border-2 border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
                rows={6}
                value={editingField.value}
                onChange={(e) =>
                  setEditingField({ ...editingField, value: e.target.value })
                }
                autoFocus
              />
            ) : (
              <input
                type="text"
                className="w-full px-4 py-3 border-2 border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                value={editingField.value}
                onChange={(e) =>
                  setEditingField({ ...editingField, value: e.target.value })
                }
                autoFocus
              />
            )}
            
            <div className="flex justify-end gap-2 mt-4">
              <Button variant="outline" onClick={handleCancelEdit}>
                <X className="w-4 h-4 mr-1" />
                {t("key.home.draft.edit.cancel")}
              </Button>
              <Button onClick={handleSaveEdit}>
                <Check className="w-4 h-4 mr-1" />
                {t("key.home.draft.edit.confirm")}
              </Button>
            </div>
          </div>
        </div>
      )}
      
      {showDraftLoading && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/10 ">
          <div className={`rounded-2xl border border-white/30 bg-white/95 p-6 shadow-2xl transition-all duration-300 ${thinkingContent ? 'w-[480px] max-w-[90vw]' : 'w-80'}`}>
            <div
              className="flex flex-col items-center text-center space-y-4"
              aria-live="polite"
            >
              <div className="relative">
                <div className="h-16 w-16 rounded-full border-4 border-indigo-100" />
                <Loader2 className="absolute inset-0 m-auto h-10 w-10 text-indigo-500 animate-spin" />
              </div>
              <div>
                <p className="text-lg font-semibold text-slate-900">
                  {thinkingContent 
                    ? t("key.home.loading.aiThinking")
                    : t("key.home.loading.draftTitle")}
                </p>
                <p className="text-sm text-slate-500 mt-1">
                  {thinkingContent
                    ? t("key.home.loading.thinkingHint")
                    : t("key.home.loading.draftSubtitle")}
                </p>
              </div>
              
              {/* Thinking 内容展示区域 */}
              {thinkingContent ? (
                <div className="w-full">
                  <div className="flex items-center gap-2 mb-2">
                    <BrainCircuit className="w-4 h-4 text-indigo-500" />
                    <span className="text-xs font-medium text-indigo-600">
                      {t("key.home.loading.thinkingProcess")}
                    </span>
                  </div>
                  <div 
                    ref={thinkingContentRef}
                    className="w-full max-h-48 overflow-y-auto rounded-lg bg-slate-50 border border-slate-200 p-3 text-left"
                  >
                    <p className="text-sm text-slate-600 whitespace-pre-wrap leading-relaxed">
                      {thinkingContent}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="w-full space-y-2 text-left text-sm text-slate-500">
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-indigo-500 animate-pulse" />
                    {t("key.home.loading.draftStep1")}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-indigo-500 animate-pulse delay-200" />
                    {t("key.home.loading.draftStep2")}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-indigo-500 animate-pulse delay-500" />
                    {t("key.home.loading.draftStep3")}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      {showFastScriptLoading && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/10 ">
          <div className={`rounded-2xl border border-white/30 bg-white/90 p-6 shadow-2xl ${thinkingContent ? 'w-[480px]' : 'w-80'}`}>
            <div
              className="flex flex-col items-center text-center space-y-4"
              aria-live="polite"
            >
              <div className="relative">
                <div className="h-16 w-16 rounded-full border-4 border-indigo-100" />
                <Loader2 className="absolute inset-0 m-auto h-10 w-10 text-indigo-500 animate-spin" />
              </div>
              <div>
                <p className="text-lg font-semibold text-slate-900">
                  {thinkingContent 
                    ? t("key.home.loading.aiThinking")
                    : t("key.home.loading.scriptTitle")}
                </p>
                <p className="text-sm text-slate-500 mt-1">
                  {thinkingContent
                    ? t("key.home.loading.thinkingHint")
                    : t("key.home.loading.scriptSubtitle")}
                </p>
              </div>
              
              {/* Thinking 内容展示区域 */}
              {thinkingContent ? (
                <div className="w-full">
                  <div className="flex items-center gap-2 mb-2">
                    <BrainCircuit className="w-4 h-4 text-indigo-500" />
                    <span className="text-xs font-medium text-indigo-600">
                      {t("key.home.loading.thinkingProcess")}
                    </span>
                  </div>
                  <div 
                    ref={thinkingContentRef}
                    className="w-full max-h-48 overflow-y-auto rounded-lg bg-slate-50 border border-slate-200 p-3 text-left"
                  >
                    <p className="text-sm text-slate-600 whitespace-pre-wrap leading-relaxed">
                      {thinkingContent}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="w-full space-y-2 text-left text-sm text-slate-500">
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-indigo-500 animate-pulse" />
                    {t("key.home.loading.scriptStep1")}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-indigo-500 animate-pulse delay-200" />
                    {t("key.home.loading.scriptStep2")}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-indigo-500 animate-pulse delay-500" />
                    {t("key.home.loading.scriptStep3")}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
