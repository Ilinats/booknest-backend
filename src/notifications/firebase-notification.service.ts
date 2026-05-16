import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as admin from 'firebase-admin';
import * as path from 'path';
import * as fs from 'fs';

export interface NotificationPayload {
  title: string;
  body: string;
  data?: Record<string, unknown>;
  imageUrl?: string;
}

@Injectable()
export class FirebaseNotificationService {
  private readonly logger = new Logger(FirebaseNotificationService.name);
  private firebaseApp: admin.app.App | null = null;

  constructor(private configService: ConfigService) {
    this.initializeFirebase();
  }

  private initializeFirebase() {
    try {
      const serviceAccountPath = this.configService.get<string>(
        'FIREBASE_SERVICE_ACCOUNT_PATH',
      );
      const serviceAccountJson = this.configService.get<string>(
        'FIREBASE_SERVICE_ACCOUNT_JSON',
      );

      if (serviceAccountPath) {
        const resolvedPath = path.isAbsolute(serviceAccountPath)
          ? serviceAccountPath
          : path.resolve(process.cwd(), serviceAccountPath);

        this.logger.log(
          `Attempting to load Firebase service account from: ${resolvedPath}`,
        );

        if (!fs.existsSync(resolvedPath)) {
          this.logger.error(
            `Firebase service account file not found at: ${resolvedPath}`,
          );
          return;
        }

        const serviceAccount = JSON.parse(
          fs.readFileSync(resolvedPath, 'utf8'),
        );
        this.firebaseApp = admin.initializeApp({
          credential: admin.credential.cert(serviceAccount),
        });
        this.logger.log(
          'Firebase initialized successfully using service account path',
        );
      } else if (serviceAccountJson) {
        const serviceAccount = JSON.parse(serviceAccountJson);
        this.firebaseApp = admin.initializeApp({
          credential: admin.credential.cert(serviceAccount),
        });
        this.logger.log(
          'Firebase initialized successfully using service account JSON',
        );
      } else {
        this.logger.warn(
          'Firebase not initialized: No service account configured. Set FIREBASE_SERVICE_ACCOUNT_PATH or FIREBASE_SERVICE_ACCOUNT_JSON environment variable.',
        );
      }
    } catch (error) {
      this.logger.error('Failed to initialize Firebase:', error);
      this.logger.error('Error details:', error?.message);
      this.logger.error(
        'Push notifications will not be sent until Firebase is properly configured.',
      );
    }
  }

  async sendNotification(
    token: string,
    payload: NotificationPayload,
  ): Promise<boolean> {
    if (!this.firebaseApp) {
      this.logger.warn('Firebase not initialized, skipping notification');
      return false;
    }

    try {
      const message: admin.messaging.Message = {
        token,
        notification: {
          title: payload.title,
          body: payload.body,
          imageUrl: payload.imageUrl,
        },
        data: payload.data
          ? Object.fromEntries(
              Object.entries(payload.data).map(([key, value]) => [
                key,
                String(value),
              ]),
            )
          : undefined,
        android: {
          priority: 'high',
          notification: {
            channelId: 'default',
            sound: 'default',
          },
        },
        apns: {
          payload: {
            aps: {
              sound: 'default',
              badge: 1,
            },
          },
        },
      };

      const response = await admin.messaging().send(message);
      this.logger.log(`Successfully sent notification: ${response}`);
      return true;
    } catch (error: unknown) {
      const { message, stack, code } = this.extractFirebaseError(error);
      this.logger.error(`Error sending notification: ${message}`, stack);

      if (
        code === 'messaging/invalid-registration-token' ||
        code === 'messaging/registration-token-not-registered'
      ) {
        this.logger.warn(`Invalid token, should be removed: ${token}`);
        return false;
      }

      return false;
    }
  }

  async sendNotificationToMultiple(
    tokens: string[],
    payload: NotificationPayload,
  ): Promise<{ success: number; failure: number }> {
    if (!this.firebaseApp) {
      this.logger.warn('Firebase not initialized, skipping notifications');
      return { success: 0, failure: tokens.length };
    }

    if (tokens.length === 0) {
      return { success: 0, failure: 0 };
    }

    try {
      const message: admin.messaging.MulticastMessage = {
        tokens,
        notification: {
          title: payload.title,
          body: payload.body,
          imageUrl: payload.imageUrl,
        },
        data: payload.data
          ? Object.fromEntries(
              Object.entries(payload.data).map(([key, value]) => [
                key,
                String(value),
              ]),
            )
          : undefined,
        android: {
          priority: 'high',
          notification: {
            channelId: 'default',
            sound: 'default',
          },
        },
        apns: {
          payload: {
            aps: {
              sound: 'default',
              badge: 1,
            },
          },
        },
      };

      const response = await admin.messaging().sendEachForMulticast(message);

      this.logger.log(
        `Successfully sent ${response.successCount} notifications, ${response.failureCount} failed`,
      );

      return {
        success: response.successCount,
        failure: response.failureCount,
      };
    } catch (error: unknown) {
      const { message, stack } = this.extractFirebaseError(error);
      this.logger.error(
        `Error sending multicast notification: ${message}`,
        stack,
      );
      return { success: 0, failure: tokens.length };
    }
  }

  async sendToTopic(
    topic: string,
    payload: NotificationPayload,
  ): Promise<boolean> {
    if (!this.firebaseApp) {
      this.logger.warn('Firebase not initialized, skipping notification');
      return false;
    }

    try {
      const message: admin.messaging.Message = {
        topic,
        notification: {
          title: payload.title,
          body: payload.body,
          imageUrl: payload.imageUrl,
        },
        data: payload.data
          ? Object.fromEntries(
              Object.entries(payload.data).map(([key, value]) => [
                key,
                String(value),
              ]),
            )
          : undefined,
      };

      const response = await admin.messaging().send(message);
      this.logger.log(`Successfully sent topic notification: ${response}`);
      return true;
    } catch (error: unknown) {
      const { message, stack } = this.extractFirebaseError(error);
      this.logger.error(`Error sending topic notification: ${message}`, stack);
      return false;
    }
  }

  private extractFirebaseError(error: unknown): {
    message: string;
    stack?: string;
    code?: string;
  } {
    if (error && typeof error === 'object') {
      const typedError = error as {
        message?: unknown;
        stack?: unknown;
        code?: unknown;
      };

      return {
        message:
          typeof typedError.message === 'string'
            ? typedError.message
            : String(error),
        stack:
          typeof typedError.stack === 'string' ? typedError.stack : undefined,
        code: typeof typedError.code === 'string' ? typedError.code : undefined,
      };
    }

    return { message: String(error) };
  }
}
