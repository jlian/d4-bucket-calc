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
  baseDamage: number;
  speed: number;            // attacks per second baseline
  hands: 1 | 2;
}

export const WEAPON_TYPES: WeaponType[] = [
  { id: 'none',        label: '(none)',                     baseDamage: 0,    speed: 0,    hands: 1 },
  { id: '1h_sword',    label: '1H Sword',                   baseDamage: 1884, speed: 1.1,  hands: 1 },
  { id: '1h_mace',     label: '1H Mace',                    baseDamage: 1884, speed: 0.9,  hands: 1 },
  { id: '1h_axe',      label: '1H Axe',                     baseDamage: 1884, speed: 1.0,  hands: 1 },
  { id: '1h_dagger',   label: '1H Dagger',                  baseDamage: 1728, speed: 1.4,  hands: 1 },
  { id: '1h_flail',    label: '1H Flail',                   baseDamage: 1728, speed: 1.0,  hands: 1 },
  { id: '1h_wand',     label: 'Wand',                       baseDamage: 1728, speed: 1.4,  hands: 1 },
  { id: '1h_focus',    label: 'Focus (off-hand)',           baseDamage: 0,    speed: 0,    hands: 1 },
  { id: 'shield',      label: 'Shield (off-hand)',          baseDamage: 0,    speed: 0,    hands: 1 },
  { id: '2h_mace',     label: '2H Mace',                    baseDamage: 4607, speed: 0.7,  hands: 2 },
  { id: '2h_axe',      label: '2H Axe',                     baseDamage: 4607, speed: 0.8,  hands: 2 },
  { id: '2h_sword',    label: '2H Sword',                   baseDamage: 4146, speed: 0.9,  hands: 2 },
  { id: '2h_glaive',   label: '2H Glaive',                  baseDamage: 4146, speed: 0.9,  hands: 2 },
  { id: '2h_polearm',  label: '2H Polearm',                 baseDamage: 4607, speed: 0.9,  hands: 2 },
  { id: '2h_bow',      label: '2H Bow',                     baseDamage: 3768, speed: 1.0,  hands: 2 },
  { id: '2h_xbow',     label: '2H Crossbow',                baseDamage: 4607, speed: 0.85, hands: 2 },
  { id: '2h_qstaff',   label: '2H Quarterstaff',            baseDamage: 3768, speed: 1.0,  hands: 2 },
];

export function weaponTypeById(id: string): WeaponType {
  return WEAPON_TYPES.find(w => w.id === id) ?? WEAPON_TYPES[0];
}

// ---- Buckets ----
export type Bucket =
  | 'CSDM' | 'VDM' | 'DOTM' | 'ALLM' | 'NONPHYS'
  | 'ADDITIVE' | 'CRITADD'
  | 'MAINSTAT' | 'WEPDMG' | 'GEM'
  | 'CRITCHANCE' | 'SKILLRANK' | 'EXTRAMULT';

export interface Affix { bucket: Bucket; value: number; label?: string; }

export interface Slot {
  id: string;
  name: string;
  weaponTypeId?: string;
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

// ---- Additive lines (matches in-game UI order) ----
// `applies` returns whether this line should be added to the current scenario's additive.
export interface AdditiveLine {
  id: string;
  label: string;
  value: number;
  applies: (s: ScenarioConditions) => boolean;
  isCritOnly?: boolean;
}

export interface ScenarioConditions {
  vulnerable?: boolean;
  close?: boolean;
  distant?: boolean;
  elites?: boolean;
  cc?: boolean;
  healthy?: boolean;
  poisoned?: boolean;
  isCrit?: boolean;
}

const alwaysOn = () => true;
const ifCrit = (s: ScenarioConditions) => !!s.isCrit;
const ifVuln = (s: ScenarioConditions) => !!s.vulnerable;
const ifClose = (s: ScenarioConditions) => !!s.close;
const ifDistant = (s: ScenarioConditions) => !!s.distant;
const ifElites = (s: ScenarioConditions) => !!s.elites;
const ifCC = (s: ScenarioConditions) => !!s.cc;
const ifHealthy = (s: ScenarioConditions) => !!s.healthy;
const ifPoisoned = (s: ScenarioConditions) => !!s.poisoned;

// Note: in-game order. (No imbuement: it's a Rogue-only line and users can add it via Extra Additive.)
export const DEFAULT_ADDITIVE_LINES: AdditiveLine[] = [
  { id: 'crit',         label: 'Critical Strike Damage', value: 0, applies: ifCrit, isCritOnly: true },
  { id: 'vulnerable',   label: 'Vulnerable Damage',      value: 0, applies: ifVuln },
  { id: 'all',          label: 'All Damage',             value: 0, applies: alwaysOn },
  { id: 'fire',         label: 'Damage with Fire',       value: 0, applies: alwaysOn },
  { id: 'lightning',    label: 'Damage with Lightning',  value: 0, applies: alwaysOn },
  { id: 'cold',         label: 'Damage with Cold',       value: 0, applies: alwaysOn },
  { id: 'holy',         label: 'Damage with Holy',       value: 0, applies: alwaysOn },
  { id: 'poison',       label: 'Damage with Poison',     value: 0, applies: alwaysOn },
  { id: 'shadow',       label: 'Damage with Shadow',     value: 0, applies: alwaysOn },
  { id: 'ultimate',     label: 'Damage with Ultimate',   value: 0, applies: alwaysOn },
  { id: 'close',        label: 'Damage vs Close',        value: 0, applies: ifClose },
  { id: 'distant',      label: 'Damage vs Distant',      value: 0, applies: ifDistant },
  { id: 'elites',       label: 'Damage vs Elites',       value: 0, applies: ifElites },
  { id: 'cc',           label: 'Damage vs Crowd Controlled', value: 0, applies: ifCC },
  { id: 'healthy',      label: 'Damage vs Healthy',      value: 0, applies: ifHealthy },
  { id: 'poisoned',     label: 'Damage vs Poisoned',     value: 0, applies: ifPoisoned },
];

// Helper that clones default lines without losing function fields (structuredClone can't clone functions)
export function cloneDefaultLines(): AdditiveLine[] { return DEFAULT_ADDITIVE_LINES.map(l => ({ ...l })); }

// ---- Build ----
export interface Build {
  classId: ClassId;
  baseMainStat: number;
  extraMainStat: number;
  additiveLines: AdditiveLine[];
  extraAdditive: { label: string; value: number }[];
  skillName: string;
  skillCoefL1: number;
  skillRanks: number;
  extraSkillRanks: number;
  baseCritChance: number;
  attackSpeedBonus: number;        // % from Offensive tab
  weaponSpeedOverride: number | null; // null = use weapon type baseline
  disableCrit: boolean;
  enemyDR: number;                 // fixed at 0.20 = 80% reduction
  slots: Slot[];
  extraMultipliers: { label: string; value: number }[];
  snapshot?: Build | null;
}

export const DEFAULT_BUILD: Build = {
  classId: 'Paladin',
  baseMainStat: 800,
  extraMainStat: 0,
  additiveLines: cloneDefaultLines(),
  extraAdditive: [],
  skillName: 'Main Skill',
  skillCoefL1: 0.45,
  skillRanks: 5,
  extraSkillRanks: 0,
  baseCritChance: 0.05,
  attackSpeedBonus: 0,
  weaponSpeedOverride: null,
  disableCrit: false,
  enemyDR: 0.2,
  slots: structuredClone(DEFAULT_SLOTS),
  extraMultipliers: [],
  snapshot: null,
};

// ---- Calc ----
export interface Calc {
  mainStatSum: number;
  mainStatMult: number;
  csdm: number;
  vdm: number;
  dotm: number;
  allm: number;
  critChance: number;
  totalSkillRanks: number;
  skillCoef: number;
  weaponDmg: number;
  weaponSpeed: number;        // baseline avg from equipped weapons
  effectiveAttackRate: number; // weaponSpeed × (1 + attackSpeedBonus)
  extraMultProduct: number;
}

function sumAffixes(slots: Slot[], bucket: Bucket): number {
  let s = 0;
  for (const slot of slots) for (const a of slot.affixes) if (a.bucket === bucket) s += a.value;
  return s;
}

export function classFor(b: Build) { return CLASSES.find(c => c.id === b.classId)!; }

export function computeWeaponDamage(b: Build): { dmg: number; speed: number; hasAny: boolean } {
  let dmg = 0, hasAny = false, speedSum = 0, speedCount = 0;
  for (const slot of b.slots) {
    if (!slot.weaponTypeId) continue;
    const wt = weaponTypeById(slot.weaponTypeId);
    if (wt.baseDamage > 0) { dmg += wt.baseDamage; hasAny = true; }
    if (wt.speed > 0) { speedSum += wt.speed; speedCount++; }
    for (const a of slot.affixes) if (a.bucket === 'WEPDMG') dmg += a.value;
  }
  // Barbarian dual-2H bonus
  if (b.classId === 'Barbarian' && hasAny) {
    const w1 = b.slots.find(s => s.id === 'wep1');
    const w2 = b.slots.find(s => s.id === 'wep2');
    if (w1 && w2 && weaponTypeById(w1.weaponTypeId ?? 'none').hands === 2 && weaponTypeById(w2.weaponTypeId ?? 'none').hands === 2) dmg *= 2;
  }
  const speed = speedCount > 0 ? speedSum / speedCount : 0;
  return { dmg, speed, hasAny };
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
  if (totalSkillRanks > 0) {
    const N = totalSkillRanks, f = Math.floor(N / 5);
    skillCoef = b.skillCoefL1 * (1 + 0.10 * (N - f - 1) + 0.15 * f);
  }

  const csdm = 1 + sumAffixes(b.slots, 'CSDM');
  const vdm  = 1 + sumAffixes(b.slots, 'VDM');
  const dotm = 1 + sumAffixes(b.slots, 'DOTM');
  const allm = 1 + sumAffixes(b.slots, 'ALLM') + sumAffixes(b.slots, 'NONPHYS');

  const wd = computeWeaponDamage(b);
  const weaponSpeed = b.weaponSpeedOverride ?? wd.speed;
  const effectiveAttackRate = weaponSpeed * (1 + (b.attackSpeedBonus || 0));

  const extraMultProduct = b.extraMultipliers.reduce((p, m) => p * (1 + m.value), 1);

  return { mainStatSum, mainStatMult, csdm, vdm, dotm, allm, critChance, totalSkillRanks, skillCoef, weaponDmg: wd.dmg, weaponSpeed, effectiveAttackRate, extraMultProduct };
}

// ---- Per-scenario damage ----
export interface Scenario {
  id: string;
  label: string;
  conditions: ScenarioConditions;  // does NOT include isCrit; that's handled separately
  isDot?: boolean;
}

// Compute additive bucket value for a scenario (including extraAdditive + slot ADDITIVE/GEM + applicable lines)
function additiveForScenario(b: Build, conditions: ScenarioConditions): number {
  // Always-on/conditional applicable lines (excluding crit-only — handled separately)
  let add = 0;
  for (const l of b.additiveLines) {
    if (l.isCritOnly) continue;
    if (l.applies(conditions)) add += l.value;
  }
  add += b.extraAdditive.reduce((a, l) => a + l.value, 0);
  add += sumAffixes(b.slots, 'ADDITIVE');
  add += sumAffixes(b.slots, 'GEM');
  return add;
}

function critOnlyAdditive(b: Build): number {
  // CRITADD bucket from gear + Critical Strike Damage line from naked baseline
  let add = sumAffixes(b.slots, 'CRITADD');
  for (const l of b.additiveLines) if (l.isCritOnly) add += l.value;
  return add;
}

// Average damage for a scenario, factoring in crit chance automatically
export function scenarioDamage(b: Build, scenario: Scenario): number {
  const c = calc(b);
  if (c.weaponDmg === 0) return 0;

  const baseAdd = additiveForScenario(b, scenario.conditions);
  const critAddExtra = critOnlyAdditive(b);

  // Vuln baseline 20% multiplier applies if scenario is vulnerable
  const vdmFactor = c.vdm * (scenario.conditions.vulnerable ? 1.2 : 1);

  const baseFactors = c.weaponDmg * c.mainStatMult * vdmFactor * c.allm * c.skillCoef * c.extraMultProduct * b.enemyDR;

  if (scenario.isDot) return baseFactors * (1 + baseAdd) * c.dotm;

  const nonCritDmg = baseFactors * (1 + baseAdd);
  const critDmg = baseFactors * (1 + baseAdd + critAddExtra) * c.csdm * 1.5;
  return critDmg * c.critChance + nonCritDmg * (1 - c.critChance);
}

// "Plain (no crit)" = pretend crit chance is 0 for this scenario only
export function scenarioDamageNoCrit(b: Build, scenario: Scenario): number {
  const noCritBuild = { ...b, baseCritChance: 0, slots: b.slots.map(s => ({ ...s, affixes: s.affixes.filter(a => a.bucket !== 'CRITCHANCE') })) };
  return scenarioDamage(noCritBuild as Build, scenario);
}

function gainFromAddInScenario(b: Build, bucket: Bucket, delta: number, scenario: Scenario): number {
  const before = scenarioDamage(b, scenario);
  if (before === 0) return 0;
  // Cheap clone: only need slots[0].affixes mutable, share the rest
  const test: Build = { ...b, snapshot: null, slots: b.slots.map((s, i) => i === 0 ? { ...s, affixes: [...s.affixes, { bucket, value: delta }] } : s) };
  return scenarioDamage(test, scenario) / before - 1;
}

export function weightFor(b: Build, bucket: Bucket, typical: number, scenario: Scenario): number {
  return gainFromAddInScenario(b, bucket, typical * 1.75, scenario);
}

// ---- Bucket display ----
export const BUCKET_META: Record<Bucket, { label: string; isPercent: boolean; typicalRoll: number }> = {
  CSDM:       { label: '[x] Crit Strike Damage Mult', isPercent: true,  typicalRoll: 0.25 },
  VDM:        { label: '[x] Vulnerable Damage Mult',   isPercent: true,  typicalRoll: 0.14 },
  DOTM:       { label: '[x] DoT Damage Mult',          isPercent: true,  typicalRoll: 0.30 },
  ALLM:       { label: '[x] All/Elemental Damage Mult',isPercent: true,  typicalRoll: 0.10 },
  NONPHYS:    { label: '[x] Non-Physical Mult',        isPercent: true,  typicalRoll: 0.24 },
  ADDITIVE:   { label: '+ Additive Damage',            isPercent: true,  typicalRoll: 0.40 },
  CRITADD:    { label: '+ Crit Damage (additive)',     isPercent: true,  typicalRoll: 0.40 },
  MAINSTAT:   { label: '+ Main Stat',                  isPercent: false, typicalRoll: 180 },
  WEPDMG:     { label: '+ Weapon Damage Roll',         isPercent: false, typicalRoll: 196 },
  GEM:        { label: 'Weapon Gem (additive %)',      isPercent: true,  typicalRoll: 0.12 },
  CRITCHANCE: { label: '+ Crit Chance',                isPercent: true,  typicalRoll: 0.085 },
  SKILLRANK:  { label: '+ Skill Ranks',                isPercent: false, typicalRoll: 4 },
  EXTRAMULT:  { label: '[x] Standalone Multiplier',    isPercent: true,  typicalRoll: 0.20 },
};

export const BUCKET_ORDER: Bucket[] = ['CSDM','VDM','DOTM','ALLM','NONPHYS','ADDITIVE','CRITADD','MAINSTAT','WEPDMG','GEM','CRITCHANCE','SKILLRANK','EXTRAMULT'];

export function presetScenarios(): Scenario[] {
  return [
    { id: 'plain',     label: 'Plain hit (avg w/ crit)',    conditions: {} },
    { id: 'vuln',      label: 'vs Vulnerable',              conditions: { vulnerable: true } },
    { id: 'elite',     label: 'vs Elite',                   conditions: { elites: true } },
    { id: 'vuln_elite',label: 'vs Vulnerable Elite',        conditions: { vulnerable: true, elites: true } },
    { id: 'cc',        label: 'vs Crowd-Controlled',        conditions: { cc: true } },
    { id: 'healthy',   label: 'vs Healthy',                 conditions: { healthy: true } },
    { id: 'distant',   label: 'vs Distant',                 conditions: { distant: true } },
    { id: 'close',     label: 'vs Close',                   conditions: { close: true } },
    { id: 'poisoned',  label: 'vs Poisoned',                conditions: { poisoned: true } },
    { id: 'dot',       label: 'DoT tick',                   conditions: {}, isDot: true },
  ];
}
