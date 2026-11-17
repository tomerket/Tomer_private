import express, { type NextFunction, type Request, type Response } from 'express';
import cookieParser from 'cookie-parser';
import { sessionRouter } from './routes/session.js';
import { familyRouter } from './routes/family.js';
import { settingsRouter } from './routes/settings.js';
import { tasksRouter } from './routes/tasks.js';
import { calendarRouter } from './routes/calendar.js';
import { shoppingRouter } from './routes/shopping.js';
import { HttpError } from './util.js';

const app = express();
app.disable('x-powered-by');
app.use(cookieParser());
app.use(express.json({ limit: '100kb' }));

app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});
app.use('/api', sessionRouter);
app.use('/api', familyRouter);
app.use('/api', settingsRouter);
app.use('/api', calendarRouter);
app.use('/api', shoppingRouter);
app.use('/api', tasksRouter);

app.use('/api', (_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof HttpError) {
    res.status(err.status).json({ error: err.message });
    return;
  }
  const e = err as { type?: string; status?: number };
  if (e?.type === 'entity.too.large') {
    res.status(413).json({ error: 'That file is too big' });
    return;
  }
  console.error(err);
  res.status(500).json({ error: 'Something went wrong. Please try again.' });
});

export default app;
