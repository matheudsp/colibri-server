import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from 'src/common/decorator/current-user.decorator';
import { Roles } from 'src/common/decorator/roles.decorator';
import { ROLES } from 'src/common/constants/roles.constant';
import { JwtPayload } from 'src/common/interfaces/jwt.payload.interface';
import { SubaccountsAdminService } from './subaccounts.admin.service';

@ApiTags('Admin - Subaccounts')
@Controller('admin/subaccounts')
@Roles(ROLES.ADMIN)
@ApiBearerAuth()
export class SubaccountsAdminController {
  constructor(
    private readonly subaccountsAdminService: SubaccountsAdminService,
  ) {}

  @Get('pending-approval')
  @Roles(ROLES.ADMIN)
  @ApiOperation({
    summary: '[ADMIN] Lista subcontas que aguardam aprovação',
  })
  findPendingApproval() {
    return this.subaccountsAdminService.findPendingApproval();
  }

  @Post(':id/approve')
  @HttpCode(HttpStatus.OK)
  @Roles(ROLES.ADMIN)
  @ApiOperation({ summary: '[ADMIN] Aprova uma solicitação de subconta' })
  approveSubaccount(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() currentUser: JwtPayload,
  ) {
    return this.subaccountsAdminService.approveSubaccount(id, currentUser);
  }
}
