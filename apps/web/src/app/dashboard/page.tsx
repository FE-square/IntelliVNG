"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, Button, useToast, useConfirmDialog } from '@vng/ui';
import { Plus, Trash2, Edit, Calendar, Users, Image as ImageIcon, FileCode, ArrowLeft, Upload, Settings, Download, Play, CheckSquare, Square } from 'lucide-react';
import { getAllProjects, deleteProject, ProjectMetadata, saveProject, getProject } from '@/lib/projectStorage';
import { importProjectFromJson, openFileDialog, exportProjectAsJson } from '@/lib/projectExport';
import { I18N, t } from '@/i18n/client';
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
};

/**
 * 项目列表页 - 显示所有已保存的项目
 */
export default function DashboardPage() {
    const router = useRouter();
    const toast = useToast();
    const { confirm, DialogComponent } = useConfirmDialog();
    const [projects, setProjects] = useState<ProjectMetadata[]>([]);
    const [loading, setLoading] = useState(true);
    const [editingProject, setEditingProject] = useState<any>(null);
    const [showSettingsDialog, setShowSettingsDialog] = useState(false);
    const [selectedProjects, setSelectedProjects] = useState<Set<string>>(new Set());
    const [isSelectionMode, setIsSelectionMode] = useState(false);
    
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
            title: '批量删除项目',
            message: `确定要删除选中的 ${selectedCount} 个项目吗？此操作无法撤销。`,
            confirmText: '确认删除',
            cancelText: '取消',
            variant: 'danger',
        });
        
        if (confirmed) {
            let successCount = 0;
            for (const projectId of Array.from(selectedProjects)) {
                const success = await deleteProject(projectId);
                if (success) successCount++;
            }
            
            if (successCount > 0) {
                toast.success('删除成功', `已删除 ${successCount} 个项目`);
                setSelectedProjects(new Set());
                setIsSelectionMode(false);
                loadProjects();
            } else {
                toast.error('删除失败', '请重试');
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

    return (
        <div className="min-h-screen bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 p-8">
            <div className="max-w-7xl mx-auto">
                {/* 标题栏 */}
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <h1 className="text-4xl font-bold text-white mb-2">{t(i18nMap.title)}</h1>
                        <p className="text-white/80">{t(i18nMap.subtitle)}</p>
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
                                        取消选择
                                    </>
                                ) : (
                                    <>
                                        <CheckSquare className="w-4 h-4 mr-2" />
                                        批量管理
                                    </>
                                )}
                            </Button>
                        )}
                        <Button
                            className="bg-white/20 text-white border-white/40 hover:bg-white/30 border"
                            onClick={handleImportProject}
                        >
                            <Upload className="w-4 h-4 mr-2" />
                            {t(i18nMap.importProject)}
                        </Button>
                        <Button
                            className="bg-white/20 text-white border-white/40 hover:bg-white/30 border"
                            onClick={() => router.push('/setup')}
                        >
                            <Plus className="w-4 h-4 mr-2" />
                            {t(i18nMap.createNewProject)}
                        </Button>
                        <Button
                            variant="outline"
                            className="bg-white/20 text-white border-white/40 hover:bg-white/30"
                            onClick={() => router.push('/')}
                        >
                            <ArrowLeft className="w-4 h-4 mr-2" />
                            {t(i18nMap.backToHome)}
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
                                        取消全选
                                    </>
                                ) : (
                                    <>
                                        <CheckSquare className="w-4 h-4 mr-2" />
                                        全选
                                    </>
                                )}
                            </Button>
                            <span className="text-sm text-slate-600">
                                已选择 <span className="font-semibold text-indigo-600">{selectedProjects.size}</span> / {projects.length} 个项目
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
                            删除选中项目
                        </Button>
                    </div>
                )}

                {/* 项目列表 */}
                {loading ? (
                    <div className="text-center py-20">
                        <div className="inline-block w-12 h-12 border-4 border-white/30 border-t-white rounded-full animate-spin" />
                        <p className="text-white mt-4">{t(i18nMap.loading)}</p>
                    </div>
                ) : projects.length === 0 ? (
                    <Card className="text-center py-20">
                        <CardContent>
                            <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-slate-100 flex items-center justify-center">
                                <FileCode className="w-12 h-12 text-slate-400" />
                            </div>
                            <h2 className="text-2xl font-bold text-slate-800 mb-3">{t(i18nMap.emptyTitle)}</h2>
                            <p className="text-slate-500 mb-6">{t(i18nMap.emptyDescription)}</p>
                            <Button
                                className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700"
                                onClick={() => router.push('/setup')}
                            >
                                <Plus className="w-4 h-4 mr-2" />
                                {t(i18nMap.emptyButton)}
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
                                    <CardDescription className="line-clamp-2">
                                        {project.description || t(i18nMap.noDescription)}
                                    </CardDescription>
                                </CardHeader>

                                <CardContent>
                                    {/* 统计信息 */}
                                    <div className="grid grid-cols-3 gap-2 mb-4 text-sm">
                                        <div className="text-center p-2 bg-indigo-50 rounded">
                                            <Users className="w-4 h-4 mx-auto mb-1 text-indigo-600" />
                                            <div className="font-semibold text-indigo-700">{project.characterCount}</div>
                                            <div className="text-xs text-slate-500">{t(i18nMap.characters)}</div>
                                        </div>
                                        <div className="text-center p-2 bg-purple-50 rounded">
                                            <ImageIcon className="w-4 h-4 mx-auto mb-1 text-purple-600" />
                                            <div className="font-semibold text-purple-700">{project.sceneCount}</div>
                                            <div className="text-xs text-slate-500">{t(i18nMap.scenes)}</div>
                                        </div>
                                        <div className="text-center p-2 bg-pink-50 rounded">
                                            <FileCode className="w-4 h-4 mx-auto mb-1 text-pink-600" />
                                            <div className="font-semibold text-pink-700">{project.nodeCount}</div>
                                            <div className="text-xs text-slate-500">{t(i18nMap.storyNodes)}</div>
                                        </div>
                                    </div>

                                    {/* 时间信息 + 保存备注 */}
                                    <div className="space-y-2 mb-4">
                                        <div className="flex items-center gap-2 text-xs text-slate-500">
                                            <Calendar className="w-3 h-3" />
                                            <span>{t(i18nMap.updated)}: {formatDate(project.updatedAt)}</span>
                                            {project.autoSaved && (
                                                <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs">{t(i18nMap.autoSaved)}</span>
                                            )}
                                        </div>
                                        {project.saveNote && (
                                            <div className="text-xs text-slate-600 bg-amber-50 px-2 py-1.5 rounded border border-amber-200">
                                                <span className="font-semibold text-amber-700">{t(i18nMap.note)}:</span> {project.saveNote}
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
                                                {t(i18nMap.editScript)}
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
                                                {t(i18nMap.editSettings)}
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
                                                {t(i18nMap.export)}
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
                                                {t(i18nMap.preview)}
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
                                                {t(i18nMap.deleteBtn)}
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
                    onGenerateImage={async (characterId: string, prompt: string, refImageUrl?: string) => {
                        try {
                            toast.info('生成中', '正在生成图片,请稍候...');
                            
                            // ✅ 根据 characterId 决定 type
                            let type: 'sprite' | 'avatar' | 'background' = 'sprite';
                            if (characterId === 'cover') {
                                type = 'background';
                            } else if (characterId === 'scene' || characterId.startsWith('background-')) {
                                type = 'background';
                            } else if (prompt.includes('头像') || prompt.includes('avatar')) {
                                type = 'avatar';
                            }
                            
                            const response = await fetch('/api/generate-image', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ 
                                    prompt,
                                    type,  // ✅ 添加 type 参数
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
                            
                            toast.success('生成成功', '图片已生成 ✨');
                            return data.imageUrl;
                        } catch (error) {
                            console.error('[Dashboard] 图片生成失败:', error);
                            toast.error('生成失败', error instanceof Error ? error.message : '请重试');
                            throw error;
                        }
                    }}
                />
            )}
        </div>
    );
}
