# 用户/排行榜 API

> 源码: `server/routes/users.ts` (461行)
> 挂载路径: `/api/users`

---

## POST /api/users/login

用户登录（无密码，用户名即身份）。

**请求 Body:**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| username | string | 是 | 用户昵称（1~20 字符，自动 trim） |

**成功响应 (200):**
```json
{
  "user": {
    "id": "uuid",
    "username": "昵称",
    "created_at": "ISO8601"
  }
}
```

**业务逻辑:**
1. 验证 `username` 为非空字符串，trim 后长度 1~20
2. Upsert `users` 表（`onConflict: 'username'`）：已存在返回现有记录，否则创建新用户
3. 无密码机制，同名用户共享同一账户

**错误响应:**
- `400` — `{ error: "昵称不能为空" }` 或 `{ error: "昵称不能超过20个字符" }`
- `500` — `{ error: "登录失败，请重试" }`

---

## GET /api/users/leaderboard

德州扑克战绩排行榜。

**参数:** 无

**成功响应 (200):**
```json
{
  "leaderboard": [
    {
      "userId": "uuid",
      "username": "昵称",
      "totalGames": 10,
      "totalProfit": 2500,
      "totalBuyIn": 5000,
      "winCount": 6,
      "biggestWin": 800,
      "biggestLoss": -300,
      "winRate": 60,
      "avgProfit": 250
    }
  ]
}
```

**业务逻辑:**
1. 查询 `settlements` 表全量数据，join `users(id, username)`
2. 按 `user_id` 内存聚合：
   - `totalGames`: 结算记录数
   - `totalProfit`: 累加 `net_profit`
   - `totalBuyIn`: 累加 `total_buyin`
   - `winCount`: `net_profit > 0` 的场次
   - `biggestWin`: 最大正盈利
   - `biggestLoss`: 最大负盈利（存为负数）
3. 衍生计算：
   - `winRate = round((winCount / totalGames) * 100)`（百分比整数）
   - `avgProfit = round(totalProfit / totalGames)`
4. 按 `totalProfit DESC` 排序

**错误响应:**
- `500` — `{ error: "获取排行榜失败" }`

**注意:** 此路由必须在 `/:id/stats` 之前定义，否则 `"leaderboard"` 会被当作 `:id` 参数匹配。

---

## GET /api/users/thirteen-leaderboard

十三水全局排行榜。

**参数:** 无

**成功响应 (200):**
```json
{
  "leaderboard": [
    {
      "userId": "uuid",
      "username": "昵称",
      "totalGames": 5,
      "totalRounds": 25,
      "totalScore": 120,
      "winRounds": 15,
      "gunCount": 8,
      "homerunCount": 2,
      "winRate": 60,
      "avgScore": 4.8
    }
  ]
}
```

**业务逻辑:**
1. 查询 `thirteen_totals` 全量，join `users(id, username)`
2. 额外查询 `thirteen_totals` join `thirteen_rounds!inner(game_id)` 统计每个用户参与的不同游戏数（`distinct game_id`）
3. 按 `user_id` 聚合：
   - `totalGames`: 不同 `game_id` 的数量
   - `totalRounds`: 总记录数
   - `totalScore`: 累加 `final_score`
   - `winRounds`: `final_score > 0` 的轮次数
   - `gunCount`: 累加 `guns_fired`
   - `homerunCount`: `homerun === true` 的轮次数
4. 衍生计算：
   - `winRate = round((winRounds / totalRounds) * 100)`
   - `avgScore = round((totalScore / totalRounds) * 10) / 10`（保留一位小数）
5. 按 `totalScore DESC` 排序

**错误响应:**
- `500` — `{ error: "获取十三水排行榜失败" }`

---

## GET /api/users/:id/stats

获取指定用户的德州扑克历史统计数据。

**路径参数:**

| 参数 | 类型 | 说明 |
|------|------|------|
| id | UUID | 用户ID |

**成功响应 (200):**
```json
{
  "stats": {
    "totalGames": 10,
    "totalProfit": 2500,
    "totalBuyIn": 5000,
    "winRate": 60
  },
  "history": [
    {
      "gameId": "uuid",
      "gameName": "周末牌局",
      "blindLevel": "1/2",
      "finishedAt": "ISO8601",
      "profit": 350,
      "finalChips": 550,
      "totalBuyIn": 200
    }
  ]
}
```

**业务逻辑:**
1. 查询 `settlements` 表，`user_id = id`，join `games(id, name, blind_level, status, created_at, finished_at)`
2. 按 `created_at DESC` 排序
3. 汇总统计：`totalGames`、`totalProfit`、`totalBuyIn`、`winRate`
4. 如果无记录，返回初始值 `{ totalGames: 0, totalProfit: 0, totalBuyIn: 0, winRate: 0 }` + 空 `history`

**错误响应:**
- `500` — `{ error: "获取统计数据失败" }`

---

## GET /api/users/:id/lucky-hands-history

获取指定用户的幸运手牌历史记录。

**路径参数:**

| 参数 | 类型 | 说明 |
|------|------|------|
| id | UUID | 用户ID |

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
      "hit_count": 3,
      "created_at": "ISO8601",
      "games": {
        "id": "uuid",
        "name": "周末牌局",
        "blind_level": "1/2",
        "status": "finished",
        "created_at": "ISO8601",
        "finished_at": "ISO8601"
      }
    }
  ]
}
```

**业务逻辑:**
- 查询 `lucky_hands` 表，`user_id = id`，join `games`
- 按 `hit_count DESC` 排序（中奖最多的排前面）

**错误响应:**
- `500` — `{ error: "获取幸运手牌历史失败" }`

---

## GET /api/users/:id/thirteen-stats

获取指定用户的十三水统计数据。

**路径参数:**

| 参数 | 类型 | 说明 |
|------|------|------|
| id | UUID | 用户ID |

**成功响应 (200):**
```json
{
  "totalGames": 5,
  "totalRounds": 25,
  "totalScore": 120,
  "winRounds": 15,
  "winRate": 60,
  "gunCount": 8,
  "homerunCount": 2
}
```

**业务逻辑:**
1. 查询 `game_players` join `games!inner`，筛选 `room_type === 'thirteen'` 的游戏
2. 查询 `thirteen_totals` join `thirteen_rounds!inner(game_id)`，筛选该用户在这些游戏中的记录
3. 聚合：`totalScore`、`winRounds`（score > 0）、`gunCount`、`homerunCount`
4. 如果无十三水游戏记录，返回全零值

**错误响应:**
- `500` — `{ error: "服务器内部错误" }`

---

## GET /api/users/:id/thirteen-history

获取指定用户的十三水牌局历史列表。

**路径参数:**

| 参数 | 类型 | 说明 |
|------|------|------|
| id | UUID | 用户ID |

**成功响应 (200):**
```json
{
  "history": [
    {
      "gameId": "uuid",
      "gameName": "十三水对战",
      "finishedAt": "ISO8601",
      "totalScore": 48
    }
  ]
}
```

**业务逻辑:**
1. 查询 `game_players` join `games!inner`，筛选 `room_type === 'thirteen'` 且 `status === 'finished'`
2. 查询 `thirteen_totals` join `thirteen_rounds!inner(game_id)`，按 `game_id` 聚合每个游戏的总分
3. 按 `finishedAt DESC` 排序
4. `totalScore` 为该用户在该游戏所有轮次中 `final_score` 的总和

**错误响应:**
- `500` — `{ error: "服务器内部错误" }`
