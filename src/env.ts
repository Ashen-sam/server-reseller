import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

const root = process.cwd();
const envPath = path.join(root, '.env');
const examplePath = path.join(root, '.env.example');

if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
} else if (fs.existsSync(examplePath)) {
  console.warn(
    '[config] No .env file found — loading variables from .env.example. Create a .env file for local secrets.'
  );
  dotenv.config({ path: examplePath });
} else {
  dotenv.config();
}
