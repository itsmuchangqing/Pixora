export const PIXEL_PRESETS = [
  { id: 'classic', name: '经典像素', description: '边界清晰的方形颗粒' },
  { id: 'mosaic', name: '马赛克', description: '更紧凑、更均匀的色块' },
  { id: 'poster', name: '复古海报', description: '高对比的怀旧印刷质感' },
  { id: 'soft', name: '柔焦颗粒', description: '保留更多细节的轻像素化' },
] as const;

export const COLOR_PALETTES = [
  { id: 'original', name: '保留原色' },
  { id: 'retro', name: '复古紫调' },
  { id: 'mono', name: '单色氛围' },
] as const;
