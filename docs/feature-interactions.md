# 趣味互动

> 面向 AI 助手的功能参考文档

## 概述

趣味互动系统集成在 `GameRoom.tsx` 中，通过 Supabase Broadcast 实现多端实时同步。包含催促计时器、趣味动画特效、幸运手牌三大模块。

## 催促计时器

文件: `src/components/ShameTimerOverlay.tsx` (~257行)

### 两种模式

**主持模式(发起者)**:
1. 选择预设时长: 30s / 1min / 2min / 3min
2. 广播 `timer_start` 事件
3. 本地开始倒计时

**观看模式(其他人)**:
1. 从广播接收 `startedAt` + `totalSeconds`
2. 本地计算剩余时间，同步显示

### UI 组件
- 圆环进度条
- 嵌入 Hourglass 沙漏组件(size=90)
- 居中倒计时数字

### 颜色变化
- 琥珀色: 剩余 >30s
- 橙色: 剩余 ≤30s
- 红色: 剩余 ≤10s

## 被催促效果 (GameRoom.tsx)

### 头像标记
- 发光环: `ring-2 ring-amber-400` + ping 动画
- 右下角迷你进度环: 24x24 SVG，显示剩余秒数 + 弧形进度，颜色同步变化

### 全屏警告 (≤10s)
- 全屏红色边缘闪烁: `animate-shame-edge-glow`
- 时间到: 更强烈红色闪烁 `animate-shame-edge-glow-intense`

## 广播机制

```
发起者
  → broadcastTimerStart({
      targetUserId,
      targetUsername,
      startedBy,
      startedByUsername,
      totalSeconds,
      startedAt
    })
  ↓ Supabase Broadcast Channel
  ↓ event: timer_start
所有人
  → setActiveTimer(data)
  → 头像标记 + 被催促者看到红光警告
  ↓
结束/取消
  → broadcastTimerStop({ targetUserId })
  ↓ event: timer_stop
所有人
  → setActiveTimer(null)
```

## 趣味互动动画

所有互动通过 Supabase Broadcast `interaction` 事件同步给所有玩家。

### 扔鸡蛋

文件: `src/components/EggThrowAnimation.tsx` (~187行)

- 鸡蛋从屏幕外飞向目标头像位置
- 碎裂特效

### 抓鸡

文件: `src/components/ChickenCatchAnimation.tsx` (~167行)

- 鸡从目标头像位置飞出
- 捕捉动画

### 送花

文件: `src/components/FlowerAnimation.tsx` (~163行)

- 花朵飘向目标位置

### 记录
- 互动记录写入 `shame_timers` 表
- type 字段: `egg` / `chicken` / `flower`

## 幸运手牌系统

### 核心组件

| 文件 | 说明 |
|------|------|
| `src/components/LuckyHandFAB.tsx` (~266行) | 浮动操作按钮，配置/提交入口 |
| `src/components/LuckyHandsTVDashboard.tsx` (~214行) | TV大屏模式，展示所有玩家手牌+中奖状态 |
| `src/components/LuckyHandCelebration.tsx` (~193行) | 全屏庆祝动画 |

### 流程

1. **房间配置**: 创建房间时设置 `lucky_hands_count` (0/1/2/3 手)
2. **玩家配置**: 每位玩家在 FAB 中配置自己的幸运手牌组合(如 AKs, QQo)
3. **中奖提交**: 牌局中出现配对手牌 → 提交中奖申请(`hit-submit`)
4. **房主审核**:
   - 非房主: 房主审核通过(`hit-approve`)
   - 房主自己: 直接确认(`hit-direct`)
5. **庆祝**: 中奖 → `LuckyHandCelebration` 全屏庆祝动画

### TV大屏模式
- `LuckyHandsTVDashboard`: 全屏展示所有玩家手牌配置 + 中奖状态
- 适合投屏到电视/大屏幕，线下牌局时所有人可见

## 触发入口

所有互动功能的触发入口在 `GameRoom.tsx` 中:
- **长按玩家头像** → `PlayerActionPopup` 弹出菜单
  - 催促(计时器)
  - 扔鸡蛋
  - 抓鸡
  - 送花
- **FAB 浮动按钮** → 幸运手牌配置/提交
