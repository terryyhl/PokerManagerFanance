# CLAUDE.md — Project Memory

## Language / 语言规则

- **必须始终使用中文回复用户**，包括解释、提问、确认、总结等一切沟通
- 代码中的注释、变量名可以用英文，但所有面向用户的对话必须是中文
- Git commit message 使用中文
- UI 文本使用中文

## Tech Stack

- **Frontend**: React 18 + TypeScript + Vite (port 3000) + Tailwind CSS v4
- **Backend**: Express + TypeScript (port 3001, local dev via `npx tsx server/index.ts`)
- **Database**: Supabase (PostgreSQL + Realtime Broadcast)
- **Deployment**: Vercel (serverless) + Supabase
- **Dev**: `npm run dev` (Vite), `npx tsx server/index.ts` (backend)

## Key Commands

- `npx tsc --noEmit` — 每次提交前必须执行，确保无 TypeScript 错误
- `npm run build` — 生产构建验证
- Git remote: `https://github.com/terryyhl/PokerManagerFanance.git` branch `main`
- Vercel webhook 已坏，push 后需手动去 Vercel Dashboard 点 Redeploy

## Project: PokerFinanceManager

- 实时多人德州扑克俱乐部财务管理 Web App
- 当前核心功能：**十三水 (13水) 房间** — 线下辅助积分工具
- 玩家线下打牌，手动在 App 中输入手牌，系统自动比牌计分结算
- 货币符号用 `$`（不是 ¥）

## 13水规则要点

- 2~4 人，58 张牌（52 标准 + 6 鬼牌）
- 每人选 13 张牌，排成：头道(3张) / 中道(5张) / 尾道(5张)
- 必须满足：尾道 >= 中道 >= 头道，否则乌龙（0分）
- 公共牌：房主选 0~6 张，含鬼牌则触发翻倍（2^n）
- 鬼牌 = 大小王：JK1,JK2,JK3 大王(黑), JK4,JK5,JK6 小王(红)
- 打枪（赢对手3道）= 该对手分数翻倍
- 全垒打（打枪所有对手）= 所有分数再翻倍
- 结算顺序：普通道分 -> 打枪 -> 全垒打 -> 鬼牌翻倍 -> 底分
- 纯积分制，无买入/筹码概念

## Card Assets

- CDN: `https://cdn.jsdelivr.net/gh/hayeah/playing-cards-assets@master/svg-cards/{name}.svg`
- 标准牌: `{rank}_of_{suit}.svg`, 鬼牌: `black_joker.svg`, `red_joker.svg`
- 牌背: `https://deckofcardsapi.com/static/img/back.png`

## Layout Rules

- 2人桌：公共牌在中间区域，元素较大
- 3-4人桌：公共牌在顶部栏，元素紧凑
- SVG 牌面比例 ~2:3 (169:244)

## Key Files

- `src/pages/ThirteenWaterRoom.tsx` — 13水房间主页面（~1700行）
- `server/lib/thirteen/deck.ts` — 牌组定义、解析、鬼牌翻倍计算
- `server/lib/thirteen/hands.ts` — 牌型评估引擎
- `server/lib/thirteen/scoring.ts` — 结算引擎（对比、打枪、全垒打、鬼牌翻倍、零和）
- `server/routes/thirteen.ts` — 9个API端点
- `src/index.css` — Tailwind v4 主题（`@theme` 指令）
- `src/App.tsx` — 三层 Keep-Alive 架构

## Completed Features

- 13水基础架构 + DB schema + 后端逻辑
- 卡牌选择器 + 道次管理 + 公共牌排除 + 自动切道
- 公共牌系统（房主选 0~6 张，自动鬼牌计数/翻倍）
- 提交手牌 + 自动结算 + 逐道比牌动画
- 打枪/全垒打翻倍逻辑（已验证）
- 2人/3-4人自适应布局

## Not Yet Done

- 自动理牌建议（开关已有，逻辑未实现）
- 历史牌局回放
- 2人桌布局改动已完成但未提交（当前 uncommitted change）
