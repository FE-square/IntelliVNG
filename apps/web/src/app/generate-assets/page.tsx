"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  useToast,
} from "@vng/ui";
import {
  Wand2,
  Loader2,
  Image as ImageIcon,
  Users,
  MapPin,
  ArrowRight,
  SkipForward,
  CheckCircle2,
  Sparkles,
  Database,
} from "lucide-react";
import { GameProject } from "@vng/core";
import { useI18N } from "@/components/I18nProvider";

// Mock 数据 - 用于无数据时的展示调试
const MOCK_PROJECT_DATA: Partial<GameProject> = {
  id: "mock-project-1",
  title: "星渊·机械纪元",
  description: "一个关于人工智能觉醒与人类共存的赛博朋克故事",
  characters: [
    {
      id: "mock-char-1",
      displayName: "星野·亚特拉斯",
      description: "反抗军领袖，拥有机械左臂的神秘少女",
      name: "Hoshino Atlas",
      sprites: [], // 待生成
      defaultSpriteId: "",
      avatarUrl: "", // 待生成
    },
    {
      id: "mock-char-2",
      displayName: "K-99",
      description: "拥有自我意识的战斗型机器人",
      name: "K-99",
      sprites: [],
      defaultSpriteId: "",
      avatarUrl: "",
    },
    {
      id: "mock-char-3",
      displayName: "月咏·希尔",
      description: "神秘的财团大小姐，掌握核心科技",
      name: "Tsukuyomi",
      sprites: [],
      defaultSpriteId: "",
      avatarUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=Luna", // 已有部分
    },
  ],
  backgrounds: [
    {
      id: "mock-bg-1",
      name: "新都中央广场",
      description: "繁华的赛博都市中心，全息广告牌林立",
      imageUrl: "", // 待生成
    },
    {
      id: "mock-bg-2",
      name: "旧城区废墟",
      description: "被遗弃的旧时代遗迹，杂草丛生",
      imageUrl: "",
    },
    {
      id: "mock-bg-3",
      name: "量子研究所",
      description: "充满科技感的实验室，蓝光环绕",
      imageUrl: "https://images.unsplash.com/photo-1579546929518-9e396f3cc809", // 已有
    },
  ],
};

/**
 * 视觉素材生成页面
 * 在AI生成剧本后，给用户机会一键生成所有视觉素材（立绘、头像、背景图）
 */
function GenerateAssetsPageContent() {
  const { t, I18N } = useI18N();
  const router = useRouter();
  const searchParams = useSearchParams();
  const toast = useToast();
  const projectId = searchParams.get("projectId");

  const [project, setProject] = useState<GameProject | null>(null);
  const [loading, setLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationProgress, setGenerationProgress] = useState<{
    current: number;
    total: number;
    message: string;
    type: "avatar" | "sprite" | "background" | "";
  }>({ current: 0, total: 0, message: "", type: "" });
  const [completed, setCompleted] = useState(false);
  const [generatingItems, setGeneratingItems] = useState<
    Array<{
      id: string;
      name: string;
      type: "avatar" | "sprite" | "background";
      status: "pending" | "generating" | "success" | "error";
      imageUrl?: string;
      retryCount?: number;
      error?: string;
    }>
  >([]);
  const [isMockMode, setIsMockMode] = useState(false);

  // 加载项目
  useEffect(() => {
    const loadProject = async () => {
      if (!projectId) {
        // 进入 Mock 模式
        setIsMockMode(true);
        setProject(MOCK_PROJECT_DATA as GameProject);
        setLoading(false);
        toast.info(
          t("key.generateAssets.toast.previewMode"),
          t("key.generateAssets.toast.previewModeDesc"),
        );
        return;
      }

      try {
        const response = await fetch(`/api/projects/${projectId}`);
        if (!response.ok) {
          throw new Error(t("key.generateAssets.error.loadProject"));
        }
        const data = await response.json();
        setProject(data);
      } catch (error) {
        console.error("加载项目失败:", error);
        // 加载失败也进入 Mock 模式方便调试
        setIsMockMode(true);
        setProject(MOCK_PROJECT_DATA as GameProject);
        toast.error(
          t("key.generateAssets.toast.loadFailed"),
          t("key.generateAssets.toast.switchToPreview"),
        );
      } finally {
        setLoading(false);
      }
    };

    loadProject();
  }, [projectId, router, toast]);

  // 统计需要生成的素材数量
  const getAssetsCount = () => {
    if (!project) return { avatars: 0, sprites: 0, backgrounds: 0 };

    const avatars = project.characters.filter((c) => !c.avatarUrl).length;
    const sprites = project.characters.filter(
      (c) => !c.sprites || c.sprites.length === 0,
    ).length;
    const backgrounds = project.backgrounds.filter((b) => !b.imageUrl).length;

    return { avatars, sprites, backgrounds };
  };

  const assetsCount = getAssetsCount();
  const totalAssets =
    assetsCount.avatars + assetsCount.sprites + assetsCount.backgrounds;

  // 一键生成所有视觉素材（批量并行，限制并发数）
  const handleGenerateAll = async () => {
    if (!project) return;

    setIsGenerating(true);
    setGenerationProgress({
      current: 0,
      total: totalAssets,
      message: t("key.generateAssets.progress.starting"),
      type: "",
    });

    try {
      type TaskItem = {
        id: string;
        name: string;
        type: "avatar" | "sprite" | "background";
        characterId?: string;
        backgroundId?: string;
        prompt: string;
      };

      // 分组收集任务
      const spriteTasks: TaskItem[] = [];
      const avatarTasks: TaskItem[] = [];
      const backgroundTasks: TaskItem[] = [];

      project.characters.forEach((character) => {
        if (!character.sprites || character.sprites.length === 0) {
          spriteTasks.push({
            id: `sprite-${character.id}`,
            name: `${character.displayName} ${t("key.generateAssets.sprite")}`,
            type: "sprite",
            characterId: character.id,
            prompt: `${character.displayName}, ${character.description}, 全身立绘, 动漫风格, 纯白色背景, 人物居中, 高质量, 清晰`,
          });
        }
      });

      project.characters.forEach((character) => {
        if (!character.avatarUrl) {
          avatarTasks.push({
            id: `avatar-${character.id}`,
            name: `${character.displayName} ${t("key.generateAssets.avatar")}`,
            type: "avatar",
            characterId: character.id,
            prompt: `${character.displayName}, ${character.description}, 头像特写, 圆形头像, 动漫风格, 纯白色背景, 简洁, 高质量`,
          });
        }
      });

      project.backgrounds.forEach((background) => {
        if (!background.imageUrl) {
          backgroundTasks.push({
            id: `background-${background.id}`,
            name: `${background.name} ${t("key.generateAssets.background")}`,
            type: "background",
            backgroundId: background.id,
            prompt: `${background.name}, ${background.description}, 场景背景图, 横屏1920x1080, 动漫风格, 高质量, 无人物`,
          });
        }
      });

      const tasks = [...spriteTasks, ...avatarTasks, ...backgroundTasks];

      setGeneratingItems(
        tasks.map((task) => ({
          id: task.id,
          name: task.name,
          type: task.type,
          status: "pending",
        })),
      );

      let completedCount = 0;

      // Mock 模式生成逻辑
      const mockGenerate = async (task: TaskItem) => {
        setGeneratingItems((prev) =>
          prev.map((item) =>
            item.id === task.id ? { ...item, status: "generating" } : item,
          ),
        );

        await new Promise((resolve) =>
          setTimeout(resolve, 800 + Math.random() * 1200),
        );

        const mockUrl =
          task.type === "avatar"
            ? `https://api.dicebear.com/7.x/avataaars/svg?seed=${task.id}`
            : task.type === "sprite"
              ? `https://placehold.co/400x600/6366f1/ffffff/png?text=${task.name}`
              : `https://placehold.co/800x450/e0e7ff/4f46e5/png?text=${task.name}`;

        setGeneratingItems((prev) =>
          prev.map((item) =>
            item.id === task.id
              ? { ...item, status: "success", imageUrl: mockUrl }
              : item,
          ),
        );

        completedCount++;
        setGenerationProgress({
          current: completedCount,
          total: tasks.length,
          message: t("key.generateAssets.progress.completed", {
            current: completedCount,
            total: tasks.length,
          }),
          type: task.type,
        });
      };

      // 真实生成逻辑
      const MAX_RETRIES = 3;
      const RETRY_DELAY = 2000;

      const realGenerate = async (
        task: TaskItem,
        retryCount = 0,
      ): Promise<void> => {
        setGeneratingItems((prev) =>
          prev.map((item) =>
            item.id === task.id
              ? { ...item, status: "generating", retryCount }
              : item,
          ),
        );

        try {
          const response = await fetch("/api/generate-image", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ prompt: task.prompt, type: task.type }),
          });

          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(
              errorData.details ||
                errorData.error ||
                t("key.generateAssets.error.generateFailed"),
            );
          }

          const result = await response.json();
          if (!result.imageUrl)
            throw new Error(t("key.generateAssets.error.noImageUrl"));

          // 更新项目数据
          if (task.type === "avatar" && task.characterId) {
            const char = project.characters.find(
              (c) => c.id === task.characterId,
            );
            if (char) char.avatarUrl = result.imageUrl;
          } else if (task.type === "sprite" && task.characterId) {
            const char = project.characters.find(
              (c) => c.id === task.characterId,
            );
            if (char) {
              const spriteId = `sprite-${task.characterId}-${Date.now()}`;
              char.sprites = [
                { id: spriteId, emotion: "neutral", imageUrl: result.imageUrl },
              ];
              char.defaultSpriteId = spriteId;
            }
          } else if (task.type === "background" && task.backgroundId) {
            const bg = project.backgrounds.find(
              (b) => b.id === task.backgroundId,
            );
            if (bg) bg.imageUrl = result.imageUrl;
          }

          setGeneratingItems((prev) =>
            prev.map((item) =>
              item.id === task.id
                ? {
                    ...item,
                    status: "success",
                    imageUrl: result.imageUrl,
                    error: undefined,
                  }
                : item,
            ),
          );

          completedCount++;
          setGenerationProgress({
            current: completedCount,
            total: tasks.length,
            message: t("key.generateAssets.progress.completed", {
              current: completedCount,
              total: tasks.length,
            }),
            type: task.type,
          });
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : "未知错误";
          console.error(
            `[GenerateAssets] 生成 ${task.name} 失败 (尝试 ${retryCount + 1}/${MAX_RETRIES + 1}):`,
            errorMessage,
          );

          if (retryCount < MAX_RETRIES) {
            setGeneratingItems((prev) =>
              prev.map((item) =>
                item.id === task.id
                  ? {
                      ...item,
                      status: "generating",
                      retryCount: retryCount + 1,
                      error: t("key.generateAssets.retrying", {
                        current: retryCount + 1,
                        total: MAX_RETRIES,
                      }),
                    }
                  : item,
              ),
            );
            await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY));
            return realGenerate(task, retryCount + 1);
          }

          // 兜底图片
          const fallbackImageUrl = getFallbackImage(task.type);
          setGeneratingItems((prev) =>
            prev.map((item) =>
              item.id === task.id
                ? {
                    ...item,
                    status: "error",
                    imageUrl: fallbackImageUrl,
                    error:
                      t("key.generateAssets.toast.generateFailed") +
                      ` (${errorMessage})`,
                    retryCount: MAX_RETRIES,
                  }
                : item,
            ),
          );

          completedCount++;
          setGenerationProgress({
            current: completedCount,
            total: tasks.length,
            message: t("key.generateAssets.progress.completedWithFallback", {
              current: completedCount,
              total: tasks.length,
            }),
            type: task.type,
          });
        }
      };

      const getFallbackImage = (
        type: "avatar" | "sprite" | "background",
      ): string => {
        switch (type) {
          case "avatar":
            return (
              "https://api.dicebear.com/7.x/avataaars/svg?seed=" + Math.random()
            );
          case "sprite":
            return "https://placehold.co/512x768/e0e7ff/4f46e5?text=角色立绘占位图";
          case "background":
            return "https://images.unsplash.com/photo-1579546929518-9e396f3cc809?w=1280&h=720&fit=crop";
          default:
            return "https://placehold.co/600x400?text=占位图";
        }
      };

      const generateFn = isMockMode ? mockGenerate : realGenerate;

      // 批量处理
      const processBatchByType = async (
        batchTasks: TaskItem[],
        typeName: string,
      ) => {
        if (batchTasks.length === 0) return;

        // 设置当前正在生成的类型
        setGenerationProgress((prev) => ({
          ...prev,
          type: batchTasks[0].type as any,
        }));

        const CONCURRENT_LIMIT = 2;
        for (let i = 0; i < batchTasks.length; i += CONCURRENT_LIMIT) {
          const batch = batchTasks.slice(i, i + CONCURRENT_LIMIT);
          // @ts-ignore
          await Promise.all(batch.map((task) => generateFn(task)));
          if (i + CONCURRENT_LIMIT < batchTasks.length) {
            await new Promise((resolve) =>
              setTimeout(resolve, isMockMode ? 500 : 1000),
            );
          }
        }
      };

      await processBatchByType(
        spriteTasks,
        t("key.generateAssets.spriteCount"),
      );
      await processBatchByType(
        avatarTasks,
        t("key.generateAssets.avatarCount"),
      );
      await processBatchByType(
        backgroundTasks,
        t("key.generateAssets.backgroundCount"),
      );

      // 保存项目
      if (!isMockMode) {
        setGenerationProgress((prev) => ({
          ...prev,
          message: t("key.generateAssets.progress.saving"),
          type: "",
        }));
        const saveResponse = await fetch(`/api/projects/${projectId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(project),
        });

        if (!saveResponse.ok) {
          throw new Error(t("key.generateAssets.error.saveProject"));
        }
      }

      setCompleted(true);

      const successCount = generatingItems.filter(
        (i) => i.status === "success",
      ).length;
      const errorCount = generatingItems.filter(
        (i) => i.status === "error",
      ).length;

      if (errorCount === 0) {
        toast.success(
          t("key.generateAssets.toast.allSuccess"),
          isMockMode
            ? t("key.generateAssets.toast.mockComplete")
            : t("key.generateAssets.toast.projectSaved"),
        );
      } else {
        toast.warning(
          t("key.generateAssets.toast.partialFail"),
          t("key.generateAssets.toast.partialFailDesc", {
            success: successCount,
            failed: errorCount,
          }),
        );
      }
    } catch (error) {
      console.error("[GenerateAssets] 生成素材失败:", error);
      toast.error(
        t("key.generateAssets.toast.generateFailed"),
        error instanceof Error
          ? error.message
          : t("key.generateAssets.toast.generateFailed"),
      );
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSkip = () => {
    if (isMockMode) {
      toast.info(t("key.generateAssets.toast.goToEditor"));
      return;
    }
    router.push(`/editor?projectId=${projectId}`);
  };

  const handleGoToEditor = () => {
    if (isMockMode) {
      toast.info(t("key.generateAssets.toast.goToEditor"));
      return;
    }
    router.push(`/editor?projectId=${projectId}`);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-indigo-50 to-purple-50">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  if (!project) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-indigo-50 to-purple-50 p-8">
      <div className="max-w-5xl mx-auto">
        <Card className="shadow-2xl border-2 border-slate-200 bg-white/95 backdrop-blur">
          <CardHeader className="text-center pb-6 pt-8 border-b border-slate-100">
            <div className="flex justify-center mb-4">
              <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-indigo-600 to-pink-600 flex items-center justify-center shadow-lg">
                <Wand2 className="w-10 h-10 text-white" />
              </div>
            </div>
            <div className="flex items-center justify-center gap-3">
              <CardTitle className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-pink-600">
                {t("key.generateAssets.title")}
              </CardTitle>
              {isMockMode && (
                <span className="px-3 py-1 bg-amber-100 text-amber-700 text-sm font-semibold rounded-full border border-amber-200 flex items-center gap-1">
                  <Database className="w-3 h-3" />
                  {t("key.generateAssets.previewMode")}
                </span>
              )}
            </div>

            <p className="text-xl mt-3 text-slate-600">
              {t("key.generateAssets.subtitle", { title: project.title })}
            </p>
          </CardHeader>

          <CardContent className="p-8 space-y-8">
            {/* 素材统计 */}
            {!completed && !isGenerating && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card className="bg-gradient-to-br from-indigo-50 to-blue-50 border-indigo-100 shadow-sm hover:shadow-md transition-shadow group">
                  <CardContent className="p-6 text-center">
                    <div className="w-14 h-14 mx-auto mb-3 bg-white rounded-full flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform duration-300">
                      <Users className="w-7 h-7 text-indigo-600" />
                    </div>
                    <p className="text-slate-600 font-medium">
                      {t("key.generateAssets.avatarCount")}
                    </p>
                    <p className="text-3xl font-bold text-indigo-700 mt-1">
                      {assetsCount.avatars}
                    </p>
                    <p className="text-xs text-indigo-400 mt-1">
                      {t("key.generateAssets.pending")}
                    </p>
                  </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-pink-50 to-rose-50 border-pink-100 shadow-sm hover:shadow-md transition-shadow group">
                  <CardContent className="p-6 text-center">
                    <div className="w-14 h-14 mx-auto mb-3 bg-white rounded-full flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform duration-300">
                      <ImageIcon className="w-7 h-7 text-pink-600" />
                    </div>
                    <p className="text-slate-600 font-medium">
                      {t("key.generateAssets.spriteCount")}
                    </p>
                    <p className="text-3xl font-bold text-pink-700 mt-1">
                      {assetsCount.sprites}
                    </p>
                    <p className="text-xs text-pink-400 mt-1">
                      {t("key.generateAssets.pending")}
                    </p>
                  </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-emerald-50 to-teal-50 border-emerald-100 shadow-sm hover:shadow-md transition-shadow group">
                  <CardContent className="p-6 text-center">
                    <div className="w-14 h-14 mx-auto mb-3 bg-white rounded-full flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform duration-300">
                      <MapPin className="w-7 h-7 text-emerald-600" />
                    </div>
                    <p className="text-slate-600 font-medium">
                      {t("key.generateAssets.backgroundCount")}
                    </p>
                    <p className="text-3xl font-bold text-emerald-700 mt-1">
                      {assetsCount.backgrounds}
                    </p>
                    <p className="text-xs text-emerald-400 mt-1">
                      {t("key.generateAssets.pending")}
                    </p>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* 提示信息 */}
            {!completed && !isGenerating && totalAssets > 0 && (
              <div className="bg-amber-50/80 border border-amber-200 rounded-xl p-5 flex items-start gap-3">
                <Sparkles className="w-5 h-5 text-amber-500 mt-0.5 flex-shrink-0" />
                <div className="text-sm text-amber-800">
                  <p className="font-semibold mb-1">
                    {t("key.generateAssets.aiModeTitle")}
                  </p>
                  <p className="opacity-90">
                    {t("key.generateAssets.aiModeDesc")}
                    {isMockMode && (
                      <span className="block mt-1 font-semibold text-amber-700">
                        {t("key.generateAssets.mockModeHint")}
                      </span>
                    )}
                  </p>
                </div>
              </div>
            )}

            {/* 生成进度 */}
            {isGenerating && (
              <div className="space-y-6">
                <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="relative">
                        <div className="absolute inset-0 bg-indigo-200 rounded-full animate-ping opacity-25"></div>
                        <Loader2 className="w-6 h-6 animate-spin text-indigo-600 relative z-10" />
                      </div>
                      <div>
                        <p className="font-semibold text-slate-800 text-lg">
                          {generationProgress.message}
                        </p>
                        <p className="text-sm text-slate-500">
                          {t("key.generateAssets.callingAI")}
                        </p>
                      </div>
                    </div>
                    <span className="text-2xl font-bold text-slate-200 font-mono">
                      {String(generationProgress.current).padStart(2, "0")}/
                      {String(generationProgress.total).padStart(2, "0")}
                    </span>
                  </div>

                  {/* 进度条 */}
                  <div className="w-full bg-slate-100 rounded-full h-4 overflow-hidden shadow-inner">
                    <div
                      className="bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 h-full rounded-full transition-all duration-500 ease-out relative"
                      style={{
                        width: `${(generationProgress.current / generationProgress.total) * 100}%`,
                      }}
                    >
                      <div className="absolute inset-0 bg-white/20 animate-[shimmer_2s_infinite] skew-x-12"></div>
                    </div>
                  </div>
                </div>

                {/* 可视化生成列表 */}
                <div className="bg-slate-50 rounded-xl border border-slate-200 p-4 max-h-[400px] overflow-y-auto custom-scrollbar">
                  <h3 className="font-semibold text-slate-700 mb-4 px-2 flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-indigo-500"></div>
                    {t("key.generateAssets.queueTitle")}
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {generatingItems.map((item) => (
                      <div
                        key={item.id}
                        className={`flex items-center gap-4 p-3 rounded-xl border transition-all duration-300 ${
                          item.status === "generating"
                            ? "bg-white border-indigo-200 shadow-md scale-[1.01]"
                            : item.status === "success"
                              ? "bg-white border-green-200 shadow-sm"
                              : item.status === "error"
                                ? "bg-red-50 border-red-200"
                                : "bg-slate-100/50 border-slate-200 opacity-70"
                        }`}
                      >
                        {/* 状态图标 */}
                        <div className="flex-shrink-0 w-8 flex justify-center">
                          {item.status === "pending" && (
                            <div className="w-3 h-3 rounded-full bg-slate-300" />
                          )}
                          {item.status === "generating" && (
                            <Loader2 className="w-5 h-5 animate-spin text-indigo-600" />
                          )}
                          {item.status === "success" && (
                            <CheckCircle2 className="w-6 h-6 text-green-500" />
                          )}
                          {item.status === "error" && (
                            <div className="w-6 h-6 rounded-full bg-red-100 flex items-center justify-center text-red-600 font-bold text-xs">
                              !
                            </div>
                          )}
                        </div>

                        {/* 类型图标 */}
                        <div
                          className={`p-2 rounded-lg ${
                            item.type === "avatar"
                              ? "bg-blue-100 text-blue-600"
                              : item.type === "sprite"
                                ? "bg-pink-100 text-pink-600"
                                : "bg-emerald-100 text-emerald-600"
                          }`}
                        >
                          {item.type === "avatar" && (
                            <Users className="w-4 h-4" />
                          )}
                          {item.type === "sprite" && (
                            <ImageIcon className="w-4 h-4" />
                          )}
                          {item.type === "background" && (
                            <MapPin className="w-4 h-4" />
                          )}
                        </div>

                        {/* 名称和错误信息 */}
                        <div className="flex-1 min-w-0">
                          <p
                            className={`font-medium truncate ${item.status === "pending" ? "text-slate-500" : "text-slate-800"}`}
                          >
                            {item.name}
                          </p>
                          {item.retryCount !== undefined &&
                            item.retryCount > 0 &&
                            item.status === "generating" && (
                              <p className="text-xs text-amber-600 mt-0.5">
                                {t("key.generateAssets.retrying", {
                                  current: item.retryCount,
                                  total: 3,
                                })}
                              </p>
                            )}
                          {item.error && item.status === "error" && (
                            <p className="text-xs text-red-500 mt-0.5 truncate">
                              {item.error}
                            </p>
                          )}
                        </div>

                        {/* 预览图 */}
                        {item.imageUrl ? (
                          <div className="w-12 h-12 rounded-lg overflow-hidden border border-slate-200 shadow-sm bg-slate-100">
                            <img
                              src={item.imageUrl}
                              alt={item.name}
                              className="w-full h-full object-cover"
                            />
                          </div>
                        ) : (
                          <div className="w-12 h-12 rounded-lg border border-slate-100 bg-slate-50"></div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* 完成状态 */}
            {completed &&
              (() => {
                const errorCount = generatingItems.filter(
                  (i) => i.status === "error",
                ).length;
                return (
                  <div
                    className={`p-8 rounded-2xl border-2 text-center transform transition-all animate-in fade-in zoom-in duration-500 ${
                      errorCount === 0
                        ? "bg-gradient-to-br from-green-50 to-emerald-50 border-green-200"
                        : "bg-gradient-to-br from-amber-50 to-orange-50 border-amber-200"
                    }`}
                  >
                    <div
                      className={`w-20 h-20 mx-auto mb-4 rounded-full flex items-center justify-center ${
                        errorCount === 0
                          ? "bg-green-100 text-green-600"
                          : "bg-amber-100 text-amber-600"
                      }`}
                    >
                      <CheckCircle2 className="w-10 h-10" />
                    </div>
                    <h3
                      className={`text-2xl font-bold mb-2 ${
                        errorCount === 0 ? "text-green-900" : "text-amber-900"
                      }`}
                    >
                      {errorCount === 0
                        ? t("key.generateAssets.successTitle")
                        : t("key.generateAssets.partialFailTitle")}
                    </h3>
                    <p
                      className={
                        errorCount === 0 ? "text-green-700" : "text-amber-700"
                      }
                    >
                      {errorCount === 0
                        ? t("key.generateAssets.successDesc", {
                            count: generatingItems.length,
                          })
                        : t("key.generateAssets.partialFailDesc", {
                            success: generatingItems.length - errorCount,
                            failed: errorCount,
                          })}
                    </p>
                  </div>
                );
              })()}

            {/* 操作按钮 */}
            <div className="flex gap-4 pt-4">
              {!completed && !isGenerating && totalAssets === 0 && (
                <Button
                  onClick={handleGoToEditor}
                  className="w-full h-14 text-lg bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 shadow-lg hover:shadow-xl transition-all rounded-xl"
                >
                  <ArrowRight className="w-5 h-5 mr-2" />
                  {t("key.generateAssets.enterEditor")}
                </Button>
              )}

              {!completed && !isGenerating && totalAssets > 0 && (
                <>
                  <Button
                    variant="outline"
                    onClick={handleSkip}
                    className="flex-1 h-14 text-lg border-2 border-slate-200 hover:bg-slate-50 text-slate-600 rounded-xl"
                  >
                    <SkipForward className="w-5 h-5 mr-2" />
                    {t("key.generateAssets.skip")}
                  </Button>
                  <Button
                    onClick={handleGenerateAll}
                    disabled={isGenerating}
                    className="flex-[2] h-14 text-lg bg-gradient-to-r from-indigo-600 to-pink-600 hover:from-indigo-700 hover:to-pink-700 shadow-lg hover:shadow-indigo-500/25 transition-all rounded-xl"
                  >
                    {isGenerating ? (
                      <>
                        <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                        {t("key.generateAssets.generating")}
                      </>
                    ) : (
                      <>
                        <Wand2 className="w-5 h-5 mr-2" />
                        {t("key.generateAssets.generateAll", {
                          count: totalAssets,
                        })}
                      </>
                    )}
                  </Button>
                </>
              )}

              {completed && (
                <Button
                  onClick={handleGoToEditor}
                  className="w-full h-14 text-lg bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 shadow-lg hover:shadow-green-500/25 transition-all rounded-xl"
                >
                  <ArrowRight className="w-5 h-5 mr-2" />
                  {t("key.generateAssets.startCreation")}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function GenerateAssetsPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-indigo-50 to-purple-50">
          <Loader2 className="w-10 h-10 animate-spin text-indigo-600" />
        </div>
      }
    >
      <GenerateAssetsPageContent />
    </Suspense>
  );
}
