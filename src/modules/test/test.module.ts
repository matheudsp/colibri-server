import { Module } from '@nestjs/common';
import { TestController } from './test.controller';

import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  controllers: [TestController],
  imports: [NotificationsModule],
})
export class TestModule {}
