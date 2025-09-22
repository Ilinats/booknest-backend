import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable, tap } from 'rxjs';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const req = context.switchToHttp().getRequest();
    const requestId = (req as any).requestId as string | undefined;
    const start = Date.now();

    return next.handle().pipe(
      tap(() => {
        const ms = Date.now() - start;
        const method = req.method;
        const url = req.originalUrl;
        const status = context.switchToHttp().getResponse().statusCode;
        console.log(`[${requestId ?? '-'}] ${method} ${url} -> ${status} ${ms}ms`);
      }),
    );
  }
} 