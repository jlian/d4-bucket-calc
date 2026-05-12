import './style.css';
import { calc, classFor, CLASSES, BUCKET_META, BUCKET_ORDER, weightFor, type Build, type Bucket, type Affix } from './calc';
import { loadInitialBuild, persist, exportJson, importJson } from './state';

let build: Build = loadInitialBuild();

// ---------- formatting ----------
const fmtPct = (n: number, digits = 2) => (n * 100).toFixed(digits) + '%';
const fmtNum = (n: number, digits = 0) => n.toLocaleString('en-US', { maximumFractionDigits: digits });
const fmtBigNum = (n: number) => {
  if (!isFinite(n)) return '—';
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
function sectionCard(title: string) {
  const card = el('section', { class: 'bg-zinc-900/50 border border-zinc-800 rounded-lg p-4' });
  card.append(el('h2', { class: 'text-sm font-semibold text-zinc-300 uppercase tracking-wide mb-3' }, title));
  return card;
}

// ---------- field builders (stable, do NOT recreate on input) ----------
// All percent inputs are stored as decimals internally, but show as %

function pctInput(getValue: () => number, setValue: (v: number) => void, opts: { step?: number; w?: string } = {}) {
  const inp = el('input', {
    type: 'number',
    step: opts.step ?? 1,
    class: inputCls() + ' ' + (opts.w ?? 'w-20') + ' text-right',
  }) as HTMLInputElement;
  inp.value = stripTrailingZero((getValue() * 100).toFixed(2));
  inp.addEventListener('input', () => {
    const raw = parseFloat(inp.value);
    setValue(isNaN(raw) ? 0 : raw / 100);
    afterInput();
  });
  return inp;
}

function numInput(getValue: () => number, setValue: (v: number) => void, opts: { step?: number; w?: string } = {}) {
  const inp = el('input', {
    type: 'number',
    step: opts.step ?? 1,
    class: inputCls() + ' ' + (opts.w ?? 'w-20') + ' text-right',
  }) as HTMLInputElement;
  inp.value = String(getValue());
  inp.addEventListener('input', () => {
    const raw = parseFloat(inp.value);
    setValue(isNaN(raw) ? 0 : raw);
    afterInput();
  });
  return inp;
}

function textInput(getValue: () => string, setValue: (v: string) => void, opts: { w?: string; placeholder?: string } = {}) {
  const inp = el('input', {
    type: 'text',
    class: inputCls() + ' ' + (opts.w ?? 'flex-1'),
    placeholder: opts.placeholder ?? '',
  }) as HTMLInputElement;
  inp.value = getValue();
  inp.addEventListener('input', () => { setValue(inp.value); afterInput(); });
  return inp;
}

// ---------- afterInput: persist + refresh outputs only ----------
function afterInput() {
  persist(build);
  refreshOutputs();
  refreshAdditiveSum();
}

// ---------- top-level mount + refresh ----------
function mount() {
  const root = document.getElementById('app')!;
  root.innerHTML = '';
  root.append(renderHeader());
  const main = el('main', { class: 'max-w-6xl mx-auto p-4 grid lg:grid-cols-[1fr_minmax(280px,360px)] gap-6' });
  root.append(main);

  const left = el('div', { class: 'space-y-6' });
  left.append(characterCard());
  left.append(additiveCard());
  left.append(slotsCard());
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
  const c = calc(build);
  right.append(damageCard(c));
  right.append(bucketsCard(c));
  right.append(stratCard(c));
  right.append(creditsCard());
}

function refreshAdditiveSum() {
  const span = document.getElementById('additive-sum');
  if (!span) return;
  const eff = build.additiveLines.reduce((a, l) => a + l.value * (l.uptime ?? 1), 0);
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
        snapshotBtn(),
        importBtn(),
        exportBtn(),
        copyShareBtn(),
        resetBtn(),
      ),
    ),
  );
}

// ---------- character card ----------
function characterCard() {
  const cls = classFor(build);
  const card = sectionCard('Character');
  const grid = el('div', { class: 'grid grid-cols-2 gap-3' });

  // Class picker — changing class changes input labels, so trigger full mount
  const classSel = el('select', { class: inputCls() + ' w-full' }) as HTMLSelectElement;
  for (const c of CLASSES) {
    const opt = el('option', { value: c.id }, `${c.id} (${c.mainStat})`);
    if (c.id === build.classId) opt.setAttribute('selected', '');
    classSel.append(opt);
  }
  classSel.addEventListener('change', () => {
    build.classId = classSel.value as any;
    persist(build);
    mount(); // labels change, full re-mount
  });
  grid.append(field('Class', classSel));

  grid.append(field('Weapon Damage (Offensive tab)', numInput(() => build.weaponBaseDmg, v => build.weaponBaseDmg = v, { w: 'w-full' })));
  grid.append(field(`Base ${cls.mainStat} (paragon, no gear)`, numInput(() => build.baseMainStat, v => build.baseMainStat = v, { w: 'w-full' })));
  grid.append(field(`Extra ${cls.mainStat} (charms/talisman)`, numInput(() => build.extraMainStat, v => build.extraMainStat = v, { w: 'w-full' })));
  grid.append(field('Skill Coef (lvl 1, e.g. 0.45)', numInput(() => build.skillCoefL1, v => build.skillCoefL1 = v, { step: 0.001, w: 'w-full' })));
  grid.append(field('Skill Ranks (1–15)', numInput(() => build.skillRanks, v => build.skillRanks = v, { w: 'w-full' })));
  grid.append(field('Extra Skill Ranks (items)', numInput(() => build.extraSkillRanks, v => build.extraSkillRanks = v, { w: 'w-full' })));
  grid.append(field('Crit Chance (%, naked baseline)', pctInput(() => build.baseCritChance, v => build.baseCritChance = v, { w: 'w-full', step: 0.5 })));
  grid.append(field('Attack Speed (%, optional)', pctInput(() => build.attackSpeed, v => build.attackSpeed = v, { w: 'w-full', step: 1 })));
  grid.append(field('Enemy DR (%, dummy=80%)', pctInput(() => 1 - build.enemyDR, v => build.enemyDR = 1 - v, { w: 'w-full', step: 1 })));

  // Crit toggle (full row)
  const checkWrap = el('label', { class: 'flex items-center gap-2 col-span-2 text-sm cursor-pointer mt-1' });
  const cb = el('input', { type: 'checkbox', class: 'accent-amber-500' }) as HTMLInputElement;
  cb.checked = build.disableCrit;
  cb.addEventListener('change', () => { build.disableCrit = cb.checked; afterInput(); });
  checkWrap.append(cb);
  checkWrap.append(document.createTextNode('Disable crit (DoT build)'));
  grid.append(checkWrap);

  card.append(grid);

  card.append(el('details', { class: 'mt-3 text-xs text-zinc-500' },
    el('summary', { class: 'cursor-pointer text-zinc-400' }, 'Help'),
    el('div', { class: 'mt-2 space-y-1' },
      el('div', {}, '• Weapon Damage: open Character → Offensive Tab → "Weapon Damage" — the big single number for the weapon you attack with.'),
      el('div', {}, '• Base Main Stat: unequip everything (paragon + base only) and read the main stat from your character sheet.'),
      el('div', {}, '• Extra Main Stat: from charms/talisman that grant flat all-stats (e.g. 100 all-stats × 5 talisman slots = +500 main stat).'),
      el('div', {}, '• Skill Ranks step formula: every multiple of 5 ranks gets a 5% bonus on top of the per-rank 10% scaling.'),
      el('div', {}, '• Crit Chance: just the inherent 5% + paragon — gear crit chance affixes go in slots below.'),
      el('div', {}, '• Attack Speed: optional. Multiplies DPS rate (hits/sec). Skip if your skill has breakpoints (most spells/skills do — only use for skills like basic attacks or Dance of Knives).'),
    ),
  ));
  return card;
}

// ---------- additive baseline card (per-line, stable inputs, no uptime column) ----------
function additiveCard() {
  const card = sectionCard('Additive Damage (Naked Baseline)');
  card.append(el('p', { class: 'text-xs text-zinc-400 mb-3' },
    'Strip your gear, hover each in-game additive damage line, and copy the BOTTOM number into the matching field. Leave 0 for anything that doesn\'t apply (e.g. only fill "Primary Element" with your build\'s element).',
  ));

  const grid = el('div', { class: 'grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2' });
  for (const line of build.additiveLines) {
    const row = el('div', { class: 'flex items-center gap-2' });
    const lbl = el('div', { class: 'flex-1 text-xs text-zinc-400' }, line.label);
    row.append(lbl);
    row.append(pctInput(() => line.value, v => line.value = v, { w: 'w-24' }));
    row.append(el('span', { class: 'text-zinc-600 text-xs' }, '%'));
    grid.append(row);
  }
  card.append(grid);

  // Effective sum — updates in place
  card.append(el('div', { class: 'mt-3 pt-2 border-t border-zinc-800 flex justify-between text-xs' },
    el('span', { class: 'text-zinc-500' }, 'Effective additive sum:'),
    el('span', { id: 'additive-sum', class: 'text-amber-400 font-mono tabular-nums' }, '0.00%'),
  ));
  // Set initial value
  setTimeout(refreshAdditiveSum, 0);
  return card;
}

// ---------- gear slots card ----------
function slotsCard() {
  const card = sectionCard('Gear Slots');
  card.append(el('p', { class: 'text-xs text-zinc-400 mb-3' },
    'Each affix on each piece of gear. Pick the affix type from the dropdown so it lands in the right bucket. Percent affixes are entered as % (e.g. 30 for 30%); main stat & weapon damage as raw values.',
  ));
  for (const slot of build.slots) card.append(slotBlock(slot));
  return card;
}

function slotBlock(slot: { id: string; name: string; affixes: Affix[] }) {
  const wrap = el('div', { class: 'border border-zinc-800 rounded-lg p-3 mb-2' });
  const header = el('div', { class: 'flex items-center justify-between mb-2' });
  header.append(el('h3', { class: 'font-semibold text-zinc-200' }, slot.name));
  const addBtn = el('button', { class: 'text-xs text-amber-400 hover:text-amber-300 px-2 py-1 rounded border border-amber-700/50' }, '+ Add Affix');
  addBtn.addEventListener('click', () => { slot.affixes.push({ bucket: 'CSDM', value: 0 }); mount(); });
  header.append(addBtn);
  wrap.append(header);

  if (slot.affixes.length === 0) {
    wrap.append(el('p', { class: 'text-xs text-zinc-600 italic' }, 'No affixes. Click + Add Affix.'));
    return wrap;
  }

  slot.affixes.forEach((a, idx) => {
    const row = el('div', { class: 'flex gap-2 mb-1.5 items-center' });

    const sel = el('select', { class: inputCls() + ' flex-1' }) as HTMLSelectElement;
    for (const b of BUCKET_ORDER) {
      const opt = el('option', { value: b }, BUCKET_META[b].label);
      if (b === a.bucket) opt.setAttribute('selected', '');
      sel.append(opt);
    }
    sel.addEventListener('change', () => { a.bucket = sel.value as Bucket; mount(); }); // re-mount because input type changes (% vs raw)
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

// ---------- extra multipliers card ----------
function extraMultsCard() {
  const card = sectionCard('Standalone [x] Multipliers (Aspects/Uniques)');
  card.append(el('p', { class: 'text-xs text-zinc-400 mb-3' }, 'Each one its own factor. e.g. Grandfather, Godslayer, glyph legendary mults. Enter the % from the affix.'));

  build.extraMultipliers.forEach((m, idx) => {
    const row = el('div', { class: 'flex gap-2 mb-2 items-center' });
    row.append(textInput(() => m.label, v => m.label = v, { w: 'flex-1', placeholder: 'Name (e.g. Grandfather)' }));
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

// ---------- damage card ----------
function damageCard(c: ReturnType<typeof calc>) {
  const card = sectionCard('Damage');
  const dmg = build.disableCrit ? c.dotDmg : c.avgDmg;
  card.append(el('div', { class: 'flex items-baseline justify-between gap-3' },
    el('span', { class: 'text-zinc-400 text-sm' }, build.disableCrit ? 'DoT Damage' : 'Avg Damage'),
    el('span', { class: 'text-3xl font-bold text-amber-400' }, fmtBigNum(dmg)),
  ));
  card.append(el('div', { class: 'mt-2 text-xs text-zinc-500 space-y-1' },
    el('div', {}, `Non-Crit: ${fmtBigNum(c.nonCritDmg)}`),
    el('div', {}, `Crit:     ${fmtBigNum(c.critDmg)}`),
    el('div', {}, `DoT tick: ${fmtBigNum(c.dotDmg)}`),
  ));

  if (build.snapshot) {
    const snapNoSnap = { ...build.snapshot, snapshot: null } as Build;
    const sc = calc(snapNoSnap);
    const snapDmg = build.disableCrit ? sc.dotDmg : sc.avgDmg;
    const delta = dmg / snapDmg - 1;
    const sign = delta >= 0 ? '+' : '';
    const cls = delta > 0 ? 'text-emerald-400' : delta < 0 ? 'text-red-400' : 'text-zinc-500';
    card.append(el('div', { class: 'mt-3 pt-2 border-t border-zinc-800 flex items-center justify-between text-xs' },
      el('span', { class: 'text-zinc-500' }, '📌 vs snapshot:'),
      el('span', { class: cls + ' font-bold tabular-nums' }, sign + fmtPct(delta, 2)),
    ));
    card.append(el('div', { class: 'text-xs text-zinc-600' }, `Snapshot ${build.disableCrit ? 'DoT' : 'avg'}: ${fmtBigNum(snapDmg)}`));
  }
  return card;
}

// ---------- buckets card ----------
function bucketsCard(c: ReturnType<typeof calc>) {
  const card = sectionCard('Buckets — Find Your Smallest');
  card.append(el('p', { class: 'text-xs text-zinc-400 mb-2' },
    'Smaller bucket → bigger marginal gain. The "Weight" column is the % damage gain from a typical fresh GA roll on that bucket. Top of the list = best place to spend a slot.',
  ));

  const rows: { name: string; value: number; gain: number }[] = [
    { name: 'CSDM',     value: c.csdm,      gain: weightFor(build, 'CSDM',       BUCKET_META.CSDM.typicalRoll) },
    { name: 'VDM',      value: c.vdm,       gain: weightFor(build, 'VDM',        BUCKET_META.VDM.typicalRoll) },
    { name: 'DOTM',     value: c.dotm,      gain: weightFor(build, 'DOTM',       BUCKET_META.DOTM.typicalRoll) },
    { name: 'ALLM',     value: c.allm,      gain: weightFor(build, 'ALLM',       BUCKET_META.ALLM.typicalRoll) },
    { name: 'Additive', value: c.additiveTotal, gain: weightFor(build, 'ADDITIVE', BUCKET_META.ADDITIVE.typicalRoll) },
    { name: 'Main Stat',value: c.mainStatMult, gain: weightFor(build, 'MAINSTAT', BUCKET_META.MAINSTAT.typicalRoll) },
    { name: 'Crit %',   value: 1 + c.critChance, gain: weightFor(build, 'CRITCHANCE', BUCKET_META.CRITCHANCE.typicalRoll) },
    { name: 'Weapon',   value: c.weaponDmg, gain: weightFor(build, 'WEPDMG',    BUCKET_META.WEPDMG.typicalRoll) },
    { name: 'Skill Rk', value: 1 + c.totalSkillRanks / 10, gain: weightFor(build, 'SKILLRANK', BUCKET_META.SKILLRANK.typicalRoll) },
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

function stratCard(c: ReturnType<typeof calc>) {
  const card = sectionCard('Stats');
  const stats: [string, string][] = [
    ['Main Stat Sum', fmtNum(c.mainStatSum)],
    ['Main Stat Mult', `×${c.mainStatMult.toFixed(3)}`],
    ['Crit Chance', fmtPct(c.critChance)],
    ['Skill Coef', c.skillCoef.toFixed(4)],
    ['CSDM', `×${c.csdm.toFixed(3)}`],
    ['VDM', `×${c.vdm.toFixed(3)}`],
    ['DOTM', `×${c.dotm.toFixed(3)}`],
    ['ALLM', `×${c.allm.toFixed(3)}`],
    ['Add (non-crit)', `×${c.additiveTotal.toFixed(3)}`],
    ['Add (crit)', `×${c.additiveCritTotal.toFixed(3)}`],
    ['Extra Mults', `×${c.extraMultProduct.toFixed(3)}`],
    ['Attack Speed', fmtPct(build.attackSpeed)],
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
    const btn = el('button', { class: 'text-xs px-3 py-1.5 rounded bg-zinc-700 hover:bg-zinc-600 text-zinc-100', title: 'Clear comparison snapshot' }, '📌 Clear Snapshot');
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
    try {
      await navigator.clipboard.writeText(json);
      const old = btn.textContent;
      btn.textContent = 'JSON Copied!';
      setTimeout(() => { btn.textContent = old; }, 1500);
    } catch {
      prompt('Copy this JSON:', json);
    }
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

// ---------- helpers ----------
function field(label: string, control: HTMLElement) {
  const wrap = el('label', { class: 'block' });
  wrap.append(el('div', { class: 'text-xs text-zinc-500 mb-1' }, label));
  control.classList.add('w-full');
  wrap.append(control);
  return wrap;
}

window.addEventListener('hashchange', () => { build = loadInitialBuild(); mount(); });
mount();
