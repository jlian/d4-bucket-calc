import './style.css';
import 'katex/dist/katex.min.css';
import katex from 'katex';
import {
  calc, classFor, CLASSES, BUCKET_META, BUCKET_ORDER,
  weightFor, scenarioDamage, scenarioDamageNoCrit, presetScenarios,
  additiveForScenario, critOnlyAdditive,
  WEAPON_TYPES,
  type Build, type Bucket, type Slot,
} from './calc';
import { loadInitialBuild, persist, exportJson, importJson, cloneBuild } from './state';

let build: Build = loadInitialBuild();

const fmtPct = (n: number, digits = 2) => (n * 100).toFixed(digits) + '%';
const fmtNum = (n: number, digits = 0) => n.toLocaleString('en-US', { maximumFractionDigits: digits });
const fmtBigNum = (n: number) => {
  if (!isFinite(n) || n === 0) return '—';
  if (n >= 1e9) return (n / 1e9).toFixed(2) + 'B';
  if (n >= 1e6) return (n / 1e6).toFixed(2) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(2) + 'K';
  return fmtNum(n, 0);
};
const stripTrailingZero = (s: string) => s.includes('.') ? s.replace(/\.?0+$/, '') : s;

function el<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Record<string, any> = {}, ...children: (Node | string)[]): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  for (const k in attrs) {
    if (k === 'class') e.className = attrs[k];
    else if (k.startsWith('on') && typeof attrs[k] === 'function') (e as any)[k.toLowerCase()] = attrs[k];
    else if (attrs[k] !== undefined && attrs[k] !== null) e.setAttribute(k, String(attrs[k]));
  }
  for (const c of children) if (c != null) e.append(c as any);
  return e;
}

function inputCls() { return 'bg-zinc-900 border border-zinc-800 rounded px-2 py-1 text-sm text-zinc-200 focus:outline-none focus:border-amber-600'; }
function sectionCard(title: string, subtitle?: string) {
  const card = el('section', { class: 'bg-zinc-900/50 border border-zinc-800 rounded-lg p-4' });
  card.append(el('h2', { class: 'text-sm font-semibold text-zinc-300 uppercase tracking-wide mb-1' }, title));
  if (subtitle) card.append(el('p', { class: 'text-xs text-zinc-500 mb-3' }, subtitle));
  else card.append(el('div', { class: 'mb-3' }));
  return card;
}

function pctInput(getValue: () => number, setValue: (v: number) => void, opts: { step?: number; w?: string } = {}) {
  const inp = el('input', { type: 'number', step: opts.step ?? 1, class: inputCls() + ' ' + (opts.w ?? 'w-20') + ' text-right' }) as HTMLInputElement;
  inp.value = stripTrailingZero((getValue() * 100).toFixed(2));
  inp.addEventListener('input', () => {
    const raw = parseFloat(inp.value);
    setValue(isNaN(raw) ? 0 : raw / 100);
    afterInput();
  });
  return inp;
}

function numInput(getValue: () => number, setValue: (v: number) => void, opts: { step?: number; w?: string } = {}) {
  const inp = el('input', { type: 'number', step: opts.step ?? 1, class: inputCls() + ' ' + (opts.w ?? 'w-20') + ' text-right' }) as HTMLInputElement;
  inp.value = String(getValue());
  inp.addEventListener('input', () => {
    const raw = parseFloat(inp.value);
    setValue(isNaN(raw) ? 0 : raw);
    afterInput();
  });
  return inp;
}

function textInput(getValue: () => string, setValue: (v: string) => void, opts: { w?: string; placeholder?: string } = {}) {
  const inp = el('input', { type: 'text', class: inputCls() + ' ' + (opts.w ?? 'flex-1'), placeholder: opts.placeholder ?? '' }) as HTMLInputElement;
  inp.value = getValue();
  inp.addEventListener('input', () => { setValue(inp.value); afterInput(); });
  return inp;
}

function field(label: string, control: HTMLElement) {
  const wrap = el('label', { class: 'block' });
  wrap.append(el('div', { class: 'text-xs text-zinc-500 mb-1' }, label));
  control.classList.add('w-full');
  wrap.append(control);
  return wrap;
}

function afterInput() {
  persist(build);
  refreshOutputs();
}

function mount() {
  const root = document.getElementById('app')!;
  root.innerHTML = '';
  root.append(renderHeader());
  const main = el('main', { class: 'max-w-6xl mx-auto p-4 grid lg:grid-cols-[1fr_minmax(320px,400px)] gap-6' });
  root.append(main);

  const left = el('div', { class: 'space-y-6' });
  left.append(classSkillCard());
  left.append(nakedBaselineCard());
  left.append(extraAdditiveCard()); // moved above gear
  left.append(slotsCard());
  left.append(extraMultsCard());
  main.append(left);

  const right = el('div', { id: 'outputs', class: 'space-y-6 lg:sticky lg:top-20 lg:self-start' });
  main.append(right);
  refreshOutputs();
  persist(build);

  // Footer
  const footer = el('footer', { class: 'max-w-6xl mx-auto p-4 mt-8 border-t border-zinc-900' });
  footer.append(formulaCard());
  root.append(footer);
}

function refreshOutputs() {
  const right = document.getElementById('outputs');
  if (!right) return;
  right.innerHTML = '';
  right.append(scenariosCard());
  right.append(dpsCard());
  right.append(bucketsCard());
  right.append(statsCard());
}

// ---------- Header ----------
function renderHeader() {
  return el('header', { class: 'border-b border-zinc-800 px-4 py-3 sticky top-0 bg-zinc-950/95 backdrop-blur z-10' },
    el('div', { class: 'max-w-6xl mx-auto flex flex-wrap items-center gap-3 justify-between' },
      el('div', { class: 'flex items-center gap-3' },
        el('span', { class: 'text-2xl' }, '⚔️'),
        el('div', {},
          el('h1', { class: 'text-lg font-bold leading-tight' }, 'D4 Damage Calc'),
          el('div', { class: 'text-[10px] text-zinc-500 leading-tight' },
            'Calculator design + math by ',
            Object.assign(el('a', { href: 'https://www.youtube.com/@avarilyn', target: '_blank', class: 'text-amber-400 hover:underline' }), { textContent: 'Avarilyn' }),
            ' · web port by ',
            Object.assign(el('a', { href: 'https://github.com/jlian', target: '_blank', class: 'text-amber-400 hover:underline' }), { textContent: 'jlian' }),
          ),
        ),
      ),
      el('div', { class: 'flex items-center gap-2 flex-wrap' },
        snapshotBtn(), importBtn(), exportBtn(), copyShareBtn(), resetBtn(),
      ),
    ),
  );
}

// ---------- Card 1: Class & Skill ----------
function classSkillCard() {
  const cls = classFor(build);
  const card = sectionCard('Class & Skill');
  const grid = el('div', { class: 'grid grid-cols-2 gap-3' });

  const classSel = el('select', { class: inputCls() + ' w-full' }) as HTMLSelectElement;
  for (const c of CLASSES) {
    const opt = el('option', { value: c.id }, `${c.id} (${c.mainStat})`);
    if (c.id === build.classId) opt.setAttribute('selected', '');
    classSel.append(opt);
  }
  classSel.addEventListener('change', () => {
    build.classId = classSel.value as any;
    // Reconcile any equipped weapons whose allowedClasses no longer include this class
    for (const slot of build.slots) {
      if (!slot.weaponTypeId || slot.weaponTypeId === 'none') continue;
      const wt = WEAPON_TYPES.find(w => w.id === slot.weaponTypeId);
      if (wt?.allowedClasses && !wt.allowedClasses.includes(build.classId)) {
        slot.weaponTypeId = 'none';
      }
    }
    persist(build);
    mount();
  });
  grid.append(field('Class', classSel));

  grid.append(field('Skill name', textInput(() => build.skillName, v => build.skillName = v, { w: 'w-full', placeholder: 'e.g. Holy Bolt' })));
  grid.append(field('Skill Coef % (rank 1, e.g. 45)', pctInput(() => build.skillCoefL1, v => build.skillCoefL1 = v, { step: 0.5, w: 'w-full' })));
  grid.append(field('Base Skill Ranks (1-baseline + bonuses)', numInput(() => build.skillRanks, v => build.skillRanks = v, { w: 'w-full' })));
  grid.append(field('Extra Skill Ranks (charms / non-gear)', numInput(() => build.extraSkillRanks, v => build.extraSkillRanks = v, { w: 'w-full' })));
  grid.append(field(`Base ${cls.mainStat} (no gear)`, numInput(() => build.baseMainStat, v => build.baseMainStat = v, { w: 'w-full' })));
  grid.append(field(`Extra ${cls.mainStat} (charms)`, numInput(() => build.extraMainStat, v => build.extraMainStat = v, { w: 'w-full' })));

  const checkWrap = el('label', { class: 'flex items-center gap-2 col-span-2 text-sm cursor-pointer mt-1' });
  const cb = el('input', { type: 'checkbox', class: 'accent-amber-500' }) as HTMLInputElement;
  cb.checked = build.disableCrit;
  cb.addEventListener('change', () => { build.disableCrit = cb.checked; afterInput(); });
  checkWrap.append(cb, document.createTextNode('DoT build (disable crit)'));
  grid.append(checkWrap);

  card.append(grid);
  return card;
}

// ---------- Card 2: Naked Baseline ----------
function nakedBaselineCard() {
  const card = sectionCard('Naked Baseline (Strip Your Gear)',
    'Open Character Sheet → Offensive tab. Hover each line and use the BOTTOM number ("from items and Paragon"). Order matches in-game.');

  const critRow = el('div', { class: 'mb-3 flex items-center gap-2' });
  critRow.append(el('div', { class: 'flex-1 text-xs text-zinc-400' }, 'Critical Strike Chance'));
  critRow.append(pctInput(() => build.baseCritChance, v => build.baseCritChance = v, { w: 'w-24', step: 0.5 }));
  critRow.append(el('span', { class: 'text-zinc-600 text-xs' }, '%'));
  card.append(critRow);

  // All additive lines, in-game order, no split
  const grid = el('div', { class: 'grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2' });
  for (const line of build.additiveLines) {
    const row = el('div', { class: 'flex items-center gap-2' });
    row.append(el('div', { class: 'flex-1 text-xs text-zinc-400' }, line.label));
    row.append(pctInput(() => line.value, v => line.value = v, { w: 'w-24' }));
    row.append(el('span', { class: 'text-zinc-600 text-xs' }, '%'));
    grid.append(row);
  }
  card.append(grid);
  return card;
}

// ---------- Card 3: Gear Slots ----------
function slotsCard() {
  const card = sectionCard('Gear Slots',
    'Add affixes per piece. For weapon slots, pick the weapon type to auto-fill base damage and weapon speed.');
  const cls = classFor(build);
  const weaponSlotCount = cls.weaponSlots;
  for (const slot of build.slots) {
    // Hide weapon slots beyond what this class can use
    const wepIdx = slot.id.startsWith('wep') ? parseInt(slot.id.slice(3), 10) : 0;
    if (wepIdx > 0 && wepIdx > weaponSlotCount) continue;
    card.append(slotBlock(slot));
  }
  return card;
}

function slotBlock(slot: Slot) {
  const isWeapon = slot.id.startsWith('wep');
  const wrap = el('div', { class: 'border border-zinc-800 rounded-lg p-3 mb-2' });

  const header = el('div', { class: 'flex items-center gap-3 mb-2 flex-wrap' });
  header.append(el('h3', { class: 'font-semibold text-zinc-200 mr-auto' }, slot.name));

  if (isWeapon) {
    const sel = el('select', { class: inputCls() + ' text-xs' }) as HTMLSelectElement;
    for (const wt of WEAPON_TYPES) {
      // Filter to weapons usable by this class (or always show 'none')
      if (wt.allowedClasses && !wt.allowedClasses.includes(build.classId)) continue;
      const opt = el('option', { value: wt.id }, wt.label + (wt.baseDamage ? ` — ${wt.baseDamage}×${wt.speed.toFixed(2)}/s` : ''));
      if (wt.id === (slot.weaponTypeId ?? 'none')) opt.setAttribute('selected', '');
      sel.append(opt);
    }
    sel.addEventListener('change', () => { slot.weaponTypeId = sel.value; afterInput(); });
    header.append(sel);
  }

  const addBtn = el('button', { class: 'text-xs text-amber-400 hover:text-amber-300 px-2 py-1 rounded border border-amber-700/50' }, '+ Add Affix');
  addBtn.addEventListener('click', () => { slot.affixes.push({ bucket: 'CSDM', value: 0 }); mount(); });
  header.append(addBtn);
  wrap.append(header);

  if (slot.affixes.length === 0) wrap.append(el('p', { class: 'text-xs text-zinc-600 italic' }, 'No affixes.'));

  slot.affixes.forEach((a, idx) => {
    const row = el('div', { class: 'flex flex-wrap sm:flex-nowrap gap-2 mb-1.5 items-center min-w-0' });
    const sel = el('select', { class: inputCls() + ' w-full sm:flex-1 min-w-0' }) as HTMLSelectElement;
    for (const b of BUCKET_ORDER) {
      if (!isWeapon && (b === 'WEPDMG' || b === 'GEM')) continue;
      const opt = el('option', { value: b }, BUCKET_META[b].label);
      if (b === a.bucket) opt.setAttribute('selected', '');
      sel.append(opt);
    }
    sel.addEventListener('change', () => { a.bucket = sel.value as Bucket; mount(); });
    row.append(sel);

    const isPct = BUCKET_META[a.bucket].isPercent;
    if (isPct) {
      row.append(pctInput(() => a.value, v => a.value = v, { w: 'w-24' }));
      row.append(el('span', { class: 'text-zinc-600 text-xs' }, '%'));
    } else {
      row.append(numInput(() => a.value, v => a.value = v, { w: 'w-28' }));
    }

    const del = el('button', { class: 'text-zinc-500 hover:text-red-400 px-2' }, '✕');
    del.addEventListener('click', () => { slot.affixes.splice(idx, 1); mount(); });
    row.append(del);
    wrap.append(row);
  });
  return wrap;
}

// ---------- Extra Additive (free-form) ----------
function extraAdditiveCard() {
  const card = sectionCard('Extra Additive Damage',
    'Free-form list for any "+%" damage that isn\'t in the standard list (e.g., skill-tag bonuses from aspects).');
  build.extraAdditive.forEach((m, idx) => {
    const row = el('div', { class: 'flex gap-2 mb-2 items-center' });
    row.append(textInput(() => m.label, v => m.label = v, { w: 'flex-1', placeholder: 'Name' }));
    row.append(pctInput(() => m.value, v => m.value = v, { w: 'w-24' }));
    row.append(el('span', { class: 'text-zinc-600 text-xs' }, '%'));
    const del = el('button', { class: 'text-zinc-500 hover:text-red-400 px-2' }, '✕');
    del.addEventListener('click', () => { build.extraAdditive.splice(idx, 1); mount(); });
    row.append(del);
    card.append(row);
  });
  const addBtn = el('button', { class: 'text-xs text-amber-400 hover:text-amber-300 px-2 py-1 rounded border border-amber-700/50 mt-1' }, '+ Add Entry');
  addBtn.addEventListener('click', () => { build.extraAdditive.push({ label: '', value: 0 }); mount(); });
  card.append(addBtn);
  return card;
}

// ---------- Standalone multipliers ----------
function extraMultsCard() {
  const card = sectionCard('Standalone [x] Multipliers',
    'Aspects/uniques like Grandfather. Each one its own factor.');
  build.extraMultipliers.forEach((m, idx) => {
    const row = el('div', { class: 'flex gap-2 mb-2 items-center' });
    row.append(textInput(() => m.label, v => m.label = v, { w: 'flex-1', placeholder: 'Name' }));
    row.append(pctInput(() => m.value, v => m.value = v, { w: 'w-24' }));
    row.append(el('span', { class: 'text-zinc-600 text-xs' }, '%'));
    const del = el('button', { class: 'text-zinc-500 hover:text-red-400 px-2' }, '✕');
    del.addEventListener('click', () => { build.extraMultipliers.splice(idx, 1); mount(); });
    row.append(del);
    card.append(row);
  });
  const addBtn = el('button', { class: 'text-xs text-amber-400 hover:text-amber-300 px-2 py-1 rounded border border-amber-700/50 mt-1' }, '+ Add Multiplier');
  addBtn.addEventListener('click', () => { build.extraMultipliers.push({ label: '', value: 0 }); mount(); });
  card.append(addBtn);
  return card;
}

// ---------- OUTPUT: Scenarios ----------
function scenariosCard() {
  const card = sectionCard('Damage by Scenario');
  const c = calc(build);
  if (c.weaponDmg === 0) {
    card.append(el('p', { class: 'text-xs text-amber-400' }, '⚠️ Pick a weapon type in your weapon slot to enable damage output.'));
    return card;
  }

  const scenarios = presetScenarios();
  // For DoT builds, hide non-DoT non-condition rows
  const filtered = build.disableCrit
    ? scenarios.filter(s => s.isDot || Object.keys(s.conditions).length > 0 || s.id === 'plain')
    : scenarios;

  const tbl = el('table', { class: 'w-full text-sm' });
  tbl.append(el('thead', {}, el('tr', { class: 'text-xs text-zinc-500 border-b border-zinc-800' },
    el('th', { class: 'text-left py-1 font-normal' }, 'Scenario'),
    el('th', { class: 'text-right py-1 font-normal' }, 'Avg dmg'),
  )));
  const tb = el('tbody');

  // Always include "Plain (no crit)" first as a reference
  if (!build.disableCrit) {
    const plainNoCrit = scenarioDamageNoCrit(build, scenarios.find(s => s.id === 'plain')!);
    tb.append(el('tr', { class: 'border-b border-zinc-900' },
      el('td', { class: 'py-1 text-zinc-400' }, 'Plain (no crit, ref)'),
      el('td', { class: 'py-1 text-right tabular-nums text-zinc-400 font-mono' }, fmtBigNum(plainNoCrit)),
    ));
  }
  for (const s of filtered) {
    const dmg = scenarioDamage(build, s);
    tb.append(el('tr', { class: 'border-b border-zinc-900' },
      el('td', { class: 'py-1' }, s.label),
      el('td', { class: 'py-1 text-right tabular-nums text-amber-400 font-mono' }, fmtBigNum(dmg)),
    ));
  }
  tbl.append(tb);
  card.append(tbl);

  if (build.snapshot) {
    const refScenario = filtered[0];
    const cur = scenarioDamage(build, refScenario);
    const snapBuild = build.snapshot as Build;
    const snap = scenarioDamage({ ...snapBuild, snapshot: null } as Build, refScenario);
    if (snap > 0) {
      const delta = cur / snap - 1;
      const sign = delta >= 0 ? '+' : '';
      const cls = delta > 0 ? 'text-emerald-400' : delta < 0 ? 'text-red-400' : 'text-zinc-500';
      card.append(el('div', { class: 'mt-3 pt-2 border-t border-zinc-800 flex items-center justify-between text-xs' },
        el('span', { class: 'text-zinc-500' }, `📌 "${refScenario.label}" vs snapshot:`),
        el('span', { class: cls + ' font-bold tabular-nums' }, sign + fmtPct(delta, 2)),
      ));
    }
  }
  return card;
}

// ---------- OUTPUT: DPS ----------
function dpsCard() {
  const card = sectionCard('Attacks per Second (informational)',
    'Approximate sustained ApS = base weapon ApS × (1 + AS%). Real DPS depends on per-skill animation breakpoints — most skills only gain DPS at specific AS thresholds.');

  const c = calc(build);
  const wsRow = el('div', { class: 'mb-2 flex items-center gap-2' });
  wsRow.append(el('div', { class: 'flex-1 text-xs text-zinc-400' }, 'Weapon ApS (auto)'));
  const ws = el('span', { class: 'text-xs text-zinc-300 font-mono' }, c.weaponSpeed > 0 ? c.weaponSpeed.toFixed(2) + ' /s' : '— pick weapon');
  wsRow.append(ws);
  card.append(wsRow);

  const asRow = el('div', { class: 'mb-2 flex items-center gap-2' });
  asRow.append(el('div', { class: 'flex-1 text-xs text-zinc-400' }, 'Attack Speed Bonus (Offensive tab)'));
  asRow.append(pctInput(() => build.attackSpeedBonus, v => build.attackSpeedBonus = v, { w: 'w-24', step: 1 }));
  asRow.append(el('span', { class: 'text-zinc-600 text-xs' }, '%'));
  card.append(asRow);

  if (c.weaponDmg > 0 && c.effectiveAttackRate > 0) {
    card.append(el('div', { class: 'mt-3 flex items-baseline justify-between' },
      el('span', { class: 'text-zinc-400 text-sm' }, 'Effective ApS'),
      el('span', { class: 'text-xl font-bold text-amber-400' }, c.effectiveAttackRate.toFixed(2) + ' /s'),
    ));
  }
  card.append(el('p', { class: 'text-xs text-zinc-600 mt-3 italic' },
    'Skills round to game frames. AS% only helps when it crosses a breakpoint. See Maxroll’s ',
    Object.assign(el('a', { href: 'https://maxroll.gg/d4/resources/attack-speed-mechanics', target: '_blank', class: 'text-amber-400 hover:underline' }), { textContent: 'Attack Speed Mechanics' }),
    ' guide for per-skill breakpoint tables. AS% caps at 200% (2 × 100% caps).',
  ));
  return card;
}

// ---------- OUTPUT: Buckets ----------
function bucketsCard() {
  const card = sectionCard('Where to Spend Your Next Slot');
  card.append(el('p', { class: 'text-xs text-zinc-400 mb-2' },
    'Each row is a hypothetical affix you could add to your build. The right column shows what % more damage that single affix would give you. Top of the list = best leverage right now.',
  ));

  const c = calc(build);
  if (c.weaponDmg === 0) {
    card.append(el('p', { class: 'text-xs text-amber-400' }, '⚠️ Pick a weapon type to compute weights.'));
    return card;
  }
  const refScenario = build.disableCrit
    ? presetScenarios().find(s => s.id === 'dot')!
    : presetScenarios().find(s => s.id === 'vuln_elite')!;

  const cls = classFor(build);
  // Each row is an actual affix, normalized so they're comparable
  type Row = { affix: string; bucket?: string; gain: number };
  const rows: Row[] = [
    { affix: 'x10% Critical Strike Damage Multiplier', bucket: 'on crits', gain: weightFor(build, 'CSDM', 0.10, refScenario) },
    { affix: 'x10% Vulnerable Damage Multiplier',      bucket: 'vs vulnerable', gain: weightFor(build, 'VDM', 0.10, refScenario) },
    { affix: 'x10% Damage Over Time Multiplier',       bucket: 'on DoT only', gain: weightFor(build, 'DOTM', 0.10, refScenario) },
    { affix: 'x10% All / Element Damage Multiplier',   bucket: 'always-on', gain: weightFor(build, 'ALLM', 0.10, refScenario) },
    { affix: '+10% Critical Strike Damage',            bucket: 'on crits', gain: weightFor(build, 'CRITADD', 0.10, refScenario) },
    { affix: '+10% Damage (additive bucket)',          bucket: 'always-on', gain: weightFor(build, 'ADDITIVE', 0.10, refScenario) },
    { affix: `+200 ${cls.mainStat}`,                   bucket: 'main stat', gain: weightFor(build, 'MAINSTAT', 200, refScenario) },
    { affix: '+10% Critical Strike Chance',            bucket: c.critChance >= 1 ? 'CAPPED at 100%' : 'crit roll rate', gain: weightFor(build, 'CRITCHANCE', 0.10, refScenario) },
    { affix: '+196 Weapon Damage Roll',                bucket: 'multiplies all', gain: weightFor(build, 'WEPDMG', 196, refScenario) },
    { affix: '+5 Skill Ranks',                         bucket: 'skill coef', gain: weightFor(build, 'SKILLRANK', 5, refScenario) },
  ];
  rows.sort((a, b) => b.gain - a.gain);

  card.append(el('p', { class: 'text-xs text-zinc-600 italic mb-2' },
    `Calculated against scenario: “${refScenario.label}” (toggle DoT/crit on the left to flip).`,
  ));

  const table = el('table', { class: 'w-full text-sm' });
  table.append(el('thead', {}, el('tr', { class: 'text-xs text-zinc-500 border-b border-zinc-800' },
    el('th', { class: 'text-left py-1 font-normal' }, 'Hypothetical affix'),
    el('th', { class: 'text-right py-1 font-normal pl-2' }, '% more dmg'),
  )));
  const tb = el('tbody');
  for (const r of rows) {
    const isHot = r.gain > 0.05, isCold = r.gain < 0.005;
    const gainCls = isHot ? 'text-emerald-400 font-semibold' : isCold ? 'text-zinc-600' : 'text-amber-400';
    const tr = el('tr', { class: 'border-b border-zinc-900 align-top' });
    tr.append(
      el('td', { class: 'py-1.5 min-w-0' },
        el('div', { class: 'text-zinc-200' }, r.affix),
        r.bucket ? el('div', { class: 'text-xs text-zinc-600' }, r.bucket) : '',
      ),
      el('td', { class: 'py-1.5 text-right tabular-nums pl-2 align-top whitespace-nowrap ' + gainCls }, fmtPct(r.gain)),
    );
    tb.append(tr);
  }
  table.append(tb);
  card.append(table);

  // Show current bucket sums for reference
  card.append(el('details', { class: 'mt-3 text-xs text-zinc-500' },
    el('summary', { class: 'cursor-pointer text-zinc-400' }, 'Your current bucket values'),
    el('div', { class: 'mt-2 grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-0.5 text-zinc-400' },
      el('div', {}, `Critical Strike Damage Mult: x${((c.csdm-1)*100).toFixed(0)}% (×${c.csdm.toFixed(2)})`),
      el('div', {}, `Vulnerable Damage Mult: x${((c.vdm-1)*100).toFixed(0)}% (×${c.vdm.toFixed(2)})`),
      el('div', {}, `Damage Over Time Mult: x${((c.dotm-1)*100).toFixed(0)}% (×${c.dotm.toFixed(2)})`),
      el('div', {}, `All / Element Damage Mult: x${((c.allm-1)*100).toFixed(0)}% (×${c.allm.toFixed(2)})`),
      el('div', {}, `Main stat mult: ×${c.mainStatMult.toFixed(3)} (${c.mainStatSum} ${cls.mainStat})`),
      el('div', {}, `Crit chance: ${fmtPct(c.critChance, 1)}`),
      el('div', {}, `Weapon damage: ${fmtNum(c.weaponDmg)}`),
      el('div', {}, `Skill ranks: ${c.totalSkillRanks} (×${c.skillCoef.toFixed(3)} coef)`),
    ),
  ));

  card.append(el('details', { class: 'mt-3 text-xs text-zinc-500' },
    el('summary', { class: 'cursor-pointer text-zinc-400' }, 'How to read this'),
    el('div', { class: 'mt-2 space-y-2 text-zinc-400' },
      el('p', {},
        'Same-named affixes ', el('strong', {}, 'sum into one bucket'), ', then the bucket multiplies into the damage formula. Adding to a small bucket gives a bigger damage gain than adding the same amount to a big one.',
      ),
      el('p', {},
        el('strong', {}, 'Worked example: '),
        'Say your Crit Damage Mult bucket has +150% from gear → multiplier = ', el('code', { class: 'text-amber-400 bg-zinc-950 px-1 rounded' }, '1 + 1.50 = ×2.50'), '. ',
        'Adding a +10% affix takes the sum to +160%, multiplier becomes ×2.60. ',
        'Damage gain on crits = ', el('code', { class: 'text-amber-400 bg-zinc-950 px-1 rounded' }, '2.60 / 2.50 = +4%'), '.',
      ),
      el('p', {},
        'If your Vulnerable bucket only has +20% (×1.20) and you add the same +10% affix, the bucket goes to ×1.30. ',
        'Damage gain on vulnerable = ', el('code', { class: 'text-amber-400 bg-zinc-950 px-1 rounded' }, '1.30 / 1.20 = +8.3%'), ', ',
        el('strong', {}, 'twice as good '), 'because the bucket was smaller.',
      ),
      el('p', {},
        el('strong', {}, '+ vs x prefix: '),
        'Critical Strike Damage comes in two flavors. ',
        el('code', { class: 'text-amber-400 bg-zinc-950 px-1 rounded' }, '+75% Critical Strike Damage'),
        ' joins the giant additive damage bucket. ',
        el('code', { class: 'text-amber-400 bg-zinc-950 px-1 rounded' }, 'x56% Critical Strike Damage Multiplier'),
        ' joins its own much smaller bucket. The x version is almost always 3-5× more valuable in late game.',
      ),
    ),
  ));

  return card;
}

function statsCard() {
  const c = calc(build);
  const card = sectionCard('Internal Stats');
  const stats: [string, string][] = [
    ['Weapon Damage', c.weaponDmg ? fmtNum(c.weaponDmg) : '— pick weapon'],
    ['Weapon Speed', c.weaponSpeed ? c.weaponSpeed.toFixed(2) + '/s' : '—'],
    ['Effective Rate', c.effectiveAttackRate ? c.effectiveAttackRate.toFixed(2) + '/s' : '—'],
    ['Main Stat Sum', fmtNum(c.mainStatSum)],
    ['Main Stat Mult', `×${c.mainStatMult.toFixed(3)}`],
    ['Crit Chance', fmtPct(c.critChance)],
    ['Skill Coef (eff.)', fmtPct(c.skillCoef)],
    ['CSDM bucket (Crit Strike Damage ×)', `×${c.csdm.toFixed(3)}`],
    ['VDM bucket (Vulnerable Damage ×)',  `×${c.vdm.toFixed(3)}`],
    ['DOTM bucket (Damage over Time ×)',  `×${c.dotm.toFixed(3)}`],
    ['All/Element Damage bucket',          `×${c.allm.toFixed(3)}`],
    ['Extra Mults', `×${c.extraMultProduct.toFixed(3)}`],
    ['Enemy DR', fmtPct(1 - build.enemyDR) + ' (fixed)'],
  ];
  const tbl = el('table', { class: 'w-full text-xs' });
  for (const [l, v] of stats) {
    tbl.append(el('tr', {},
      el('td', { class: 'py-0.5 text-zinc-500' }, l),
      el('td', { class: 'py-0.5 text-right tabular-nums text-zinc-300' }, v),
    ));
  }
  card.append(tbl);
  return card;
}

// ---------- Footer: formula card (KaTeX rendered) ----------
function formulaCard() {
  const card = el('section', { class: 'bg-zinc-900/30 border border-zinc-800 rounded-lg p-6 text-sm text-zinc-300' });
  card.append(el('h2', { class: 'text-base font-bold text-amber-400 mb-3' }, 'How the formula works'));
  card.append(el('p', { class: 'mb-4' },
    'D4 damage is a single product of factors. Each factor (a "bucket") is either a sum of additive % values or a single multiplier. The marginal value of an affix is approximately ',
    katexInline('\\Delta / B'), ', where ', katexInline('B'), ' is the bucket\'s current value — smaller buckets give bigger gains.',
  ));

  // Main formula
  const divisor = classFor(build).divisor;
  const formula = String.raw`D = W \cdot (1 + A) \cdot \left(1 + \frac{S}{${divisor}}\right) \cdot C \cdot \prod_{i} M_i \cdot (\text{CSDM} \cdot 1.5)^{c} \cdot (\text{VDM} \cdot 1.2)^{v} \cdot \text{DOTM}^{d} \cdot (1 - R)`;
  card.append(el('div', { class: 'my-4 flex justify-center overflow-x-auto' }, katexBlock(formula)));

  // Worked example with the user's current build values
  card.append(workedExampleCard());

  // Variable list
  const varTable = el('table', { class: 'w-full text-xs my-3' });
  const varRows: [string, string][] = [
    ['W', 'Average weapon damage (a property of your equipped weapon)'],
    ['A', 'Sum of all additive damage % (the giant pool: vuln, elemental, distant, etc., plus +%damage tempers/aspects)'],
    ['S', `Total main stat (Strength/Dexterity/Intelligence/Willpower); divisor is ${divisor} for ${build.classId}`],
    ['C', String.raw`Skill coefficient: \(\text{coef}_{1} \cdot \bigl(1 + 0.10\,(N - \lfloor N/5 \rfloor - 1) + 0.15\,\lfloor N/5 \rfloor\bigr)\) where \(N\) = total skill ranks (step bonus every 5 ranks)`],
    ['M_i', 'Each standalone [x] aspect/unique multiplier (Grandfather, Godslayer, glyph legendary mults, etc.)'],
    ['CSDM', 'Critical Strike Damage Multiplier bucket: 1 + sum of all "[x] X% Critical Strike Damage Multiplier" affixes'],
    ['VDM', 'Vulnerable Damage Multiplier bucket: 1 + sum of all "[x] X% Vulnerable Damage Multiplier" affixes'],
    ['DOTM', 'Damage over Time Multiplier bucket: 1 + sum of all "[x] X% Damage over Time Multiplier" affixes'],
    ['R', 'Enemy damage reduction; level-appropriate enemy = 80% (so factor is 0.20)'],
    ['c, v, d', 'Indicator variables (1 if the hit crits / target is vulnerable / hit is DoT, else 0)'],
  ];
  for (const [k, v] of varRows) {
    varTable.append(el('tr', { class: 'border-b border-zinc-900' },
      el('td', { class: 'py-1 pr-3 align-top w-16' }, katexInline(k)),
      el('td', { class: 'py-1 text-zinc-400' }, v as any),
    ));
  }
  card.append(varTable);

  card.append(el('h3', { class: 'font-semibold text-zinc-200 mt-4 mb-2' }, 'Min/max heuristic'));
  card.append(el('p', { class: 'text-zinc-400 mb-3' },
    'For two buckets at sizes ', katexInline('A'), ' and ', katexInline('B'),
    ', the same affix is ', katexInline('B / A'), ' times more valuable in the smaller one. Spread your multipliers — a product is maximized when its factors are balanced (',
    Object.assign(el('a', { href: 'https://en.wikipedia.org/wiki/Inequality_of_arithmetic_and_geometric_means', target: '_blank', class: 'text-amber-400 hover:underline' }), { textContent: 'AM-GM inequality' }), ').',
  ));

  card.append(el('p', { class: 'text-xs text-zinc-500 mt-4' },
    'Methodology, formulas, weapon damage values, and stacking rules: ',
    Object.assign(el('a', { href: 'https://www.youtube.com/watch?v=2GKhCdxxqp8', target: '_blank', class: 'text-amber-400 hover:underline' }), { textContent: 'Avarilyn — Damage Calculation Explained with Proof' }),
    ' / ',
    Object.assign(el('a', { href: 'https://www.youtube.com/watch?v=as8y_zGlPrs', target: '_blank', class: 'text-amber-400 hover:underline' }), { textContent: 'How to Optimize Damage' }),
    ' / ',
    Object.assign(el('a', { href: 'https://docs.google.com/spreadsheets/d/1qM6XySdTPuoCF4pEndWihBy0oONayRwZZ9WePkn_TFU/', target: '_blank', class: 'text-amber-400 hover:underline' }), { textContent: 'Original Sheet' }),
    ' · ',
    Object.assign(el('a', { href: 'https://github.com/jlian/d4-bucket-calc', target: '_blank', class: 'text-amber-400 hover:underline' }), { textContent: 'GitHub source' }),
    '.',
  ));

  return card;
}

function workedExampleCard(): HTMLElement {
  const wrap = el('div', { class: 'my-4 bg-zinc-950 border border-zinc-800 rounded p-4' });
  wrap.append(el('h3', { class: 'text-sm font-semibold text-amber-400 mb-2' }, '✨ Your build, plugged in'));
  const c = calc(build);
  if (c.weaponDmg === 0) {
    wrap.append(el('p', { class: 'text-xs text-zinc-500' }, 'Pick a weapon type to see the formula with your numbers.'));
    return wrap;
  }

  const cls = classFor(build);
  // Use the "vs Vulnerable Elite" scenario by default, or DoT if disabled
  const scenario = build.disableCrit
    ? presetScenarios().find(s => s.id === 'dot')!
    : presetScenarios().find(s => s.id === 'vuln_elite')!;
  const conds = scenario.conditions;
  const additive = additiveForScenario(build, conds);
  const critAdd = critOnlyAdditive(build);

  // Effective factors (matching scenarioDamage logic)
  const vdmFactor = conds.vulnerable ? c.vdm * 1.2 : 1;
  // recompute precisely the same way as calc to keep numbers honest
  const base = c.weaponDmg * c.mainStatMult * vdmFactor * c.allm * c.skillCoef * c.extraMultProduct * build.enemyDR;
  const nonCritDmg = base * (1 + additive);
  const critDmg = base * (1 + additive + critAdd) * c.csdm * 1.5;
  const avgDmg = scenario.isDot
    ? base * (1 + additive) * c.dotm
    : critDmg * c.critChance + nonCritDmg * (1 - c.critChance);

  const num = (n: number, d=2) => n.toLocaleString('en-US', { maximumFractionDigits: d });
  const fmtMult = (n: number) => `×${num(n, 3)}`;

  wrap.append(el('p', { class: 'text-xs text-zinc-500 mb-3' },
    `Scenario: “${scenario.label}” · ${conds.vulnerable ? 'enemy is vulnerable, ' : ''}${conds.elites ? 'enemy is elite, ' : ''}${scenario.isDot ? 'DoT tick' : `${(c.critChance*100).toFixed(0)}% crit chance`}.`,
  ));

  // Step-by-step table
  const tbl = el('table', { class: 'w-full text-xs' });
  const addRow = (label: string, value: string, hl?: boolean) =>
    tbl.append(el('tr', { class: 'border-b border-zinc-900' },
      el('td', { class: 'py-1 pr-3 ' + (hl ? 'text-amber-400 font-semibold' : 'text-zinc-400') }, label),
      el('td', { class: 'py-1 text-right tabular-nums font-mono ' + (hl ? 'text-amber-400 font-semibold' : 'text-zinc-300') }, value),
    ));

  addRow('Weapon Damage (W)', num(c.weaponDmg));
  addRow(`Main Stat (${cls.mainStat}, S)`, `${c.mainStatSum} → 1 + ${c.mainStatSum}/${cls.divisor} = ${fmtMult(c.mainStatMult)}`);
  addRow('Additive bucket (1 + A)', `1 + ${num(additive, 3)} = ${fmtMult(1 + additive)}`);
  if (!scenario.isDot) addRow('Crit-only additive (CRITADD)', critAdd ? `+${num(critAdd,3)}` : '0');
  addRow('All / Element Mult (ALLM)', fmtMult(c.allm));
  addRow('Vulnerable Mult (VDM)', conds.vulnerable
    ? `${fmtMult(c.vdm)} × 1.20 baseline = ${fmtMult(vdmFactor)}`
    : 'inactive (target not vulnerable)');
  if (scenario.isDot) {
    addRow('DoT Mult (DOTM)', fmtMult(c.dotm));
  } else {
    addRow('Crit Mult (CSDM × 1.5)', `${fmtMult(c.csdm)} × 1.5 = ${fmtMult(c.csdm * 1.5)} (on crit)`);
  }
  addRow('Skill Coefficient (C)', `${num(c.skillCoef, 4)} (rank-1 ${num(build.skillCoefL1, 3)} × ${c.totalSkillRanks} ranks)`);
  addRow('Standalone mults ∏Mi', fmtMult(c.extraMultProduct));
  addRow('Enemy DR (1 - R)', `${num(build.enemyDR, 2)} (${num((1-build.enemyDR)*100, 0)}% reduction)`);
  if (!scenario.isDot) {
    addRow('Non-crit hit', num(nonCritDmg, 0));
    addRow('Crit hit', num(critDmg, 0));
    addRow(`Crit chance weighting`, `${(c.critChance*100).toFixed(1)}% crit, ${((1-c.critChance)*100).toFixed(1)}% non-crit`);
  }
  wrap.append(tbl);

  // Final readout
  wrap.append(el('div', { class: 'mt-3 pt-3 border-t border-zinc-800 flex items-baseline justify-between' },
    el('span', { class: 'text-sm text-zinc-300' }, scenario.isDot ? 'DoT tick damage' : 'Average damage per hit'),
    el('span', { class: 'text-2xl font-bold text-amber-400 font-mono' }, fmtBigNum(avgDmg)),
  ));

  // KaTeX rendered formula with substituted values
  const ms = (1 + c.mainStatSum/cls.divisor).toFixed(3);
  const partA = String.raw`D = ${num(c.weaponDmg)} \cdot (1 + ${num(additive,3)}) \cdot ${ms} \cdot ${num(c.skillCoef,4)} \cdot ${num(c.extraMultProduct,3)}`;
  let partB = '';
  if (!scenario.isDot) {
    partB = String.raw` \cdot ${num(c.csdm,3)} \cdot 1.5`;
    if (conds.vulnerable) partB += String.raw` \cdot ${num(c.vdm,3)} \cdot 1.2`;
  } else {
    partB = String.raw` \cdot ${num(c.dotm,3)}`;
  }
  partB += String.raw` \cdot ${num(c.allm,3)} \cdot ${num(build.enemyDR,2)}`;
  wrap.append(el('div', { class: 'mt-3 overflow-x-auto text-xs' }, katexBlock(partA + partB)));

  // Note about ignored variables
  wrap.append(el('p', { class: 'text-xs text-zinc-600 mt-2 italic' },
    'Note: factors that don\u2019t apply to this scenario (e.g. crit on a non-crit hit, DoT mult on a direct hit) are omitted.',
  ));
  return wrap;
}

function katexInline(tex: string): HTMLElement {
  const span = el('span', { class: 'inline-block' });
  katex.render(tex, span, { throwOnError: false, displayMode: false });
  return span;
}
function katexBlock(tex: string): HTMLElement {
  const div = el('div', { class: 'inline-block' });
  katex.render(tex, div, { throwOnError: false, displayMode: true });
  return div;
}

// ---------- header buttons ----------
function copyShareBtn() {
  const btn = el('button', { class: 'text-xs px-3 py-1.5 rounded bg-amber-600 hover:bg-amber-500 text-zinc-950 font-medium' }, 'Copy Share Link');
  btn.addEventListener('click', async () => {
    await navigator.clipboard.writeText(window.location.href);
    const old = btn.textContent;
    btn.textContent = 'Copied!';
    setTimeout(() => { btn.textContent = old; }, 1500);
  });
  return btn;
}

function snapshotBtn() {
  if (build.snapshot) {
    const btn = el('button', { class: 'text-xs px-3 py-1.5 rounded bg-zinc-700 hover:bg-zinc-600 text-zinc-100' }, '📌 Clear Snapshot');
    btn.addEventListener('click', () => { build.snapshot = null; mount(); });
    return btn;
  }
  const btn = el('button', { class: 'text-xs px-3 py-1.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300', title: 'Freeze current build to compare against future changes' }, '📌 Snapshot');
  btn.addEventListener('click', () => {
    const snap = cloneBuild(build); snap.snapshot = null;
    build.snapshot = snap;
    mount();
  });
  return btn;
}

function exportBtn() {
  const btn = el('button', { class: 'text-xs px-3 py-1.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300' }, 'Export JSON');
  btn.addEventListener('click', async () => {
    const json = exportJson(build);
    try { await navigator.clipboard.writeText(json); btn.textContent = 'JSON Copied!'; setTimeout(() => { btn.textContent = 'Export JSON'; }, 1500); }
    catch { prompt('Copy this JSON:', json); }
  });
  return btn;
}

function importBtn() {
  const btn = el('button', { class: 'text-xs px-3 py-1.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300' }, 'Import JSON');
  btn.addEventListener('click', () => {
    const text = prompt('Paste build JSON:');
    if (!text) return;
    const parsed = importJson(text);
    if (!parsed) { alert('Invalid JSON'); return; }
    build = parsed;
    mount();
  });
  return btn;
}

function resetBtn() {
  const btn = el('button', { class: 'text-xs px-3 py-1.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300' }, 'Reset');
  btn.addEventListener('click', () => {
    if (!confirm('Reset to defaults?')) return;
    localStorage.removeItem('d4bc.build');
    window.location.hash = '';
    window.location.reload();
  });
  return btn;
}

window.addEventListener('hashchange', () => { build = loadInitialBuild(); mount(); });
mount();
