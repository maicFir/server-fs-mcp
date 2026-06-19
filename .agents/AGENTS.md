# Agent Context & Memory (AGENTS.md)

Welcome! This file serves as the persistent local memory and instructions for AI agents working on this project. It outlines the architecture, tech stack, codebase structure, tools, and developer guidelines.

---

## 📌 Project Overview & Tech Stack

This project is a **Custom Model Context Protocol (MCP) Server** designed to provide local filesystem and terminal command execution capabilities to LLM clients (such as Cursor, Claude Desktop, Antigravity, etc.).

- **Project Name:** `maic-server-fs-mcp` (or `maic-local-filesystem-mcp`)
- **Primary Tech Stack:** Node.js (v18+ recommended) + TypeScript
- **NPM Package:** `maic-server-fs-mcp` (published on npm registry)
- **Key Dependencies:**
  - `@modelcontextprotocol/sdk` (v1.29.0+): Core SDK for MCP server initialization and protocol communication.
  - `tsx`: TypeScript execute engine for dev/test execution.
  - `typescript` (v6.0.3+): Compiler for building TypeScript code to JavaScript.

---

## 📁 Directory & File Structure

Here is a quick overview of the key files in the repository:

- 📄 [package.json](file:///Users/maic/wmc/lessonNote/agent/maic-local-mcp-tool/package.json) - Defines project metadata, dependencies, and build scripts.
- 📄 [tsconfig.json](file:///Users/maic/wmc/lessonNote/agent/maic-local-mcp-tool/tsconfig.json) - Stricter compiler configurations for TypeScript (ESNext target, strict typing, verbatim module syntax).
- 📄 [server.ts](file:///Users/maic/wmc/lessonNote/agent/maic-local-mcp-tool/server.ts) - Main server entry point. Registers tools and handles tool execution calls over the `Stdio` transport.
- 📄 [const.ts](file:///Users/maic/wmc/lessonNote/agent/maic-local-mcp-tool/const.ts) - Defines constants and enum `toolsName` for registered tool IDs.
- 📁 `dist/` - Output directory for compiled JavaScript (`server.js` and types).

---

## 🛠️ MCP Tools Overview

The server implements and exposes several standard and custom tools:

| Tool Name | Input Parameters | Description |
| :--- | :--- | :--- |
| `readFile` | `filePath` (string) | Reads local file contents. Safe path resolution via `path.resolve`. |
| `writeFile` | `filePath` (string), `content` (string) | Writes/updates local file content. Automatically creates parent directories if they don't exist. |
| `readDirectory` | `filePath` (string) | Lists contents of a directory (excludes `node_modules`, `.git`, `.next`, `dist`). |
| `executeCommand` | `command` (string) | Executes a terminal command in the workspace synchronously (timeout 30s) and returns stdout/stderr. |
| `dispatchTask` | `worker` ('CODER' \| 'TESTER'), `taskInstruction` (string) | Dispatches tasks to sub-agents or specialized roles. |
| `humanReview` | `message` (string) | Standard protocol hook for manual review/approvals. |

---

## ⚠️ Critical Development Guidelines & Gotchas

When developing or modifying this MCP Server, you **must** adhere to the following rules:

### 1. The Output Communication Channel (Crucial)
> [!IMPORTANT]
> **NEVER write standard logs using `console.log` or standard `process.stdout.write` inside the tool handlers or server lifetime.**
> The MCP Stdio transport relies entirely on `stdout` for sending JSON-RPC messages back to the host client.
> Any raw text outputted to `stdout` will corrupt the communication channel, causing the MCP server to crash or be disconnected by the client.
> **Always use `console.error()`** for logs, warnings, or debug messages. The Stdio client forwards standard error logs cleanly to the client interface.

### 2. TypeScript Target & Imports
- The project uses `"type": "module"` in `package.json`. All source imports must explicitly use relative paths with `.js` extensions for transpiled output compatibility (e.g., `import { toolsName } from "./const.js"` or from packages).
- Keep TypeScript strict check rules enabled (`strict: true` and `noUncheckedIndexedAccess: true`).

### 3. File System Safety
- Always resolve paths safely using `path.resolve(process.cwd(), targetPath)` to prevent path traversal outside of intended workspaces.
- Check existence using `fs.existsSync` before reading.
- Ensure parents exist using `fs.mkdirSync(dir, { recursive: true })` before writing.

### 4. Terminal Command Execution
- Command execution is synchronous (`execSync`). Ensure the execution is safe and bounded.
- Print safety warning messages using `console.error` when initiating terminal commands.

---

## 🚀 Running & Building

- **Build:**
  ```bash
  npm run build
  ```
  This runs the TypeScript compiler (`tsc`) and outputs compiled files into the `dist/` directory.
- **Run (Production - Local):**
  ```bash
  node dist/server.js
  ```
- **Run (Production - NPM):**
  ```bash
  npx -y --package maic-server-fs-mcp mcp-server-fs
  ```
- **Run (Development/Direct):**
  You can run the typescript code directly using `npx tsx server.ts` or set it in your client configurations.
