import './env';
import app from './app';
import { connectDB } from './config/db';
import { ensureDefaultAdmin } from './utils/seedDefaultAdmin';

const port = Number(process.env.PORT) || 4000;

async function main() {
  await connectDB();
  await ensureDefaultAdmin();
  app.listen(port, () => {
    console.log(`Server listening on http://localhost:${port}`);
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
