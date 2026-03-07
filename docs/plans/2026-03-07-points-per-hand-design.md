# 每手积分额度 + 按手数购买 设计文档

## 适用范围

仅德州房间（`room_type = 'texas'`）。十三水房间有自己的底分系统（`thirteen_base_score`），不受本次改动影响。

## 数据库变更

### games 表新增字段

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `points_per_hand` | `INTEGER NOT NULL` | `100` | 每手积分额度 |
| `max_hands_per_buy` | `INTEGER NOT NULL` | `10` | 单次买入最大手数 |

旧字段 `min_buyin` / `max_buyin` 在数据库保留（有 NOT NULL DEFAULT），前端主流程不再使用。

### buy_ins 表新增字段

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `hand_count` | `INTEGER` | `NULL` | 本次买入手数（兼容旧数据可为空） |
| `points_per_hand` | `INTEGER` | `NULL` | 当时的每手积分快照（兼容旧数据可为空） |

## 创建房间（CreateGame）

- 去掉"最低买入"和"最高买入"两个输入框
- 替换为：
  - **每手积分额度**（number input，默认 100）
  - **单次最大手数**（number input，默认 10）
- 后端写入 `points_per_hand` 和 `max_hands_per_buy`

## 买入弹窗（GameRoom）

- 输入框从"金额"改为"手数"（整数，范围 1 ~ `max_hands_per_buy`）
- 实时显示换算结果，如 `3 手 = $300`
- 提交时由后端计算 `amount = handCount * pointsPerHand`
- 同时存储 `hand_count` 和 `points_per_hand` 到 `buy_ins`

## 待审核买入

- `pendingBuyInApi.submit` 改为传手数而非金额
- 后端用房间的 `points_per_hand` 计算实际金额
- 内存 pending store 增加 `handCount` / `pointsPerHand` 字段

## 代购买

- 房主代购买同样走手数输入，换算逻辑一致

## 后端校验

- 校验 `handCount` 为正整数且 `<= game.max_hands_per_buy`
- `amount = handCount * game.points_per_hand`（后端计算，不信任前端传来的 amount）

## 展示

- 买入记录时间线：`$300 (3手)` 格式
- PlayerStatsModal 同样显示手数信息
- 结账不涉及手数，保持原有逻辑

## 错误处理

- 手数超出上限：提示"单次最多买入 N 手"
- 每手积分额度为 0 或负数：创建房间时前端+后端双重校验

## 迁移说明

- `min_buyin` / `max_buyin` 字段保留，前端 handleBuyInSubmit 中的 min/max 校验去掉
- 旧房间（无 `points_per_hand`）使用默认值 100
