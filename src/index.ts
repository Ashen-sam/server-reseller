import './env';
import app from './app';
import { connectDB } from './config/db';
import { ensureDefaultAdmin } from './utils/seedDefaultAdmin';

const port = Number(process.env.PORT) || 4000;

async function main() {
  await connectDB();
  await ensureDefaultAdmin();
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
