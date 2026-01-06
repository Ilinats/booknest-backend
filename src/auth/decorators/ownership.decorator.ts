import { SetMetadata } from '@nestjs/common';

export const OWNERSHIP_KEY = 'ownership';

export const Ownership = (
  resource: 'book' | 'application' | 'review' | 'series' | 'user',
  paramName: string = 'id',
) => SetMetadata(OWNERSHIP_KEY, { resource, paramName });
