import { PrismaClient } from '@prisma/client';
import { hash } from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const email = process.env.SEED_ADMIN_EMAIL ?? 'admin@example.com';
  const password = process.env.SEED_ADMIN_PASSWORD ?? 'ChangeMe123!';

  const admin = await prisma.user.upsert({
    where: { email },
    update: {},
    create: {
      email,
      name: 'Admin',
      role: 'ADMIN',
      passwordHash: await hash(password, 12),
    },
  });

  const now = new Date();
  const pixel = await prisma.device.upsert({
    where: { deviceIdentifier: 'seed-pixel-8-home' },
    update: { ownerId: admin.id, lastSyncAt: now },
    create: {
      ownerId: admin.id,
      displayName: 'Pixel 8 - Home',
      deviceIdentifier: 'seed-pixel-8-home',
      appVersion: '0.1.0',
      lastSyncAt: now,
    },
  });

  const samsung = await prisma.device.upsert({
    where: { deviceIdentifier: 'seed-samsung-a54' },
    update: { ownerId: admin.id },
    create: {
      ownerId: admin.id,
      displayName: 'Samsung A54',
      deviceIdentifier: 'seed-samsung-a54',
      appVersion: '0.1.0',
    },
  });

  for (const device of [pixel, samsung]) {
    for (const type of ['APP_USAGE', 'BATTERY', 'LOCATION'] as const) {
      await prisma.devicePermission.upsert({
        where: { deviceId_type: { deviceId: device.id, type } },
        update: { granted: true, grantedAt: now, revokedAt: null },
        create: {
          deviceId: device.id,
          type,
          granted: true,
          disclosedAt: now,
          grantedAt: now,
        },
      });
    }
  }

  await prisma.appUsageLog.createMany({
    data: [
      {
        deviceId: pixel.id,
        packageName: 'com.whatsapp',
        appName: 'WhatsApp',
        openedAt: new Date(now.getTime() - 1000 * 60 * 90),
        closedAt: now,
        durationMillis: 7200000,
      },
      {
        deviceId: pixel.id,
        packageName: 'com.instagram.android',
        appName: 'Instagram',
        openedAt: new Date(now.getTime() - 1000 * 60 * 150),
        closedAt: new Date(now.getTime() - 1000 * 60 * 60),
        durationMillis: 5400000,
      },
      {
        deviceId: samsung.id,
        packageName: 'com.android.chrome',
        appName: 'Chrome',
        openedAt: new Date(now.getTime() - 1000 * 60 * 45),
        closedAt: now,
        durationMillis: 2700000,
      },
    ],
  });

  await prisma.locationLog.createMany({
    data: [
      {
        deviceId: pixel.id,
        latitude: 23.0225,
        longitude: 72.5714,
        accuracyM: 24,
        recordedAt: now,
      },
      {
        deviceId: samsung.id,
        latitude: 23.025,
        longitude: 72.58,
        accuracyM: 31,
        recordedAt: now,
      },
    ],
  });

  await prisma.notificationLog.createMany({
    data: [
      {
        deviceId: pixel.id,
        packageName: 'com.whatsapp',
        appName: 'WhatsApp',
        title: 'Notification received',
        body: 'Notification access sample',
        postedAt: now,
      },
    ],
  });

  console.log(`Seeded admin user: ${email}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
