"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, Button, useToast, useConfirmDialog } from '@vng/ui';
import { Plus, Trash2, Edit, Calendar, Users, Image as ImageIcon, FileCode, ArrowLeft, Upload, Settings, Download, Play, CheckSquare, Square } from 'lucide-react';
import { getAllProjects, deleteProject, ProjectMetadata, saveProject, getProject } from '@/lib/projectStorage';
import { importProjectFromJson, openFileDialog, exportProjectAsJson } from '@/lib/projectExport';
import { useI18N } from '@/components/I18nProvider';
import { ProjectSettingsEditor } from '@/components/ProjectSettingsEditor';

// 定义多语言key映射
const i18nMap = {
  title: 'key.dashboard.title.myProjects',
  subtitle: 'key.dashboard.title.manageYourProjects',
  createNewProject: 'key.dashboard.button.createNewProject',
  backToHome: 'key.dashboard.button.backToHome',
  importProject: 'key.dashboard.button.importProject',
  loading: 'key.dashboard.loading',
  emptyTitle: 'key.dashboard.empty.title',
  emptyDescription: 'key.dashboard.empty.description',
  emptyButton: 'key.dashboard.empty.button',
  noDescription: 'key.dashboard.project.noDescription',
  characters: 'key.dashboard.project.stats.characters',
  scenes: 'key.dashboard.project.stats.scenes',
  storyNodes: 'key.dashboard.project.stats.storyNodes',
  updated: 'key.dashboard.project.updated',
  autoSaved: 'key.dashboard.project.autoSaved',
  note: 'key.dashboard.project.note',
  edit: 'key.dashboard.project.button.edit',
  editScript: 'key.dashboard.project.button.editScript',
  editSettings: 'key.dashboard.project.button.editSettings',
  export: 'key.dashboard.project.button.export',
  preview: 'key.dashboard.project.button.preview',
  deleteBtn: 'key.dashboard.project.button.delete',
  deleteTitle: 'key.dashboard.delete.title',
  deleteMessage: 'key.dashboard.delete.message',
  deleteConfirm: 'key.dashboard.delete.confirm',
  deleteCancel: 'key.dashboard.delete.cancel',
  deleteSuccess: 'key.dashboard.delete.success',
  deleteError: 'key.dashboard.delete.error',
  deleteRetry: 'key.dashboard.delete.retry',
  importSuccess: 'key.dashboard.import.success',
  importRedirecting: 'key.dashboard.import.redirecting',
  importSaveFailed: 'key.dashboard.import.saveFailed',
  importFailed: 'key.dashboard.import.failed',
  exportSuccess: 'key.dashboard.export.success',
  settingsLoadFailed: 'key.dashboard.settings.loadFailed',
  settingsSaveSuccess: 'key.dashboard.settings.saveSuccess',
  settingsSaveDescription: 'key.dashboard.settings.saveDescription',
  settingsSaveFailed: 'key.dashboard.settings.saveFailed',
  batchManagement: 'key.dashboard.batch.management',
  cancelSelection: 'key.dashboard.batch.cancelSelection',
  selectAll: 'key.dashboard.batch.selectAll',
  deselectAll: 'key.dashboard.batch.deselectAll',
  selectedCount: 'key.dashboard.batch.selectedCount',
  deleteSelected: 'key.dashboard.batch.deleteSelected',
  batchDeleteTitle: 'key.dashboard.batch.deleteTitle',
  batchDeleteMessage: 'key.dashboard.batch.deleteMessage',
  batchDeleteConfirm: 'key.dashboard.batch.deleteConfirm',
  batchDeleteCancel: 'key.dashboard.batch.deleteCancel',
  batchDeleteSuccess: 'key.dashboard.batch.deleteSuccess',
  batchDeleteFailed: 'key.dashboard.batch.deleteFailed',
  generating: 'key.dashboard.generating',
  generateSuccess: 'key.dashboard.generateSuccess',
  generateFailed: 'key.dashboard.generateFailed',
};

/**
 * 项目列表页 - 显示所有已保存的项目
 */
export default function DashboardPage() {
    const { t, I18N } = useI18N();
    const router = useRouter();
    const toast = useToast();
    const { confirm, DialogComponent } = useConfirmDialog();
    const [projects, setProjects] = useState<ProjectMetadata[]>([]);
    const [loading, setLoading] = useState(true);
    const [editingProject, setEditingProject] = useState<any>(null);
    const [showSettingsDialog, setShowSettingsDialog] = useState(false);
    const [selectedProjects, setSelectedProjects] = useState<Set<string>>(new Set());
    const [isSelectionMode, setIsSelectionMode] = useState(false);
    const [currentLocale, setCurrentLocale] = useState('');
    const [i18nReady, setI18nReady] = useState(false);
    
    // 监听URL变化，获取locale参数
    useEffect(() => {
        if (typeof window !== 'undefined') {
            const params = new URLSearchParams(window.location.search);
            const locale = params.get('locale') || 'zh-CN';
            setCurrentLocale(locale);
            
            // 调试：打印I18N对象
            console.log('[Dashboard] Current locale:', locale);
            console.log('[Dashboard] I18N sample:', I18N[i18nMap.title], I18N[i18nMap.importProject]);
            console.log('[Dashboard] window.__APP_INITIAL_STATE__.I18N:', window.__APP_INITIAL_STATE__?.I18N);
            
            // 等待一小段时间确保I18N已加载，然后标记为ready
            setTimeout(() => {
                setI18nReady(true);
            }, 50);
        }
    }, []);
    
    useEffect(() => {
        loadProjects();
    }, []); // 监听URL参数变化，触发重新加载
    
    const loadProjects = async () => {
        setLoading(true);
        try {
            const allProjects = await getAllProjects();
            console.log('[Dashboard] 加载的项目数据:', allProjects);
            setProjects(allProjects);
        } catch (error) {
            console.error('Failed to load projects:', error);
        } finally {
            setLoading(false);
        }
    };
    
    const handleDelete = async (projectId: string, projectTitle: string) => {
        const confirmed = await confirm({
            title: t(i18nMap.deleteTitle),
            message: t(i18nMap.deleteMessage, { title: projectTitle }),
            confirmText: t(i18nMap.deleteConfirm),
            cancelText: t(i18nMap.deleteCancel),
            variant: 'danger',
        });
        
        if (confirmed) {
            const success = await deleteProject(projectId);
            if (success) {
                toast.success(t(i18nMap.deleteSuccess));
                loadProjects(); // 重新加载列表
            } else {
                toast.error(
                    t(i18nMap.deleteError),
                    t(i18nMap.deleteRetry)
                );
            }
        }
    };
    
    // 批量删除
    const handleBatchDelete = async () => {
        const selectedCount = selectedProjects.size;
        if (selectedCount === 0) return;
        
        const confirmed = await confirm({
            title: t(i18nMap.batchDeleteTitle),
            message: t(i18nMap.batchDeleteMessage, { count: selectedCount.toString() }),
            confirmText: t(i18nMap.batchDeleteConfirm),
            cancelText: t(i18nMap.batchDeleteCancel),
            variant: 'danger',
        });
        
        if (confirmed) {
            let successCount = 0;
            for (const projectId of Array.from(selectedProjects)) {
                const success = await deleteProject(projectId);
                if (success) successCount++;
            }
            
            if (successCount > 0) {
                toast.success(
                    t(i18nMap.batchDeleteSuccess),
                    t(i18nMap.selectedCount, { selected: successCount.toString(), total: selectedCount.toString() })
                );
                setSelectedProjects(new Set());
                setIsSelectionMode(false);
                loadProjects();
            } else {
                toast.error(t(i18nMap.batchDeleteFailed), t(i18nMap.deleteRetry));
            }
        }
    };
    
    // 切换项目选中状态
    const toggleProjectSelection = (projectId: string) => {
        const newSelection = new Set(selectedProjects);
        if (newSelection.has(projectId)) {
            newSelection.delete(projectId);
        } else {
            newSelection.add(projectId);
        }
        setSelectedProjects(newSelection);
    };
    
    // 全选/取消全选
    const toggleSelectAll = () => {
        if (selectedProjects.size === projects.length) {
            setSelectedProjects(new Set());
        } else {
            setSelectedProjects(new Set(projects.map(p => p.id)));
        }
    };
    
    const formatDate = (dateStr: string) => {
        const date = new Date(dateStr);
        return date.toLocaleDateString('zh-CN', { 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };
    
    // 导入项目
    const handleImportProject = async () => {
        try {
            const file = await openFileDialog('.json,.vng.json');
            const importedProject = await importProjectFromJson(file);
            
            const newProject = {
                ...importedProject,
                id: `imported-${Date.now()}`,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            };
            
            const success = await saveProject(newProject);
            
            if (success) {
                toast.success(t(i18nMap.importSuccess), t(i18nMap.importRedirecting));
                setTimeout(() => {
                    router.push(`/editor?projectId=${newProject.id}`);
                }, 1000);
            } else {
                toast.error(t(i18nMap.importFailed), t(i18nMap.importSaveFailed));
            }
        } catch (error) {
            console.error('[Dashboard] 导入失败:', error);
            toast.error(t(i18nMap.importFailed), error instanceof Error ? error.message : '');
        }
    };
    
    // 保存项目设定
    const handleSaveSettings = async (updatedProject: any) => {
        try {
            const success = await saveProject(updatedProject);
            
            if (success) {
                toast.success(t(i18nMap.settingsSaveSuccess), t(i18nMap.settingsSaveDescription));
                setShowSettingsDialog(false);
                setEditingProject(null);
                loadProjects(); // 重新加载项目列表
            } else {
                toast.error(t(i18nMap.settingsSaveFailed), t(i18nMap.deleteRetry));
            }
        } catch (error) {
            console.error('[Dashboard] 保存设定失败:', error);
            toast.error(t(i18nMap.settingsSaveFailed), error instanceof Error ? error.message : '');
        }
    };

    // 如果I18N未准备好，显示loading
    if (!i18nReady) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 p-8 flex items-center justify-center">
                <div className="text-center">
                    <div className="inline-block w-12 h-12 border-4 border-white/30 border-t-white rounded-full animate-spin" />
                </div>
            </div>
        );
    }

    return (
        <div key={currentLocale} className="min-h-screen bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 p-8">
            <div className="max-w-7xl mx-auto">
                {/* 标题栏 */}
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <h1 className="text-4xl font-bold text-white mb-2" suppressHydrationWarning>
                            {I18N[i18nMap.title] || '我的项目'}
                        </h1>
                        <p className="text-white/80" suppressHydrationWarning>
                            {I18N[i18nMap.subtitle] || '管理您的所有创作项目'}
                        </p>
                    </div>
                    <div className="flex gap-3">
                        {projects.length > 0 && (
                            <Button
                                className="bg-white/20 text-white border-white/40 hover:bg-white/30 border"
                                onClick={() => {
                                    setIsSelectionMode(!isSelectionMode);
                                    setSelectedProjects(new Set());
                                }}
                            >
                                {isSelectionMode ? (
                                    <>
                                        <Square className="w-4 h-4 mr-2" />
                                        <span suppressHydrationWarning>{I18N[i18nMap.cancelSelection] || '取消选择'}</span>
                                    </>
                                ) : (
                                    <>
                                        <CheckSquare className="w-4 h-4 mr-2" />
                                        <span suppressHydrationWarning>{I18N[i18nMap.batchManagement] || '批量管理'}</span>
                                    </>
                                )}
                            </Button>
                        )}
                        <Button
                            className="bg-white/20 text-white border-white/40 hover:bg-white/30 border"
                            onClick={handleImportProject}
                        >
                            <Upload className="w-4 h-4 mr-2" />
                            <span suppressHydrationWarning>{I18N[i18nMap.importProject] || '导入项目'}</span>
                        </Button>
                        <Button
                            className="bg-white/20 text-white border-white/40 hover:bg-white/30 border"
                            onClick={() => router.push('/setup')}
                        >
                            <Plus className="w-4 h-4 mr-2" />
                            <span suppressHydrationWarning>{I18N[i18nMap.createNewProject] || '创建新项目'}</span>
                        </Button>
                        <Button
                            variant="outline"
                            className="bg-white/20 text-white border-white/40 hover:bg-white/30"
                            onClick={() => router.push('/')}
                        >
                            <ArrowLeft className="w-4 h-4 mr-2" />
                            <span suppressHydrationWarning>{I18N[i18nMap.backToHome] || '返回首页'}</span>
                        </Button>
                    </div>
                </div>

                {/* 批量操作栏 */}
                {isSelectionMode && projects.length > 0 && (
                    <div className="bg-white/90 backdrop-blur-sm rounded-lg p-4 mb-6 flex items-center justify-between shadow-lg">
                        <div className="flex items-center gap-4">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={toggleSelectAll}
                            >
                                {selectedProjects.size === projects.length ? (
                                    <>
                                        <Square className="w-4 h-4 mr-2" />
                                        <span suppressHydrationWarning>{I18N[i18nMap.deselectAll] || '取消全选'}</span>
                                    </>
                                ) : (
                                    <>
                                        <CheckSquare className="w-4 h-4 mr-2" />
                                        <span suppressHydrationWarning>{I18N[i18nMap.selectAll] || '全选'}</span>
                                    </>
                                )}
                            </Button>
                            <span className="text-sm text-slate-600" suppressHydrationWarning>
                                {t(i18nMap.selectedCount, { selected: selectedProjects.size.toString(), total: projects.length.toString() })}
                            </span>
                        </div>
                        <Button
                            variant="outline"
                            size="sm"
                            className="border-red-300 text-red-600 hover:bg-red-50"
                            onClick={handleBatchDelete}
                            disabled={selectedProjects.size === 0}
                        >
                            <Trash2 className="w-4 h-4 mr-2" />
                            <span suppressHydrationWarning>{I18N[i18nMap.deleteSelected] || '删除选中项目'}</span>
                        </Button>
                    </div>
                )}

                {/* 项目列表 */}
                {loading ? (
                    <div className="text-center py-20">
                        <div className="inline-block w-12 h-12 border-4 border-white/30 border-t-white rounded-full animate-spin" />
                        <p className="text-white mt-4" suppressHydrationWarning>
                            {I18N[i18nMap.loading] || '加载中...'}
                        </p>
                    </div>
                ) : projects.length === 0 ? (
                    <Card className="text-center py-20">
                        <CardContent>
                            <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-slate-100 flex items-center justify-center">
                                <FileCode className="w-12 h-12 text-slate-400" />
                            </div>
                            <h2 className="text-2xl font-bold text-slate-800 mb-3" suppressHydrationWarning>
                                {I18N[i18nMap.emptyTitle] || '还没有项目'}
                            </h2>
                            <p className="text-slate-500 mb-6" suppressHydrationWarning>
                                {I18N[i18nMap.emptyDescription] || '开始创建您的第一个视觉小说项目'}
                            </p>
                            <Button
                                className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700"
                                onClick={() => router.push('/setup')}
                            >
                                <Plus className="w-4 h-4 mr-2" />
                                <span suppressHydrationWarning>{I18N[i18nMap.emptyButton] || '创建项目'}</span>
                            </Button>
                        </CardContent>
                    </Card>
                ) : (
                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {projects.map((project) => (
                            <Card 
                                key={project.id} 
                                className={`hover:shadow-2xl transition-all cursor-pointer group overflow-hidden relative ${
                                    isSelectionMode && selectedProjects.has(project.id) ? 'ring-4 ring-indigo-500' : ''
                                }`}
                            >
                                {/* 选择复选框 */}
                                {isSelectionMode && (
                                    <div className="absolute top-2 left-2 z-10">
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            className={`w-8 h-8 p-0 rounded-full ${
                                                selectedProjects.has(project.id) 
                                                    ? 'bg-indigo-600 text-white border-indigo-600 hover:bg-indigo-700' 
                                                    : 'bg-white/90 hover:bg-white'
                                            }`}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                toggleProjectSelection(project.id);
                                            }}
                                        >
                                            {selectedProjects.has(project.id) ? (
                                                <CheckSquare className="w-5 h-5" />
                                            ) : (
                                                <Square className="w-5 h-5" />
                                            )}
                                        </Button>
                                    </div>
                                )}
                                
                                {/* 封面图 */}
                                <div 
                                    className="h-40 bg-gradient-to-br from-slate-200 to-slate-300 relative overflow-hidden"
                                    style={{
                                        backgroundImage: project.coverImage ? `url(${project.coverImage})` : undefined,
                                        backgroundSize: 'cover',
                                        backgroundPosition: 'center'
                                    }}
                                >
                                    {!project.coverImage && (
                                        <div className="absolute inset-0 flex items-center justify-center">
                                            <ImageIcon className="w-16 h-16 text-slate-400" />
                                        </div>
                                    )}
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                                </div>

                                <CardHeader>
                                    <CardTitle className="text-xl line-clamp-1">{project.title}</CardTitle>
                                    <CardDescription className="line-clamp-2" suppressHydrationWarning>
                                        {project.description || I18N[i18nMap.noDescription] || '暂无描述'}
                                    </CardDescription>
                                </CardHeader>

                                <CardContent>
                                    {/* 统计信息 */}
                                    <div className="grid grid-cols-3 gap-2 mb-4 text-sm">
                                        <div className="text-center p-2 bg-indigo-50 rounded">
                                            <Users className="w-4 h-4 mx-auto mb-1 text-indigo-600" />
                                            <div className="font-semibold text-indigo-700">{project.characterCount}</div>
                                            <div className="text-xs text-slate-500" suppressHydrationWarning>
                                                {I18N[i18nMap.characters] || '角色'}
                                            </div>
                                        </div>
                                        <div className="text-center p-2 bg-purple-50 rounded">
                                            <ImageIcon className="w-4 h-4 mx-auto mb-1 text-purple-600" />
                                            <div className="font-semibold text-purple-700">{project.sceneCount}</div>
                                            <div className="text-xs text-slate-500" suppressHydrationWarning>
                                                {I18N[i18nMap.scenes] || '场景'}
                                            </div>
                                        </div>
                                        <div className="text-center p-2 bg-pink-50 rounded">
                                            <FileCode className="w-4 h-4 mx-auto mb-1 text-pink-600" />
                                            <div className="font-semibold text-pink-700">{project.nodeCount}</div>
                                            <div className="text-xs text-slate-500" suppressHydrationWarning>
                                                {I18N[i18nMap.storyNodes] || '节点'}
                                            </div>
                                        </div>
                                    </div>

                                    {/* 时间信息 + 保存备注 */}
                                    <div className="space-y-2 mb-4">
                                        <div className="flex items-center gap-2 text-xs text-slate-500" suppressHydrationWarning>
                                            <Calendar className="w-3 h-3" />
                                            <span>{I18N[i18nMap.updated] || '更新'}: {formatDate(project.updatedAt)}</span>
                                            {project.autoSaved && (
                                                <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs">
                                                    {I18N[i18nMap.autoSaved] || '自动保存'}
                                                </span>
                                            )}
                                        </div>
                                        {project.saveNote && (
                                            <div className="text-xs text-slate-600 bg-amber-50 px-2 py-1.5 rounded border border-amber-200" suppressHydrationWarning>
                                                <span className="font-semibold text-amber-700">{I18N[i18nMap.note] || '备注'}:</span> {project.saveNote}
                                            </div>
                                        )}
                                    </div>

                                    {/* 操作按钮 - 重新设计 */}
                                    <div className="space-y-2">
                                        {/* 主操作按钮组 */}
                                        <div className="grid grid-cols-2 gap-2">
                                            <Button
                                                className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white"
                                                onClick={() => router.push(`/editor?projectId=${project.id}`)}
                                            >
                                                <Edit className="w-4 h-4 mr-1" />
                                                <span suppressHydrationWarning>{I18N[i18nMap.editScript] || '编辑剧本'}</span>
                                            </Button>
                                            <Button
                                                variant="outline"
                                                className="border-indigo-200 text-indigo-600 hover:bg-indigo-50"
                                                onClick={async () => {
                                                    const fullProject = await getProject(project.id);
                                                    if (fullProject) {
                                                        setEditingProject(fullProject);
                                                        setShowSettingsDialog(true);
                                                    } else {
                                                        toast.error(t(i18nMap.settingsLoadFailed));
                                                    }
                                                }}
                                            >
                                                <Settings className="w-4 h-4 mr-1" />
                                                <span suppressHydrationWarning>{I18N[i18nMap.editSettings] || '编辑设定'}</span>
                                            </Button>
                                        </div>
                                        
                                        {/* 次要操作按钮组 */}
                                        <div className="grid grid-cols-3 gap-2">
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                className="text-xs"
                                                onClick={async () => {
                                                    const fullProject = await getProject(project.id);
                                                    if (fullProject) {
                                                        exportProjectAsJson(fullProject);
                                                        toast.success(t(i18nMap.exportSuccess));
                                                    }
                                                }}
                                            >
                                                <Download className="w-3 h-3 mr-1" />
                                                <span suppressHydrationWarning>{I18N[i18nMap.export] || '导出'}</span>
                                            </Button>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                className="text-xs bg-green-50 border-green-200 text-green-700 hover:bg-green-100"
                                                onClick={() => {
                                                    router.push(`/editor?projectId=${project.id}&autoPreview=true`);
                                                }}
                                            >
                                                <Play className="w-3 h-3 mr-1" />
                                                <span suppressHydrationWarning>{I18N[i18nMap.preview] || '预览'}</span>
                                            </Button>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                className="border-red-200 text-red-600 hover:bg-red-50 text-xs"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleDelete(project.id, project.title);
                                                }}
                                            >
                                                <Trash2 className="w-3 h-3 mr-1" />
                                                <span suppressHydrationWarning>{I18N[i18nMap.deleteBtn] || '删除'}</span>
                                            </Button>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                )}
            </div>
            {DialogComponent}
            
            {/* 项目设定编辑对话框 */}
            {showSettingsDialog && editingProject && (
                <ProjectSettingsEditor
                    project={editingProject}
                    onSave={handleSaveSettings}
                    onClose={() => {
                        setShowSettingsDialog(false);
                        setEditingProject(null);
                    }}
                    i18n={{
                        title: I18N['key.projectSettings.title'] || '编辑项目设定',
                        basicInfo: I18N['key.projectSettings.basicInfo'] || '📝 基本信息',
                        characters: I18N['key.projectSettings.characters'] || '👥 角色',
                        world: I18N['key.projectSettings.world'] || '🌍 世界观',
                        scenes: I18N['key.projectSettings.scenes'] || '🏞️ 场景',
                        theme: I18N['key.projectSettings.theme'] || '🎨 主题风格',
                        save: I18N['key.projectSettings.save'] || '保存设定',
                        cancel: I18N['key.projectSettings.cancel'] || '取消',
                        coverImage: I18N['key.projectSettings.coverImage'] || '🖼️ 项目封面',
                        coverPlaceholder: I18N['key.projectSettings.coverPlaceholder'] || '输入封面图URL或使用AI生成',
                        projectName: I18N['key.projectSettings.projectName'] || '项目名称',
                        projectDesc: I18N['key.projectSettings.projectDesc'] || '项目描述',
                        descPlaceholder: I18N['key.projectSettings.descPlaceholder'] || '简要描述你的视觉小说...',
                        author: I18N['key.projectSettings.author'] || '作者',
                        version: I18N['key.projectSettings.version'] || '版本',
                        genre: I18N['key.projectSettings.genre'] || '故事类型',
                        artStyle: I18N['key.projectSettings.artStyle'] || '美术风格',
                        anime: I18N['key.projectSettings.anime'] || '动漫',
                        realistic: I18N['key.projectSettings.realistic'] || '写实',
                        pixel: I18N['key.projectSettings.pixel'] || '像素',
                        watercolor: I18N['key.projectSettings.watercolor'] || '水彩',
                        other: I18N['key.projectSettings.other'] || '其他',
                        fillNameFirst: I18N['key.projectSettings.fillNameFirst'] || '请先填写项目名称',
                        generating: I18N['key.projectSettings.generating'] || '生成中...',
                        generateSuccess: I18N['key.projectSettings.generateSuccess'] || '生成成功',
                        generateFailed: I18N['key.projectSettings.generateFailed'] || '生成失败',
                        generate: I18N['key.projectSettings.generate'] || '生成',
                        characterList: I18N['key.projectSettings.characterList'] || '👥 角色列表',
                        addCharacter: I18N['key.projectSettings.addCharacter'] || '添加角色',
                        newCharacter: I18N['key.projectSettings.newCharacter'] || '新增角色',
                        characterNameRequired: I18N['key.projectSettings.characterNameRequired'] || '角色名称 *',
                        characterNamePlaceholder: I18N['key.projectSettings.characterNamePlaceholder'] || '例如: 李明',
                        gender: I18N['key.projectSettings.gender'] || '性别',
                        male: I18N['key.projectSettings.male'] || '男',
                        female: I18N['key.projectSettings.female'] || '女',
                        age: I18N['key.projectSettings.age'] || '年龄',
                        agePlaceholder: I18N['key.projectSettings.agePlaceholder'] || '例如: 25',
                        identity: I18N['key.projectSettings.identity'] || '身份',
                        identityPlaceholder: I18N['key.projectSettings.identityPlaceholder'] || '例如: 学生、侦探',
                        characterDescRequired: I18N['key.projectSettings.characterDescRequired'] || '角色描述 *',
                        characterDescPlaceholder: I18N['key.projectSettings.characterDescPlaceholder'] || '描述角色的外貌、性格等...',
                        personality: I18N['key.projectSettings.personality'] || '性格特征',
                        personalityPlaceholder: I18N['key.projectSettings.personalityPlaceholder'] || '例如: 开朗, 善良, 勇敢 (用逗号分隔)',
                        avatar: I18N['key.projectSettings.avatar'] || '👤 角色头像',
                        sprites: I18N['key.projectSettings.sprites'] || '💼 角色立绘',
                        aiHelp: I18N['key.projectSettings.aiHelp'] || 'AI帮我填',
                        aiCompleting: I18N['key.projectSettings.aiCompleting'] || 'AI补全中...',
                        urlAdd: I18N['key.projectSettings.urlAdd'] || '🔗 URL添加',
                        enterAvatarUrl: I18N['key.projectSettings.enterAvatarUrl'] || '输入头像图URL',
                        enterSpriteUrl: I18N['key.projectSettings.enterSpriteUrl'] || '输入立绘图URL',
                        urlPlaceholder: I18N['key.projectSettings.urlPlaceholder'] || 'https://example.com/image.png',
                        confirm: I18N['key.projectSettings.confirm'] || '确定',
                        avatarAdded: I18N['key.projectSettings.avatarAdded'] || '头像添加成功',
                        spriteAdded: I18N['key.projectSettings.spriteAdded'] || '立绘添加成功',
                        enterUrl: I18N['key.projectSettings.enterUrl'] || '请输入URL',
                        fillNameDescFirst: I18N['key.projectSettings.fillNameDescFirst'] || '请先填写角色名称和描述',
                        generateSprite: I18N['key.projectSettings.generateSprite'] || 'AI生成立绘',
                        saveCharacter: I18N['key.projectSettings.saveCharacter'] || '保存角色',
                        characterSaved: I18N['key.projectSettings.characterSaved'] || '角色已保存',
                        missingAssetConfirm: I18N['key.projectSettings.missingAssetConfirm'] || '检测到',
                        missingAvatar: I18N['key.projectSettings.missingAvatar'] || '个角色缺少头像',
                        missingSprite: I18N['key.projectSettings.missingSprite'] || '个角色缺少立绘',
                        generateAllAssets: I18N['key.projectSettings.generateAllAssets'] || '是否一键生成所有缺失的素材？',
                        startGenerating: I18N['key.projectSettings.startGenerating'] || '开始生成缺失素材...',
                        pleaseWait: I18N['key.projectSettings.pleaseWait'] || '请稍候',
                        generationComplete: I18N['key.projectSettings.generationComplete'] || '素材生成完成',
                        partialFailure: I18N['key.projectSettings.partialFailure'] || '部分素材生成失败',
                        successCount: I18N['key.projectSettings.successCount'] || '成功生成 {count} 个素材',
                        successFailCount: I18N['key.projectSettings.successFailCount'] || '成功 {success} 个，失败 {error} 个',
                        completeAllAssets: I18N['key.projectSettings.completeAllAssets'] || '一键补全素材',
                        allAssetsComplete: I18N['key.projectSettings.allAssetsComplete'] || '所有角色已有素材',
                        worldTitle: I18N['key.projectSettings.worldTitle'] || '🌍 世界观设定',
                        worldName: I18N['key.projectSettings.worldName'] || '世界观名称',
                        worldNamePlaceholder: I18N['key.projectSettings.worldNamePlaceholder'] || '例如: 赛博朋克都市、中世纪魔法王国...',
                        era: I18N['key.projectSettings.era'] || '时代背景',
                        eraPlaceholder: I18N['key.projectSettings.eraPlaceholder'] || '例如: 未来、现代、中世纪...',
                        location: I18N['key.projectSettings.location'] || '地域设定',
                        locationPlaceholder: I18N['key.projectSettings.locationPlaceholder'] || '例如: 东京、魔法学院...',
                        coreRules: I18N['key.projectSettings.coreRules'] || '核心规则',
                        coreRulesPlaceholder: I18N['key.projectSettings.coreRulesPlaceholder'] || '这个世界的特殊规则或设定,如魔法体系、科技水平等...',
                        socialStructure: I18N['key.projectSettings.socialStructure'] || '社会结构',
                        socialStructurePlaceholder: I18N['key.projectSettings.socialStructurePlaceholder'] || '例如: 王权统治、贵族阶级、公会体系等...',
                        history: I18N['key.projectSettings.history'] || '历史背景',
                        historyPlaceholder: I18N['key.projectSettings.historyPlaceholder'] || '描述关键历史事件、王朝更迭等...',
                        supplement: I18N['key.projectSettings.supplement'] || '补充说明',
                        supplementPlaceholder: I18N['key.projectSettings.supplementPlaceholder'] || '补充任何你希望加入的世界观细节...',
                        saveWorld: I18N['key.projectSettings.saveWorld'] || '保存世界观',
                        worldSaved: I18N['key.projectSettings.worldSaved'] || '世界观设定已保存',
                        scenesTitle: I18N['key.projectSettings.scenesTitle'] || '🎬 场景背景',
                        addScene: I18N['key.projectSettings.addScene'] || '添加场景',
                        newScene: I18N['key.projectSettings.newScene'] || '新增场景',
                        sceneNameRequired: I18N['key.projectSettings.sceneNameRequired'] || '场景名称 *',
                        sceneNamePlaceholder: I18N['key.projectSettings.sceneNamePlaceholder'] || '例如: 学校教室、咖啡店、城堡大厅',
                        sceneDesc: I18N['key.projectSettings.sceneDesc'] || '场景描述',
                        sceneDescPlaceholder: I18N['key.projectSettings.sceneDescPlaceholder'] || '描述这个场景的特点、氛围...',
                        backgroundImage: I18N['key.projectSettings.backgroundImage'] || '背景图片',
                        enterBackgroundUrl: I18N['key.projectSettings.enterBackgroundUrl'] || '输入背景图URL',
                        backgroundAdded: I18N['key.projectSettings.backgroundAdded'] || '背景添加成功',
                        fillSceneNameFirst: I18N['key.projectSettings.fillSceneNameFirst'] || '请先填写场景名称',
                        saveScene: I18N['key.projectSettings.saveScene'] || '保存场景',
                        sceneSaved: I18N['key.projectSettings.sceneSaved'] || '场景已保存',
                        sceneDeleted: I18N['key.projectSettings.sceneDeleted'] || '场景已删除',
                        missingBackground: I18N['key.projectSettings.missingBackground'] || '缺背景图',
                        noBackground: I18N['key.projectSettings.noBackground'] || '无背景图',
                        noDescription: I18N['key.projectSettings.noDescription'] || '无描述',
                        missingBackgroundConfirm: I18N['key.projectSettings.missingBackgroundConfirm'] || '检测到 {count} 个场景缺少背景图。\n\n是否一键生成所有缺失的背景图？',
                        startGeneratingBg: I18N['key.projectSettings.startGeneratingBg'] || '开始生成背景图...',
                        bgGenerationComplete: I18N['key.projectSettings.bgGenerationComplete'] || '背景图生成完成',
                        bgPartialFailure: I18N['key.projectSettings.bgPartialFailure'] || '部分背景图生成失败',
                        bgSuccessCount: I18N['key.projectSettings.bgSuccessCount'] || '成功生成 {count} 张',
                        bgSuccessFailCount: I18N['key.projectSettings.bgSuccessFailCount'] || '成功 {success} 张，失败 {error} 张',
                        completeAllBg: I18N['key.projectSettings.completeAllBg'] || '一键补全背景图',
                        allBgComplete: I18N['key.projectSettings.allBgComplete'] || '所有场景已有背景图',
                        generatingFor: I18N['key.projectSettings.generatingFor'] || '正在为 {name} 生成背景图...',
                        bgGenerationSuccess: I18N['key.projectSettings.bgGenerationSuccess'] || '背景图生成完成',
                        edit: I18N['key.projectSettings.edit'] || '编辑',
                        deleteScene: I18N['key.projectSettings.deleteScene'] || '删除场景',
                        fillSceneName: I18N['key.projectSettings.fillSceneName'] || '请填写场景名称',
                        themeTitle: I18N['key.projectSettings.themeTitle'] || '🎨 主题风格',
                        aiRecommending: I18N['key.projectSettings.aiRecommending'] || 'AI推荐中...',
                        aiRecommend: I18N['key.projectSettings.aiRecommend'] || 'AI帮我选',
                        coreThemes: I18N['key.projectSettings.coreThemes'] || '核心主题 (可多选)',
                        storyStyles: I18N['key.projectSettings.storyStyles'] || '故事风格 (可多选)',
                        selectedThemes: I18N['key.projectSettings.selectedThemes'] || '已选择 {count} 个主题:',
                        selectedStyles: I18N['key.projectSettings.selectedStyles'] || '已选择 {count} 个风格:',
                        saveTheme: I18N['key.projectSettings.saveTheme'] || '保存主题风格',
                        themeSaved: I18N['key.projectSettings.themeSaved'] || '主题风格已保存',
                        selectThemeAndStyle: I18N['key.projectSettings.selectThemeAndStyle'] || '请至少选择一个主题和一个风格',
                    }}
                    onGenerateImage={async (characterId: string, prompt: string, refImageUrl?: string, explicitType?: 'sprite' | 'avatar' | 'background') => {
                        try {
                            // ✅ 优先使用显式传入的 type，否则根据 characterId 和 prompt 推断
                            let type: 'sprite' | 'avatar' | 'background' = explicitType || 'sprite';
                            if (!explicitType) {
                                if (characterId === 'cover') {
                                    type = 'background';
                                } else if (characterId === 'scene' || characterId.startsWith('background-')) {
                                    type = 'background';
                                } else if (prompt.includes('头像') || prompt.includes('avatar')) {
                                    type = 'avatar';
                                }
                            }
                            
                            toast.info(
                                t(i18nMap.generating),
                                t(i18nMap.generating) + `${type === 'sprite' ? t(i18nMap.characters) : type === 'avatar' ? t(i18nMap.characters) : t(i18nMap.scenes)}`
                            );
                            
                            const response = await fetch('/api/generate-image', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ 
                                    prompt,
                                    type,  // ✅ 后端根据此区分是否需要抠图（type='sprite' 时触发）
                                    refImageUrl,
                                    refStrength: refImageUrl ? 0.7 : undefined
                                }),
                            });
                            
                            const data = await response.json();
                            
                            if (!response.ok) {
                                // ✅ 显示详细的错误信息
                                const errorMessage = data.details || data.error || '图片生成失败';
                                console.error('[Dashboard] 图片生成失败:', {
                                    status: response.status,
                                    error: data.error,
                                    details: data.details,
                                    prompt,
                                    type
                                });
                                throw new Error(errorMessage);
                            }
                            
                            if (!data.imageUrl) {
                                throw new Error('未返回图片URL');
                            }
                            
                            toast.success(
                                t(i18nMap.generateSuccess),
                                `${type === 'sprite' ? t(i18nMap.characters) : type === 'avatar' ? t(i18nMap.characters) : t(i18nMap.scenes)} ✨`
                            );
                            return data.imageUrl;
                        } catch (error) {
                            console.error('[Dashboard] 图片生成失败:', error);
                            toast.error(t(i18nMap.generateFailed), error instanceof Error ? error.message : t(i18nMap.deleteRetry));
                            throw error;
                        }
                    }}
                />
            )}
        </div>
    );
}
