# 脚本说明

## check-hardcoded-chinese.js

用于检查前端组件中硬编码的中文字符串，帮助识别未使用多语言系统的地方。

### 使用方法

```bash
# 方式1: 直接运行
node scripts/check-hardcoded-chinese.js

# 方式2: 使用 npm/pnpm 脚本
pnpm check:i18n
```

### 功能说明

脚本会扫描以下目录中的 `.tsx`, `.ts`, `.jsx`, `.js` 文件：
- `apps/web/src`
- `packages/editor/src`
- `packages/ui/src`
- `packages/player/src`

### 检测规则

脚本会检测以下情况：

1. **硬编码中文** ⚠️
   - 字符串字面量中的中文字符
   - JSX 文本内容中的中文
   - 模板字符串中的中文

2. **i18n fallback 值** 💡
   - 已使用 i18n 但 fallback 值仍为中文的情况
   - 例如：`i18n.xxx || '中文'`

3. **JSX 属性中的中文** 📍
   - placeholder、title、alt 等属性中的中文

### 排除规则

以下情况会被自动排除（不报告）：
- 注释中的中文
- 已经在使用 i18n 且没有 fallback 的情况
- console.log 等调试信息中的中文
- import/export 语句
- 文件路径、URL 等

### 输出示例

```
⚠️  发现 30 个文件包含硬编码的中文：

1. apps/web/src/app/editor/page.tsx
--------------------------------------------------------------------------------

⚠️  第 351 行, 第 31 列 [硬编码中文]
   文本: "保存成功"
   代码: toast.success('保存成功', '项目已保存到我的项目 🎉');

💡 第 102 行, 第 99 列 [i18n fallback 值（建议替换）]
   文本: "📝 基本信息"
   代码: <h3>{i18n.basicInfo || '📝 基本信息'}</h3>
```

### 修复建议

1. **硬编码中文**：替换为多语言 key
   ```tsx
   // ❌ 错误
   toast.success('保存成功', '项目已保存');
   
   // ✅ 正确
   toast.success(t(i18nMap.saveSuccess), t(i18nMap.saveSuccessDesc));
   ```

2. **i18n fallback 值**：移除 fallback 或使用英文 fallback
   ```tsx
   // ❌ 不推荐
   {i18n.title || '标题'}
   
   // ✅ 推荐
   {i18n.title || 'Title'}  // 或直接使用 {i18n.title}
   ```

3. **JSX 属性中的中文**：使用多语言 key
   ```tsx
   // ❌ 错误
   <input placeholder="请输入名称" />
   
   // ✅ 正确
   <input placeholder={t(i18nMap.namePlaceholder)} />
   ```


