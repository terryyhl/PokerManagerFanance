# 实时通信架构

> 面向 AI 助手的项目记忆参考文档

## 双通道架构

项目使用两种实时通信机制：Supabase Realtime（WebSocket）和 SSE（Server-Sent Events）。

---

## 1. Supabase Realtime Broadcast (WebSocket)

**用途**: 十三水游戏状态、催促计时器、趣味互动

**频道命名**: `game-{gameId}` 或 `thirteen-{gameId}`

### Broadcast 事件类型

| 事件 | 载荷 | 用途 |
|------|------|------|
| `timer_start` | `{targetUserId, targetUsername, startedBy, startedByUsername, totalSeconds, startedAt}` | 催促计时开始 |
| `timer_stop` | `{targetUserId}` | 催促计时结束 |
| `interaction` | `{type, targetUserId, targetUsername, startedBy, startedByUsername}` | 趣味互动(egg/chicken/flower) |
| `sync_request` | `{}` | 新加入者请求同步当前状态 |
| `sync_response` | `{activeTimer?}` | 响应同步请求 |

### Supabase Realtime 表订阅 (Postgres Changes)

| 表 | 事件 | 用途 |
|----|------|------|
| `thirteen_rounds` | INSERT/UPDATE | 轮次状态变更(开始/结算完成) |
| `thirteen_hands` | INSERT/UPDATE | 玩家确认摆牌 |
| `thirteen_scores` | INSERT | 结算明细写入 |
| `thirteen_totals` | INSERT | 结算汇总写入 |
| `lucky_hands` | INSERT/UPDATE | 幸运手牌配置变更 |
| `pending_lucky_hits` | INSERT/DELETE | 中奖申请提交/处理 |

---

## 2. SSE (Server-Sent Events)

**用途**: 德州扑克房间实时事件

**源码**: `server/routes/events.ts` + `server/sse.ts`

### 连接与心跳

- **连接**: `GET /api/events/:gameId?userId=xxx`
- **心跳**: 每 25 秒发送 `ping` 事件
- **断线重连**: EventSource 原生支持(约 3 秒)

### SSE 事件类型

| 事件 | 载荷 | 用途 |
|------|------|------|
| `connected` | `{isHost}` | 连接确认 |
| `pending_list` | `PendingBuyinEvent[]` | 房主初始收到待审核列表 |
| `buyin_request` | `PendingBuyinEvent` | 新买入申请(房主收到) |
| `buyin_approved` | `{amount, type, totalAmount?}` | 买入被批准(申请者收到) |
| `buyin_rejected` | `{amount, type, requestId}` | 买入被拒绝(申请者收到) |
| `game_refresh` | `{type, userId, username?, amount?, totalAmount?}` | 通用刷新(买入/结账/加入等) |
| `game_settled` | `{message}` | 游戏已结算 |
| `ping` | `{}` | 心跳保活 |

---

## useGameSSE Hook

**文件**: `src/hooks/useGameSSE.ts`（约 312 行）

统一封装 Supabase Realtime 订阅的 Hook。

### 参数

```
(gameId: string, userId: string, handlers: SSEHandlers)
```

### SSEHandlers 回调

```ts
interface SSEHandlers {
  onConnected?: (isHost: boolean) => void;
  onBuyinRequest?: (data: PendingBuyinEvent) => void;
  onPendingList?: (data: PendingBuyinEvent[]) => void;
  onGameRefresh?: (data) => void;
  onBuyinApproved?: (data) => void;
  onBuyinRejected?: (data) => void;
  onGameSettled?: (data: { message: string }) => void;
  onLobbyRefresh?: (data: { gameId: string }) => void;
  onShameTimer?: (data) => void;
  onTimerStart?: (data: ActiveTimerEvent) => void;
  onTimerStop?: (data: { targetUserId: string }) => void;
  onInteraction?: (data: InteractionEvent) => void;
}
```

### 返回值

```ts
{
  markPendingSubmitted: (id: string) => void;       // 标记待审核已处理
  broadcastTimerStart: (data) => void;              // 广播催促开始
  broadcastTimerStop: (data) => void;               // 广播催促结束
  broadcastInteraction: (data) => void;             // 广播趣味互动
  setActiveTimerRef: MutableRefObject<...>;         // 外部设置活跃计时器引用
}
```

### 导出类型

```ts
interface ActiveTimerEvent {
  targetUserId: string;
  targetUsername: string;
  startedBy: string;
  startedByUsername: string;
  totalSeconds: number;
  startedAt: number; // Date.now()
}

interface InteractionEvent {
  type: 'egg' | 'chicken' | 'flower';
  targetUserId: string;
  targetUsername: string;
  startedBy: string;
  startedByUsername: string;
}
```

---

## 十三水实时同步策略

`ThirteenWaterRoom.tsx` 中直接使用 Supabase client 订阅：

1. **订阅 `thirteen_rounds` 表**: 检测新轮次开始、结算完成
2. **订阅 `thirteen_hands` 表**: 检测其他玩家确认摆牌
3. **进房同步**: `GET /api/thirteen/:gameId/state` 获取当前状态
4. **草稿自动保存**: debounce 1 秒 → `POST /api/thirteen/:gameId/save-draft`
