"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, Button, useToast, useConfirmDialog } from '@vng/ui';
import { Plus, Trash2, Edit, Calendar, Users, Image as ImageIcon, FileCode, ArrowLeft, Upload, Settings, Download, Play } from 'lucide-react';
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
  deleteTitle: 'key.dashboard.delete.title',
  deleteMessage: 'key.dashboard.delete.message',
  deleteConfirm: 'key.dashboard.delete.confirm',
  deleteCancel: 'key.dashboard.delete.cancel',
  deleteSuccess: 'key.dashboard.delete.success',
  deleteError: 'key.dashboard.delete.error',
  deleteRetry: 'key.dashboard.delete.retry',
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
    
    useEffect(() => {
        loadProjects();
    }, []); // 监听URL参数变化，触发重新加载
    
    const loadProjects = async () => {
        setLoading(true);
        try {
            const allProjects = await getAllProjects();
            setProjects(allProjects);
        } catch (error) {
            console.error('Failed to load projects:', error);
        } finally {
            setLoading(false);
        }
    };
    
    const handleDelete = async (projectId: string, projectTitle: string) => {
        const confirmed = await confirm({
            title: I18N[i18nMap.deleteTitle] || '删除项目',
            message: t(i18nMap.deleteMessage, { title: projectTitle }),
            confirmText: I18N[i18nMap.deleteConfirm] || '删除',
            cancelText: I18N[i18nMap.deleteCancel] || '取消',
            variant: 'danger',
        });
        
        if (confirmed) {
            const success = await deleteProject(projectId);
            if (success) {
                toast.success(I18N[i18nMap.deleteSuccess] || '项目已删除');
                loadProjects(); // 重新加载列表
            } else {
                toast.error(
                    I18N[i18nMap.deleteError] || '删除失败',
                    I18N[i18nMap.deleteRetry] || '请重试'
                );
            }
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
                toast.success('导入成功', '项目已导入,即将跳转...');
                setTimeout(() => {
                    router.push(`/editor?projectId=${newProject.id}`);
                }, 1000);
            } else {
                toast.error('导入失败', '保存项目到后端失败');
            }
        } catch (error) {
            console.error('[Dashboard] 导入失败:', error);
            toast.error('导入失败', error instanceof Error ? error.message : '未知错误');
        }
    };
    
    // 保存项目设定
    const handleSaveSettings = async (updatedProject: any) => {
        try {
            const success = await saveProject(updatedProject);
            
            if (success) {
                toast.success('保存成功', '项目设定已更新');
                setShowSettingsDialog(false);
                setEditingProject(null);
                loadProjects(); // 重新加载项目列表
            } else {
                toast.error('保存失败', '请重试');
            }
        } catch (error) {
            console.error('[Dashboard] 保存设定失败:', error);
            toast.error('保存失败', error instanceof Error ? error.message : '未知错误');
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 p-8">
            <div className="max-w-7xl mx-auto">
                {/* 标题栏 */}
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <h1 className="text-4xl font-bold text-white mb-2">{I18N[i18nMap.title] || '📋 我的项目'}</h1>
                        <p className="text-white/80">{I18N[i18nMap.subtitle] || '管理你的所有视觉小说项目'}</p>
                    </div>
                    <div className="flex gap-3">
                        <Button
                            className="bg-white/20 text-white border-white/40 hover:bg-white/30 border"
                            onClick={handleImportProject}
                        >
                            <Upload className="w-4 h-4 mr-2" />
                            导入项目
                        </Button>
                        <Button
                            className="bg-white/20 text-white border-white/40 hover:bg-white/30 border"
                            onClick={() => router.push('/setup')}
                        >
                            <Plus className="w-4 h-4 mr-2" />
                            {I18N[i18nMap.createNewProject] || '创建新项目'}
                        </Button>
                        <Button
                            variant="outline"
                            className="bg-white/20 text-white border-white/40 hover:bg-white/30"
                            onClick={() => router.push('/')}
                        >
                            <ArrowLeft className="w-4 h-4 mr-2" />
                            {I18N[i18nMap.backToHome] || '返回首页'}
                        </Button>
                    </div>
                </div>

                {/* 项目列表 */}
                {loading ? (
                    <div className="text-center py-20">
                        <div className="inline-block w-12 h-12 border-4 border-white/30 border-t-white rounded-full animate-spin" />
                        <p className="text-white mt-4">{I18N[i18nMap.loading] || '加载中...'}</p>
                    </div>
                ) : projects.length === 0 ? (
                    <Card className="text-center py-20">
                        <CardContent>
                            <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-slate-100 flex items-center justify-center">
                                <FileCode className="w-12 h-12 text-slate-400" />
                            </div>
                            <h2 className="text-2xl font-bold text-slate-800 mb-3">{I18N[i18nMap.emptyTitle] || '还没有项目'}</h2>
                            <p className="text-slate-500 mb-6">{I18N[i18nMap.emptyDescription] || '开始创建你的第一个视觉小说吧!'}</p>
                            <Button
                                className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700"
                                onClick={() => router.push('/setup')}
                            >
                                <Plus className="w-4 h-4 mr-2" />
                                {I18N[i18nMap.emptyButton] || '创建项目'}
                            </Button>
                        </CardContent>
                    </Card>
                ) : (
                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {projects.map((project) => (
                            <Card 
                                key={project.id} 
                                className="hover:shadow-2xl transition-all cursor-pointer group overflow-hidden"
                            >
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
                                        {project.description || (I18N[i18nMap.noDescription] || '暂无描述')}
                                    </CardDescription>
                                </CardHeader>

                                <CardContent>
                                    {/* 统计信息 */}
                                    <div className="grid grid-cols-3 gap-2 mb-4 text-sm">
                                        <div className="text-center p-2 bg-indigo-50 rounded">
                                            <Users className="w-4 h-4 mx-auto mb-1 text-indigo-600" />
                                            <div className="font-semibold text-indigo-700">{project.characterCount}</div>
                                            <div className="text-xs text-slate-500">{I18N[i18nMap.characters] || '角色'}</div>
                                        </div>
                                        <div className="text-center p-2 bg-purple-50 rounded">
                                            <ImageIcon className="w-4 h-4 mx-auto mb-1 text-purple-600" />
                                            <div className="font-semibold text-purple-700">{project.sceneCount}</div>
                                            <div className="text-xs text-slate-500">{I18N[i18nMap.scenes] || '场景'}</div>
                                        </div>
                                        <div className="text-center p-2 bg-pink-50 rounded">
                                            <FileCode className="w-4 h-4 mx-auto mb-1 text-pink-600" />
                                            <div className="font-semibold text-pink-700">{project.nodeCount}</div>
                                            <div className="text-xs text-slate-500">{I18N[i18nMap.storyNodes] || '故事情节'}</div>
                                        </div>
                                    </div>

                                    {/* 时间信息 + 保存备注 */}
                                    <div className="space-y-2 mb-4">
                                        <div className="flex items-center gap-2 text-xs text-slate-500">
                                            <Calendar className="w-3 h-3" />
                                            <span>{I18N[i18nMap.updated] || '更新'}: {formatDate(project.updatedAt)}</span>
                                            {project.autoSaved && (
                                                <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs">{I18N[i18nMap.autoSaved] || '自动保存'}</span>
                                            )}
                                        </div>
                                        {project.saveNote && (
                                            <div className="text-xs text-slate-600 bg-amber-50 px-2 py-1.5 rounded border border-amber-200">
                                                <span className="font-semibold text-amber-700">{I18N[i18nMap.note] || '📝 备注'}:</span> {project.saveNote}
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
                                                编辑脚本
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
                                                        toast.error('加载项目失败');
                                                    }
                                                }}
                                            >
                                                <Settings className="w-4 h-4 mr-1" />
                                                编辑设定
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
                                                        toast.success('导出成功');
                                                    }
                                                }}
                                            >
                                                <Download className="w-3 h-3 mr-1" />
                                                导出
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
                                                预览
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
                                                删除
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
                            
                            const response = await fetch('/api/generate-image', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ 
                                    prompt,
                                    refImageUrl,
                                    refStrength: refImageUrl ? 0.7 : undefined
                                }),
                            });
                            
                            if (!response.ok) {
                                throw new Error('图片生成失败');
                            }
                            
                            const data = await response.json();
                            
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
