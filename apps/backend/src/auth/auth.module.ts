import { Global, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { DeviceAuthGuard } from './device-auth.guard';
import { JwtAuthGuard } from './jwt-auth.guard';
import { RolesGuard } from './roles.guard';

@Global()
@Module({
  imports: [JwtModule.register({})],
  controllers: [AuthController],
  providers: [AuthService, DeviceAuthGuard, JwtAuthGuard, RolesGuard],
  exports: [AuthService, DeviceAuthGuard, JwtAuthGuard, JwtModule, RolesGuard],
})
export class AuthModule {}
