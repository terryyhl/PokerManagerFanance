import { Player } from '../../lib/api';

// ─── 常量 ────────────────────────────────────────────────────────

export const SUITS = ['S', 'H', 'C', 'D'] as const;
export const RANKS = ['A', 'K', 'Q', 'J', 'T', '9', '8', '7', '6', '5', '4', '3', '2'] as const;
export const SUIT_SYMBOL: Record<string, string> = { S: '♠', H: '♥', C: '♣', D: '♦' };
export const SUIT_COLOR: Record<string, string> = { S: 'text-slate-900', H: 'text-red-500', C: 'text-slate-900', D: 'text-red-500' };
export const RANK_DISPLAY: Record<string, string> = { T: '10', J: 'J', Q: 'Q', K: 'K', A: 'A' };
export const SPECIAL_HAND_NAMES: Record<string, string> = {
  dragon: '青龙', straight_dragon: '一条龙', six_pairs: '六对半',
  three_flush: '三同花', three_straight: '三顺子',
};

const CARD_CDN = 'https://cdn.jsdelivr.net/gh/hayeah/playing-cards-assets@master/svg-cards';
export const CARD_BACK_URL = 'https://deckofcardsapi.com/static/img/back.png';

const RANK_TO_NAME: Record<string, string> = {
  'A': 'ace', '2': '2', '3': '3', '4': '4', '5': '5', '6': '6',
  '7': '7', '8': '8', '9': '9', 'T': '10', 'J': 'jack', 'Q': 'queen', 'K': 'king',
};
const SUIT_TO_NAME: Record<string, string> = {
  'S': 'spades', 'H': 'hearts', 'C': 'clubs', 'D': 'diamonds',
};

// ─── 工具函数 ────────────────────────────────────────────────────

/** 将内部牌码 (AS, TH, JK1..JK6) 转为 CDN URL */
export function cardToUrl(card: string): string | null {
  if (card.startsWith('JK')) {
    const num = parseInt(card.slice(2));
    return `${CARD_CDN}/${num <= 3 ? 'black_joker' : 'red_joker'}.svg`;
  }
  const rank = card.slice(0, -1);
  const suit = card.slice(-1);
  const rankName = RANK_TO_NAME[rank];
  const suitName = SUIT_TO_NAME[suit];
  if (!rankName || !suitName) return null;
  return `${CARD_CDN}/${rankName}_of_${suitName}.svg`;
}

// ─── 类型定义 ────────────────────────────────────────────────────

export interface RoundState {
  id: string;
  status: string;
  round_number: number;
  public_cards: string[];
  ghost_count: number;
  ghost_multiplier: number;
}

export interface HandState {
  round_id?: string;
  user_id: string;
  head_cards: string[] | null;
  mid_cards: string[] | null;
  tail_cards: string[] | null;
  is_confirmed: boolean;
  is_foul: boolean;
  special_hand: string | null;
  users?: { id: string; username: string };
}

export interface GameState {
  activeRound: RoundState | null;
  hands: HandState[];
  finishedRounds: number;
  playerTotals: Record<string, number>;
  totalPlayers: number;
}

export interface LaneScoreRecord {
  lane: string;
  userId: string;
  opponentId: string;
  score: number;
  detail: string;
}

export interface SettlementPlayer {
  userId: string;
  rawScore: number;
  finalScore: number;
  gunsFired: number;
  homerun: boolean;
  laneScores: LaneScoreRecord[];
}

export interface SettlementResult {
  players: SettlementPlayer[];
}

export interface RoundResult {
  settlement: SettlementResult;
  hands: HandState[];
  publicCards: string[];
  ghostCount: number;
  ghostMultiplier: number;
  roundNumber: number;
}

/** 桌面组件共用 Props */
export interface TableProps {
  game: { id: string; name: string; room_code: string; created_by: string; thirteen_ghost_count?: number };
  me: Player | undefined;
  opponents: Player[];
  isHost: boolean;
  publicCards: string[];
  publicCardsSet: boolean;
  ghostCount: number;
  confirmedUsers: Set<string>;
  currentPlayers: number;
  playerTotals: Record<string, number>;
  myHeadCards: string[];
  myMidCards: string[];
  myTailCards: string[];
  isConfirmed: boolean;
  activeLane: 'head' | 'mid' | 'tail';
  allSelectedCards: string[];
  isSubmitting: boolean;
  isSettling: boolean;
  showPicker: boolean;
  showInvite: boolean;
  inviteCopied: boolean;
  showScoreBoard: boolean;
  showGhostPicker: boolean;
  showCompare: boolean;
  roundResult: RoundResult | null;
  finishedRounds: number;
  players: Player[];
  userId?: string;
  setGamePhase: (phase: 'waiting' | 'arranging' | 'revealing' | 'settled') => void;
  setShowGhostPicker: (v: boolean) => void;
  setShowInvite: (v: boolean) => void;
  setInviteCopied: (v: boolean) => void;
  setShowScoreBoard: (v: boolean) => void;
  setShowPicker: (v: boolean) => void;
  setActiveLane: (lane: 'head' | 'mid' | 'tail') => void;
  setShowCompare: (v: boolean) => void;
  handleSelectCard: (card: string) => void;
  handleRemoveCard: (card: string) => void;
  handleCardTap: (card: string) => void;
  selectedCard: string | null;
  handleRearrange: () => void;
  handleAutoArrange: () => void;
  isAutoArranging: boolean;
  handleSubmitHand: () => void;
  handleSetPublicCards: (cards: string[]) => void;
  handleCompareClose: () => void;
  handleCloseRoom: () => void;
  handleCloseRoomConfirm: () => void;
  showCloseConfirm: boolean;
  setShowCloseConfirm: (v: boolean) => void;
  handleForceSettle: () => void;
  showToast: (msg: string, type: 'info' | 'error' | 'success') => void;
  toast: { msg: string; type: 'info' | 'error' | 'success' } | null;
  isSpectator: boolean;
}
