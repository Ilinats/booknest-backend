import { ArgumentsHost, BadRequestException, HttpStatus } from '@nestjs/common';
import { ErrorResponseFilter } from './error-response.filter';

describe('ErrorResponseFilter', () => {
  let filter: ErrorResponseFilter;

  beforeEach(() => {
    filter = new ErrorResponseFilter();
    (filter as any).logger = {
      error: jest.fn(),
    };
  });

  function createHost() {
    const json = jest.fn();
    const status = jest.fn().mockReturnValue({ json });
    const response = { status } as any;
    const request = {
      method: 'GET',
      url: '/test',
      originalUrl: '/test',
    } as any;

    const host: ArgumentsHost = {
      switchToHttp: () => ({
        getResponse: () => response,
        getRequest: () => request,
      }),
    } as any;

    return { host, response, request, status, json };
  }

  it('handles HttpException and returns structured error', () => {
    const exception = new BadRequestException({
      message: 'Invalid data',
      code: 'BAD_DATA',
    });
    const { host, status, json } = createHost();

    filter.catch(exception, host);

    expect(status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        statusCode: HttpStatus.BAD_REQUEST,
        message: 'Invalid data',
        code: 'BAD_DATA',
      }),
    );
  });

  it('handles generic Error as internal server error', () => {
    const exception = new Error('Unexpected');
    const { host, status, json } = createHost();

    filter.catch(exception, host);

    expect(status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        error: 'INTERNAL_SERVER_ERROR',
      }),
    );
  });

  it('handles HttpException with string response (non-object)', () => {
    const exception = new BadRequestException('Plain error message');
    const { host, status, json } = createHost();

    filter.catch(exception, host);

    expect(status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        statusCode: HttpStatus.BAD_REQUEST,
        message: 'Plain error message',
      }),
    );
  });

  it('handles HttpException with array message in response object', () => {
    const exception = new BadRequestException({
      message: ['error one', 'error two'],
      code: 'VALIDATION_ERROR',
    });
    const { host, status, json } = createHost();

    filter.catch(exception, host);

    expect(status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        statusCode: HttpStatus.BAD_REQUEST,
        message: ['error one', 'error two'],
        code: 'VALIDATION_ERROR',
      }),
    );
  });

  it('handles non-Error exception (e.g. string throw)', () => {
    const { host, status, json } = createHost();

    filter.catch('something went wrong', host);

    expect(status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message: 'Internal server error',
      }),
    );
  });

  it('includes requestId in response when present on request', () => {
    const exception = new BadRequestException('Bad');
    const { host, json, request } = createHost();
    request.requestId = 'req-123';

    filter.catch(exception, host);

    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({ requestId: 'req-123' }),
    );
  });
});
