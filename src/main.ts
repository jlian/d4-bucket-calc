import './style.css';
import {
  calc, classFor, CLASSES, BUCKET_META, BUCKET_ORDER,
  weightFor, scenarioDamage, presetScenarios,
  WEAPON_TYPES,
  type Build, type Bucket, type Slot, type AdditiveLine,
} from './calc';
import { loadInitialBuild, persist, exportJson, importJson } from './state';

let build: Build = loadInitialBuild();

// ---------- format ----------
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

// ---------- DOM helpers ----------
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

// ---------- stable inputs (don't re-render on input) ----------
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

// ---------- mount + refresh ----------
function afterInput() {
  persist(build);
  refreshOutputs();
  refreshAdditiveSum();
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
  left.append(slotsCard());
  left.append(extraAdditiveCard());
  left.append(extraMultsCard());
  main.append(left);

  const right = el('div', { id: 'outputs', class: 'space-y-6 lg:sticky lg:top-20 lg:self-start' });
  main.append(right);
  refreshOutputs();
  persist(build);
}

function refreshOutputs() {
  const right = document.getElementById('outputs');
  if (!right) return;
  right.innerHTML = '';
  right.append(scenariosCard());
  right.append(dpsCard());
  right.append(bucketsCard());
  right.append(statsCard());
  right.append(creditsCard());
}

function refreshAdditiveSum() {
  const span = document.getElementById('additive-sum');
  if (!span) return;
  const eff = build.additiveLines.filter(l => !l.conditional).reduce((a, l) => a + l.value, 0)
    + build.extraAdditive.reduce((a, l) => a + l.value, 0);
  span.textContent = fmtPct(eff, 1);
}

// ---------- header ----------
function renderHeader() {
  return el('header', { class: 'border-b border-zinc-800 px-4 py-3 sticky top-0 bg-zinc-950/95 backdrop-blur z-10' },
    el('div', { class: 'max-w-6xl mx-auto flex flex-wrap items-center gap-3 justify-between' },
      el('div', { class: 'flex items-center gap-2' },
        el('span', { class: 'text-2xl' }, '⚔️'),
        el('h1', { class: 'text-lg font-bold' }, 'D4 Bucket Calc'),
        el('span', { class: 'text-xs text-zinc-500 hidden sm:inline' }, 'Season 13 · Lord of Hatred'),
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
  const card = sectionCard('Class & Skill', 'Set once per build.');
  const grid = el('div', { class: 'grid grid-cols-2 gap-3' });

  const classSel = el('select', { class: inputCls() + ' w-full' }) as HTMLSelectElement;
  for (const c of CLASSES) {
    const opt = el('option', { value: c.id }, `${c.id} (${c.mainStat})`);
    if (c.id === build.classId) opt.setAttribute('selected', '');
    classSel.append(opt);
  }
  classSel.addEventListener('change', () => { build.classId = classSel.value as any; persist(build); mount(); });
  grid.append(field('Class', classSel));

  grid.append(field('Skill name', textInput(() => build.skillName, v => build.skillName = v, { w: 'w-full', placeholder: 'e.g. Holy Bolt' })));
  grid.append(field('Skill Coef (rank 1, e.g. 0.45)', numInput(() => build.skillCoefL1, v => build.skillCoefL1 = v, { step: 0.001, w: 'w-full' })));
  grid.append(field('Total Skill Ranks (1-base + extras)', numInput(() => build.skillRanks, v => build.skillRanks = v, { w: 'w-full' })));
  grid.append(field(`Base ${cls.mainStat} (no gear)`, numInput(() => build.baseMainStat, v => build.baseMainStat = v, { w: 'w-full' })));
  grid.append(field(`Extra ${cls.mainStat} (charms)`, numInput(() => build.extraMainStat, v => build.extraMainStat = v, { w: 'w-full' })));
  grid.append(field('Enemy DR (% damage reduction)', pctInput(() => 1 - build.enemyDR, v => build.enemyDR = 1 - v, { w: 'w-full', step: 1 })));

  const checkWrap = el('label', { class: 'flex items-center gap-2 col-span-2 text-sm cursor-pointer mt-1' });
  const cb = el('input', { type: 'checkbox', class: 'accent-amber-500' }) as HTMLInputElement;
  cb.checked = build.disableCrit;
  cb.addEventListener('change', () => { build.disableCrit = cb.checked; afterInput(); });
  checkWrap.append(cb, document.createTextNode('DoT build (disable crit)'));
  grid.append(checkWrap);

  card.append(grid);

  card.append(el('details', { class: 'mt-3 text-xs text-zinc-500' },
    el('summary', { class: 'cursor-pointer text-zinc-400' }, 'Help'),
    el('div', { class: 'mt-2 space-y-1' },
      el('div', {}, '• Skill Coef rank 1: enable advanced tooltips, set your skill to 1 point only, hover to see e.g. "(45%)" — enter 0.45.'),
      el('div', {}, '• Total Skill Ranks: include base 5 + glyph/aspect/unique +ranks (e.g. base 5 + 6 from charms + 8 from Eldrin = 19).'),
      el('div', {}, '• Step bonuses: every multiple of 5 ranks gets a 5% boost.'),
      el('div', {}, '• Base Main Stat: strip gear, read the number on character sheet (paragon + glyphs only).'),
      el('div', {}, '• Extra Main Stat: from charms/talisman that grant flat all-stats.'),
      el('div', {}, '• Enemy DR: 80% for level-appropriate dummy. Drop to 0% for true raw output.'),
    ),
  ));
  return card;
}

// ---------- Card 2: Naked Baseline ----------
function nakedBaselineCard() {
  const card = sectionCard('Naked Baseline (Strip Your Gear)',
    'Strip gear and copy these from your character sheet. Hover each in-game additive line and use the BOTTOM number.');

  // Crit chance (naked)
  const critRow = el('div', { class: 'mb-3 flex items-center gap-2' });
  critRow.append(el('div', { class: 'flex-1 text-xs text-zinc-400' }, 'Naked Crit Chance %'));
  critRow.append(pctInput(() => build.baseCritChance, v => build.baseCritChance = v, { w: 'w-24', step: 0.5 }));
  critRow.append(el('span', { class: 'text-zinc-600 text-xs' }, '%'));
  card.append(critRow);

  // Always-on additive lines
  card.append(el('h4', { class: 'text-xs uppercase tracking-wide text-zinc-500 mt-2 mb-2' }, 'Always-on additive lines'));
  card.append(additiveGrid(build.additiveLines.filter(l => !l.conditional)));

  // Conditional additive lines
  card.append(el('h4', { class: 'text-xs uppercase tracking-wide text-zinc-500 mt-4 mb-2' }, 'Conditional additive lines'));
  card.append(el('p', { class: 'text-xs text-zinc-500 mb-2' }, 'These only apply in certain scenarios. Output panel shows damage per scenario, no uptime guesswork.'));
  card.append(additiveGrid(build.additiveLines.filter(l => l.conditional)));

  card.append(el('div', { class: 'mt-3 pt-2 border-t border-zinc-800 flex justify-between text-xs' },
    el('span', { class: 'text-zinc-500' }, 'Always-on additive sum:'),
    el('span', { id: 'additive-sum', class: 'text-amber-400 font-mono tabular-nums' }, '0.00%'),
  ));
  setTimeout(refreshAdditiveSum, 0);
  return card;
}

function additiveGrid(lines: AdditiveLine[]) {
  const grid = el('div', { class: 'grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2' });
  for (const line of lines) {
    const row = el('div', { class: 'flex items-center gap-2' });
    row.append(el('div', { class: 'flex-1 text-xs text-zinc-400' }, line.label));
    row.append(pctInput(() => line.value, v => line.value = v, { w: 'w-24' }));
    row.append(el('span', { class: 'text-zinc-600 text-xs' }, '%'));
    grid.append(row);
  }
  return grid;
}

// ---------- Card 3: Gear Slots ----------
function slotsCard() {
  const card = sectionCard('Gear Slots',
    'Add affixes per piece. For weapon slots, pick the weapon type to auto-fill base damage. Use % values for percent affixes.');
  for (const slot of build.slots) card.append(slotBlock(slot));
  return card;
}

function slotBlock(slot: Slot) {
  const isWeapon = slot.id === 'wep1' || slot.id === 'wep2';
  const wrap = el('div', { class: 'border border-zinc-800 rounded-lg p-3 mb-2' });

  // Header: name + weapon-type picker (if weapon) + add button
  const header = el('div', { class: 'flex items-center gap-3 mb-2 flex-wrap' });
  header.append(el('h3', { class: 'font-semibold text-zinc-200 mr-auto' }, slot.name));

  if (isWeapon) {
    const sel = el('select', { class: inputCls() + ' text-xs' }) as HTMLSelectElement;
    for (const wt of WEAPON_TYPES) {
      const opt = el('option', { value: wt.id }, wt.label + (wt.baseDamage ? ` (${wt.baseDamage})` : ''));
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

  if (slot.affixes.length === 0) {
    wrap.append(el('p', { class: 'text-xs text-zinc-600 italic' }, 'No affixes.'));
  }

  slot.affixes.forEach((a, idx) => {
    const row = el('div', { class: 'flex gap-2 mb-1.5 items-center' });
    const sel = el('select', { class: inputCls() + ' flex-1' }) as HTMLSelectElement;
    for (const b of BUCKET_ORDER) {
      // Hide WEPDMG / GEM on non-weapon slots for clarity
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

// ---------- Extra Additive ----------
function extraAdditiveCard() {
  const card = sectionCard('Extra Additive (Catch-all)',
    'For "+%" damage that doesn\'t fit a standard line: skill-tag bonuses, conditional additive from aspects/uniques, etc. Treated as always-on.');
  build.extraAdditive.forEach((m, idx) => {
    const row = el('div', { class: 'flex gap-2 mb-2 items-center' });
    row.append(textInput(() => m.label, v => m.label = v, { w: 'flex-1', placeholder: 'e.g. dmg with shouts' }));
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
  // For DoT builds, swap the crit ones for DoT
  const filtered = build.disableCrit
    ? scenarios.filter(s => !s.scenario.isCrit)
    : scenarios.filter(s => s.id !== 'dot');

  const tbl = el('table', { class: 'w-full text-sm' });
  tbl.append(el('thead', {}, el('tr', { class: 'text-xs text-zinc-500 border-b border-zinc-800' },
    el('th', { class: 'text-left py-1 font-normal' }, 'Scenario'),
    el('th', { class: 'text-right py-1 font-normal' }, 'Hit'),
  )));
  const tb = el('tbody');
  for (const ns of filtered) {
    const dmg = scenarioDamage(build, ns.scenario);
    tb.append(el('tr', { class: 'border-b border-zinc-900' },
      el('td', { class: 'py-1' }, ns.label),
      el('td', { class: 'py-1 text-right tabular-nums text-amber-400 font-mono' }, fmtBigNum(dmg)),
    ));
  }
  tbl.append(tb);
  card.append(tbl);

  // Snapshot delta
  if (build.snapshot) {
    const refScenario = filtered[0].scenario;
    const cur = scenarioDamage(build, refScenario);
    const snap = scenarioDamage({ ...build.snapshot, snapshot: null } as Build, refScenario);
    if (snap > 0) {
      const delta = cur / snap - 1;
      const sign = delta >= 0 ? '+' : '';
      const cls = delta > 0 ? 'text-emerald-400' : delta < 0 ? 'text-red-400' : 'text-zinc-500';
      card.append(el('div', { class: 'mt-3 pt-2 border-t border-zinc-800 flex items-center justify-between text-xs' },
        el('span', { class: 'text-zinc-500' }, `📌 ${filtered[0].label} vs snapshot:`),
        el('span', { class: cls + ' font-bold tabular-nums' }, sign + fmtPct(delta, 2)),
      ));
    }
  }
  return card;
}

// ---------- OUTPUT: DPS section ----------
function dpsCard() {
  const card = sectionCard('DPS (optional)');
  card.append(el('p', { class: 'text-xs text-zinc-500 mb-3' },
    'Enter your fully-geared attack speed and pick a scenario to convert per-hit to DPS. Note: many skills have attack-speed breakpoints — only use this for skills that scale linearly (e.g. Dance of Knives, basic attacks).',
  ));
  const row = el('div', { class: 'flex items-center gap-2' });
  row.append(el('div', { class: 'flex-1 text-xs text-zinc-400' }, 'Attack Speed %'));
  row.append(pctInput(() => build.attackSpeed, v => build.attackSpeed = v, { w: 'w-24', step: 1 }));
  row.append(el('span', { class: 'text-zinc-600 text-xs' }, '%'));
  card.append(row);

  if (build.attackSpeed > 0) {
    const c = calc(build);
    if (c.weaponDmg > 0) {
      // Approximate DPS using "Plain crit" or fallback
      const refScenario = build.disableCrit
        ? presetScenarios().find(s => s.id === 'dot')!.scenario
        : presetScenarios().find(s => s.id === 'crit')!.scenario;
      const dmg = scenarioDamage(build, refScenario);
      const dps = dmg * (1 + build.attackSpeed);
      card.append(el('div', { class: 'mt-3 flex items-baseline justify-between' },
        el('span', { class: 'text-zinc-400 text-sm' }, build.disableCrit ? 'DoT DPS' : 'Crit DPS'),
        el('span', { class: 'text-xl font-bold text-amber-400' }, fmtBigNum(dps)),
      ));
    }
  }
  return card;
}

// ---------- OUTPUT: Buckets ----------
function bucketsCard() {
  const card = sectionCard('Buckets — Find Your Smallest',
    'Sorted by Weight (% gain from a typical fresh GA roll). Top of list = highest leverage.');
  const c = calc(build);
  if (c.weaponDmg === 0) {
    card.append(el('p', { class: 'text-xs text-zinc-500' }, 'Pick a weapon type to compute weights.'));
    return card;
  }

  // Use first preset scenario for bucket weight comparison
  const refScenario = build.disableCrit
    ? presetScenarios().find(s => s.id === 'dot')!.scenario
    : presetScenarios().find(s => s.id === 'vuln_crit')!.scenario;

  const rows: { name: string; value: number; gain: number }[] = [
    { name: 'CSDM',     value: c.csdm,        gain: weightFor(build, 'CSDM',       BUCKET_META.CSDM.typicalRoll, refScenario) },
    { name: 'VDM',      value: c.vdm,         gain: weightFor(build, 'VDM',        BUCKET_META.VDM.typicalRoll, refScenario) },
    { name: 'DOTM',     value: c.dotm,        gain: weightFor(build, 'DOTM',       BUCKET_META.DOTM.typicalRoll, refScenario) },
    { name: 'ALLM',     value: c.allm,        gain: weightFor(build, 'ALLM',       BUCKET_META.ALLM.typicalRoll, refScenario) },
    { name: 'Additive', value: 1 + c.alwaysOnAdditive, gain: weightFor(build, 'ADDITIVE', BUCKET_META.ADDITIVE.typicalRoll, refScenario) },
    { name: 'Main Stat',value: c.mainStatMult, gain: weightFor(build, 'MAINSTAT', BUCKET_META.MAINSTAT.typicalRoll, refScenario) },
    { name: 'Crit %',   value: 1 + c.critChance, gain: weightFor(build, 'CRITCHANCE', BUCKET_META.CRITCHANCE.typicalRoll, refScenario) },
    { name: 'Weapon',   value: c.weaponDmg,    gain: weightFor(build, 'WEPDMG',    BUCKET_META.WEPDMG.typicalRoll, refScenario) },
    { name: 'Skill Rk', value: 1 + c.totalSkillRanks / 10, gain: weightFor(build, 'SKILLRANK', BUCKET_META.SKILLRANK.typicalRoll, refScenario) },
  ];
  rows.sort((a, b) => b.gain - a.gain);

  const table = el('table', { class: 'w-full text-sm' });
  table.append(el('thead', {}, el('tr', { class: 'text-xs text-zinc-500 border-b border-zinc-800' },
    el('th', { class: 'text-left py-1 font-normal' }, 'Bucket'),
    el('th', { class: 'text-right py-1 font-normal' }, 'Current'),
    el('th', { class: 'text-right py-1 font-normal' }, 'Weight'),
  )));
  const tb = el('tbody');
  for (const r of rows) {
    const isHot = r.gain > 0.05;
    const isCold = r.gain < 0.01;
    tb.append(el('tr', { class: 'border-b border-zinc-900' },
      el('td', { class: 'py-1' }, r.name),
      el('td', { class: 'py-1 text-right text-zinc-400 tabular-nums' }, typeof r.value === 'number' && r.value > 100 ? fmtNum(r.value) : (r.value).toFixed(3)),
      el('td', { class: 'py-1 text-right tabular-nums ' + (isHot ? 'text-emerald-400 font-semibold' : isCold ? 'text-zinc-600' : 'text-amber-400') }, fmtPct(r.gain)),
    ));
  }
  table.append(tb);
  card.append(table);
  return card;
}

function statsCard() {
  const c = calc(build);
  const card = sectionCard('Stats');
  const stats: [string, string][] = [
    ['Weapon Damage', c.weaponDmg ? fmtNum(c.weaponDmg) : '— pick weapon'],
    ['Main Stat Sum', fmtNum(c.mainStatSum)],
    ['Main Stat Mult', `×${c.mainStatMult.toFixed(3)}`],
    ['Crit Chance', fmtPct(c.critChance)],
    ['Skill Coef (eff.)', c.skillCoef.toFixed(4)],
    ['CSDM', `×${c.csdm.toFixed(3)}`],
    ['VDM', `×${c.vdm.toFixed(3)}`],
    ['DOTM', `×${c.dotm.toFixed(3)}`],
    ['ALLM', `×${c.allm.toFixed(3)}`],
    ['Always-on Add', `×${(1 + c.alwaysOnAdditive).toFixed(3)}`],
    ['Extra Mults', `×${c.extraMultProduct.toFixed(3)}`],
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

function creditsCard() {
  const card = el('div', { class: 'text-xs text-zinc-500 p-3 border-t border-zinc-900' });
  card.append(el('p', {}, 'Math ported from Avarilyn\'s spreadsheet.'));
  card.append(el('p', { class: 'mt-1' },
    Object.assign(el('a', { href: 'https://www.youtube.com/watch?v=as8y_zGlPrs', target: '_blank', class: 'underline hover:text-amber-400' }), { textContent: 'How-to Video' }),
    ' · ',
    Object.assign(el('a', { href: 'https://docs.google.com/spreadsheets/d/1qM6XySdTPuoCF4pEndWihBy0oONayRwZZ9WePkn_TFU/', target: '_blank', class: 'underline hover:text-amber-400' }), { textContent: 'Original Sheet' }),
    ' · ',
    Object.assign(el('a', { href: 'https://github.com/jlian/d4-bucket-calc', target: '_blank', class: 'underline hover:text-amber-400' }), { textContent: 'GitHub' }),
  ));
  return card;
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
    const snap = structuredClone(build); snap.snapshot = null;
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
