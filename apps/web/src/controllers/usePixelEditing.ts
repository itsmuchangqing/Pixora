import { ref } from 'vue';
import type {
  EditorTool,
  PixelGrid,
  StudioItem,
} from '../models/pixel';
import {
  mapGridToPalette,
  parseHexColor,
  replaceGridColor,
  rgbToHex,
} from '../services/palette.service';

const MAX_HISTORY_STEPS = 14;

interface GridHistory {
  undo: Uint8ClampedArray[];
  redo: Uint8ClampedArray[];
}

/**
 * 手绘修正与调色板编辑（Controller 子模块）。
 * 直接修改低分辨率网格；
 * 不重新跑聚类，因此每一笔都能即时显示。
 */
export function usePixelEditing() {
  const tool = ref<EditorTool>('move');
  const brushColor = ref('#2e1065');
  const brushSize = ref(1);
  const showGrid = ref(false);
  const gridVersion = ref(0);
  const historyTick = ref(0);
  const lockedColors = ref<Set<string>>(new Set());

  const histories = new Map<string, GridHistory>();

  function activeItem(item: StudioItem | null): boolean {
    return Boolean(item?.grid);
  }

  function getHistory(itemId: string): GridHistory {
    let history = histories.get(itemId);
    if (!history) {
      history = { undo: [], redo: [] };
      histories.set(itemId, history);
    }
    return history;
  }

  function beginChange(item: StudioItem | null): boolean {
    if (!item?.grid) return false;
    const history = getHistory(item.id);
    history.undo.push(new Uint8ClampedArray(item.grid.data));
    if (history.undo.length > MAX_HISTORY_STEPS) {
      history.undo.shift();
    }
    history.redo = [];
    historyTick.value += 1;
    return true;
  }

  function updatePalette(grid: PixelGrid): void {
    grid.palette = extractGridPalette(grid);
  }

  function touch(): void {
    gridVersion.value += 1;
  }

  function resetHistory(itemId?: string): void {
    if (itemId) histories.delete(itemId);
    else histories.clear();
    historyTick.value += 1;
  }

  function canUndoItem(itemId: string | null | undefined): boolean {
    historyTick.value;
    if (!itemId) return false;
    return (histories.get(itemId)?.undo.length ?? 0) > 0;
  }

  function canRedoItem(itemId: string | null | undefined): boolean {
    historyTick.value;
    if (!itemId) return false;
    return (histories.get(itemId)?.redo.length ?? 0) > 0;
  }

  function undo(item: StudioItem | null): boolean {
    if (!item?.grid) return false;
    const history = getHistory(item.id);
    const previous = history.undo.pop();
    if (!previous) return false;

    history.redo.push(new Uint8ClampedArray(item.grid.data));
    item.grid.data.set(previous);
    updatePalette(item.grid);
    touch();
    historyTick.value += 1;
    return true;
  }

  function redo(item: StudioItem | null): boolean {
    if (!item?.grid) return false;
    const history = getHistory(item.id);
    const next = history.redo.pop();
    if (!next) return false;

    history.undo.push(new Uint8ClampedArray(item.grid.data));
    item.grid.data.set(next);
    updatePalette(item.grid);
    touch();
    historyTick.value += 1;
    return true;
  }

  function setTool(nextTool: EditorTool): void {
    tool.value = nextTool;
    if (nextTool !== 'move') {
      showGrid.value = true;
    }
  }

  function setBrushColor(color: string): void {
    if (parseHexColor(color)) brushColor.value = color;
  }

  function setBrushSize(size: number): void {
    brushSize.value = Math.max(1, Math.min(4, Math.round(size)));
  }

  function toggleGrid(): void {
    showGrid.value = !showGrid.value;
  }

  function toggleLock(color: string): void {
    const next = new Set(lockedColors.value);
    if (next.has(color)) next.delete(color);
    else next.add(color);
    lockedColors.value = next;
  }

  function isLocked(color: string): boolean {
    return lockedColors.value.has(color);
  }

  function setLockedColors(colors: string[]): void {
    lockedColors.value = new Set(
      colors.filter((color) => /^#[0-9a-f]{6}$/i.test(color)),
    );
  }

  /** 鼠标按下时记录一次历史；一次拖动只算一步撤销 */
  function beginStroke(item: StudioItem | null): boolean {
    return beginChange(item);
  }

  function paint(
    item: StudioItem | null,
    gridX: number,
    gridY: number,
    erase: boolean,
  ): boolean {
    if (!item?.grid) return false;
    const grid = item.grid;
    const base =
      erase &&
      item.baseGrid &&
      item.baseGrid.width === grid.width &&
      item.baseGrid.height === grid.height
        ? item.baseGrid
        : null;
    if (erase && !base) return false;

    const color = erase ? null : parseHexColor(brushColor.value);
    if (!erase && !color) return false;

    const size = brushSize.value;
    const startX = gridX - Math.floor((size - 1) / 2);
    const startY = gridY - Math.floor((size - 1) / 2);
    let changed = false;

    for (let y = startY; y < startY + size; y += 1) {
      if (y < 0 || y >= grid.height) continue;
      for (let x = startX; x < startX + size; x += 1) {
        if (x < 0 || x >= grid.width) continue;
        const offset = (y * grid.width + x) * 4;
        if (erase) {
          // 橡皮擦不是“白色画笔”：恢复最近一次自动生成的底图颜色。
          const baseOffset = offset;
          if (
            grid.data[offset] === base!.data[baseOffset] &&
            grid.data[offset + 1] === base!.data[baseOffset + 1] &&
            grid.data[offset + 2] === base!.data[baseOffset + 2] &&
            grid.data[offset + 3] === base!.data[baseOffset + 3]
          ) {
            continue;
          }
          grid.data[offset] = base!.data[baseOffset]!;
          grid.data[offset + 1] = base!.data[baseOffset + 1]!;
          grid.data[offset + 2] = base!.data[baseOffset + 2]!;
          grid.data[offset + 3] = base!.data[baseOffset + 3]!;
          changed = true;
        } else {
          if (
            grid.data[offset] === color!.red &&
            grid.data[offset + 1] === color!.green &&
            grid.data[offset + 2] === color!.blue &&
            grid.data[offset + 3] === 255
          ) {
            continue;
          }
          grid.data[offset] = color!.red;
          grid.data[offset + 1] = color!.green;
          grid.data[offset + 2] = color!.blue;
          grid.data[offset + 3] = 255;
          changed = true;
        }
      }
    }

    if (changed) {
      touch();
    }
    return changed;
  }

  interface PixelColorTarget {
    grid: PixelGrid;
    offset: number;
    color: { red: number; green: number; blue: number };
  }

  function resolvePixelColorTarget(
    item: StudioItem | null,
    gridX: number,
    gridY: number,
    colorHex: string,
  ): PixelColorTarget | null {
    if (!item?.grid) return null;
    const grid = item.grid;
    if (
      gridX < 0 ||
      gridY < 0 ||
      gridX >= grid.width ||
      gridY >= grid.height
    ) {
      return null;
    }

    const color = parseHexColor(colorHex);
    if (!color) return null;

    const offset = (gridY * grid.width + gridX) * 4;
    if (
      grid.data[offset] === color.red &&
      grid.data[offset + 1] === color.green &&
      grid.data[offset + 2] === color.blue &&
      grid.data[offset + 3] === 255
    ) {
      return null;
    }

    return { grid, offset, color };
  }

  function writePixelColorTarget(
    target: PixelColorTarget,
    updatePaletteNow: boolean,
  ): void {
    const { grid, offset, color } = target;
    grid.data[offset] = color.red;
    grid.data[offset + 1] = color.green;
    grid.data[offset + 2] = color.blue;
    grid.data[offset + 3] = 255;
    if (updatePaletteNow) updatePalette(grid);
    touch();
  }

  /** 选择工具使用：只修改一个像素，不依赖当前画笔大小 */
  function setPixelColor(
    item: StudioItem | null,
    gridX: number,
    gridY: number,
    colorHex: string,
  ): boolean {
    const target = resolvePixelColorTarget(
      item,
      gridX,
      gridY,
      colorHex,
    );
    if (!target) return false;
    if (!beginChange(item)) return false;
    writePixelColorTarget(target, true);
    return true;
  }

  /** 原生颜色选择器拖动时实时预览，不重复写入撤销历史 */
  function previewPixelColor(
    item: StudioItem | null,
    gridX: number,
    gridY: number,
    colorHex: string,
  ): boolean {
    const target = resolvePixelColorTarget(
      item,
      gridX,
      gridY,
      colorHex,
    );
    if (!target) return false;
    writePixelColorTarget(target, false);
    return true;
  }

  /** 结束实时取色：刷新色板，把新颜色正式加入当前画面 */
  function finishPixelColorPreview(item: StudioItem | null): void {
    if (item?.grid) updatePalette(item.grid);
  }

  function bucketFill(
    item: StudioItem | null,
    gridX: number,
    gridY: number,
  ): boolean {
    if (!item?.grid) return false;
    const grid = item.grid;
    if (
      gridX < 0 ||
      gridY < 0 ||
      gridX >= grid.width ||
      gridY >= grid.height
    ) {
      return false;
    }

    const color = parseHexColor(brushColor.value);
    if (!color) return false;

    const startOffset = (gridY * grid.width + gridX) * 4;
    const target = [
      grid.data[startOffset]!,
      grid.data[startOffset + 1]!,
      grid.data[startOffset + 2]!,
      grid.data[startOffset + 3]!,
    ] as const;
    if (
      target[0] === color.red &&
      target[1] === color.green &&
      target[2] === color.blue &&
      target[3] === 255
    ) {
      return false;
    }

    const stack: Array<[number, number]> = [[gridX, gridY]];
    let changed = false;

    while (stack.length > 0) {
      const [x, y] = stack.pop()!;
      if (x < 0 || y < 0 || x >= grid.width || y >= grid.height) continue;

      const offset = (y * grid.width + x) * 4;
      if (
        grid.data[offset] !== target[0] ||
        grid.data[offset + 1] !== target[1] ||
        grid.data[offset + 2] !== target[2] ||
        grid.data[offset + 3] !== target[3]
      ) {
        continue;
      }

      grid.data[offset] = color.red;
      grid.data[offset + 1] = color.green;
      grid.data[offset + 2] = color.blue;
      grid.data[offset + 3] = 255;
      changed = true;

      stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
    }

    if (changed) {
      updatePalette(grid);
      touch();
    }
    return changed;
  }

  function sampleColor(
    item: StudioItem | null,
    gridX: number,
    gridY: number,
  ): string | null {
    if (!item?.grid) return null;
    const grid = item.grid;
    if (
      gridX < 0 ||
      gridY < 0 ||
      gridX >= grid.width ||
      gridY >= grid.height
    ) {
      return null;
    }

    const offset = (gridY * grid.width + gridX) * 4;
    if (grid.data[offset + 3] === 0) return null;
    return rgbToHex({
      red: grid.data[offset]!,
      green: grid.data[offset + 1]!,
      blue: grid.data[offset + 2]!,
    });
  }

  function changePaletteColor(
    item: StudioItem | null,
    from: string,
    to: string,
  ): boolean {
    if (!item?.grid) return false;
    if (lockedColors.value.has(from)) return false;
    if (!beginChange(item)) return false;

    const changed = replaceGridColor(item.grid.data, from, to);
    if (changed === 0) {
      // 没有像素使用该颜色，撤销刚压入的空步骤。
      const history = getHistory(item.id);
      history.undo.pop();
      historyTick.value += 1;
      return false;
    }

    updatePalette(item.grid);
    touch();
    return true;
  }

  function importPalette(
    item: StudioItem | null,
    palette: string[],
  ): number {
    if (!item?.grid || palette.length === 0) return 0;
    if (!beginChange(item)) return 0;
    const changed = mapGridToPalette(
      item.grid.data,
      palette,
      lockedColors.value,
    );
    if (changed === 0) {
      const history = getHistory(item.id);
      history.undo.pop();
      historyTick.value += 1;
      return 0;
    }

    updatePalette(item.grid);
    touch();
    return changed;
  }

  function resetPaletteEffects(
    item: StudioItem | null,
  ): boolean {
    // 调色板映射是不可逆的；提供撤销即可，不做伪恢复。
    return undo(item);
  }

  function syncPalette(item: StudioItem | null): void {
    if (item?.grid) updatePalette(item.grid);
  }

  return {
    tool,
    brushColor,
    brushSize,
    showGrid,
    gridVersion,
    lockedColors,
    canUndoItem,
    canRedoItem,
    activeItem,
    beginStroke,
    paint,
    setPixelColor,
    previewPixelColor,
    finishPixelColorPreview,
    bucketFill,
    sampleColor,
    setTool,
    setBrushColor,
    setBrushSize,
    toggleGrid,
    toggleLock,
    isLocked,
    setLockedColors,
    undo,
    redo,
    resetHistory,
    changePaletteColor,
    importPalette,
    resetPaletteEffects,
    syncPalette,
    touch,
  };
}

/** 与 pixel-art.service 中的提取逻辑保持同一规则，避免循环依赖 */
function extractGridPalette(grid: PixelGrid): string[] {
  const counts = new Map<string, number>();

  for (let index = 0; index < grid.data.length; index += 4) {
    if (grid.data[index + 3]! < 112) continue;
    const key = `${grid.data[index]},${grid.data[index + 1]},${grid.data[index + 2]}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  return Array.from(counts.entries())
    .sort((first, second) => second[1] - first[1])
    .map(([key]) => {
      const [red, green, blue] = key.split(',').map(Number);
      return rgbToHex({
        red: red ?? 0,
        green: green ?? 0,
        blue: blue ?? 0,
      });
    });
}
