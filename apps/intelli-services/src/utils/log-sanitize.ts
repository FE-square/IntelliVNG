import * as crypto from "crypto";

export type SanitizeLogOptions = {
  maxStringLength?: number;
  maxDepth?: number;
  maxArrayLength?: number;
};

const DEFAULTS: Required<SanitizeLogOptions> = {
  maxStringLength: 200,
  maxDepth: 6,
  maxArrayLength: 30,
};

function sha1(input: string): string {
  return crypto.createHash("sha1").update(input).digest("hex").slice(0, 8);
}

function shouldRedactString(value: string, maxStringLength: number): boolean {
  if (!value) return false;
  if (value.length > maxStringLength) return true;

  // 常见的 data URL（图片/音频/文件）
  if (/^data:[^;]+;base64,/i.test(value)) return true;

  return false;
}

function looksLikeBase64Blob(value: string): boolean {
  // 经验阈值：超过一定长度且字符集像 base64
  if (value.length < 256) return false;
  if (!/^[A-Za-z0-9+/=\s]+$/.test(value)) return false;
  // base64 常见 padding
  return value.includes("=") || value.includes("+") || value.includes("/");
}

export function sanitizeForLog(input: unknown, options?: SanitizeLogOptions): unknown {
  const { maxStringLength, maxDepth, maxArrayLength } = { ...DEFAULTS, ...(options || {}) };
  const seen = new WeakSet<object>();

  const walk = (value: unknown, depth: number): unknown => {
    if (value === null || value === undefined) return value;

    if (typeof value === "string") {
      if (shouldRedactString(value, maxStringLength) || looksLikeBase64Blob(value)) {
        return `<omitted string len=${value.length} sha1=${sha1(value)}>`;
      }
      return value;
    }

    if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") return value;
    if (typeof value === "function") return `<function>`;
    if (typeof value === "symbol") return `<symbol>`;

    if (value instanceof Date) return value.toISOString();
    if (value instanceof Error) return { name: value.name, message: value.message, stack: value.stack };

    if (Array.isArray(value)) {
      if (depth >= maxDepth) return `<array depth=${depth} len=${value.length}>`;
      const sliced = value.slice(0, maxArrayLength).map(v => walk(v, depth + 1));
      if (value.length > maxArrayLength) {
        sliced.push(`<omitted ${value.length - maxArrayLength} items>`);
      }
      return sliced;
    }

    if (typeof value === "object") {
      if (depth >= maxDepth) return `<object depth=${depth}>`;
      if (seen.has(value as object)) return `<circular>`;
      seen.add(value as object);

      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
        out[k] = walk(v, depth + 1);
      }
      return out;
    }

    return `<unknown>`;
  };

  return walk(input, 0);
}

export function safeStringifyForLog(input: unknown, options?: SanitizeLogOptions): string {
  return JSON.stringify(sanitizeForLog(input, options));
}


