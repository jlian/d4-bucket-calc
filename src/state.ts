import pako from 'pako';
import { DEFAULT_BUILD, type Build } from './calc';

const STORAGE_KEY = 'd4bc.build';

export function saveLocal(b: Build) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(b)); } catch {}
}

export function loadLocal(): Build | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return mergeWithDefault(JSON.parse(raw));
  } catch { return null; }
}

export function encodeHash(b: Build): string {
  const json = JSON.stringify(b);
  const compressed = pako.deflate(json);
  let bin = '';
  for (let i = 0; i < compressed.length; i++) bin += String.fromCharCode(compressed[i]);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function decodeHash(hash: string): Build | null {
  try {
    let b64 = hash.replace(/-/g, '+').replace(/_/g, '/');
    while (b64.length % 4) b64 += '=';
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    const json = pako.inflate(bytes, { to: 'string' });
    return mergeWithDefault(JSON.parse(json));
  } catch { return null; }
}

function mergeWithDefault(b: any): Build {
  return { ...DEFAULT_BUILD, ...b, slots: b.slots ?? DEFAULT_BUILD.slots, extraMultipliers: b.extraMultipliers ?? [] };
}

export function loadInitialBuild(): Build {
  const hash = window.location.hash.replace(/^#/, '');
  if (hash) {
    const b = decodeHash(hash);
    if (b) return b;
  }
  return loadLocal() ?? structuredClone(DEFAULT_BUILD);
}

export function persist(b: Build) {
  saveLocal(b);
  const h = encodeHash(b);
  history.replaceState(null, '', '#' + h);
}
