// Damage formula port from Avarilyn's "ALL CLASSES" sheet (D4 Season 13 Lord of Hatred).
// All percentages stored as decimals (50% = 0.5) internally; UI shows them as %.

export type ClassId = 'Paladin' | 'Barbarian' | 'Druid' | 'Necromancer' | 'Rogue' | 'Sorcerer' | 'Spiritborn' | 'Warlock';

export const CLASSES: { id: ClassId; mainStat: string; divisor: number; weaponSlots: number }[] = [
  { id: 'Paladin',      mainStat: 'Strength',     divisor: 800, weaponSlots: 2 },
  { id: 'Barbarian',    mainStat: 'Strength',     divisor: 900, weaponSlots: 4 },
  { id: 'Druid',        mainStat: 'Willpower',    divisor: 800, weaponSlots: 2 },
  { id: 'Necromancer',  mainStat: 'Intelligence', divisor: 800, weaponSlots: 2 },
  { id: 'Rogue',        mainStat: 'Dexterity',    divisor: 800, weaponSlots: 3 },
  { id: 'Sorcerer',     mainStat: 'Intelligence', divisor: 800, weaponSlots: 2 },
  { id: 'Spiritborn',   mainStat: 'Willpower',    divisor: 800, weaponSlots: 1 },
  { id: 'Warlock',      mainStat: 'Intelligence', divisor: 800, weaponSlots: 2 },
];

// ---- Weapon types ----
// baseDamage: average damage at 900 ipower fully masterworked (per Avarilyn xlsx).
// speed (ApS, Attacks per Second): from Maxroll's attack speed mechanics article.
// allowedClasses: best-effort class restrictions for current Lord of Hatred patch.
export interface WeaponType {
  id: string;
  label: string;
  baseDamage: number;
  speed: number;
  hands: 1 | 2;
  allowedClasses?: ClassId[]; // omitted = all classes
}

export const WEAPON_TYPES: WeaponType[] = [
  { id: 'none',        label: '(none)',                     baseDamage: 0,    speed: 0,    hands: 1 },
  // 1H melee
  { id: '1h_sword',    label: '1H Sword',                   baseDamage: 1884, speed: 1.1,  hands: 1, allowedClasses: ['Paladin','Barbarian','Druid','Necromancer','Rogue'] },
  { id: '1h_mace',     label: '1H Mace',                    baseDamage: 1884, speed: 1.1,  hands: 1, allowedClasses: ['Paladin','Barbarian','Druid'] },
  { id: '1h_axe',      label: '1H Axe',                     baseDamage: 1884, speed: 1.1,  hands: 1, allowedClasses: ['Paladin','Barbarian','Druid'] },
  { id: '1h_dagger',   label: '1H Dagger',                  baseDamage: 1728, speed: 1.2,  hands: 1, allowedClasses: ['Rogue','Sorcerer','Warlock'] },
  { id: '1h_flail',    label: '1H Flail',                   baseDamage: 1728, speed: 1.0,  hands: 1, allowedClasses: ['Rogue'] },
  { id: '1h_wand',     label: 'Wand',                       baseDamage: 1728, speed: 1.2,  hands: 1, allowedClasses: ['Sorcerer','Necromancer','Warlock'] },
  // Off-hands
  { id: 'shield',      label: 'Shield (off-hand)',          baseDamage: 0,    speed: 0,    hands: 1, allowedClasses: ['Paladin','Barbarian','Necromancer'] },
  { id: 'focus',       label: 'Focus (off-hand)',           baseDamage: 0,    speed: 0,    hands: 1, allowedClasses: ['Sorcerer','Necromancer','Druid','Warlock','Paladin'] },
  // 2H melee
  { id: '2h_mace',     label: '2H Mace',                    baseDamage: 4607, speed: 0.9,  hands: 2, allowedClasses: ['Barbarian','Druid','Paladin'] },
  { id: '2h_axe',      label: '2H Axe',                     baseDamage: 4607, speed: 0.9,  hands: 2, allowedClasses: ['Barbarian','Druid'] },
  { id: '2h_sword',    label: '2H Sword',                   baseDamage: 4146, speed: 1.0,  hands: 2, allowedClasses: ['Barbarian','Necromancer','Paladin'] },
  { id: '2h_scythe',   label: '2H Scythe',                  baseDamage: 4607, speed: 0.9,  hands: 2, allowedClasses: ['Necromancer','Druid'] },
  { id: '2h_polearm',  label: '2H Polearm',                 baseDamage: 4607, speed: 0.9,  hands: 2, allowedClasses: ['Paladin','Spiritborn'] },
  { id: '2h_glaive',   label: '2H Glaive',                  baseDamage: 4146, speed: 1.0,  hands: 2, allowedClasses: ['Spiritborn'] },
  { id: '2h_qstaff',   label: '2H Quarterstaff',            baseDamage: 3768, speed: 1.0,  hands: 2, allowedClasses: ['Spiritborn','Sorcerer','Druid','Warlock'] },
  // 2H ranged
  { id: '2h_bow',      label: '2H Bow',                     baseDamage: 3768, speed: 1.0,  hands: 2, allowedClasses: ['Rogue'] },
  { id: '2h_xbow',     label: '2H Crossbow',                baseDamage: 4607, speed: 0.85, hands: 2, allowedClasses: ['Rogue'] },
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
  // Weapon slots: visibility per class is filtered in main.ts (Barb=4, Rogue=3, Spiritborn=1, others=2)
  { id: 'wep1',    name: 'Weapon 1 / Off-hand', weaponTypeId: 'none', affixes: [] },
  { id: 'wep2',    name: 'Weapon 2',            weaponTypeId: 'none', affixes: [] },
  { id: 'wep3',    name: 'Weapon 3 (Rogue/Barb)', weaponTypeId: 'none', affixes: [] },
  { id: 'wep4',    name: 'Weapon 4 (Barb)',     weaponTypeId: 'none', affixes: [] },
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

// Note: in-game order. (No imbuement: it's a Rogue-only line and users can add it via Extra Additive.)
export const DEFAULT_ADDITIVE_LINES: AdditiveLine[] = [
  { id: 'crit',         label: 'Critical Strike Damage', value: 0, applies: ifCrit, isCritOnly: true },
  { id: 'vulnerable',   label: 'Vulnerable Damage',      value: 0, applies: ifVuln },
  { id: 'all',          label: 'All Damage',             value: 0, applies: alwaysOn },
  { id: 'primaryElem',  label: 'Damage with [Element]',  value: 0, applies: alwaysOn },
  { id: 'ultimate',     label: 'Damage with Ultimate',   value: 0, applies: alwaysOn },
  { id: 'close',        label: 'Damage vs Close',        value: 0, applies: ifClose },
  { id: 'distant',      label: 'Damage vs Distant',      value: 0, applies: ifDistant },
  { id: 'elites',       label: 'Damage vs Elites',       value: 0, applies: ifElites },
  { id: 'cc',           label: 'Damage vs Crowd Controlled', value: 0, applies: ifCC },
  { id: 'healthy',      label: 'Damage vs Healthy',      value: 0, applies: ifHealthy },
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
  skillDamagePct: number;       // current in-game skill damage % (e.g., 4.03 for 403%)
  totalSkillRanks: number;      // user-entered total ranks; used for + Skill Ranks affix preview
  baseCritChance: number;
  attackSpeedBonus: number;
  weaponSpeedOverride: number | null;
  disableCrit: boolean;
  enemyDR: number;
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
  skillDamagePct: 0.45,        // 45% (rank-1 default; user typically overrides with their in-game value)
  totalSkillRanks: 5,
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
    const isWeaponSlot = slot.id.startsWith('wep');
    if (slot.weaponTypeId) {
      const wt = weaponTypeById(slot.weaponTypeId);
      if (wt.baseDamage > 0) { dmg += wt.baseDamage; hasAny = true; }
      if (wt.speed > 0) { speedSum += wt.speed; speedCount++; }
    }
    if (isWeaponSlot) {
      for (const a of slot.affixes) if (a.bucket === 'WEPDMG') dmg += a.value;
    }
  }
  // Barbarian dual-2H bonus (legacy spreadsheet behavior; only meaningful when Barb has both wep1+wep2 as 2H weapons)
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

  // Skill ranks: user enters totalSkillRanks directly; gear SKILLRANK affixes add on top.
  // Skill damage % is taken AS-IS from the in-game tooltip (already includes rank scaling).
  const totalSkillRanks = b.totalSkillRanks + sumAffixes(b.slots, 'SKILLRANK');
  // Each +1 skill rank ≈ +10% to skill damage % (rough heuristic for the "+5 Skill Ranks" affix preview).
  // We anchor at the user's current skillDamagePct + their current totalSkillRanks.
  const skillCoef = b.skillDamagePct * (1 + 0.10 * sumAffixes(b.slots, 'SKILLRANK'));

  const csdm = 1 + sumAffixes(b.slots, 'CSDM');
  const vdm  = 1 + sumAffixes(b.slots, 'VDM');
  const dotm = 1 + sumAffixes(b.slots, 'DOTM');
  // Per Avarilyn's sheet: weapon gems sum INTO the ALLM bucket, not ADDITIVE.
  const allm = 1 + sumAffixes(b.slots, 'ALLM') + sumAffixes(b.slots, 'NONPHYS') + sumAffixes(b.slots, 'GEM');

  const wd = computeWeaponDamage(b);
  const weaponSpeed = (b.weaponSpeedOverride && b.weaponSpeedOverride > 0) ? b.weaponSpeedOverride : wd.speed;
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
export function additiveForScenario(b: Build, conditions: ScenarioConditions): number {
  // Always-on/conditional applicable lines (excluding crit-only — handled separately)
  let add = 0;
  for (const l of b.additiveLines) {
    if (l.isCritOnly) continue;
    if (l.applies(conditions)) add += l.value;
  }
  add += b.extraAdditive.reduce((a, l) => a + l.value, 0);
  add += sumAffixes(b.slots, 'ADDITIVE');
  return add;
}

export function critOnlyAdditive(b: Build): number {
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

  // Vuln baseline 20% AND VDM bucket only apply when target is vulnerable
  const vdmFactor = scenario.conditions.vulnerable ? c.vdm * 1.2 : 1;

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

// "Weight" = a typical (normalized) affix roll on this bucket. Returns the % damage gain.
export function weightFor(b: Build, bucket: Bucket, typical: number, scenario: Scenario): number {
  return gainFromAddInScenario(b, bucket, typical, scenario);
}

// ---- Bucket display ----
export const BUCKET_META: Record<Bucket, { label: string; isPercent: boolean; typicalRoll: number }> = {
  CSDM:       { label: 'x% Critical Strike Damage Multiplier',  isPercent: true,  typicalRoll: 0.10 },
  VDM:        { label: 'x% Vulnerable Damage Multiplier',       isPercent: true,  typicalRoll: 0.10 },
  DOTM:       { label: 'x% Damage Over Time Multiplier',        isPercent: true,  typicalRoll: 0.10 },
  ALLM:       { label: 'x% All / Element Damage Multiplier',    isPercent: true,  typicalRoll: 0.10 },
  NONPHYS:    { label: 'x% Non-Physical Damage',                isPercent: true,  typicalRoll: 0.10 },
  ADDITIVE:   { label: '+% Damage (additive bucket)',           isPercent: true,  typicalRoll: 0.10 },
  CRITADD:    { label: '+% Critical Strike Damage',             isPercent: true,  typicalRoll: 0.10 },
  MAINSTAT:   { label: '+ Main Stat (Str/Dex/Int/Will)',        isPercent: false, typicalRoll: 200 },
  WEPDMG:     { label: '+ Weapon Damage Roll',                  isPercent: false, typicalRoll: 196 },
  GEM:        { label: 'Weapon Gem (sums into All / Element)',  isPercent: true,  typicalRoll: 0.10 },
  CRITCHANCE: { label: '+% Critical Strike Chance',             isPercent: true,  typicalRoll: 0.10 },
  SKILLRANK:  { label: '+ Skill Ranks',                         isPercent: false, typicalRoll: 5 },
  EXTRAMULT:  { label: 'x% Standalone Multiplier (aspect/unique)', isPercent: true, typicalRoll: 0.10 },
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
    { id: 'dot',       label: 'DoT tick',                   conditions: {}, isDot: true },
  ];
}
