# 十三水房间

> 面向 AI 助手的功能参考文档

## 功能概述

线下十三水积分辅助工具。玩家线下打牌，在 App 中手动选牌录入手牌，系统自动比牌计分结算。**纯积分制，无买入/筹码**。

核心文件:
- 前端: `src/pages/ThirteenWaterRoom.tsx` (~1023行) + `src/pages/thirteen/` (8个子模块)
- 后端引擎: `server/lib/thirteen/` (deck.ts, hands.ts, scoring.ts, arrange.ts)

## 十三水规则

- **人数**: 2~4人
- **牌组**: 58张牌 — 52标准牌 + 6鬼牌(JK1-JK3大王/黑, JK4-JK6小王/红)
- **手牌**: 每人选13张牌，排成三道:
  - 头道: 3张
  - 中道: 5张
  - 尾道: 5张
- **牌力约束**: 尾道 >= 中道 >= 头道，违反则乌龙(0分)
- **公共牌**: 房主选0~6张，含鬼牌触发翻倍 `2^n`
- **牌编码**: `{rank}{suit}` — ranks: 2-9,T,J,Q,K,A; suits: S(♠)/H(♥)/C(♣)/D(♦); 鬼牌: JK1-JK6

## 牌型定义

文件: `server/lib/thirteen/hands.ts` (~559行)

### 头道(3张)
高牌 < 一对 < 三条

### 中/尾道(5张)
高牌 < 一对 < 两对 < 三条 < 顺子 < 同花 < 葫芦 < 四条 < 同花顺 < 五条

### 鬼牌处理
- 鬼牌可替换为任意牌
- 引擎枚举所有可能替换，找最优牌型

### 特殊牌型(13张整手)
青龙 / 一条龙 / 六对半 / 三同花 / 三顺子

## 结算流程

文件: `server/lib/thirteen/scoring.ts` (~471行)

1. **两两逐道比较** → 每道: 赢+1 / 输-1 / 平0
2. **打枪检测**: 赢对手三道全部 → 该对手分数翻倍
3. **全垒打检测**: 打枪所有对手 → 所有分数再翻倍
4. **鬼牌倍率**: `final_score = raw_score * ghost_multiplier`
5. **底分倍率**: `final_score *= base_score`
6. **零和验证**: 所有玩家 final_score 之和必须 = 0

结算顺序: 普通道分 → 打枪 → 全垒打 → 鬼牌翻倍 → 底分

## 自动摆牌算法

文件: `server/lib/thirteen/arrange.ts` (~155行)

- 暴力搜索 `C(13,3) × C(10,5) = 72072` 种组合
- 策略优先级: 尾道最强优先 → 总分最高 → 中道最强
- 合法性校验: 尾道 >= 中道 >= 头道

## 游戏流程

```
等待阶段
  → 房主开始新一轮
  → 设置公共牌(房主选0~6张)
  → 摆牌阶段(所有人选13张牌摆三道)
  → 全员确认提交
  → 比牌动画(CompareAnimation)
  → 积分面板(ScoreBoard)
  → 下一轮或结束
```

## 前端子模块

目录: `src/pages/thirteen/`

| 文件 | 说明 |
|------|------|
| `types.ts` | 类型定义 (RoundState, HandState, TableProps 等) |
| `PokerCard.tsx` | 牌面组件 — 标准牌文字渲染 + 鬼牌CDN图片 |
| `CardPicker.tsx` | 选牌器 — CardPickerModal + PublicCardPickerModal |
| `GameUI.tsx` | 底部操作栏 / 公共牌展示 / 我的手牌区(MyHandArea) |
| `CompareAnimation.tsx` | 比牌动画 — 逐对逐道展示，800ms间隔推进 |
| `ScoreBoard.tsx` | 积分面板 — 总分排名 + 每局明细 + 累计走势图 |
| `TwoPlayerTable.tsx` | 2人桌布局 |
| `ThreePlayerTable.tsx` | 3人桌布局 |
| `FourPlayerTable.tsx` | 4人桌布局 |

### 桌面布局规则
- 2人桌: 公共牌在中间区域，元素较大
- 3人桌: 公共牌在上方(top-[10%])，左右对手在左半屏/右半屏各自居中
- 4人桌: 标题栏显示公共牌缩略，四方位 absolute 定位，中间只显示确认状态
- 所有桌: 头道靠左对齐(items-start)，所有对手统一竖向布局(头像在上牌在下)

### 关键组件行为
- **CardPickerModal**: 摆牌顺序 头道→中道→尾道(自动切道)；选牌允许不满13张(空道=乌龙)
- **道间换牌**: 点击已摆牌选中(高亮)，再点击另一张交换位置(同道/跨道均可)
- **自动保存草稿**: debounce 1秒，断线重连恢复手牌
- **CompareAnimation**: 逐对一次性展开3道，每对显示打枪标记+小计，最终汇总排名+总分+打枪/全垒打标记；支持截图分享
- **ScoreBoard**: 总分排名 + 每局明细列表(点击可回放) + 积分账单分享海报 + 房主关闭房间按钮
- **MyHandArea**: 每道标签下方实时显示牌型名称(琥珀色/紫色)

## 实时同步

- **Supabase Realtime 订阅**: `thirteen_rounds`, `thirteen_hands`, `thirteen_scores`, `thirteen_totals` 表变更
- **断线恢复**: `GET /api/thirteen/:gameId/state`
- **摆牌草稿自动保存**: debounce 1秒写入数据库

## 后端 API 端点

文件: `server/routes/thirteen.ts` (~917行)

- `POST /start-round` — 开始新一轮
- `POST /set-public-cards` — 设置公共牌
- `POST /submit-hand` — 提交手牌
- `POST /settle` — 结算(CAS 乐观锁防并发)
- `GET /state` — 获取当前状态(断线恢复)
- `GET /history` — 历史记录
- `GET /round/:id` — 单轮详情
- `POST /auto-arrange` — 自动摆牌

### 结算防重复机制
- CAS lock: `arranging → settling` 状态转换
- `settleRound()` → 写入 scores/totals → round 状态设为 `finished`
- 强制结算按钮(兜底机制): 前端 `handleForceSettle`

## 关联文件

| 文件 | 说明 |
|------|------|
| `src/pages/ThirteenReport.tsx` | 牌局回顾报告页 (~316行) |
| `src/pages/GameHistory.tsx` | 牌局历史页 (~233行)，含"普通房间"和"十三水"两个Tab |
| `src/lib/handEval.ts` | 前端简化版牌型评估函数 (~120行) |
| `server/lib/thirteen/deck.ts` | 牌组定义、解析、鬼牌工具函数 (~85行) |
