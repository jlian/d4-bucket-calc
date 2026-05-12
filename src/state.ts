import pako from 'pako';
import { DEFAULT_BUILD, DEFAULT_ADDITIVE_LINES, cloneDefaultLines, type Build, type AdditiveLine } from './calc';

const STORAGE_KEY = 'd4bc.build';

// AdditiveLine has a function field that doesn't survive JSON. Serialize as {id,value} pairs.
function lineToSerial(l: AdditiveLine) { return { id: l.id, value: l.value }; }
function rehydrateLines(serial: { id: string; value: number }[] | undefined): AdditiveLine[] {
  const map = Object.fromEntries(DEFAULT_ADDITIVE_LINES.map(d => [d.id, d]));
  const out = cloneDefaultLines();
  if (serial) {
    for (const s of serial) {
      const target = out.find(l => l.id === s.id);
      if (target) target.value = s.value;
      else if (map[s.id]) out.push({ ...map[s.id], value: s.value });
    }
  }
  return out;
}

function buildToSerial(b: Build): any {
  return { ...b, additiveLines: b.additiveLines.map(lineToSerial), snapshot: b.snapshot ? buildToSerial(b.snapshot) : null };
}

function serialToBuild(j: any): Build {
  return {
    ...DEFAULT_BUILD,
    ...j,
    slots: j.slots ?? DEFAULT_BUILD.slots,
    extraMultipliers: j.extraMultipliers ?? [],
    extraAdditive: j.extraAdditive ?? [],
    additiveLines: rehydrateLines(j.additiveLines),
    snapshot: j.snapshot ? serialToBuild(j.snapshot) : null,
  };
}

export function saveLocal(b: Build) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(buildToSerial(b))); } catch {}
}

export function loadLocal(): Build | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return serialToBuild(JSON.parse(raw));
  } catch { return null; }
}

export function encodeHash(b: Build): string {
  const json = JSON.stringify(buildToSerial(b));
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
    return serialToBuild(JSON.parse(json));
  } catch { return null; }
}

export function exportJson(b: Build): string {
  return JSON.stringify(buildToSerial(b), null, 2);
}
export function importJson(text: string): Build | null {
  try { return serialToBuild(JSON.parse(text)); } catch { return null; }
}

export function loadInitialBuild(): Build {
  const hash = window.location.hash.replace(/^#/, '');
  if (hash) {
    const b = decodeHash(hash);
    if (b) return b;
  }
  return loadLocal() ?? defaultBuild();
}

export function defaultBuild(): Build { return { ...DEFAULT_BUILD, additiveLines: cloneDefaultLines(), slots: structuredClone(DEFAULT_BUILD.slots), extraMultipliers: [], extraAdditive: [], snapshot: null }; }

export function cloneBuild(b: Build): Build {
  return { ...b, additiveLines: b.additiveLines.map(l => ({ ...l })), slots: structuredClone(b.slots), extraMultipliers: structuredClone(b.extraMultipliers), extraAdditive: structuredClone(b.extraAdditive), snapshot: b.snapshot ? cloneBuild(b.snapshot) : null };
}

export function persist(b: Build) {
  saveLocal(b);
  const h = encodeHash(b);
  history.replaceState(null, '', '#' + h);
}
