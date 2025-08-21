import { Module } from '@nestjs/common';
// import { TestController } from './test.controller';
import { TestService } from './test.service';
import { QueueModule } from 'src/queue/queue.module';

@Module({
  imports: [QueueModule],
  // controllers: [TestController],
  providers: [TestService],
})
export class TestModule {}
