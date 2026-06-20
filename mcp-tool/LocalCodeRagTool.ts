// RAG 检索增强生成

import * as fs from "fs";
import * as path from "path";
import { GoogleGenAI } from "@google/genai";

// 简单实现一个余弦相似度计算
function cosineSimilarity(vecA: number[], vecB: number[]): number {
    const dotProduct = vecA.reduce((sum, a, i) => sum + a * (vecB[i] ?? 0), 0);
    const normA = Math.sqrt(vecA.reduce((sum, a) => sum + a * a, 0));
    const normB = Math.sqrt(vecB.reduce((sum, b) => sum + b * b, 0));
    if (normA === 0 || normB === 0) return 0;
    return dotProduct / (normA * normB);
}

interface CodeChunk {
    filePath: string;
    content: string;
    embedding: number[];
}

export class LocalCodeRagService {
    private ai: GoogleGenAI;
    private vectorStore: CodeChunk[] = [];
    private cachePath = path.resolve(process.cwd(), ".rag_cache.json");

    constructor(ai: GoogleGenAI) {
        this.ai = ai;
        this.loadIndex();
    }

    // 1. 简单的代码切块逻辑（按行数或者固定字符数切块，保持上下文）
    private chunkCode(filePath: string, content: string): string[] {
        const lines = content.split("\n");
        const chunks: string[] = [];
        const chunkSize = 40; // 每个代码块最多40行
        const overlap = 10;   // 允许10行重叠

        for (let i = 0; i < lines.length; i += (chunkSize - overlap)) {
            const chunkLines = lines.slice(i, i + chunkSize);
            if (chunkLines.length > 5) { // 过滤掉太短的碎片
                chunks.push(`// File: ${filePath}\n` + chunkLines.join("\n"));
            }
            if (i + chunkSize >= lines.length) break;
        }
        return chunks;
    }

    // 2. 扫描并构建整个 codebase 的向量索引
    public async buildIndex(dirPath: string) {
        console.error(`\n🔍 [RAG Indexing] 开始扫描目录并构建代码向量库: ${dirPath}...`);
        const filesToScan: string[] = [];

        const scanDir = (dir: string) => {
            try {
                const list = fs.readdirSync(dir);
                list.forEach((file) => {
                    try {
                        const fullPath = path.join(dir, file);
                        const stat = fs.statSync(fullPath);
                        if (stat.isDirectory()) {
                            if (!file.startsWith(".") && 
                                file !== "node_modules" && 
                                file !== "dist" && 
                                file !== "build" && 
                                file !== "out" && 
                                file !== "coverage"
                            ) {
                                scanDir(fullPath);
                            }
                        } else if (/\.(js|ts|tsx|jsx)$/.test(file)) {
                            filesToScan.push(fullPath);
                        }
                    } catch (e) {
                        console.error(`⚠️ [RAG Indexing] 读取文件或目录属性失败: ${file}, 错误: ${e instanceof Error ? e.message : e}`);
                    }
                });
            } catch (e) {
                console.error(`⚠️ [RAG Indexing] 读取目录失败: ${dir}, 错误: ${e instanceof Error ? e.message : e}`);
            }
        };

        scanDir(dirPath);
        const newStore: CodeChunk[] = [];

        for (const filePath of filesToScan) {
            try {
                const content = fs.readFileSync(filePath, "utf-8");
                const chunks = this.chunkCode(path.relative(process.cwd(), filePath), content);

                for (const chunk of chunks) {
                    try {
                        // 调用 Gemini 官方推荐的 Embedding 模型
                        const response = await this.ai.models.embedContent({
                            model: "text-embedding-004",
                            contents: chunk,
                        });

                        const embedding = response.embeddings?.[0]?.values;
                        if (embedding) {
                            newStore.push({ filePath, content: chunk, embedding });
                        }
                    } catch (chunkError: any) {
                        console.error(`⚠️ [RAG Indexing] 向量化代码块失败 (文件: ${filePath}):`, chunkError.message || chunkError);
                    }
                }
            } catch (fileError: any) {
                console.error(`⚠️ [RAG Indexing] 读取文件内容失败 ${filePath}:`, fileError.message || fileError);
            }
        }

        this.vectorStore = newStore;
        fs.writeFileSync(this.cachePath, JSON.stringify(this.vectorStore, null, 2), "utf-8");
        console.error(`✨ [RAG Indexing] 向量库构建完毕！共切分并向量化 ${this.vectorStore.length} 个代码块。`);
        return {
            content: [
                {
                    type: "text",
                    text: `✅ 向量库构建完毕！共扫描并向量化 ${this.vectorStore.length} 个代码块。缓存已保存至: ${this.cachePath}`
                }
            ]
        };
    }

    private loadIndex() {
        try {
            if (fs.existsSync(this.cachePath)) {
                this.vectorStore = JSON.parse(fs.readFileSync(this.cachePath, "utf-8"));
                console.error(`📊 [RAG] 成功从本地缓存加载了 ${this.vectorStore.length} 条代码向量。`);
            }
        } catch (error: any) {
            console.error(`⚠️ [RAG] 加载本地缓存向量索引失败，初始化为空向量库:`, error.message || error);
            this.vectorStore = [];
        }
    }

    // 3. 向量检索核心
    public async search({ query, topK = 3 }: { query: string, topK?: number | undefined }): Promise<{ content: Array<{ type: string, text: string }> }> {
        if (this.vectorStore.length === 0) {
            return {
                content: [
                    { type: "text", text: "⚠️ 警告：本地 RAG 向量库为空，请先运行 buildCodebaseIndex 工具构建索引。" }
                ]
            };
        }

        // 将用户的提问向量化
        let queryEmbedding: number[] | undefined;
        try {
            const response = await this.ai.models.embedContent({
                model: "text-embedding-004",
                contents: query,
            });
            queryEmbedding = response.embeddings?.[0]?.values;
        } catch (error: any) {
            return {
                content: [
                    { type: "text", text: `❌ 错误：生成查询向量失败。原因: ${error.message}` }
                ]
            };
        }

        if (!queryEmbedding) {
            return {
                content: [
                    { type: "text", text: "❌ 错误：未能获取到有效的查询向量。" }
                ]
            };
        }

        // 计算相似度并排序
        const results = this.vectorStore
            .map((chunk) => ({
                content: chunk.content,
                similarity: cosineSimilarity(queryEmbedding!, chunk.embedding),
            }))
            .sort((a, b) => b.similarity - a.similarity)
            .slice(0, topK);

        return {
            content: [
                {
                    type: "text",
                    text: results.map((r) => `[相似度: ${r.similarity.toFixed(4)}]\n${r.content}`).join("\n\n---\n\n"),
                }
            ]
        };
    }
}

let serviceInstance: LocalCodeRagService | null = null;

function getRagService(): LocalCodeRagService {
    if (!serviceInstance) {
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            throw new Error("未检测到环境变量 GEMINI_API_KEY，无法使用 RAG 搜索/索引功能。请在启动前设置此环境变量。");
        }
        const ai = new GoogleGenAI({ apiKey });
        serviceInstance = new LocalCodeRagService(ai);
    }
    return serviceInstance;
}

export const searchCodebaseTool = async ({ query, topK }: { query: string; topK?: number }) => {
    try {
        const service = getRagService();
        return await service.search({ query, ...(topK !== undefined ? { topK } : {}) });
    } catch (error: any) {
        return {
            content: [
                { type: "text", text: `❌ 搜索代码库出错: ${error.message}` }
            ],
            isError: true
        };
    }
};

export const buildCodebaseIndexTool = async ({ dirPath = "." }: { dirPath?: string }) => {
    try {
        const service = getRagService();
        const resolvedPath = path.resolve(process.cwd(), dirPath);
        return await service.buildIndex(resolvedPath);
    } catch (error: any) {
        return {
            content: [
                { type: "text", text: `❌ 构建向量库出错: ${error.message}` }
            ],
            isError: true
        };
    }
};