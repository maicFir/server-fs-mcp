#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { toolMap } from "./mcp-tool/index.js"
import {
  readFileDeclaration,
  writeFileDeclaration,
  readDirectoryDeclaration,
  execCommandDeclaration,
  dispatchTaskDeclaration,
  searchCodebaseDeclaration,
  buildCodebaseIndexDeclaration
} from "./mcp-declaration/index.js"

// 1. 初始化 MCP 服务端实例，声明你的服务名称和版本
const server = new Server(
  {
    name: "maic-local-filesystem-mcp",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {}, // 声明这个 Server 具备提供“工具(Tools)”的能力
    },
  },
);

// 2. 注册工具列表：当 Client (比如你的 CLI) 发送 tools/list 请求时，告知对方你有什么工具
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      readFileDeclaration,
      writeFileDeclaration,
      readDirectoryDeclaration,
      execCommandDeclaration,
      dispatchTaskDeclaration,
      searchCodebaseDeclaration,
      buildCodebaseIndexDeclaration
    ],
  };
});



// 3. 注册工具执行核心：当 AI 真正要调用工具时，执行你原本的 Node.js 物理逻辑
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  if (toolMap.has(name)) {
    const fn = toolMap.get(name);
    return fn?.(args);
  } else {
    throw new Error(`未知工具: ${name}`);
  }
});

// 4. 启动服务端：绑定到当前的 Stdio (标准输入输出通道)
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("🚀 独立 MCP 进程已通过 Stdio 通道成功挂载！");
  // ⚠️ 避坑提醒：MCP Server 内部的所有普通日志必须用 console.error 打印，因为 stdout 被 JSON-RPC 进程通信独占了！
}

main().catch((error) => {
  console.error("MCP Server 崩溃:", error);
  process.exit(1);
});
