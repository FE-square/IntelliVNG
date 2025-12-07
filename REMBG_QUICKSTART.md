# rembg背景去除服务 - 快速开始

## ✅ 已完成的集成

1. **Python去背景脚本**：`apps/intelli-services/scripts/remove_bg.py`
2. **TypeScript服务包装**：`apps/intelli-services/src/services/background-remover.ts`
3. **自动集成到图片生成**：`apps/intelli-services/src/services/image-generator.ts`

## 🚀 快速安装

```bash
# 安装Python依赖
cd apps/intelli-services/scripts
pip3 install -r requirements.txt
```

**首次运行会自动下载AI模型（约170MB），请耐心等待。**

## 🧪 测试安装

### 方法1：直接测试Python脚本

```bash
cd apps/intelli-services/scripts
echo '{"url": "https://via.placeholder.com/300"}' | python3 remove_bg.py
```

成功输出：`{"success": true, "data": "...base64..."}`

### 方法2：测试完整流程

1. 启动服务：
```bash
cd /Users/marui/Desktop/IntelliVNG
pnpm dev
```

2. 生成一张角色立绘（通过前端界面）
3. 检查后端日志，查找：
   - `[BackgroundRemover] Processing: ...`
   - `[BackgroundRemover] Background removed successfully`

## 📊 工作流程

```
通义万相生成图片
    ↓
检测到类型为'sprite'
    ↓
调用rembg去除背景
    ↓
返回透明PNG（data URL）
    ↓
保存到项目
```

## ⚠️ 降级策略

如果rembg未安装或处理失败：
- ✅ 自动返回原始图片
- ✅ CSS `mix-blend-mode: darken` 作为备用方案
- ✅ 不影响正常使用

## 🎯 效果对比

### 未安装rembg
- 立绘有白色背景
- 依赖CSS去背景（效果有限）

### 已安装rembg
- 立绘完全透明背景
- PNG格式，支持任意背景色

## 📝 注意事项

1. **只处理立绘**：头像(avatar)和背景(background)不会去背景
2. **性能影响**：每张立绘增加约0.5-2秒处理时间
3. **内存需求**：首次加载模型需要约500MB内存
4. **网络要求**：首次安装需要下载模型文件

## 🔧 故障排除

查看详细文档：`apps/intelli-services/scripts/INSTALL.md`

---

**当前状态**：✅ 代码已集成，等待安装Python依赖后生效
