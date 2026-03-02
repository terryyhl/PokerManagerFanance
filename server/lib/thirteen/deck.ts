/**
 * 13水牌面定义与解析工具
 *
 * 线下辅助工具 — 不需要洗牌/发牌，玩家手动选牌录入。
 *
 * 牌面编码:  点数 + 花色字母
 *   花色: S=♠黑桃, H=♥红桃, C=♣梅花, D=♦方片
 *   点数: 2,3,4,5,6,7,8,9,T,J,Q,K,A
 *   鬼牌: JK1~JK6
 *
 * 58张 = 52基础 + 6鬼牌
 */

export const SUITS = ['S', 'H', 'C', 'D'] as const;         // ♠ > ♥ > ♣ > ♦
export const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K', 'A'] as const;
export const GHOST_CARDS = ['JK1', 'JK2', 'JK3', 'JK4', 'JK5', 'JK6'] as const;

export type Suit = typeof SUITS[number];
export type Rank = typeof RANKS[number];
export type Card = string; // "AS", "TH", "JK1" etc.

/** 点数数值映射（2=2, ..., A=14） */
export const RANK_VALUE: Record<string, number> = {
    '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7,
    '8': 8, '9': 9, 'T': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14,
};

/** 花色权重（♠=4 > ♥=3 > ♣=2 > ♦=1） */
export const SUIT_VALUE: Record<string, number> = {
    'S': 4, 'H': 3, 'C': 2, 'D': 1,
};

// ─── 牌面解析 ────────────────────────────────────────────────────

export function isGhost(card: Card): boolean {
    return card.startsWith('JK');
}

export function parseCard(card: Card): { rank: Rank; suit: Suit } | null {
    if (isGhost(card)) return null;
    const rank = card.slice(0, -1) as Rank;
    const suit = card.slice(-1) as Suit;
    return { rank, suit };
}

export function getRankValue(card: Card): number {
    if (isGhost(card)) return 14; // 鬼牌默认当 A
    const parsed = parseCard(card);
    return parsed ? RANK_VALUE[parsed.rank] : 0;
}

export function getSuitValue(card: Card): number {
    if (isGhost(card)) return SUIT_VALUE['S']; // 鬼牌默认♠
    const parsed = parseCard(card);
    return parsed ? SUIT_VALUE[parsed.suit] : 0;
}

/** 生成所有52张实牌列表（用于鬼牌枚举替换） */
export function allRealCards(): Card[] {
    const deck: Card[] = [];
    for (const rank of RANKS) {
        for (const suit of SUITS) {
            deck.push(`${rank}${suit}`);
        }
    }
    return deck;
}

/**
 * 校验一张牌编码是否合法
 */
export function isValidCard(card: string): boolean {
    if (isGhost(card)) return GHOST_CARDS.includes(card as typeof GHOST_CARDS[number]);
    const parsed = parseCard(card);
    if (!parsed) return false;
    return (RANKS as readonly string[]).includes(parsed.rank) && (SUITS as readonly string[]).includes(parsed.suit);
}

/**
 * 计算公共牌中的鬼牌数量和倍率
 */
export function calcGhostMultiplier(publicCards: Card[]): { ghostCount: number; multiplier: number } {
    const ghostCount = publicCards.filter(c => isGhost(c)).length;
    return { ghostCount, multiplier: Math.pow(2, ghostCount) };
}
