import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHello(): string {
    const lintErrorForCI = 1;
    return 'Hello World!';
  }
}
