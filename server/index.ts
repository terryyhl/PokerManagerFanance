import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import rateLimit from 'express-rate-limit';
import usersRouter from './routes/users.js';
import gamesRouter from './routes/games.js';
import buyInRouter from './routes/buyin.js';
import settlementRouter from './routes/settlement.js';
import luckyHandsRouter from './routes/lucky_hands.js';
import { startCronJobs } from './cron.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// 启动定时任务（自动关闭 24 小时以上的活跃房间）
startCronJobs();

// ─── Middleware ────────────────────────────────────────────────────────────
// #22 速率限制
const apiLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 分钟
    max: 100, // 每个 IP 每分钟最多 100 次请求
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: '请求过于频繁，请稍后再试' },
});

const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 分钟
    max: 30, // 每个 IP 15 分钟最多 30 次登录尝试
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: '登录尝试过于频繁，请稍后再试' },
});

const joinLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 分钟
    max: 20, // 每个 IP 每分钟最多 20 次加入尝试（防止暴力猜测房间码）
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: '加入房间请求过于频繁，请稍后再试' },
});

// CORS: 限制允许的来源
const allowedOrigins = process.env.APP_URL
    ? [process.env.APP_URL, 'http://localhost:3000']
    : ['http://localhost:3000'];

app.use(cors({
    origin: (origin, callback) => {
        // 允许无 origin 的请求（如移动端 App、服务器端请求）
        if (!origin || allowedOrigins.some(allowed => origin.startsWith(allowed))) {
            callback(null, true);
        } else {
            callback(null, true); // 仍允许，但生产环境可改为 callback(new Error('Not allowed by CORS'))
        }
    },
}));

app.use(express.json());
app.use('/api', apiLimiter);

// ─── Diagnostics ──────────────────────────────────────────────────────────
console.log('--- Environment Diagnostics ---');
console.log(`Supabase URL: ${process.env.SUPABASE_URL ? 'Configured' : 'MISSING'}`);
console.log(`Supabase Key: ${process.env.SUPABASE_ANON_KEY ? 'Configured' : 'MISSING'}`);
console.log(`NODE_ENV: ${process.env.NODE_ENV}`);
console.log('-------------------------------');

// ─── Routes ───────────────────────────────────────────────────────────────
app.use('/api/users', loginLimiter, usersRouter);
app.use('/api/games', gamesRouter);
app.post('/api/games/join', joinLimiter); // 额外的加入房间速率限制
app.use('/api/buyin', buyInRouter);
app.use('/api/checkout', buyInRouter);
app.use('/api/settlement', settlementRouter);
app.use('/api/lucky-hands', luckyHandsRouter);

// ─── Health Check ─────────────────────────────────────────────────────────
app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ─── 404 Handler ──────────────────────────────────────────────────────────
app.use((_req, res) => {
    res.status(404).json({ error: 'Not Found' });
});

// ─── Error Handler ────────────────────────────────────────────────────────
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error('[Server Error]', err);
    res.status(500).json({ error: '服务器内部错误' });
});

// ─── Start ────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
    console.log(`Backend server running: http://localhost:${PORT}`);
});

export default app;
