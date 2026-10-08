import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { ConversationStatus } from '@prisma/client';
import { OutboundMessageService } from '../../outbound-message/services/outbound-message.service';
import { ConversationQueryDto } from '../dto/conversation-query.dto';
import { CursorPaginationQueryDto, PaginatedResponseDto } from '../../../common/dto/cursor-pagination.dto';

@Injectable()
export class ConversationManagementService {
  private readonly logger = new Logger(ConversationManagementService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly outboundService: OutboundMessageService,
  ) {}

  async listConversations(
    businessId: string,
    query: ConversationQueryDto,
  ): Promise<PaginatedResponseDto<any>> {
    const limit = query.limit || 20;
    const where: any = {
      businessId,
      ...(query.status ? { status: query.status } : {}),
      ...(query.search
        ? {
            customer: {
              OR: [
                { name: { contains: query.search, mode: 'insensitive' } },
                { phoneNumber: { contains: query.search } },
              ],
            },
          }
        : {}),
    };

    const items = await this.prisma.conversation.findMany({
      where,
      take: limit + 1,
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
      orderBy: { updatedAt: 'desc' },
      include: {
        customer: true,
        assignedStaff: {
          select: { id: true, name: true, email: true },
        },
        messages: {
          take: 1,
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    let nextCursor: string | null = null;
    if (items.length > limit) {
      const nextItem = items.pop();
      nextCursor = nextItem ? nextItem.id : null;
    }

    return { items, nextCursor };
  }

  async getConversationById(businessId: string, conversationId: string): Promise<any> {
    const conversation = await this.prisma.conversation.findFirst({
      where: {
        id: conversationId,
        businessId, // Multi-tenant scoped!
      },
      include: {
        customer: true,
        assignedStaff: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    if (!conversation) {
      throw new NotFoundException(`Conversation ${conversationId} not found.`);
    }

    return conversation;
  }

  async listMessages(
    businessId: string,
    conversationId: string,
    query: CursorPaginationQueryDto,
  ): Promise<PaginatedResponseDto<any>> {
    // 1. Verify conversation belongs to tenant
    await this.getConversationById(businessId, conversationId);

    const limit = query.limit || 50;

    const items = await this.prisma.message.findMany({
      where: {
        businessId,
        conversationId,
      },
      take: limit + 1,
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
      orderBy: { createdAt: 'desc' },
      include: {
        staffUser: {
          select: { id: true, name: true },
        },
      },
    });

    let nextCursor: string | null = null;
    if (items.length > limit) {
      const nextItem = items.pop();
      nextCursor = nextItem ? nextItem.id : null;
    }

    return { items, nextCursor };
  }

  async takeOver(
    businessId: string,
    conversationId: string,
    staffUserId: string,
  ): Promise<any> {
    const conversation = await this.getConversationById(businessId, conversationId);

    return this.prisma.conversation.update({
      where: { id: conversation.id },
      data: {
        status: ConversationStatus.HUMAN_HANDLING,
        assignedStaffId: staffUserId,
      },
      include: { customer: true, assignedStaff: true },
    });
  }

  async handBack(businessId: string, conversationId: string): Promise<any> {
    const conversation = await this.getConversationById(businessId, conversationId);

    return this.prisma.conversation.update({
      where: { id: conversation.id },
      data: {
        status: ConversationStatus.BOT,
        assignedStaffId: null,
      },
      include: { customer: true },
    });
  }

  async resolve(businessId: string, conversationId: string): Promise<any> {
    const conversation = await this.getConversationById(businessId, conversationId);

    return this.prisma.conversation.update({
      where: { id: conversation.id },
      data: {
        status: ConversationStatus.RESOLVED,
      },
      include: { customer: true },
    });
  }

  async sendStaffReply(
    businessId: string,
    conversationId: string,
    staffUserId: string,
    messageText: string,
  ): Promise<void> {
    const conversation = await this.getConversationById(businessId, conversationId);

    // Rule: Staff reply must be in HUMAN_HANDLING and assigned to this staff user
    if (
      conversation.status !== ConversationStatus.HUMAN_HANDLING ||
      conversation.assignedStaffId !== staffUserId
    ) {
      throw new ConflictException(
        'Cannot send staff message: You must take over this conversation before replying.',
      );
    }

    // Rule: WhatsApp 24-hour window check
    const isExpired =
      conversation.windowExpiresAt &&
      new Date(conversation.windowExpiresAt).getTime() < Date.now();

    if (isExpired) {
      throw new BadRequestException(
        'WhatsApp 24-hour customer care window has expired for this conversation. Only approved template messages can be sent.',
      );
    }

    // Enqueue outbound message via BullMQ queue
    await this.outboundService.sendText(
      businessId,
      conversation.id,
      conversation.customerId,
      conversation.customer.phoneNumber,
      messageText,
      staffUserId,
    );
  }
}
