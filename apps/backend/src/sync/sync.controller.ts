import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import {
  CurrentDevice,
  type AuthenticatedDevice,
} from '../auth/current-device.decorator';
import { DeviceAuthGuard } from '../auth/device-auth.guard';
import {
  AppUsageBatchDto,
  BatteryBatchDto,
  CallLogBatchDto,
  LocationBatchDto,
  NotificationBatchDto,
} from './dto';
import { SyncService } from './sync.service';

@Controller('sync')
@UseGuards(DeviceAuthGuard)
export class SyncController {
  constructor(private readonly syncService: SyncService) {}

  @Post('app-usage')
  appUsage(@CurrentDevice() device: AuthenticatedDevice, @Body() dto: AppUsageBatchDto) {
    return this.syncService.appUsage(device, dto);
  }

  @Post('battery')
  battery(@CurrentDevice() device: AuthenticatedDevice, @Body() dto: BatteryBatchDto) {
    return this.syncService.battery(device, dto);
  }

  @Post('location')
  location(@CurrentDevice() device: AuthenticatedDevice, @Body() dto: LocationBatchDto) {
    return this.syncService.location(device, dto);
  }

  @Post('call-logs')
  callLogs(@CurrentDevice() device: AuthenticatedDevice, @Body() dto: CallLogBatchDto) {
    return this.syncService.callLogs(device, dto);
  }

  @Post('notifications')
  notifications(@CurrentDevice() device: AuthenticatedDevice, @Body() dto: NotificationBatchDto) {
    return this.syncService.notifications(device, dto);
  }
}
