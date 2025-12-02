/**
 * Services 模块导出
 */

// 旧版 GameGenerator（单一 prompt 模式）
export { GameGenerator } from "./game-generator";

// 新版 GameGeneratorAgent（多智能体模式）
export { GameGeneratorAgent, gameGeneratorAgent } from "./game-generator-agent";

// 进度发射器（用于 SSE 实时进度推送）
export * from "./progress-emitter";

// 其他服务
export { FormAutocomplete } from "./form-autocomplete";
export { ImageGenerator } from "./image-generator";
export * from "./cache";

