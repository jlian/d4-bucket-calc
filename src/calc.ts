// Damage formula port from Avarilyn's "ALL CLASSES" sheet (D4 Season 13 Lord of Hatred).
// All percentages stored as decimals (50% = 0.5) internally; UI shows them as %.

export type ClassId = 'Paladin' | 'Barbarian' | 'Druid' | 'Necromancer' | 'Rogue' | 'Sorcerer' | 'Spiritborn' | 'Warlock';

export const CLASSES: { id: ClassId; mainStat: string; divisor: number }[] = [
  { id: 'Paladin',      mainStat: 'Strength',     divisor: 800 },
  { id: 'Barbarian',    mainStat: 'Strength',     divisor: 900 },
  { id: 'Druid',        mainStat: 'Willpower',    divisor: 800 },
  { id: 'Necromancer',  mainStat: 'Intelligence', divisor: 800 },
  { id: 'Rogue',        mainStat: 'Dexterity',    divisor: 800 },
  { id: 'Sorcerer',     mainStat: 'Intelligence', divisor: 800 },
  { id: 'Spiritborn',   mainStat: 'Willpower',    divisor: 800 },
  { id: 'Warlock',      mainStat: 'Intelligence', divisor: 800 },
];

// ---- Weapon types ----
export interface WeaponType {
  id: string;
  label: string;
  baseDamage: number;       // average damage at 900 ipower, fully masterworked
  hands: 1 | 2;
  category: 'melee' | 'ranged';
}

export const WEAPON_TYPES: WeaponType[] = [
  { id: 'none',        label: '(none)',                   baseDamage: 0,    hands: 1, category: 'melee' },
  { id: '1h_sword',    label: '1H Sword/Mace/Axe',        baseDamage: 1884, hands: 1, category: 'melee' },
  { id: '1h_dagger',   label: '1H Dagger/Flail/Wand/Focus', baseDamage: 1728, hands: 1, category: 'melee' },
  { id: 'shield',      label: 'Shield (off-hand)',         baseDamage: 0,    hands: 1, category: 'melee' },
  { id: '2h_mace',     label: '2H Mace/Axe',               baseDamage: 4607, hands: 2, category: 'melee' },
  { id: '2h_sword',    label: '2H Sword/Glaive',           baseDamage: 4146, hands: 2, category: 'melee' },
  { id: '2h_polearm',  label: '2H Polearm',                baseDamage: 4607, hands: 2, category: 'melee' },
  { id: '2h_bow',      label: '2H Bow',                    baseDamage: 3768, hands: 2, category: 'ranged' },
  { id: '2h_xbow',     label: '2H Crossbow',               baseDamage: 4607, hands: 2, category: 'ranged' },
  { id: '2h_qstaff',   label: '2H Quarterstaff',           baseDamage: 3768, hands: 2, category: 'melee' },
];

export function weaponTypeById(id: string): WeaponType {
  return WEAPON_TYPES.find(w => w.id === id) ?? WEAPON_TYPES[0];
}

// ---- Buckets ----
export type Bucket =
  | 'CSDM'      // [x] Critical Strike Damage Multiplier (sum-then-mult)
  | 'VDM'       // [x] Vulnerable Damage Multiplier
  | 'DOTM'      // [x] DoT Multiplier
  | 'ALLM'      // [x] All Damage / Elemental / Physical Multiplier (bundled per Avarilyn)
  | 'NONPHYS'   // (folded into ALLM bucket per sheet)
  | 'ADDITIVE'  // single big additive bucket (joins always-on or conditional based on label)
  | 'CRITADD'   // additive that ONLY applies on crit (e.g. +Crit Damage on amulet/temper)
  | 'MAINSTAT'  // adds to main stat sum
  | 'WEPDMG'    // adds to weapon damage roll
  | 'GEM'       // weapon-socketed gem damage (additive %)
  | 'CRITCHANCE'
  | 'SKILLRANK'
  | 'EXTRAMULT'; // standalone aspects/uniques like Grandfather (each its own factor)

export interface Affix {
  bucket: Bucket;
  value: number;          // decimal (or absolute for MAINSTAT/WEPDMG/SKILLRANK)
  label?: string;
}

export interface Slot {
  id: string;
  name: string;
  weaponTypeId?: string;  // for weapon slots, picks base damage
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
  { id: 'wep1',    name: 'Weapon 1', weaponTypeId: 'none', affixes: [] },
  { id: 'wep2',    name: 'Weapon 2 / Off-hand', weaponTypeId: 'none', affixes: [] },
];

// ---- Additive lines: always-on vs conditional ----
export interface AdditiveLine {
  id: string;
  label: string;
  value: number;       // decimal e.g. 1.42 = 142%
  conditional: boolean; // true = applies only when scenario flag is on
}

export const DEFAULT_ADDITIVE_LINES: AdditiveLine[] = [
  // Always on
  { id: 'all',          label: 'All Damage',              value: 0, conditional: false },
  { id: 'primaryElem',  label: 'Primary Element',         value: 0, conditional: false },
  { id: 'dot',          label: 'Damage over Time',        value: 0, conditional: false },
  { id: 'imbued',       label: 'Imbued Damage',           value: 0, conditional: false },
  { id: 'overpower',    label: 'Overpower Damage',        value: 0, conditional: false },
  // Conditional (toggled per scenario)
  { id: 'vulnerable',   label: 'Vulnerable Damage',       value: 0, conditional: true },
  { id: 'close',        label: 'Damage to Close',         value: 0, conditional: true },
  { id: 'distant',      label: 'Damage to Distant',       value: 0, conditional: true },
  { id: 'elites',       label: 'Damage to Elites',        value: 0, conditional: true },
  { id: 'cc',           label: 'Damage to CC\u2019d',      value: 0, conditional: true },
  { id: 'healthy',      label: 'Damage to Healthy',       value: 0, conditional: true },
  { id: 'trapped',      label: 'Damage to Trapped',       value: 0, conditional: true },
];

// ---- Build ----
export interface Build {
  classId: ClassId;
  baseMainStat: number;
  extraMainStat: number;
  additiveLines: AdditiveLine[];
  extraAdditive: { label: string; value: number }[]; // catch-all additive entries
  skillName: string;
  skillCoefL1: number;
  skillRanks: number;
  extraSkillRanks: number;
  baseCritChance: number;     // naked baseline crit chance (decimal)
  attackSpeed: number;        // fully-geared AS for DPS readout (decimal)
  disableCrit: boolean;       // DoT build flag
  enemyDR: number;            // 0.20 = 80% reduction (training dummy)
  slots: Slot[];
  extraMultipliers: { label: string; value: number }[];
  // Conditional toggles for the "active scenario" output (mainly for the buckets calc)
  scenario: { vulnerable: boolean; close: boolean; distant: boolean; elites: boolean; cc: boolean; healthy: boolean; trapped: boolean };
  snapshot?: Build | null;
}

export const DEFAULT_BUILD: Build = {
  classId: 'Paladin',
  baseMainStat: 800,
  extraMainStat: 0,
  additiveLines: structuredClone(DEFAULT_ADDITIVE_LINES),
  extraAdditive: [],
  skillName: 'Main Skill',
  skillCoefL1: 0.45,
  skillRanks: 5,
  extraSkillRanks: 0,
  baseCritChance: 0.05,
  attackSpeed: 0,
  disableCrit: false,
  enemyDR: 0.2,
  slots: structuredClone(DEFAULT_SLOTS),
  extraMultipliers: [],
  scenario: { vulnerable: true, close: false, distant: false, elites: false, cc: false, healthy: false, trapped: false },
  snapshot: null,
};

// ---- Calc ----
export interface Calc {
  mainStatSum: number;
  mainStatMult: number;
  alwaysOnAdditive: number;     // decimal, sum of always-on additive lines + slot ADDITIVE + extraAdditive + GEM
  csdm: number;                 // 1 + sum
  vdm: number;
  dotm: number;
  allm: number;
  critChance: number;           // capped at 1
  totalSkillRanks: number;
  skillCoef: number;
  weaponDmg: number;
  extraMultProduct: number;
}

function sumAffixes(slots: Slot[], bucket: Bucket): number {
  let s = 0;
  for (const slot of slots) for (const a of slot.affixes) if (a.bucket === bucket) s += a.value;
  return s;
}

export function classFor(b: Build) {
  return CLASSES.find(c => c.id === b.classId)!;
}

// Compute weapon damage from slot weapon types + Wep affixes
export function computeWeaponDamage(b: Build): number {
  let total = 0;
  let hasAny = false;
  for (const slot of b.slots) {
    if (!slot.weaponTypeId) continue;
    const wt = weaponTypeById(slot.weaponTypeId);
    if (wt.id !== 'none' && wt.baseDamage > 0) {
      total += wt.baseDamage;
      hasAny = true;
    }
    // +Weapon Damage Roll affixes on weapon slots only
    for (const a of slot.affixes) if (a.bucket === 'WEPDMG') total += a.value;
  }
  if (!hasAny) return 0;
  // Barbarian dual-2H bonus: if both slots are 2H, multiply by 2
  if (b.classId === 'Barbarian') {
    const w1 = b.slots.find(s => s.id === 'wep1');
    const w2 = b.slots.find(s => s.id === 'wep2');
    if (w1 && w2 && weaponTypeById(w1.weaponTypeId ?? 'none').hands === 2 && weaponTypeById(w2.weaponTypeId ?? 'none').hands === 2) {
      total *= 2;
    }
  }
  return total;
}

export function calc(b: Build): Calc {
  const cls = classFor(b);

  const mainStatSum = b.baseMainStat + b.extraMainStat + sumAffixes(b.slots, 'MAINSTAT');
  const mainStatMult = 1 + mainStatSum / cls.divisor;

  let critChance = b.baseCritChance + sumAffixes(b.slots, 'CRITCHANCE');
  if (b.disableCrit) critChance = 0;
  critChance = Math.max(0, Math.min(1, critChance));

  const totalSkillRanks = b.skillRanks + b.extraSkillRanks + sumAffixes(b.slots, 'SKILLRANK');
  let skillCoef = b.skillCoefL1;
  const N = totalSkillRanks;
  if (N > 0) {
    const f = Math.floor(N / 5);
    skillCoef = b.skillCoefL1 * (1 + 0.10 * (N - f - 1) + 0.15 * f);
  }

  const csdm = 1 + sumAffixes(b.slots, 'CSDM');
  const vdm  = 1 + sumAffixes(b.slots, 'VDM');
  const dotm = 1 + sumAffixes(b.slots, 'DOTM');
  const allm = 1 + sumAffixes(b.slots, 'ALLM') + sumAffixes(b.slots, 'NONPHYS');

  // Always-on additive: always-on naked lines + slot ADDITIVE affixes + extraAdditive list + gem%
  const alwaysOnAdditive = b.additiveLines.filter(l => !l.conditional).reduce((a, l) => a + l.value, 0)
    + b.extraAdditive.reduce((a, l) => a + l.value, 0)
    + sumAffixes(b.slots, 'ADDITIVE')
    + sumAffixes(b.slots, 'GEM');

  const weaponDmg = computeWeaponDamage(b);

  const extraMultProduct = b.extraMultipliers.reduce((p, m) => p * (1 + m.value), 1);

  return {
    mainStatSum, mainStatMult,
    alwaysOnAdditive,
    csdm, vdm, dotm, allm,
    critChance, totalSkillRanks, skillCoef,
    weaponDmg, extraMultProduct,
  };
}

// ---- Per-scenario damage ----
export interface Scenario {
  conditions: { vulnerable?: boolean; close?: boolean; distant?: boolean; elites?: boolean; cc?: boolean; healthy?: boolean; trapped?: boolean };
  isCrit?: boolean;
  isDot?: boolean;
}

export function scenarioAdditive(b: Build, s: Scenario): number {
  const c = calc(b);
  let add = c.alwaysOnAdditive;
  for (const l of b.additiveLines) {
    if (!l.conditional) continue;
    if ((s.conditions as any)[l.id]) add += l.value;
  }
  // Crit-only additive (CRITADD bucket on slots)
  if (s.isCrit) add += sumAffixes(b.slots, 'CRITADD');
  return add;
}

export function scenarioVulnFactor(b: Build, s: Scenario): number {
  // Vuln baseline 20%[x] applies if the scenario's enemy is vulnerable
  const vulnBaseline = s.conditions.vulnerable ? 1.2 : 1;
  return calc(b).vdm * vulnBaseline;
}

export function scenarioDamage(b: Build, s: Scenario): number {
  const c = calc(b);
  if (c.weaponDmg === 0) return 0;
  const additive = 1 + scenarioAdditive(b, s);
  const vdmFactor = scenarioVulnFactor(b, s);
  const critFactor = s.isCrit ? c.csdm * 1.5 : 1;
  const dotFactor = s.isDot ? c.dotm : 1;
  return c.weaponDmg * c.mainStatMult * additive * vdmFactor * c.allm * c.skillCoef * c.extraMultProduct * b.enemyDR * critFactor * dotFactor;
}

// Marginal gain from temporarily adding `delta` to a bucket
function gainFromAddInScenario(b: Build, bucket: Bucket, delta: number, scenario: Scenario): number {
  const before = scenarioDamage(b, scenario);
  if (before === 0) return 0;
  const test = structuredClone(b);
  test.snapshot = null;
  test.slots[0].affixes.push({ bucket, value: delta });
  const after = scenarioDamage(test, scenario);
  return after / before - 1;
}

// "Weight" = a typical fresh GA roll on this bucket
export function weightFor(b: Build, bucket: Bucket, typical: number, scenario: Scenario): number {
  return gainFromAddInScenario(b, bucket, typical * 1.75, scenario);
}

// ---- Bucket display metadata ----
export const BUCKET_META: Record<Bucket, { label: string; short: string; isPercent: boolean; typicalRoll: number }> = {
  CSDM:       { label: '[x] Crit Strike Damage Mult', short: 'CSDM',  isPercent: true,  typicalRoll: 0.25 },
  VDM:        { label: '[x] Vulnerable Damage Mult',   short: 'VDM',   isPercent: true,  typicalRoll: 0.14 },
  DOTM:       { label: '[x] DoT Damage Mult',          short: 'DOTM',  isPercent: true,  typicalRoll: 0.30 },
  ALLM:       { label: '[x] All/Elemental Damage Mult',short: 'ALLM',  isPercent: true,  typicalRoll: 0.10 },
  NONPHYS:    { label: '[x] Non-Physical Mult',        short: 'NPHY',  isPercent: true,  typicalRoll: 0.24 },
  ADDITIVE:   { label: '+ Additive Damage',            short: 'ADD',   isPercent: true,  typicalRoll: 0.40 },
  CRITADD:    { label: '+ Crit Damage (additive)',     short: 'CADD',  isPercent: true,  typicalRoll: 0.40 },
  MAINSTAT:   { label: '+ Main Stat',                  short: 'STAT',  isPercent: false, typicalRoll: 180 },
  WEPDMG:     { label: '+ Weapon Damage Roll',         short: 'WEP',   isPercent: false, typicalRoll: 196 },
  GEM:        { label: 'Weapon Gem (additive %)',      short: 'GEM',   isPercent: true,  typicalRoll: 0.12 },
  CRITCHANCE: { label: '+ Crit Chance',                short: 'CC',    isPercent: true,  typicalRoll: 0.085 },
  SKILLRANK:  { label: '+ Skill Ranks',                short: 'RANK',  isPercent: false, typicalRoll: 4 },
  EXTRAMULT:  { label: '[x] Standalone Multiplier',    short: 'XMULT', isPercent: true,  typicalRoll: 0.20 },
};

export const BUCKET_ORDER: Bucket[] = [
  'CSDM','VDM','DOTM','ALLM','NONPHYS','ADDITIVE','CRITADD','MAINSTAT','WEPDMG','GEM','CRITCHANCE','SKILLRANK','EXTRAMULT'
];

// Output scenarios — preset list to display
export interface NamedScenario { id: string; label: string; scenario: Scenario; }

export function presetScenarios(): NamedScenario[] {
  return [
    { id: 'avg',         label: 'Plain hit',                scenario: { conditions: {}, isCrit: false } },
    { id: 'crit',        label: 'Plain crit',               scenario: { conditions: {}, isCrit: true } },
    { id: 'vuln',        label: 'vs Vulnerable',            scenario: { conditions: { vulnerable: true }, isCrit: false } },
    { id: 'vuln_crit',   label: 'vs Vulnerable (crit)',     scenario: { conditions: { vulnerable: true }, isCrit: true } },
    { id: 'elite',       label: 'vs Elite',                 scenario: { conditions: { elites: true }, isCrit: false } },
    { id: 'vuln_elite_crit', label: 'vs Vuln Elite (crit)', scenario: { conditions: { vulnerable: true, elites: true }, isCrit: true } },
    { id: 'cc',          label: 'vs CC\u2019d',              scenario: { conditions: { cc: true }, isCrit: false } },
    { id: 'healthy',     label: 'vs Healthy',               scenario: { conditions: { healthy: true }, isCrit: false } },
    { id: 'distant',     label: 'vs Distant',               scenario: { conditions: { distant: true }, isCrit: false } },
    { id: 'close',       label: 'vs Close',                 scenario: { conditions: { close: true }, isCrit: false } },
    { id: 'dot',         label: 'DoT tick',                 scenario: { conditions: {}, isCrit: false, isDot: true } },
  ];
}
