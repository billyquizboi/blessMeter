---
name: streamelements-custom-widget
description: >-
  Builds and maintains StreamElements Overlay custom widgets (HTML/CSS/JS/FIELDS),
  window events (onWidgetLoad, onEventReceived, onSessionUpdate), and SE_API
  (store, counters, queue). Use for blessMeter v1 widget work, channel point
  redemptions, overlay deployment, or StreamElements widget debugging.
---

# StreamElements custom widget development

Official docs:

- [Custom widget & SE_API](https://docs.streamelements.com/overlays/custom-widget)
- [Widget events](https://docs.streamelements.com/overlays/events)
- [First custom widget](https://docs.streamelements.com/overlays/first-custom-widget)
- [Widget structure & fields](https://docs.streamelements.com/overlays/widget-structure)
- [API reference (custom widgets)](https://dev.streamelements.com/docs/api-docs/775038fd4f4a9-stream-elements-custom-widgets)

Type definitions for this repo: [v1/se-api.d.ts](../../../v1/se-api.d.ts). Extended event/API reference: [reference.md](reference.md).

## blessMeter workflow (this repo)

| Artifact | Source                    | StreamElements tab |
| -------- | ------------------------- | ------------------ |
| Markup   | `v1/widget.html`          | HTML               |
| Styles   | `v1/widget.css`           | CSS                |
| Logic    | `v1/widget.js` (compiled) | JS                 |
| Settings | `v1/widgetFields.json`    | FIELDS             |

1. Edit **`v1/widget.ts`** only — never hand-edit `widget.js`.
2. Run `npm run fix` (format + lint fixes + build), or `npm run build` / `npm test` / `npm run dev`.
3. Paste the four artifacts into the overlay Custom Code Editor and save.
4. Local harness: `npm run dev` → open `http://localhost:8080/v1/localTest.html` (requires HTTP, not `file://`).

v2 (`v2/widget.html`, `v2/widget.css`, `v2/widget.js`) is a separate vertical-meter widget without the TypeScript pipeline.

## Custom widget anatomy

Four editor tabs:

- **HTML** — structure; `{{fieldName}}` substitutes field values at load time.
- **CSS** — normal CSS; `{{fieldName}}` works here too.
- **JS** — runs in a sandbox: no `document.cookie`, no IndexedDB. jQuery is included by default.
- **FIELDS** — JSON map of editor controls (`type`, `label`, `value`, optional `min`/`max`/`step`/`options`/`group`).

Read runtime field values in JS via `onWidgetLoad` → `obj.detail.fieldData`, not only `{{...}}` templating.

Reserved hidden fields: `widgetName`, `widgetAuthor`, `widgetDuration` (alert queue hold time in seconds).

## Window events (listen on `window`)

```javascript
window.addEventListener("onWidgetLoad", handler);
window.addEventListener("onEventReceived", handler);
window.addEventListener("onSessionUpdate", handler);
```

Handlers receive a DOM `Event`; payload is in **`event.detail`**.

### `onWidgetLoad`

Fires on load/refresh. Use for initial UI from session + fields + persisted store.

```javascript
const { fieldData, session, recents, currency, channel } = obj.detail;
const data = session.data; // follower-latest, tip-latest, goals, etc.
```

### `onEventReceived`

Fires for live activity and internal signals. Primary branches:

- `obj.detail.listener` — event kind (string).
- `obj.detail.event` — payload; shape depends on listener.

Prefer bracket notation (`obj.detail.event["name"]`) — many keys contain `-`.

**Common listeners:** `follower-latest`, `subscriber-latest`, `tip-latest`, `cheer-latest`, `message`, `delete-message`, `delete-messages`, `kvstore:update`, `widget-button`, `bot:counter`, `event:skip`, `alertService:toggleSound`.

Chat (`listener === "message"`): payload is **`obj.detail.event.data`** (`ChatMessageData` in `se-api.d.ts`). blessMeter emote-bless reads **`displayName`**, **`nick`**, and **`userId`** there — not `event.name`. See [reference.md](reference.md#chat-messages-message-listener).

### `onSessionUpdate`

Session stats refresh (goals, top donators). **Path differs from load:**

| Event             | Session stats path                    |
| ----------------- | ------------------------------------- |
| `onWidgetLoad`    | `obj.detail.session.data`             |
| `onSessionUpdate` | `obj.detail.session` (top-level keys) |

Prefer `onEventReceived` unless you need rich session-only data (e.g. goal widgets).

## SE_API essentials

Persist cross-widget state with **`SE_API.store`** (account-wide KV). No key deletion API — overwrite full objects only.

```javascript
SE_API.store.set("myKey", { count: 1 });
SE_API.store.get("myKey").then((obj) => {
  /* ... */
});
```

Each `set` broadcasts `onEventReceived` with `listener: "kvstore:update"` and:

```json
"event": { "data": { "key": "customWidget.myKey", "value": { ... } } }
```

Filter updates by `event.data.key` (prefixed with `customWidget.`).

Other methods: `SE_API.counters.get(name)`, `SE_API.sanitize({ message })`, `SE_API.cheerFilter(message)`, `SE_API.getOverlayStatus()`, `SE_API.setField(key, value, shouldReload)` (editor only), `SE_API.resumeQueue()`.

### Alert queue (`widgetDuration` + `resumeQueue`)

Add to FIELDS:

```json
"widgetDuration": { "type": "hidden", "value": 15 }
```

While your widget handles a queued alert, SE holds the global alert queue up to `widgetDuration` seconds. Call `SE_API.resumeQueue()` when your animation finishes (or early to skip). Non-alert events (e.g. `message`, `kvstore:update`) are often listed in a local `skippable` array so they still arrive during a hold — see [reference.md](reference.md).

## blessMeter-specific patterns

### Store key and state shape

- Store key: `blessCurseMeterState` (`STORE_KEY_NAME` in `widget.ts`).
- Persisted type: `WidgetState` (`current`, `allTime`, optional `showAll`, `redemptionHistory`, `lastRedemption`, `lastUpdated`) — see `se-api.d.ts`.

### `onEventReceived` envelope (blessMeter)

All handlers use the same top-level shape (`SEEventDetail`):

```javascript
const { listener, event, session } = obj.detail;
// event: { type?, itemId?, name?, data?, ... }
// session?.data?.["channel-points-latest"] — fallback for redemption title + user on some SE paths
```

`eventReceivedHandler` compares `detail.listener` **exactly** for `message` and `kvstore:update`. For redemptions it first takes `listener.split("-")[0]` (so `redemption-latest` → `redemption`), then treats **`event.type === "channelPointsRedemption"`** as a redemption even when `listener` is **`"event"`** (live Twitch channel points in tests and production).

### Event routing (`eventReceivedHandler`)

1. **Channel points:** `event.itemId` set → force `listener` to `redemption-latest`; else redemption when the normalized listener is `redemption`, or `event.type === "channelPointsRedemption"` (includes `listener: "event"`).
2. **`message`:** `handleChatMessage` — emote-triggered bless only; see chat section in [reference.md](reference.md#chat-messages-message-listener).
3. **`kvstore:update`:** refresh display when `event.data.key` matches the store key; fallback `SE_API.store.get` if payload shape differs in testing.
4. Other listeners are ignored.

### Redemption reward title (`getRedemptionName`)

Check in order:

1. `detail.event.data.redemption` — live Twitch
2. `detail.session.data["channel-points-latest"].redemption` — documented SE path
3. `detail.event.itemId` — SE overlay emulator (reward title string)

Reward titles must match exactly: `Bless the Run`, `Curse the Run`, `Blurse the Run`.

### Redeeming user (`getRedemptionUserIdentity`)

Do not use `event.name` for live Twitch redemptions when `event.data` has user fields. Resolution order (see `widget.ts`):

| Purpose                                                                    | Source (first match wins)                                                                                             |
| -------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| **`redemptionHistory` map key** (`trackingKey`)                            | `event.data.username` → `event.data.nick` → `session.data["channel-points-latest"].username` → `.name` → `event.name` |
| **Display** (`displayName`, announcements, `lastRedemption.redeemingUser`) | `event.data.displayName` → tracking key → `event.data.nick`; session path uses `displayName` → tracking key → `.name` |

`getRedeemingUserName()` is the display label only (`displayName` from the ref above). Canonical Twitch test fixture: `makeExampleTwitchChannelPointsRedemptionDetail` in `v1/widget.test.ts` (`listener: "event"`, `type: "channelPointsRedemption"`, `data.username` + `data.displayName`).

### Chat messages (emote bless)

When `listener === "message"`, user fields live on **`detail.event.data`** only:

- **Window / dedupe key:** `userId ?? nick ?? "unknown"`
- **Display / credited name:** `displayName ?? nick ?? userId`
- **Emote matching:** `emotes[].name` and tokenized `text`

`message.username` is typed but **not** read by blessMeter chat handling today.

### Multi-widget sync

`SE_API.store.set` triggers `kvstore:update` on **all** custom widgets on the account. Always merge read-modify-write: `get` → mutate → `set`. Do not assume only the writer receives the event.

### Testing

- **Jest:** mock `SE_API` on `window` before injecting `widget.js` (`v1/widget.test.ts`).
- **Browser:** `localTest.html` mocks store + re-emits `kvstore:update` after `set` (matches SE behavior).
- **Synthetic events:** `new CustomEvent("onEventReceived", { detail: { listener, event } })` then `window.dispatchEvent(...)`.

## Implementation checklist

When adding behavior to blessMeter v1:

- [ ] Types in `se-api.d.ts` if state or event shapes change
- [ ] Logic in `widget.ts`; run `npm run fix` or `npm run build` and commit `v1/widget.js`
- [ ] New editor settings in `widgetFields.json` + `FieldData` + `applyFieldData`
- [ ] Handle `onWidgetLoad` (fields + store init) and `onEventReceived` (redemptions + `kvstore:update`)
- [ ] Store updates use full `WidgetState` objects
- [ ] Tests in `widget.test.ts` for pure helpers and async store flows
- [ ] Copy built artifacts to StreamElements after merge

## Anti-patterns

- Editing `widget.js` directly (overwritten by build).
- Partial `SE_API.store.set` payloads (wiping sibling keys).
- Dot access on keys with hyphens (`session.data.follower-latest` breaks).
- Relying on a single redemption payload path — always use the three-location fallback for **reward title** and the `getRedemptionUserIdentity` fallbacks for **user**.
- Reading chat usernames from `event.name` or assuming `listener` is `redemption-latest` on live Twitch (`listener: "event"` + `type: "channelPointsRedemption"` is normal).
- Expecting `widgetDuration` to queue chat `message` events.
