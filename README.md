# Local Filesystem MCP Server (maic-server-fs-mcp)

一个基于 [Model Context Protocol (MCP)](https://modelcontextprotocol.io/) 构建的自定义本地文件系统与命令行执行服务。此工具已被发布至 NPM，支持通过 `npx` 直接在 LLM 客户端（如 Cursor、Claude Desktop 等）中无缝运行。

---

## 🛠️ 核心工具 (Tools)

本 MCP 服务端向 LLM 提供了以下接口能力：

| 工具名称 | 作用描述 | 输入参数 |
| :--- | :--- | :--- |
| `readFile` | 读取指定本地文件内容 | `filePath` (string) |
| `writeFile` | 写入或更新本地文件（若父级目录不存在会自动创建） | `filePath` (string), `content` (string) |
| `readDirectory` | 列出目标文件夹内容（已自动忽略 `node_modules` 等庞大文件夹） | `filePath` (string, 默认 `.`) |
| `executeCommand` | 在终端中运行命令（同步执行，最长 30 秒超时） | `command` (string) |
| `dispatchTask` | 派发特定任务给下属专家（`CODER` 或 `TESTER`） | `worker` ('CODER' \| 'TESTER'), `taskInstruction` (string) |
| `humanReview` | 人工审核插桩，用于人工确认 | `message` (string) |
| `buildCodebaseIndex` | 扫描并为代码库构建本地向量索引（支持 JS/TS/JSX/TSX） | `dirPath` (string, 默认 `.`) |
| `searchCodebase` | 语义化检索整个代码库，寻找匹配的代码片段 | `query` (string), `topK` (number, 默认 `3`) |

---

## 🧠 本地代码 RAG 功能说明

为了使用 `buildCodebaseIndex` 和 `searchCodebase`（基于 `text-embedding-004` 模型），您需要在使用前配置 `GEMINI_API_KEY` 环境变量：

* **命令行启动时设置**：
  ```bash
  export GEMINI_API_KEY="your-gemini-api-key"
  npx -y --package maic-server-fs-mcp mcp-server-fs
  ```
* **Cursor 编辑器配置**：
  在 Cursor 设置 MCP 时，您也可以在 Shell 配置文件（如 `~/.zshrc` 或 `~/.bashrc`）中全局导出 `GEMINI_API_KEY`，这样 Cursor 启动的进程可以读取到该变量。
* **Claude Desktop 配置文件配置 (`claude_desktop_config.json`)**：
  ```json
  "maic-local-filesystem-mcp": {
    "command": "npx",
    "args": [
      "-y",
      "--package",
      "maic-server-fs-mcp",
      "mcp-server-fs"
    ],
    "env": {
      "GEMINI_API_KEY": "your-gemini-api-key"
    }
  }
  ```

### 工作机制：
1. **构建索引**：调用 `buildCodebaseIndex` 时，系统将扫描目录内的所有代码文件并按最长 40 行的窗口进行滑动切片，再通过 Gemini Embeddings API 向量化并保存在项目根目录的 `.rag_cache.json` 中。
2. **语义化检索**：调用 `searchCodebase` 时，系统向量化您的查询，计算其与本地缓存中所有代码片段的余弦相似度（Cosine Similarity），并返回相似度最高的 `topK` 个真实代码片段。

---

## 🔌 接入与集成当前 MCP 服务

您可以通过 **NPM 方式直接运行（推荐）**，或者使用**本地克隆源码开发模式**。

### 方式 1: 通过 NPM 接入（最简便，推荐）

#### A. 接入 Cursor 编辑器
1. 打开 Cursor 设置：进入 **Settings** ➡️ **Features** ➡️ **MCP**。
2. 点击 **+ Add New MCP Server**：
   - **Name**: `maic-local-filesystem-mcp`
   - **Type**: `command`
   - **Command**:
     ```bash
     npx -y --package maic-server-fs-mcp mcp-server-fs
     ```
3. 点击 **Save**。等待状态指示灯亮起绿色 🟢。

#### B. 接入 Claude Desktop
1. 打开并编辑 Claude Desktop 的配置文件：
   - **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
   - **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`
2. 在 `mcpServers` 节点内，追加如下配置：
   ```json
   {
     "mcpServers": {
       "maic-local-filesystem-mcp": {
         "command": "npx",
         "args": [
           "-y",
           "--package",
           "maic-server-fs-mcp",
           "mcp-server-fs"
         ]
       }
     }
   }
   ```
3. 保存文件并重启 Claude Desktop。

---

### 方式 2: 使用本地克隆源码运行（适合贡献者/二次开发）

#### 1. 安装与构建
```bash
git clone https://github.com/maicFir/server-fs-mcp.git
cd server-fs-mcp
npm install
npm run build # 编译生成 dist/server.js
```

#### 2. 在客户端中配置本地路径
* **Cursor (Command)**:
  ```bash
  node /absolute/path/to/server-fs-mcp/dist/server.js
  ```
* **Claude Desktop (`claude_desktop_config.json`)**:
  ```json
  "maic-local-filesystem-mcp": {
    "command": "node",
    "args": [
      "/absolute/path/to/server-fs-mcp/dist/server.js"
    ]
  }
  ```

---

## ⚠️ 开发者必看避坑指南 (Gotchas)

- **标准输出占用**：MCP 的 stdio 传输机制完全独占了标准输出流 (`stdout`) 用于 JSON-RPC 通信。因此在开发调试时，**绝对不能**在工具执行或初始化逻辑中使用 `console.log()` 或 `process.stdout.write()`。
- **调试日志**：所有打印日志、调试信息请全部使用 `console.error()` 输出，客户端会自动捕获并展示在控制台或日志文件中。
