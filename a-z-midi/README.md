# A–Z MIDI bank

This directory contains the user-supplied Band-in-a-Box MIDI collection used by Keyer’s **A–Z MIDI songs** bank.

Run `node scripts/build-a-z-midi-catalog.js` after adding or replacing MIDI files. The generated catalog records embedded titles, tempos, usable chord-marker counts, and melody-track availability. Files without both readable chord markers and a melody track remain in this directory but are not shown as playable Keyer charts.
