# Scrapyard Story Builder

A dependency-free, browser-based editor and playable prototype for a left/right side-scrolling life and salvage game.

## Run it

On Windows, double-click `START_EDITOR.cmd`. You can also open `index.html` directly in a modern browser.

For the most reliable image importing, start a tiny local server from this folder:

```powershell
python -m http.server 8080
```

Then open `http://localhost:8080`.

## Editor basics

- **World:** choose a parallax layer and place buses, stops, cars, gates, workers, props, player starts, and triggers.
- **Scene outliner:** every placed object and interaction appears in one searchable list. Click an item to select it and jump to its location; use the eye and delete buttons to hide or remove it. Anything beyond the playable bounds is marked **outside area**.
- **Assets:** import PNG, WebP, JPEG, or GIF images. Open Asset Studio for a large preview, dimensions, usage information, renaming, replacing, deleting, and placing.
- **Sprite sheets:** zoom into a large sheet and drag a box around one item. The eyedropper samples its background color; the tolerance slider removes a range of nearby colors. Extracting creates a separate, automatically trimmed transparent PNG while preserving the original sheet. You can also download the selected rectangle as an individual PNG without adding it to the project library.
- **Background removal:** the checkerboard is initially a preview only. Use **Create transparent copy** to preserve the original, **Apply to this asset** to update the project asset and all placed uses of it, or **Download transparent PNG** to save a standalone processed image. Optional trimming removes empty transparent edges.
- **Transforms:** selected scene objects can be rotated freely, turned in 90° steps, or flipped left/right from the Inspector.
- **Character:** assign transparent body-part images to the six character layers. The playtest animates those layers procedurally for walking and crawling.
- **Character Animator:** build separate standing, idle, walking, running, crawling, jumping, and sitting animations. Each animation has its own frame timeline. Assign an asset to a body layer, drag it on the preview, or edit its position, rotation, scale, and flip precisely.
- **Animation export:** export the currently selected animation as a transparent horizontal PNG frame strip or an animated GIF at the chosen playback speed.
- **Inspector:** select an object to edit its position, size, layer, interaction, reward, failure chance, or bus departure timing.
- **Navigation:** mouse wheel pans; Ctrl + wheel zooms. `V`, `H`, and `T` select, pan, and draw triggers.
- **Play scene:** use A/D or arrow keys, C/Down/Ctrl to crawl, and E/Space/Enter to interact. Touch controls appear on mobile.

## Saving and asset storage

- **Autosave:** the full working project is saved in the browser's IndexedDB database on the local hard drive. A smaller localStorage fallback is also attempted for compatibility.
- **Save Project:** creates a portable `.scrapyard` project file in Downloads. Use **Open Project** to load it again.
- Imported and extracted images are embedded in the project as image data, so a `.scrapyard` file contains its assets and can be moved to another computer.
- Assets are not automatically written as separate files. Use **Download image** in Asset Studio when you want an individual PNG or source image on disk.
- **Download saved image** downloads exactly what placement uses. **Download transparent PNG** applies the currently previewed color and tolerance without changing the project.
- Browser autosave belongs to that browser profile and address. Keep `.scrapyard` files as durable backups.

## Current prototype scope

This first version includes the core scene editor, four parallax layers, asset importing, layered character animation, dialogue and salvage triggers, randomized part breakage, pay rewards, a clock, mobile controls, and a bus that drives away while shrinking into the distance.

It intentionally keeps the project data readable and portable. The next useful systems are multiple scenes (home, road, junkyard), schedules and day transitions, inventory/tools, sprite-sheet animation, room decoration, and a packaged desktop/mobile build.
