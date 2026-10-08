import { MessageBuilder } from './message.builder';

describe('MessageBuilder', () => {
  const phone = '+2348012345678';
  const cleanPhone = '2348012345678';

  it('should build a valid text message payload', () => {
    const msg = MessageBuilder.text(phone, 'Hello, Welcome to Chatdesk!');
    expect(msg).toEqual({
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: cleanPhone,
      type: 'text',
      text: {
        body: 'Hello, Welcome to Chatdesk!',
        preview_url: false,
      },
    });
  });

  it('should build an interactive buttons message with max 3 buttons', () => {
    const buttons = [
      { id: 'btn_1', title: 'Catalog' },
      { id: 'btn_2', title: 'Bookings' },
      { id: 'btn_3', title: 'FAQs' },
      { id: 'btn_4', title: 'Extra' }, // should be sliced to 3
    ];

    const msg = MessageBuilder.buttons(phone, 'Choose an option below:', buttons, {
      headerText: 'Main Menu',
      footerText: 'Chatdesk Business',
    });

    expect(msg.type).toBe('interactive');
    const interactive = msg.interactive as any;
    expect(interactive?.type).toBe('button');
    expect(interactive?.header?.text).toBe('Main Menu');
    expect(interactive?.footer?.text).toBe('Chatdesk Business');
    expect(interactive?.action.buttons.length).toBe(3);
    expect(interactive?.action.buttons[0]).toEqual({
      type: 'reply',
      reply: { id: 'btn_1', title: 'Catalog' },
    });
  });

  it('should build an interactive list message', () => {
    const sections = [
      {
        title: 'Popular Items',
        rows: [
          { id: 'item_1', title: 'Product 1', description: 'Fresh item' },
          { id: 'item_2', title: 'Product 2' },
        ],
      },
    ];

    const msg = MessageBuilder.list(
      phone,
      'Browse our catalog:',
      'View Items',
      sections,
    );

    expect(msg.type).toBe('interactive');
    const interactive = msg.interactive as any;
    expect(interactive?.type).toBe('list');
    expect(interactive?.action.button).toBe('View Items');
    expect(interactive?.action.sections[0].rows.length).toBe(2);
    expect(interactive?.action.sections[0].rows[0].title).toBe('Product 1');
  });

  it('should build an image message payload', () => {
    const msg = MessageBuilder.image(phone, 'https://example.com/item.png', 'Special Offer');
    expect(msg).toEqual({
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: cleanPhone,
      type: 'image',
      image: {
        link: 'https://example.com/item.png',
        caption: 'Special Offer',
      },
    });
  });

  it('should build a template message payload', () => {
    const msg = MessageBuilder.template(phone, 'order_update_v1', 'en');
    expect(msg).toEqual({
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: cleanPhone,
      type: 'template',
      template: {
        name: 'order_update_v1',
        language: { code: 'en' },
      },
    });
  });
});
