# 数据库 Schema 详解

> 本文档面向 AI 助手，作为数据库结构参考。数据库使用 Supabase (PostgreSQL)。

---

## 核心表（10 张）

### 1. users — 用户表

| 列 | 类型 | 约束 | 说明 |
|---|---|---|---|
| id | UUID | PK, DEFAULT gen_random_uuid() | 用户 ID |
| username | TEXT | UNIQUE, NOT NULL | 用户名 |
| created_at | TIMESTAMPTZ | DEFAULT now() | 创建时间 |

### 2. games — 游戏房间表

| 列 | 类型 | 约束 | 说明 |
|---|---|---|---|
| id | UUID | PK, DEFAULT gen_random_uuid() | 房间 ID |
| name | TEXT | NOT NULL | 房间名称 |
| room_type | TEXT | `'texas'` / `'thirteen'` | 房间类型 |
| blind_level | TEXT | | 盲注级别（德州） |
| min_buyin | INTEGER | | 最小买入（德州） |
| max_buyin | INTEGER | | 最大买入（德州） |
| insurance_mode | TEXT | | 保险模式（德州） |
| lucky_hands_count | INTEGER | | 幸运手牌数量（德州） |
| thirteen_base_score | INTEGER | | 底分（十三水） |
| thirteen_ghost_count | INTEGER | | 鬼牌数量（十三水） |
| thirteen_compare_suit | BOOLEAN | | 是否比花色（十三水） |
| thirteen_max_players | INTEGER | 2-4 | 最大玩家数（十三水） |
| thirteen_time_limit | INTEGER | | 摆牌时限秒数（十三水） |
| room_code | TEXT(6) | UNIQUE | 6 位房间码 |
| password | TEXT | | 房间密码 |
| status | TEXT | `'active'` / `'finished'` | 房间状态 |
| created_by | UUID | FK → users.id | 房主 |
| created_at | TIMESTAMPTZ | DEFAULT now() | 创建时间 |
| finished_at | TIMESTAMPTZ | | 关闭时间 |

### 3. game_players — 房间玩家关系表

| 列 | 类型 | 约束 | 说明 |
|---|---|---|---|
| id | UUID | PK | |
| game_id | UUID | FK → games.id | 房间 ID |
| user_id | UUID | FK → users.id | 玩家 ID |
| joined_at | TIMESTAMPTZ | DEFAULT now() | 加入时间 |

**唯一约束**: `UNIQUE(game_id, user_id)`

### 4. buy_ins — 买入记录表（德州）

| 列 | 类型 | 约束 | 说明 |
|---|---|---|---|
| id | UUID | PK | |
| game_id | UUID | FK → games.id | 房间 ID |
| user_id | UUID | FK → users.id | 玩家 ID |
| amount | INTEGER | NOT NULL | 金额 |
| type | TEXT | `'initial'` / `'rebuy'` / `'checkout'` | 买入类型 |
| created_at | TIMESTAMPTZ | DEFAULT now() | 记录时间 |

### 5. settlements — 结算表（德州）

| 列 | 类型 | 约束 | 说明 |
|---|---|---|---|
| id | UUID | PK | |
| game_id | UUID | FK → games.id | 房间 ID |
| user_id | UUID | FK → users.id | 玩家 ID |
| total_buyin | INTEGER | | 总买入 |
| final_chips | INTEGER | | 最终筹码 |
| net_profit | INTEGER | | 净盈亏 |

**唯一约束**: `UNIQUE(game_id, user_id)`

### 6. lucky_hands — 幸运手牌表（德州）

| 列 | 类型 | 约束 | 说明 |
|---|---|---|---|
| id | UUID | PK | |
| game_id | UUID | FK → games.id | 房间 ID |
| user_id | UUID | FK → users.id | 玩家 ID |
| hand_index | INTEGER | 1 / 2 / 3 | 手牌槽位 |
| card_1 | TEXT | | 组合描述，如 `'AKs'` |
| card_2 | TEXT | | 第二张牌描述 |
| hit_count | INTEGER | DEFAULT 0 | 命中次数 |

**唯一约束**: `UNIQUE(game_id, user_id, hand_index)`

### 7. pending_lucky_hits — 待审幸运手牌命中表

| 列 | 类型 | 约束 | 说明 |
|---|---|---|---|
| id | UUID | PK | |
| game_id | UUID | FK → games.id | 房间 ID |
| user_id | UUID | FK → users.id | 玩家 ID |
| lucky_hand_id | UUID | FK → lucky_hands.id | 关联的幸运手牌 |
| request_type | TEXT | `'hit'` / `'update'` | 请求类型 |
| new_card_1 | TEXT | | 新的牌组合 1 |
| new_card_2 | TEXT | | 新的牌组合 2 |
| created_at | TIMESTAMPTZ | DEFAULT now() | 创建时间 |

### 8. shame_timers — 催促计时器/互动表

| 列 | 类型 | 约束 | 说明 |
|---|---|---|---|
| id | UUID | PK | |
| game_id | UUID | FK → games.id | 房间 ID |
| target_user_id | UUID | FK → users.id | 被催促的玩家 |
| started_by | UUID | FK → users.id | 发起者 |
| type | TEXT | `'timer'` / `'egg'` / `'chicken'` / `'flower'` | 互动类型 |
| duration_seconds | INTEGER | | 持续时间（秒） |
| created_at | TIMESTAMPTZ | DEFAULT now() | 创建时间 |

---

## 十三水专属表（4 张）

### 9. thirteen_rounds — 十三水轮次表

| 列 | 类型 | 约束 | 说明 |
|---|---|---|---|
| id | UUID | PK, DEFAULT gen_random_uuid() | 轮次 ID |
| game_id | UUID | FK → games.id | 房间 ID |
| round_number | INTEGER | NOT NULL | 局号 |
| status | TEXT | `'arranging'` / `'revealing'` / `'settling'` / `'settled'` / `'finished'` | 轮次状态 |
| public_cards | JSONB | | 公共牌数组，如 `["AS","JK1"]` |
| ghost_count | INTEGER | | 公共牌中鬼牌数 |
| ghost_multiplier | INTEGER | | 鬼牌倍率 = 2^ghost_count |
| created_at | TIMESTAMPTZ | DEFAULT now() | 开始时间 |
| finished_at | TIMESTAMPTZ | | 结束时间 |

**唯一约束**: `UNIQUE(game_id, round_number)`

### 10. thirteen_hands — 十三水玩家手牌表

| 列 | 类型 | 约束 | 说明 |
|---|---|---|---|
| id | UUID | PK | |
| round_id | UUID | FK → thirteen_rounds.id | 轮次 ID |
| user_id | UUID | FK → users.id | 玩家 ID |
| head_cards | JSONB | | 头道 3 张牌，如 `["AS","KS","QS"]` |
| mid_cards | JSONB | | 中道 5 张牌 |
| tail_cards | JSONB | | 尾道 5 张牌 |
| is_confirmed | BOOLEAN | DEFAULT false | 是否已确认提交 |
| is_foul | BOOLEAN | DEFAULT false | 是否乌龙（牌力不满足头<中<尾） |
| special_hand | TEXT | NULL | 特殊牌型名称（如有） |
| confirmed_at | TIMESTAMPTZ | | 确认时间 |

**唯一约束**: `UNIQUE(round_id, user_id)`

### 11. thirteen_scores — 十三水逐道得分明细表

| 列 | 类型 | 约束 | 说明 |
|---|---|---|---|
| id | UUID | PK | |
| round_id | UUID | FK → thirteen_rounds.id | 轮次 ID |
| user_id | UUID | | 玩家 ID |
| opponent_id | UUID | | 对手 ID |
| lane | TEXT | `'head'` / `'mid'` / `'tail'` / `'special'` / `'gun'` / `'homerun'` / `'ghost'` | 道次/特殊标记 |
| score | INTEGER | | 得分 |
| detail | TEXT | | 得分明细描述 |

### 12. thirteen_totals — 十三水每轮汇总表

| 列 | 类型 | 约束 | 说明 |
|---|---|---|---|
| id | UUID | PK | |
| round_id | UUID | FK → thirteen_rounds.id | 轮次 ID |
| user_id | UUID | FK → users.id | 玩家 ID |
| raw_score | INTEGER | | 原始得分（打枪/全垒打前） |
| final_score | INTEGER | | 最终得分 |
| guns_fired | INTEGER | | 打枪次数 |
| homerun | BOOLEAN | | 是否全垒打 |

**唯一约束**: `UNIQUE(round_id, user_id)`

---

## Realtime Publication

以下表启用了 Supabase Realtime，支持实时订阅变更：

- `lucky_hands`
- `pending_lucky_hits`
- `thirteen_rounds`
- `thirteen_hands`
- `thirteen_scores`
- `thirteen_totals`

---

## 索引

为所有外键和常用查询字段建立了 **约 15 个索引**，包括但不限于：

- `game_players(game_id)`, `game_players(user_id)`
- `buy_ins(game_id)`, `buy_ins(user_id)`
- `settlements(game_id)`
- `lucky_hands(game_id)`, `lucky_hands(user_id)`
- `pending_lucky_hits(game_id)`, `pending_lucky_hits(lucky_hand_id)`
- `shame_timers(game_id)`
- `thirteen_rounds(game_id)`
- `thirteen_hands(round_id)`, `thirteen_hands(user_id)`
- `thirteen_scores(round_id)`
- `thirteen_totals(round_id)`

---

## RLS（行级安全策略）

当前 **全开放**（匿名可读写），适合原型/开发阶段。

生产环境应考虑：
- 限制用户只能读写自己的数据
- 房间密码验证在后端 API 层已实现

---

## ER 关系图（文字描述）

```
users
  ├── game_players ← games
  ├── buy_ins ← games
  ├── settlements ← games
  ├── lucky_hands ← games
  │     └── pending_lucky_hits
  ├── shame_timers ← games
  ├── thirteen_hands ← thirteen_rounds ← games
  ├── thirteen_totals ← thirteen_rounds ← games
  └── (thirteen_scores 通过 user_id/opponent_id 关联)

games (中心表)
  ├─→ game_players ←─ users
  ├─→ buy_ins ←─ users
  ├─→ settlements ←─ users
  ├─→ lucky_hands ←─ users ─→ pending_lucky_hits
  ├─→ shame_timers ←─ users (target + started_by)
  └─→ thirteen_rounds
        ├─→ thirteen_hands ←─ users
        ├─→ thirteen_scores (user_id + opponent_id)
        └─→ thirteen_totals ←─ users
```

### 关系总结

| 关系 | 说明 |
|---|---|
| `games` → `game_players` → `users` | 房间-玩家多对多 |
| `games` → `buy_ins` → `users` | 买入记录 |
| `games` → `settlements` → `users` | 结算记录 |
| `games` → `thirteen_rounds` → `thirteen_hands` → `users` | 十三水轮次→手牌 |
| `thirteen_rounds` → `thirteen_scores` | 十三水逐道得分明细 |
| `thirteen_rounds` → `thirteen_totals` → `users` | 十三水每轮汇总 |
| `games` → `lucky_hands` → `users` → `pending_lucky_hits` | 幸运手牌及待审 |
| `games` → `shame_timers` → `users` | 催促/互动（target + starter 双 FK） |
