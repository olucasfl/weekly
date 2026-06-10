import { env } from './env.js';
import { buildApp } from './app.js';
import { connectDatabase, disconnectDatabase } from './lib/prisma.js';
import { startNotificationJob } from './jobs/notifications.js';

async function main() {
  const app = await buildApp();
  await connectDatabase();
  startNotificationJob();
  await app.listen({ port: env.PORT, host: env.HOST });
  console.log(`API ready on http://localhost:${env.PORT}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

process.on('SIGINT', async () => {
  await disconnectDatabase();
  process.exit(0);
});
