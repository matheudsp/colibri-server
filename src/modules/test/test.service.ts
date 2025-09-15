import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class TestService {
  private readonly logger = new Logger(TestService.name);

  constructor() {}
}
