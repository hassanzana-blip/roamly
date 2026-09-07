# HelloSky SVG Pack

This pack contains 44 true vector SVG assets for HelloSky.

## Files
- `icons/` — individual SVG files
- `hellosky-svg-library.svg` — scalable visual catalogue
- `hellosky-sprite.svg` — SVG symbol sprite
- `README.md`

## Design tokens
- HelloSky lime: `#C4F71D`
- Ink: `#161618`

Most primary strokes use `currentColor`, so components inherit CSS text color naturally.
The lime accent is intentionally selective.

## Example
```html
<img src="/icons/bag-checked.svg" alt="Innsjekket bagasje">
```

For React, SVGs can be imported through your existing Vite SVG workflow or inlined as components.

## Important
These are actual vectors, not raster previews. They stay sharp at any resolution.
