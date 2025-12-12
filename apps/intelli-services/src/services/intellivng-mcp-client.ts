/**
 * IntelliVNG MCP Client (stdio)
 *
 * 目的：
 * - 在 intelli-services 内部以“工具”的方式调用 packages/mcp-server 提供的 MCP 工具
 * - 复用连接，统一 JSON 解包与错误处理
 *
 * 说明：
 * - 默认通过 stdio 启动本仓库内的 `packages/mcp-server/dist/index.js`
 * - 也可以通过环境变量覆盖启动命令
 */
import { z } from "zod";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

// MCP SDK：server 侧使用 @modelcontextprotocol/sdk/server/*，client 侧对应 client/*
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

type JsonEnvelope<T = unknown> =
  | { ok: true; data: T }
  | { ok: false; error: string };

const McpCallToolResultSchema = z.object({
  content: z.array(
    z.object({
      type: z.literal("text"),
      text: z.string(),
    })
  ),
  isError: z.boolean().optional(),
});

function getDefaultServerCommand(): { command: string; args: string[] } {
  // 允许通过 env 覆盖
  const envCommand = process.env.INTELLIVNG_MCP_COMMAND;
  const envArgs = process.env.INTELLIVNG_MCP_ARGS;
  if (envCommand) {
    return {
      command: envCommand,
      args: envArgs ? envArgs.split(" ").filter(Boolean) : [],
    };
  }

  // 默认：monorepo 内相对路径启动 dist 版本；若 dist 不存在，则尝试用 tsx 直接跑源码
  const distPath = fileURLToPath(
    new URL("../../../../packages/mcp-server/dist/index.js", import.meta.url)
  );
  if (existsSync(distPath)) {
    return { command: "node", args: [distPath] };
  }

  const srcPath = fileURLToPath(
    new URL("../../../../packages/mcp-server/src/index.ts", import.meta.url)
  );
  return { command: "npx", args: ["tsx", srcPath] };
}

let clientPromise: Promise<Client> | null = null;

async function getClient(): Promise<Client> {
  if (clientPromise) return clientPromise;

  clientPromise = (async () => {
    const { command, args } = getDefaultServerCommand();
    const transport = new StdioClientTransport({ command, args });

    const client = new Client(
      { name: "intelli-services", version: "0.0.0" },
      { capabilities: {} }
    );

    await client.connect(transport);
    return client;
  })().catch((err) => {
    // 失败时允许下次重试
    clientPromise = null;
    throw err;
  });

  return clientPromise;
}

function parseMcpEnvelope(text: string): JsonEnvelope {
  try {
    return JSON.parse(text) as JsonEnvelope;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: `MCP 返回非 JSON 文本：${msg}; raw=${text.slice(0, 2000)}` };
  }
}

export async function callIntelliVngMcpTool<T = unknown>(
  toolName: string,
  args: Record<string, unknown>
): Promise<T> {
  const client = await getClient();

  // MCP 标准 methods：tools/call
  const result = await client.request(
    {
      method: "tools/call",
      params: { name: toolName, arguments: args },
    },
    McpCallToolResultSchema
  );

  const text = result.content?.[0]?.text ?? "";
  const envelope = parseMcpEnvelope(text);
  if (!envelope.ok) {
    throw new Error(envelope.error || `MCP tool ${toolName} failed`);
  }
  return envelope.data as T;
}

