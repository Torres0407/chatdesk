# ChatDesk WA — OpenAPI & REST API Contract

Version: `1.0.0`  
Base URL: `/api/v1`  
Specification: OpenAPI 3.0 / REST / Server-Sent Events (SSE)

---

## 1. Authentication & Security

All staff dashboard endpoints require JWT Bearer authentication, except `/api/v1/auth/login`, `/api/v1/auth/refresh`, and the public webhook receivers.

- **Header**: `Authorization: Bearer <access_token>`
- **Access Token Lifetime**: 15 minutes
- **Refresh Token Lifetime**: 7 days (Stored in secure `httpOnly`, `sameSite: strict` cookie `refresh_token`)
- **Multi-Tenant Isolation**: Each request is automatically scoped to the authenticated user's `businessId`. Cross-tenant requests strictly return `404 Not Found`.

### Error Response Format
```json
{
  "statusCode": 400,
  "error": "Bad Request",
  "message": ["email must be an email"],
  "timestamp": "2026-10-09T00:00:00.000Z",
  "path": "/api/v1/auth/login"
}
```

---

## 2. Auth Endpoints

### `POST /api/v1/auth/login`
Authenticate staff member and receive JWT.

- **Rate Limit**: Max 5 failed attempts per email before a 15-minute lock.
- **Request Body**:
```json
{
  "email": "owner@shop.com",
  "password": "Password123!"
}
```
- **Response `200 OK`**:
```json
{
  "accessToken": "eyJhbGciOiJIUzI1Ni...",
  "user": {
    "id": "clx_staff_123",
    "businessId": "clx_biz_123",
    "email": "owner@shop.com",
    "name": "Jane Doe",
    "role": "OWNER",
    "businessName": "Acme Boutique"
  }
}
```

### `POST /api/v1/auth/refresh`
Rotate refresh token and issue new 15-minute access token.
- **Cookie**: `refresh_token=<token>`
- **Response `200 OK`**: `{ "accessToken": "eyJhbG..." }`

### `POST /api/v1/auth/logout`
Revoke refresh token and clear cookie.
- **Response `200 OK`**: `{ "message": "Logged out successfully" }`

### `GET /api/v1/auth/me`
Retrieve authenticated staff profile.

---

## 3. Meta WhatsApp Webhooks

### `GET /api/v1/webhook`
Meta Webhook Verification Challenge.
- **Query Parameters**:
  - `hub.mode`: `subscribe`
  - `hub.verify_token`: `<META_WEBHOOK_VERIFY_TOKEN>`
  - `hub.challenge`: `<challenge_string>`
- **Response `200 OK`**: Returns `hub.challenge` in plain text.

### `POST /api/v1/webhook`
Inbound Meta Webhook Receiver (Messages, Status updates).
- **Headers**: `X-Hub-Signature-256: sha256=<hmac_sha256_hex>` (Computed against raw payload).
- **Behavior**: Fast 200 response with immediate BullMQ queue offloading (`meta-webhook-queue`).
- **Response `200 OK`**: `{ "received": true }`

---

## 4. Conversations & Live Staff Messaging

### `GET /api/v1/conversations`
Paginated conversation threads scoped to tenant.
- **Query Parameters**:
  - `limit`: `20` (default, max 100)
  - `cursor`: `<conversation_id>` (optional cursor)
  - `status`: `BOT | HUMAN_HANDLING | RESOLVED` (optional)
  - `search`: Search customer name or phone number (optional)

### `GET /api/v1/conversations/:id`
Fetch single conversation with customer details and assigned agent.

### `GET /api/v1/conversations/:id/messages`
Paginated message history for a conversation.
- **Query Parameters**: `limit`, `cursor`.

### `POST /api/v1/conversations/:id/takeover`
Staff member takes over conversation from automated bot.
- **Changes**: Sets `status = 'HUMAN_HANDLING'`, sets `assignedStaffId = currentUser.id`.
- **SSE Event**: Emits `conversation.claimed` and `conversation.updated`.

### `POST /api/v1/conversations/:id/handback`
Return conversation control back to bot.
- **Changes**: Sets `status = 'BOT'`, clears `assignedStaffId`.
- **SSE Event**: Emits `conversation.updated`.

### `POST /api/v1/conversations/:id/resolve`
Mark conversation as resolved.
- **Changes**: Sets `status = 'RESOLVED'`.
- **SSE Event**: Emits `conversation.resolved`.

### `POST /api/v1/conversations/:id/reply`
Send staff reply to customer on WhatsApp.
- **Preconditions**:
  1. Conversation must be in `HUMAN_HANDLING` and assigned to requesting staff user (`409 Conflict` otherwise).
  2. Conversation must be within the 24-hour Meta customer care window (`400 Bad Request` if expired).
- **Request Body**:
```json
{
  "message": "Hello! I am following up on your custom order request."
}
```

---

## 5. Orders & WhatsApp Commerce

### `GET /api/v1/orders`
Paginated list of customer orders.
- **Query Parameters**: `status` (`PENDING | PAID | PREPARING | COMPLETED | CANCELLED`), `limit`, `cursor`.

### `GET /api/v1/orders/:id`
Fetch order details, items, customer info, and payment records.

### `PATCH /api/v1/orders/:id/status`
Transition order status along strict state machine rules.
- **Valid Transitions**:
  - `PENDING` $\rightarrow$ `PAID` or `CANCELLED`
  - `PAID` $\rightarrow$ `PREPARING` or `CANCELLED`
  - `PREPARING` $\rightarrow$ `COMPLETED` or `CANCELLED`
- **Request Body**: `{ "status": "PREPARING" }`
- **SSE Event**: Emits `order.updated`.

---

## 6. Bookings & Appointments

### `GET /api/v1/bookings`
List bookings for business with optional date range and status filters.

### `GET /api/v1/bookings/slots`
Get available time slots for a given date with overlap calculation.
- **Query Parameters**: `date=2026-10-15`

### `POST /api/v1/bookings`
Create a confirmed appointment slot with double-booking prevention.

### `POST /api/v1/bookings/:id/reschedule`
Reschedule appointment to new start/end time.
- **SSE Event**: Emits `booking.updated`.

### `POST /api/v1/bookings/:id/cancel`
Cancel booking and notify customer on WhatsApp.
- **SSE Event**: Emits `booking.updated`.

---

## 7. Catalog & Products

### `GET /api/v1/catalog`
List active products for tenant shop.

### `POST /api/v1/catalog`
Create new catalog item.
```json
{
  "name": "Handmade Leather Bag",
  "description": "Genuine leather shoulder bag",
  "price": 25000,
  "currency": "NGN",
  "sku": "BAG-001",
  "imageUrl": "https://cdn.example.com/bag.jpg"
}
```

### `PATCH /api/v1/catalog/:id`
Update product metadata, price, or inventory.

### `DELETE /api/v1/catalog/:id`
Soft delete product (`isActive: false`).

---

## 8. FAQs Knowledge-Base

### `GET /api/v1/faqs`
List all tenant FAQs.

### `POST /api/v1/faqs`
Create FAQ entry for rule-based and AI retrieval.
```json
{
  "question": "What is your return policy?",
  "answer": "We accept returns within 7 days of delivery in original condition.",
  "keywords": ["return", "refund", "exchange"]
}
```

### `PATCH /api/v1/faqs/:id` / `DELETE /api/v1/faqs/:id`
Update or soft-delete FAQ entry.

---

## 9. Real-time Server-Sent Events (SSE)

### `GET /api/v1/events`
Persistent SSE stream for staff dashboards.
- **Header**: `Authorization: Bearer <token>`
- **Content-Type**: `text/event-stream`

#### Event Format
```json
{
  "id": "7bf3ad71-0ce0-48be-816b-cf83a8cf82aa",
  "type": "handoff.triggered",
  "businessId": "clx_biz_123",
  "timestamp": "2026-10-09T00:00:00.000Z",
  "data": {
    "conversationId": "conv_123",
    "customerId": "cust_123",
    "customerPhone": "+2348012345678",
    "customerName": "Jane Doe",
    "reason": "URGENT_KEYWORD",
    "priority": "URGENT",
    "isOutsideOperatingHours": false
  }
}
```

---

## 10. Payment Webhooks

### `POST /api/v1/payments/webhook/paystack`
Paystack charge success webhook.
- **Header**: `X-Paystack-Signature: <hmac_sha512_hex>`
- **Behavior**: Idempotently marks order as `PAID`, sends customer payment confirmation on WhatsApp, and emits `order.updated` SSE event.
