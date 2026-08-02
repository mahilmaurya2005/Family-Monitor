import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class DeviceSyncDto {
  @IsString()
  deviceId!: string;
}

export class AppUsageDto {
  @IsString()
  packageName!: string;

  @IsOptional()
  @IsString()
  appName?: string;

  @IsDateString()
  openedAt!: string;

  @IsOptional()
  @IsDateString()
  closedAt?: string;

  @IsInt()
  @Min(0)
  durationMillis!: number;
}

export class AppUsageBatchDto extends DeviceSyncDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AppUsageDto)
  records!: AppUsageDto[];
}

export class BatteryDto {
  @IsInt()
  @Min(0)
  @Max(100)
  level!: number;

  @IsBoolean()
  charging!: boolean;

  @IsOptional()
  @IsString()
  ringerMode?: string;

  @IsDateString()
  recordedAt!: string;
}

export class BatteryBatchDto extends DeviceSyncDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BatteryDto)
  records!: BatteryDto[];
}

export class LocationDto {
  @IsNumber()
  latitude!: number;

  @IsNumber()
  longitude!: number;

  @IsOptional()
  @IsNumber()
  accuracyM?: number;

  @IsDateString()
  recordedAt!: string;
}

export class LocationBatchDto extends DeviceSyncDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => LocationDto)
  records!: LocationDto[];
}

export class CallLogDto {
  @IsString()
  phoneNumber!: string;

  @IsOptional()
  @IsString()
  contactName?: string;

  @IsString()
  direction!: string;

  @IsDateString()
  startedAt!: string;

  @IsInt()
  @Min(0)
  durationMillis!: number;
}

export class CallLogBatchDto extends DeviceSyncDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CallLogDto)
  records!: CallLogDto[];
}

export class NotificationDto {
  @IsString()
  packageName!: string;

  @IsOptional()
  @IsString()
  appName?: string;

  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  body?: string;

  @IsDateString()
  postedAt!: string;
}

export class NotificationBatchDto extends DeviceSyncDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => NotificationDto)
  records!: NotificationDto[];
}
