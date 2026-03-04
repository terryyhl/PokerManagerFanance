# PokerFinanceManager 项目文档

> 本文档面向 AI 助手，作为项目记忆参考。

## 项目简介

**PokerFinanceManager** — 实时多人德州扑克/十三水俱乐部财务管理 Web App。

当前核心功能为 **十三水 (13水) 房间** — 线下辅助积分工具。玩家线下打牌，手动在 App 中输入手牌，系统自动比牌计分结算。纯积分制，无买入/筹码概念。货币符号用 `$`（不是 ¥）。

## 技术栈

| 层 | 技术 |
|---|---|
| 前端 | React 18 + TypeScript + Vite (port 3000) + Tailwind CSS v4 |
| 后端 | Express + TypeScript (port 3001, 本地 `npx tsx server/index.ts`) |
| 数据库 | Supabase (PostgreSQL + Realtime Broadcast) |
| 部署 | Vercel (Serverless) + Supabase |

## 开发命令

```bash
npm run dev              # 启动前端 (Vite, port 3000)
npx tsx server/index.ts  # 启动后端 (Express, port 3001)
npx tsc --noEmit         # TypeScript 类型检查（每次提交前必须执行）
npm run build            # 生产构建验证
```

## Git 仓库

- 远程: `https://github.com/terryyhl/PokerManagerFanance.git`
- 分支: `main`

## 部署

- 平台: **Vercel**
- Vercel webhook 已坏，push 后需手动去 Vercel Dashboard 点 **Redeploy**
- Serverless 约束: 1024MB 内存，10s 超时

## 项目规模

- ~81 个源码文件
- ~18,300+ 行代码

## 文档索引

| 文件 | 说明 |
|---|---|
| [`docs/README.md`](./README.md) | 项目文档索引（本文件） |
| [`docs/architecture.md`](./architecture.md) | 技术架构文档 — 前后端架构、路由表、实时通信、Serverless 约束 |
| [`docs/database.md`](./database.md) | 数据库 schema 详解 — 全部 12 张表、索引、RLS、ER 关系 |
