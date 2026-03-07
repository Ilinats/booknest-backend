import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { FirebaseNotificationService } from './firebase-notification.service';

const messagingMock = {
  send: jest.fn().mockResolvedValue('ok'),
  sendEachForMulticast: jest
    .fn()
    .mockResolvedValue({ successCount: 1, failureCount: 0 }),
};

jest.mock('firebase-admin', () => ({
  __esModule: true,
  default: {},
  app: { App: jest.fn() },
  credential: { cert: jest.fn() },
  initializeApp: jest.fn(() => ({})),
  messaging: jest.fn(() => messagingMock),
}));

describe('FirebaseNotificationService', () => {
  let service: FirebaseNotificationService;
  let config: jest.Mocked<ConfigService>;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FirebaseNotificationService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue(null),
          },
        },
      ],
    }).compile();

    service = module.get<FirebaseNotificationService>(
      FirebaseNotificationService,
    );
    config = module.get(ConfigService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should skip sending when firebase not initialized', async () => {
    const result = await service.sendNotification('token', {
      title: 't',
      body: 'b',
    });
    expect(result).toBe(false);
  });

  it('should return zero success when sending to multiple without initialization', async () => {
    const result = await service.sendNotificationToMultiple(['t1', 't2'], {
      title: 't',
      body: 'b',
    });
    expect(result.success).toBe(0);
    expect(result.failure).toBe(2);
  });

  it('sends notification when firebaseApp is set', async () => {
    (service as any).firebaseApp = {} as any;

    const result = await service.sendNotification('token', {
      title: 'Hello',
      body: 'World',
      data: { foo: 'bar' },
    });

    expect(result).toBe(true);
    expect(messagingMock.send).toHaveBeenCalled();
  });

  it('handles invalid registration token errors', async () => {
    (service as any).firebaseApp = {} as any;

    messagingMock.send.mockRejectedValueOnce({
      code: 'messaging/invalid-registration-token',
      message: 'invalid',
    });

    const result = await service.sendNotification('token', {
      title: 'Hello',
      body: 'World',
    });

    expect(result).toBe(false);
  });

  it('sends notifications to multiple tokens when initialized', async () => {
    (service as any).firebaseApp = {} as any;

    const result = await service.sendNotificationToMultiple(['t1', 't2'], {
      title: 'Title',
      body: 'Body',
    });

    expect(result.success).toBe(1);
    expect(result.failure).toBe(0);
    expect(messagingMock.sendEachForMulticast).toHaveBeenCalled();
  });

  it('sends topic notification when initialized', async () => {
    (service as any).firebaseApp = {} as any;

    const result = await service.sendToTopic('topic', {
      title: 'T',
      body: 'B',
    });

    expect(result).toBe(true);
  });
});
