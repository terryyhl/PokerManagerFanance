# 德州扑克房间

> 面向 AI 助手的功能参考文档

## 功能概述

德州扑克俱乐部**线下财务管理**工具。不是线上扑克游戏（无发牌/下注），而是管理买入、筹码、结算的辅助 App。

核心文件: `src/pages/GameRoom.tsx` (~1594行)

## 创建房间流程

1. 用户在 `CreateGame.tsx` 填写: 房间名、盲注级别(默认1/2)、买入范围(100-400)、是否带入审核、幸运手牌数量(0/1/2/3)
2. `POST /api/games` → 返回房间码(6位数字)
3. 创建者自动加入

## 房间内功能

### 玩家列表
- 顶部横向滚动头像条
- 显示玩家状态: 房主标记 / 已结账 / 被催促

### 买入系统
- **直接买入**: 玩家直接买入，无需审核
- **审核模式**: 非房主提交待审核申请，房主批准/拒绝

### 结账
- 玩家输入最终筹码
- 防重复结账
- 全员结账后自动结算关闭房间

### 密码门禁
- 6位数字密码输入键盘

### 旁观者模式
- 未加入的用户可旁观房间

### 结算报告
- 文件: `src/pages/SettlementReport.tsx`
- 盈亏统计 + 买入走势折线图(recharts) + 分享海报

## 互动系统（在 GameRoom 中集成）

- **长按头像** → `PlayerActionPopup` 弹出操作菜单
- **催促计时器**: `ShameTimerOverlay`（主持/观看两种模式）
- **趣味互动**: 扔鸡蛋/抓鸡/送花 动画特效
- **幸运手牌**: `LuckyHandFAB` 浮动按钮 + TV大屏模式

详见 [feature-interactions.md](./feature-interactions.md)

## 实时通信

### Supabase Broadcast Channel
- `timer_start` — 催促计时器开始
- `timer_stop` — 催促计时器停止
- `interaction` — 趣味互动事件

### SSE (Server-Sent Events)
- `connected` — 连接建立
- `pending_list` — 待审核列表更新
- `buyin_request` — 买入申请
- `buyin_approved` — 买入批准
- `buyin_rejected` — 买入拒绝
- `game_refresh` — 房间数据刷新
- `game_settled` — 房间结算完成

## 工具按钮扇形面板

- 右下角 ⚙️ 按钮，animejs 展开扇形子按钮
- 子功能:
  - 牌局时钟
  - 邀请码
  - 积分面板(仅十三水房间)

## 关键数据流

```
用户加入 → SSE 连接 → 实时接收事件
买入 → POST /api/buyin → DB → SSE 广播 game_refresh
结账 → POST /api/buyin/checkout → 检查全员 → 自动结算
结算 → POST /api/settlement → 写入 settlements → 标记 finished
```

## 关联文件

| 文件 | 说明 |
|------|------|
| `src/pages/GameRoom.tsx` | 房间主页面，状态管理 + 核心逻辑 |
| `src/pages/CreateGame.tsx` | 创建房间表单 |
| `src/pages/SettlementReport.tsx` | 结算报告(含买入走势图) |
| `server/routes/games.ts` | 游戏房间 API (~395行) |
| `server/routes/settlement.ts` | 结算 API |
| `src/lib/api.ts` | 前端 API 封装 |
