# 房间管理 + SSE 事件 API

> 源码: `server/routes/games.ts` (395行) + `server/routes/events.ts` (74行)
> 挂载路径: `/api/games` 和 `/api/events`

---

## GET /api/games

获取所有活跃游戏列表。

**参数:** 无

**成功响应 (200):**
```json
{
  "games": [
    {
      "id": "uuid",
      "name": "房间名称",
      "room_code": "123456",
      "room_type": "thirteen | texas",
      "status": "active",
      "created_by": "uuid",
      "blind_level": "1/2",
      "min_buyin": 100,
      "max_buyin": 400,
      "insurance_mode": false,
      "lucky_hands_count": 0,
      "thirteen_base_score": 1,
      "thirteen_ghost_count": 6,
      "thirteen_compare_suit": true,
      "thirteen_max_players": 4,
      "thirteen_time_limit": 90,
      "created_at": "ISO8601",
      "finished_at": null,
      "game_players": [{ "count": 3 }],
      "users": { "username": "房主昵称" }
    }
  ]
}
```

**业务逻辑:**
- 筛选 `status='active'`，按 `created_at DESC` 排序
- `game_players(count)` 用于显示当前人数
- `users!games_created_by_fkey(username)` 关联房主用户名

**错误响应:**
- `500` — `{ error: "获取游戏列表失败" }` 或 `{ error: "服务器内部错误" }`

---

## GET /api/games/history

获取用户参与过的所有已结束房间。

**Query 参数:**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| userId | string (UUID) | 是 | 用户ID |

**成功响应 (200):**
```json
{
  "games": [
    {
      "id": "uuid",
      "name": "房间名称",
      "status": "finished",
      "finished_at": "ISO8601",
      "game_players": [{ "count": 4 }],
      "users": { "username": "房主昵称" }
    }
  ]
}
```

**业务逻辑:**
1. 先查 `game_players` 表找到该用户参与过的所有 `game_id`
2. 再查 `games` 表筛选 `status='finished'`，按 `finished_at DESC` 排序
3. 如果用户没有参与过任何游戏，返回空数组

**错误响应:**
- `400` — `{ error: "缺少 userId 参数" }`（userId 缺失或非字符串）
- `500` — `{ error: "获取历史牌局失败" }`

---

## GET /api/games/:id

获取单个游戏详情（含玩家列表和买入记录）。

**路径参数:**

| 参数 | 类型 | 说明 |
|------|------|------|
| id | UUID | 游戏ID |

**成功响应 (200):**
```json
{
  "game": {
    "id": "uuid",
    "name": "房间名称",
    "users": { "id": "uuid", "username": "房主昵称" }
  },
  "buyIns": [
    {
      "id": "uuid",
      "game_id": "uuid",
      "user_id": "uuid",
      "amount": 200,
      "type": "initial | rebuy | checkout",
      "created_at": "ISO8601",
      "users": { "id": "uuid", "username": "昵称" }
    }
  ],
  "players": [
    {
      "id": "uuid",
      "game_id": "uuid",
      "user_id": "uuid",
      "users": { "id": "uuid", "username": "昵称" }
    }
  ]
}
```

**业务逻辑:**
- `game` 关联 `users!games_created_by_fkey(id, username)` 获取房主信息
- `buyIns` 按 `created_at ASC` 排序，包含所有类型（initial/rebuy/checkout）
- `players` 为 `game_players` 表记录，含关联的用户名

**错误响应:**
- `404` — `{ error: "游戏不存在" }`
- `500` — `{ error: "服务器内部错误" }`

---

## POST /api/games

创建新游戏。

**请求 Body:**

| 参数 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| name | string | 是 | — | 房间名称（自动 trim） |
| userId | string (UUID) | 是 | — | 创建者用户ID |
| roomType | string | 否 | `'texas'` | `'thirteen'` 或 `'texas'` |
| blindLevel | string | 否 | `'1/2'` | 德州盲注级别 |
| minBuyin | number | 否 | 100 | 德州最小买入 |
| maxBuyin | number | 否 | 400 | 德州最大买入 |
| insuranceMode | boolean | 否 | false | 德州保险模式 |
| luckyHandsCount | number | 否 | 0 | 幸运手牌槽位数 |
| thirteenBaseScore | number | 否 | 1 | 十三水底分 |
| thirteenGhostCount | number | 否 | 6 | 十三水鬼牌数，仅允许 [0,2,4,6] |
| thirteenCompareSuit | boolean | 否 | true | 十三水是否比花色 |
| thirteenMaxPlayers | number | 否 | 4 | 十三水最大人数，夹值 2~4 |
| thirteenTimeLimit | number | 否 | 90 | 十三水摆牌时限（秒） |

**成功响应 (201):**
```json
{
  "game": {
    "id": "uuid",
    "name": "房间名称",
    "room_code": "654321",
    "room_type": "thirteen",
    "status": "active",
    "created_by": "uuid"
  }
}
```

**业务逻辑:**
1. 验证 `name` 和 `userId` 必填，`name` 不能为空字符串
2. 生成 6 位随机数字房间码，利用数据库 UNIQUE 约束 + 最多 10 次重试保证唯一
3. 如果 `room_type` 列不存在（数据库未迁移），降级为仅德州字段插入
4. 创建者自动加入 `game_players`，加入失败则回滚删除游戏记录
5. 十三水配置：`ghost_count` 只允许 `[0,2,4,6]`，`max_players` 夹值 `Math.min(4, Math.max(2, val))`

**错误响应:**
- `400` — `{ error: "缺少必要参数" }` 或 `{ error: "房间名称不能为空" }`
- `500` — `{ error: "创建游戏失败" }` 或 `{ error: "创建游戏失败：无法生成唯一房间码，请重试" }` 或 `{ error: "创建游戏失败：房主加入房间失败" }`

---

## POST /api/games/join

通过房间码加入游戏。

**请求 Body:**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| roomCode | string | 是 | 6位房间码 |
| userId | string (UUID) | 是 | 用户ID |

**成功响应 (200):**
```json
{
  "game": { "id": "uuid", "name": "...", "room_code": "123456", "status": "active" }
}
```

**业务逻辑:**
1. 通过 `room_code` + `status='active'` 查找房间
2. 十三水房间检查 `thirteen_max_players` 人数上限
3. 已在房间内的玩家允许重复加入（不报满员错误）
4. 使用 `upsert` 写入 `game_players`（`onConflict: 'game_id,user_id'`），幂等操作

**错误响应:**
- `400` — `{ error: "缺少房间码或用户信息" }` 或 `{ error: "房间已满（最多N人）" }`
- `404` — `{ error: "房间不存在或已结束" }`
- `500` — `{ error: "加入游戏失败" }`

---

## POST /api/games/:id/finish

关闭房间（仅房主可操作）。

**路径参数:**

| 参数 | 类型 | 说明 |
|------|------|------|
| id | UUID | 游戏ID |

**请求 Body:**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| userId | string (UUID) | 是 | 操作者用户ID（必须为房主） |

**成功响应 (200):**
```json
{
  "game": { "id": "uuid", "status": "finished", "finished_at": "ISO8601" }
}
```

**业务逻辑:**
1. 验证 `userId` 是否为该游戏的 `created_by`（房主）
2. 更新 `status='finished'`，`finished_at=new Date().toISOString()`

**错误响应:**
- `401` — `{ error: "未授权的请求" }`（缺少 userId）
- `403` — `{ error: "只有房主才能结束游戏" }`
- `404` — `{ error: "游戏不存在" }`
- `500` — `{ error: "结束游戏失败" }`

---

## GET /api/events/:gameId

SSE 长连接订阅，用于实时接收游戏事件。

**路径参数:**

| 参数 | 类型 | 说明 |
|------|------|------|
| gameId | UUID 或 `'lobby'` | 游戏ID 或大厅频道 |

**Query 参数:**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| userId | string (UUID) | 是 | 用户ID |

**响应头:**
```
Content-Type: text/event-stream
Cache-Control: no-cache, no-transform
Connection: keep-alive
X-Accel-Buffering: no
Access-Control-Allow-Origin: *
```

**SSE 事件流:**

| 事件名 | 触发时机 | data 格式 |
|--------|---------|-----------|
| `connected` | 连接成功后立即发送 | `{ isHost: boolean }` |
| `pending_list` | 房主连接时，如有待审核申请 | `PendingRequest[]` |
| `ping` | 每 25 秒心跳 | `{}` |

**业务逻辑:**
1. 如果 `gameId` 不是 `'lobby'`，查询该用户是否为房主
2. 设置 SSE 响应头（含 nginx 反缓冲配置）
3. 发送初始 `connected` 事件，包含 `isHost` 标记
4. 房主额外推送当前 `pending_list`（待审核买入申请列表）
5. 每 25 秒发送 `ping` 保持连接活跃，防代理超时
6. 客户端断开（`req.on('close')`）时清除 ping 定时器并移除 SSE 客户端注册
7. 客户端使用 `EventSource` 原生支持断线自动重连（约 3 秒后重试）

**错误响应:**
- `400` — `{ error: "缺少 userId 参数" }`
