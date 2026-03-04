# 十三水 API

> 源码: `server/routes/thirteen.ts` (917行)
> 挂载路径: `/api/thirteen`
> 依赖: `server/lib/thirteen/deck.ts`, `hands.ts`, `scoring.ts`, `arrange.ts`

---

## POST /api/thirteen/:gameId/start-round

房主开始新一轮。

**路径参数:**

| 参数 | 类型 | 说明 |
|------|------|------|
| gameId | UUID | 游戏ID |

**请求 Body:**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| userId | string (UUID) | 是 | 操作者用户ID（必须为房主） |

**成功响应 (201):**
```json
{
  "round": {
    "id": "uuid",
    "game_id": "uuid",
    "round_number": 1,
    "status": "arranging",
    "public_cards": [],
    "ghost_count": 0,
    "ghost_multiplier": 1,
    "created_at": "ISO8601"
  }
}
```

**业务逻辑:**
1. 验证房主身份（`isHost` 辅助函数）
2. 验证是十三水房间（`room_type === 'thirteen'`）且活跃（`status === 'active'`）
3. 检查无未完成轮次（`status != 'finished'` 的记录不能存在）
4. 获取最大 `round_number`，自增 +1
5. 创建 `thirteen_rounds`，初始 `status='arranging'`，`public_cards=[]`，`ghost_count=0`，`ghost_multiplier=1`

**错误响应:**
- `400` — `{ error: "缺少 userId" }` 或 `{ error: "该房间不是13水房间" }` 或 `{ error: "该房间已结束" }` 或 `{ error: "当前轮次尚未结束", roundId }` 
- `403` — `{ error: "只有房主可以开始新一轮" }`
- `500` — `{ error: "开始新一轮失败" }`

---

## POST /api/thirteen/:gameId/set-ghost-count

设置本轮鬼牌数量（独立于公共牌设置）。

**路径参数:**

| 参数 | 类型 | 说明 |
|------|------|------|
| gameId | UUID | 游戏ID |

**请求 Body:**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| userId | string (UUID) | 是 | 房主用户ID |
| roundId | string (UUID) | 是 | 轮次ID |
| ghostCount | number | 是 | 鬼牌数量 |

**成功响应 (200):**
```json
{
  "round": {
    "id": "uuid",
    "ghost_count": 4,
    "ghost_multiplier": 16,
    "public_cards": []
  }
}
```

**业务逻辑:**
1. 验证房主身份
2. `ghostCount` 夹值到 `[0, maxGhost]`，其中 `maxGhost` 取自游戏配置 `thirteen_ghost_count`（默认 6）
3. 倍率计算: `multiplier = 2^count`
4. 更新轮次的 `ghost_count`、`ghost_multiplier`，同时清空 `public_cards`

**错误响应:**
- `400` — `{ error: "缺少必要参数" }`
- `403` — `{ error: "只有房主可以设置鬼牌" }`
- `404` — `{ error: "房间不存在" }`
- `500` — `{ error: "设置鬼牌失败" }`

---

## POST /api/thirteen/:gameId/set-public-cards

房主设置公共牌（0~6 张）。

**路径参数:**

| 参数 | 类型 | 说明 |
|------|------|------|
| gameId | UUID | 游戏ID |

**请求 Body:**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| userId | string (UUID) | 是 | 房主用户ID |
| roundId | string (UUID) | 是 | 轮次ID |
| publicCards | string[] | 是 | 公共牌编码数组（0~6张） |

牌编码格式: `{rank}{suit}` — ranks: 2-9,T,J,Q,K,A; suits: S,H,C,D; 鬼牌: JK1-JK6

**成功响应 (200):**
```json
{
  "round": {
    "id": "uuid",
    "public_cards": ["JK1", "AS", "KH"],
    "ghost_count": 1,
    "ghost_multiplier": 2
  }
}
```

**业务逻辑:**
1. 验证房主身份
2. 验证公共牌数量 <= 6，每张牌编码合法（`isValidCard`）
3. 检查公共牌中鬼牌数量不超过游戏配置的 `thirteen_ghost_count`
4. **自动计算:** `ghost_count` = 公共牌中鬼牌数量，`ghost_multiplier` = `2^ghost_count`
5. 更新轮次的 `public_cards`、`ghost_count`、`ghost_multiplier`

**错误响应:**
- `400` — `{ error: "缺少必要参数" }` 或 `{ error: "公共牌最多6张" }` 或 `{ error: "无效的牌: XX" }` 或 `{ error: "鬼牌数量(N)超过配置(M)" }`
- `403` — `{ error: "只有房主可以设置公共牌" }`
- `404` — `{ error: "房间不存在" }`
- `500` — `{ error: "设置公共牌失败" }`

---

## POST /api/thirteen/:gameId/auto-arrange

自动摆牌（给定 13 张牌，返回最优的 3+5+5 分配方案）。

**路径参数:**

| 参数 | 类型 | 说明 |
|------|------|------|
| gameId | UUID | 游戏ID（路径中有但实际未用于查询） |

**请求 Body:**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| cards | string[13] | 是 | 13 张牌编码数组 |

**成功响应 (200):**
```json
{
  "head": ["AS", "KS", "QS"],
  "mid": ["TH", "TH", "TC", "9D", "8S"],
  "tail": ["AH", "KH", "QH", "JH", "9H"],
  "headName": "高牌",
  "midName": "三条",
  "tailName": "同花",
  "totalScore": 15,
  "valid": true
}
```

**业务逻辑:**
1. 验证恰好 13 张牌、编码合法、无重复
2. 调用 `autoArrange()` 算法：暴力搜索 C(13,3) × C(10,5) = 72072 种组合
3. 策略优先级：尾道最强 → 总分最高 → 中道最强
4. `valid` 表示是否满足 尾道 >= 中道 >= 头道 的合法性约束

**错误响应:**
- `400` — `{ error: "需要13张牌" }` 或 `{ error: "无效的牌: XX" }` 或 `{ error: "牌不能重复" }`
- `500` — `{ error: "自动摆牌失败" }`

---

## POST /api/thirteen/:gameId/save-draft

保存摆牌草稿（轻量自动保存，前端 debounce 1 秒触发）。

**路径参数:**

| 参数 | 类型 | 说明 |
|------|------|------|
| gameId | UUID | 游戏ID |

**请求 Body:**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| userId | string (UUID) | 是 | 用户ID |
| roundId | string (UUID) | 是 | 轮次ID |
| headCards | string[] | 是 | 头道牌（0~3张） |
| midCards | string[] | 是 | 中道牌（0~5张） |
| tailCards | string[] | 是 | 尾道牌（0~5张） |

**成功响应 (200):**
```json
{ "ok": true }
```

或已确认时跳过：
```json
{ "ok": true, "skipped": true }
```

**业务逻辑:**
1. 基本上限校验（头 <=3, 中 <=5, 尾 <=5）
2. 验证轮次存在且 `status === 'arranging'`
3. 如果该玩家已确认（`is_confirmed=true`），不允许覆盖，返回 `skipped: true`
4. Upsert `thirteen_hands`，`is_confirmed=false`，`onConflict: 'round_id,user_id'`
5. **不做**乌龙检测和牌型评估（轻量接口）

**错误响应:**
- `400` — `{ error: "缺少必要参数" }` 或 `{ error: "牌数量超限" }` 或 `{ error: "当前不在摆牌阶段" }`
- `500` — `{ error: "保存草稿失败" }`

---

## POST /api/thirteen/:gameId/submit-hand

提交摆牌（确认，不可撤回）。

**路径参数:**

| 参数 | 类型 | 说明 |
|------|------|------|
| gameId | UUID | 游戏ID |

**请求 Body:**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| userId | string (UUID) | 是 | 用户ID |
| roundId | string (UUID) | 是 | 轮次ID |
| headCards | string[] | 是 | 头道牌（0~3张） |
| midCards | string[] | 是 | 中道牌（0~5张） |
| tailCards | string[] | 是 | 尾道牌（0~5张） |

**成功响应 (200):**
```json
{
  "hand": {
    "id": "uuid",
    "round_id": "uuid",
    "user_id": "uuid",
    "head_cards": ["AS", "KS", "QS"],
    "mid_cards": ["TH", "TH", "TC", "9D", "8S"],
    "tail_cards": ["AH", "KH", "QH", "JH", "9H"],
    "is_confirmed": true,
    "is_foul": false,
    "special_hand": null,
    "confirmed_at": "ISO8601"
  },
  "isFoul": false,
  "specialHand": null,
  "allConfirmed": true,
  "confirmedCount": 4,
  "totalPlayers": 4
}
```

**业务逻辑:**
1. 验证牌数量：头道 <=3, 中道 <=5, 尾道 <=5, 总计 >=1
2. 验证牌编码合法（`isValidCard`）、无重复
3. 验证用户是该游戏的成员（`getGamePlayers`）
4. 验证轮次 `status === 'arranging'`
5. **牌型评估与乌龙检测:**
   - `evaluateHead(headCards)` + `evaluateLane(midCards, 'mid')` + `evaluateLane(tailCards, 'tail')`
   - `validateArrangement(head, mid, tail)` — 必须 尾道 >= 中道 >= 头道
   - 不满足则 `isFoul = true`
6. **报到牌型检测（非乌龙时）:**
   - `detectSpecialHand(allCards)` — 检查特殊牌型（如一条龙等）
   - `checkThreeFlush(head, mid, tail)` — 三同花
   - `checkThreeStraight(head, mid, tail)` — 三顺子
7. Upsert `thirteen_hands`，`is_confirmed=true`，设置 `confirmed_at`
8. 统计 `confirmedCount`，判断是否 `allConfirmed`（确认数 >= 玩家数）

**错误响应:**
- `400` — `{ error: "缺少必要参数" }` 或 `{ error: "头道最多3张牌" }` 或 `{ error: "至少选1张牌" }` 或 `{ error: "无效的牌: XX" }` 或 `{ error: "牌不能重复" }` 或 `{ error: "当前轮次不在摆牌阶段" }`
- `403` — `{ error: "你不是该房间的成员" }`
- `404` — `{ error: "轮次不存在" }`
- `500` — `{ error: "提交摆牌失败" }`

---

## POST /api/thirteen/:gameId/settle

结算当前轮次。

**路径参数:**

| 参数 | 类型 | 说明 |
|------|------|------|
| gameId | UUID | 游戏ID |

**请求 Body:**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| userId | string (UUID) | 是 | 用户ID（必须是房间成员） |
| roundId | string (UUID) | 是 | 轮次ID |

**成功响应 (200) — 新结算:**
```json
{
  "settlement": {
    "players": [
      {
        "userId": "uuid",
        "rawScore": 12,
        "finalScore": 24,
        "gunsFired": 1,
        "homerun": false,
        "laneScores": [
          { "lane": "head", "userId": "uuid", "opponentId": "uuid2", "score": 1, "detail": "..." },
          { "lane": "mid", "userId": "uuid", "opponentId": "uuid2", "score": 1, "detail": "..." },
          { "lane": "tail", "userId": "uuid", "opponentId": "uuid2", "score": -1, "detail": "..." }
        ]
      }
    ]
  }
}
```

**成功响应 (200) — 已结算（重连恢复）:**
```json
{
  "settlement": { "players": [...] },
  "alreadyFinished": true
}
```

**业务逻辑:**
1. 验证用户是房间成员
2. **已完成轮次:** 如果 `round.status === 'finished'`，直接从 `thirteen_totals` + `thirteen_scores` 重建结算结果返回，附带 `alreadyFinished: true`
3. **CAS 锁:** 将状态从 `arranging/settling/revealing` 更新为 `settling`（防并发）
4. **清理残留:** 删除该轮次已有的 `thirteen_scores` 和 `thirteen_totals`（处理中断重试场景）
5. **全员确认检查:** 如果 `confirmedCount < players.length`，回滚状态为 `arranging` 并报错
6. 构建 `PlayerHand[]` 数据，调用 `settleRound(playerHands, ghostMultiplier, baseScore, compareSuit)`
7. 写入 `thirteen_scores`（逐道逐对明细）
8. 写入 `thirteen_totals`（每人汇总，upsert `onConflict: 'round_id,user_id'`）
9. 更新轮次 `status='finished'`，设置 `finished_at`

**结算引擎参数:**
- `ghostMultiplier`: 来自 `round.ghost_multiplier`（默认 1）
- `baseScore`: 来自 `config.thirteen_base_score`（默认 1）
- `compareSuit`: 来自 `config.thirteen_compare_suit`（默认 true）

**错误响应:**
- `400` — `{ error: "缺少必要参数" }` 或 `{ error: "还有N位玩家未确认摆牌", confirmed, total }`
- `403` — `{ error: "你不是该房间的成员" }`
- `404` — `{ error: "房间不存在" }` 或 `{ error: "轮次不存在" }`
- `500` — `{ error: "获取手牌数据失败" }` 或 `{ error: "写入结算明细失败", detail }` 或 `{ error: "写入结算汇总失败", detail }`

---

## GET /api/thirteen/:gameId/round/:roundId

获取某轮的详细信息（含所有手牌、得分）。

**路径参数:**

| 参数 | 类型 | 说明 |
|------|------|------|
| gameId | UUID | 游戏ID |
| roundId | UUID | 轮次ID |

**成功响应 (200):**
```json
{
  "round": {
    "id": "uuid",
    "round_number": 3,
    "status": "finished",
    "public_cards": ["JK1", "AS"],
    "ghost_count": 1,
    "ghost_multiplier": 2
  },
  "hands": [
    {
      "id": "uuid",
      "round_id": "uuid",
      "user_id": "uuid",
      "head_cards": [...],
      "mid_cards": [...],
      "tail_cards": [...],
      "is_confirmed": true,
      "is_foul": false,
      "special_hand": null,
      "users": { "id": "uuid", "username": "昵称" }
    }
  ],
  "scores": [
    { "id": "uuid", "round_id": "uuid", "user_id": "uuid", "opponent_id": "uuid2", "lane": "head", "score": 1, "detail": "..." }
  ],
  "totals": [
    {
      "round_id": "uuid",
      "user_id": "uuid",
      "raw_score": 6,
      "final_score": 12,
      "guns_fired": 1,
      "homerun": false,
      "users": { "id": "uuid", "username": "昵称" }
    }
  ]
}
```

**业务逻辑:**
- `hands` 关联 `users(id, username)`
- `totals` 关联 `users(id, username)`
- 返回该轮的所有数据，供前端 CompareAnimation 回放使用

**错误响应:**
- `404` — `{ error: "轮次不存在" }`
- `500` — `{ error: "服务器内部错误" }`

---

## GET /api/thirteen/:gameId/history

获取该游戏的所有轮次历史。

**路径参数:**

| 参数 | 类型 | 说明 |
|------|------|------|
| gameId | UUID | 游戏ID |

**成功响应 (200):**
```json
{
  "rounds": [
    {
      "id": "uuid",
      "round_number": 1,
      "status": "finished",
      "public_cards": [...],
      "ghost_count": 2,
      "ghost_multiplier": 4,
      "totals": [
        {
          "round_id": "uuid",
          "user_id": "uuid",
          "raw_score": 6,
          "final_score": 24,
          "guns_fired": 0,
          "homerun": false,
          "users": { "id": "uuid", "username": "昵称" }
        }
      ]
    }
  ]
}
```

**业务逻辑:**
1. 获取所有轮次，按 `round_number ASC` 排序
2. 批量获取所有轮次的 `thirteen_totals`（关联 `users`），按 `round_id` 分组
3. 将 `totals` 数组挂载到对应轮次对象上

**错误响应:**
- `500` — `{ error: "获取历史失败" }`

---

## GET /api/thirteen/:gameId/totals

获取该游戏的累计总分（所有已完成轮次汇总）。

**路径参数:**

| 参数 | 类型 | 说明 |
|------|------|------|
| gameId | UUID | 游戏ID |

**成功响应 (200):**
```json
{
  "totals": [
    {
      "userId": "uuid",
      "username": "昵称",
      "totalScore": 48,
      "totalGuns": 3,
      "homeruns": 1,
      "rounds": 5
    }
  ],
  "roundCount": 5
}
```

**业务逻辑:**
1. 获取所有 `status='finished'` 的轮次 ID
2. 获取这些轮次的所有 `thirteen_totals`（含用户名）
3. 按 `user_id` 聚合：累加 `final_score`、`guns_fired`，统计 `homerun` 次数和参与轮数
4. 按 `totalScore DESC` 排序

**错误响应:**
- `500` — `{ error: "服务器内部错误" }`

---

## GET /api/thirteen/:gameId/state

获取当前游戏状态（进入房间时同步进度用）。

**路径参数:**

| 参数 | 类型 | 说明 |
|------|------|------|
| gameId | UUID | 游戏ID |

**成功响应 (200):**
```json
{
  "activeRound": {
    "id": "uuid",
    "round_number": 3,
    "status": "arranging",
    "public_cards": ["JK1"],
    "ghost_count": 1,
    "ghost_multiplier": 2
  },
  "hands": [
    {
      "id": "uuid",
      "user_id": "uuid",
      "head_cards": [...],
      "mid_cards": [...],
      "tail_cards": [...],
      "is_confirmed": false,
      "users": { "id": "uuid", "username": "昵称" }
    }
  ],
  "finishedRounds": 2,
  "playerTotals": {
    "uuid1": 24,
    "uuid2": -12,
    "uuid3": -12
  },
  "totalPlayers": 3
}
```

**业务逻辑:**
1. 查找未完成的轮次（`status != 'finished'`）作为 `activeRound`，无则返回 `null`
2. 如果有活跃轮次，获取该轮所有 `thirteen_hands`（含用户名），用于恢复草稿
3. 统计已完成轮次数 `finishedRounds`
4. 计算累计总分 `playerTotals`: `{userId: totalFinalScore}`，聚合所有已完成轮次的 `thirteen_totals.final_score`
5. 获取当前玩家总数 `totalPlayers`

**错误响应:**
- `500` — `{ error: "服务器内部错误" }`
