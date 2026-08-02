import { Reflector } from '@nestjs/core';
import { RolesGuard } from './roles.guard';

function contextFor(role?: string) {
  return {
    getHandler: () => contextFor,
    getClass: () => RolesGuard,
    switchToHttp: () => ({
      getRequest: () => ({ user: role ? { role } : undefined }),
    }),
  } as never;
}

describe('RolesGuard', () => {
  it('allows requests when no roles are required', () => {
    const reflector = { getAllAndOverride: jest.fn().mockReturnValue(undefined) } as unknown as Reflector;
    const guard = new RolesGuard(reflector);

    expect(guard.canActivate(contextFor())).toBe(true);
  });

  it('allows matching role', () => {
    const reflector = { getAllAndOverride: jest.fn().mockReturnValue(['ADMIN']) } as unknown as Reflector;
    const guard = new RolesGuard(reflector);

    expect(guard.canActivate(contextFor('ADMIN'))).toBe(true);
  });

  it('blocks non-matching role', () => {
    const reflector = { getAllAndOverride: jest.fn().mockReturnValue(['ADMIN']) } as unknown as Reflector;
    const guard = new RolesGuard(reflector);

    expect(guard.canActivate(contextFor('MEMBER'))).toBe(false);
  });
});
