import { of, lastValueFrom } from 'rxjs';
import { LoggingInterceptor } from './logging.interceptor';

describe('LoggingInterceptor', () => {
  let interceptor: LoggingInterceptor;
  let originalConsoleLog: typeof console.log;

  beforeEach(() => {
    interceptor = new LoggingInterceptor();
    originalConsoleLog = console.log;
    console.log = jest.fn();
  });

  afterEach(() => {
    console.log = originalConsoleLog;
  });

  it('logs request information after handling', async () => {
    const req: any = {
      method: 'GET',
      originalUrl: '/test',
      requestId: 'req-1',
    };
    const res: any = { statusCode: 200 };

    const context: any = {
      switchToHttp: () => ({
        getRequest: () => req,
        getResponse: () => res,
      }),
    };

    const next: any = {
      handle: () => of({ ok: true }),
    };

    await lastValueFrom(interceptor.intercept(context, next));

    expect(console.log).toHaveBeenCalled();
    const logArg = (console.log as jest.Mock).mock.calls[0][0] as string;
    expect(logArg).toContain('GET');
    expect(logArg).toContain('/test');
    expect(logArg).toContain('200');
  });
});
