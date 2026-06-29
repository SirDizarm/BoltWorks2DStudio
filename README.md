# BoltWorks Studio

![BoltWorks Studio logo](branding/boltworks-studio-logo.png)

**BoltWorks Studio** is a browser-based 2D game creation tool for building layered side-scroller story games from your own art.

It is currently being built alongside the first game project, **Scrapyard Story**, but the editor itself is meant to be reusable for other 2D projects too.

## What it does

- **World editor:** build side-scrolling scenes with parallax layers, ground art, foreground art, props, buses, NPCs, gates, triggers, scene exits, and player-start markers.
- **Asset Studio:** import large image sheets, remove backgrounds, cut selected areas into individual PNG assets, organize assets by shelf, and paint/erase/tweak textures.
- **Character Animator:** assemble a player from layered body parts, animate standing/idle/walking/running/crawling/jumping/sitting, adjust layer order, bend shoes/hands/parts, export previews, and save character setups.
- **Car / part builder:** assemble vehicles or objects from separate parts, then mark parts as removable with tool requirements, work time, break chance, and pay value.
- **Object scripting and playtest:** test scenes directly in the browser with player movement, object scripts, sound, bus behavior, triggers, and scene changes.

## Run it

On Windows, double-click `START_EDITOR.cmd`. You can also open `index.html` directly in a modern browser.

For the most reliable image importing, start a tiny local server from this folder:

```powershell
python -m http.server 8080
```

Then open:

```text
http://localhost:8080
```

## Export playable game

Use **Export game** to create a standalone player-only build. When the browser supports folder writing, BoltWorks Studio asks you to choose a folder and writes `index.html` into it. If folder writing is unavailable, it downloads a single self-contained `*-game.html` file instead.

This exported build does not include the editor panels, Asset Studio, Character Animator, or project-editing tools. It is an early runtime export, so it is meant for testing and will become more complete as the game systems grow.

## Saving and asset storage

- **Autosave:** the working project is saved in the browser's local storage/IndexedDB on your hard drive.
- **Save Project:** creates a portable `.boltworks` project file in Downloads.
- **Open Project:** loads `.boltworks`, older `.scrapyard`, or JSON project files.
- Imported and extracted images are embedded in the project data, so saved project files can be moved to another computer.
- Assets are not automatically written as separate PNG files unless you choose a download/export action in Asset Studio.

## Current status

BoltWorks Studio is an early private work-in-progress. The editor already includes scene editing, asset cutting/background removal, texture painting, layered character animation, car/object part building, playtesting, sounds, and scripted bus behavior.

The next major areas are stronger object scripting, room/home decoration tools, inventory/tools, more scene/gameplay systems, and eventually AI-assisted scripting or scene editing.

## License / rights

Copyright (c) 2026 SirDizarm.

All rights reserved.

This project is private work-in-progress software. No permission is granted to copy, redistribute, sell, publish, sublicense, or reuse the code, art, branding, project files, or assets unless explicit written permission is given by the copyright holder.

The license may change in the future if the project is released publicly or sold.