# Verbs

A website where each verb is performed, not just read. Doing the verb shows the word, its definition, and its history, set as justified type that fills the whole frame.

## Prototype: six gesture verbs

| Verb | What you do | What happens |
| --- | --- | --- |
| hover | move the mouse | the word, definition, origin and history fill the frame; words near the pointer go dark and heavy |
| click | click | hover disappears; the word, definition, origin and history appear. Each further click swaps in the computing sense and signifier |
| scroll | scroll the wheel (or swipe up/down) | the full entry scrolls and loops forever |
| drag | press and drag (or swipe sideways) | words get pulled along the lines and wrap back to the start |
| pinch | two fingers moving together (touchscreen or trackpad) | the pinch entry shrinks and repeats, packing more copies into the frame |
| stretch | two fingers moving apart | the stretch entry grows until a few giant words fill the frame |

Move the mouse away after clicking, scrolling or dragging to return to hover. Keys: Space/Enter clicks, arrows scroll and drag, `-` and `+` (or ctrl+wheel) pinch and stretch, Esc returns to hover.

## Files

- `index.html` page and styles
- `app.js` layout and interaction engine (fits justified text to the frame)
- `data/verbs.js` verb data, generated from the New Verbs spreadsheet
- `scripts/export_verbs.py` regenerates the data

## Updating the data

```
python3 scripts/export_verbs.py path/to/New-Verbs.xlsx hover click scroll drag@2 pinch stretch
```

`drag@2` picks the second `drag` row (desktop, c.1984). Pass no verbs to export every row.

Run locally with `python3 -m http.server` and open http://localhost:8000.
