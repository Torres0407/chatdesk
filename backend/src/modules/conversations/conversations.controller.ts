import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ConversationManagementService } from './services/conversation-management.service';
import { ConversationQueryDto, StaffReplyDto } from './dto/conversation-query.dto';
import { CursorPaginationQueryDto } from '../../common/dto/cursor-pagination.dto';

@ApiTags('Conversations')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('conversations')
export class ConversationsController {
  constructor(
    private readonly conversationService: ConversationManagementService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List conversations with status & search filters and cursor pagination' })
  async listConversations(
    @CurrentUser('businessId') businessId: string,
    @Query() query: ConversationQueryDto,
  ) {
    return this.conversationService.listConversations(businessId, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get conversation details by ID' })
  async getConversation(
    @CurrentUser('businessId') businessId: string,
    @Param('id') id: string,
  ) {
    return this.conversationService.getConversationById(businessId, id);
  }

  @Get(':id/messages')
  @ApiOperation({ summary: 'Get paginated messages for a conversation' })
  async listMessages(
    @CurrentUser('businessId') businessId: string,
    @Param('id') id: string,
    @Query() query: CursorPaginationQueryDto,
  ) {
    return this.conversationService.listMessages(businessId, id, query);
  }

  @Post(':id/take-over')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Take over conversation for human handling' })
  async takeOver(
    @CurrentUser('businessId') businessId: string,
    @CurrentUser('userId') staffUserId: string,
    @Param('id') id: string,
  ) {
    return this.conversationService.takeOver(businessId, id, staffUserId);
  }

  @Post(':id/hand-back')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Hand conversation back to automated bot' })
  async handBack(
    @CurrentUser('businessId') businessId: string,
    @Param('id') id: string,
  ) {
    return this.conversationService.handBack(businessId, id);
  }

  @Post(':id/resolve')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mark conversation as resolved' })
  async resolve(
    @CurrentUser('businessId') businessId: string,
    @Param('id') id: string,
  ) {
    return this.conversationService.resolve(businessId, id);
  }

  @Post(':id/messages')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Send staff reply message to customer on WhatsApp' })
  async sendStaffReply(
    @CurrentUser('businessId') businessId: string,
    @CurrentUser('userId') staffUserId: string,
    @Param('id') id: string,
    @Body() body: StaffReplyDto,
  ) {
    await this.conversationService.sendStaffReply(
      businessId,
      id,
      staffUserId,
      body.message,
    );
    return { success: true, message: 'Reply sent' };
  }
}
