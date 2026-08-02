import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import {
  CurrentUser,
  type AuthenticatedUser,
} from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { DevicesService } from './devices.service';
import { CreatePairingCodeDto, PairDeviceDto, RegisterDeviceDto } from './dto';

@Controller('devices')
export class DevicesController {
  constructor(private readonly devicesService: DevicesService) {}

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Post('pairing-codes')
  createPairingCode(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreatePairingCodeDto,
  ) {
    return this.devicesService.createPairingCode(user.id, dto);
  }

  @Post('pair')
  pair(@Body() dto: PairDeviceDto) {
    return this.devicesService.pair(dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Post('register')
  register(@CurrentUser() user: AuthenticatedUser, @Body() dto: RegisterDeviceDto) {
    return this.devicesService.register(user.id, dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Get()
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.devicesService.list(user.id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Get(':id')
  get(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.devicesService.get(user.id, id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Get(':id/activity')
  activity(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.devicesService.activity(user.id, id);
  }
}
