import type { StringValue } from 'ms';

export function jwtExpiresIn(
  value: string | undefined,
  fallback: StringValue,
): StringValue {
  const trimmed = value?.trim();
  return (trimmed && trimmed.length > 0 ? trimmed : fallback) as StringValue;
}
