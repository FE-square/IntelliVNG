# 背景去除服务安装指南

## 功能说明

本服务使用 rembg 开源AI模型自动去除生成的角色立绘的背景，输出透明PNG图片。

## 安装步骤

### 1. 安装Python依赖

```bash
cd apps/intelli-services/scripts
pip3 install -r requirements.txt
```

**首次安装说明**：
- rembg会下载AI模型文件（约170MB），首次运行时自动下载
- 模型会缓存到 `~/.u2net/` 目录
- 如果下载失败，请检查网络连接或使用代理

### 2. 验证安装

运行测试命令：

```bash
cd apps/intelli-services/scripts
echo '{"url": "https://via.placeholder.com/300"}' | python3 remove_bg.py
```

如果输出包含 `"success": true`，说明安装成功。

### 3. GPU加速（可选）

如果有NVIDIA GPU，可以安装GPU版本以提升性能：

```bash
pip3 install onnxruntime-gpu
```

**系统要求**：
- NVIDIA GPU（CUDA 11.x或12.x）
- CUDA Toolkit
- cuDNN

## 使用说明

服务已自动集成到图片生成流程中：

1. **自动处理**：生成角色立绘时自动去除背景
2. **降级策略**：如果rembg未安装，自动使用原始图片（CSS去背景）
3. **性能**：首次加载模型约1-2秒，后续处理每张图约0.5秒

## 故障排除

### 问题1：ImportError: No module named 'rembg'

**解决方案**：
```bash
pip3 install rembg
```

### 问题2：下载模型超时

**解决方案**：
手动下载模型文件：
1. 下载 u2net.onnx：https://github.com/danielgatis/rembg/releases/download/v0.0.0/u2net.onnx
2. 放置到 `~/.u2net/` 目录

### 问题3：内存不足

**解决方案**：
- 确保系统至少有4GB可用内存
- 或使用更小的模型（修改代码使用 u2netp 模型）

## 禁用背景去除

如果不需要此功能，无需任何操作。服务会自动检测rembg是否可用，未安装时自动使用CSS去背景方案。
