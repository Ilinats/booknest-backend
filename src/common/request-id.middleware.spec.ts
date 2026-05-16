import { RequestIdMiddleware } from './request-id.middleware';

describe('RequestIdMiddleware', () => {
  let middleware: RequestIdMiddleware;

  beforeEach(() => {
    middleware = new RequestIdMiddleware();
  });

  it('adds a new x-request-id header when missing', () => {
    const req: any = { headers: {} };
    const res: any = {};
    const next = jest.fn();

    middleware.use(req, res, next);

    expect(req.headers['x-request-id']).toBeDefined();
    expect(req.requestId).toBe(req.headers['x-request-id']);
    expect(next).toHaveBeenCalled();
  });

  it('preserves existing x-request-id header', () => {
    const req: any = { headers: { 'x-request-id': 'existing-id' } };
    const res: any = {};
    const next = jest.fn();

    middleware.use(req, res, next);

    expect(req.headers['x-request-id']).toBe('existing-id');
    expect(req.requestId).toBe('existing-id');
    expect(next).toHaveBeenCalled();
  });
});
