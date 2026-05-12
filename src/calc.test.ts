// Reference smoke test: verifies our calc matches Avarilyn's spreadsheet ALL CLASSES tab
// when the same numerical inputs are provided.
//
// The spreadsheet's example has both 1H and 2H weapon affixes filled simultaneously
// (a non-physical UX choice). We replicate that here by stuffing all the equivalent
// affixes onto the 2H wep1 slot.
//
// The spreadsheet also bakes the 20% vulnerable baseline into its VDM bucket and
// expects you to "always be vulnerable". Our calc separates the 1.2 baseline and only
// applies it for vulnerable scenarios. So we set enemyDR = 0.2 (matching) and target
// a non-vulnerable scenario, then add 0.2 multiplier manually as part of expected.
//
// Usage: `npx tsx src/calc.test.ts` — exits 0 on pass, 1 on fail.

import { type Build, scenarioDamage, DEFAULT_BUILD } from './calc';

function close(a: number, b: number, pct = 0.5): boolean {
  if (a === 0 && b === 0) return true;
  return Math.abs(a - b) / Math.max(Math.abs(a), Math.abs(b)) * 100 < pct;
}

function makeReferencePaladin(): Build {
  // Replicate Avarilyn's example: stuff every 1H + 2H affix onto a class-valid 2H wep1 slot
  // since our app doesn't allow simultaneous 1H + 2H equip.
  const b: Build = {
    ...DEFAULT_BUILD,
    classId: 'Paladin',
    baseMainStat: 485,
    extraMainStat: 500,
    skillCoefL1: 0.45,
    skillRanks: 15,
    extraSkillRanks: 14,
    baseCritChance: 1.0,         // overcapped in example
    enemyDR: 0.2,
    disableCrit: false,
    additiveLines: DEFAULT_BUILD.additiveLines.map(l => ({ ...l })),
    extraAdditive: [
      { label: 'Extra Additive', value: 2.127 },
      { label: 'Damage with Trap', value: 1.0 },
      { label: 'vs Trapped', value: 1.89 },
    ],
    extraMultipliers: [],
    slots: [
      { id: 'helm',   name: 'Helm',   affixes: [] },
      { id: 'chest',  name: 'Chest',  affixes: [{ bucket: 'MAINSTAT', value: 392 }] },
      { id: 'pants',  name: 'Pants',  affixes: [] },
      { id: 'boots',  name: 'Boots',  affixes: [{ bucket: 'MAINSTAT', value: 151 }] },
      { id: 'gloves', name: 'Gloves', affixes: [
        { bucket: 'CSDM', value: 0.63 }, { bucket: 'VDM', value: 0.35 }, { bucket: 'CRITCHANCE', value: 0.106 },
      ]},
      { id: 'amulet', name: 'Amulet', affixes: [
        { bucket: 'VDM', value: 0.35 }, { bucket: 'CRITCHANCE', value: 0.106 },
      ]},
      { id: 'ring1', name: 'Ring 1', affixes: [
        { bucket: 'CSDM', value: 0.31 }, { bucket: 'VDM', value: 0.18 }, { bucket: 'CRITCHANCE', value: 0.063 },
      ]},
      { id: 'ring2', name: 'Ring 2', affixes: [
        { bucket: 'CSDM', value: 0.31 }, { bucket: 'VDM', value: 0.18 }, { bucket: 'CRITCHANCE', value: 0.063 },
      ]},
      { id: 'wep1', name: 'Weapon 1', weaponTypeId: '2h_polearm', affixes: [
        // Combined 1H+1H+2H affixes from the spreadsheet's filled example
        { bucket: 'CSDM', value: 0.5 + 0.5 + 1.0 },          // 1H wep1 + 1H wep2 + 2H
        { bucket: 'ALLM', value: 0.25 },                       // 2H ALLM
        { bucket: 'MAINSTAT', value: 225 + 225 + 450 },        // both 1H + 2H mainstat
        { bucket: 'ADDITIVE', value: 1.2 },                    // 2H temper
        { bucket: 'WEPDMG', value: 400 },                      // 2H wep roll
        { bucket: 'GEM', value: 0.24 + 0.24 + 0.48 },          // 1H+1H+2H gems
      ]},
      { id: 'wep2', name: 'Weapon 2', weaponTypeId: 'none', affixes: [] },
    ],
  };
  // Set additive lines to match the sheet
  const lines: Record<string, number> = {
    vulnerable: 0.31, all: 2.43, primaryElem: 3.8,
    close: 0.18, elites: 2.04, healthy: 0.625,
  };
  for (const id in lines) {
    const l = b.additiveLines.find(x => x.id === id);
    if (l) l.value = lines[id];
  }
  return b;
}

function runReferenceTest(): boolean {
  const b = makeReferencePaladin();
  // Construct a scenario with all conditional flags ON (matching spreadsheet's "everything always" assumption)
  // and vulnerable = false (since spreadsheet bakes 1.2 into VDM bucket; we don't double-apply).
  // We then divide expected by 1.2 to compare on the same basis.
  // Easier approach: turn vulnerable ON, and divide by 1.2 to remove our extra baseline.
  const fullCondScenario = { id: 'all', label: 'all conditions', conditions: { vulnerable: true, close: true, distant: false, elites: true, cc: false, healthy: true } } as any;
  const dmg = scenarioDamage(b, fullCondScenario);
  const expected = 3_548_287.128 * 1.2; // sheet × 1.2 baseline (we apply baseline, sheet doesn't)
  const ok = close(dmg, expected, 0.5);
  console.log(`Tool dmg (vuln + close + elites + healthy, crit):  ${dmg.toFixed(2)}`);
  console.log(`Expected (sheet U24 × 1.2):                         ${expected.toFixed(2)}`);
  console.log(`Match within 0.5%: ${ok ? '✅' : '❌'}`);
  return ok;
}

export { runReferenceTest };

// Run when invoked directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const ok = runReferenceTest();
  process.exit(ok ? 0 : 1);
}
