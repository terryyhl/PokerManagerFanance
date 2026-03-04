# CLAUDE.md — Project Memory

## Language / 语言规则

- **必须始终使用中文回复用户**，包括解释、提问、确认、总结等一切沟通
- 代码中的注释、变量名可以用英文，但所有面向用户的对话必须是中文
- Git commit message 使用中文
- UI 文本使用中文

## Tech Stack

- **Frontend**: React 18 + TypeScript + Vite (port 3000) + Tailwind CSS v4
- **Backend**: Express + TypeScript (port 3001, local dev via `npx tsx server/index.ts`)
- **Database**: Supabase (PostgreSQL + Realtime Broadcast)
- **Deployment**: Vercel (serverless) + Supabase
- **Dev**: `npm run dev` (Vite), `npx tsx server/index.ts` (backend)

## Key Commands

- `npx tsc --noEmit` — 每次提交前必须执行，确保无 TypeScript 错误
- `npm run build` — 生产构建验证
- Git remote: `https://github.com/terryyhl/PokerManagerFanance.git` branch `main`
- Vercel webhook 已坏，push 后需手动去 Vercel Dashboard 点 Redeploy

## Project: PokerFinanceManager

- 实时多人德州扑克俱乐部财务管理 Web App
- 当前核心功能：**十三水 (13水) 房间** — 线下辅助积分工具
- 玩家线下打牌，手动在 App 中输入手牌，系统自动比牌计分结算
- 货币符号用 `$`（不是 ¥）

## 13水规则要点

- 2~4 人，58 张牌（52 标准 + 6 鬼牌）
- 每人选 13 张牌，排成：头道(3张) / 中道(5张) / 尾道(5张)
- 必须满足：尾道 >= 中道 >= 头道，否则乌龙（0分）
- 公共牌：房主选 0~6 张，含鬼牌则触发翻倍（2^n）
- 鬼牌 = 大小王：JK1,JK2,JK3 大王(黑), JK4,JK5,JK6 小王(红)
- 打枪（赢对手3道）= 该对手分数翻倍
- 全垒打（打枪所有对手）= 所有分数再翻倍
- 结算顺序：普通道分 -> 打枪 -> 全垒打 -> 鬼牌翻倍 -> 底分
- 纯积分制，无买入/筹码概念

## Card Assets

- CDN: `https://cdn.jsdelivr.net/gh/hayeah/playing-cards-assets@master/svg-cards/{name}.svg`
- 标准牌用纯文字渲染（rank + suit symbol），仅鬼牌用 CDN 图片
- 牌背: `https://deckofcardsapi.com/static/img/back.png`
- 牌编码: `{rank}{suit}` — ranks: 2-9,T,J,Q,K,A; suits: S=♠,H=♥,C=♣,D=♦; 鬼牌: JK1-JK6

## Layout Rules

- 2人桌：公共牌在中间区域，元素较大
- 3人桌：公共牌在上方(top-[10%])，左右对手在左半屏/右半屏各自居中
- 4人桌：标题栏显示公共牌缩略，四方位absolute定位，中间只显示确认状态
- 所有桌：头道靠左对齐(items-start)，所有对手统一竖向布局(头像在上牌在下)
- 不同人数使用不同桌面组件，不在同一组件内动态调整
- SVG 牌面比例 ~2:3 (169:244)

## Key Files

### 前端核心
- `src/pages/ThirteenWaterRoom.tsx` — 13水房间主页面（~1015行），状态管理 + 游戏逻辑
- `src/pages/thirteen/shared.tsx` — 共享组件（~1513行）：PokerCard、CardPickerModal、ScoreBoard、CompareAnimation、MyHandArea、BottomActionBar、GameModals
- `src/pages/thirteen/TwoPlayerTable.tsx` — 2人桌布局（~127行）
- `src/pages/thirteen/ThreePlayerTable.tsx` — 3人桌布局（~125行）
- `src/pages/thirteen/FourPlayerTable.tsx` — 4人桌布局（~120行）
- `src/pages/ThirteenReport.tsx` — 牌局回顾报告页（~316行）
- `src/pages/GameHistory.tsx` — 牌局历史页（~233行），含"普通房间"和"十三水"两个Tab
- `src/App.tsx` — 三层 Keep-Alive 架构（Layer0: MainLayout, Layer1: GameRoom, Layer2: overlay pages）
- `src/index.css` — Tailwind v4 主题（`@theme` 指令）
- `src/lib/api.ts` — 前端 API 封装

### 后端核心
- `server/routes/thirteen.ts` — 十三水 API 端点（~917行）：start-round, set-public-cards, submit-hand, settle, state, history, round/:id, auto-arrange 等
- `server/routes/games.ts` — 游戏房间 API（~395行）：创建/加入/关闭/历史
- `server/routes/users.ts` — 用户 API（~366行）：登录/统计/十三水历史
- `server/lib/thirteen/scoring.ts` — 结算引擎（~471行）：两两对比、打枪、全垒打、鬼牌翻倍、零和验证
- `server/lib/thirteen/hands.ts` — 牌型评估引擎（~559行）
- `server/lib/thirteen/deck.ts` — 牌组定义、解析、鬼牌工具函数（~85行）
- `server/lib/thirteen/arrange.ts` — 自动摆牌算法（~155行）：暴力搜索C(13,3)×C(10,5)=72072组合，策略：尾道最强优先→总分最高→中道最强
- `server/cron.ts` — 定时任务（每15分钟清理超24小时的活跃房间）

### 数据库
- `supabase/schema.sql` — 完整 schema
- `supabase/migration_thirteen.sql` — 十三水相关表 + Realtime publication

### 部署
- `vercel.json` — Rewrites `/api/*` → `api/index.ts`，1024MB/10s timeout
- `api/index.ts` — Serverless Function 入口

### 测试
- `scripts/setup-test-rooms.ts` — 测试脚本：创建3个房间(2/3/4人)各5轮，含多种牌型+公共牌+鬼牌

## Completed Features

### 基础架构
1. 13水 DB schema + 后端逻辑（9+ API 端点）
2. 三层 Keep-Alive 路由架构
3. 密码门禁 + 旁观者模式
4. 同名踢人（Supabase Broadcast）
5. Vercel Serverless 部署

### 摆牌系统
6. 卡牌选择器（CardPickerModal）+ 道次管理 + 公共牌排除
7. 摆牌顺序：头道 → 中道 → 尾道（自动切道）
8. 道间换牌：点击已摆牌选中（高亮），再点击另一张牌交换位置（同道/跨道均可）
9. 选牌允许不满13张（空道=乌龙）
10. 自动摆牌算法（尾道最强优先策略）
11. 摆牌自动保存草稿（debounce 1秒），断线重连恢复手牌
12. 标准牌纯文字渲染，仅鬼牌保留CDN图片，牌面文字放大1.2倍

### 公共牌系统
13. 房主选 0~6 张公共牌，自动鬼牌计数/翻倍（2^n）
14. 公共牌可只选鬼牌

### 结算系统
15. 提交手牌 + 自动结算 + 逐对逐道比牌动画
16. 打枪/全垒打翻倍逻辑 + 全屏特效
17. 结算并发防重复（乐观锁CAS）
18. 强制结算按钮（兜底机制）
19. 结算触发闭包陷阱修复（doSettle 支持外部传入 roundId）
20. 后端 settle 去掉严格状态限制（非finished统一执行+清理残留数据）
21. 结算完成后不再重复进入结算页面

### 比牌动画（CompareAnimation）
22. 逐对逐道展示：A vs B / A vs C / B vs C 各自三道对比
23. 每对一次性展开3道，800ms 间隔推进
24. 每对显示打枪标记 + 小计
25. 最终汇总：排名 + 总分 + 打枪/全垒打标记
26. 公共牌卡面展示（标题栏下方，无公共牌时显示"无"）
27. 鬼牌倍率标签
28. 支持截图分享

### 积分面板（ScoreBoard）
29. 总分排名 + 每局明细列表
30. 每局显示：局号、鬼牌倍率标签、每人得分/打枪/全垒打
31. 点击每局 → 打开 CompareAnimation 回放
32. 积分账单分享海报
33. 房主关闭房间按钮（自定义UI确认框，替代原生confirm）

### 布局
34. 2人/3人/4人桌独立组件，自适应布局
35. 4人桌统一尺寸 + 所有桌面标题栏添加邀请按钮
36. 3人桌公共牌上移

### 历史/回顾
37. 牌局历史页（GameHistory）：普通房间 + 十三水 两个Tab
38. 十三水历史 API 修复（room_type 过滤值 `'thirteen'`）
39. 牌局回顾页（ThirteenReport）：总分排名 + 每局明细 + 回放 + 分享海报
40. 每局明细回放支持截图分享
41. 每局明细列表显示鬼牌倍率标签（不显示公共牌卡面）
42. ThirteenReport 每局明细显示公共牌卡面

### 性能优化
43. React.memo 包装所有叶子组件（PokerCard/CardBack/OpponentArea）
44. React.memo 包装中间层组件（MyHandArea/BottomActionBar/SpectatorBar/PublicCardsCenter/PublicCardsThumbnail/GameModals/RoomHeader/CompareAnimation/ScoreBoard/CardPickerModal/PublicCardPickerModal）
45. ThirteenWaterRoom 12+ 个 handler 用 useCallback 包装
46. 核心计算值 useMemo（allSelectedCards/me/opponents/tableProps/evaluateLaneName/sorted 等）
47. confirmedUsers 从 Set<string> 改为 Record<string, boolean>（配合 memo 浅比较）
48. 模块级常量提取（LANE_MAX/SLOTS_3/SLOTS_5/LANE_LABELS/粒子 style 预计算）
49. CardPicker 内部 Set 创建用 useMemo 缓存
50. PokerCard 新增 cardId+onCardClick 模式，MyHandArea/CardPickerModal 消除内联 onClick 击穿 memo
51. Table→PublicCardsCenter/Thumbnail 的 onEdit 改为 useCallback 稳定引用（handleOpenGhostPicker）
52. GameModals 内联 onClose 改为 useCallback 稳定引用（handleClosePicker/handleCloseScoreBoard/handleCloseGhostPicker）

### 其他
53. Score 0 显示黄色（`text-amber-400`）
54. 非房主玩家不能点击空座（显示"等待加入"）
55. 等待页面：回到游戏按钮 + 密码居中加亮
56. 个人中心13水统计
57. 选牌器道次按钮顺序：头道→中道→尾道

## Architecture Notes

### Vercel Serverless 约束
- 每次请求是 cold/warm start，无持久化服务器
- 1024MB 内存，10秒超时
- `vercel.json` 将 `/api/*` 路由到 `api/index.ts`

### 数据库表结构
- `games` — 游戏房间（status: active/finished, room_type: thirteen/texas）
- `game_players` — 房间玩家关系
- `thirteen_rounds` — 十三水轮次（public_cards JSONB, ghost_count, ghost_multiplier）
- `thirteen_hands` — 玩家手牌（head/mid/tail_cards JSONB, is_confirmed, is_foul）
- `thirteen_scores` — 逐道得分明细（lane: head/mid/tail/special/gun/homerun/ghost）
- `thirteen_totals` — 每轮汇总（raw_score, final_score, guns_fired, homerun），UNIQUE(round_id, user_id)

### 关键接口
- `RoundResult` — 比牌回放数据：settlement(players[]), hands[], publicCards[], ghostCount, ghostMultiplier, roundNumber
- `TableProps` — 桌面组件共用 Props（~50个字段），含 handleCardTap/selectedCard（道间换牌）
- `HandState` — 玩家手牌状态：head/mid/tail_cards, is_confirmed, is_foul, special_hand

### 结算流程
1. 全员 submit-hand → allConfirmed
2. 前端 doSettle 或 handleForceSettle 调用 POST /settle
3. 后端：CAS lock(arranging→settling) → settleRound() → 写入 scores/totals → round→finished
4. 前端：fetch round detail → 构建 RoundResult → CompareAnimation

### Toast 系统
- 非全局，每个页面各自维护 toast state + showToast 函数
- GameModals 中也有独立 toast 渲染

## Not Yet Done

- （暂无）
