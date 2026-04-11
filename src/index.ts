import './env';
import app from './app';
import { connectDB } from './config/db';
import { ensureDefaultAdmin } from './utils/seedDefaultAdmin';
import { isClerkEnabled } from './config/clerk';

const port = Number(process.env.PORT) || 4000;

async function main() {
  await connectDB();
  if (!isClerkEnabled()) {
    await ensureDefaultAdmin();
  } else {
    console.log('[clerk] Authentication via Clerk — skipping default admin seed.');
    if (!process.env.CLERK_PUBLISHABLE_KEY?.trim()) {
      console.warn(
        '[clerk] CLERK_PUBLISHABLE_KEY is unset in server/.env — set it (Dashboard → API Keys) to match your Clerk app.',
      );
    }
    console.log(
      '[clerk] Use the same Clerk application for VITE_CLERK_PUBLISHABLE_KEY (client) and CLERK_SECRET_KEY (server).',
    );
  }
  const server = app.listen(port, () => {
    console.log(`Server listening on http://localhost:${port}`);
  });
  server.on('error', (err: NodeJS.ErrnoException) => {
    if (err.code === 'EADDRINUSE') {
      console.error(
        `\n[server] Port ${port} is already in use.\n` +
          `  • Stop the other API (close the terminal running the server, or end the Node process).\n` +
          `  • Windows: netstat -ano | findstr :${port}  then  taskkill /PID <pid> /F\n` +
          `  • Or set PORT=4001 in server/.env and set Vite proxy target to http://localhost:4001\n`,
      );
    } else {
      console.error('[server] HTTP server error:', err);
    }
    process.exit(1);
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
