# 工具箱

> 面向 AI 助手的功能参考文档

## 概述

入口: `src/pages/Toolbox.tsx` (~104行)
路由: `/tools` → 工具列表页

工具箱提供多个独立的扑克辅助小工具，每个工具有独立路由和页面。

## 牌局时钟

文件: `src/pages/GameClock.tsx` (~215行)
路由: `/tools/clock`

### 功能
- 3D 沙漏 SVG 倒计时器 (使用 Hourglass 组件)
- 4档预设: 30s / 1min / 2min / 3min
- 外环进度环 + 居中沙漏 + 倒计时数字
- 重置按钮

### 颜色状态
- 蓝色: 正常倒计时
- 琥珀色: 剩余 ≤30s
- 红色: 剩余 ≤10s

### 结束效果
- 全屏红色边缘闪烁
- 振动反馈 (navigator.vibrate)

## Hourglass 沙漏组件

文件: `src/components/Hourglass.tsx` (~379行)

### Props
- `progress`: 0~1，沙漏进度
- `isRunning`: boolean，是否运行中
- `size`: px，默认180

### 渲染结构
- 纯 SVG，viewBox 180x240
- 红木框(渐变) + 蓝色透明玻璃(曲线贝塞尔) + 玻璃高光

### 沙子动画
- **上半沙子**: rect + clipPath，漏斗形凹陷(椭圆遮挡)
- **下半沙子两阶段**:
  - 0~33%: 锥体堆积
  - 33~100%: 均匀上升

### 粒子系统
- JS 粒子系统: 24个 SVG circle
- `requestAnimationFrame` 驱动
- 重力加速 + 随机漂移
- `useId()` 生成唯一 SVG id 前缀，支持多实例

## 抛硬币

文件: `src/pages/CoinFlip.tsx` (~186行)
路由: `/tools/coin`

- Lottie 动画 (`coin-flip.lottie`)
- 随机正面/反面结果

## 抽座位

文件: `src/pages/SeatDraw.tsx` (~180行)
路由: `/tools/seat`

- 输入玩家名单
- 随机分配座位号

## 骰子

文件: `src/pages/DiceRoll.tsx` (~144行)
路由: `/tools/dice`

- 模拟投骰子
- 随机结果展示

## 赔率表

文件: `src/pages/OddsChart.tsx` (~176行)
路由: `/tools/odds`

- 德州扑克常见赔率参考表

## 随机选择器

文件: `src/pages/RandomPicker.tsx` (~194行)
路由: `/tools/picker`

- 随机从列表中抽取

## 筹码计算器

文件: `src/pages/ChipCalculator.tsx` (~135行)
路由: `/tools/chips`

- 快速计算不同面值筹码总额

## 路由总览

| 路由 | 文件 | 说明 |
|------|------|------|
| `/tools` | `Toolbox.tsx` | 工具列表入口 |
| `/tools/clock` | `GameClock.tsx` | 牌局时钟 |
| `/tools/coin` | `CoinFlip.tsx` | 抛硬币 |
| `/tools/seat` | `SeatDraw.tsx` | 抽座位 |
| `/tools/dice` | `DiceRoll.tsx` | 骰子 |
| `/tools/odds` | `OddsChart.tsx` | 赔率表 |
| `/tools/picker` | `RandomPicker.tsx` | 随机选择器 |
| `/tools/chips` | `ChipCalculator.tsx` | 筹码计算器 |
