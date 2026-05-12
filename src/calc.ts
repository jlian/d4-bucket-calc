// Damage formula port from Avarilyn's "ALL CLASSES" sheet (D4 Season 13 Lord of Hatred).
// All percentages stored as decimals (50% = 0.5).

export type ClassId = 'Paladin' | 'Barbarian' | 'Druid' | 'Necromancer' | 'Rogue' | 'Sorcerer' | 'Spiritborn';

export const CLASSES: { id: ClassId; mainStat: string; divisor: number }[] = [
  { id: 'Paladin',      mainStat: 'Strength',     divisor: 800 },
  { id: 'Barbarian',    mainStat: 'Strength',     divisor: 900 },
  { id: 'Druid',        mainStat: 'Willpower',    divisor: 800 },
  { id: 'Necromancer',  mainStat: 'Intelligence', divisor: 800 },
  { id: 'Rogue',        mainStat: 'Dexterity',    divisor: 800 },
  { id: 'Sorcerer',     mainStat: 'Intelligence', divisor: 800 },
  { id: 'Spiritborn',   mainStat: 'Willpower',    divisor: 800 },
];

// Bucket identifiers
export type Bucket =
  | 'CSDM'      // [x] Critical Strike Damage Multiplier (sum-then-mult)
  | 'VDM'       // [x] Vulnerable Damage Multiplier
  | 'DOTM'      // [x] DoT Multiplier
  | 'ALLM'      // [x] All Damage Multiplier (also bundles elemental/phys mult)
  | 'NONPHYS'   // (folded into ALLM bucket per sheet)
  | 'ADDITIVE'  // single big additive bucket
  | 'CRITADD'   // additive that ONLY applies on crit (e.g. +Crit Damage from amulet/temper)
  | 'MAINSTAT'  // adds to main stat sum
  | 'WEPDMG'    // adds to weapon damage
  | 'CRITCHANCE'
  | 'SKILLRANK'
  | 'EXTRAMULT'; // standalone aspects/uniques like Grandfather (each its own factor)

// One affix on a gear slot
export interface Affix {
  bucket: Bucket;
  value: number;          // decimal (or absolute for MAINSTAT/WEPDMG/SKILLRANK)
  label?: string;         // optional human label, e.g. "Vuln Mult (amulet)"
}

// One gear slot — just a list of affixes
export interface Slot {
  id: string;
  name: string;
  affixes: Affix[];
}

export const DEFAULT_SLOTS: Slot[] = [
  { id: 'helm',    name: 'Helm',    affixes: [] },
  { id: 'chest',   name: 'Chest',   affixes: [] },
  { id: 'pants',   name: 'Pants',   affixes: [] },
  { id: 'boots',   name: 'Boots',   affixes: [] },
  { id: 'gloves',  name: 'Gloves',  affixes: [] },
  { id: 'amulet',  name: 'Amulet',  affixes: [] },
  { id: 'ring1',   name: 'Ring 1',  affixes: [] },
  { id: 'ring2',   name: 'Ring 2',  affixes: [] },
  { id: 'wep1',    name: 'Weapon 1', affixes: [] },
  { id: 'wep2',    name: 'Weapon 2 / Off-hand', affixes: [] },
];

export interface Build {
  classId: ClassId;
  baseMainStat: number;       // main stat from naked character (paragon + base)
  extraMainStat: number;      // from charms/talisman
  additivePool: number;       // % from naked character (sum of all additive lines, pre-uptime-weighted), as decimal
  skillCoefL1: number;        // e.g. 0.45
  skillRanks: number;         // e.g. 15
  extraSkillRanks: number;    // from items/effects
  baseCritChance: number;     // decimal (paragon + base, no items)
  disableCrit: boolean;       // true = DoT build, ignore crit
  enemyDR: number;            // 0.20 = training dummy default (after 80% reduction)
  weaponBaseDmg: number;      // average weapon damage (the big number)
  slots: Slot[];
  // Standalone unique/aspect multipliers (each its own factor)
  extraMultipliers: { label: string; value: number }[]; // value as decimal e.g. 0.30 = 30%[x]
}

export const DEFAULT_BUILD: Build = {
  classId: 'Paladin',
  baseMainStat: 800,
  extraMainStat: 0,
  additivePool: 0,
  skillCoefL1: 0.45,
  skillRanks: 5,
  extraSkillRanks: 0,
  baseCritChance: 0.05,
  disableCrit: false,
  enemyDR: 0.2,
  weaponBaseDmg: 3000,
  slots: structuredClone(DEFAULT_SLOTS),
  extraMultipliers: [],
};

// ---------------- Calc ----------------

export interface Calc {
  // Buckets
  mainStatSum: number;
  mainStatMult: number;       // (1 + sum/divisor)
  additiveTotal: number;      // 1 + sum  (NON-CRIT)
  additiveCritTotal: number;  // 1 + sum + critOnlyAdditive
  csdm: number;               // 1 + sum
  vdm: number;
  dotm: number;
  allm: number;
  critChance: number;         // capped at 1
  totalSkillRanks: number;
  skillCoef: number;          // includes step bonuses
  weaponDmg: number;
  extraMultProduct: number;   // product of all standalone uniques

  // Damage products
  nonCritDmg: number;
  critDmg: number;
  avgDmg: number;
  dotDmg: number;
}

function sum(slots: Slot[], bucket: Bucket): number {
  let s = 0;
  for (const slot of slots) for (const a of slot.affixes) if (a.bucket === bucket) s += a.value;
  return s;
}

export function classFor(b: Build) {
  return CLASSES.find(c => c.id === b.classId)!;
}

export function calc(b: Build): Calc {
  const cls = classFor(b);

  const mainStatSum = b.baseMainStat + b.extraMainStat + sum(b.slots, 'MAINSTAT');
  const mainStatMult = 1 + mainStatSum / cls.divisor;

  // Crit chance
  let critChance = b.baseCritChance + sum(b.slots, 'CRITCHANCE');
  if (b.disableCrit) critChance = 0;
  if (critChance > 1) critChance = 1;
  if (critChance < 0) critChance = 0;

  // Skill ranks + coefficient
  const totalSkillRanks = b.skillRanks + b.extraSkillRanks + sum(b.slots, 'SKILLRANK');
  const N = totalSkillRanks;
  // Step formula: base × (1 + 0.10×(N - floor(N/5) - 1) + 0.15×floor(N/5))
  // Guard for N=0: produce base × (1 - 0.10) ≈ underflow; clamp to base when N<=0.
  let skillCoef = b.skillCoefL1;
  if (N > 0) {
    const f = Math.floor(N / 5);
    skillCoef = b.skillCoefL1 * (1 + 0.10 * (N - f - 1) + 0.15 * f);
  }

  // Buckets
  const csdm = 1 + sum(b.slots, 'CSDM');
  const vdm  = 1 + sum(b.slots, 'VDM');
  const dotm = 1 + sum(b.slots, 'DOTM');
  // Per-sheet: ADMG bundles ALLM + NONPHYS (elemental + phys + all)
  const allm = 1 + sum(b.slots, 'ALLM') + sum(b.slots, 'NONPHYS');

  // Additive bucket (one big pool)
  const slotAdd = sum(b.slots, 'ADDITIVE');
  const critAdd = sum(b.slots, 'CRITADD');
  const additiveTotal = 1 + b.additivePool + slotAdd;
  const additiveCritTotal = additiveTotal + critAdd; // crit-only additive joins on crit

  // Weapon damage
  const weaponDmg = b.weaponBaseDmg + sum(b.slots, 'WEPDMG');

  // Standalone extra multipliers (each its own factor)
  const extraMultProduct = b.extraMultipliers.reduce((p, m) => p * (1 + m.value), 1);

  // Damage products (per xlsx column T/U)
  const baseProduct = weaponDmg * mainStatMult * vdm * allm * skillCoef * extraMultProduct * b.enemyDR;
  const nonCritDmg = baseProduct * additiveTotal;
  const critDmg = baseProduct * additiveCritTotal * csdm * 1.5;
  const avgDmg = critDmg * critChance + nonCritDmg * (1 - critChance);
  const dotDmg = baseProduct * additiveTotal * dotm; // DoT uses non-crit additive, no crit

  return {
    mainStatSum, mainStatMult,
    additiveTotal, additiveCritTotal,
    csdm, vdm, dotm, allm,
    critChance, totalSkillRanks, skillCoef,
    weaponDmg, extraMultProduct,
    nonCritDmg, critDmg, avgDmg, dotDmg,
  };
}

// Compute the "% gain" from adding `delta` to a bucket
export function gainFromAdd(b: Build, bucket: Bucket, delta: number): number {
  const before = calc(b);
  const baseDmg = b.disableCrit ? before.dotDmg : before.avgDmg;
  // Inject a temporary affix and recompute
  const test = structuredClone(b);
  test.slots[0].affixes.push({ bucket, value: delta });
  const after = calc(test);
  const newDmg = b.disableCrit ? after.dotDmg : after.avgDmg;
  return newDmg / baseDmg - 1;
}

// "Weight" = simulate a fresh GA roll on this affix (×1.75 per Avarilyn)
// For a typical roll value of `typical` (e.g. 28% for VDM), weight = gain from adding typical*1.75
export function weightFor(b: Build, bucket: Bucket, typical: number): number {
  return gainFromAdd(b, bucket, typical * 1.75);
}

// Bucket display metadata
export const BUCKET_META: Record<Bucket, { label: string; short: string; isPercent: boolean; typicalRoll: number }> = {
  CSDM:       { label: '[x] Crit Strike Damage Mult', short: 'CSDM',  isPercent: true,  typicalRoll: 0.25 },
  VDM:        { label: '[x] Vulnerable Damage Mult',   short: 'VDM',   isPercent: true,  typicalRoll: 0.14 },
  DOTM:       { label: '[x] DoT Damage Mult',          short: 'DOTM',  isPercent: true,  typicalRoll: 0.30 },
  ALLM:       { label: '[x] All Damage Mult',          short: 'ALLM',  isPercent: true,  typicalRoll: 0.10 },
  NONPHYS:    { label: '[x] Non-Physical Mult',        short: 'NPHY',  isPercent: true,  typicalRoll: 0.24 },
  ADDITIVE:   { label: '+ Additive Damage',            short: 'ADD',   isPercent: true,  typicalRoll: 0.40 },
  CRITADD:    { label: '+ Crit Damage (additive)',     short: 'CADD',  isPercent: true,  typicalRoll: 0.40 },
  MAINSTAT:   { label: '+ Main Stat',                  short: 'STAT',  isPercent: false, typicalRoll: 180 },
  WEPDMG:     { label: '+ Weapon Damage',              short: 'WEP',   isPercent: false, typicalRoll: 196 },
  CRITCHANCE: { label: '+ Crit Chance',                short: 'CC',    isPercent: true,  typicalRoll: 0.085 },
  SKILLRANK:  { label: '+ Skill Ranks',                short: 'RANK',  isPercent: false, typicalRoll: 4 },
  EXTRAMULT:  { label: '[x] Standalone Multiplier',    short: 'XMULT', isPercent: true,  typicalRoll: 0.20 },
};

export const BUCKET_ORDER: Bucket[] = [
  'CSDM','VDM','DOTM','ALLM','NONPHYS','ADDITIVE','CRITADD','MAINSTAT','WEPDMG','CRITCHANCE','SKILLRANK','EXTRAMULT'
];
