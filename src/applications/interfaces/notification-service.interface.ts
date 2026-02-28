export interface IApplicationNotificationService {
  notifyApplicationApproved: (
    readerId: string,
    bookId: string,
    bookTitle: string,
    applicationId: string,
  ) => Promise<void>;
  notifyApplicationRejected: (
    readerId: string,
    bookId: string,
    bookTitle: string,
    applicationId: string,
  ) => Promise<void>;
}
