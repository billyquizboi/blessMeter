# blessMeter V1

A FFVI inspired StreamElements custom widget for tracking number of blesses, curses, and blurses redeemed for a speedrun.

Final Fantasy and all other trademarked material is the intellectual property of Square Enix.

[Example display](./blessCurseMeterV1.png)

The basis of the display & styling for this widget is based on a repository [cafeTechne/Final-Fantasy-CSS](https://github.com/cafeTechne/Final-Fantasy-CSS). Thanks to cafeTechne for their work there.

It uses a font [Press Start 2P](https://fonts.google.com/specimen/Press+Start+2P) which is licensed under the [SIL Open Font License Version 1.1](https://fonts.google.com/specimen/Press+Start+2P/license). In accordance with that license, the license text is included in the css and html resources which relate to the Press Start 2P font.

## How to set it up

### Making the widget

- This widget can be added to a new overlay or an existing overlay
- Follow the initial instructions for creating a custom widget [here](https://docs.streamelements.com/overlays/getting-started#custom-widget)
- Once you have a custom widget created, select it in the UI by clicking on it
- In the left side-bar, click on 'Position, size, and style'
- The widget was tested using roughly 400px width and 200 pixel height but you can adjust as needed. You may need to modify the CSS or request me to make it more resizable in the CSS.
- In the left side-bar, click on 'Settings' again
- Click on the blue button 'Open Editor'
- Overwrite the contents of the HTML tab in the stream elements custom code editor with the contents of [widget.html](./widget.html)
- Overwrite the contents of the CSS tab in the stream elements custom code editor with the contents of [widget.css](./widget.css)
- Overwrite the contents of the JS tab in the stream elements custom code editor with the contents of [widget.js](./widget.js)
- Overwrite the contents of the Fields in the stream elements custom code editor with the contents of [widgetFields.json](./widgetFields.json). This allows configuring how many redeems it takes to fill the meter display by editing the 'Meter maximum count to be filled' field.
- Click DONE in the custom code editor and click the SAVE button in the top right

### One way to test on stream elements widget editor

These two steps result in every test redeem being considered a blurse, curse, or bless. Revert these changes and reset the meters before using live.

- Change this variable's value to true [widget.js line 11](./widget.js#L11) - this should only be used for testing and should be reverted when done.
- This line [widget.js line 194](./widget.js#L194) can be changed to one of: `updateState(numberOfBlursesKey);` `updateState(numberOfCursesKey);` or `updateState(numberOfBlessesKey);`

### To add this overlay as a source to OBS

- Copy the link to the widget from the top right link icon near the PREVIEW button

_These OBS instructions below were copied from google_

- In OBS, go to the "Sources" panel, click the + icon, and select Browse
- A "Create [Browser] Source" window will appear. Give the source a name (e.g., "StreamElements Overlay") and click OK.
- In the "Browser Source" properties:
- Paste the copied URL into the URL field.
- Set Width to (1920) and Height to (1080) (or your stream's resolution).
- Choose your desired FPS (e.g., (30) or (60)).
- Click OK to add the source.
- You can now position

## Development

### Source files

[widget.js](./widget.js) is the file used by the StreamElements widget editor. It is generated from [widget.ts](./widget.ts) — do not edit `widget.js` directly. Edit `widget.ts` and rebuild using `npm run build`.

### npm commands

Run these from the repository root (the directory containing `package.json`):

| Command         | Description                                                               |
| --------------- | ------------------------------------------------------------------------- |
| `npm run build` | Compiles `widget.ts` → `widget.js` via TypeScript                         |
| `npm test`      | Compiles TypeScript then runs the Jest test suite                         |
| `npm run dev`   | Compiles TypeScript then serves the repository for the local test harness |
| `npm run serve` | Serves the repository without rebuilding first                            |

### Testing locally in a browser

[localTest.html](./localTest.html) runs the widget in a browser without touching StreamElements. It loads the real [widget.html](./widget.html) in an iframe and injects jQuery, a mocked `SE_API`, and the compiled [widget.js](./widget.js) into it, so it always exercises the current files on disk. Nothing in the harness is pasted into the StreamElements editor.

- Run `npm run dev`
- Open <http://localhost:8080/v1/localTest.html>

A local server is required because a `file://` page gets an opaque origin, which blocks both `fetch()` and scripting into the iframe. Pass `--port` to use a different port: `npm run serve -- --port 8090`.

The dev panel on the right can:

- Fire `Bless the Run` / `Curse the Run` / `Blurse the Run` redemptions, or any custom reward name, as a chosen user
- Put the reward name in any of the three payload locations `getRedemptionName` reads: `event.data.redemption` (live Twitch), `session.data["channel-points-latest"].redemption` (SE docs), or `event.itemId` (SE emulator)
- Fire a burst of redemptions to see how the display queue behaves under rapid redeems
- Edit every field from [widgetFields.json](./widgetFields.json) (including emote-bless settings) and re-fire `onWidgetLoad`
- Dispatch chat `message` events with text and/or an `emotes` array, or fire a burst of matching emotes from distinct users
- Toggle the FFVI / Chrono Trigger background via the widget button or the harness theme controls
- Read, edit, and overwrite the persisted widget state as JSON, or apply presets such as a maxed bless meter or both meters at max
- Add artificial latency to `SE_API.store` calls, resize the widget frame, and reload the widget after a rebuild
- Log every `SE_API` call and dispatched event, optionally mirroring the widget's own `console.log` output

The mocked store is kept in `localStorage`, so state survives a reload; use "Clear store" to start over. Because the widget only redraws in response to the `kvstore:update` event that StreamElements broadcasts after `SE_API.store.set`, the mock re-emits that event too.

Two things behave the same locally as they do on StreamElements and are not harness problems: the "Show all" button text never changes, because the `updateToggleButtonDisplay` calls in [widget.ts](./widget.ts) are commented out, and the character sprites never appear, because `showCharSvg` is currently unused and the `.user-redeem-window` container keeps its `hidden` class.

## How it works

The widget has event listeners which are called and process when certain redemptions are redeemed in twitch chat. It uses the SE_API.store to persist and manage the widget state. The length of each meter in the widget display is calculated as a percentage of the total number of redeems of all types.

See stream elements documentation on custom widgets like:

- [Getting Started](https://docs.streamelements.com/overlays/getting-started#custom-widget) - The initial setup of a custom widget.
- [Custom Widget & SE_API](https://docs.streamelements.com/overlays/custom-widget) - Used to persist and manage widget state.
- [Custom Widget Events](https://docs.streamelements.com/overlays/custom-widget-events) - Information on stream elements window event listeners which drive the functionality of the widget.
