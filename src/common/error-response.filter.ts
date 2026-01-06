import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response, Request } from 'express';

@Catch()
export class ErrorResponseFilter implements ExceptionFilter {
  private readonly logger = new Logger(ErrorResponseFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const requestId = (request as any).requestId as string | undefined;

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string | string[] = 'Internal server error';
    let code: string | undefined;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
        const responseObj = exceptionResponse as Record<string, unknown>;
        message = Array.isArray(responseObj.message)
          ? responseObj.message
          : (responseObj.message as string) || exception.message;
        code = responseObj.code as string | undefined;
      } else {
        message = exception.message;
      }
    } else {
      if (exception instanceof Error) {
        this.logger.error(
          'Unhandled error:',
          exception.message,
          exception.stack,
        );
      } else {
        this.logger.error('Unhandled error (non-Error):', exception);
      }
    }

    this.logger.error(
      `${request.method} ${request.url} - ${status} - ${Array.isArray(message) ? message.join(', ') : message}`,
      exception instanceof Error ? exception.stack : undefined,
    );

    response.status(status).json({
      success: false,
      statusCode: status,
      error: HttpStatus[status] || 'Error',
      message,
      code,
      path: request.originalUrl,
      method: request.method,
      requestId,
      timestamp: new Date().toISOString(),
    });
  }
}
