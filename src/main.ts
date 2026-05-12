import './style.css';
import { calc, classFor, CLASSES, BUCKET_META, BUCKET_ORDER, weightFor, type Build, type Bucket, type Affix } from './calc';
import { loadInitialBuild, persist, exportJson, importJson } from './state';

let build: Build = loadInitialBuild();

const fmtPct = (n: number, digits = 2) => (n * 100).toFixed(digits) + '%';
const fmtNum = (n: number, digits = 0) => n.toLocaleString('en-US', { maximumFractionDigits: digits });
const fmtBigNum = (n: number) => {
  if (!isFinite(n)) return '—';
  if (n >= 1e9) return (n / 1e9).toFixed(2) + 'B';
  if (n >= 1e6) return (n / 1e6).toFixed(2) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(2) + 'K';
  return fmtNum(n, 0);
};

function el<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Record<string, any> = {}, ...children: (Node | string)[]): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  for (const k in attrs) {
    if (k === 'class') e.className = attrs[k];
    else if (k.startsWith('on') && typeof attrs[k] === 'function') (e as any)[k.toLowerCase()] = attrs[k];
    else e.setAttribute(k, attrs[k]);
  }
  for (const c of children) e.append(c as any);
  return e;
}

function render() {
  persist(build);
  const c = calc(build);
  const cls = classFor(build);

  const root = document.getElementById('app')!;
  root.innerHTML = '';

  // Header
  root.append(el('header', { class: 'border-b border-zinc-800 px-4 py-3 sticky top-0 bg-zinc-950/95 backdrop-blur z-10' },
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
  ));

  const main = el('main', { class: 'max-w-6xl mx-auto p-4 grid lg:grid-cols-[1fr_minmax(280px,360px)] gap-6' });
  root.append(main);

  // LEFT column: inputs
  const left = el('div', { class: 'space-y-6' });
  left.append(characterCard(cls));
  left.append(additivePoolCard());
  left.append(slotsCard());
  left.append(extraMultsCard());
  main.append(left);

  // RIGHT column: outputs
  const right = el('div', { class: 'space-y-6 lg:sticky lg:top-20 lg:self-start' });
  right.append(damageCard(c));
  right.append(bucketsCard(c));
  right.append(stratCard());
  right.append(creditsCard());
  main.append(right);
}

function characterCard(cls: { mainStat: string; divisor: number }) {
  const card = sectionCard('Character');
  const grid = el('div', { class: 'grid grid-cols-2 gap-3' });

  // Class picker
  const classSel = el('select', { class: inputCls(), onchange: (e: Event) => { build.classId = (e.target as HTMLSelectElement).value as any; render(); } });
  for (const c of CLASSES) {
    const opt = el('option', { value: c.id }, `${c.id} (${c.mainStat})`);
    if (c.id === build.classId) opt.setAttribute('selected', '');
    classSel.append(opt);
  }
  grid.append(field('Class', classSel));

  grid.append(numField('Weapon Damage', build.weaponBaseDmg, v => { build.weaponBaseDmg = v; render(); }));
  grid.append(numField(`Base ${cls.mainStat}`, build.baseMainStat, v => { build.baseMainStat = v; render(); }));
  grid.append(numField(`Extra ${cls.mainStat} (Charms)`, build.extraMainStat, v => { build.extraMainStat = v; render(); }));
  grid.append(numField('Skill Coef (lvl 1, e.g. 0.45)', build.skillCoefL1, v => { build.skillCoefL1 = v; render(); }, 0.001));
  grid.append(numField('Skill Ranks (1–15)', build.skillRanks, v => { build.skillRanks = v; render(); }));
  grid.append(numField('Extra Skill Ranks (items)', build.extraSkillRanks, v => { build.extraSkillRanks = v; render(); }));
  grid.append(numField('Base Crit Chance (decimal)', build.baseCritChance, v => { build.baseCritChance = v; render(); }, 0.001));
  grid.append(numField('Enemy DR (0.20 = dummy)', build.enemyDR, v => { build.enemyDR = v; render(); }, 0.01));

  // Disable crit toggle
  const critToggle = el('label', { class: 'flex items-center gap-2 col-span-2 text-sm cursor-pointer mt-1' },
    Object.assign(el('input', { type: 'checkbox', class: 'accent-amber-500' }) as HTMLInputElement, {
      checked: build.disableCrit,
      onchange: (e: Event) => { build.disableCrit = (e.target as HTMLInputElement).checked; render(); },
    }),
    document.createTextNode('Disable crit (DoT build)'),
  );
  grid.append(critToggle);

  card.append(grid);
  return card;
}

function additivePoolCard() {
  const card = sectionCard('Additive Damage (Naked Baseline)');
  card.append(el('p', { class: 'text-xs text-zinc-400 mb-3' }, 'Per-line entries from your character sheet (gear off). Hover each in-game stat and use the BOTTOM number. Uptime weights what fraction of the time the bonus actually applies (e.g., CC = 70%).'));

  const grid = el('div', { class: 'grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-1.5' });

  for (const line of build.additiveLines) {
    const row = el('div', { class: 'flex items-center gap-2' });
    row.append(el('div', { class: 'flex-1 text-xs text-zinc-400' }, line.label));
    row.append(Object.assign(el('input', {
      type: 'number', step: '0.01',
      class: inputCls() + ' w-20 text-right',
      placeholder: '0',
    }) as HTMLInputElement, {
      value: line.value || 0,
      oninput: (e: Event) => { line.value = parseFloat((e.target as HTMLInputElement).value) || 0; render(); },
    }));
    row.append(el('span', { class: 'text-zinc-600 text-xs' }, '×'));
    row.append(Object.assign(el('input', {
      type: 'number', step: '0.05', min: '0', max: '1',
      class: inputCls() + ' w-16 text-right',
      title: 'Uptime (0..1)',
    }) as HTMLInputElement, {
      value: line.uptime ?? 1,
      oninput: (e: Event) => { line.uptime = parseFloat((e.target as HTMLInputElement).value) || 0; render(); },
    }));
    grid.append(row);
  }
  card.append(grid);

  // Show effective sum
  const effSum = build.additiveLines.reduce((acc, l) => acc + l.value * (l.uptime ?? 1), 0);
  card.append(el('div', { class: 'mt-3 pt-2 border-t border-zinc-800 flex justify-between text-xs' },
    el('span', { class: 'text-zinc-500' }, 'Effective additive sum (uptime-weighted):'),
    el('span', { class: 'text-amber-400 font-mono' }, fmtPct(effSum, 1)),
  ));
  return card;
}

function slotsCard() {
  const card = sectionCard('Gear Slots');
  card.append(el('p', { class: 'text-xs text-zinc-400 mb-3' }, 'Each affix on a piece of gear. Select bucket + value. Use decimals (0.5 = 50%) for percent buckets.'));
  for (const slot of build.slots) {
    card.append(slotBlock(slot));
  }
  return card;
}

function slotBlock(slot: { id: string; name: string; affixes: Affix[] }) {
  const wrap = el('div', { class: 'border border-zinc-800 rounded-lg p-3 mb-2' });
  const header = el('div', { class: 'flex items-center justify-between mb-2' },
    el('h3', { class: 'font-semibold text-zinc-200' }, slot.name),
    el('button', {
      class: 'text-xs text-amber-400 hover:text-amber-300 px-2 py-1 rounded border border-amber-700/50',
      onclick: () => { slot.affixes.push({ bucket: 'CSDM', value: 0 }); render(); },
    }, '+ Add Affix'),
  );
  wrap.append(header);

  if (slot.affixes.length === 0) {
    wrap.append(el('p', { class: 'text-xs text-zinc-600 italic' }, 'No affixes. Click + Add Affix.'));
  }

  slot.affixes.forEach((a, idx) => {
    const row = el('div', { class: 'flex gap-2 mb-1.5 items-center' });
    const sel = el('select', { class: inputCls() + ' flex-1', onchange: (e: Event) => { a.bucket = (e.target as HTMLSelectElement).value as Bucket; render(); } });
    for (const b of BUCKET_ORDER) {
      const opt = el('option', { value: b }, BUCKET_META[b].label);
      if (b === a.bucket) opt.setAttribute('selected', '');
      sel.append(opt);
    }
    row.append(sel);

    const isPct = BUCKET_META[a.bucket].isPercent;
    const inp = el('input', {
      type: 'number',
      step: isPct ? '0.01' : '1',
      value: String(a.value),
      class: inputCls() + ' w-24',
      placeholder: isPct ? '0.30' : '180',
      oninput: (e: Event) => { a.value = parseFloat((e.target as HTMLInputElement).value) || 0; render(); },
    });
    row.append(inp);

    const del = el('button', {
      class: 'text-zinc-500 hover:text-red-400 px-2',
      onclick: () => { slot.affixes.splice(idx, 1); render(); },
    }, '✕');
    row.append(del);
    wrap.append(row);
  });
  return wrap;
}

function extraMultsCard() {
  const card = sectionCard('Standalone [x] Multipliers (Aspects/Uniques)');
  card.append(el('p', { class: 'text-xs text-zinc-400 mb-3' }, 'Each one its own factor. e.g. Grandfather, Godslayer, glyph legendary mults.'));

  build.extraMultipliers.forEach((m, idx) => {
    const row = el('div', { class: 'flex gap-2 mb-2 items-center' });
    row.append(el('input', { type: 'text', value: m.label, class: inputCls() + ' flex-1', placeholder: 'Name', oninput: (e: Event) => { m.label = (e.target as HTMLInputElement).value; persist(build); } }));
    row.append(el('input', { type: 'number', step: '0.01', value: String(m.value), class: inputCls() + ' w-24', placeholder: '0.30', oninput: (e: Event) => { m.value = parseFloat((e.target as HTMLInputElement).value) || 0; render(); } }));
    row.append(el('button', { class: 'text-zinc-500 hover:text-red-400 px-2', onclick: () => { build.extraMultipliers.splice(idx, 1); render(); } }, '✕'));
    card.append(row);
  });

  card.append(el('button', {
    class: 'text-xs text-amber-400 hover:text-amber-300 px-2 py-1 rounded border border-amber-700/50 mt-1',
    onclick: () => { build.extraMultipliers.push({ label: '', value: 0 }); render(); },
  }, '+ Add Multiplier'));

  return card;
}

function damageCard(c: ReturnType<typeof calc>) {
  const card = sectionCard('Damage');
  const dmg = build.disableCrit ? c.dotDmg : c.avgDmg;
  card.append(
    el('div', { class: 'flex items-baseline justify-between gap-3' },
      el('span', { class: 'text-zinc-400 text-sm' }, build.disableCrit ? 'DoT Damage' : 'Avg Damage'),
      el('span', { class: 'text-3xl font-bold text-amber-400' }, fmtBigNum(dmg)),
    ),
  );
  card.append(el('div', { class: 'mt-2 text-xs text-zinc-500 space-y-1' },
    el('div', {}, `Non-Crit: ${fmtBigNum(c.nonCritDmg)}`),
    el('div', {}, `Crit:     ${fmtBigNum(c.critDmg)}`),
    el('div', {}, `DoT tick: ${fmtBigNum(c.dotDmg)}`),
  ));

  // Snapshot delta
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
    card.append(el('div', { class: 'text-xs text-zinc-600' },
      `Snapshot ${build.disableCrit ? 'DoT' : 'avg'}: ${fmtBigNum(snapDmg)}`,
    ));
  }
  return card;
}

function bucketsCard(c: ReturnType<typeof calc>) {
  const card = sectionCard('Buckets — Find Your Smallest');
  card.append(el('p', { class: 'text-xs text-zinc-400 mb-2' }, 'Smaller bucket = bigger marginal gain. The "Weight" column shows what a fresh GA roll on that bucket gives you (×1.75 typical roll).'));

  const rows: { name: string; value: number; gain: number }[] = [];

  // Bucket-style multipliers
  rows.push({ name: 'CSDM',     value: c.csdm, gain: weightFor(build, 'CSDM',     BUCKET_META.CSDM.typicalRoll) });
  rows.push({ name: 'VDM',      value: c.vdm,  gain: weightFor(build, 'VDM',      BUCKET_META.VDM.typicalRoll) });
  rows.push({ name: 'DOTM',     value: c.dotm, gain: weightFor(build, 'DOTM',     BUCKET_META.DOTM.typicalRoll) });
  rows.push({ name: 'ALLM',     value: c.allm, gain: weightFor(build, 'ALLM',     BUCKET_META.ALLM.typicalRoll) });
  rows.push({ name: 'Additive', value: c.additiveTotal, gain: weightFor(build, 'ADDITIVE', BUCKET_META.ADDITIVE.typicalRoll) });
  rows.push({ name: 'Main Stat',value: c.mainStatMult, gain: weightFor(build, 'MAINSTAT', BUCKET_META.MAINSTAT.typicalRoll) });
  rows.push({ name: 'Crit %',   value: 1 + c.critChance, gain: weightFor(build, 'CRITCHANCE', BUCKET_META.CRITCHANCE.typicalRoll) });
  rows.push({ name: 'Weapon',   value: c.weaponDmg, gain: weightFor(build, 'WEPDMG', BUCKET_META.WEPDMG.typicalRoll) });
  rows.push({ name: 'Skill Rk', value: 1 + c.totalSkillRanks / 10, gain: weightFor(build, 'SKILLRANK', BUCKET_META.SKILLRANK.typicalRoll) });

  // Sort by gain descending so the biggest leverage is on top
  rows.sort((a, b) => b.gain - a.gain);

  const table = el('table', { class: 'w-full text-sm' });
  table.append(el('thead', {},
    el('tr', { class: 'text-xs text-zinc-500 border-b border-zinc-800' },
      el('th', { class: 'text-left py-1 font-normal' }, 'Bucket'),
      el('th', { class: 'text-right py-1 font-normal' }, 'Current'),
      el('th', { class: 'text-right py-1 font-normal' }, 'Weight'),
    ),
  ));
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

function stratCard() {
  const c = calc(build);
  const card = sectionCard('Stats');
  const stats = [
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

function copyShareBtn() {
  return el('button', {
    class: 'text-xs px-3 py-1.5 rounded bg-amber-600 hover:bg-amber-500 text-zinc-950 font-medium',
    onclick: async () => {
      await navigator.clipboard.writeText(window.location.href);
      const btn = document.activeElement as HTMLButtonElement;
      const old = btn.textContent;
      btn.textContent = 'Copied!';
      setTimeout(() => { btn.textContent = old; }, 1500);
    },
  }, 'Copy Share Link');
}

function snapshotBtn() {
  if (build.snapshot) {
    return el('button', {
      class: 'text-xs px-3 py-1.5 rounded bg-zinc-700 hover:bg-zinc-600 text-zinc-100',
      title: 'Clear comparison snapshot',
      onclick: () => { build.snapshot = null; render(); },
    }, '📌 Clear Snapshot');
  }
  return el('button', {
    class: 'text-xs px-3 py-1.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300',
    title: 'Freeze current build to compare against future changes',
    onclick: () => {
      const snap = structuredClone(build);
      snap.snapshot = null;
      build.snapshot = snap;
      render();
    },
  }, '📌 Snapshot');
}

function exportBtn() {
  return el('button', {
    class: 'text-xs px-3 py-1.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300',
    onclick: async () => {
      const json = exportJson(build);
      try {
        await navigator.clipboard.writeText(json);
        const btn = document.activeElement as HTMLButtonElement;
        const old = btn.textContent;
        btn.textContent = 'JSON Copied!';
        setTimeout(() => { btn.textContent = old; }, 1500);
      } catch {
        // fallback: open prompt
        prompt('Copy this JSON:', json);
      }
    },
  }, 'Export JSON');
}

function importBtn() {
  return el('button', {
    class: 'text-xs px-3 py-1.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300',
    onclick: () => {
      const text = prompt('Paste build JSON:');
      if (!text) return;
      const parsed = importJson(text);
      if (!parsed) { alert('Invalid JSON'); return; }
      build = parsed;
      render();
    },
  }, 'Import JSON');
}

function resetBtn() {
  return el('button', {
    class: 'text-xs px-3 py-1.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300',
    onclick: () => {
      if (!confirm('Reset to defaults?')) return;
      localStorage.removeItem('d4bc.build');
      window.location.hash = '';
      window.location.reload();
    },
  }, 'Reset');
}

// helpers
function inputCls() { return 'bg-zinc-900 border border-zinc-800 rounded px-2 py-1 text-sm text-zinc-200 focus:outline-none focus:border-amber-600'; }
function sectionCard(title: string) {
  const card = el('section', { class: 'bg-zinc-900/50 border border-zinc-800 rounded-lg p-4' });
  card.append(el('h2', { class: 'text-sm font-semibold text-zinc-300 uppercase tracking-wide mb-3' }, title));
  return card;
}
function field(label: string, control: HTMLElement) {
  const wrap = el('label', { class: 'block' });
  wrap.append(el('div', { class: 'text-xs text-zinc-500 mb-1' }, label));
  control.classList.add('w-full');
  wrap.append(control);
  return wrap;
}
function numField(label: string, value: number, onChange: (v: number) => void, step = 1, fullWidth = false) {
  const wrap = el('label', { class: 'block' + (fullWidth ? ' col-span-2' : '') });
  wrap.append(el('div', { class: 'text-xs text-zinc-500 mb-1' }, label));
  const input = el('input', {
    type: 'number',
    step: String(step),
    value: String(value),
    class: inputCls() + ' w-full',
    oninput: (e: Event) => onChange(parseFloat((e.target as HTMLInputElement).value) || 0),
  });
  wrap.append(input);
  return wrap;
}

window.addEventListener('hashchange', () => { build = loadInitialBuild(); render(); });
render();
