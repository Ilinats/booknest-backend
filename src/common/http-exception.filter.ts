import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class HttpErrorFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const req = ctx.getRequest<Request>();
    const res = ctx.getResponse<Response>();

    const requestId = (req as any).requestId as string | undefined;

    let status: number;
    let message: string | string[];
    let code: string | undefined;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const response = exception.getResponse() as any;
      message = Array.isArray(response?.message) ? response.message : response?.message || exception.message;
      code = response?.code;
    } else {
      status = HttpStatus.INTERNAL_SERVER_ERROR;
      message = 'Internal server error';
    }

    const payload = {
      success: false,
      statusCode: status,
      error: HttpStatus[status] || 'Error',
      message,
      code,
      path: req.originalUrl,
      method: req.method,
      requestId,
      timestamp: new Date().toISOString(),
    };

    res.status(status).json(payload);
  }
} 