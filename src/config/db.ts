import mongoose from 'mongoose';

export async function connectDB(): Promise<void> {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error('MONGODB_URI is not set');
  }
  try {
    await mongoose.connect(uri);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const code =
      e && typeof e === 'object' && 'code' in e && typeof (e as { code: unknown }).code === 'number'
        ? (e as { code: number }).code
        : undefined;
    const looksLocal = /127\.0\.0\.1|localhost/i.test(uri);
    if (looksLocal && /ECONNREFUSED|connect ECONNREFUSED/i.test(msg)) {
      console.error(`
Cannot reach MongoDB at ${uri}

• Start Mongo locally, e.g. from the server folder:
    docker compose up -d

• Or use Atlas: copy server/.env.example to server/.env and set MONGODB_URI to your
  mongodb+srv://… connection string (include a database name, e.g. …/reseller?…).
`);
    }
    if (/bad auth|authentication failed/i.test(msg) || code === 8000) {
      console.error(`
Atlas rejected the database username/password (bad auth).

Check in MongoDB Atlas:
  • Database Access → user exists, password is correct (reset if unsure).
  • Use the "Database user" name and password, not your Atlas account login.

In server/.env, if the password contains @ # : / ? & % + or spaces, it must be URL-encoded.
Example in Node: encodeURIComponent('p@ss:word')  →  put that result in the URI instead of the raw password.

Use Atlas → Connect → Drivers → copy the SRV string, then replace <password> with the encoded password.
Add a database name before the query string, e.g. ...mongodb.net/reseller?retryWrites=true&w=majority
`);
    }
    throw e;
  }
}
