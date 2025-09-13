import { Module } from '@nestjs/common';
// import { ClicksignController } from './clicksign.controller';
import { ClicksignService } from './clicksign.service';
import { HttpModule } from '@nestjs/axios';
import { StorageModule } from 'src/storage/storage.module';

@Module({
  imports: [
    HttpModule.registerAsync({
      useFactory: () => ({
        timeout: 5000,
        maxRedirects: 5,
      }),
    }),
    StorageModule,
  ],
  // controllers: [ClicksignController],
  providers: [ClicksignService],
  exports: [ClicksignService],
})
export class ClicksignModule {}
