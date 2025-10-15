export class ApplicationSummaryDto {
  id!: string;
  status!: string;
  appliedAt!: Date;
  respondedAt?: Date | null;
  applicationMessage?: string | null;
  authorNotes?: string | null;
  
  bookId!: string;
  bookTitle!: string;
  bookCoverImageUrl?: string | null;
  authorName!: string;
  
  readingStatus!: string;
  readingStartedAt?: Date | null;
  readingCompletedAt?: Date | null;
  copySentAt?: Date | null;
  copyReceivedAt?: Date | null;
  reviewSubmittedAt?: Date | null;
  
  reader?: {
    id: string;
    username: string;
    email: string;
    firstName: string;
    lastName: string;
    profilePictureUrl?: string | null;
  };
}
