# ChatDesk REST API Contract (/api/v1)

This document specifies the standard REST endpoints and contracts designed for **ChatDesk**.
The frontend `src/services/api.ts` maps directly to these endpoints. Swapping the mock implementation for a real production backend requires implementing these endpoints and replacing the in-memory calls in `src/services/api.ts` with standard `fetch()` or `axios` calls.

---

## Global Standards

- **Base URL**: `https://api.chatdesk.app/api/v1`
- **Authentication**: Bearer Token in `Authorization: Bearer <JWT_ACCESS_TOKEN>` header.
- **Tenant Context**: The authenticated user's business (`businessId`) is extracted server-side from the verified JWT. Clients never send `businessId`.
- **Date Format**: ISO 8601 strings in UTC (`YYYY-MM-DDTHH:mm:ssZ`).
- **Privacy Enforcement**: Customer phone numbers are stored encrypted and always returned masked from the backend (e.g. `+234 *** *** 4567`). The client never receives plain unmasked numbers.
- **Cursor Pagination Format**:
  ```json
  {
    "items": [...],
    "nextCursor": "string | null",
    "total": 42
  }
  ```

---

## 1. Authentication (`api.auth`)

### `POST /api/v1/auth/login`
- **Function**: `api.auth.login(email, password)`
- **Request Body**:
  ```json
  {
    "email": "chioma@brewbotanica.com",
    "password": "string"
  }
  ```
- **Response**: `200 OK`
  ```json
  {
    "id": "staff_01",
    "businessId": "biz_01",
    "name": "Chioma Okafor",
    "email": "chioma@brewbotanica.com",
    "role": "OWNER",
    "avatarUrl": "https://...",
    "lastActiveAt": "2026-10-08T15:15:00Z"
  }
  ```
- **Error Cases**:
  - `400 Bad Request`: Missing email or password.
  - `401 Unauthorized`: Invalid credentials.

### `POST /api/v1/auth/logout`
- **Function**: `api.auth.logout()`
- **Request Body**: None (Clears HTTP-only session cookie / revokes refresh token)
- **Response**: `204 No Content`

### `GET /api/v1/auth/me`
- **Function**: `api.auth.me()`
- **Response**: `200 OK` (Current `StaffUser` or `null` if unauthenticated).

---

## 2. Conversations Inbox & Messaging (`api.conversations`)

### `GET /api/v1/conversations`
- **Function**: `api.conversations.list({ status, search, cursor, limit })`
- **Query Parameters**:
  - `status`: Optional filter (`ALL`, `OPEN`, `NEEDS_AGENT`, `HUMAN_HANDLING`, `RESOLVED`).
  - `search`: Case-insensitive substring match on customer name, masked phone, or message content.
  - `cursor`: Pagination offset or token.
  - `limit`: Number of records (default 20).
- **Response**: `200 OK`
  ```json
  {
    "items": [
      {
        "id": "conv_01",
        "businessId": "biz_01",
        "customerId": "cust_01",
        "customer": {
          "id": "cust_01",
          "name": "Tunde Bakare",
          "phone": "+234 *** *** 4567",
          "tags": ["VIP"],
          "totalOrdersCount": 8,
          "totalBookingsCount": 2,
          "totalSpend": 245.50
        },
        "status": "NEEDS_AGENT",
        "assignedStaffId": null,
        "unreadCount": 2,
        "needsAgentReason": "Customer requested address change",
        "lastCustomerMessageAt": "2026-10-08T14:42:20Z",
        "updatedAt": "2026-10-08T14:42:20Z"
      }
    ],
    "nextCursor": "20",
    "total": 5
  }
  ```

### `GET /api/v1/conversations/:id`
- **Function**: `api.conversations.get(id)`
- **Response**: `200 OK` with full `Conversation` object. Also resets unread count for staff.
- **Error Cases**: `404 Not Found`.

### `GET /api/v1/conversations/:id/messages`
- **Function**: `api.conversations.messages(id, { cursor, limit })`
- **Response**: `200 OK`
  ```json
  {
    "items": [
      {
        "id": "msg_101",
        "conversationId": "conv_01",
        "direction": "INBOUND",
        "type": "TEXT",
        "content": "Hi! Can I change the delivery address for my order?",
        "deliveryStatus": "READ",
        "sentByBot": false,
        "createdAt": "2026-10-08T14:40:00Z"
      }
    ],
    "nextCursor": null,
    "total": 5
  }
  ```

### `POST /api/v1/conversations/:id/take-over`
- **Function**: `api.conversations.takeOver(id)`
- **Description**: Assigns human staff to conversation, sets status to `HUMAN_HANDLING`, disables automated bot responses for this thread.
- **Response**: `200 OK` with updated `Conversation`.
- **Error Cases**: `404 Not Found`, `409 Conflict` (if another staff member already actively engaged).

### `POST /api/v1/conversations/:id/hand-back`
- **Function**: `api.conversations.handBack(id)`
- **Description**: Re-enables automated WhatsApp bot assistance, sets status to `OPEN`, unassigns staff.
- **Response**: `200 OK` with updated `Conversation`.

### `POST /api/v1/conversations/:id/resolve`
- **Function**: `api.conversations.resolve(id)`
- **Description**: Marks conversation as `RESOLVED`.
- **Response**: `200 OK` with updated `Conversation`.

### `POST /api/v1/conversations/:id/messages`
- **Function**: `api.conversations.sendReply(id, text)`
- **Request Body**:
  ```json
  {
    "text": "Hello! I have updated the courier address for your delivery."
  }
  ```
- **Response**: `201 Created` with created `Message`.
- **Error Cases**:
  - `409 Conflict`: Conversation status is NOT `HUMAN_HANDLING` (e.g. still assigned to bot or unresolved queue).
  - `422 Unprocessable Entity`: Outside 24-hour WhatsApp messaging window (`code: "OUTSIDE_24H_WINDOW"`). Customer must message first.

---

## 3. Orders (`api.orders`)

### `GET /api/v1/orders`
- **Function**: `api.orders.list({ status, cursor, limit, search })`
- **Response**: `200 OK` with paginated `Order[]`.

### `GET /api/v1/orders/:id`
- **Function**: `api.orders.get(id)`
- **Response**: `200 OK` with complete `Order` including line items and customer details.

### `PATCH /api/v1/orders/:id/status`
- **Function**: `api.orders.updateStatus(id, status)`
- **Request Body**:
  ```json
  {
    "status": "PREPARING"
  }
  ```
- **Allowed Transitions**:
  - `PENDING` -> `PAID` | `CANCELLED`
  - `PAID` -> `PREPARING` | `CANCELLED`
  - `PREPARING` -> `COMPLETED` | `CANCELLED`
  - `COMPLETED` -> None
  - `CANCELLED` -> None
- **Response**: `200 OK` with updated `Order`.
- **Error Cases**:
  - `422 Unprocessable Entity`: Illegal status transition attempt.

---

## 4. Bookings (`api.bookings`)

### `GET /api/v1/bookings`
- **Function**: `api.bookings.list({ from, to, status })`
- **Query Parameters**:
  - `from`: ISO start range timestamp
  - `to`: ISO end range timestamp
  - `status`: Optional filter (`CONFIRMED`, `CANCELLED`, `COMPLETED`, `NO_SHOW`)
- **Response**: `200 OK` with `Booking[]`.

### `GET /api/v1/bookings/:id`
- **Function**: `api.bookings.get(id)`
- **Response**: `200 OK` with `Booking`.

### `POST /api/v1/bookings/:id/cancel`
- **Function**: `api.bookings.cancel(id, reason)`
- **Request Body**:
  ```json
  {
    "reason": "Customer called to cancel due to weather"
  }
  ```
- **Response**: `200 OK` with updated `Booking` (status: `CANCELLED`).

### `POST /api/v1/bookings/:id/reschedule`
- **Function**: `api.bookings.reschedule(id, newStart)`
- **Request Body**:
  ```json
  {
    "newStart": "2026-10-10T14:00:00Z"
  }
  ```
- **Response**: `200 OK` with updated `Booking` (recalculated end time based on service duration).

---

## 5. Products Catalog (`api.products`)

### `GET /api/v1/products`
- **Function**: `api.products.list()`
- **Response**: `200 OK` with `Product[]`.

### `POST /api/v1/products`
- **Function**: `api.products.create(data)`
- **Response**: `201 Created` with created `Product`.

### `PATCH /api/v1/products/:id`
- **Function**: `api.products.update(id, patch)`
- **Response**: `200 OK` with updated `Product`.

### `PATCH /api/v1/products/:id/disable`
- **Function**: `api.products.disable(id, disabled)`
- **Response**: `200 OK` with updated `Product`.

---

## 6. FAQs Knowledge Base (`api.faqs`)

### `GET /api/v1/faqs`
- **Function**: `api.faqs.list()`
- **Response**: `200 OK` with `Faq[]`.

### `POST /api/v1/faqs`
- **Function**: `api.faqs.create(data)`
- **Response**: `201 Created` with created `Faq`.

### `PATCH /api/v1/faqs/:id`
- **Function**: `api.faqs.update(id, patch)`
- **Response**: `200 OK` with updated `Faq`.

### `DELETE /api/v1/faqs/:id`
- **Function**: `api.faqs.delete(id)`
- **Response**: `204 No Content`.

---

## 7. Business Settings & Rules (`api.settings`)

### `GET /api/v1/settings`
- **Function**: `api.settings.get()`
- **Response**: `200 OK` with `Business` profile, opening hours, slot rules, bot master toggle.

### `PATCH /api/v1/settings`
- **Function**: `api.settings.update(patch)`
- **Response**: `200 OK` with updated `Business`.

---

## 8. Customer Opt-Outs (`api.optOuts`)

### `GET /api/v1/opt-outs`
- **Function**: `api.optOuts.list()`
- **Response**: `200 OK` with `OptOut[]`.

### `DELETE /api/v1/opt-outs/:id`
- **Function**: `api.optOuts.remove(id)`
- **Response**: `204 No Content`.

---

## 9. Real-Time Server-Sent Events (`api.events`)

### `GET /api/v1/events`
- **Protocol**: `text/event-stream` (SSE)
- **Event Types**:
  - `message.created`: New inbound customer WhatsApp message or outbound agent reply.
  - `conversation.updated`: Status change, agent takeover, or resolution.
  - `order.updated`: Payment confirmation, kitchen status update.
  - `booking.updated`: Rescheduled, confirmed, or cancelled booking.
- **SSE Payload Format**:
  ```
  event: message.created
  data: {"type":"message.created","timestamp":"2026-10-08T15:02:15Z","data":{"conversationId":"conv_02","message":{...}}}
  ```
