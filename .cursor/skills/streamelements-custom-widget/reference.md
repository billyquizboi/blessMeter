# StreamElements custom widget reference

Condensed from StreamElements docs and [widget/se-api.d.ts](../../../widget/se-api.d.ts).

## FIELDS JSON — supported types

| type                                  | value type          | notes                                          |
| ------------------------------------- | ------------------- | ---------------------------------------------- |
| text                                  | string              |                                                |
| checkbox                              | boolean             |                                                |
| colorpicker                           | string (`#RRGGBB`)  |                                                |
| number                                | number              | `min`, `max`, `step`                           |
| slider                                | number              | `min`, `max`, `step`                           |
| dropdown                              | string (option key) | `options`: `{ "key": "Label" }`                |
| image-input, video-input, sound-input | url or url[]        | `"multiple": true` → array                     |
| googleFont                            | font name           | e.g. `"Roboto"`                                |
| button                                | string              | click → `widget-button` event                  |
| hidden                                | any                 | `widgetName`, `widgetAuthor`, `widgetDuration` |

Invalid `type` falls back to `text`. Group fields with `"group": "Section name"`.

Template in HTML/CSS/JS: `{{fieldKey}}` or `{fieldKey}` (docs prefer HTML/CSS only).

## `onWidgetLoad` detail shape

```javascript
obj.detail.fieldData; // current field values
obj.detail.session.data; // session dashboard stats
obj.detail.recents; // last ~25 events, chronological
obj.detail.currency; // { code, name, symbol }
obj.detail.channel; // { username, apiToken, ... }
```

Session keys vary by platform; see [Session Data Reference](https://docs.streamelements.com/overlays/session-data).

## `onEventReceived` listeners

| listener                   | when                                       |
| -------------------------- | ------------------------------------------ |
| `follower-latest`          | new follower                               |
| `subscriber-latest`        | new sub                                    |
| `host-latest`              | host                                       |
| `cheer-latest`             | cheer                                      |
| `kicks-latest`             | Kick KICKs gift                            |
| `tip-latest`               | tip                                        |
| `raid-latest`              | raid                                       |
| `message`                  | chat message (`event.data` — see below)    |
| `delete-message`           | single message removed (`msgId`)           |
| `delete-messages`          | all messages from `userId` removed         |
| `event:skip`               | skip alert (activity feed)                 |
| `alertService:toggleSound` | mute/unmute alerts                         |
| `bot:counter`              | bot counter changed (`counter`, `value`)   |
| `kvstore:update`           | `SE_API.store.set` on account              |
| `widget-button`            | FIELDS `button` clicked (`field`, `value`) |

### `-latest` event fields (`obj.detail.event`)

| field                   | meaning                     |
| ----------------------- | --------------------------- |
| `name`                  | user who triggered          |
| `amount`                | count / amount              |
| `message`               | attached message            |
| `gifted`                | gift to viewer              |
| `sender`                | gifter                      |
| `bulkGifted`            | start of community gift     |
| `isCommunityGift`       | one gift in community train |
| `playedAsCommunityGift` | cumulative sub bomb alert   |

Tips may include `userCurrency` (with `.symbol`, etc.).

### Channel points (blessMeter)

Not always listed in the public listener table. `eventReceivedHandler` routes to `handleRedemption` when:

- `detail.listener.split("-")[0] === "redemption"` (e.g. `redemption-latest`), or
- `detail.event.type === "channelPointsRedemption"` — **required for live Twitch**, where `listener` is often **`"event"`** (not `redemption-latest`), or
- `detail.event.itemId` is set → handler forces `listener` to `redemption-latest` (SE editor emulator).

#### Reward title (`getRedemptionName`)

1. `event.data.redemption`
2. `session.data["channel-points-latest"].redemption`
3. `event.itemId` (string reward name in the emulator)

#### Redeeming user (`getRedemptionUserIdentity`)

Returns `{ trackingKey, displayName }` or `null`. Used for `redemptionHistory` keys and `lastRedemption.redeemingUser` (display).

| Step                                       | `trackingKey`           | `displayName`                                                      |
| ------------------------------------------ | ----------------------- | ------------------------------------------------------------------ |
| 1. `event.data`                            | `username`, then `nick` | `displayName`, then tracking key, then `nick`                      |
| 2. `session.data["channel-points-latest"]` | `username`, then `name` | `displayName`, then tracking key; else `name` / `displayName` only |
| 3. `event.name`                            | same string for both    | same string for both                                               |

`getRedeemingUserName()` → `displayName` only.

#### Live Twitch envelope (canonical test fixture)

From `makeExampleTwitchChannelPointsRedemptionDetail` in `widget/widget.test.ts`:

```javascript
{
  listener: "event",
  event: {
    type: "channelPointsRedemption",
    provider: "twitch",
    data: {
      redemption: "Bless the Run",
      username: "exampleUserName",
      displayName: "ExampleUserNameDisplay",
      amount: 500,
      providerId: "123456789",
      // ...
    },
  },
}
```

#### SE editor / mock redeem (`mockRedeemEvent` in `widget.ts`)

Often omits `data.username`; identity falls back to **`event.name`**:

```javascript
{
  event: {
    type: "channelPointsRedemption",
    data: { redemption: "Bless the Run" },
    name: "testUserName",
  },
}
```

### Chat messages (message listener)

Chat payload is always **`obj.detail.event.data`** (`ChatMessageData`). There is no redeemer on `event.name` for chat.

| Field         | Role                                                                            |
| ------------- | ------------------------------------------------------------------------------- |
| `text`        | Message body; also tokenized for emote-name matching when `emotes` is empty     |
| `emotes`      | `{ name?: string }[]` — preferred emote source for blessMeter                   |
| `displayName` | Shown name; used for emote-bless announcements and single-user credit           |
| `nick`        | Fallback login-style name                                                       |
| `userId`      | Stable id for emote window deduplication (`userId ?? nick ?? "unknown"`)        |
| `username`    | Present on some platforms in typings; **not** used by `handleChatMessage` today |
| `msgId`       | Store with `userId` if you handle `delete-message` / `delete-messages`          |

blessMeter emote bless (`handleChatMessage`):

```javascript
const message = detail.event?.data;
const userId = message.userId ?? message.nick ?? "unknown";
const displayName = message.displayName ?? message.nick ?? userId;
```

Synthetic chat event:

```javascript
new CustomEvent("onEventReceived", {
  detail: {
    listener: "message",
    event: {
      data: {
        text: "Kappa",
        displayName: "Viewer",
        nick: "viewer",
        userId: "12345",
        emotes: [{ name: "Kappa" }],
      },
    },
  },
});
```

## `onSessionUpdate`

```javascript
const data = obj.detail.session; // NOT session.data
```

Same keys as `onWidgetLoad` session data, but flatter path. Use for goals / top donator widgets when `onEventReceived` is insufficient.

## SE_API

Global `SE_API` in overlay runtime.

### `store`

```javascript
SE_API.store.set(key: string, value: object): void  // overwrites entire value
SE_API.store.get(key: string): Promise<object>
```

- Keys are alphanumeric; values must be JSON-serializable objects.
- Keys cannot be deleted (only overwritten).
- `kvstore:update` key in events: `customWidget.${key}`.

### `counters.get(counterName)`

Promise → `{ id, count }`. Counters: StreamElements dashboard → Bot → Counters.

### `sanitize({ message })`

Promise → `{ skip: boolean, result: { message: string } }`.

### `cheerFilter(message)`

Promise → message string without cheer emotes.

### `getOverlayStatus()`

Promise → `{ isEditorMode: boolean, muted: boolean }`.

### `setField(key, value, shouldReload?)`

Editor only; does not persist. Optional `shouldReload` (default `true`).

### `resumeQueue()`

Releases alert queue before `widgetDuration` expires.

### Queue hold pattern

```javascript
const skippable = [
  "message",
  "delete-message",
  "delete-messages",
  "kvstore:update",
  "bot:counter",
  "widget-button",
  "event:skip",
  "alertService:toggleSound",
];

window.addEventListener("onEventReceived", (obj) => {
  const { listener, event } = obj.detail;
  if (skippable.includes(listener)) return;

  if (!shouldAnimate(listener, event)) {
    SE_API.resumeQueue();
    return;
  }
  const seconds = playAnimation(event);
  setTimeout(SE_API.resumeQueue, seconds * 1000);
});
```

## Types in `widget/se-api.d.ts` (blessMeter)

### `SE_API` (declared subset)

```typescript
declare const SE_API: {
  store: {
    get(key: string): Promise<WidgetState | null>;
    set(key: string, value: WidgetState): Promise<void>;
  };
  resumeQueue(): void;
};
```

Runtime also exposes counters, sanitize, cheerFilter, getOverlayStatus, setField — extend declarations if you call them from TypeScript.

### `WidgetState`

```typescript
interface WidgetState {
  current: CurrentState;
  allTime: AllTimeState;
  showAll?: boolean;
  lastUpdated: Date;
  redemptionHistory?: RedemptionHistory;
  lastRedemption?: LastRedemption;
}
```

`CurrentState` / `AllTimeState` track bless/curse/blurse counts (including blurse split and pre-reset fields). Index signatures allow dynamic key access used in `incrementState`.

### Event typing

```typescript
interface SECustomEvent extends Event {
  detail?: SEEventDetail;
}

interface SEEventDetail {
  listener?: string;
  event?: SEEvent;
  session?: SESession;
  fieldData?: FieldData;
}

interface ChatMessageData {
  text?: string;
  displayName?: string;
  username?: string;
  nick?: string;
  userId?: string;
  emotes?: { name?: string }[];
}

interface SEEventData extends ChatMessageData {
  redemption?: string; // channel points reward title
  amount?: number;
  providerId?: string;
  key?: string; // kvstore:update
  value?: WidgetState;
  // ...
}

interface SEEvent {
  type?: string; // e.g. "channelPointsRedemption"
  itemId?: string; // emulator reward title; also forces redemption routing
  data?: SEEventData;
  name?: string; // redeemer fallback when data has no user fields (-latest / emulator)
}
```

`FieldData` mirrors `widgetFields.json`: `meterMaximum`, `showChars`, `showRedemptionAnnouncements`, `numberOfSecondsBetweenReports`, `reportsShouldDisplay`.

### Mock / test events

**Live-style Twitch redemption** — use `listener: "event"` and `data.username` / `data.displayName` (see `makeExampleTwitchChannelPointsRedemptionDetail`).

**Editor-style redemption** — `name` on `event` when `data` has no user fields:

```typescript
new CustomEvent("onEventReceived", {
  detail: {
    listener: "redemption-latest",
    event: {
      type: "channelPointsRedemption",
      data: { redemption: "Bless the Run" },
      name: "TestUser",
    },
  },
});
```

## Sandbox limitations

- No cookies or IndexedDB — use `SE_API.store` or your own HTTP backend.
- Docs note restricted `console.*` in sandbox; blessMeter uses `console.log` (works in editor/OBS browser source in practice).
- External scripts/fonts allowed via `<script>` / `<link>` / `@import`.

## Emulating `widget-button` tests

```javascript
if (listener === "widget-button" && data.field === "myButton") {
  window.dispatchEvent(
    new CustomEvent("onEventReceived", {
      detail: {
        listener: "message",
        event: { data: { text: "Test", displayName: "SE" } },
      },
    })
  );
}
```
