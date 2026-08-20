# Keyer personal score library

Put your personal tab files in `personal-score-files/inbox/`, then run:

```sh
node scripts/build-personal-score-catalog.js
```

Keyer’s **Tab files** bank will then let you search and open them.

Direct import keeps each authored string and fret position for:

- Guitar Pro: `.gp`, `.gpx`, `.gp3`, `.gp4`, `.gp5`
- MusicXML: `.musicxml`, `.xml`

Power Tab `.ptb` and `.pt2` files are catalogued but need conversion before
they can play in the browser. Open them in Power Tab Editor and export either
Guitar Pro (`.gp`) or MusicXML (`.musicxml`) into this folder. Do not convert
to MIDI if preserving the tab fingering matters—MIDI has pitch and timing but
does not record which string/fret the author chose.

This folder is intentionally empty in the repository. It is for files you are
authorized to use; the catalog builder records titles and track names but does
not publish the source tab data anywhere else.
