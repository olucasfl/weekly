import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  PORT: z.coerce.number().int().default(3333),
  HOST: z.string().default('0.0.0.0'),
  DATABASE_URL: z.string().default('postgresql://rotina:rotina@localhost:5432/rotina'),
  JWT_SECRET: z.string().default('dev-secret'),
  JWT_REFRESH_SECRET: z.string().default('dev-refresh-secret'),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
  VAPID_PUBLIC_KEY: z.string().default(''),
  VAPID_PRIVATE_KEY: z.string().default(''),
  VAPID_EMAIL: z.string().default('mailto:dev@weekly.app'),
  BREVO_API_KEY: z.string().default(''),
  BREVO_SENDER_EMAIL: z.string().default(''),
  BREVO_SENDER_NAME: z.string().default('Weekly'),
  APP_URL: z.string().default('http://localhost:5173'),
});

export const env = envSchema.parse(process.env);
