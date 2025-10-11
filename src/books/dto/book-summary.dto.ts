export class BookSummaryDto {
  id!: string;
  title!: string;
  authorName!: string;
  coverImageUrl?: string | null;
  rating?: number | null;
  seriesName?: string | null;
  seriesOrder?: number | null;
  publishedAt?: Date | null;
}
