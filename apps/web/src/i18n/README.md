# 多语言支持 (i18n)

本项目已实现完整的多语言支持机制，支持通过URL参数切换语言，并在SSR时注入多语言配置。

## 支持的语言

- `zh-CN` - 简体中文（默认）
- `zh-HK` - 繁体中文（香港）
- `en-US` - 英语（美国）

## 使用方法

### 1. 切换语言

在URL中添加 `locale` 参数即可切换语言：

```
http://localhost:3000/dashboard?locale=zh-CN
http://localhost:3000/dashboard?locale=zh-HK
http://localhost:3000/dashboard?locale=en-US
```

如果没有指定 `locale` 参数，系统会根据浏览器的 `Accept-Language` header自动选择语言。

### 2. 在组件中使用多语言

#### 方式一：使用 I18N 对象（推荐用于简单场景）

```tsx
import { I18N } from '@/i18n/client';

// 定义key映射
const i18nMap = {
  title: 'key.dashboard.title.myProjects',
  subtitle: 'key.dashboard.title.manageYourProjects',
};

// 在JSX中使用
<h1>{I18N[i18nMap.title]}</h1>
<p>{I18N[i18nMap.subtitle]}</p>
```

#### 方式二：使用 t() 函数（推荐用于需要参数替换的场景）

```tsx
import { t } from '@/i18n/client';

// 带参数替换
const message = t('key.dashboard.delete.message', { title: '我的项目' });
// 结果: "确定删除项目「我的项目」吗？此操作不可恢复！"
```

### 3. 添加新的翻译文本

1. 在 `src/i18n/locales/` 目录下的对应语言文件中添加新的key-value对：

```json
// zh-CN.json
{
  "key.new.feature.title": "新功能标题"
}
```

2. 在所有语言文件中添加对应的翻译：

```json
// zh-HK.json
{
  "key.new.feature.title": "新功能標題"
}

// en-US.json
{
  "key.new.feature.title": "New Feature Title"
}
```

3. 在组件中使用：

```tsx
const i18nMap = {
  newFeatureTitle: 'key.new.feature.title',
};

<h1>{I18N[i18nMap.newFeatureTitle]}</h1>
```

## 技术实现

### 架构说明

1. **Middleware** (`src/middleware.ts`)
   - 从URL参数或浏览器header中获取locale
   - 将locale设置到请求header中供服务端使用

2. **I18nProvider** (`src/components/I18nProvider.tsx`)
   - 在SSR时加载对应语言的语言包
   - 通过script标签将I18N数据注入到 `window.__APP_INITIAL_STATE__.I18N`

3. **客户端工具** (`src/i18n/client.ts`)
   - 提供 `getI18N()` 函数获取I18N对象
   - 提供 `t()` 函数进行文本翻译和参数替换
   - 导出 `I18N` Proxy对象，支持直接访问

### 文件结构

```
src/i18n/
├── locales/
│   ├── zh-CN.json      # 简体中文
│   ├── zh-HK.json      # 繁体中文
│   └── en-US.json      # 英语
├── index.ts            # 服务端工具函数
├── client.ts           # 客户端工具函数
└── README.md           # 本文档
```

## 注意事项

1. **Key命名规范**：使用点分隔的层级结构，如 `key.dashboard.title.myProjects`
2. **参数替换**：使用 `{paramName}` 格式定义占位符，通过 `t()` 函数的第二个参数传入替换值
3. **默认值**：如果翻译key不存在，会返回key本身，建议在组件中提供fallback值：
   ```tsx
   {I18N[i18nMap.title] || '默认标题'}
   ```

