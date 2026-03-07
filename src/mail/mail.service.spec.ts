import { Test, TestingModule } from '@nestjs/testing';
import { InternalServerErrorException } from '@nestjs/common';
import { MailService } from './mail.service';

jest.mock('nodemailer', () => {
  const sendMail = jest.fn().mockResolvedValue({});
  const createTransport = jest.fn(() => ({ sendMail }));
  return { createTransport, __esModule: true };
});

import * as nodemailer from 'nodemailer';

describe('MailService', () => {
  let service: MailService;
  const createTransportMock = nodemailer.createTransport as jest.Mock;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [MailService],
    }).compile();

    service = module.get<MailService>(MailService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  const cfg = {
    host: 'smtp.example.com',
    port: 465,
    secure: true,
    user: 'user',
    pass: 'pass',
    fromEmail: 'from@example.com',
    fromName: 'BookNest',
  };

  describe('sendVerificationEmail', () => {
    it('should send email with code when code provided', async () => {
      await service.sendVerificationEmail(
        cfg as any,
        'to@example.com',
        'url',
        '123456',
      );

      expect(createTransportMock).toHaveBeenCalled();
      const transporter = createTransportMock.mock.results[0].value;
      expect(transporter.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'to@example.com',
          subject: 'Your BookNest verification code',
        }),
      );
    });

    it('should throw InternalServerErrorException on error', async () => {
      const transporter = {
        sendMail: jest.fn().mockRejectedValue(new Error('fail')),
      };
      createTransportMock.mockReturnValueOnce(transporter);

      await expect(
        service.sendVerificationEmail(cfg as any, 'to@example.com', 'url'),
      ).rejects.toBeInstanceOf(InternalServerErrorException);
    });
  });

  describe('sendPasswordResetEmail', () => {
    it('should send reset email with code when provided', async () => {
      await service.sendPasswordResetEmail(
        cfg as any,
        'to@example.com',
        'reset-url',
        '654321',
      );

      const transporter = createTransportMock.mock.results[0].value;
      expect(transporter.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'to@example.com',
          subject: 'Your BookNest password reset code',
        }),
      );
    });

    it('should send reset email with link when code not provided', async () => {
      await service.sendPasswordResetEmail(
        cfg as any,
        'to@example.com',
        'https://app.example.com/reset?token=abc',
      );

      const transporter = createTransportMock.mock.results[0].value;
      expect(transporter.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'to@example.com',
          subject: 'Reset your BookNest password',
        }),
      );
      expect(transporter.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          text: expect.stringContaining(
            'https://app.example.com/reset?token=abc',
          ),
        }),
      );
    });
  });
});
