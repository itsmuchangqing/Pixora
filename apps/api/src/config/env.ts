import 'dotenv/config';

function readPort(value: string | undefined, fallback: number): number {
  const port = Number(value ?? fallback);

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`Invalid PORT value: ${value}`);
  }

  return port;
}

export const env = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: readPort(process.env.PORT, 3001),
  corsOrigin: process.env.CORS_ORIGIN ?? 'http://localhost:5173',
  isProduction: process.env.NODE_ENV === 'production',
} as const;
