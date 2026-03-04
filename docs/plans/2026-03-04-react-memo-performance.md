# React.memo 性能优化实施计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 通过 React.memo / useCallback / useMemo 消除十三水房间 70-80% 的不必要重渲染

**Architecture:** 自底向上优化 — 先稳定叶子组件（PokerCard、CardBack、OpponentArea），再稳定中间层（MyHandArea、BottomActionBar、GameModals），最后精细化常量提取和计算缓存。核心策略是让 ThirteenWaterRoom 的 35 个 useState 变更不再级联传播到整棵组件树。

**Tech Stack:** React 18 memo/useCallback/useMemo, TypeScript

**验证命令:** `npx tsc --noEmit` (类型检查) + `npm run build` (构建验证)

---

## Phase 1: 高优先级 — 叶子组件 memo + 核心 useCallback/useMemo

### Task 1: PokerCard 和 CardBack 组件添加 React.memo

**Files:**
- Modify: `src/pages/thirteen/PokerCard.tsx`

**Step 1:** 在 PokerCard.tsx 中导入 memo，将 `PokerCard` 组件包装为 `React.memo`

```tsx
import { memo } from 'react';
// ... 原有代码 ...
export const PokerCard = memo(function PokerCard(props: PokerCardProps) {
  // ... 原有实现 ...
});
```

**Step 2:** 将 `CardBack` 组件包装为 `React.memo`

```tsx
export const CardBack = memo(function CardBack(props: { small?: boolean; large?: boolean }) {
  // ... 原有实现 ...
});
```

**Step 3:** 将 `OpponentArea` 组件包装为 `React.memo`

```tsx
export const OpponentArea = memo(function OpponentArea(props: OpponentAreaProps) {
  // ... 原有实现 ...
});
```

**Step 4:** 运行验证

```bash
npx tsc --noEmit
```

Expected: 无错误

---

### Task 2: ThirteenWaterRoom — confirmedUsers 从 Set 改为 Record

**Files:**
- Modify: `src/pages/ThirteenWaterRoom.tsx`

**Step 1:** 将 `useState<Set<string>>(new Set())` 改为 `useState<Record<string, boolean>>({})`

**Step 2:** 更新所有 `confirmedUsers` 的读写逻辑:
- `confirmedUsers.has(id)` → `confirmedUsers[id]`（或 `!!confirmedUsers[id]`）
- `new Set([...prev, id])` → `{ ...prev, [id]: true }`
- `confirmedUsers.size` → `Object.keys(confirmedUsers).length`
- `new Set()` → `{}`

**Step 3:** 更新 TableProps 接口中 confirmedUsers 的类型（types.ts）

**Step 4:** 更新所有子组件中对 confirmedUsers 的使用（TwoPlayerTable, ThreePlayerTable, FourPlayerTable, shared.tsx 等）

**Step 5:** 运行验证

```bash
npx tsc --noEmit
```

---

### Task 3: ThirteenWaterRoom — 核心 useMemo

**Files:**
- Modify: `src/pages/ThirteenWaterRoom.tsx`

**Step 1:** 将 `allSelectedCards` 用 useMemo 包装

```tsx
const allSelectedCards = useMemo(
  () => [...myHeadCards, ...myMidCards, ...myTailCards],
  [myHeadCards, myMidCards, myTailCards]
);
```

**Step 2:** 将 `me` 和 `opponents` 用 useMemo 包装

```tsx
const me = useMemo(() => players.find(p => p.user_id === user?.id), [players, user?.id]);
const opponents = useMemo(() => players.filter(p => p.user_id !== user?.id), [players, user?.id]);
```

**Step 3:** 将 `laneMax` 提取为模块级常量（移出组件函数体）

```tsx
// 文件顶部
const LANE_MAX = { head: 3, mid: 5, tail: 5 } as const;
```

**Step 4:** `publicCardsSet` 如果是计算值则用 useMemo

**Step 5:** 运行验证

```bash
npx tsc --noEmit
```

---

### Task 4: ThirteenWaterRoom — 核心 useCallback

**Files:**
- Modify: `src/pages/ThirteenWaterRoom.tsx`

**Step 1:** 将 `showToast` 用 useCallback 包装

```tsx
const showToast = useCallback((msg: string) => {
  setToast(msg);
  setTimeout(() => setToast(''), 2000);
}, []);
```

**Step 2:** 将以下函数用 useCallback 包装（注意正确的依赖数组）:
- `handleSelectCard` — 依赖: `activeLane`, `myHeadCards`, `myMidCards`, `myTailCards` 等
- `handleRemoveCard` — 依赖: 对应 state setter
- `handleCardTap` — 依赖: `isConfirmed`, `selectedCard`, `myHeadCards`, `myMidCards`, `myTailCards`
- `handleRearrange` — 依赖: state setters
- `handleAutoArrange` — 依赖: `game`, `isAutoArranging`, 各 cards state
- `handleSubmitHand` — 依赖: `game`, `currentRoundId`, 各 cards state
- `handleSetPublicCards` — 依赖: `game`, `currentRoundId`
- `handleCloseRoom` — 依赖: (无/极少)
- `handleCloseRoomConfirm` — 依赖: `game`
- `handleCompareClose` — 依赖: (无)
- `handleStartRound` — 依赖: `game`

**Step 3:** 运行验证

```bash
npx tsc --noEmit
```

---

### Task 5: MyHandArea 和 BottomActionBar 添加 React.memo

**Files:**
- Modify: `src/pages/thirteen/GameUI.tsx`

**Step 1:** 导入 memo，将 `MyHandArea` 组件包装为 `React.memo`

**Step 2:** 在 MyHandArea 内部，将 `evaluateLaneName` 调用结果用 useMemo 缓存

```tsx
const laneEvals = useMemo(() => ({
  head: evaluateLaneName(headCards),
  mid: evaluateLaneName(midCards),
  tail: evaluateLaneName(tailCards),
}), [headCards, midCards, tailCards]);
```

**Step 3:** 将 `BottomActionBar` 包装为 `React.memo`

**Step 4:** 运行验证

```bash
npx tsc --noEmit
```

---

### Task 6: Phase 1 构建验证 + 提交

**Step 1:** 运行完整构建验证

```bash
npx tsc --noEmit && npm run build
```

**Step 2:** 提交

```bash
git add -A
git commit -m "性能优化 Phase 1: 叶子组件 memo + useCallback/useMemo + confirmedUsers 改为 Record"
```

---

## Phase 2: 中优先级 — 中间层组件 + 计算优化

### Task 7: RoomHeader、PublicCardsCenter、PublicCardsThumbnail、SpectatorBar 添加 React.memo

**Files:**
- Modify: `src/pages/ThirteenWaterRoom.tsx` (RoomHeader)
- Modify: `src/pages/thirteen/GameUI.tsx` (PublicCardsCenter, PublicCardsThumbnail, SpectatorBar)

**Step 1:** 将 `RoomHeader` 包装为 `React.memo`

**Step 2:** 将 `PublicCardsCenter`、`PublicCardsThumbnail`、`SpectatorBar` 分别包装为 `React.memo`

**Step 3:** 运行验证

```bash
npx tsc --noEmit
```

---

### Task 8: GameModals 添加 React.memo

**Files:**
- Modify: `src/pages/thirteen/GameUI.tsx` (如果 GameModals 在此文件)
- 或 Modify: `src/pages/thirteen/shared.tsx`

**Step 1:** 将 `GameModals` 包装为 `React.memo`

注意：GameModals 接收 ~30 个 props，使用默认浅比较即可（配合 Phase 1 的 useCallback 稳定函数引用）

**Step 2:** 运行验证

```bash
npx tsc --noEmit
```

---

### Task 9: CompareAnimation 内部 useMemo 优化

**Files:**
- Modify: `src/pages/thirteen/CompareAnimation.tsx`

**Step 1:** 将 `playerMap`、`pairs`、`pairLaneScores`、`pairGunStatus`、`sorted` 用 useMemo 包装

```tsx
const playerMap = useMemo(() => {
  // ... 构建 player 映射
}, [settlement.players]);

const pairs = useMemo(() => {
  // ... 构建对战列表
}, [settlement.players]);

const sorted = useMemo(() => {
  // ... 排名排序
}, [settlement.players]);
```

**Step 2:** 运行验证

```bash
npx tsc --noEmit
```

---

### Task 10: ScoreBoard 内部 useMemo 优化

**Files:**
- Modify: `src/pages/thirteen/ScoreBoard.tsx`

**Step 1:** 将 `sorted` 排名数据用 useMemo 包装

**Step 2:** 运行验证

```bash
npx tsc --noEmit
```

---

### Task 11: Phase 2 构建验证 + 提交

**Step 1:** 运行完整构建验证

```bash
npx tsc --noEmit && npm run build
```

**Step 2:** 提交

```bash
git add -A
git commit -m "性能优化 Phase 2: 中间层组件 memo + CompareAnimation/ScoreBoard 计算缓存"
```

---

## Phase 3: 低优先级 — 精细优化

### Task 12: CardPicker 内部 Set 创建优化

**Files:**
- Modify: `src/pages/thirteen/CardPicker.tsx`

**Step 1:** 将 `selectedSet`、`otherLaneCards`、`publicSet` 用 useMemo 包装

```tsx
const selectedSet = useMemo(() => new Set(selected), [selected]);
const otherLaneCards = useMemo(() => new Set([...].flatMap(...)), [deps]);
const publicSet = useMemo(() => new Set(publicCards), [publicCards]);
```

**Step 2:** 运行验证

```bash
npx tsc --noEmit
```

---

### Task 13: Table 组件内的 Array.fill 常量提取

**Files:**
- Modify: `src/pages/thirteen/TwoPlayerTable.tsx`
- Modify: `src/pages/thirteen/ThreePlayerTable.tsx`
- Modify: `src/pages/thirteen/FourPlayerTable.tsx`
- Modify: `src/pages/thirteen/GameUI.tsx` (MyHandArea 中的 Array.fill)

**Step 1:** 将 `Array(3).fill(null)` 和 `Array(5).fill(null)` 提取为模块级常量

```tsx
const SLOTS_3 = Array(3).fill(null);
const SLOTS_5 = Array(5).fill(null);
```

**Step 2:** 替换所有内联 `Array(n).fill(null)` 为常量引用

**Step 3:** 运行验证

```bash
npx tsc --noEmit
```

---

### Task 14: CompareAnimation 粒子 style 预计算

**Files:**
- Modify: `src/pages/thirteen/CompareAnimation.tsx`

**Step 1:** 将 12 个粒子的 style 对象预计算为模块级常量数组

```tsx
const PARTICLE_STYLES = Array.from({ length: 12 }, (_, i) => ({
  left: '50%',
  top: '50%',
  animationDelay: `${i * 80}ms`,
  transform: `rotate(${i * 30}deg) translateY(-40px)`,
  opacity: 0,
}));
```

**Step 2:** 运行验证

```bash
npx tsc --noEmit
```

---

### Task 15: Phase 3 构建验证 + 提交 + 推送

**Step 1:** 运行完整构建验证

```bash
npx tsc --noEmit && npm run build
```

**Step 2:** 提交

```bash
git add -A
git commit -m "性能优化 Phase 3: CardPicker Set 缓存 + Array 常量提取 + 粒子 style 预计算"
```

**Step 3:** 推送所有 3 个 Phase 的提交

```bash
git push origin main
```

---

## 验收标准

1. `npx tsc --noEmit` 零错误
2. `npm run build` 成功
3. 所有 React.memo 组件正确渲染，无功能回归
4. 选牌、切道、确认、结算等核心流程正常工作
