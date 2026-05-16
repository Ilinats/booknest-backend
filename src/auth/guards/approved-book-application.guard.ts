import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Application } from '../../applications/entity/application.entity';
import { ApplicationStatus } from '../../applications/enums';
import { JwtPayload } from '../decorators/current-user.decorator';
import { BookErrors } from '../../books/errors/book-errors';

@Injectable()
export class ApprovedBookApplicationGuard implements CanActivate {
  constructor(
    @InjectRepository(Application)
    private readonly applicationRepo: Repository<Application>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user as JwtPayload;
    const bookId = request.params.bookId as string;

    const application = await this.applicationRepo.findOne({
      where: {
        readerId: user.sub,
        bookId,
        status: ApplicationStatus.APPROVED,
      },
    });

    if (!application) {
      throw new ForbiddenException(BookErrors.BOOK_NO_COPIES_AVAILABLE);
    }

    return true;
  }
}
