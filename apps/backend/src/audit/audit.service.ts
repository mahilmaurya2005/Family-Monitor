import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  record(actorId: string | null, action: string, target: string, metadata?: unknown) {
    return this.prisma.auditLog.create({
      data: {
        actorId,
        action,
        target,
        metadata: metadata === undefined ? undefined : JSON.parse(JSON.stringify(metadata)),
      },
    });
  }

  list(actorId: string) {
    return this.prisma.auditLog.findMany({
      where: { actorId },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }
}
