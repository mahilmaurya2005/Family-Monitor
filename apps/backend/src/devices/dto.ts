import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export enum PermissionTypeDto {
  APP_USAGE = 'APP_USAGE',
  LOCATION = 'LOCATION',
  CALL_LOGS = 'CALL_LOGS',
  NOTIFICATIONS = 'NOTIFICATIONS',
  BATTERY = 'BATTERY',
  INSTALLED_APPS = 'INSTALLED_APPS',
}

export class PermissionGrantDto {
  @IsEnum(PermissionTypeDto)
  type!: PermissionTypeDto;

  @IsBoolean()
  granted!: boolean;
}

export class RegisterDeviceDto {
  @IsString()
  displayName!: string;

  @IsString()
  deviceIdentifier!: string;

  @IsOptional()
  @IsString()
  appVersion?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PermissionGrantDto)
  permissions!: PermissionGrantDto[];
}

export class CreatePairingCodeDto {
  @IsOptional()
  @IsString()
  label?: string;
}

export class PairDeviceDto extends RegisterDeviceDto {
  @IsString()
  @MinLength(6)
  pairingCode!: string;
}
