#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import * as fs from "fs";
import * as path from "path";
import { execSync } from "child_process";

import { toolsName } from "./const";

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
      {
        name: toolsName.readFile,
        description: "读取指定路径的本地文件内容，允许 AI 查看文件代码或文本。",
        inputSchema: {
          type: "object",
          properties: {
            filePath: {
              type: "string",
              description:
                "相对或绝对路径，例如 'package.json' 或 'src/index.js'",
            },
          },
          required: ["filePath"],
        },
      },
      {
        name: toolsName.writeFile,
        description: "写入指定路径的本地文件内容，允许 AI 修改文件代码或文本。",
        inputSchema: {
          type: "object",
          properties: {
            filePath: {
              type: "STRING",
              description:
                "相对或绝对路径，例如 'package.json' 或 'src/index.js'",
            },
            content: {
              type: "STRING",
              description: "要写入文件的内容",
            },
          },
          required: ["filePath", "content"],
        },
      },
      {
        name: toolsName.readDirectory,
        description: "列出指定目录下的所有文件和文件夹名称（已自动忽略 node_modules 等大文件夹）。当你不确定项目结构、找不到某个文件在哪里时，必须先调用此工具。",
        inputSchema: {
          type: "object",
          properties: {
            filePath: {
              type: "STRING",
              description: "要查询的目录路径，默认是当前根目录 '.'，或者例如 'src/components'",
            },
          },
          required: ['filePath']
        }
      },
      {
        name: toolsName.executeCommand,
        description: "在本地终端安全运行 shell 命令（如 npm test, git status, npm run build）。当修改代码后需要验证是否报错，或者需要安装依赖、运行构建时使用此工具。",
        inputSchema: {
          type: "object",
          properties: {
            command: {
              type: "STRING",
              description:
                "需要执行的完整命令，例如 'npm run build' 或 'node test.js'",
            },
          },
          required: ["command"],
        }
      },
      {
        name: toolsName.dispatchTask,
        description: "当需要安排下属专家执行具体工作时调用此工具。每次只能派发一个任务，等下属汇报结果后，再派发下一个。",
        inputSchema: {
          type: "object",
          properties: {
            worker: {
              type: "STRING",
              description: "接收任务的专家。'CODER' 负责读写代码文件；'TESTER' 负责运行终端编译或测试命令。",
            },
            taskInstruction: {
              type: "STRING",
              description: "具体要这个专家执行的详细指令。例如：'帮我查看 src/index.ts 的内容并修复其中的类型 Bug'。",
            },
          },
          required: ["worker", "taskInstruction"]
        }
      }
    ],
  };
});


// 定义人类审阅工具（无实际执行逻辑，仅用于触发对话）
export const humanReviewTool = {
  name: toolsName.humanReview,
  description: "需要人工审核或确认时调用。",
  parameters: {
    type: "object",
    properties: {
      message: {
        type: "string",
        description: "给人类的留言或请求确认的内容。",
      }
    },
    required: ["message"]
  }
};


export const readfileTool = ({ filePath }: { filePath: string }) => {
  try {
    const fullPath = path.resolve(process.cwd(), filePath);
    if (!fs.existsSync(fullPath)) {
      return {
        content: [
          { type: "text", text: `Error: File ${fullPath} does not exist.` },
        ],
        isError: true,
      };
    }
    const fileContent = fs.readFileSync(fullPath, "utf-8");
    return {
      content: [{ type: "text", text: fileContent }],
    };
  } catch (error: any) {
    return {
      content: [
        { type: "text", text: `Error reading file: ${error.message}` },
      ],
      isError: true,
    };
  }
};

export const writefileTool = ({
  filePath,
  content,
}: {
  filePath: string;
  content: string;
}) => {
  try {
    const fullPath = path.resolve(process.cwd(), filePath);
    // 确保目标文件的父级文件夹存在（可选，防错）
    const dir = path.dirname(fullPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(fullPath, content, "utf-8");
    return {
      content: [
        { type: 'text', text: `✅ Successfully wrote ${content.length} characters to: ${fullPath}` }
      ],
    };
  } catch (error: any) {
    return {
      content: [
        {
          type: 'text',
          text: `❌ Error writing file: ${error.message}`
        }
      ],
      isError: true,
    };
  }
};

export const readDirectoryTool = ({ dirPath = "." }: { dirPath?: string }) => {
  try {
    const fullPath = path.resolve(process.cwd(), dirPath);
    if (!fs.existsSync(fullPath)) {
      return `❌ Error: Directory ${fullPath} does not exist.`;
    }

    // 读取当前目录下的所有文件和文件夹
    const files = fs.readdirSync(fullPath, { withFileTypes: true });

    // 过滤掉不必要的庞大文件夹（如 node_modules, .git），否则数据太多会干扰 AI
    const ignoredDirs = ["node_modules", ".git", ".next", "dist"];

    const resultList = files
      .filter((file) => !ignoredDirs.includes(file.name))
      .map((file) => {
        return `${file.isDirectory() ? "📁" : "📄"} ${file.name}`;
      });

    return {
      content: [
        { type: 'text', text: `📁 Current Directory: ${dirPath}\n` + resultList.join("\n") }
      ],
    };
  } catch (error: any) {
    return {
      content: [
        {
          type: 'text',
          text: `❌ Error reading directory: ${error.message}`
        }
      ],
      isError: true,
    };
  }
};

// 修复工具函数：执行命令行指令
export const execCommandTool = ({ command }: { command: string }) => {
  try {
    console.log(`\n⚠️ [⚠️安全警告] Agent 正在本地终端执行命令: ${command}`);
    // 在当前目录下同步执行命令，并捕获标准输出
    const output = execSync(command, { encoding: "utf-8", timeout: 30000 });
    return {
      content: [
        { type: 'text', text: `ℹ️ Command Executed Successfully. Output:\n${output}` }
      ],
    };
  } catch (error: any) {
    // 如果命令报错（比如编译挂了），把报错信息完整吐给 AI，AI 会根据报错自己修 Bug！
    return {
      content: [
        {
          type: 'text',
          text: `❌ Command Failed with Error:\n${error.stdout || error.message}`
        }
      ],
      isError: true,
    };
  }
};

const toolMap = new Map<string, Function>([
  [toolsName.readFile, readfileTool],
  [toolsName.writeFile, writefileTool],
  [toolsName.readDirectory, readDirectoryTool],
  [toolsName.executeCommand, execCommandTool],
])


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
