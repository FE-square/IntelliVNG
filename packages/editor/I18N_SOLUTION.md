# Packages 组件多语言解决方案

## 问题

Packages 中的前端组件（如 `StoryNodeComponent`）无法直接使用 `useI18N` Hook，因为：
1. Packages 是独立的包，不应该依赖 apps 中的 I18n Provider
2. 组件可能被多个应用使用，每个应用可能有不同的多语言实现

## 解决方案

通过 **Props 传递 i18n 对象**的方式，将多语言文本从应用层传递到 packages 组件。

### 实现方式

1. **在组件接口中添加 i18n 参数**
   ```tsx
   interface StoryNodeData {
       storyNode: StoryNode;
       characters: Character[];
       i18n?: {
           start?: string;
           ending?: string;
           // ...
       };
   }
   ```

2. **在组件中使用 i18n，带 fallback**
   ```tsx
   const { storyNode, characters, i18n } = data;
   
   const t = {
       start: i18n?.start || '开始',
       ending: i18n?.ending || '结尾',
       // ...
   };
   ```

3. **在父组件（FlowEditor）中传递 i18n**
   ```tsx
   data: { 
       storyNode: node,
       characters: project.characters,
       i18n: {
           start: i18n?.nodeStart,
           ending: i18n?.nodeEnding,
           // ...
       },
   }
   ```

4. **在应用层（page.tsx）中提供多语言值**
   ```tsx
   <FlowEditor 
       i18n={{
           nodeStart: I18N['key.storyNode.start'] || '开始',
           nodeEnding: I18N['key.storyNode.ending'] || '结尾',
           // ...
       }}
   />
   ```

## 优点

1. ✅ **解耦**：Packages 不依赖应用层的 I18n 实现
2. ✅ **灵活**：每个应用可以提供自己的多语言文本
3. ✅ **向后兼容**：使用 fallback 值，即使不传 i18n 也能正常工作
4. ✅ **类型安全**：TypeScript 接口确保类型正确

## 适用场景

- Packages 中的组件需要多语言支持
- 组件可能被多个应用使用
- 不想在 packages 中引入应用层的依赖

## 注意事项

1. 确保在创建和更新 nodes 时都传递 i18n
2. 使用 fallback 值作为默认文本
3. 在应用层的多语言文件中添加对应的 key


