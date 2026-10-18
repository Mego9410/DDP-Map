// Loads .env.local / .env for scripts run with tsx (Vercel injects env in production).
for (const f of ['.env.local', '.env']) {
  try {
    process.loadEnvFile(f);
  } catch {
    // file not present
  }
}

export function need(name: string): string {
  const v = process.env[name];
  if (!v) {
    console.error(`Missing ${name}. Add it to .env.local (see .env.example).`);
    process.exit(1);
  }
  return v;
}
