/**
 * 测试 Qwen 深度思考模式流式输出
 * 
 * 运行方式：
 * cd apps/intelli-services
 * pnpm tsx src/tests/test-thinking-stream.ts
 */

import * as dotenv from 'dotenv';
dotenv.config();

import OpenAI from 'openai';
import { resolveLLMConfig } from '../utils/llm-config';

async function testThinkingStream() {
  const config = resolveLLMConfig('primary');
  
  console.log('======================================');
  console.log('测试 Qwen 深度思考模式流式输出');
  console.log('======================================');
  console.log(`模型: ${config.modelName}`);
  console.log(`BaseURL: ${config.baseURL}`);
  console.log('--------------------------------------\n');

  const client = new OpenAI({
    apiKey: config.apiKey,
    baseURL: config.baseURL,
  });

  const testPrompt = '请简单分析一下：一个悬疑故事应该包含哪些关键元素？';
  
  console.log(`提示词: ${testPrompt}\n`);
  console.log('--------------------------------------');
  
  try {
    // 构建请求体，包含 enable_thinking 参数
    const requestBody: any = {
      model: config.modelName,
      messages: [
        { role: 'user', content: testPrompt }
      ],
      temperature: 0.7,
      max_tokens: 2048,
      stream: true,
      stream_options: {
        include_usage: true,
      },
      // Qwen 深度思考参数
      enable_thinking: true,
    };
    
    console.log('请求参数:', JSON.stringify({ 
      model: requestBody.model, 
      enable_thinking: requestBody.enable_thinking,
      stream: requestBody.stream,
    }));
    console.log('--------------------------------------\n');
    
    const stream = await client.chat.completions.create(requestBody) as unknown as AsyncIterable<any>;
    
    let thinkingContent = '';
    let responseContent = '';
    let hasThinking = false;
    let usage: any = null;
    
    console.log('🧠 思考过程:');
    console.log('--------------------------------------');
    
    for await (const chunk of stream) {
      const delta = chunk.choices?.[0]?.delta;
      
      // 保存 usage 信息
      if (chunk.usage) {
        usage = chunk.usage;
      }
      
      // 检查 reasoning_content（思考过程）
      const reasoningDelta = delta?.reasoning_content;
      if (reasoningDelta) {
        if (!hasThinking) {
          hasThinking = true;
        }
        thinkingContent += reasoningDelta;
        process.stdout.write(reasoningDelta);
      }
      
      // 检查 content（回复内容）
      if (delta?.content) {
        if (hasThinking && thinkingContent && responseContent === '') {
          console.log('\n--------------------------------------');
          console.log('\n📝 回复内容:');
          console.log('--------------------------------------');
        }
        responseContent += delta.content;
        process.stdout.write(delta.content);
      }
    }
    
    console.log('\n--------------------------------------');
    console.log('\n📊 统计信息:');
    console.log(`- 思考内容长度: ${thinkingContent.length} 字符`);
    console.log(`- 回复内容长度: ${responseContent.length} 字符`);
    console.log(`- 是否有思考过程: ${hasThinking ? '✅ 是' : '❌ 否'}`);
    if (usage) {
      console.log(`- Token 使用: prompt=${usage.prompt_tokens}, completion=${usage.completion_tokens}, total=${usage.total_tokens}`);
    }
    console.log('--------------------------------------');
    
    if (!hasThinking) {
      console.log('\n⚠️ 警告: 没有收到思考内容 (reasoning_content)');
      console.log('可能的原因:');
      console.log('1. 当前模型不支持深度思考模式');
      console.log('2. enable_thinking 参数未正确传递');
      console.log('3. 模型版本不支持（建议使用 qwen-plus 或更高版本）');
    }
    
  } catch (error) {
    console.error('❌ 测试失败:', error);
  }
}

testThinkingStream();

