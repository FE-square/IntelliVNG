"use client";

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, Button, useToast, useConfirmDialog } from '@vng/ui';
import { 
  ArrowLeft, RefreshCw, Trash2, BarChart3, Cpu, Clock, 
  TrendingUp, Activity, Zap, Database, Image as ImageIcon, DollarSign
} from 'lucide-react';
import { useI18N } from '@/components/I18nProvider';

// i18n key 映射
const i18nMap = {
  title: 'key.tokenStats.title',
  subtitle: 'key.tokenStats.subtitle',
  backToHome: 'key.tokenStats.backToHome',
  refresh: 'key.tokenStats.refresh',
  clearAll: 'key.tokenStats.clearAll',
  loading: 'key.tokenStats.loading',
  noData: 'key.tokenStats.noData',
  noDataDesc: 'key.tokenStats.noDataDesc',
  totalTokens: 'key.tokenStats.totalTokens',
  promptTokens: 'key.tokenStats.promptTokens',
  completionTokens: 'key.tokenStats.completionTokens',
  callCount: 'key.tokenStats.callCount',
  bySource: 'key.tokenStats.bySource',
  byModel: 'key.tokenStats.byModel',
  byAgent: 'key.tokenStats.byAgent',
  timeRange: 'key.tokenStats.timeRange',
  allTime: 'key.tokenStats.allTime',
  today: 'key.tokenStats.today',
  last7Days: 'key.tokenStats.last7Days',
  last30Days: 'key.tokenStats.last30Days',
  clearTitle: 'key.tokenStats.clearTitle',
  clearMessage: 'key.tokenStats.clearMessage',
  clearConfirm: 'key.tokenStats.clearConfirm',
  clearCancel: 'key.tokenStats.clearCancel',
  clearSuccess: 'key.tokenStats.clearSuccess',
  clearFailed: 'key.tokenStats.clearFailed',
  refreshSuccess: 'key.tokenStats.refreshSuccess',
  loadFailed: 'key.tokenStats.loadFailed',
  tokens: 'key.tokenStats.tokens',
  calls: 'key.tokenStats.calls',
  // 图像费用相关
  imageCost: 'key.tokenStats.imageCost',
  imageTotalCost: 'key.tokenStats.imageTotalCost',
  imageCount: 'key.tokenStats.imageCount',
  byType: 'key.tokenStats.byType',
  images: 'key.tokenStats.images',
};

interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  count: number;
}

interface ImageCostSummary {
  totalCost: number;
  totalCount: number;
  byType: Record<string, { count: number; cost: number }>;
  byModel: Record<string, { count: number; cost: number }>;
}

interface TokenStats {
  totalPromptTokens: number;
  totalCompletionTokens: number;
  totalTokens: number;
  callCount: number;
  bySource: Record<string, TokenUsage>;
  byModel: Record<string, TokenUsage>;
  byAgent: Record<string, TokenUsage>;
  imageCost?: ImageCostSummary;
}

type TimeRange = 'all' | 'today' | '7days' | '30days';

/**
 * Token 用量统计 Dashboard
 */
export default function TokenStatsPage() {
  const { t, I18N } = useI18N();
  const router = useRouter();
  const toast = useToast();
  const { confirm, DialogComponent } = useConfirmDialog();
  
  const [stats, setStats] = useState<TokenStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<TimeRange>('all');
  const [connectionError, setConnectionError] = useState(false);

  // 获取后端服务地址
  const getBackendUrl = () => {
    if (typeof window !== 'undefined') {
      // 客户端：使用当前域名的 4000 端口
      return `${window.location.protocol}//${window.location.hostname}:4000`;
    }
    return 'http://localhost:4000';
  };

  // 加载统计数据
  const loadStats = useCallback(async (showError = true) => {
    setLoading(true);
    try {
      let url = `${getBackendUrl()}/api/game/token-stats`;
      
      // 如果有时间范围，添加查询参数
      if (timeRange !== 'all') {
        const now = Date.now();
        let startTime: number;
        
        switch (timeRange) {
          case 'today':
            startTime = new Date().setHours(0, 0, 0, 0);
            break;
          case '7days':
            startTime = now - 7 * 24 * 60 * 60 * 1000;
            break;
          case '30days':
            startTime = now - 30 * 24 * 60 * 60 * 1000;
            break;
          default:
            startTime = 0;
        }
        
        url += `?startTime=${startTime}&endTime=${now}`;
      }
      
      const response = await fetch(url);
      const result = await response.json();
      
      if (result.success) {
        setStats(result.data);
        setConnectionError(false);
      } else {
        throw new Error(result.error || 'Failed to load stats');
      }
    } catch (error) {
      console.error('[TokenStats] Load failed:', error);
      setConnectionError(true);
      // 只在手动刷新时显示错误提示
      if (showError) {
        toast.error(I18N[i18nMap.loadFailed] || '加载失败');
      }
    } finally {
      setLoading(false);
    }
  }, [timeRange]); // 移除 toast 和 I18N 依赖，避免无限循环

  useEffect(() => {
    loadStats(false); // 初始加载不显示错误
  }, [loadStats]);

  // 刷新数据
  const handleRefresh = async () => {
    await loadStats(true);
    toast.success(I18N[i18nMap.refreshSuccess] || '数据已刷新');
  };

  // 清除所有统计
  const handleClear = async () => {
    const confirmed = await confirm({
      title: I18N[i18nMap.clearTitle] || '清除统计数据',
      message: I18N[i18nMap.clearMessage] || '确定要清除所有 Token 统计数据吗？此操作不可恢复！',
      confirmText: I18N[i18nMap.clearConfirm] || '确认清除',
      cancelText: I18N[i18nMap.clearCancel] || '取消',
      variant: 'danger',
    });

    if (confirmed) {
      try {
        const response = await fetch(`${getBackendUrl()}/api/game/token-stats`, {
          method: 'DELETE',
        });
        
        if (response.ok) {
          setStats(null);
          toast.success(I18N[i18nMap.clearSuccess] || '统计数据已清除');
          loadStats();
        } else {
          throw new Error('Clear failed');
        }
      } catch (error) {
        console.error('[TokenStats] Clear failed:', error);
        toast.error(I18N[i18nMap.clearFailed] || '清除失败');
      }
    }
  };

  // 格式化数字
  const formatNumber = (num: number) => {
    return num.toLocaleString();
  };

  // 计算百分比
  const getPercentage = (value: number, total: number) => {
    if (total === 0) return 0;
    return Math.round((value / total) * 100);
  };

  // 渲染分组统计卡片
  const renderGroupStats = (
    title: string,
    icon: React.ReactNode,
    data: Record<string, TokenUsage>,
    colorClass: string
  ) => {
    const entries = Object.entries(data);
    if (entries.length === 0) return null;
    
    const total = entries.reduce((sum, [, v]) => sum + v.totalTokens, 0);

    return (
      <Card className="overflow-hidden">
        <CardHeader className={`${colorClass} text-white py-3`}>
          <CardTitle className="flex items-center gap-2 text-lg">
            {icon}
            {title}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y divide-slate-100">
            {entries
              .sort((a, b) => b[1].totalTokens - a[1].totalTokens)
              .map(([key, value]) => (
                <div key={key} className="px-4 py-3 hover:bg-slate-50 transition-colors">
                  <div className="flex justify-between items-center mb-1">
                    <span className="font-medium text-slate-700 truncate max-w-[60%]" title={key}>
                      {key}
                    </span>
                    <span className="text-sm text-slate-500">
                      {value.count} {I18N[i18nMap.calls] || '次'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-slate-100 rounded-full h-2 overflow-hidden">
                      <div 
                        className={`h-full ${colorClass} transition-all duration-300`}
                        style={{ width: `${getPercentage(value.totalTokens, total)}%` }}
                      />
                    </div>
                    <span className="text-sm font-semibold text-slate-600 min-w-[80px] text-right">
                      {formatNumber(value.totalTokens)}
                    </span>
                  </div>
                </div>
              ))}
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-900 to-slate-900 p-6">
      <div className="max-w-7xl mx-auto">
        {/* 标题栏 */}
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2 flex items-center gap-3">
              <BarChart3 className="w-8 h-8 text-indigo-400" />
              {I18N[i18nMap.title] || 'Token 用量统计'}
            </h1>
            <p className="text-slate-300">
              {I18N[i18nMap.subtitle] || '监控 LLM API 调用的 Token 消耗'}
            </p>
          </div>
          <div className="flex gap-3 flex-wrap">
            {/* 时间范围选择 */}
            <select
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value as TimeRange)}
              className="px-4 py-2 rounded-lg bg-white/10 text-white border border-white/20 
                         focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="all" className="text-slate-900">{I18N[i18nMap.allTime] || '全部时间'}</option>
              <option value="today" className="text-slate-900">{I18N[i18nMap.today] || '今天'}</option>
              <option value="7days" className="text-slate-900">{I18N[i18nMap.last7Days] || '最近7天'}</option>
              <option value="30days" className="text-slate-900">{I18N[i18nMap.last30Days] || '最近30天'}</option>
            </select>
            
            <Button
              className="bg-white/10 text-white border border-white/20 hover:bg-white/20"
              onClick={handleRefresh}
              disabled={loading}
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              {I18N[i18nMap.refresh] || '刷新'}
            </Button>
            
            <Button
              variant="outline"
              className="bg-red-500/20 text-red-300 border-red-500/30 hover:bg-red-500/30"
              onClick={handleClear}
              disabled={loading || (!stats?.callCount && !stats?.imageCost?.totalCount)}
            >
              <Trash2 className="w-4 h-4 mr-2" />
              {I18N[i18nMap.clearAll] || '清除数据'}
            </Button>
            
            <Button
              variant="outline"
              className="bg-white/10 text-white border-white/20 hover:bg-white/20"
              onClick={() => router.push('/')}
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              {I18N[i18nMap.backToHome] || '返回首页'}
            </Button>
          </div>
        </div>

        {/* 加载状态 */}
        {loading && (
          <div className="text-center py-20">
            <div className="inline-block w-12 h-12 border-4 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
            <p className="text-white mt-4">{I18N[i18nMap.loading] || '加载中...'}</p>
          </div>
        )}

        {/* 连接错误状态 */}
        {!loading && connectionError && (
          <Card className="text-center py-20 bg-red-500/5 border-red-500/20">
            <CardContent>
              <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-red-500/20 flex items-center justify-center">
                <Activity className="w-12 h-12 text-red-400" />
              </div>
              <h2 className="text-2xl font-bold text-white mb-3">
                ⚠️ 无法连接后端服务
              </h2>
              <p className="text-slate-400 mb-6">
                请确保后端服务已启动 (端口 4000)
              </p>
              <Button
                className="bg-indigo-600 hover:bg-indigo-700 text-white"
                onClick={() => loadStats(true)}
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                重试连接
              </Button>
            </CardContent>
          </Card>
        )}

        {/* 无数据状态 */}
        {!loading && !connectionError && (!stats || (stats.callCount === 0 && (!stats.imageCost || stats.imageCost.totalCount === 0))) && (
          <Card className="text-center py-20 bg-white/5 border-white/10">
            <CardContent>
              <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-indigo-500/20 flex items-center justify-center">
                <Database className="w-12 h-12 text-indigo-400" />
              </div>
              <h2 className="text-2xl font-bold text-white mb-3">
                {I18N[i18nMap.noData] || '暂无统计数据'}
              </h2>
              <p className="text-slate-400">
                {I18N[i18nMap.noDataDesc] || '使用 AI 功能后，这里将显示 Token 消耗统计'}
              </p>
            </CardContent>
          </Card>
        )}

        {/* 统计数据展示 */}
        {!loading && !connectionError && stats && (stats.callCount > 0 || (stats.imageCost && stats.imageCost.totalCount > 0)) && (
          <>
            {/* 总览卡片 */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              {/* 总 Token 数 */}
              <Card className="bg-gradient-to-br from-indigo-500 to-purple-600 text-white border-0">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-2">
                    <Zap className="w-8 h-8 opacity-80" />
                    <span className="text-xs bg-white/20 px-2 py-1 rounded-full">Total</span>
                  </div>
                  <div className="text-3xl font-bold mb-1">
                    {formatNumber(stats.totalTokens)}
                  </div>
                  <div className="text-indigo-200 text-sm">
                    {I18N[i18nMap.totalTokens] || '总 Token 数'}
                  </div>
                </CardContent>
              </Card>

              {/* Prompt Token */}
              <Card className="bg-gradient-to-br from-emerald-500 to-teal-600 text-white border-0">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-2">
                    <TrendingUp className="w-8 h-8 opacity-80" />
                    <span className="text-xs bg-white/20 px-2 py-1 rounded-full">Input</span>
                  </div>
                  <div className="text-3xl font-bold mb-1">
                    {formatNumber(stats.totalPromptTokens)}
                  </div>
                  <div className="text-emerald-200 text-sm">
                    {I18N[i18nMap.promptTokens] || 'Prompt Token'}
                  </div>
                </CardContent>
              </Card>

              {/* Completion Token */}
              <Card className="bg-gradient-to-br from-amber-500 to-orange-600 text-white border-0">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-2">
                    <Activity className="w-8 h-8 opacity-80" />
                    <span className="text-xs bg-white/20 px-2 py-1 rounded-full">Output</span>
                  </div>
                  <div className="text-3xl font-bold mb-1">
                    {formatNumber(stats.totalCompletionTokens)}
                  </div>
                  <div className="text-amber-200 text-sm">
                    {I18N[i18nMap.completionTokens] || 'Completion Token'}
                  </div>
                </CardContent>
              </Card>

              {/* 调用次数 */}
              <Card className="bg-gradient-to-br from-rose-500 to-pink-600 text-white border-0">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-2">
                    <Clock className="w-8 h-8 opacity-80" />
                    <span className="text-xs bg-white/20 px-2 py-1 rounded-full">Calls</span>
                  </div>
                  <div className="text-3xl font-bold mb-1">
                    {formatNumber(stats.callCount)}
                  </div>
                  <div className="text-rose-200 text-sm">
                    {I18N[i18nMap.callCount] || '调用次数'}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* 图像费用统计 */}
            {stats.imageCost && stats.imageCost.totalCount > 0 && (
              <div className="mb-8">
                <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                  <ImageIcon className="w-6 h-6 text-cyan-400" />
                  {I18N[i18nMap.imageCost] || '🖼️ 图像生成费用'}
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {/* 总费用 */}
                  <Card className="bg-gradient-to-br from-cyan-500 to-blue-600 text-white border-0">
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between mb-2">
                        <DollarSign className="w-8 h-8 opacity-80" />
                        <span className="text-xs bg-white/20 px-2 py-1 rounded-full">Cost</span>
                      </div>
                      <div className="text-3xl font-bold mb-1">
                        ¥{stats.imageCost.totalCost.toFixed(2)}
                      </div>
                      <div className="text-cyan-200 text-sm">
                        {I18N[i18nMap.imageTotalCost] || '图像生成总费用'}
                      </div>
                    </CardContent>
                  </Card>

                  {/* 生成次数 */}
                  <Card className="bg-gradient-to-br from-violet-500 to-purple-600 text-white border-0">
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between mb-2">
                        <ImageIcon className="w-8 h-8 opacity-80" />
                        <span className="text-xs bg-white/20 px-2 py-1 rounded-full">Images</span>
                      </div>
                      <div className="text-3xl font-bold mb-1">
                        {formatNumber(stats.imageCost.totalCount)}
                      </div>
                      <div className="text-violet-200 text-sm">
                        {I18N[i18nMap.imageCount] || '图像生成次数'}
                      </div>
                    </CardContent>
                  </Card>

                  {/* 按类型分布 */}
                  <Card className="bg-white/5 border-white/10 col-span-1 md:col-span-2">
                    <CardContent className="p-6">
                      <div className="text-white/60 text-sm mb-3">{I18N[i18nMap.byType] || '按类型分布'}</div>
                      <div className="flex flex-wrap gap-4">
                        {Object.entries(stats.imageCost.byType).map(([type, data]) => (
                          <div key={type} className="flex items-center gap-2">
                            <span className={`w-3 h-3 rounded-full ${
                              type === 'sprite' ? 'bg-green-400' :
                              type === 'avatar' ? 'bg-blue-400' : 'bg-orange-400'
                            }`} />
                            <span className="text-white capitalize">{type}</span>
                            <span className="text-white/60">{data.count} {I18N[i18nMap.images] || '张'}</span>
                            <span className="text-cyan-400">¥{data.cost.toFixed(2)}</span>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            )}

            {/* 分组统计 */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* 按来源统计 */}
              {renderGroupStats(
                I18N[i18nMap.bySource] || '按来源统计',
                <Cpu className="w-5 h-5" />,
                stats.bySource,
                'bg-indigo-500'
              )}

              {/* 按模型统计 */}
              {renderGroupStats(
                I18N[i18nMap.byModel] || '按模型统计',
                <BarChart3 className="w-5 h-5" />,
                stats.byModel,
                'bg-emerald-500'
              )}

              {/* 按 Agent 统计 */}
              {Object.keys(stats.byAgent).length > 0 && renderGroupStats(
                I18N[i18nMap.byAgent] || '按 Agent 统计',
                <Activity className="w-5 h-5" />,
                stats.byAgent,
                'bg-amber-500'
              )}
            </div>
          </>
        )}
      </div>
      {DialogComponent}
    </div>
  );
}

