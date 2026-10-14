# File Cabinet

An interactive file drawer for a landing page, drawn in the same line style as the artwork. Open `index.html` to try it.

- **Click a folder** and it springs up out of the drawer. Its papers slide out above it, and the folders around it lean away to make room. Click it again, click outside it, or press Esc to put it back.
- **Hover** lifts a folder slightly, and the drawer drifts with the mouse for a little depth.
- **On load**, a riffle runs through the files from back to front. Clicking the yellow label runs it again.
- **Sound**: soft paper swishes play on open and close. Sounds only play after a click, and a button turns them off.
- **Keyboard**: Tab moves between folders, Enter or Space opens one, and Esc closes it. With reduced motion turned on, everything snaps instead of springing.

## Use it on your site

```html
<div id="cabinet"></div>
<script src="cabinet.js"></script>
<script>
  Cabinet.mount(document.getElementById('cabinet'), {
    label: "sam's secret files",
    // rows: [...]        your own folders, back to front (defaults to the artwork's)
    // sound: false       start muted
    // soundButton: false hide the sound toggle
    // intro: false       skip the opening riffle
  });
</script>
```

It has no dependencies and fills the width of its container. Its height follows from the width, with room at the top for folders to rise into. Load Inter, IBM Plex Mono and Caveat for the intended type; otherwise it falls back to system fonts.

Each row is either a folder or a divider:

```js
{ n: 116, name: 'ruby', tab: 'c', href: '/work/ruby' }  // tab: 'l', 'c' or 'r'; href adds an "Open file" link
{ letter: 'R', count: '002', x: 157 }                   // black divider tab, x = tab position
```

`mount` returns `{ open(n), close(), riffle(), setSound(on) }`.

You can restyle it with CSS variables on the container: `--cab-bg`, `--cab-ink` and `--cab-yellow`.
