# 前端组件库

> 面向 AI 助手的项目记忆参考文档

---

## 布局组件

| 组件 | 文件 | 行数 | Props | 说明 |
|------|------|------|-------|------|
| MainLayout | `src/components/MainLayout.tsx` | 39 | - | Keep-Alive 主布局，同时挂载 4 个 Tab 页，通过 visibility 切换 |
| AnimatedPage | `src/components/AnimatedPage.tsx` | 46 | `animationType: 'slide-left' \| 'fade'` | 页面切换动画包装器(framer-motion) |
| BottomNav | `src/components/BottomNav.tsx` | 43 | - | 底部 Tab 导航：大厅/牌局/工具/个人 |
| GameRouter | `src/components/GameRouter.tsx` | 51 | - | 根据 room_type 路由到 GameRoom 或 ThirteenWaterRoom |
| ProtectedRoute | `src/components/ProtectedRoute.tsx` | 22 | - | 路由守卫，未登录重定向 /login |

---

## 通用组件

| 组件 | 文件 | 行数 | Props | 说明 |
|------|------|------|-------|------|
| Avatar | `src/components/Avatar.tsx` | 33 | `username, isAdmin?, className?` | 生成首字母+颜色头像 |
| PokerCardDisp | `src/components/PokerCardDisp.tsx` | 22 | `card: string, size?` | 单张扑克牌文字渲染 |
| HandComboDisp | `src/components/HandComboDisp.tsx` | 88 | `combo: string` | 两张牌组合展示 |
| CardSelectorModal | `src/components/CardSelectorModal.tsx` | 184 | `onSelect, excludeCards?, initialCards?` | 德州用两张牌选择弹窗 |
| Hourglass | `src/components/Hourglass.tsx` | 379 | `progress(0-1), isRunning, size?` | 3D SVG 沙漏(粒子系统) |

---

## 德州扑克专属组件

| 组件 | 文件 | 行数 | Props | 说明 |
|------|------|------|-------|------|
| ShameTimerOverlay | `src/components/ShameTimerOverlay.tsx` | 257 | `targetUsername, targetUserId, startedByUsername, currentUserId?, startedByUserId?, onStop, onCancel, onTimerStarted?, viewerMode?, viewerStartedAt?, viewerTotalSeconds?` | 催促计时覆盖层(主持+观看模式) |
| PlayerActionPopup | `src/components/PlayerActionPopup.tsx` | 235 | `target, onBuyIn, onStartTimer, onThrowEgg, onCatchChicken, onSendFlower, isSelf` | 长按头像弹出操作菜单 |
| PlayerStatsModal | `src/components/PlayerStatsModal.tsx` | 320 | `gameId, userId, username, onClose` | 玩家在某局的详细统计弹窗 |
| SettlementSharePoster | `src/components/SettlementSharePoster.tsx` | 355 | `gameData, stats` | html2canvas 生成结算分享图 |
| LuckyHandFAB | `src/components/LuckyHandFAB.tsx` | 266 | `gameId, userId, luckyHandsCount` | 幸运手牌浮动按钮+列表 |
| LuckyHandsTVDashboard | `src/components/LuckyHandsTVDashboard.tsx` | 214 | `gameId` | TV 大屏展示所有幸运手牌 |
| LuckyHandCelebration | `src/components/LuckyHandCelebration.tsx` | 193 | `combo, username, onComplete` | 中奖全屏庆祝动画 |

---

## 趣味互动动画组件

| 组件 | 文件 | 行数 | Props | 说明 |
|------|------|------|-------|------|
| EggThrowAnimation | `src/components/EggThrowAnimation.tsx` | 187 | `targetUsername, targetRect, onComplete` | 扔鸡蛋飞行+碎裂 |
| ChickenCatchAnimation | `src/components/ChickenCatchAnimation.tsx` | 167 | `targetUsername, targetRect, onComplete` | 抓鸡动画 |
| FlowerAnimation | `src/components/FlowerAnimation.tsx` | 163 | `targetUsername, targetRect, onComplete` | 送花飘落动画 |

---

## 十三水子模块 (src/pages/thirteen/)

| 模块 | 文件 | 行数 | 导出 | 说明 |
|------|------|------|------|------|
| types | `types.ts` | 159 | `RoundState, HandState, GameState, RoundResult, TableProps`, 常量/工具函数 | 类型定义 |
| PokerCard | `PokerCard.tsx` | 99 | `PokerCard, CardBack, OpponentArea` | 牌面渲染(标准牌文字+鬼牌CDN) |
| CardPicker | `CardPicker.tsx` | 301 | `CardPickerModal, PublicCardPickerModal` | 选牌器弹窗 |
| GameUI | `GameUI.tsx` | 334 | `PublicCardsThumbnail, PublicCardsCenter, MyHandArea, BottomActionBar, SpectatorBar, GameModals` | 游戏 UI 组件集 |
| CompareAnimation | `CompareAnimation.tsx` | 333 | `CompareAnimation` | 比牌动画(逐对逐道) |
| ScoreBoard | `ScoreBoard.tsx` | 376 | `ScoreBoard` | 积分面板+走势图+分享 |
| 桌面布局 | `Two/Three/FourPlayerTable.tsx` | 127/125/120 | 各桌面组件 | 不同人数桌面 absolute 布局 |

---

## 牌面资源规则

- **标准牌**: 纯文字渲染(rank + suit symbol)，牌面文字放大 1.2 倍
- **鬼牌**: CDN 图片 `https://cdn.jsdelivr.net/gh/hayeah/playing-cards-assets@master/svg-cards/{name}.svg`
- **牌背**: `https://deckofcardsapi.com/static/img/back.png`
- **SVG 牌面比例**: 约 2:3 (169:244)
- **编码规则**: `{rank}{suit}`
  - rank: `2-9, T, J, Q, K, A`
  - suit: `S`(♠) / `H`(♥) / `C`(♣) / `D`(♦)
  - 鬼牌: `JK1-JK6`（JK1/JK2/JK3 大王黑色, JK4/JK5/JK6 小王红色）
