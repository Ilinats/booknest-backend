import { CustomLogger } from './logger.service';

jest.mock('winston', () => {
  const transports = { Console: jest.fn() };
  const logger = {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
    verbose: jest.fn(),
  };
  return {
    __esModule: true,
    default: {},
    createLogger: jest.fn(() => logger),
    transports,
    format: {
      combine: jest.fn(),
      timestamp: jest.fn(),
      printf: jest.fn(),
    },
  };
});

import * as winston from 'winston';

describe('CustomLogger', () => {
  let logger: CustomLogger;
  let winstonLogger: any;

  beforeEach(() => {
    (winston.createLogger as jest.Mock).mockClear();
    logger = new CustomLogger();
    winstonLogger = (winston.createLogger as jest.Mock).mock.results[0].value;
  });

  it('should call winston info on log', () => {
    logger.log('test');
    expect(winstonLogger.info).toHaveBeenCalledWith('test');
  });

  it('should call winston error on error', () => {
    logger.error('err', 'trace');
    expect(winstonLogger.error).toHaveBeenCalledWith('err\ntrace');
  });

  it('should call winston error with message only when trace omitted', () => {
    logger.error('err');
    expect(winstonLogger.error).toHaveBeenCalledWith('err');
  });

  it('should call winston warn on warn', () => {
    logger.warn('warn');
    expect(winstonLogger.warn).toHaveBeenCalledWith('warn');
  });

  it('should call winston debug on debug', () => {
    logger.debug('debug msg');
    expect(winstonLogger.debug).toHaveBeenCalledWith('debug msg');
  });

  it('should call winston verbose on verbose', () => {
    logger.verbose('verbose msg');
    expect(winstonLogger.verbose).toHaveBeenCalledWith('verbose msg');
  });
});
