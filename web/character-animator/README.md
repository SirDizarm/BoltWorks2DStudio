# BoltWorks Character Animator

Standalone extraction of the Character Animator from `web/legacy-working-editor`.

Open `index.html` or run `START_CHARACTER_ANIMATOR.cmd`. The workspace autosaves in the browser under its own storage key and does not overwrite the legacy editor project.

Click the selected body layer again, or use **Deselect body layer**, to clear selection. Selected layers support uniform scale plus independent width/height scaling. The restored hand/foot bend panel provides main and tip cuts, cut direction, bend zones, split-piece offsets, nudging, and preview guides; all bend values are stored per animation frame and included in exports.

Every slider supports exact keyboard adjustment: use Tab to focus it, then Left/Down to decrease or Right/Up to increase. Visible −/+ buttons beside each slider provide the same step-by-step control.

Use `.boltchar` backups to transfer a character and its embedded body-part assets between this tool and the legacy editor. **Save character backup** now opens a Save As dialog so the backup filename can be changed before saving.

The Asset Picker supports replacing an image in place, renaming its picker label, saving the original image under a chosen filename, and deleting obsolete images. Replacing preserves the asset ID, so every body part and animation frame using it updates automatically. Deleting removes that image from every frame that referenced it.

Each animation has four independently editable movement directions: side/right, side/left, forward toward the screen, and back/away from the screen.

The forward/front-facing direction is the base workflow. Build an animation there first, switch to right, left, or back, then use **Copy front-facing timeline into this view**. The complete frames are copied—including scale, placement, bends, and sprite-sheet columns/rows/cells—so the other view can be made by changing its body-part cells.

Body-layer display names can be renamed independently in every view. Select a layer and use **Rename selected layer for this view**; clearing the name restores its original label. Renaming changes only the editor label, never the underlying layer ID or its animation data.

In a version 2 `.boltchar` backup, game code can read directions from:

- `character.animations[state]` for the side/right view
- `character.directionAnimations.left[state]` for the side/left view
- `character.directionAnimations.forward[state]` for movement toward the screen
- `character.directionAnimations.back[state]` for movement away from the screen

The forward and back directions retain their independently editable walking and running timelines.

## Included mechanic artwork

The corrected transparent sheets are `mechanic-front-parts-v2.png`, `mechanic-back-parts-v2.png`, `mechanic-side-right-parts.png`, and `mechanic-side-left-parts.png`. Import a sheet, assign it to a layer, then set **Columns = 3**, **Rows = 2**, and choose the appropriate cell:

1. Left arm
2. Torso
3. Right arm
4. Left-leg pose
5. Head
6. Right-leg pose

For lifted-foot walk frames, use `mechanic-walk-toward-sole-legs.png` or `mechanic-walk-away-sole-legs.png` with **Columns = 2** and **Rows = 1**. Cell 1 is the left leg; cell 2 is the right leg. Both sheets expose the boot underside for the airborne step.

For side-view airborne frames, use `mechanic-walk-side-sole-legs.png` with **Columns = 2** and **Rows = 1**. Cell 1 faces right; cell 2 faces left.
