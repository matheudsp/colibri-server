import { Module } from '@nestjs/common';
import { FlagsService } from './flags.service';

@Module({
  imports: [],
  providers: [FlagsService],
  exports: [FlagsService],
})
export class FlagsModule {}
