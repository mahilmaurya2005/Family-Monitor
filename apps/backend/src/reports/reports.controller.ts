import { Controller, Get, Header, Query, UseGuards } from '@nestjs/common';
import {
  CurrentUser,
  type AuthenticatedUser,
} from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { ReportsService } from './reports.service';

@Controller('reports')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('daily')
  daily(@CurrentUser() user: AuthenticatedUser, @Query('deviceId') deviceId?: string) {
    return this.reportsService.summary(user.id, 'daily', deviceId);
  }

  @Get('weekly')
  weekly(@CurrentUser() user: AuthenticatedUser, @Query('deviceId') deviceId?: string) {
    return this.reportsService.summary(user.id, 'weekly', deviceId);
  }

  @Get('monthly')
  monthly(@CurrentUser() user: AuthenticatedUser, @Query('deviceId') deviceId?: string) {
    return this.reportsService.summary(user.id, 'monthly', deviceId);
  }

  @Get('export.csv')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="family-monitor-report.csv"')
  exportCsv(
    @CurrentUser() user: AuthenticatedUser,
    @Query('period') period: 'daily' | 'weekly' | 'monthly' = 'daily',
    @Query('deviceId') deviceId?: string,
  ) {
    return this.reportsService.exportCsv(user.id, period, deviceId);
  }
}
