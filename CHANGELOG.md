# Changelog

All notable changes to this project are documented here.

## [1.0.0] - 2026-11-27

### Added

- Local-first pixel-art conversion with edge-aware downsampling, Lab palette
  quantization, dithering, outlines and target-resolution export.
- Batch asset queue with per-item status, retry, ZIP export and sprite sheets.
- Crop, rotate, flip, clipboard paste, canvas zoom/pan and before/after compare.
- Pixel selection inspector with coordinate, HEX and palette highlighting.
- Context-sensitive color control for brush, bucket and selected pixels.
- Palette editing, color locking, custom palette import and single-pixel recolor.
- Eraser that restores colors from the generated base image.
- Undo/redo history, pixel grid and hover color inspection.
- Local projects and automatic drafts backed by IndexedDB.
- Shareable settings links, sample assets, keyboard shortcuts and PWA offline
  support.
- Optional Express API skeleton and MVC architecture documentation.

### Known limitations

- Background removal is optimized for solid-color backgrounds.
- Batch items share the same generation parameters.
- The eraser restores the generated base image and does not provide transparent
  erasing.
- Accounts, cloud history and a production upload API are not implemented.
