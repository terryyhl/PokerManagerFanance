/**
 * Barrel file — 统一 re-export 所有十三水共享模块
 * 
 * 拆分后的模块结构：
 * - types.ts         : 类型定义 + 常量 + 工具函数
 * - PokerCard.tsx     : PokerCard, CardBack, OpponentArea
 * - CardPicker.tsx    : CardPickerModal, PublicCardPickerModal
 * - ScoreBoard.tsx    : ScoreBoard（积分账单面板）
 * - CompareAnimation.tsx : CompareAnimation（比牌动画）
 * - GameUI.tsx        : PublicCardsThumbnail, PublicCardsCenter, MyHandArea, BottomActionBar, SpectatorBar, GameModals
 */

// 类型 + 常量 + 工具函数
export {
  SUITS, RANKS, SUIT_SYMBOL, SUIT_COLOR, RANK_DISPLAY, SPECIAL_HAND_NAMES,
  CARD_BACK_URL, cardToUrl,
  type RoundState, type HandState, type GameState,
  type LaneScoreRecord, type SettlementPlayer, type SettlementResult, type RoundResult,
  type TableProps,
} from './types';

// 牌面组件
export { PokerCard, CardBack, OpponentArea } from './PokerCard';

// 选牌器
export { CardPickerModal, PublicCardPickerModal } from './CardPicker';

// 积分账单
export { ScoreBoard } from './ScoreBoard';

// 比牌动画
export { CompareAnimation } from './CompareAnimation';

// 游戏 UI 组件
export {
  PublicCardsThumbnail, PublicCardsCenter, MyHandArea,
  BottomActionBar, SpectatorBar, GameModals,
} from './GameUI';
