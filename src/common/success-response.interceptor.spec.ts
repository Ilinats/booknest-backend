import { of, lastValueFrom } from 'rxjs';
import { SuccessResponseInterceptor } from './success-response.interceptor';

describe('SuccessResponseInterceptor', () => {
  it('wraps plain data into success response', async () => {
    const interceptor = new SuccessResponseInterceptor<any>();
    const context: any = {};
    const next: any = {
      handle: () => of({ foo: 'bar' }),
    };

    const result = await lastValueFrom(interceptor.intercept(context, next));

    expect(result).toEqual({
      success: true,
      message: 'Operation successful',
      data: { foo: 'bar' },
    });
  });

  it('returns data unchanged when it already has success property', async () => {
    const interceptor = new SuccessResponseInterceptor<any>();
    const context: any = {};
    const existing = { success: false, data: { foo: 'bar' } };
    const next: any = {
      handle: () => of(existing),
    };

    const result = await lastValueFrom(interceptor.intercept(context, next));

    expect(result).toBe(existing);
  });
});
