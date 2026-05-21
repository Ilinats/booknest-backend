import type { ConfigService } from '@nestjs/config';
import type { StringValue } from 'ms';

export function jwtExpiresIn(
  value: string | undefined,
  fallback: StringValue,
): StringValue {
  const trimmed = value?.trim();
  return (trimmed && trimmed.length > 0 ? trimmed : fallback) as StringValue;
}

export function getRefreshJwtSecret(config: ConfigService): string {
  return (
    config.get<string>('JWT_REFRESH_SECRET') ||
    `${config.get<string>('JWT_SECRET')?.trim() || 'dev_secret_change_me'}_refresh`
  );
}
