import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import usersRouter from './routes/users.js';
import gamesRouter from './routes/games.js';
import buyInRouter from './routes/buyin.js';
import settlementRouter from './routes/settlement.js';
import eventsRouter from './routes/events.js';
import { startCronJobs } from './cron.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// 启动定时任务（自动关闭 24 小时以上的活跃房间）
startCronJobs();

// ─── Middleware ────────────────────────────────────────────────────────────
app.use(cors()); // Allow all origins to avoid Vercel deployment issues
app.use(express.json());

// ─── Diagnostics ──────────────────────────────────────────────────────────
console.log('--- Environment Diagnostics ---');
console.log(`📡 Supabase URL: ${process.env.SUPABASE_URL ? '✅ Configured' : '❌ MISSING'}`);
console.log(`📡 Supabase Key: ${process.env.SUPABASE_ANON_KEY ? '✅ Configured' : '❌ MISSING'}`);
console.log(`🌍 NODE_ENV: ${process.env.NODE_ENV}`);
console.log('-------------------------------');

// ─── Routes ───────────────────────────────────────────────────────────────
app.use('/api/users', usersRouter);
app.use('/api/games', gamesRouter);
app.use('/api/buyin', buyInRouter);
app.use('/api/checkout', buyInRouter);
app.use('/api/settlement', settlementRouter);
app.use('/api/events', eventsRouter);


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
    console.log(`✅ 后端服务器运行中: http://localhost:${PORT}`);
    console.log(`📡 Supabase URL: ${process.env.SUPABASE_URL ? '已配置' : '❌ 未配置'}`);
});

export default app;
