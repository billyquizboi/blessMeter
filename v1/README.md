# curseMeter V1

A FFVI inspired StreamElements custom widget for tracking number of blesses, curses, and blurses redeemed for a speedrun.

Final Fantasy and all other trademarked material is the intellectual property of Square Enix.

The basis of the display & styling for this widget is based on a repository [cafeTechne/Final-Fantasy-CSS](https://github.com/cafeTechne/Final-Fantasy-CSS). Thanks to cafeTechne for their work there.

It uses a font [Press Start 2P](https://fonts.google.com/specimen/Press+Start+2P) which is licensed under the [SIL Open Font License Version 1.1](https://fonts.google.com/specimen/Press+Start+2P/license). In accordance with that license, the license text is included in the css and html resources which relate to the Press Start 2P font.

# How to set it up for your stream

**Making the widget**
- This widget can be added to a new overlay or an existing overlay
- Follow the initial instructions for creating a custom widget [here](https://docs.streamelements.com/overlays/getting-started#custom-widget)
- Once you have a custom widget created, select it in the UI by clicking on it
- In the left side-bar, click on 'Position, size, and style'
- The widget was tested using roughly 400px width and 694 pixel height but you can adjust as needed. You may need to modify the CSS or request me to make it more resizable in the CSS.
- In the left side-bar, click on 'Settings' again 
- Click on the blue button 'Open Editor'
- Overwrite the contents of the HTML tab in the stream elements custom code editor with the contents of [widget.html](./widget.html) 
- Overwrite the contents of the CSS tab in the stream elements custom code editor with the contents of [widget.css](./widget.css)
- Overwrite the contents of the JS tab in the stream elements custom code editor with the contents of [widget.js](./widget.js)
- Click DONE in the custom code editor and click the SAVE button in the top right

**To add this overlay as a source to OBS**
- Copy the link to the widget from the top right link icon near the PREVIEW button

*These OBS instructions below were copied from google*
- In OBS, go to the "Sources" panel, click the + icon, and select Browse
- A "Create [Browser] Source" window will appear. Give the source a name (e.g., "StreamElements Overlay") and click OK.
- In the "Browser Source" properties:
- Paste the copied URL into the URL field.
- Set Width to  (1920) and Height to (1080) (or your stream's resolution).
- Choose your desired FPS (e.g., (30) or (60)).
- Click OK to add the source.
- You can now position

# How does it work?

The widget has event listeners which are called and process when certain redemptions are redeemed in twitch chat. It uses the SE_API.store to persist and manage the widget state. The length of each meter in the widget display is calculated as a percentage of the total number of redeems of all types.

See stream elements documentation on custom widgets like:

- [Getting Started](https://docs.streamelements.com/overlays/getting-started#custom-widget) - The initial setup of a custom widget.
- [Custom Widget & SE_API](https://docs.streamelements.com/overlays/custom-widget) - Used to persist and manage widget state.
- [Custom Widget Events](https://docs.streamelements.com/overlays/custom-widget-events) - Information on stream elements window event listeners which drive the functionality of the widget.
