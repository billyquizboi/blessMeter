# blessMeter widget

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

## Chrono Trigger (CT) theme and font

The **CT** button switches the widget to a Chrono Trigger inspired menu look:

- **Window background**: a vertical gradient sampled from the in-game main menu windows (blue-grey at the top fading to near black at the bottom) over a darkened version of the stone tile. The tile source is [ct_background_tile.png](./ct_background_tile.png); the CSS embeds it as a base64 `data:` URI because StreamElements only hosts the CSS, HTML, JS and fields you paste in. To change the tile, edit the PNG, re-encode it (`base64 -w0 ct_background_tile.png`) and replace the `data:image/png;base64,...` string in `widget.css`.
- **Text**: [Chrono Trigger Monospaced](https://fontstruct.com/fontstructions/show/686711/chrono_trigger_monospaced_1) by Patrick H. Lauke (redux) on FontStruct, a recreation of the in-game menu font. It is licensed [Creative Commons Attribution 3.0](https://creativecommons.org/licenses/by/3.0/), so you must credit the designer when you use or redistribute it. Final Fantasy, Chrono Trigger and all other trademarked material is the intellectual property of Square Enix.

The font file is **not bundled** in this repository, because FontStruct only offers downloads to logged-in users. `widget.css` already declares an `@font-face` for it, and the CT theme uses this font stack:

```css
--ct-font-family: "Chrono Trigger Monospaced", "Press Start 2P", monospace;
```

Until you set the font up using one of the options below, the CT theme falls back to Press Start 2P (already loaded by the widget), which has the same 8px-cell proportions. Everything is sized to fit either font.

### Getting the font file

1. Create a free account at [fontstruct.com](https://fontstruct.com) and open the [font page](https://fontstruct.com/fontstructions/show/686711/chrono_trigger_monospaced_1).
2. Click **Download** and unzip the archive. It contains a `.ttf`.

### Option A: embed the font in widget.css (recommended)

Works everywhere (StreamElements editor preview, OBS, any machine) with no hosting, and matches how the CT background tile is already shipped.

1. Convert the TTF to a subset WOFF2 containing only printable ASCII (a few KB), using [fonttools](https://github.com/fonttools/fonttools):

   ```bash
   pip install fonttools brotli
   pyftsubset ChronoTriggerMonospaced.ttf --unicodes="U+0020-007E" --flavor=woff2 --output-file=ctm.woff2
   base64 -w0 ctm.woff2 > ctm.b64    # on macOS: base64 -i ctm.woff2 | tr -d '\n' > ctm.b64
   ```

   (A web converter such as [Transfonter](https://transfonter.org/) does the same, including the base64 step.)

2. In `widget.css`, add the data URI to the `src` of the existing `@font-face`:

   ```css
   @font-face {
     font-family: "Chrono Trigger Monospaced";
     src:
       local("Chrono Trigger Monospaced"),
       url("data:font/woff2;base64,PASTE_CONTENTS_OF_ctm.b64_HERE") format("woff2");
     font-weight: 400;
     font-style: normal;
     font-display: swap;
   }
   ```

3. Paste the updated `widget.css` into the StreamElements CSS tab.

Trade-off: the CSS grows by a few KB to tens of KB, and your copy of `widget.css` is no longer identical to the repository's.

### Option B: host the font file and reference it by URL

Keeps `widget.css` small. Host `ChronoTriggerMonospaced.woff2` (or the `.ttf`) somewhere that serves it over **HTTPS** with an `Access-Control-Allow-Origin` header, because browsers fetch web fonts with CORS. [GitHub Pages](https://pages.github.com/) and [jsDelivr](https://www.jsdelivr.com/?docs=gh) (for a font committed to a public GitHub repo) both qualify; so does any object storage or CDN bucket with CORS enabled.

```css
src:
  local("Chrono Trigger Monospaced"),
  url("https://your-host.example/fonts/ChronoTriggerMonospaced.woff2") format("woff2");
```

Trade-offs: the overlay depends on that host staying up, and if you commit the font into a repo you also need to include the CC BY credit alongside it. A relative `url()` does not work in StreamElements, since only the pasted CSS is hosted.

### Option C: install the font on the streaming PC

No code change needed: `widget.css` already tries `local("Chrono Trigger Monospaced")`.

1. Install the `.ttf` on the machine that runs OBS (Windows: right-click, **Install for all users**; macOS: Font Book; Linux: copy to `~/.fonts` and run `fc-cache -f`).
2. Fully restart OBS, then refresh the browser source.

Trade-offs: only that machine sees the font. The StreamElements editor preview, other browsers and any other computer showing the overlay fall back to Press Start 2P. This is the fastest way to try the font out locally with `npm run dev`.

### Tuning text size for the font

Sizes for the CT theme come from three CSS variables at the top of the CT section in `widget.css`:

| Variable                  | Default | Used for                                       |
| ------------------------- | ------- | ---------------------------------------------- |
| `--ct-font-size`          | `16px`  | Buttons, meter titles, counts                  |
| `--ct-font-size-small`    | `14px`  | Redemption and top-redeemer list announcements |
| `--ct-font-size-headline` | `16px`  | Centered report and transition headlines       |

Pixel fonts are sharpest when the rendered size is a whole multiple of the font's native pixel grid. If the text looks blurry, uneven, too small or clipped with the real font, adjust these values (try multiples such as `16px` and `24px`, or the size at which each pixel lands on a whole screen pixel) and re-check the longest strings: `ALL CURSE`, `Test Blurse`, and a top-redeemers row with a long username. The meter title column is sized from the font itself (`min-width: 9ch`), so it grows or shrinks with the font automatically.

## Development

All commands below are run from the **repository root** (the folder that contains `package.json`, one level above `widget/`).

### Prerequisites

- **[Node.js](https://nodejs.org/)** 20 or newer (the project CI uses Node 20). The installer includes **npm**.
- After installing, confirm in a terminal: `node -v` and `npm -v`.

On Windows, use the official Node installer or a version manager (for example [nvm-windows](https://github.com/coreybutler/nvm-windows)). On macOS/Linux, the installer or [nvm](https://github.com/nvm-sh/nvm) both work.

### Install dependencies

From the repository root, once per clone (or after `package.json` changes):

```bash
npm install
```

For a clean install that matches the lockfile exactly (same as CI): `npm ci`.

### Dev server

| Action                  | Command                                                |
| ----------------------- | ------------------------------------------------------ |
| Start (build + serve)   | `npm run dev`                                          |
| Serve only (no compile) | `npm run serve`                                        |
| Stop                    | **Ctrl+C** in the terminal where the server is running |

`npm run dev` compiles TypeScript, then starts a static server at **http://localhost:8080**. Open the local harness at **http://localhost:8080/widget/localTest.html**.

Use another port if 8080 is busy: `npm run serve -- --port 8090` (run `npm run build` first if you changed `.ts` files and skipped `npm run dev`).

### Source files

[widget.js](./widget.js) is the file used by the StreamElements widget editor. It is generated from [widget.ts](./widget.ts) — do not edit `widget.js` directly. Edit `widget.ts` and rebuild using `npm run build`.

### npm commands

| Command          | Description                                       |
| ---------------- | ------------------------------------------------- |
| `npm run build`  | Compiles `widget.ts` → `widget.js` via TypeScript |
| `npm test`       | Compiles TypeScript then runs the Jest test suite |
| `npm run dev`    | Build, then serve the repo for local testing      |
| `npm run serve`  | Serve without rebuilding                          |
| `npm run lint`   | Run ESLint                                        |
| `npm run format` | Format the repo with Prettier                     |

### Testing locally in a browser

For local testing and development there is a useful development server and testing harness
that can be run in a console from the root of the project.

[localTest.html](./localTest.html) runs the widget in a browser without touching StreamElements.
It loads the real [widget.html](./widget.html) in an iframe and injects jQuery, a mocked `SE_API`, and the compiled [widget.js](./widget.js) into it,
so it always exercises the current files on disk. Nothing in the harness is pasted into the StreamElements editor.

Use the below commands to start the development server:

```shell
npm run build
npm run dev
// will print
// Local test harness: http://localhost:8080/widget/localTest.html
// which is the url to open in the browser to see the testing page
```

Start the dev server as above, then open <http://localhost:8080/widget/localTest.html>.

A local server is required because a `file://` page gets an opaque origin, which blocks both `fetch()` and scripting into the iframe.

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

To shut down the development server, press CTRL+C in the console where it was run or search for Node JS processes to kill.

To run the automated test suite:

```shell
npm run test
```

## How it works

The widget has event listeners which are called and process when certain redemptions are redeemed in twitch chat.
When showing the current run, the meter lengths are calculated based on numberOfRedeems/meterMaximumNumberOfRedeems.
When showing all time info, the meter lengths are calculated as a percentage of the total number of redeems of all types

See stream elements documentation on custom widgets like:

- [Getting Started](https://docs.streamelements.com/overlays/getting-started#custom-widget) - The initial setup of a custom widget.
- [Custom Widget & SE_API](https://docs.streamelements.com/overlays/custom-widget) - Used to persist and manage widget state.
- [Custom Widget Events](https://docs.streamelements.com/overlays/custom-widget-events) - Information on stream elements window event listeners which drive the functionality of the widget.
