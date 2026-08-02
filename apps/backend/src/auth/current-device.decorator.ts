import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export type AuthenticatedDevice = {
  id: string;
  ownerId: string;
};

export const CurrentDevice = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthenticatedDevice => {
    const request = context.switchToHttp().getRequest<{ device: AuthenticatedDevice }>();
    return request.device;
  },
);
