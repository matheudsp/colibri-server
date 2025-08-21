// import { Controller, Post, HttpCode, HttpStatus } from '@nestjs/common';
// import { ApiOperation, ApiTags } from '@nestjs/swagger';
// import { TestService } from './test.service';
// import { Public } from 'src/common/decorator/public.decorator';

// @ApiTags('Test')
// @Controller('test')
// export class TestController {
//   constructor(private readonly testService: TestService) {}

//   @Post('queue/email')
//   @Public()
//   @HttpCode(HttpStatus.OK)
//   @ApiOperation({ summary: 'Testa a fila de e-mails adicionando um job.' })
//   async testEmailQueue() {
//     return this.testService.testEmailQueue();
//   }
// }
