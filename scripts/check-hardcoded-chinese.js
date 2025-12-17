#!/usr/bin/env node

/**
 * 检查前端组件中硬编码的中文字符串
 * 用于检测未使用多语言系统而直接使用中文的地方
 */

const fs = require('fs');
const path = require('path');

// 需要检查的目录
const TARGET_DIRS = [
  path.join(__dirname, '../apps/web/src'),
  path.join(__dirname, '../packages/editor/src'),
  path.join(__dirname, '../packages/ui/src'),
  path.join(__dirname, '../packages/player/src'),
];

// 需要检查的文件扩展名
const FILE_EXTENSIONS = ['.tsx', '.ts', '.jsx', '.js'];

// 中文字符正则（包括中文标点）
const CHINESE_CHAR_REGEX = /[\u4e00-\u9fa5\u3000-\u303f\uff00-\uffef]/;

// 排除的模式（这些情况不需要检查）
const EXCLUDE_PATTERNS = [
  // 注释
  /\/\/.*[\u4e00-\u9fa5]/,
  /\/\*[\s\S]*?[\u4e00-\u9fa5][\s\S]*?\*\//,
  
  // 已经在使用 i18n 的情况
  /I18N/i,
  /getText/,
  /t\([^)]*i18nMap\.[^)]+\)/,
  /I18N\[[^\]]*i18nMap\.[^\]]+\]/,
  /getText\([^)]*i18nMap\.[^)]+\)/,
  
  // console.log 等调试信息（可选，如果需要检查可以注释掉）
  /console\.(log|warn|error|info|debug)\([^)]*[\u4e00-\u9fa5][^)]*\)/,
  
  // 文件路径、URL 等
  /['"`][^'"`]*\/[^'"`]*[\u4e00-\u9fa5][^'"`]*['"`]/,
  
  // 正则表达式
  /\/[^\/]*[\u4e00-\u9fa5][^\/]*\//,
  
  // 导入语句
  /^import\s+.*from\s+['"][^'"']*['"]/m,
  
  // 类型定义中的注释
  /:\s*\/\/.*[\u4e00-\u9fa5]/,
];

// 结果存储
const results = [];

/**
 * 检查文件是否包含硬编码的中文
 */
function checkFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');
    const issues = [];
    
    lines.forEach((line, lineNumber) => {
      // 跳过空行和纯注释行
      const trimmedLine = line.trim();
      if (!trimmedLine || trimmedLine.startsWith('//') || trimmedLine.startsWith('*')) {
        return;
      }
      
      // 检查是否包含中文字符
      if (!CHINESE_CHAR_REGEX.test(line)) {
        return;
      }
      
      // 检查是否匹配排除模式
      const shouldExclude = EXCLUDE_PATTERNS.some(pattern => pattern.test(line));
      if (shouldExclude) {
        return;
      }
      
      // 检查是否是 JSX 文本内容（单独一行，在标签之间）
      const checkJsxTextLine = () => {
        // 检查当前行是否是纯文本（不在引号内，不在 JSX 表达式内）
        if (trimmedLine && 
            !trimmedLine.match(/^['"`]/) && 
            !trimmedLine.match(/['"`]$/) &&
            !trimmedLine.match(/^\{/) &&
            !trimmedLine.match(/\}$/) &&
            !trimmedLine.match(/^import|^export|^const|^let|^var|^function|^class|^return/) &&
            CHINESE_CHAR_REGEX.test(trimmedLine)) {
          // 检查前后行是否是 JSX 标签
          const prevLine = lineNumber > 0 ? lines[lineNumber - 1].trim() : '';
          const nextLine = lineNumber < lines.length - 1 ? lines[lineNumber + 1].trim() : '';
          // 前一行应该是开始标签（如 <p ...> 或 <div ...>）
          // 后一行应该是结束标签（如 </p> 或 </div>）
          const isInJsx = (prevLine.match(/<[^/>]+>[\s]*$/) || prevLine.match(/<[^/>]+\s+[^>]*>[\s]*$/)) &&
                          (nextLine.match(/^[\s]*<\/[^>]+>/) || nextLine.match(/^[\s]*\}/));
          
          if (isInJsx && !shouldExcludeText(trimmedLine, line)) {
            issues.push({
              line: lineNumber + 1,
              column: 1,
              text: trimmedLine,
              fullLine: line.trim(),
              isInJsxAttribute: false,
              isFallback: false,
            });
            return true; // 已处理，跳过后续检查
          }
        }
        return false;
      };
      
      // 先检查 JSX 文本行
      if (checkJsxTextLine()) {
        return;
      }
      
      // 提取字符串字面量中的中文
      const stringPatterns = [
        // 单引号字符串
        /'([^']*[\u4e00-\u9fa5][^']*)'/g,
        // 双引号字符串
        /"([^"]*[\u4e00-\u9fa5][^"]*)"/g,
        // 模板字符串
        /`([^`]*[\u4e00-\u9fa5][^`]*)`/g,
        // JSX 文本内容（同一行内，匹配 >文本<）
        />([^<]*[\u4e00-\u9fa5][^<]*)</g,
      ];
      
      stringPatterns.forEach(pattern => {
        let match;
        while ((match = pattern.exec(line)) !== null) {
          const chineseText = match[1];
          
          // 再次检查是否应该排除（更精确的检查）
          if (shouldExcludeText(chineseText, line)) {
            return;
          }
          
          // 检查是否是 i18n fallback 值
          const isFallback = isI18nFallback(line);
          
          // 检查是否在 JSX 属性中（可能是合法的，如 placeholder）
          const beforeMatch = line.substring(0, match.index);
          const isInJsxAttribute = /(placeholder|title|alt|aria-label|aria-placeholder)\s*=\s*["'`]/.test(beforeMatch);
          
          issues.push({
            line: lineNumber + 1,
            column: match.index + 1,
            text: chineseText.trim(),
            fullLine: line.trim(),
            isInJsxAttribute,
            isFallback,
          });
        }
      });
    });
    
    if (issues.length > 0) {
      results.push({
        file: filePath,
        issues,
      });
    }
  } catch (error) {
    console.error(`读取文件失败: ${filePath}`, error.message);
  }
}

/**
 * 更精确的文本排除检查
 */
function shouldExcludeText(text, fullLine) {
  // 排除已经在使用 i18n 的情况（但不包括 fallback 值）
  // 如果整行都在使用 i18n（没有 fallback），则排除
  if (fullLine.match(/i18nMap\.\w+\s*\)/) || 
      fullLine.match(/I18N\[i18nMap\.\w+\]\s*[;,\s]*$/) ||
      fullLine.match(/t\(i18nMap\.\w+\)/)) {
    return true;
  }
  
  // 排除正常的变量 fallback 值（如 {var || '中文'}，但不是 i18n 的）
  // 匹配模式：{ 变量名 || '中文' } 或 变量名 || '中文'
  // 但不匹配 i18n.xxx || '中文' 这种（这些应该被标记为需要替换）
  // 也不匹配 t(i18nMap.xxx) || '中文' 这种
  const fallbackPattern = /\{\s*[\w.]+(?:\s*\.\s*\w+)*\s*\|\|\s*['"`][^'"`]*[\u4e00-\u9fa5]/;
  if (fallbackPattern.test(fullLine)) {
    // 如果是 i18n 相关的，不应该排除（需要标记）
    // 检查是否是 i18n.xxx, I18N[...], t(...), i18nMap.xxx 等
    if (!fullLine.match(/i18n|I18N|i18nMap|t\(/i)) {
      return true;
    }
  }
  
  // 排除注释
  if (fullLine.trim().startsWith('//') || fullLine.includes('/*') || fullLine.includes('*/')) {
    return true;
  }
  
  // 排除 console 语句
  if (fullLine.includes('console.')) {
    return true;
  }
  
  // 排除 import/export 语句
  if (fullLine.trim().startsWith('import ') || fullLine.trim().startsWith('export ')) {
    return true;
  }
  
  return false;
}

/**
 * 检查是否是 i18n fallback 值（已使用 i18n 但 fallback 仍为中文）
 */
function isI18nFallback(fullLine) {
  // 匹配 i18n.xxx || '中文' 或 I18N[i18nMap.xxx] || '中文' 或 t(i18nMap.xxx) || '中文'
  // 也匹配 {i18n.xxx || '中文'} 这种 JSX 中的情况
  // 匹配 i18n?.xxx || '中文' 这种可选链的情况
  // 匹配函数调用中的 fallback，如 issues.push(i18n?.xxx || '中文')
  const patterns = [
    /(i18n\.\w+|i18n\?\.\w+|I18N\[i18nMap\.\w+\]|t\(i18nMap\.\w+\))\s*\|\|\s*['"`][^'"`]*[\u4e00-\u9fa5]/,
    /\{[^}]*i18n\.\w+[^}]*\|\|[^}]*['"`][^'"`]*[\u4e00-\u9fa5][^}]*\}/,
    /\{[^}]*i18n\?\.\w+[^}]*\|\|[^}]*['"`][^'"`]*[\u4e00-\u9fa5][^}]*\}/,
    // 匹配函数调用中的 fallback，如 issues.push(i18n?.xxx || '中文')
    /\w+\.(push|replace|formatTemplate|toast\.(success|error|info|warning))\s*\([^)]*i18n\?\.\w+[^)]*\|\|[^)]*['"`][^'"`]*[\u4e00-\u9fa5]/,
    // 匹配更通用的模式：任何包含 i18n?.xxx || '中文' 的行
    /i18n\?\.\w+\s*\|\|\s*['"`][^'"`]*[\u4e00-\u9fa5]/,
  ];
  return patterns.some(pattern => pattern.test(fullLine));
}

/**
 * 递归遍历目录
 */
function walkDir(dir, fileList = []) {
  if (!fs.existsSync(dir)) {
    return fileList;
  }
  
  const files = fs.readdirSync(dir);
  
  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    // 跳过 node_modules 和 dist 目录
    if (file === 'node_modules' || file === 'dist' || file === '.next') {
      return;
    }
    
    if (stat.isDirectory()) {
      walkDir(filePath, fileList);
    } else if (FILE_EXTENSIONS.some(ext => file.endsWith(ext))) {
      fileList.push(filePath);
    }
  });
  
  return fileList;
}

/**
 * 主函数
 */
function main() {
  console.log('🔍 开始检查硬编码的中文字符串...\n');
  
  // 收集所有需要检查的文件
  const filesToCheck = [];
  TARGET_DIRS.forEach(dir => {
    const files = walkDir(dir);
    filesToCheck.push(...files);
  });
  
  console.log(`📁 找到 ${filesToCheck.length} 个文件需要检查\n`);
  
  // 检查每个文件
  filesToCheck.forEach(file => {
    checkFile(file);
  });
  
  // 输出结果
  if (results.length === 0) {
    console.log('✅ 未发现硬编码的中文字符串！\n');
    process.exit(0);
  }
  
  console.log(`\n⚠️  发现 ${results.length} 个文件包含硬编码的中文：\n`);
  console.log('='.repeat(80));
  
  results.forEach((result, index) => {
    const relativePath = path.relative(process.cwd(), result.file);
    console.log(`\n${index + 1}. ${relativePath}`);
    console.log('-'.repeat(80));
    
    result.issues.forEach(issue => {
      const location = `第 ${issue.line} 行, 第 ${issue.column} 列`;
      let marker = '⚠️ ';
      let type = '硬编码中文';
      
      if (issue.isFallback) {
        marker = '💡';
        type = 'i18n fallback 值（建议替换）';
      } else if (issue.isInJsxAttribute) {
        marker = '📍';
        type = 'JSX 属性中的中文';
      }
      
      console.log(`\n${marker} ${location} [${type}]`);
      console.log(`   文本: "${issue.text}"`);
      console.log(`   代码: ${issue.fullLine}`);
    });
  });
  
  console.log('\n' + '='.repeat(80));
  console.log(`\n📊 统计: 共发现 ${results.reduce((sum, r) => sum + r.issues.length, 0)} 处硬编码中文\n`);
  console.log('💡 建议: 将这些硬编码的中文替换为多语言 key，使用 t(i18nMap.xxx) 或 I18N[i18nMap.xxx] 的形式\n');
  
  process.exit(1);
}

// 运行主函数
main();

