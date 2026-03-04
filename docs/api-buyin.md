# 买入/结算 API

> 源码: `server/routes/buyin.ts` (344行) + `server/routes/settlement.ts` (223行)
> 挂载路径: `/api/buyin` 和 `/api/settlement`

---

## POST /api/buyin

直接买入（非审核模式或房主操作）。

**请求 Body:**

| 参数 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| gameId | string (UUID) | 是 | — | 游戏ID |
| userId | string (UUID) | 是 | — | 用户ID |
| amount | number | 是 | — | 买入金额（必须正整数） |
| type | string | 否 | `'initial'` | `'initial'` 或 `'rebuy'` |

**成功响应 (201):**
```json
{
  "buyIn": {
    "id": "uuid",
    "game_id": "uuid",
    "user_id": "uuid",
    "amount": 200,
    "type": "initial",
    "created_at": "ISO8601",
    "users": { "id": "uuid", "username": "昵称" }
  },
  "totalAmount": 400
}
```

**业务逻辑:**
1. `amount` 使用 `parseInt` 解析，必须为正整数
2. `type` 仅允许 `'rebuy'`，其他值统一为 `'initial'`
3. 写入 `buy_ins` 表后，确保 `game_players` 中存在该玩家记录（upsert）
4. 计算 `totalAmount`: 查询该用户在该游戏中所有 `type in ['initial', 'rebuy']` 的买入金额之和

**错误响应:**
- `400` — `{ error: "缺少必要参数" }` 或 `{ error: "买入金额必须为正整数" }`
- `500` — `{ error: "买入记录提交失败" }`

---

## GET /api/buyin/player/:gameId/:userId

获取某玩家在某局游戏中的买入记录。

**路径参数:**

| 参数 | 类型 | 说明 |
|------|------|------|
| gameId | UUID | 游戏ID |
| userId | UUID | 用户ID |

**成功响应 (200):**
```json
{
  "buyIns": [
    { "amount": 200, "type": "initial", "created_at": "ISO8601" },
    { "amount": 100, "type": "rebuy", "created_at": "ISO8601" }
  ]
}
```

**业务逻辑:**
- 查询 `buy_ins` 表，按 `created_at ASC` 排序
- 返回所有类型的买入记录（initial/rebuy/checkout）

**错误响应:**
- `500` — `{ error: "获取玩家买入记录失败" }`

---

## POST /api/buyin/pending

提交待审核买入申请（带入审核模式下，非房主用户使用）。

**请求 Body:**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| gameId | string (UUID) | 是 | 游戏ID |
| userId | string (UUID) | 是 | 用户ID |
| username | string | 是 | 用户昵称（供房主审核时显示） |
| amount | number | 是 | 买入金额（正整数） |
| type | string | 否 | `'initial'` 或 `'rebuy'`，默认 `'initial'` |

**成功响应 (201):**
```json
{
  "request": {
    "id": "内存生成的ID",
    "gameId": "uuid",
    "userId": "uuid",
    "username": "昵称",
    "amount": 200,
    "totalBuyIn": 400,
    "type": "initial"
  }
}
```

**业务逻辑:**
1. 先查询该用户当前累计买入 `totalBuyIn`，供房主审核时参考
2. 数据存入内存 `pendingRequests`（非数据库持久化）
3. 通过 `addPending()` 函数添加到内存队列

**注意:** 待审核数据存在服务器内存中，Vercel Serverless 环境下每次请求可能是不同实例，pending 数据可能丢失。

**错误响应:**
- `400` — `{ error: "缺少必要参数" }` 或 `{ error: "买入金额必须为正整数" }`
- `500` — `{ error: "提交申请时发生错误" }`

---

## GET /api/buyin/pending/:gameId

获取当前游戏所有待审核买入申请（房主使用）。

**路径参数:**

| 参数 | 类型 | 说明 |
|------|------|------|
| gameId | UUID | 游戏ID |

**成功响应 (200):**
```json
{
  "requests": [
    {
      "id": "内存ID",
      "gameId": "uuid",
      "userId": "uuid",
      "username": "昵称",
      "amount": 200,
      "totalBuyIn": 400,
      "type": "initial"
    }
  ]
}
```

**错误响应:**
- `500` — `{ error: "获取申请列表失败" }`

---

## POST /api/buyin/pending/:id/approve

房主批准买入申请。

**路径参数:**

| 参数 | 类型 | 说明 |
|------|------|------|
| id | string | 待审核申请的内存ID |

**成功响应 (201):**
```json
{
  "buyIn": {
    "id": "uuid",
    "game_id": "uuid",
    "user_id": "uuid",
    "amount": 200,
    "type": "initial",
    "users": { "id": "uuid", "username": "昵称" }
  },
  "totalAmount": 600
}
```

**业务逻辑:**
1. 通过 `removePending(id)` 从内存队列取出并移除申请
2. 将申请数据写入 `buy_ins` 表
3. 确保 `game_players` 中有该玩家记录（upsert）
4. 返回审批后的买入记录及该玩家累计买入金额

**错误响应:**
- `404` — `{ error: "申请不存在或已处理" }`
- `500` — `{ error: "买入审批写入失败" }`

---

## DELETE /api/buyin/pending/:id

房主拒绝买入申请。

**路径参数:**

| 参数 | 类型 | 说明 |
|------|------|------|
| id | string | 待审核申请的内存ID |

**成功响应 (200):**
```json
{ "success": true }
```

**业务逻辑:**
- 通过 `removePending(id)` 从内存队列移除申请
- 不写入任何数据库记录

**错误响应:**
- `404` — `{ error: "申请不存在或已处理" }`
- `500` — `{ error: "拒绝申请失败" }`

---

## POST /api/buyin/checkout

结账（防重复结账 + 自动结算机制）。

**请求 Body:**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| gameId | string (UUID) | 是 | 游戏ID |
| userId | string (UUID) | 是 | 用户ID |
| chips | number | 是 | 最终筹码数（非负整数） |

**成功响应 (201):**
```json
{
  "checkout": {
    "id": "uuid",
    "game_id": "uuid",
    "user_id": "uuid",
    "amount": 350,
    "type": "checkout",
    "users": { "id": "uuid", "username": "昵称" }
  },
  "autoSettled": true
}
```

**业务逻辑:**
1. `chips` 使用 `parseInt` 解析，必须为非负整数（`>= 0`）
2. **防重复:** 查询是否已有 `type='checkout'` 的记录，有则拒绝
3. 写入 `buy_ins` 表，`type='checkout'`，`amount=chips`
4. **自动结算检查:**
   - 收集所有有 `initial/rebuy` 记录的玩家集合
   - 收集所有有 `checkout` 记录的玩家集合
   - 如果两个集合完全一致（所有买入过的玩家都已结账）：
     - 计算每位玩家的 `total_buyin`、`final_chips`、`net_profit`
     - 写入 `settlements` 表（upsert）
     - 更新游戏 `status='finished'`
     - 返回 `autoSettled: true`
5. 自动结算失败不影响结账本身的成功（try-catch 隔离）

**错误响应:**
- `400` — `{ error: "缺少必要参数" }` 或 `{ error: "筹码数量必须为非负整数" }` 或 `{ error: "您已经结过账了，不能重复结账" }`
- `500` — `{ error: "结账记录提交失败" }`

---

## GET /api/settlement/:gameId

获取结算数据（德州扑克结算报告页使用）。

**路径参数:**

| 参数 | 类型 | 说明 |
|------|------|------|
| gameId | UUID | 游戏ID |

**成功响应 (200):**
```json
{
  "game": { "id": "uuid", "name": "...", "users": { "id": "uuid", "username": "房主" } },
  "stats": [
    {
      "userId": "uuid",
      "username": "昵称",
      "totalBuyin": 400,
      "finalChips": 550,
      "netProfit": 150
    }
  ],
  "hasSettlement": true,
  "buyInHistory": [
    { "userId": "uuid", "amount": 200, "type": "initial", "createdAt": "ISO8601" },
    { "userId": "uuid", "amount": 200, "type": "rebuy", "createdAt": "ISO8601" }
  ]
}
```

**业务逻辑:**
1. 获取游戏基本信息（含房主用户名）
2. 获取所有 `game_players`（含用户名）
3. 获取所有 `buy_ins`，按 `created_at ASC` 排序
4. 获取已有 `settlements` 记录
5. 按用户聚合：`initial/rebuy` 累加为 `totalBuyin`，`checkout` 的 `amount` 为 `finalChips`
6. 如果有 `settlements` 记录，优先使用已保存的 `final_chips` 和 `total_buyin`
7. `netProfit = finalChips - totalBuyin`
8. `buyInHistory` 仅包含 `initial/rebuy` 类型，供前端折线图使用

**错误响应:**
- `404` — `{ error: "游戏不存在" }`
- `500` — `{ error: "服务器内部错误" }`

---

## POST /api/settlement/:gameId

提交最终结算（仅房主可操作）。

**路径参数:**

| 参数 | 类型 | 说明 |
|------|------|------|
| gameId | UUID | 游戏ID |

**请求 Body:**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| userId | string (UUID) | 是 | 操作者用户ID（必须为房主） |
| playerResults | Array | 是 | 每位玩家的最终筹码 |

`playerResults` 数组元素:

| 字段 | 类型 | 说明 |
|------|------|------|
| userId | string (UUID) | 玩家ID |
| finalChips | number | 最终筹码数（非负数） |

**成功响应 (200):**
```json
{
  "settlements": [
    {
      "game_id": "uuid",
      "user_id": "uuid",
      "final_chips": 550,
      "total_buyin": 400,
      "net_profit": 150
    }
  ]
}
```

**业务逻辑:**
1. 验证 `created_by === userId`（仅房主）
2. 验证 `playerResults` 非空数组，每个元素有 `userId` 和 `finalChips >= 0`
3. **平账验证:** `|提交总筹码 - 总买入| <= 1`（允许 1 的舍入误差）
4. 计算每位玩家的 `total_buyin`（从 `buy_ins` 表聚合 initial/rebuy）
5. 写入 `settlements` 表（upsert，`onConflict: 'game_id,user_id'`）
6. 标记游戏 `status='finished'`，设置 `finished_at`

**错误响应:**
- `400` — `{ error: "缺少玩家结算数据" }` 或 `{ error: "玩家结算数据格式不正确" }` 或 `{ error: "账单未平账！总买入: N 积分，总剩余筹码: M 积分，差异: D 积分", totalBuyIn, totalChips, diff }`
- `401` — `{ error: "未授权的请求" }`
- `403` — `{ error: "只有房主才能完成结算关闭房间" }`
- `404` — `{ error: "游戏不存在" }`
- `500` — `{ error: "结算提交失败" }`
