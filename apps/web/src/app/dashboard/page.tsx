"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, Button, useToast, useConfirmDialog } from '@vng/ui';
import { Plus, Trash2, Edit, Calendar, Users, Image as ImageIcon, FileCode, ArrowLeft } from 'lucide-react';
import { getAllProjects, deleteProject, ProjectMetadata } from '@/lib/projectStorage';
import { I18N, t } from '@/i18n/client';

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
    
    useEffect(() => {
        loadProjects();
    }, []);
    
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

                                    {/* 操作按钮 */}
                                    <div className="flex gap-2">
                                        <Button
                                            className="flex-1 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700"
                                            onClick={() => router.push(`/editor?projectId=${project.id}`)}
                                        >
                                            <Edit className="w-4 h-4 mr-1" />
                                            {I18N[i18nMap.edit] || '编辑'}
                                        </Button>
                                        <Button
                                            variant="outline"
                                            className="border-red-200 text-red-600 hover:bg-red-50"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleDelete(project.id, project.title);
                                            }}
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                )}
            </div>
            {DialogComponent}
        </div>
    );
}
