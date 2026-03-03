/**
 * 测试脚本：创建3个十三水房间，每个房间跑5轮
 * 构造多种牌型组合验证UI：普通、打枪、全垒打、乌龙、特殊牌型等
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
    console.error(`  X ${method} ${path} -> ${res.status}:`, data);
    throw new Error(data.error || `API error ${res.status}`);
  }
  return data;
}

async function login(username: string): Promise<string> {
  const data = await api('POST', '/users/login', { username });
  return data.user.id;
}

async function createRoom(name: string, userId: string, maxPlayers: number) {
  const data = await api('POST', '/games', {
    name, userId, roomType: 'thirteen',
    thirteenMaxPlayers: maxPlayers, thirteenBaseScore: 1,
    thirteenGhostCount: 0, thirteenCompareSuit: false,
  });
  return data.game;
}

async function joinRoom(roomCode: string, userId: string) {
  await api('POST', '/games/join', { roomCode, userId });
}

async function startRound(gameId: string, userId: string) {
  const data = await api('POST', `/thirteen/${gameId}/start-round`, { userId });
  return data.round;
}

async function submitHand(gameId: string, userId: string, roundId: string, head: string[], mid: string[], tail: string[]) {
  return await api('POST', `/thirteen/${gameId}/submit-hand`, { userId, roundId, headCards: head, midCards: mid, tailCards: tail });
}

async function settle(gameId: string, userId: string, roundId: string) {
  return await api('POST', `/thirteen/${gameId}/settle`, { userId, roundId });
}

// ═══════════════════════════════════════════════════════════════
// 牌组定义 — 每个房间5轮
// 规则: 尾道 >= 中道 >= 头道，否则乌龙
// ═══════════════════════════════════════════════════════════════

// ─── 2人桌 5轮 ─────────────────────────────────────────────────
const ROOM1_ROUNDS = [
  { // R1: 普通 — admin赢2输1
    label: '普通(赢2输1)',
    admin: { head: ['AH', 'KD', 'QS'], mid: ['9S', '9H', '7D', '6C', '5D'], tail: ['TC', 'JC', 'QC', 'KC', 'AC'] },
    bot_a: { head: ['4S', '3H', '2D'], mid: ['TH', 'TD', '8H', '8C', '7C'], tail: ['KH', 'KS', 'QH', 'QD', 'JD'] },
  },
  { // R2: 打枪 — admin三道全赢
    label: '打枪(admin全赢)',
    admin: { head: ['AS', 'KH', 'QD'], mid: ['JH', 'JD', 'JS', '4C', '4D'], tail: ['9C', '8C', '7C', '6C', '5C'] },
    bot_a: { head: ['3S', '2H', '4S'], mid: ['TD', 'TC', '6H', '5D', '2C'], tail: ['KD', 'KC', 'QS', '8D', '7D'] },
  },
  { // R3: bot赢2 — admin输2赢1
    label: '普通(bot赢2)',
    admin: { head: ['2S', '3D', '4H'], mid: ['5S', '5H', '6D', '7S', '8D'], tail: ['TS', 'TH', '9D', '9C', 'AD'] },
    bot_a: { head: ['AH', 'KS', 'QC'], mid: ['JC', 'JD', '8S', '8H', '3C'], tail: ['AC', 'KC', 'QD', 'QH', 'TD'] },
  },
  { // R4: admin乌龙(头>中) — bot正常赢
    label: '乌龙(admin头>中)',
    admin: { head: ['AS', 'AH', 'AD'], mid: ['3S', '3H', '4D', '5C', '6D'], tail: ['KS', 'KH', 'KC', 'QS', 'QH'] },
    bot_a: { head: ['2S', '4S', '7C'], mid: ['8S', '8H', '9D', 'TC', 'JC'], tail: ['TD', 'JD', 'QD', 'KD', 'AC'] },
  },
  { // R5: 双方势均力敌 — admin赢1输1平1(中道相同牌型)
    label: '势均力敌',
    admin: { head: ['KS', 'QH', 'JD'], mid: ['9S', '9H', '8D', '7C', '6S'], tail: ['AS', 'AH', 'TD', 'TC', '2D'] },
    bot_a: { head: ['KC', 'QD', 'JS'], mid: ['5S', '5H', '4D', '3C', '2C'], tail: ['AD', 'AC', 'KH', 'KD', '8C'] },
  },
];

// ─── 3人桌 5轮 ─────────────────────────────────────────────────
const ROOM2_ROUNDS = [
  { // R1: admin打枪bot_a, bot_b中间
    label: '打枪(admin枪bot_a)',
    admin: { head: ['AS', 'AH', 'KD'], mid: ['KS', 'KH', 'KC', 'QS', 'QH'], tail: ['JS', 'TS', '9S', '8S', '7S'] },
    bot_a: { head: ['2S', '3H', '5D'], mid: ['4C', '4D', '6H', '7C', '8D'], tail: ['9H', '9C', 'TD', 'JC', 'QD'] },
    bot_b: { head: ['KD', 'QC', 'JD'].map(c => c === 'KD' ? 'JH' : c), mid: ['TH', 'TC', '6D', '2C', '3C'], tail: ['6S', '6C', '7H', '7D', 'AC'] },
  },
  { // R2: bot_b打枪admin
    label: '打枪(bot_b枪admin)',
    admin: { head: ['2S', '3D', '4H'], mid: ['5S', '5H', '6D', '7S', '8D'], tail: ['TS', 'TH', '9D', '9C', 'JD'] },
    bot_a: { head: ['KS', 'QH', 'JC'], mid: ['8S', '8H', '7C', '6C', '2C'], tail: ['AD', 'AC', 'KD', 'QD', 'TC'] },
    bot_b: { head: ['AH', 'AS', 'KH'], mid: ['JS', 'JH', 'TD', '4C', '4D'], tail: ['KC', 'QC', 'QS', '9S', '9H'] },
  },
  { // R3: 普通三方各赢各输
    label: '三方混战',
    admin: { head: ['AS', 'KH', 'QD'], mid: ['5S', '5H', '5D', '3C', '2C'], tail: ['JS', 'JH', 'JD', 'TC', 'TD'] },
    bot_a: { head: ['AH', 'KD', 'QS'], mid: ['9S', '9H', '9C', '4D', '3D'], tail: ['8S', '8H', '8D', '8C', '7S'] },
    bot_b: { head: ['AD', 'KC', 'QC'], mid: ['7H', '7D', '7C', '6S', '6H'], tail: ['TS', 'TH', 'JC', '4S', '4H'] },
  },
  { // R4: bot_a乌龙, admin和bot_b正常
    label: '乌龙(bot_a)',
    admin: { head: ['KS', 'QH', 'JD'], mid: ['9S', '9H', '8D', '7C', '5S'], tail: ['AS', 'AH', 'AD', '4C', '3C'] },
    bot_a: { head: ['AC', 'KH', 'KD'], mid: ['2S', '2H', '3D', '4D', '5D'], tail: ['QS', 'QD', 'QC', 'JC', 'JH'] },
    bot_b: { head: ['6S', '6H', '2C'], mid: ['TD', 'TC', '8S', '8H', '7D'], tail: ['TS', 'JS', 'KC', '9D', '9C'] },
  },
  { // R5: 全垒打(admin赢全部)
    label: '全垒打(admin)',
    admin: { head: ['AS', 'AH', 'AD'], mid: ['KS', 'KH', 'KC', '4C', '4D'], tail: ['JS', 'TS', '9S', '8S', '7S'] },
    bot_a: { head: ['2S', '3H', '4S'], mid: ['5S', '5H', '6D', '7C', '8D'], tail: ['9H', '9C', 'TD', 'TC', 'QD'] },
    bot_b: { head: ['2H', '3C', '5D'], mid: ['6S', '6H', '7D', '8C', '2C'], tail: ['JC', 'JH', 'JD', 'QS', 'QC'] },
  },
];

// ─── 4人桌 5轮 ─────────────────────────────────────────────────
const ROOM3_ROUNDS = [
  { // R1: admin全垒打
    label: '全垒打(admin)',
    admin: { head: ['AS', 'AH', 'AD'], mid: ['KS', 'QS', 'TS', '8S', '6S'], tail: ['JH', 'TH', '9H', '8H', '7H'] },
    bot_a: { head: ['2S', '3H', '4D'], mid: ['5C', '5D', '6H', '7C', '8D'], tail: ['9S', '9C', 'TD', 'TC', '2C'] },
    bot_b: { head: ['2H', '3C', '5S'], mid: ['4S', '4H', '6C', '7D', 'JS'], tail: ['KH', 'KC', 'JC', 'JD', '3D'] },
    bot_c: { head: ['2D', '3S', '5H'], mid: ['4C', '6D', 'KD', '7S', '8C'], tail: ['AC', 'QH', 'QC', 'QD', '9D'] },
  },
  { // R2: bot_a打枪admin
    label: '打枪(bot_a枪admin)',
    admin: { head: ['2S', '3D', '4H'], mid: ['5S', '5H', '6D', '7S', '8D'], tail: ['9S', '9H', 'TD', 'TC', 'JD'] },
    bot_a: { head: ['AS', 'AH', 'KD'], mid: ['KS', 'KH', 'QS', 'QH', '2C'], tail: ['AC', 'AD', 'KC', 'QD', 'QC'] },
    bot_b: { head: ['3S', '4D', '6C'], mid: ['7C', '7D', '8S', '8H', '3C'], tail: ['JS', 'JC', 'JH', 'TS', 'TH'] },
    bot_c: { head: ['2H', '4S', '6H'], mid: ['9C', '9D', '4C', '5D', '3H'], tail: ['8C', '7H', '6S', '5C', '2D'] },
  },
  { // R3: 多人乌龙 — admin和bot_c乌龙
    label: '双乌龙(admin+bot_c)',
    admin: { head: ['AS', 'AH', 'AD'], mid: ['2S', '3D', '4H', '5C', '6D'], tail: ['KS', 'KH', 'KC', 'QS', 'QH'] },
    bot_a: { head: ['KD', 'QC', 'JD'], mid: ['TS', 'TH', '9S', '8D', '7C'], tail: ['JS', 'JC', 'JH', 'TD', 'TC'] },
    bot_b: { head: ['3S', '4S', '5S'], mid: ['6S', '6H', '7D', '8S', '9D'], tail: ['AC', 'AH', '8H', '8C', '2C'].map(c => c === 'AH' ? 'QD' : c), },
    bot_c: { head: ['9C', '9H', '7S'], mid: ['2H', '2D', '3C', '4D', '5H'], tail: ['7H', '6C', '5D', '4C', '3H'] },
  },
  { // R4: 普通四方混战
    label: '四方混战',
    admin: { head: ['AS', 'KH', 'QD'], mid: ['JS', 'JH', 'TD', '9C', '8S'], tail: ['7S', '7H', '7D', '7C', '2S'] },
    bot_a: { head: ['AH', 'KD', 'QS'], mid: ['TS', 'TH', '9D', '8H', '6S'], tail: ['5S', '5H', '5D', '5C', '3S'] },
    bot_b: { head: ['AD', 'KC', 'QC'], mid: ['9S', '9H', '8D', '6H', '4S'], tail: ['JC', 'JD', 'TC', '3D', '3H'] },
    bot_c: { head: ['AC', 'KS', 'QH'], mid: ['8C', '6D', '6C', '4D', '4H'], tail: ['2H', '2D', '2C', 'JS', '4C'].map(c => c === 'JS' ? '3C' : c), },
  },
  { // R5: admin打枪bot_b和bot_c, 但输给bot_a
    label: '部分打枪',
    admin: { head: ['AS', 'AH', 'KD'], mid: ['QS', 'QH', 'QD', '4C', '4D'], tail: ['JS', 'TS', '9S', '8S', '7S'] },
    bot_a: { head: ['AD', 'AC', 'KS'], mid: ['KH', 'KC', 'JD', 'JC', '2C'], tail: ['TH', 'TD', 'TC', '9H', '9D'] },
    bot_b: { head: ['2S', '3H', '4S'], mid: ['5S', '5H', '6D', '7C', '8D'], tail: ['9C', '8H', '7D', '6C', '5D'] },
    bot_c: { head: ['2H', '3D', '4H'], mid: ['6S', '6H', '7H', '8C', '2D'], tail: ['QC', 'JH', 'TD', '5C', '3C'].map(c => c === 'TD' ? '3S' : c), },
  },
];

// ─── 校验牌组 ──────────────────────────────────────────────────
function checkDuplicates(label: string, ...cardSets: string[][]) {
  const all = cardSets.flat();
  const seen = new Set<string>();
  for (const c of all) {
    if (seen.has(c)) {
      console.error(`  !! ${label}: 重复牌 ${c}`);
      return false;
    }
    seen.add(c);
  }
  return true;
}

function getAllCards(hands: Record<string, { head: string[]; mid: string[]; tail: string[] }>) {
  return Object.values(hands).flatMap(h => [...h.head, ...h.mid, ...h.tail]);
}

// ═══════════════════════════════════════════════════════════════
// 主流程
// ═══════════════════════════════════════════════════════════════

async function main() {
  console.log('=== 创建测试用户 ===');
  const adminId = await login('123');
  const botAId = await login('bot_a');
  const botBId = await login('bot_b');
  const botCId = await login('bot_c');
  console.log(`  admin=${adminId.slice(0, 8)}, bot_a=${botAId.slice(0, 8)}, bot_b=${botBId.slice(0, 8)}, bot_c=${botCId.slice(0, 8)}`);

  // ─── 房间1: 2人桌 5轮 ─────────────────────────────────────
  console.log('\n=== 房间1: 2人桌 (5轮) ===');
  const game1 = await createRoom('测试-2人桌', adminId, 2);
  await joinRoom(game1.room_code, botAId);
  console.log(`  房间 code=${game1.room_code}`);

  for (let i = 0; i < ROOM1_ROUNDS.length; i++) {
    const r = ROOM1_ROUNDS[i];
    const cards = getAllCards({ admin: r.admin, bot_a: r.bot_a });
    const ok = checkDuplicates(`R1-${i + 1}`, cards);
    if (!ok) { console.log(`  跳过 R${i + 1}`); continue; }

    const round = await startRound(game1.id, adminId);
    await submitHand(game1.id, botAId, round.id, r.bot_a.head, r.bot_a.mid, r.bot_a.tail);
    await submitHand(game1.id, adminId, round.id, r.admin.head, r.admin.mid, r.admin.tail);
    await settle(game1.id, adminId, round.id);
    console.log(`  R${i + 1} [${r.label}] settled`);
  }

  // ─── 房间2: 3人桌 5轮 ─────────────────────────────────────
  console.log('\n=== 房间2: 3人桌 (5轮) ===');
  const game2 = await createRoom('测试-3人桌', adminId, 3);
  await joinRoom(game2.room_code, botAId);
  await joinRoom(game2.room_code, botBId);
  console.log(`  房间 code=${game2.room_code}`);

  for (let i = 0; i < ROOM2_ROUNDS.length; i++) {
    const r = ROOM2_ROUNDS[i];
    const cards = getAllCards({ admin: r.admin, bot_a: r.bot_a, bot_b: r.bot_b });
    const ok = checkDuplicates(`R2-${i + 1}`, cards);
    if (!ok) { console.log(`  跳过 R${i + 1}`); continue; }

    const round = await startRound(game2.id, adminId);
    await submitHand(game2.id, botAId, round.id, r.bot_a.head, r.bot_a.mid, r.bot_a.tail);
    await submitHand(game2.id, botBId, round.id, r.bot_b.head, r.bot_b.mid, r.bot_b.tail);
    await submitHand(game2.id, adminId, round.id, r.admin.head, r.admin.mid, r.admin.tail);
    await settle(game2.id, adminId, round.id);
    console.log(`  R${i + 1} [${r.label}] settled`);
  }

  // ─── 房间3: 4人桌 5轮 ─────────────────────────────────────
  console.log('\n=== 房间3: 4人桌 (5轮) ===');
  const game3 = await createRoom('测试-4人桌', adminId, 4);
  await joinRoom(game3.room_code, botAId);
  await joinRoom(game3.room_code, botBId);
  await joinRoom(game3.room_code, botCId);
  console.log(`  房间 code=${game3.room_code}`);

  for (let i = 0; i < ROOM3_ROUNDS.length; i++) {
    const r = ROOM3_ROUNDS[i];
    const cards = getAllCards({ admin: r.admin, bot_a: r.bot_a, bot_b: r.bot_b, bot_c: r.bot_c });
    const ok = checkDuplicates(`R3-${i + 1}`, cards);
    if (!ok) { console.log(`  跳过 R${i + 1}`); continue; }

    const round = await startRound(game3.id, adminId);
    await submitHand(game3.id, botAId, round.id, r.bot_a.head, r.bot_a.mid, r.bot_a.tail);
    await submitHand(game3.id, botBId, round.id, r.bot_b.head, r.bot_b.mid, r.bot_b.tail);
    await submitHand(game3.id, botCId, round.id, r.bot_c.head, r.bot_c.mid, r.bot_c.tail);
    await submitHand(game3.id, adminId, round.id, r.admin.head, r.admin.mid, r.admin.tail);
    await settle(game3.id, adminId, round.id);
    console.log(`  R${i + 1} [${r.label}] settled`);
  }

  // ─── 汇总 ──────────────────────────────────────────────────
  console.log('\n====================================');
  console.log('全部完成! 用 "123" 登录查看:');
  console.log(`  房间1 (2人桌): ${game1.room_code} — 5轮已结算`);
  console.log(`  房间2 (3人桌): ${game2.room_code} — 5轮已结算`);
  console.log(`  房间3 (4人桌): ${game3.room_code} — 5轮已结算`);
  console.log('可在牌局历史中查看或进入房间查看积分面板');
  console.log('====================================\n');
}

main().catch(err => {
  console.error('脚本执行失败:', err);
  process.exit(1);
});
