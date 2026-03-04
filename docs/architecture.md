# 技术架构文档

> 本文档面向 AI 助手，作为项目架构参考。

---

## 前端架构

### 三层 Keep-Alive 路由

前端采用 **三层 Keep-Alive 架构**（见 `src/App.tsx`），避免页面切换时丢失状态：

| 层 | 名称 | 挂载策略 | 说明 |
|---|---|---|---|
| Layer 0 (最底层) | **MainLayout** | 始终挂载 | Lobby / History / Tools / Profile 通过 CSS `visibility` 切换，不销毁 |
| Layer 1 (中层) | **GameRoom** | 进入游戏后 Keep-Alive 保持 | 离开游戏上下文时才卸载；工具页从房间内打开时也保持 |
| Layer 2 (顶层) | **覆盖页** | 正常挂载/销毁 | 加入房间、创建房间、账单、结算报告等 |

```
┌─────────────────────────────────────────┐
│ Layer 2: 覆盖页 (z-20)                  │
│   JoinRoom / CreateGame / Bill / ...    │
├─────────────────────────────────────────┤
│ Layer 1: GameRoom (z-10)                │
│   GameRouter → GameRoom / 13水Room      │
├─────────────────────────────────────────┤
│ Layer 0: MainLayout (z-0)               │
│   Lobby / History / Toolbox / Profile   │
└─────────────────────────────────────────┘
```

### 路由表

#### 公开页面（无需登录）

| 路径 | 组件 | 说明 |
|---|---|---|
| `/` | `Welcome` | 欢迎页 |
| `/login` | `Login` | 登录页 |

#### 主布局页面（Layer 0 — MainLayout 内部通过 visibility 切换）

| 路径 | 组件 | 说明 |
|---|---|---|
| `/lobby` | `Lobby` | 大厅 — 创建/加入房间 |
| `/history` | `GameHistory` | 牌局历史 — 普通房间 + 十三水 两个 Tab |
| `/tools` | `Toolbox` | 工具箱入口 |
| `/profile` | `Profile` | 个人中心 |

#### 游戏房间（Layer 1 — Keep-Alive）

| 路径 | 组件 | 说明 |
|---|---|---|
| `/game/:id` | `GameRouter` → `GameRoom` 或 `ThirteenWaterRoom` | 根据 room_type 分发到德州/十三水房间 |

#### 覆盖页面（Layer 2 — 正常挂载/销毁）

| 路径 | 组件 | 说明 |
|---|---|---|
| `/join` | `JoinRoom` | 加入房间（输入房间码） |
| `/join/:roomCode` | `JoinRoom` | 加入房间（带房间码） |
| `/create` | `CreateGame` | 创建房间 |
| `/bill/:id` | `PersonalBill` | 个人账单 |
| `/settlement/:id` | `SettlementReport` | 德州结算报告 |
| `/lucky-history` | `LuckyHandHistory` | 幸运手牌历史 |
| `/leaderboard` | `Leaderboard` | 排行榜（战绩/十三水/趣味互动 三个 Tab） |
| `/tools/clock` | `GameClock` | 游戏计时器 |
| `/tools/coin` | `CoinFlip` | 抛硬币 |
| `/tools/seat` | `SeatDraw` | 抽座位 |
| `/tools/picker` | `RandomPicker` | 随机选择器 |
| `/tools/odds` | `OddsChart` | 概率表 |
| `/tools/dice` | `DiceRoll` | 掷骰子 |
| `/thirteen-report/:id` | `ThirteenReport` | 十三水牌局回顾报告 |

**共计约 20 条路由。**

---

## 后端架构

### Express 路由模块

后端基于 Express + TypeScript，入口为 `server/index.ts`，包含 **8 个路由模块**：

| 模块 | 挂载路径 | 文件 | 说明 |
|---|---|---|---|
| users | `/api/users` | `server/routes/users.ts` | 用户登录/注册/统计/排行榜 |
| games | `/api/games` | `server/routes/games.ts` | 房间创建/加入/关闭/列表/历史 |
| buyin | `/api/buyin`, `/api/checkout` | `server/routes/buyin.ts` | 德州买入/退出 |
| settlement | `/api/settlement` | `server/routes/settlement.ts` | 德州结算 |
| lucky_hands | `/api/lucky-hands` | `server/routes/lucky_hands.ts` | 幸运手牌 |
| timer | `/api/timer` | `server/routes/timer.ts` | 催促计时器/互动 |
| thirteen | `/api/thirteen` | `server/routes/thirteen.ts` | 十三水全部 API（start-round, set-public-cards, submit-hand, settle, state, history, round/:id, auto-arrange 等） |
| events | (SSE 端点) | `server/routes/events.ts` | Server-Sent Events 推送 |

### 其他后端文件

| 文件 | 说明 |
|---|---|
| `server/supabase.ts` | Supabase 客户端初始化 |
| `server/sse.ts` | SSE 连接管理 |
| `server/pendingRequests.ts` | 待处理请求队列 |
| `server/cron.ts` | 定时任务 — 每 15 分钟清理超 24 小时的活跃房间 |
| `server/lib/thirteen/scoring.ts` | 十三水结算引擎 — 两两对比、打枪、全垒打、鬼牌翻倍、零和验证 |
| `server/lib/thirteen/hands.ts` | 牌型评估引擎 — 判定牌型（高牌/一对/.../皇家同花顺） |
| `server/lib/thirteen/deck.ts` | 牌组定义、解析、鬼牌工具函数 |
| `server/lib/thirteen/arrange.ts` | 自动摆牌算法 — 暴力搜索 C(13,3)×C(10,5)=72072 组合 |

---

## Vercel Serverless 约束

- 每次请求是 cold/warm start，无持久化服务器
- **1024MB 内存，10s 超时**
- `vercel.json` 将 `/api/*` 路由到 `api/index.ts`（Serverless Function 入口）
- 速率限制: 通用 API 100次/分钟，登录 30次/15分钟，加入房间 20次/分钟

---

## 实时通信双通道

项目使用 **两种实时通信机制**：

### 1. Supabase Realtime Broadcast

- **用途**: 十三水房间状态同步、催促/互动动画
- **机制**: 基于 WebSocket 的 Pub/Sub 广播
- **场景**:
  - 十三水：玩家提交手牌通知、开始新局通知、结算完成通知
  - 同名踢人：当同名用户登录时广播踢人事件
  - 催促/互动：计时器、扔鸡蛋、送花等互动动画

### 2. Server-Sent Events (SSE)

- **用途**: 德州房间实时推送
- **文件**: `server/sse.ts` + `server/routes/events.ts` + `src/hooks/useGameSSE.ts`
- **场景**:
  - 德州买入审批通知
  - 游戏状态变更推送

---

## 前端 API 封装层

`src/lib/api.ts` 提供统一的 fetch 封装：

- 自动拼接 `API_BASE` 前缀
- 统一错误处理
- 封装 GET / POST / PUT / DELETE 方法
- 所有组件通过此模块调用后端 API
