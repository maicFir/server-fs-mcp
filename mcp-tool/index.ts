import * as fs from "fs";
import * as path from "path";
import { execSync } from "child_process";
import { toolsName } from "../const/index.js";

import { searchCodebaseTool, buildCodebaseIndexTool } from "./LocalCodeRagTool.js"

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
        console.error(`\n⚠️ [⚠️安全警告] Agent 正在本地终端执行命令: ${command}`);
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

export const toolMap = new Map<string, Function>([
    [toolsName.readFile, readfileTool],
    [toolsName.writeFile, writefileTool],
    [toolsName.readDirectory, readDirectoryTool],
    [toolsName.executeCommand, execCommandTool],
    [toolsName.searchCodebase, searchCodebaseTool],
    [toolsName.buildCodebaseIndex, buildCodebaseIndexTool]
])