# FDC3 Standard Reference

## Core Concepts
**FDC3 (Financial Desktop Connectivity and Collaboration Consortium)** allows financial applications to interoperate by sharing "Context Data" (nouns) and raising "Intents" (verbs).

## Context Data Types
All FDC3 context data objects inherit from the base `fdc3.context` type.

### 0. Base Context (`fdc3.context`)
The foundational type for all data.
- **Required**: `type` (string)
- **Optional**:
  - `name` (string): Display name.
  - `id` (object): Map of equivalent identifiers (e.g., `{"ticker": "AAPL", "FIGI": "BBG000B9XRY4"}`).
- **Note**: Applications use the `id` map to route data even if they use different symbology.

### 1. Instrument (`fdc3.instrument`)
Represents a financial security (Equity, Bond, etc.).
- **Required**: `type: "fdc3.instrument"`, `id: { ... }`
- **Common ID Fields**:
  - `ticker`: Bloomberg/Refinitiv ticker (e.g., "AAPL")
  - `ISIN`: International Securities Identification Number
  - `CUSIP`: North American ID
  - `FIGI`: Financial Instrument Global Identifier
- **Example**:
  ```json
  {
    "type": "fdc3.instrument",
    "id": {
      "ticker": "AAPL",
      "ISIN": "US0378331005",
      "FIGI": "BBG000B9XRY4"
    },
    "name": "Apple Inc."
  }
  ```

### 2. Contact (`fdc3.contact`)
Represents a person or entity.
- **Required**: `type: "fdc3.contact"`, `id: { ... }`
- **Common ID Fields**: `email`, `salesforceId`
- **Properties**: `name` (string)
- **Example**:
  ```json
  {
    "type": "fdc3.contact",
    "id": {
      "email": "jane.doe@example.com"
    },
    "name": "Jane Doe"
  }
  ```

### 3. Order (`fdc3.order`)
Represents a trade order.
- **Required**: `type: "fdc3.order"`
- **Structure**: Often points to an embedded instrument.
- **Example**:
  ```json
  {
    "type": "fdc3.order",
    "details": {
      "side": "BUY",
      "quantity": 100,
      "instrument": {
        "type": "fdc3.instrument",
        "id": { "ticker": "MSFT" }
      }
    }
  }
  ```

## Standard Intents
Intents are actions an app can request.
- `ViewChart`: Open a chart for the given context (usually Instrument).
- `ViewNews`: Show news for the context.
- `StartChat`: Initialize a chat session (often with a Contact context).

## Advanced Context Types

### 4. Portfolio (`fdc3.portfolio`)
Represents a collection of positions.
- **Required**: `type: "fdc3.portfolio"`, `positions: [...]`
- **Example**:
  ```json
  {
    "type": "fdc3.portfolio",
    "positions": [
      {
        "type": "fdc3.position",
        "instrument": { "type": "fdc3.instrument", "id": { "ticker": "MSFT" } },
        "holding": 1500
      }
    ]
  }
  ```

### 5. Position (`fdc3.position`)
Represents a holding in a specific instrument.
- **Required**: `type: "fdc3.position"`, `instrument: {...}`, `holding: <number>`
- **Example**:
  ```json
  {
    "type": "fdc3.position",
    "instrument": { "type": "fdc3.instrument", "id": { "ticker": "AAPL" } },
    "holding": 2000000
  }
  ```

### 6. Chat Init Settings (`fdc3.chat.initSettings`)
Configuration to start a new chat.
- **Required**: `type: "fdc3.chat.initSettings"`
- **Properties**:
  - `chatName`: String name of the room.
  - `members`: `{ type: "fdc3.contactList", contacts: [...] }`
  - `options`: `{ groupRecipients: true/false, ... }`
- **Example**:
  ```json
  {
    "type": "fdc3.chat.initSettings",
    "chatName": "Deal Team Alpha",
    "options": { "groupRecipients": true },
    "members": {
      "type": "fdc3.contactList",
      "contacts": [
        { "type": "fdc3.contact", "name": "Jane Doe", "id": { "email": "jane@example.com" } }
      ]
    }
  }
  ```
