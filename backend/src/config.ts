import 'dotenv/config';

export const config = {
  port: Number(process.env.PORT ?? 4000),
  databaseUrl: process.env.DATABASE_URL ?? '',
  jwtSecret: process.env.JWT_SECRET ?? '',
  ownerUsername: process.env.OWNER_USERNAME ?? 'Umm Raaidah',
  ownerPassword: process.env.OWNER_PASSWORD ?? '',
  frontendUrl: process.env.FRONTEND_URL ?? 'http://localhost:5173'
};

if (!config.databaseUrl && process.env.NODE_ENV !== 'test') {
  console.warn('DATABASE_URL is not set. Database requests will fail until it is configured.');
}
if (!config.jwtSecret && process.env.NODE_ENV !== 'test') {
  console.warn('JWT_SECRET is not set. Set a strong secret before starting the server.');
}
