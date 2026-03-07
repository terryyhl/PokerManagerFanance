# Fix iPhone Safe Area — Top & Bottom

## Problem
1. iPhone PWA standalone 模式下，底部 safe area 留白导致界面往上移
2. 顶部状态栏/灵动岛区域有 UI 元素被遮挡无法点击

## Root Cause
- `viewport-fit=cover` + `black-translucent` 使内容延伸到安全区外
- **没有任何页面处理 `safe-area-inset-top`**，标题栏按钮被状态栏遮挡
- 底部 safe area 处理已有，问题较小

## Strategy
在每个页面/组件的**顶部标题栏 div** 上添加 `paddingTop: env(safe-area-inset-top)`。
对于已有固定高度的标题栏，同时调整 height 为 `calc(原高度 + env(safe-area-inset-top))`。

---

## Changes

### 1. 十三水桌面标题栏 (2/3/4人桌)

**TwoPlayerTable.tsx:21** — 标题栏 `h-[58px]` → inline style
```
旧: className="flex items-center justify-between px-2 h-[58px] bg-black/30 border-b border-white/5 shrink-0"
新: className="flex items-center justify-between px-2 bg-black/30 border-b border-white/5 shrink-0"
    style={{ height: 'calc(58px + env(safe-area-inset-top, 0px))', paddingTop: 'env(safe-area-inset-top, 0px)' }}
```

**ThreePlayerTable.tsx:29** — 同上

**FourPlayerTable.tsx:20** — 同上

### 2. ThirteenWaterRoom RoomHeader

**ThirteenWaterRoom.tsx:38** — RoomHeader `h-14` → inline style
```
旧: className="flex items-center px-4 h-14 border-b border-white/5 shrink-0"
新: className="flex items-center px-4 border-b border-white/5 shrink-0"
    style={{ height: 'calc(56px + env(safe-area-inset-top, 0px))', paddingTop: 'env(safe-area-inset-top, 0px)' }}
```

### 3. ThirteenWaterRoom 密码门禁

**ThirteenWaterRoom.tsx:812** — 关闭按钮 `top-6` → 改为 safe area 偏移
```
旧: className="absolute top-6 left-4 z-50"
新: className="absolute left-4 z-50" style={{ top: 'max(24px, env(safe-area-inset-top, 24px))' }}
```

### 4. MainLayout 主页面

**Lobby.tsx:80** — `pt-8` → inline style
```
旧: className="flex items-center justify-between p-5 pt-8 bg-background-light dark:bg-background-dark sticky top-0 z-10"
新: className="flex items-center justify-between p-5 bg-background-light dark:bg-background-dark sticky top-0 z-10"
    style={{ paddingTop: 'max(32px, env(safe-area-inset-top, 0px))' }}
```

**GameHistory.tsx:111** — `pt-8` → inline style
```
旧: className="flex-shrink-0 px-5 pt-8 pb-3 ..."
新: className="flex-shrink-0 px-5 pb-3 ..."
    style={{ paddingTop: 'max(32px, env(safe-area-inset-top, 0px))' }}
```

**Toolbox.tsx:78** — `pt-8` → inline style
```
旧: className="flex-shrink-0 flex items-center justify-center p-5 pt-8"
新: className="flex-shrink-0 flex items-center justify-center p-5"
    style={{ paddingTop: 'max(32px, env(safe-area-inset-top, 0px))' }}
```

**Profile.tsx:112** — `pt-8` → inline style
```
旧: className="flex-shrink-0 flex items-center justify-between p-5 pt-8 ..."
新: className="flex-shrink-0 flex items-center justify-between p-5 ..."
    style={{ paddingTop: 'max(32px, env(safe-area-inset-top, 0px))' }}
```

### 5. GameRoom (德州房)

**GameRoom.tsx:878** — header `py-3` → 增加 paddingTop safe area
```
旧: className="sticky top-0 z-20 flex items-center justify-between ... px-4 py-3"
新: className="sticky top-0 z-20 flex items-center justify-between ... px-4 pb-3"
    style={{ paddingTop: 'max(12px, env(safe-area-inset-top, 0px))' }}
```

**GameRoom.tsx:806** — 密码门禁关闭按钮 `top-6` → safe area
```
旧: className="absolute top-6 left-4 z-50"
新: className="absolute left-4 z-50" style={{ top: 'max(24px, env(safe-area-inset-top, 24px))' }}
```

### 6. Layer2 覆盖层页面

**JoinRoom.tsx:103** — header `py-4` → paddingTop safe area
```
旧: className="flex items-center px-4 py-4 justify-between ... sticky top-0 z-10"
新: className="flex items-center px-4 pb-4 justify-between ... sticky top-0 z-10"
    style={{ paddingTop: 'max(16px, env(safe-area-inset-top, 0px))' }}
```

**CreateGame.tsx:190** — header `p-4` → paddingTop safe area
```
旧: className="... p-4 sticky top-0 z-10 ..."
新: className="... px-4 pb-4 sticky top-0 z-10 ..."
    style={{ paddingTop: 'max(16px, env(safe-area-inset-top, 0px))' }}
```

**Leaderboard.tsx:145** — header `h-14` → inline style
```
旧: className="flex items-center px-4 h-14"
新: className="flex items-center px-4"
    style={{ height: 'calc(56px + env(safe-area-inset-top, 0px))', paddingTop: 'env(safe-area-inset-top, 0px)' }}
```

**ThirteenReport.tsx:139** — `pt-8` → inline style
```
旧: className="flex items-center gap-3 px-4 pt-8 pb-3 ..."
新: className="flex items-center gap-3 px-4 pb-3 ..."
    style={{ paddingTop: 'max(32px, env(safe-area-inset-top, 0px))' }}
```

**ChipCalculator.tsx:55** — header `h-14` → inline style
```
旧: className="flex-shrink-0 flex items-center px-4 h-14 ..."
新: className="flex-shrink-0 flex items-center px-4 ..."
    style={{ height: 'calc(56px + env(safe-area-inset-top, 0px))', paddingTop: 'env(safe-area-inset-top, 0px)' }}
```

**PersonalBill.tsx:87** — header `py-3` → paddingTop safe area
```
旧: className="... px-4 py-3"
新: className="... px-4 pb-3"
    style={{ paddingTop: 'max(12px, env(safe-area-inset-top, 0px))' }}
```

**SettlementReport.tsx:127** — header `p-4 pb-2` → paddingTop safe area
```
旧: className="... p-4 pb-2 ..."
新: className="... px-4 pb-2 ..."
    style={{ paddingTop: 'max(16px, env(safe-area-inset-top, 0px))' }}
```

### 7. 全屏模态组件

**CompareAnimation.tsx:146** — 标题栏 `h-12` → inline style
```
旧: className="flex items-center justify-between px-4 h-12 shrink-0"
新: className="flex items-center justify-between px-4 shrink-0"
    style={{ height: 'calc(48px + env(safe-area-inset-top, 0px))', paddingTop: 'env(safe-area-inset-top, 0px)' }}
```

**ScoreBoard.tsx:113** — 标题栏 `h-14` → inline style
```
旧: className="flex items-center justify-between px-4 h-14 border-b border-white/5 shrink-0"
新: className="flex items-center justify-between px-4 border-b border-white/5 shrink-0"
    style={{ height: 'calc(56px + env(safe-area-inset-top, 0px))', paddingTop: 'env(safe-area-inset-top, 0px)' }}
```

**CardPicker.tsx:36 (PublicCardPickerModal)** — `pt-3` → paddingTop safe area
```
旧: className="... pt-3 pb-3 px-3"
新: className="... pb-3 px-3"
    style={{ paddingTop: 'max(12px, env(safe-area-inset-top, 0px))' }}
```

**CardPicker.tsx:175 (CardPickerModal)** — `pt-3` → paddingTop safe area
```
旧: className="... pt-3 pb-3 px-3"
新: className="... pb-3 px-3"
    style={{ paddingTop: 'max(12px, env(safe-area-inset-top, 0px))' }}
```

### 8. 公开页面

**Welcome.tsx:76** — `pt-6` → paddingTop safe area
```
旧: className="relative z-10 flex w-full justify-between p-4 pt-6"
新: className="relative z-10 flex w-full justify-between p-4"
    style={{ paddingTop: 'max(24px, env(safe-area-inset-top, 0px))' }}
```

**Login.tsx:82** — header `p-4` → paddingTop safe area
```
旧: className="... p-4 sticky top-0 z-10 ..."
新: className="... px-4 pb-4 sticky top-0 z-10 ..."
    style={{ paddingTop: 'max(16px, env(safe-area-inset-top, 0px))' }}
```

---

## Verification
1. `npx tsc --noEmit` — 确保无 TypeScript 错误
2. `npm run build` — 生产构建验证
