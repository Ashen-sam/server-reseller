import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import path from 'path';
import authRoutes from './routes/auth';
import listingRoutes from './routes/listings';
import billingRoutes from './routes/billing';
import metaRoutes from './routes/meta';

const app = express();

/** Comma-separated list, e.g. http://localhost:5173,https://app.example.com */
function corsOrigins(): string | string[] {
  const raw = process.env.CLIENT_URL || 'http://localhost:5173';
  const list = raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  return list.length === 1 ? list[0] : list;
}

app.use(
  cors({
    origin: corsOrigins(),
    credentials: true,
    maxAge: 86400,
  })
);
app.use(cookieParser());
app.use(express.json({ limit: '2mb' }));

const uploadsPath = path.join(process.cwd(), 'uploads');
app.use('/uploads', express.static(uploadsPath));

app.use('/api/auth', authRoutes);
app.use('/api/listings', listingRoutes);
app.use('/api/billing', billingRoutes);
app.use('/api', metaRoutes);

app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

export default app;
