import { toolsName } from "../const/index.js"
export const readFileDeclaration = {
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
}
export const writeFileDeclaration = {
    name: toolsName.writeFile,
    description: "向指定路径写入或覆盖文件内容，常用于生成/修改代码,允许 AI 修改文件代码或文本。",
    inputSchema: {
        type: "object",
        properties: {
            filePath: { type: "STRING", description: "目标文件路径,相对或绝对路径，例如 'package.json' 或 'src/index.js'" },
            content: { type: "STRING", description: "要写入文件的内容" },
        },
        required: ["filePath", "content"],
    },
}

export const readDirectoryDeclaration = {
    name: toolsName.readDirectory,
    description:
        "列出指定目录下的所有文件和文件夹名称（已自动忽略 node_modules 等大文件夹）。当你不确定项目结构、找不到某个文件在哪里时，必须先调用此工具,辅助 AI 了解项目结构。",
    inputSchema: {
        type: "object",
        properties: {
            filePath: {
                type: "STRING",
                description: "要扫描的目录路径,支持相对路径，绝对路径，（默认当前项目根）",
                default: ".",
            },
        },
        required: ["filePath"],
    },
}

export const execCommandDeclaration = {
    name: toolsName.executeCommand,
    description:
        "在本地终端安全运行 shell 命令（如 npm test, git status, npm run build）。当修改代码后需要验证是否报错，或者需要安装依赖、运行构建时使用此工具。",
    inputSchema: {
        type: "object",
        properties: {
            command: { type: "STRING", description: "要执行的 Shell 命令" },
            timeoutMs: { type: "STRING", description: "命令超时时间（毫秒）", default: 60000 },
        },
        required: ["command"],
    },
}

export const dispatchTaskDeclaration = {
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
        required: ["worker", "taskInstruction"],
    },
}

// 定义 searchCodebase 的工具格式
export const searchCodebaseDeclaration = {
    name: toolsName.searchCodebase,
    description: "语义化检索整个本地代码库。当不知道某段功能、组件、路由在哪里时，调用此工具通过关键词或功能描述找出最相关的真实代码片段。",
    inputSchema: {
        type: "object",
        properties: {
            query: { type: "string", description: "搜索词或代码功能描述，例如 'JWT 鉴权拦截器' 或 'Button 组件'" },
            topK: { type: "integer", description: "返回的最相关的代码片段数量，默认为 3", default: 3 }
        },
        required: ["query"]
    }
};

// 定义 buildCodebaseIndex 的工具格式
export const buildCodebaseIndexDeclaration = {
    name: toolsName.buildCodebaseIndex,
    description: "扫描整个本地代码库（js/ts/jsx/tsx文件），调用 Gemini Embedding API 构建/重构本地向量索引。当项目代码发生重大变化后，或者首次使用 searchCodebase 前，必须调用此工具构建索引。",
    inputSchema: {
        type: "object",
        properties: {
            dirPath: {
                type: "string",
                description: "要扫描和索引的根目录路径，支持相对路径，默认当前项目根目录 '.'",
                default: "."
            }
        },
        required: []
    }
};

