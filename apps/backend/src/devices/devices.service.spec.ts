import { NotFoundException, UnauthorizedException } from '@nestjs/common';
import { PermissionTypeDto } from './dto';
import { DevicesService } from './devices.service';

function createService() {
  const prisma = {
    devicePairingCode: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    device: {
      upsert: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
    },
    devicePermission: {
      upsert: jest.fn((value) => value),
    },
    $transaction: jest.fn((operations) => Promise.all(operations)),
  };
  const audit = { record: jest.fn() };
  const jwt = { signAsync: jest.fn().mockResolvedValue('device-token') };
  const config = { get: jest.fn().mockReturnValue('secret') };

  return {
    service: new DevicesService(prisma as never, audit as never, jwt as never, config as never),
    prisma,
    audit,
    jwt,
    config,
  };
}

describe('DevicesService', () => {
  it('rejects expired pairing codes', async () => {
    const { service, prisma } = createService();
    prisma.devicePairingCode.findUnique.mockResolvedValue({
      id: 'pair-1',
      ownerId: 'user-1',
      expiresAt: new Date(Date.now() - 1000),
      usedAt: null,
    });

    await expect(
      service.pair({
        pairingCode: '123-456',
        displayName: 'Device',
        deviceIdentifier: 'device-1',
        permissions: [],
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('blocks device reads outside owner scope', async () => {
    const { service, prisma } = createService();
    prisma.device.findUnique.mockResolvedValue({
      id: 'device-1',
      ownerId: 'other-user',
      permissions: [],
    });

    await expect(service.get('user-1', 'device-1')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('records audit entry after registration', async () => {
    const { service, prisma, audit } = createService();
    prisma.device.upsert.mockResolvedValue({ id: 'device-1', ownerId: 'user-1' });
    prisma.device.findUnique.mockResolvedValue({
      id: 'device-1',
      ownerId: 'user-1',
      displayName: 'Device',
      permissions: [],
    });

    await service.register('user-1', {
      displayName: 'Device',
      deviceIdentifier: 'device-1',
      permissions: [{ type: PermissionTypeDto.BATTERY, granted: true }],
    });

    expect(audit.record).toHaveBeenCalledWith(
      'user-1',
      'device.register',
      'device:device-1',
      expect.objectContaining({ permissionCount: 1 }),
    );
  });
});
