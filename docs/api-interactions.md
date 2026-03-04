# 趣味互动 + 幸运手牌 API

> 源码: `server/routes/timer.ts` (279行) + `server/routes/lucky_hands.ts` (327行)
> 挂载路径: `/api/timer` 和 `/api/lucky-hands`

---

# 趣味互动 API (`/api/timer`)

互动类型包括：计时催促（timer）、扔鸡蛋（egg）、抓鸡（chicken）、送花（flower）。
数据存储在 `shame_timers` 表中。

---

## POST /api/timer/record

记录一次互动。

**请求 Body:**

| 参数 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| gameId | string (UUID) | 是 | — | 游戏ID |
| targetUserId | string (UUID) | 是 | — | 被互动的目标用户ID |
| startedBy | string (UUID) | 是 | — | 发起互动的用户ID |
| durationSeconds | number | 否 | 0 | 持续秒数（仅 timer 类型有意义） |
| type | string | 否 | `'timer'` | 互动类型: `'timer'` / `'egg'` / `'chicken'` / `'flower'` |

**成功响应 (201):**
```json
{
  "record": {
    "id": "uuid",
    "game_id": "uuid",
    "target_user_id": "uuid",
    "started_by": "uuid",
    "type": "egg",
    "duration_seconds": 0,
    "created_at": "ISO8601"
  }
}
```

**业务逻辑:**
1. `type` 必须是 `['timer', 'egg', 'chicken', 'flower']` 之一
2. `durationSeconds` 取 `Math.round`，负数或非数值一律为 0
3. 写入 `shame_timers` 表

**错误响应:**
- `400` — `{ error: "缺少必要参数" }` 或 `{ error: "无效的互动类型" }`
- `500` — `{ error: "记录失败" }`

---

## GET /api/timer/game/:gameId

获取某局游戏所有互动记录（含用户名）。

**路径参数:**

| 参数 | 类型 | 说明 |
|------|------|------|
| gameId | UUID | 游戏ID |

**成功响应 (200):**
```json
{
  "records": [
    {
      "id": "uuid",
      "game_id": "uuid",
      "target_user_id": "uuid",
      "started_by": "uuid",
      "type": "timer",
      "duration_seconds": 45,
      "created_at": "ISO8601",
      "target": { "id": "uuid", "username": "目标昵称" },
      "starter": { "id": "uuid", "username": "发起者昵称" }
    }
  ]
}
```

**业务逻辑:**
- Join `users` 表两次：`target:users!shame_timers_target_user_id_fkey` 和 `starter:users!shame_timers_started_by_fkey`
- 按 `created_at DESC` 排序

**错误响应:**
- `500` — `{ error: "获取记录失败" }`

---

## GET /api/timer/game/:gameId/stats

获取某局游戏中每个玩家的互动统计（按被互动者分组，分类型）。

**路径参数:**

| 参数 | 类型 | 说明 |
|------|------|------|
| gameId | UUID | 游戏ID |

**成功响应 (200):**
```json
{
  "stats": [
    {
      "userId": "uuid",
      "timerCount": 3,
      "timerTotalSec": 135,
      "timerAvgSec": 45,
      "timerMaxSec": 60,
      "eggCount": 2,
      "chickenCount": 1,
      "flowerCount": 0
    }
  ]
}
```

**业务逻辑:**
- 按 `target_user_id` 聚合
- `timerAvgSec = round(timerTotalSec / timerCount)`（timerCount 为 0 时返回 0）
- 仅 `timer` 类型累计 `durationSeconds`

**错误响应:**
- `500` — `{ error: "获取统计失败" }`

---

## GET /api/timer/user/:userId/stats

获取某用户跨所有游戏的互动统计（用于个人中心）。

**路径参数:**

| 参数 | 类型 | 说明 |
|------|------|------|
| userId | UUID | 用户ID |

**成功响应 (200):**
```json
{
  "stats": {
    "timerCount": 10,
    "timerTotalSec": 450,
    "timerAvgSec": 45,
    "timerMaxSec": 90,
    "eggCount": 5,
    "chickenCount": 3,
    "flowerCount": 1
  }
}
```

**业务逻辑:**
- 查询 `shame_timers` 表，`target_user_id = userId`
- 统计所有游戏中该用户被互动的次数和时长

**错误响应:**
- `500` — `{ error: "获取统计失败" }`

---

## GET /api/timer/leaderboard

全局趣味互动排行榜（按被互动总次数排序）。

**参数:** 无

**成功响应 (200):**
```json
{
  "leaderboard": [
    {
      "userId": "uuid",
      "username": "昵称",
      "timerCount": 10,
      "eggCount": 5,
      "chickenCount": 3,
      "flowerCount": 1,
      "totalInteractions": 19
    }
  ]
}
```

**业务逻辑:**
1. 查询 `shame_timers` 全量，按 `target_user_id` 聚合各类型计数
2. 批量查询相关用户 ID 的 `username`
3. `totalInteractions = timerCount + eggCount + chickenCount + flowerCount`
4. 按 `totalInteractions DESC` 排序

**错误响应:**
- `500` — `{ error: "获取排行榜失败" }` 或 `{ error: "获取用户信息失败" }`

---

# 幸运手牌 API (`/api/lucky-hands`)

幸运手牌是德州房间的附加玩法：每位玩家最多配置 3 个手牌组合槽位，牌局中命中组合可申请中奖加分。

---

## GET /api/lucky-hands/:gameId

获取该房间的所有幸运手牌配置及中奖数据。

**路径参数:**

| 参数 | 类型 | 说明 |
|------|------|------|
| gameId | UUID | 游戏ID |

**成功响应 (200):**
```json
{
  "luckyHands": [
    {
      "id": "uuid",
      "game_id": "uuid",
      "user_id": "uuid",
      "hand_index": 1,
      "card_1": "AKs",
      "card_2": "",
      "hit_count": 2,
      "created_at": "ISO8601",
      "users": { "id": "uuid", "username": "昵称" }
    }
  ]
}
```

**业务逻辑:**
- 查询 `lucky_hands` 表，join `users(id, username)`

**错误响应:**
- `500` — `{ error: "获取幸运手牌数据失败" }`

---

## POST /api/lucky-hands/:gameId/setup

配置某个槽位的手牌组合。

**路径参数:**

| 参数 | 类型 | 说明 |
|------|------|------|
| gameId | UUID | 游戏ID |

**请求 Body:**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| userId | string (UUID) | 是 | 用户ID |
| handIndex | number | 是 | 槽位编号 (1~3) |
| card1 | string | 是 | 手牌组合字符串（如 `'AKs'`, `'AKo'`, `'AAo'`） |
| card2 | string | 否 | 兼容保留字段，存空字符串 |

**成功响应 (200):**
```json
{
  "success": true,
  "luckyHand": {
    "id": "uuid",
    "game_id": "uuid",
    "user_id": "uuid",
    "hand_index": 1,
    "card_1": "AKs",
    "card_2": "",
    "hit_count": 0,
    "users": { "id": "uuid", "username": "昵称" }
  }
}
```

**业务逻辑:**
1. `handIndex` 必须为 1~3 的整数
2. 验证游戏 `status === 'active'`
3. `handIndex` 不能超过房间配置的 `lucky_hands_count`
4. 检查同一用户的其他槽位是否已有相同 `card_1` 组合（防重复设置）
5. Upsert `lucky_hands`（`onConflict: 'game_id,user_id,hand_index'`），`hit_count` 重置为 0

**错误响应:**
- `400` — `{ error: "参数缺失" }` 或 `{ error: "无效的槽位编号" }` 或 `{ error: "无效的手牌组合" }` 或 `{ error: "游戏非活跃状态" }` 或 `{ error: "槽位不被房间配置允许" }` 或 `{ error: "该组合已在槽位 #N 中使用，不能重复设置" }`
- `500` — `{ error: "配置手牌失败" }`

---

## GET /api/lucky-hands/:gameId/pending

获取游戏中所有待审核的中奖/改牌申请（房主使用）。

**路径参数:**

| 参数 | 类型 | 说明 |
|------|------|------|
| gameId | UUID | 游戏ID |

**成功响应 (200):**
```json
{
  "pendingHits": [
    {
      "id": "uuid",
      "game_id": "uuid",
      "user_id": "uuid",
      "lucky_hand_id": "uuid",
      "request_type": "hit",
      "new_card_1": null,
      "new_card_2": null,
      "created_at": "ISO8601",
      "users": { "id": "uuid", "username": "昵称" },
      "lucky_hands": { "card_1": "AKs", "card_2": "", "hand_index": 1 }
    }
  ]
}
```

**业务逻辑:**
- 查询 `pending_lucky_hits` 表，join `users` + `lucky_hands`
- 按 `created_at ASC` 排序

**错误响应:**
- `500` — `{ error: "获取待审核列表失败" }`

---

## POST /api/lucky-hands/:gameId/hit-submit

玩家提交中奖申请（走审核流程）。

**路径参数:**

| 参数 | 类型 | 说明 |
|------|------|------|
| gameId | UUID | 游戏ID |

**请求 Body:**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| userId | string (UUID) | 是 | 用户ID |
| luckyHandId | string (UUID) | 是 | 幸运手牌记录ID |

**成功响应 (200):**
```json
{
  "success": true,
  "pendingHit": {
    "id": "uuid",
    "game_id": "uuid",
    "user_id": "uuid",
    "lucky_hand_id": "uuid",
    "request_type": "hit",
    "created_at": "ISO8601"
  }
}
```

**业务逻辑:**
- 写入 `pending_lucky_hits` 表，`request_type='hit'`

**错误响应:**
- `400` — `{ error: "参数缺失" }`
- `500` — `{ error: "提交中奖审核失败" }`

---

## POST /api/lucky-hands/:gameId/update-submit

玩家提交改牌申请（走审核流程）。

**路径参数:**

| 参数 | 类型 | 说明 |
|------|------|------|
| gameId | UUID | 游戏ID |

**请求 Body:**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| userId | string (UUID) | 是 | 用户ID |
| luckyHandId | string (UUID) | 是 | 幸运手牌记录ID |
| newCard1 | string | 是 | 新的手牌组合字符串 |
| newCard2 | string | 否 | 兼容保留字段 |

**成功响应 (200):**
```json
{
  "success": true,
  "pendingUpdate": {
    "id": "uuid",
    "game_id": "uuid",
    "user_id": "uuid",
    "lucky_hand_id": "uuid",
    "request_type": "update",
    "new_card_1": "QQo",
    "new_card_2": "",
    "created_at": "ISO8601"
  }
}
```

**业务逻辑:**
- 写入 `pending_lucky_hits` 表，`request_type='update'`
- 存储 `new_card_1` 和 `new_card_2` 字段

**错误响应:**
- `400` — `{ error: "参数缺失" }`
- `500` — `{ error: "提交修改审核失败" }`

---

## POST /api/lucky-hands/:gameId/hit-direct

房主直接确认自己的幸运手牌中奖（不走 pending 审核流程）。

**路径参数:**

| 参数 | 类型 | 说明 |
|------|------|------|
| gameId | UUID | 游戏ID |

**请求 Body:**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| userId | string (UUID) | 是 | 房主用户ID |
| luckyHandId | string (UUID) | 是 | 幸运手牌记录ID |

**成功响应 (200):**
```json
{
  "success": true,
  "newCount": 3
}
```

**业务逻辑:**
1. 验证 `userId` 是该游戏的 `created_by`（仅房主可用）
2. 调用 Supabase RPC `increment_hit_count(hand_id)` 原子自增 `hit_count`
3. 返回自增后的 `newCount`

**错误响应:**
- `400` — `{ error: "参数缺失" }`
- `403` — `{ error: "只有房主本体才能使用直接过审接口" }`
- `500` — `{ error: "房主直接增加手牌记录失败" }`

---

## POST /api/lucky-hands/:gameId/hit-approve/:hitId

房主批准中奖/改牌申请。

**路径参数:**

| 参数 | 类型 | 说明 |
|------|------|------|
| gameId | UUID | 游戏ID |
| hitId | UUID | 待审核申请ID |

**成功响应 (200):**
```json
{
  "success": true,
  "newCount": 4
}
```

**业务逻辑:**
1. 从 `pending_lucky_hits` 获取申请记录
2. 获取关联的 `lucky_hands` 记录
3. 根据 `request_type` 分支处理：
   - **`hit`（中奖）:** 调用 RPC `increment_hit_count` 原子自增 `hit_count`
   - **`update`（改牌）:** 更新 `lucky_hands` 的 `card_1`/`card_2`，`hit_count` 重置为 0
4. 删除 `pending_lucky_hits` 中的申请记录

**错误响应:**
- `404` — `{ error: "审核申请不存在" }`
- `500` — `{ error: "关联的手牌记录不存在" }` 或 `{ error: "审批处理失败" }`

---

## POST /api/lucky-hands/:gameId/hit-reject/:hitId

房主拒绝中奖/改牌申请。

**路径参数:**

| 参数 | 类型 | 说明 |
|------|------|------|
| gameId | UUID | 游戏ID |
| hitId | UUID | 待审核申请ID |

**成功响应 (200):**
```json
{ "success": true }
```

**业务逻辑:**
- 从 `pending_lucky_hits` 查询申请是否存在
- 直接删除该申请记录，不做任何数据变更

**错误响应:**
- `404` — `{ error: "申请不存在" }`
- `500` — `{ error: "拒绝申请失败" }`
