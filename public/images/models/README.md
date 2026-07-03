# Model images

Use one folder per model slug.

Recommended naming:

- `cover.webp`: large horizontal image for hero/profile cover.
- `profile.webp`: vertical portrait image for cards/profile.
- `gallery-01.webp`, `gallery-02.webp`, `gallery-03.webp`: gallery images.

The app currently points to JPG files in `src/data/models.json` and
`src/data/galleries.json`. The SVG files can remain as lightweight fallback
placeholders during development.
