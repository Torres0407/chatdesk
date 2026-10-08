import {
  SendWhatsAppMessageDto,
  WhatsAppButtonAction,
  WhatsAppListSection,
} from '../dto/outbound-message.dto';

export class MessageBuilder {
  static text(to: string, body: string, previewUrl = false): SendWhatsAppMessageDto {
    const formattedTo = to.replace(/^\+/, '');
    return {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: formattedTo,
      type: 'text',
      text: {
        body,
        preview_url: previewUrl,
      },
    };
  }

  static buttons(
    to: string,
    bodyText: string,
    buttons: Array<{ id: string; title: string }>,
    options?: { headerText?: string; footerText?: string },
  ): SendWhatsAppMessageDto {
    const formattedTo = to.replace(/^\+/, '');
    // WhatsApp Cloud API supports max 3 buttons
    const limitedButtons = buttons.slice(0, 3);

    const buttonActions: WhatsAppButtonAction[] = limitedButtons.map((btn) => ({
      type: 'reply',
      reply: {
        id: btn.id.substring(0, 256), // Max 256 chars ID
        title: btn.title.substring(0, 20), // Max 20 chars title
      },
    }));

    return {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: formattedTo,
      type: 'interactive',
      interactive: {
        type: 'button',
        ...(options?.headerText
          ? { header: { type: 'text', text: options.headerText.substring(0, 60) } }
          : {}),
        body: {
          text: bodyText.substring(0, 1024),
        },
        ...(options?.footerText
          ? { footer: { text: options.footerText.substring(0, 60) } }
          : {}),
        action: {
          buttons: buttonActions,
        },
      },
    };
  }

  static list(
    to: string,
    bodyText: string,
    buttonLabel: string,
    sections: WhatsAppListSection[],
    options?: { headerText?: string; footerText?: string },
  ): SendWhatsAppMessageDto {
    const formattedTo = to.replace(/^\+/, '');
    return {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: formattedTo,
      type: 'interactive',
      interactive: {
        type: 'list',
        ...(options?.headerText
          ? { header: { type: 'text', text: options.headerText.substring(0, 60) } }
          : {}),
        body: {
          text: bodyText.substring(0, 1024),
        },
        ...(options?.footerText
          ? { footer: { text: options.footerText.substring(0, 60) } }
          : {}),
        action: {
          button: buttonLabel.substring(0, 20),
          sections: sections.map((sec) => ({
            title: sec.title.substring(0, 24),
            rows: sec.rows.slice(0, 10).map((row) => ({
              id: row.id.substring(0, 200),
              title: row.title.substring(0, 24),
              ...(row.description
                ? { description: row.description.substring(0, 72) }
                : {}),
            })),
          })),
        },
      },
    };
  }

  static image(to: string, imageUrl: string, caption?: string): SendWhatsAppMessageDto {
    const formattedTo = to.replace(/^\+/, '');
    return {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: formattedTo,
      type: 'image',
      image: {
        link: imageUrl,
        ...(caption ? { caption: caption.substring(0, 1024) } : {}),
      },
    };
  }

  static template(
    to: string,
    templateName: string,
    languageCode = 'en',
    components?: any[],
  ): SendWhatsAppMessageDto {
    const formattedTo = to.replace(/^\+/, '');
    return {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: formattedTo,
      type: 'template',
      template: {
        name: templateName,
        language: {
          code: languageCode,
        },
        ...(components ? { components } : {}),
      },
    };
  }
}
