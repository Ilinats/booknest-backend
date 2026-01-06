import { BasePaginationDto } from '../../common/dto/base-pagination.dto';

export class FindFollowedAuthorsDto extends BasePaginationDto {}

export class FindAuthorFollowersDto extends BasePaginationDto {}

export class FindBooksFromFollowedAuthorsDto extends BasePaginationDto {}
