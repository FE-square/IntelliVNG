#!/usr/bin/env node

/**
 * 检查后端服务中可能返回给前端的硬编码中文字符串
 * 
 * 重点关注：
 * 1. return c.json() 中的 error/message 字段
 * 2. sendEvent() 中的 message 字段
 * 3. throw new Error() 中的错误消息
 * 4. 其他可能返回给前端的响应数据
 */

const fs = require('fs');
const path = require('path');

// 要检查的目录
const BACKEND_DIR = path.join(__dirname, '../apps/intelli-services/src');

// 中文字符正则
const CHINESE_PATTERN = /[\u4e00-\u9fa5]/;

// 需要检查的文件模式
const FILE_PATTERNS = ['.ts', '.js'];

// 统计
let totalIssues = 0;
const issuesByFile = {};

/**
 * 检查是否是用户可见的消息（需要多语言）
 * 返回: { isUserVisible: boolean, category: string }
 */
function checkUserVisibleMessage(line, lineNum, lines) {
  const trimmed = line.trim();
  
  // 1. sendEvent() 中的 message - 用户可见的状态/进度消息
  if (trimmed.includes('sendEvent(')) {
    // 检查是否是进度消息、状态消息等用户可见的内容
    if (trimmed.includes('message:') || trimmed.includes("'thinking'") || trimmed.includes("'progress'")) {
      return { isUserVisible: true, category: '用户状态消息' };
    }
  }
  
  // 2. return c.json() 中的 error/message - 需要区分
  if (trimmed.includes('return c.json(') || trimmed.includes('c.json(')) {
    // 检查后续几行
    for (let i = lineNum; i < Math.min(lineNum + 15, lines.length); i++) {
      const nextLine = lines[i];
      // 检查 error 字段中的中文（用户会看到的错误消息）
      if (nextLine.includes('error:') && CHINESE_PATTERN.test(nextLine)) {
        // 如果同时有 details，error 可能是简短的用户消息
        // 如果没有 details，error 就是主要错误信息
        // 为了便于排查，我们暂时不标记 error 字段，因为通常 error 是给开发者看的
        // 但如果 error 是简短的中文消息，可能是给用户看的
        // 这里保守处理：如果 error 是简短的中文（< 50字符），可能是用户消息
        const errorMatch = nextLine.match(/error:\s*['"`]([^'"`]+)['"`]/);
        if (errorMatch && errorMatch[1].length < 50) {
          return { isUserVisible: true, category: '用户错误消息' };
        }
      }
      // details 通常是技术细节，开发者用，不标记
      if (nextLine.includes('details:')) {
        return { isUserVisible: false, category: '开发者错误详情' };
      }
      if (nextLine.includes('}') && !nextLine.includes('{')) {
        break;
      }
    }
  }
  
  // 3. throw new Error() - 通常是开发者错误信息，但需要检查是否会被捕获并返回给用户
  if (trimmed.includes('throw new Error(')) {
    // 检查是否在 try-catch 中，且 catch 块会返回给前端
    // 这里简化处理：throw 的错误通常会被捕获，如果被返回给前端则是用户可见
    // 但为了便于排查，我们标记为开发者错误
    return { isUserVisible: false, category: '开发者错误信息' };
  }
  
  return { isUserVisible: false, category: '其他' };
}

/**
 * 检查文件
 */
function checkFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');
    const relativePath = path.relative(BACKEND_DIR, filePath);
    const fileIssues = [];
    
    lines.forEach((line, index) => {
      const lineNum = index + 1;
      
      // 跳过注释和 import
      if (line.trim().startsWith('//') || 
          line.trim().startsWith('import ') ||
          line.trim().startsWith('export ') ||
          line.includes('console.log') ||
          line.includes('console.error') ||
          line.includes('console.warn')) {
        return;
      }
      
      // 检查是否包含中文
      if (CHINESE_PATTERN.test(line)) {
        // 检查是否是用户可见的消息
        const checkResult = checkUserVisibleMessage(line, index, lines);
        if (checkResult.isUserVisible) {
          // 提取中文文本
          const chineseMatches = line.match(/['"`]([^'"`]*[\u4e00-\u9fa5][^'"`]*)['"`]/g);
          if (chineseMatches) {
            chineseMatches.forEach(match => {
              const text = match.replace(/['"`]/g, '');
              if (CHINESE_PATTERN.test(text)) {
                fileIssues.push({
                  line: lineNum,
                  text: text,
                  code: line.trim(),
                  category: checkResult.category,
                });
                totalIssues++;
              }
            });
          }
        }
      }
    });
    
    if (fileIssues.length > 0) {
      issuesByFile[relativePath] = fileIssues;
    }
  } catch (error) {
    console.error(`读取文件失败: ${filePath}`, error.message);
  }
}

/**
 * 递归遍历目录
 */
function walkDir(dir) {
  const files = fs.readdirSync(dir);
  
  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory()) {
      // 跳过 node_modules 和 dist
      if (file !== 'node_modules' && file !== 'dist') {
        walkDir(filePath);
      }
    } else if (stat.isFile()) {
      // 检查文件扩展名
      const ext = path.extname(file);
      if (FILE_PATTERNS.includes(ext)) {
        checkFile(filePath);
      }
    }
  });
}

// 开始检查
console.log('🔍 检查后端服务中的硬编码中文...\n');
console.log(`检查目录: ${BACKEND_DIR}\n`);

walkDir(BACKEND_DIR);

// 输出结果
if (totalIssues === 0) {
  console.log('✅ 未发现硬编码中文！');
  process.exit(0);
}

// 按文件分组输出
Object.keys(issuesByFile).sort().forEach((filePath, index) => {
  const issues = issuesByFile[filePath];
  console.log(`${index + 1}. ${filePath}`);
  console.log('─'.repeat(80));
  console.log();
  
  issues.forEach(issue => {
    console.log(`⚠️  第 ${issue.line} 行 [${issue.category}]`);
    console.log(`   文本: "${issue.text}"`);
    console.log(`   代码: ${issue.code}`);
    console.log();
  });
});

console.log('═'.repeat(80));
console.log();
console.log(`📊 统计: 共发现 ${totalIssues} 处用户可见的硬编码中文`);
console.log();
console.log('💡 说明:');
console.log('   - 标记为"用户状态消息"和"用户错误消息"的需要多语言处理');
console.log('   - 标记为"开发者错误信息"的可以保持中文，便于排查问题');
console.log();

process.exit(1);

