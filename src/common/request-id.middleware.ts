import { Injectable, NestMiddleware } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(req: Request, _res: Response, next: NextFunction) {
    req.headers['x-request-id'] = (req.headers['x-request-id'] as string) || randomUUID();
    (req as any).requestId = req.headers['x-request-id'];
    next();
  }
} 