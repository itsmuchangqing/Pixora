import type { ExportScale } from '../models/pixel';
import {
  normalizeStudioPreferences,
  type StudioPreferences,
} from './preferences.service';

const HASH_KEY = 'pixora';
const SHARE_VERSION = 1;

export interface SharedStudioState {
  preferences: StudioPreferences;
  exportScale: ExportScale;
  lockedColors: string[];
}

export function createShareUrl(state: SharedStudioState): string {
  const payload = {
    v: SHARE_VERSION,
    preferences: state.preferences,
    exportScale: state.exportScale,
    lockedColors: state.lockedColors,
  };
  const bytes = new TextEncoder().encode(JSON.stringify(payload));
  const encoded = bytesToBase64Url(bytes);
  const base = `${window.location.origin}${window.location.pathname}`;
  return `${base}#${HASH_KEY}=${encoded}`;
}

/**
 * 读取分享链接中的参数，并清除地址栏 hash。
 * 分享的是设置，不含图片；打开链接后仍使用本地示例或用户自己的图片。
 */
export function readSharedStateFromUrl(): SharedStudioState | null {
  if (typeof window === 'undefined') return null;
  const hash = window.location.hash.replace(/^#/, '');
  if (!hash) return null;

  const params = new URLSearchParams(hash);
  const encoded = params.get(HASH_KEY);
  if (!encoded) return null;

  try {
    const bytes = base64UrlToBytes(encoded);
    const parsed = JSON.parse(new TextDecoder().decode(bytes)) as unknown;
    if (!isRecord(parsed)) return null;

    const preferences = normalizeStudioPreferences(
      parsed.preferences,
    );
    const exportScale = normalizeExportScale(parsed.exportScale);
    const lockedColors = Array.isArray(parsed.lockedColors)
      ? parsed.lockedColors.filter(
          (color): color is string =>
            typeof color === 'string' &&
            /^#[0-9a-f]{6}$/i.test(color),
        )
      : [];

    return { preferences, exportScale, lockedColors };
  } catch {
    return null;
  }
}

export function clearShareHash(): void {
  if (typeof window === 'undefined') return;
  if (!window.location.hash) return;
  window.history.replaceState(
    null,
    '',
    `${window.location.pathname}${window.location.search}`,
  );
}

function normalizeExportScale(value: unknown): ExportScale {
  return value === 2 || value === 4 ? value : 1;
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = '';
  const chunk = 0x8000;
  for (let index = 0; index < bytes.length; index += chunk) {
    binary += String.fromCharCode(
      ...bytes.subarray(index, index + chunk),
    );
  }
  return window
    .btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function base64UrlToBytes(value: string): Uint8Array {
  const padded = value
    .replace(/-/g, '+')
    .replace(/_/g, '/')
    .padEnd(Math.ceil(value.length / 4) * 4, '=');
  const binary = window.atob(padded);
  return Uint8Array.from(binary, (character) =>
    character.charCodeAt(0),
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
