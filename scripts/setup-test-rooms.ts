/**
 * 测试脚本：创建3个十三水房间，自动坐人 + 自动摆牌
 *
 * 管理员账号: username = "123"
 * 测试用户: bot_a, bot_b, bot_c（自动创建）
 *
 * 房间1 (2人桌 - 普通比牌): 123 vs bot_a
 * 房间2 (3人桌 - 打枪场景): 123 vs bot_a vs bot_b
 * 房间3 (4人桌 - 全垒打场景): 123 vs bot_a vs bot_b vs bot_c
 *
 * 用法: npx tsx scripts/setup-test-rooms.ts
 * 前提: 本地后端已启动 (npx tsx server/index.ts)
 */

const API = 'http://localhost:3001/api';

async function api(method: string, path: string, body?: any) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json();
  if (!res.ok) {
    console.error(`❌ ${method} ${path} → ${res.status}:`, data);
    throw new Error(data.error || `API error ${res.status}`);
  }
  return data;
}

// ─── 登录/创建用户 ──────────────────────────────────────────
async function login(username: string): Promise<string> {
  const data = await api('POST', '/users/login', { username });
  console.log(`  用户 "${username}" → ${data.user.id.slice(0, 8)}...`);
  return data.user.id;
}

// ─── 创建十三水房间 ──────────────────────────────────────────
async function createRoom(name: string, userId: string, maxPlayers: number) {
  const data = await api('POST', '/games', {
    name,
    userId,
    roomType: 'thirteen',
    thirteenMaxPlayers: maxPlayers,
    thirteenBaseScore: 1,
    thirteenGhostCount: 6,
    thirteenCompareSuit: true,
  });
  console.log(`  房间 "${name}" 创建成功, code=${data.game.room_code}, id=${data.game.id.slice(0, 8)}...`);
  return data.game;
}

// ─── 加入房间 ──────────────────────────────────────────────
async function joinRoom(roomCode: string, userId: string) {
  await api('POST', '/games/join', { roomCode, userId });
}

// ─── 开始新一轮 ──────────────────────────────────────────────
async function startRound(gameId: string, userId: string) {
  const data = await api('POST', `/thirteen/${gameId}/start-round`, { userId });
  console.log(`  开始轮次 #${data.round.round_number}, roundId=${data.round.id.slice(0, 8)}...`);
  return data.round;
}

// ─── 提交摆牌 ──────────────────────────────────────────────
async function submitHand(
  gameId: string, userId: string, roundId: string,
  head: string[], mid: string[], tail: string[]
) {
  const data = await api('POST', `/thirteen/${gameId}/submit-hand`, {
    userId, roundId,
    headCards: head, midCards: mid, tailCards: tail,
  });
  const status = data.isFoul ? '乌龙' : data.specialHand ? data.specialHand : '正常';
  console.log(`  摆牌提交 (${status}), confirmed=${data.confirmedCount}/${data.totalPlayers}`);
  return data;
}

// ═════════════════════════════════════════════════════════════
// 3种测试牌组
// ═════════════════════════════════════════════════════════════

/**
 * 房间1: 2人桌 - 普通比牌
 * 123:  头道散牌AKQ > bot_a头道散牌432 → 123赢头道
 * 123:  中道一对9 < bot_a中道两对TT88 → bot_a赢中道
 * 123:  尾道皇家同花顺♣ > bot_a尾道两对KKQQ → 123赢尾道
 * 结果: 123 赢2道输1道，不构成打枪
 */
const ROOM1_HANDS = {
  admin: {
    head: ['AH', 'KD', 'QS'],                        // 散牌AKQ
    mid:  ['9S', '9H', '7D', '6C', '5D'],            // 一对9
    tail: ['TC', 'JC', 'QC', 'KC', 'AC'],            // 皇家同花顺♣
  },
  bot_a: {
    head: ['4S', '3H', '2D'],                        // 散牌432
    mid:  ['TH', 'TD', '8H', '8C', '7C'],            // 两对 TT+88
    tail: ['KH', 'KS', 'QH', 'QD', 'JD'],            // 两对 KK+QQ
  },
};

/**
 * 房间2: 3人桌 - 打枪场景
 * 123:  强牌，三道全赢 bot_a → 打枪 bot_a
 * bot_b: 中等牌
 */
const ROOM2_HANDS = {
  admin: {
    head: ['AS', 'AH', 'AD'],                        // 三条A
    mid:  ['KS', 'KH', 'KC', 'QS', 'QH'],           // 葫芦 KKK+QQ
    tail: ['JS', 'TS', '9S', '8S', '7S'],            // 同花顺 7-J♠
  },
  bot_a: {
    head: ['2S', '3H', '5D'],                        // 散牌
    mid:  ['4C', '4D', '6H', '7C', '8D'],            // 一对4
    tail: ['9H', '9C', 'TD', 'JC', 'QD'],            // 一对9
  },
  bot_b: {
    head: ['KD', 'QC', 'JD'],                        // 散牌 KQJ
    mid:  ['TH', 'TC', 'JH', '2C', '3C'],            // 一对T
    tail: ['6S', '6D', '7H', '7D', 'AC'],            // 两对 66+77
  },
};

/**
 * 房间3: 4人桌 - 全垒打场景
 * 123: 超强牌，三道全赢所有对手 → 全垒打
 * 头道三条A > 所有对手, 中道同花 > 所有对手, 尾道同花顺 > 所有对手
 * 尾道(同花顺) > 中道(同花) > 头道(三条) ✅ 不乌龙
 */
const ROOM3_HANDS = {
  admin: {
    head: ['AS', 'AH', 'AD'],                        // 三条A
    mid:  ['KS', 'QS', 'TS', '8S', '6S'],            // 同花♠ K高
    tail: ['JH', 'TH', '9H', '8H', '7H'],            // 同花顺 7-J♥
  },
  bot_a: {
    head: ['2S', '3H', '4D'],                        // 散牌
    mid:  ['5C', '5D', '6H', '7C', '8D'],            // 一对5
    tail: ['9S', '9C', 'TD', 'TC', '2C'],            // 两对 99+TT
  },
  bot_b: {
    head: ['2H', '3C', '5S'],                        // 散牌
    mid:  ['4S', '4H', '6C', '7D', 'JS'],             // 一对4
    tail: ['KH', 'KC', 'JC', 'JD', '3D'],            // 两对 KK+JJ
  },
  bot_c: {
    head: ['2D', '3S', '5H'],                        // 散牌
    mid:  ['4C', '6D', 'KD', '7S', '8C'],             // 散牌 K高
    tail: ['AC', 'QH', 'QC', 'QD', '9D'],            // 三条Q
  },
};

// ─── 检查牌是否有重复 ──────────────────────────────────────
function checkDuplicates(label: string, ...cardSets: string[][]) {
  const all = cardSets.flat();
  const seen = new Set<string>();
  for (const c of all) {
    if (seen.has(c)) {
      console.error(`⚠️  ${label}: 重复牌 ${c}`);
      return false;
    }
    seen.add(c);
  }
  return true;
}

// ═════════════════════════════════════════════════════════════
// 主流程
// ═════════════════════════════════════════════════════════════

async function main() {
  console.log('═══ 创建测试用户 ═══');
  const adminId = await login('123');
  const botAId = await login('bot_a');
  const botBId = await login('bot_b');
  const botCId = await login('bot_c');

  // ─── 房间1: 2人桌 普通比牌 ─────────────────────────────
  console.log('\n═══ 房间1: 2人桌 - 普通比牌 ═══');
  checkDuplicates('房间1',
    ROOM1_HANDS.admin.head, ROOM1_HANDS.admin.mid, ROOM1_HANDS.admin.tail,
    ROOM1_HANDS.bot_a.head, ROOM1_HANDS.bot_a.mid, ROOM1_HANDS.bot_a.tail,
  );
  const game1 = await createRoom('测试-2人普通', adminId, 2);
  await joinRoom(game1.room_code, botAId);
  console.log('  bot_a 已入座');
  const round1 = await startRound(game1.id, adminId);
  // bot_a 先摆牌
  await submitHand(game1.id, botAId, round1.id,
    ROOM1_HANDS.bot_a.head, ROOM1_HANDS.bot_a.mid, ROOM1_HANDS.bot_a.tail);
  // 123 摆牌（不提交，等你手动确认结算）
  await api('POST', `/thirteen/${game1.id}/save-draft`, {
    userId: adminId, roundId: round1.id,
    headCards: ROOM1_HANDS.admin.head,
    midCards: ROOM1_HANDS.admin.mid,
    tailCards: ROOM1_HANDS.admin.tail,
  });
  // 直接提交123的牌
  await submitHand(game1.id, adminId, round1.id,
    ROOM1_HANDS.admin.head, ROOM1_HANDS.admin.mid, ROOM1_HANDS.admin.tail);
  console.log(`  ✅ 房间1就绪, 密码: ${game1.room_code} (全员已确认,进入即可结算)`);

  // ─── 房间2: 3人桌 打枪 ─────────────────────────────────
  console.log('\n═══ 房间2: 3人桌 - 打枪场景 ═══');
  checkDuplicates('房间2',
    ROOM2_HANDS.admin.head, ROOM2_HANDS.admin.mid, ROOM2_HANDS.admin.tail,
    ROOM2_HANDS.bot_a.head, ROOM2_HANDS.bot_a.mid, ROOM2_HANDS.bot_a.tail,
    ROOM2_HANDS.bot_b.head, ROOM2_HANDS.bot_b.mid, ROOM2_HANDS.bot_b.tail,
  );
  const game2 = await createRoom('测试-3人打枪', adminId, 3);
  await joinRoom(game2.room_code, botAId);
  await joinRoom(game2.room_code, botBId);
  console.log('  bot_a, bot_b 已入座');
  const round2 = await startRound(game2.id, adminId);
  await submitHand(game2.id, botAId, round2.id,
    ROOM2_HANDS.bot_a.head, ROOM2_HANDS.bot_a.mid, ROOM2_HANDS.bot_a.tail);
  await submitHand(game2.id, botBId, round2.id,
    ROOM2_HANDS.bot_b.head, ROOM2_HANDS.bot_b.mid, ROOM2_HANDS.bot_b.tail);
  await submitHand(game2.id, adminId, round2.id,
    ROOM2_HANDS.admin.head, ROOM2_HANDS.admin.mid, ROOM2_HANDS.admin.tail);
  console.log(`  ✅ 房间2就绪, 密码: ${game2.room_code} (全员已确认,进入即可结算)`);

  // ─── 房间3: 4人桌 全垒打 ───────────────────────────────
  console.log('\n═══ 房间3: 4人桌 - 全垒打场景 ═══');
  checkDuplicates('房间3',
    ROOM3_HANDS.admin.head, ROOM3_HANDS.admin.mid, ROOM3_HANDS.admin.tail,
    ROOM3_HANDS.bot_a.head, ROOM3_HANDS.bot_a.mid, ROOM3_HANDS.bot_a.tail,
    ROOM3_HANDS.bot_b.head, ROOM3_HANDS.bot_b.mid, ROOM3_HANDS.bot_b.tail,
    ROOM3_HANDS.bot_c.head, ROOM3_HANDS.bot_c.mid, ROOM3_HANDS.bot_c.tail,
  );
  const game3 = await createRoom('测试-4人全垒打', adminId, 4);
  await joinRoom(game3.room_code, botAId);
  await joinRoom(game3.room_code, botBId);
  await joinRoom(game3.room_code, botCId);
  console.log('  bot_a, bot_b, bot_c 已入座');
  const round3 = await startRound(game3.id, adminId);
  await submitHand(game3.id, botAId, round3.id,
    ROOM3_HANDS.bot_a.head, ROOM3_HANDS.bot_a.mid, ROOM3_HANDS.bot_a.tail);
  await submitHand(game3.id, botBId, round3.id,
    ROOM3_HANDS.bot_b.head, ROOM3_HANDS.bot_b.mid, ROOM3_HANDS.bot_b.tail);
  await submitHand(game3.id, botCId, round3.id,
    ROOM3_HANDS.bot_c.head, ROOM3_HANDS.bot_c.mid, ROOM3_HANDS.bot_c.tail);
  await submitHand(game3.id, adminId, round3.id,
    ROOM3_HANDS.admin.head, ROOM3_HANDS.admin.mid, ROOM3_HANDS.admin.tail);
  console.log(`  ✅ 房间3就绪, 密码: ${game3.room_code} (全员已确认,进入即可结算)`);

  // ─── 汇总 ──────────────────────────────────────────────
  console.log('\n═══════════════════════════════════════');
  console.log('所有房间就绪！用 "123" 账号登录后进入以下房间:');
  console.log(`  房间1 (2人-普通): ${game1.room_code}  → 预期: 123赢2道输1道`);
  console.log(`  房间2 (3人-打枪): ${game2.room_code}  → 预期: 123打枪bot_a`);
  console.log(`  房间3 (4人-全垒打): ${game3.room_code}  → 预期: 123全垒打`);
  console.log('═══════════════════════════════════════\n');
}

main().catch(err => {
  console.error('脚本执行失败:', err);
  process.exit(1);
});
