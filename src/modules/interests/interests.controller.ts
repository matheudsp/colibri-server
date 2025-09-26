import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags, ApiBody } from '@nestjs/swagger';
import { Roles } from 'src/common/decorator/roles.decorator';
import { ROLES } from 'src/common/constants/roles.constant';
import {
  CurrentUser,
  RequireAuth,
} from 'src/common/decorator/current-user.decorator';
import { JwtPayload } from 'src/common/interfaces/jwt.payload.interface';
import { InterestsService } from './interests.service';
import { CreateInterestDto } from './dto/create-interest.dto';
import { UpdateInterestStatusDto } from './dto/update-interest-status.dto';

@ApiTags('Interests')
@ApiBearerAuth()
@RequireAuth()
@Controller('interests')
export class InterestsController {
  constructor(private readonly interestsService: InterestsService) {}

  @Post()
  @Roles(ROLES.LOCATARIO, ROLES.ADMIN, ROLES.LOCADOR)
  @ApiOperation({
    summary: 'Envia uma manifestação de interesse para um imóvel.',
  })
  @ApiBody({ type: CreateInterestDto })
  create(
    @Body() createInterestDto: CreateInterestDto,
    @CurrentUser() currentUser: JwtPayload,
  ) {
    return this.interestsService.create(createInterestDto, currentUser);
  }

  @Get('received')
  @Roles(ROLES.LOCADOR)
  @ApiOperation({ summary: 'Lista os interesses recebidos pelo locador.' })
  findReceived(@CurrentUser() currentUser: JwtPayload) {
    return this.interestsService.findReceived(currentUser);
  }

  @Get('sent')
  @Roles(ROLES.LOCATARIO)
  @ApiOperation({ summary: 'Lista os interesses enviados pelo locatário.' })
  findSent(@CurrentUser() currentUser: JwtPayload) {
    return this.interestsService.findSent(currentUser);
  }

  @Patch(':id/status')
  @Roles(ROLES.LOCADOR)
  @ApiOperation({
    summary: 'Atualiza o status de um interesse (ex: CONTACTED, DISMISSED).',
  })
  @ApiBody({ type: UpdateInterestStatusDto })
  updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateStatusDto: UpdateInterestStatusDto,
    @CurrentUser() currentUser: JwtPayload,
  ) {
    return this.interestsService.updateStatus(id, updateStatusDto, currentUser);
  }
}
