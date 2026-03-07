# 房间流程与体验升级 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 按顺序完成登录持久化、改用户名、待审核购买恢复、房主代买/代结账、按手数购买、房间内座位同步、PWA 安装提示和移动端 UI 修复，并在每一步完成后先验证再进入下一步。

**Architecture:** 先处理账户层，再补齐房间财务闭环，随后处理座位同步与安装能力，最后做 UI/适配收尾。所有改动尽量复用现有 `games`、`buyin`、`UserContext`、`SeatDraw`、`GameRoom`、`ThirteenWaterRoom` 结构，避免引入新的全局状态系统。

**Tech Stack:** React 18, TypeScript, Vite, Express, Supabase Realtime, localStorage, Web App Manifest, Service Worker

**验证命令:** `npx tsc --noEmit` + `npm run build`

---

## 执行规则

1. 严格按任务顺序执行，不并行实现多个问题。
2. 每个任务完成后，必须先跑 `npx tsc --noEmit` 和 `npm run build`。
3. 每个任务完成后，再做一轮对应场景的手工验证。
4. 验证通过后，才开始下一个任务。
5. 若某一步发现需求漂移，先停在当前任务，不继续连带实现后续任务。

---

### Task 1: 登录后保存用户信息并自动登录

**Files:**
- Modify: `src/contexts/UserContext.tsx`
- Modify: `src/App.tsx`
- Modify: `src/components/ProtectedRoute.tsx`
- Modify: `src/pages/Login.tsx`

**Step 1: 在 `UserContext` 中加入本地持久化结构**

- 增加一个本地存储 key，例如 `poker:user`
- 增加初始化恢复逻辑
- 增加 `hydrated` / `isReady` 状态，避免首屏误跳登录

**Step 2: 最小实现自动恢复与清理逻辑**

- `setUser` 时同时写入 `localStorage`
- `logout` 时同时清理 `localStorage`
- 读取失败时自动移除脏数据

**Step 3: 让路由守卫等待用户态恢复完成**

- `ProtectedRoute` 在 hydration 完成前显示加载态，而不是立即重定向

**Step 4: 运行验证**

Run: `npx tsc --noEmit`
Expected: 无 TypeScript 错误

Run: `npm run build`
Expected: 构建成功

**Step 5: 手工验证**

- 登录一次后刷新页面，仍保持登录
- 关闭浏览器重新打开，仍保持登录
- 点击退出登录后重新进入，需要重新登录

---

### Task 2: 用户修改用户名

**Files:**
- Modify: `server/routes/users.ts`
- Modify: `src/lib/api.ts`
- Modify: `src/contexts/UserContext.tsx`
- Modify: `src/pages/Profile.tsx`
- Inspect after change: `src/components/Avatar.tsx`

**Step 1: 新增后端改名接口**

- 新增 `PATCH /api/users/:id/username`
- 校验 `username.trim()` 非空、长度 1~20
- 保持全局唯一，冲突时返回明确报错

**Step 2: 前端补齐 API 与个人中心编辑入口**

- 在 `usersApi` 中新增改名方法
- 在 `Profile` 页增加改名弹窗或轻量编辑表单

**Step 3: 最小实现前端同步更新**

- 改名成功后更新 `UserContext`
- 同步更新 `localStorage`
- 当前页用户名立即刷新

**Step 4: 运行验证**

Run: `npx tsc --noEmit`
Expected: 无 TypeScript 错误

Run: `npm run build`
Expected: 构建成功

**Step 5: 手工验证**

- 在个人中心改名成功
- 返回大厅、进入房间，看到新用户名
- 刷新和重开应用后，仍显示新用户名

---

### Task 3: 进入房间时恢复待审核购买列表

**Files:**
- Modify: `src/pages/GameRoom.tsx`
- Inspect: `src/hooks/useGameSSE.ts`
- Inspect: `server/routes/buyin.ts`
- Inspect: `server/pendingRequests.ts`

**Step 1: 找到房间初始化路径并补主动拉取**

- 在房间首次加载成功后，主动请求 `GET /api/buyin/pending/:gameId`
- 不再把 pending 可见性建立在实时消息是否在线收到的前提上

**Step 2: 最小实现列表恢复逻辑**

- 把主动拉取结果写回现有 `pendingRequests` 状态
- 保留 realtime 作为后续增量更新机制

**Step 3: 确认房主离开再进入的路径不会清空待审状态**

- 若有本地状态重置逻辑，改成“先清空再用接口结果回填”而不是永远空数组

**Step 4: 运行验证**

Run: `npx tsc --noEmit`
Expected: 无 TypeScript 错误

Run: `npm run build`
Expected: 构建成功

**Step 5: 手工验证**

- 普通用户提交一条待审核购买
- 房主离开房间再重新进入
- 待审核区仍能看到这条记录并继续审批

---

### Task 4: 房主代购买与代结账免审核

**Files:**
- Modify: `server/routes/buyin.ts`
- Modify: `src/lib/api.ts`
- Modify: `src/pages/GameRoom.tsx`
- Optionally modify: `src/components/PlayerStatsModal.tsx`

**Step 1: 在后端加房主代操作校验**

- 为买入和结账接口增加 `createdBy`
- 若 `createdBy !== userId`，校验 `createdBy` 是否为房主
- 代购买直接落库，不走 pending

**Step 2: 前端给房主增加玩家级操作入口**

- 在玩家卡片/头像菜单中增加 `代购买`、`代结账`
- 房主选择目标玩家后直接提交目标用户 ID

**Step 3: 最小实现记录来源信息**

- 在请求体中带上 `source = host_proxy | self | approval`
- 如果暂时不改数据库，也至少保证前端时间线能识别代录来源

**Step 4: 运行验证**

Run: `npx tsc --noEmit`
Expected: 无 TypeScript 错误

Run: `npm run build`
Expected: 构建成功

**Step 5: 手工验证**

- 房主可替任意玩家直接买入
- 房主可替任意玩家直接结账
- 代购买不会进入待审核列表
- 非房主无法伪造房主代操作

---

### Task 5: 创建房间配置每手积分额度，房间内按手数购买

**Files:**
- Modify: `supabase/schema.sql`
- Modify: `server/routes/games.ts`
- Modify: `server/routes/buyin.ts`
- Modify: `src/lib/api.ts`
- Modify: `src/pages/CreateGame.tsx`
- Modify: `src/pages/GameRoom.tsx`
- Inspect: `docs/api-games.md`
- Inspect: `docs/api-buyin.md`

**Step 1: 为房间和买入记录补足字段设计**

- `games` 增加 `points_per_hand`
- `buy_ins` 增加 `hand_count`、`points_per_hand`
- `pending_buyins` 增加 `hand_count`、`points_per_hand`

**Step 2: 更新创建房间流程**

- 前端去掉“最低买入/最高买入”主输入
- 改为 `每手积分额度`
- 后端创建房间时写入 `points_per_hand`

**Step 3: 更新买入弹窗为按手数输入**

- 输入手数
- 实时显示换算后的积分结果
- 提交时落库金额 `amount = handCount * pointsPerHand`

**Step 4: 运行验证**

Run: `npx tsc --noEmit`
Expected: 无 TypeScript 错误

Run: `npm run build`
Expected: 构建成功

**Step 5: 手工验证**

- 创建房间时能设置每手积分额度
- 房间内输入 3 手，正确换算为 `3 * 每手积分`
- 购买记录可看到手数和积分结果

---

### Task 6: 房间内座位分配同步与玩家自报座位号

**Files:**
- Modify: `supabase/schema.sql`
- Modify: `server/routes/games.ts`
- Modify: `src/lib/api.ts`
- Modify: `src/pages/SeatDraw.tsx`
- Modify: `src/pages/GameRoom.tsx`
- Modify: `src/pages/ThirteenWaterRoom.tsx`

**Step 1: 为房间成员增加座位字段**

- `game_players` 增加 `seat_number`、`seat_confirmed`、`seat_confirmed_at`

**Step 2: 新增房间内座位同步接口**

- 新增房主提交座位分配结果接口
- 新增玩家确认自己座位接口

**Step 3: 复用现有座位工具并接入房间上下文**

- 从房间内进入 `SeatDraw` 时，携带 `gameId` 与玩家列表
- 点击“确定”后直接同步回房间，而不是只停留在工具页

**Step 4: 运行验证**

Run: `npx tsc --noEmit`
Expected: 无 TypeScript 错误

Run: `npm run build`
Expected: 构建成功

**Step 5: 手工验证**

- 从房间内进入分配座位工具
- 点击确定后返回房间，座位号同步展示
- 每个玩家可确认自己的座位号

---

### Task 7: PWA 安装提示与保存到桌面

**Files:**
- Modify: `package.json`
- Modify: `vite.config.ts`
- Modify: `index.html`
- Create: `public/manifest.webmanifest`
- Create: `public/icons/*`（如需要）
- Create or Modify: `src/main.tsx`
- Create: `src/hooks/useInstallPrompt.ts`
- Modify: `src/App.tsx` 或合适的全局入口组件

**Step 1: 补齐 PWA 基础设施**

- 安装并配置 `vite-plugin-pwa` 或等效方案
- 增加 manifest、icons、service worker 注册

**Step 2: 新增安装提示 hook**

- 监听 `beforeinstallprompt`
- 缓存事件供用户点击“安装”时触发
- 不支持时返回降级状态

**Step 3: 最小实现全局安装提示 UI**

- 首次满足条件时展示提示
- 触发系统安装提示
- 无系统提示时展示引导信息

**Step 4: 运行验证**

Run: `npx tsc --noEmit`
Expected: 无 TypeScript 错误

Run: `npm run build`
Expected: 构建成功

**Step 5: 手工验证**

- 支持的浏览器出现安装入口
- 不支持的浏览器出现降级引导
- 用户关闭提示后不会被过度骚扰

---

### Task 8: 基于新技能包修复适配与 UI 交互问题

**Files:**
- Inspect and Modify as needed:
  - `src/components/MainLayout.tsx`
  - `src/components/BottomNav.tsx`
  - `src/pages/Lobby.tsx`
  - `src/pages/GameRoom.tsx`
  - `src/pages/ThirteenWaterRoom.tsx`
  - `src/pages/thirteen/GameUI.tsx`
  - `src/pages/thirteen/TwoPlayerTable.tsx`
  - `src/pages/thirteen/ThreePlayerTable.tsx`
  - `src/pages/thirteen/FourPlayerTable.tsx`

**Step 1: 先做审计，不盲改**

- 用已安装的设计技能检查移动端安全区、底部导航遮挡、按钮热区、弹层可达性、信息层级

**Step 2: 优先修复结构性问题**

- 安全区 padding
- 小屏溢出
- 固定底栏遮挡内容
- 模态框高度与滚动行为

**Step 3: 再修复视觉与交互问题**

- 弱化噪音信息
- 强化主按钮层级
- 优化十三水房间在 2/3/4 人桌下的可点击区域和状态反馈

**Step 4: 运行验证**

Run: `npx tsc --noEmit`
Expected: 无 TypeScript 错误

Run: `npm run build`
Expected: 构建成功

**Step 5: 手工验证**

- 手机尺寸下主要页面无明显遮挡或断层
- 弹层可完整操作
- 关键操作在单手持机场景下可方便点击

---

### Task 9: 最终整体验证

**Files:**
- No code changes required

**Step 1: 运行类型检查**

Run: `npx tsc --noEmit`
Expected: 无错误

**Step 2: 运行生产构建**

Run: `npm run build`
Expected: 构建成功

**Step 3: 跑完整手工冒烟流程**

- 自动登录
- 改用户名
- 待审核购买恢复
- 房主代购买/代结账
- 按手数购买
- 座位分配与确认
- 安装提示
- 手机页面适配

**Step 4: 记录验证结果**

- 若有残留问题，回写到新一轮计划，不在本轮偷偷夹带
