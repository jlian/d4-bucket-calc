import './style.css';
import 'katex/dist/katex.min.css';
import katex from 'katex';
import samplePaladin from './sample-paladin.json';
import {
  calc, classFor, CLASSES, BUCKET_META, BUCKET_ORDER,
  weightFor, scenarioDamage, scenarioDamageNoCrit, presetScenarios,
  additiveForScenario, critOnlyAdditive,
  WEAPON_TYPES, weaponTypeById,
  type Build, type Bucket, type Slot,
} from './calc';
import { loadInitialBuild, persist, exportJson, importJson, cloneBuild, buildShareUrl, importJsonObject } from './state';

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
  left.append(slotsCard());
  left.append(charmsCard());
  left.append(glyphsCard());
  left.append(paragonContributionsCard());
  main.append(left);

  const right = el('div', { id: 'outputs', class: 'space-y-6 lg:sticky lg:top-20 lg:self-start' });
  main.append(right);
  refreshOutputs();
  persist(build);

  // Footer
  const footer = el('footer', { id: 'formula-footer', class: 'max-w-6xl mx-auto p-4 mt-8 border-t border-zinc-900' });
  footer.append(formulaCard());
  root.append(footer);
}

function refreshOutputs() {
  const right = document.getElementById('outputs');
  if (right) {
    right.innerHTML = '';
    right.append(scenariosCard());
    right.append(bucketsCard());
    right.append(statsCard());
  }
  const footer = document.getElementById('formula-footer');
  if (footer) {
    footer.innerHTML = '';
    footer.append(formulaCard());
  }
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
        snapshotBtn(), restoreSnapshotBtn(), loadSampleBtn(), jsonBtn(), copyShareBtn(), resetBtn(),
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
  grid.append(field('Skill Damage % at rank 1 (e.g. 115 for Blessed Hammer)', pctInput(() => build.skillDamagePct, v => build.skillDamagePct = v, { step: 1, w: 'w-full' })));
  grid.append(field('Skill Ranks (naked, usually 15)', numInput(() => build.totalSkillRanks, v => build.totalSkillRanks = v, { w: 'w-full' })));
  grid.append(field(`${cls.mainStat} (naked, no gear/charms)`, numInput(() => build.baseMainStat, v => build.baseMainStat = v, { w: 'w-full' })));
  grid.append(field(`Bonus ${cls.mainStat} (charms / seal / talisman)`, numInput(() => build.extraMainStat, v => build.extraMainStat = v, { w: 'w-full' })));

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
  const card = sectionCard('Damage Stats (Naked Baseline)');

  // Replace the long single-paragraph subtitle with bullet steps + a reference screenshot
  const help = el('details', { class: 'mb-3 text-xs text-zinc-400' });
  const summary = el('summary', { class: 'cursor-pointer text-zinc-300 select-none' }, 'How to fill this in (read once, takes 2 min in-game)');
  help.append(summary);
  const body = el('div', { class: 'mt-2 grid sm:grid-cols-[1fr_auto] gap-3 items-start' });
  const steps = el('ol', { class: 'list-decimal list-inside space-y-1 text-zinc-400' });
  steps.append(
    el('li', {}, 'Strip ', el('strong', { class: 'text-zinc-200' }, 'all'), ' gear (and charms / Horadric Seal). You want pure paragon contribution.'),
    el('li', {}, 'Open Character Sheet → ', el('strong', { class: 'text-zinc-200' }, 'Offensive'), ' tab.'),
    el('li', {}, 'Hover each line. The tooltip has a ', el('strong', { class: 'text-zinc-200' }, 'top'), ' (visible) number and a ', el('strong', { class: 'text-zinc-200' }, 'bottom'), ' line: ',
      el('em', { class: 'text-amber-300' }, '“You have +X% of this stat from items and Paragon.”'),
      ' Copy the bottom number.'),
    el('li', {}, 'The inherent +50% crit damage and +20% vulnerable are already baked into the formula — don’t add them.'),
  );
  body.append(steps);
  const fig = el('figure', { class: 'border border-zinc-800 rounded overflow-hidden bg-zinc-950 max-w-[320px]' });
  const img = el('img', { src: import.meta.env.BASE_URL + 'help/offensive-tab-hover.webp', alt: 'D4 Offensive tab tooltip example', class: 'block w-full h-auto', loading: 'lazy' }) as HTMLImageElement;
  fig.append(img);
  fig.append(el('figcaption', { class: 'text-[10px] text-zinc-500 px-2 py-1' }, 'Hover a stat → read the bottom “+X% from items and Paragon” line.'));
  body.append(fig);
  help.append(body);
  card.append(help);

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

  // Custom additive entries: for additive stat lines that exist in the in-game offensive tab but aren't in our default list (e.g., Rogue's Damage with Imbued, Damage vs Distant)
  card.append(el('h4', { class: 'text-xs uppercase tracking-wide text-zinc-500 mt-4 mb-2' }, 'Other additive lines'));
  card.append(el('p', { class: 'text-xs text-zinc-500 mb-2' }, 'For additive damage lines on your in-game offensive tab that aren’t in the default list above (e.g., Rogue’s “Damage with Imbued”, “Damage vs Distant”, etc.). Same rule: copy the BOTTOM tooltip number from the offensive tab.'));
  const paragonSlot = build.slots.find(s => s.id === 'paragon');
  if (paragonSlot) {
    const customAdds = paragonSlot.affixes.filter(a => a.bucket === 'ADDITIVE');
    customAdds.forEach((a) => {
      const row = el('div', { class: 'flex items-center gap-2 mb-1.5' });
      row.append(textInput(() => a.label ?? '', v => { a.label = v; }, { w: 'flex-1', placeholder: 'e.g. Damage with Imbued' }));
      row.append(pctInput(() => a.value, v => a.value = v, { w: 'w-24' }));
      row.append(el('span', { class: 'text-zinc-600 text-xs' }, '%'));
      const del = el('button', { class: 'text-zinc-500 hover:text-red-400 px-2' }, '✕');
      del.addEventListener('click', () => { paragonSlot.affixes.splice(paragonSlot.affixes.indexOf(a), 1); mount(); });
      row.append(del);
      card.append(row);
    });
    const addBtn = el('button', { class: 'text-xs text-amber-400 hover:text-amber-300 px-2 py-1 rounded border border-amber-700/50 mt-1' }, '+ Add other additive line');
    addBtn.addEventListener('click', () => { paragonSlot.affixes.push({ bucket: 'ADDITIVE' as Bucket, value: 0, label: '' }); mount(); });
    card.append(addBtn);
  }
  return card;
}

// ---------- Card 3: Gear Slots ----------
const CHARM_IDS = new Set(['charm1', 'charm2', 'charm3', 'charm4', 'charm5', 'charm6', 'seal']);
const GLYPH_IDS = new Set(['glyph1', 'glyph2', 'glyph3', 'glyph4', 'glyph5']);

function slotsCard() {
  const card = sectionCard('Gear Slots',
    'For each equipped item, pick the weapon type (weapons only) and add its affixes.');
  const cls = classFor(build);
  const weaponSlotCount = cls.weaponSlots;
  for (const slot of build.slots) {
    if (slot.id === 'paragon') continue;
    if (CHARM_IDS.has(slot.id)) continue;
    if (GLYPH_IDS.has(slot.id)) continue;
    const wepIdx = slot.id.startsWith('wep') ? parseInt(slot.id.slice(3), 10) : 0;
    if (wepIdx > 0 && wepIdx > weaponSlotCount) continue;
    card.append(slotBlock(slot));
  }
  return card;
}

function charmsCard() {
  const card = sectionCard('Charms & Seal',
    '6 charm slots + Horadric Seal. Each can carry affixes that go into damage buckets. Use the x% Standalone Multiplier (aspect/unique) bucket type for things like 5pc set bonuses (e.g., x500% Disciple damage).');
  const order = ['charm1','charm2','charm3','charm4','charm5','charm6','seal'];
  for (const id of order) {
    const slot = build.slots.find(s => s.id === id);
    if (slot) card.append(slotBlock(slot));
  }
  return card;
}

function glyphsCard() {
  const card = sectionCard('Glyph Sockets (5 max)',
    'Each glyph has up to 3 sources of damage: the additive bonus (top), additional bonus (often conditional, ignore if not steady-state), and the legendary bonus (bottom). Enter ONLY the legendary bonus here — the additive parts are already in your naked baseline numbers above.');
  const order = ['glyph1','glyph2','glyph3','glyph4','glyph5'];
  for (const id of order) {
    const slot = build.slots.find(s => s.id === id);
    if (slot) card.append(slotBlock(slot));
  }
  return card;
}

function paragonContributionsCard() {
  const card = sectionCard('Paragon Nodes (legendary, rare, magic)',
    'For each paragon node that contributes a x% [bucket] mult or +X% damage. Add as many as you have. (Pure additive bonuses already counted via Offensive tab tooltip values above.)');
  const slot = build.slots.find(s => s.id === 'paragon');
  if (slot) card.append(slotBlock(slot));
  return card;
}

function slotBlock(slot: Slot) {
  const isWeapon = slot.id.startsWith('wep');
  const isParagon = slot.id === 'paragon';
  const isEmpty = slot.affixes.length === 0 && (!isWeapon || (slot.weaponTypeId ?? 'none') === 'none');

  // Collapsed row for empty non-weapon, non-paragon slots: just a thin label + add button.
  if (isEmpty && !isWeapon && !isParagon) {
    const row = el('div', { class: 'flex items-center justify-between gap-3 py-1.5 px-3 mb-1 border border-zinc-800/60 rounded text-sm hover:border-zinc-700 transition-colors' });
    row.append(el('span', { class: 'text-zinc-500' }, slot.name));
    const addBtn = el('button', { class: 'text-xs text-amber-400 hover:text-amber-300 px-2 py-0.5 rounded border border-amber-700/50' }, '+ Add Affix');
    addBtn.addEventListener('click', () => { slot.affixes.push({ bucket: 'CSDM', value: 0 }); mount(); });
    row.append(addBtn);
    return row;
  }

  const wrap = el('div', { class: 'border border-zinc-800 rounded-lg p-3 mb-2' });

  const header = el('div', { class: 'flex items-center gap-3 mb-2 flex-wrap' });
  if (!isParagon) header.append(el('h3', { class: 'font-semibold text-zinc-200 mr-auto' }, slot.name));
  else header.append(el('span', { class: 'mr-auto' }));

  if (isWeapon) {
    const sel = el('select', { class: inputCls() + ' text-xs' }) as HTMLSelectElement;
    for (const wt of WEAPON_TYPES) {
      if (wt.allowedClasses && !wt.allowedClasses.includes(build.classId)) continue;
      const opt = el('option', { value: wt.id }, wt.label);
      if (wt.id === (slot.weaponTypeId ?? 'none')) opt.setAttribute('selected', '');
      sel.append(opt);
    }
    sel.addEventListener('change', () => { slot.weaponTypeId = sel.value; mount(); });
    header.append(sel);
    const wt = weaponTypeById(slot.weaponTypeId ?? 'none');
    if (wt.baseDamage > 0) {
      const overrides = slot.affixes.filter(a => a.bucket === 'WEPDMG').reduce((s, a) => s + a.value, 0);
      const total = wt.baseDamage + overrides;
      const dmgChip = el('span', {
        class: 'text-xs text-zinc-400 px-2 py-1 rounded bg-zinc-900 border border-zinc-800 whitespace-nowrap',
        title: overrides !== 0
          ? `Base ${wt.baseDamage.toLocaleString()} + ${overrides >= 0 ? '+' : ''}${overrides.toLocaleString()} from + Weapon Damage affix(es) below`
          : `Built-in baseline for ${wt.label}. Add a “+ Weapon Damage” affix below to override.`,
      }, `${total.toLocaleString()} dmg`);
      header.append(dmgChip);
    }
  }

  const addBtn = el('button', { class: 'text-xs text-amber-400 hover:text-amber-300 px-2 py-1 rounded border border-amber-700/50' }, '+ Add Affix');
  addBtn.addEventListener('click', () => { slot.affixes.push({ bucket: 'CSDM', value: 0 }); mount(); });
  header.append(addBtn);
  wrap.append(header);

  // (Removed weaponAvgDamage input — the hardcoded baseline + WEPDMG affix already matches the in-game tooltip.)

  if (slot.affixes.length === 0) wrap.append(el('p', { class: 'text-xs text-zinc-600 italic' }, 'No affixes.'));

  slot.affixes.forEach((a, idx) => {
    const row = el('div', { class: 'flex flex-wrap sm:flex-nowrap gap-2 mb-1.5 items-center min-w-0' });
    const sel = el('select', { class: inputCls() + ' w-full sm:flex-1 min-w-0' }) as HTMLSelectElement;
    const candidates = BUCKET_ORDER.filter(b => isWeapon || (b !== 'WEPDMG' && b !== 'GEM'));
    candidates.sort((x, y) => BUCKET_META[x].label.localeCompare(BUCKET_META[y].label));
    for (const b of candidates) {
      const opt = el('option', { value: b }, BUCKET_META[b].label);
      if (b === a.bucket) opt.setAttribute('selected', '');
      sel.append(opt);
    }
    sel.addEventListener('change', () => { a.bucket = sel.value as Bucket; mount(); });
    row.append(sel);

    // Optional inline label — shown for buckets where it helps document what the entry is.
    // Sits between the bucket dropdown and the value so it shares the row instead of wrapping below.
    const labelable = a.bucket === 'EXTRAMULT' || a.bucket === 'ADDITIVE' || a.bucket === 'MAINSTAT_PCT' || a.bucket === 'GEM';
    if (labelable) {
      row.append(textInput(() => a.label ?? '', v => { a.label = v; }, { w: 'w-full sm:flex-1 min-w-0', placeholder: 'Optional label (e.g. “Heir of Perdition”)' }));
    }

    // Number input + unit suffix as a fixed-width pair so percent and non-percent rows align.
    const isPct = BUCKET_META[a.bucket].isPercent;
    const valWrap = el('div', { class: 'flex items-center gap-1 shrink-0' });
    if (isPct) {
      valWrap.append(pctInput(() => a.value, v => a.value = v, { w: 'w-20 text-right' }));
    } else {
      valWrap.append(numInput(() => a.value, v => a.value = v, { w: 'w-20 text-right' }));
    }
    // Always render a fixed-width unit slot so the X button lines up across rows.
    valWrap.append(el('span', { class: 'text-zinc-600 text-xs w-3 inline-block' }, isPct ? '%' : ''));
    row.append(valWrap);

    const del = el('button', { class: 'text-zinc-500 hover:text-red-400 px-2 shrink-0' }, '✕');
    del.addEventListener('click', () => { slot.affixes.splice(idx, 1); mount(); });
    row.append(del);
    wrap.append(row);
  });
  return wrap;
}

// ---------- OUTPUT: Scenarios ----------
// Transient UI state for the scenarios card (not persisted)
const scenarioState = { vulnerable: true, elites: true, close: false, distant: false, cc: false, healthy: false };

function scenariosCard() {
  const card = sectionCard('Damage');
  const c = calc(build);
  if (c.weaponDmg === 0) {
    card.append(el('p', { class: 'text-xs text-amber-400' }, '⚠️ Pick a weapon type in your weapon slot to enable damage output.'));
    return card;
  }

  // Conditional toggles
  const toggleWrap = el('div', { class: 'flex flex-wrap gap-x-3 gap-y-1 mb-3' });
  const toggles: { key: keyof typeof scenarioState; label: string }[] = [
    { key: 'vulnerable', label: 'Vulnerable' },
    { key: 'elites',     label: 'Elite' },
    { key: 'close',      label: 'Close' },
    { key: 'distant',    label: 'Distant' },
    { key: 'cc',         label: 'CC’d' },
    { key: 'healthy',    label: 'Healthy' },
  ];
  for (const t of toggles) {
    const lbl = el('label', { class: 'flex items-center gap-1 text-xs text-zinc-400 cursor-pointer' });
    const cb = el('input', { type: 'checkbox', class: 'accent-amber-500' }) as HTMLInputElement;
    cb.checked = !!scenarioState[t.key];
    cb.addEventListener('change', () => { scenarioState[t.key] = cb.checked; refreshOutputs(); });
    lbl.append(cb, document.createTextNode(t.label));
    toggleWrap.append(lbl);
  }
  card.append(toggleWrap);

  // Compute scenarios
  const conds = { ...scenarioState };
  const scenarioHit:  any = { id: 'hit',  label: 'hit',  conditions: conds };
  const scenarioDot:  any = { id: 'dot',  label: 'dot',  conditions: conds, isDot: true };
  const hitDmg = scenarioDamageNoCrit(build, scenarioHit);
  const critDmg = build.disableCrit ? 0 : scenarioCritOnly(build, scenarioHit);
  const dotDmg = build.disableCrit ? scenarioDamage(build, scenarioDot) : 0;

  // Big readout (matches in-game: white = hit, yellow = crit)
  const row = el('div', { class: 'grid grid-cols-2 gap-3 mb-1' });
  row.append(el('div', { class: 'text-center' },
    el('div', { class: 'text-xs text-zinc-500' }, 'Hit'),
    el('div', { class: 'text-2xl font-bold text-zinc-100 font-mono' }, build.disableCrit ? fmtBigNum(dotDmg) : fmtBigNum(hitDmg)),
  ));
  row.append(el('div', { class: 'text-center' },
    el('div', { class: 'text-xs text-zinc-500' }, build.disableCrit ? 'DoT tick' : 'Crit'),
    el('div', { class: 'text-2xl font-bold text-amber-400 font-mono' }, build.disableCrit ? fmtBigNum(dotDmg) : fmtBigNum(critDmg)),
  ));
  card.append(row);

  if (!build.disableCrit) {
    const avg = critDmg * c.critChance + hitDmg * (1 - c.critChance);
    card.append(el('div', { class: 'text-center text-sm text-zinc-300 mt-1.5' },
      el('span', { class: 'text-xs text-zinc-500' }, `avg @ ${(c.critChance*100).toFixed(1)}% crit → `),
      el('span', { class: 'text-zinc-100 font-mono font-semibold' }, fmtBigNum(avg)),
    ));
  }

  // Snapshot delta
  if (build.snapshot) {
    const snapBuild = { ...build.snapshot, snapshot: null } as Build;
    const snapHit = scenarioDamageNoCrit(snapBuild, scenarioHit);
    if (snapHit > 0) {
      const delta = hitDmg / snapHit - 1;
      const sign = delta >= 0 ? '+' : '';
      const cls = delta > 0 ? 'text-emerald-400' : delta < 0 ? 'text-red-400' : 'text-zinc-500';
      card.append(el('div', { class: 'mt-2 pt-2 border-t border-zinc-800 flex items-center justify-between text-xs' },
        el('span', { class: 'text-zinc-500' }, '📌 vs snapshot:'),
        el('span', { class: cls + ' font-bold tabular-nums' }, sign + fmtPct(delta, 2)),
      ));
    }
  }
  return card;
}

// Helper: compute a forced-crit hit
function scenarioCritOnly(b: Build, scenario: any): number {
  // Pretend crit chance is 1 for a clean crit readout
  const allCrit = { ...b, baseCritChance: 1, slots: b.slots.map(s => ({ ...s, affixes: s.affixes.filter(a => a.bucket !== 'CRITCHANCE') })) } as Build;
  return scenarioDamage(allCrit, scenario);
}

// ---------- OUTPUT: Buckets ----------
function bucketsCard() {
  const card = sectionCard('Most Valuable Affixes',
    'Each row: what a typical fresh affix of this type would gain you. Sorted by impact.');

  const c = calc(build);
  if (c.weaponDmg === 0) {
    card.append(el('p', { class: 'text-xs text-amber-400' }, '⚠️ Pick a weapon type to compute weights.'));
    return card;
  }

  // "How buckets work" up top so first-time readers see it before the table of numbers.
  card.append(el('details', { class: 'mb-3 text-xs text-zinc-500 border border-zinc-800/60 rounded p-2' },
    el('summary', { class: 'cursor-pointer text-zinc-400 select-none' }, 'How buckets work (read once)'),
    el('div', { class: 'mt-2 text-zinc-400 space-y-2' },
      el('p', {}, 'Same-named affixes ', el('strong', {}, 'sum into one bucket'), '; the bucket then multiplies into the damage formula. A small bucket gains more from a new affix than a big one.'),
      el('p', {}, 'Example: CSDM bucket at +150% (×2.50). Adding x10% → +160% (×2.60). Damage gain = 2.60 / 2.50 = +4%. If your Vulnerable bucket only had +20% (×1.20), same +10% affix goes to ×1.30 → +8.3% — twice as good.'),
      el('p', {}, el('strong', {}, '+ vs x: '), '“+75% Crit Damage” joins the giant additive bucket. “x56% Crit Damage Multiplier” is its own much smaller bucket. The x version is usually 3-5× more valuable in late game.'),
    ),
  ));

  const refScenario = build.disableCrit
    ? presetScenarios().find(s => s.id === 'dot')!
    : { id: 'live', label: 'current scenario', conditions: { ...scenarioState } } as any;

  const cls = classFor(build);
  type Row = { affix: string; gain: number; warn?: string };
  const rows: Row[] = [
    { affix: 'x10% Critical Strike Damage Multiplier', gain: weightFor(build, 'CSDM', 0.10, refScenario) },
    { affix: 'x10% Vulnerable Damage Multiplier',      gain: weightFor(build, 'VDM', 0.10, refScenario) },
    { affix: 'x10% Damage Over Time Multiplier',       gain: weightFor(build, 'DOTM', 0.10, refScenario) },
    { affix: 'x10% All / Element Damage Multiplier',   gain: weightFor(build, 'ALLM', 0.10, refScenario) },
    { affix: '+10% Critical Strike Damage',            gain: weightFor(build, 'CRITADD', 0.10, refScenario) },
    { affix: '+10% Damage (additive)',                 gain: weightFor(build, 'ADDITIVE', 0.10, refScenario) },
    { affix: `+100 ${cls.mainStat}`,                   gain: weightFor(build, 'MAINSTAT', 100, refScenario) },
    { affix: `x10% ${cls.mainStat} Multiplier`,        gain: weightFor(build, 'MAINSTAT_PCT', 0.10, refScenario) },
    { affix: '+5% Critical Strike Chance',             gain: weightFor(build, 'CRITCHANCE', 0.05, refScenario), warn: c.critChance >= 1 ? 'capped' : undefined },
    { affix: '+100 Weapon Damage',                     gain: weightFor(build, 'WEPDMG', 100, refScenario) },
    { affix: '+3 Skill Ranks',                         gain: weightFor(build, 'SKILLRANK', 3, refScenario) },
  ];
  rows.sort((a, b) => b.gain - a.gain);

  const table = el('table', { class: 'w-full text-sm' });
  const tb = el('tbody');
  for (const r of rows) {
    const isHot = r.gain > 0.05, isCold = r.gain < 0.005;
    const gainCls = isHot ? 'text-emerald-400 font-semibold' : isCold ? 'text-zinc-600' : 'text-amber-400';
    const left = el('td', { class: 'py-1 min-w-0 text-zinc-200' }, r.affix);
    if (r.warn) left.append(el('span', { class: 'ml-2 text-xs text-red-400' }, '⚠️ ' + r.warn));
    tb.append(el('tr', { class: 'border-b border-zinc-900' },
      left,
      el('td', { class: 'py-1 text-right tabular-nums pl-2 whitespace-nowrap ' + gainCls }, fmtPct(r.gain)),
    ));
  }
  table.append(tb);
  card.append(table);

  return card;
}

function statsCard() {
  const c = calc(build);
  const cls = classFor(build);
  const card = sectionCard('Stats Summary');
  const pctOf = (mult: number) => `+${((mult - 1) * 100).toFixed(1)}% (×${mult.toFixed(3)})`;
  const stats: [string, string][] = [
    ['Weapon Damage', c.weaponDmg ? fmtNum(c.weaponDmg) : '— pick weapon'],
    [`${cls.mainStat} (total)`, `${fmtNum(c.mainStatSum)} → ×${c.mainStatMult.toFixed(3)} multiplier`],
    ['Skill Damage %', `+${(c.skillCoef * 100).toFixed(1)}% (${c.totalSkillRanks} ranks)`],
    ['Critical Strike Chance', fmtPct(c.critChance, 1)],
    ['Critical Strike Damage Mult', pctOf(c.csdm)],
    ['Vulnerable Damage Mult', pctOf(c.vdm)],
    ['Damage Over Time Mult', pctOf(c.dotm)],
    ['All / Element Damage Mult', pctOf(c.allm)],
    ['Standalone x% product', `×${c.extraMultProduct.toFixed(3)}`],
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

  // Main formula — use plain symbols, not in-build jargon
  const divisor = classFor(build).divisor;
  const formula = String.raw`D = W \cdot (1 + A) \cdot \left(1 + \frac{S}{${divisor}}\right) \cdot C \cdot \prod_{i} M_i \cdot (1.5 \cdot M_{crit})^{c} \cdot (1.2 \cdot M_{vuln})^{v} \cdot M_{dot}^{d} \cdot M_{all} \cdot (1 - R)`;
  card.append(el('div', { class: 'my-4 flex justify-center overflow-x-auto' }, katexBlock(formula)));

  // Min/max heuristic
  card.append(el('p', { class: 'text-zinc-400 mb-3 text-sm' },
    'For two buckets at sizes ', katexInline('A'), ' and ', katexInline('B'),
    ', the same affix is ', katexInline('B / A'), ' times more valuable in the smaller one. Spread your multipliers \u2014 a product is maximized when its factors are balanced (',
    Object.assign(el('a', { href: 'https://en.wikipedia.org/wiki/Inequality_of_arithmetic_and_geometric_means', target: '_blank', class: 'text-amber-400 hover:underline' }), { textContent: 'AM-GM inequality' }), ').',
  ));

  // Worked example with current build values (decimals only)
  card.append(buildPluggedIn());

  card.append(el('p', { class: 'text-xs text-zinc-500 mt-4' },
    'Methodology, formulas, weapon damage values, and stacking rules: ',
    Object.assign(el('a', { href: 'https://www.youtube.com/watch?v=2GKhCdxxqp8', target: '_blank', class: 'text-amber-400 hover:underline' }), { textContent: 'Avarilyn \u2014 Damage Calculation Explained with Proof' }),
    ' / ',
    Object.assign(el('a', { href: 'https://www.youtube.com/watch?v=as8y_zGlPrs', target: '_blank', class: 'text-amber-400 hover:underline' }), { textContent: 'How to Optimize Damage' }),
    ' / ',
    Object.assign(el('a', { href: 'https://docs.google.com/spreadsheets/d/1qM6XySdTPuoCF4pEndWihBy0oONayRwZZ9WePkn_TFU/', target: '_blank', class: 'text-amber-400 hover:underline' }), { textContent: 'Original Sheet' }),
    ' \u00b7 ',
    Object.assign(el('a', { href: 'https://github.com/jlian/d4-bucket-calc', target: '_blank', class: 'text-amber-400 hover:underline' }), { textContent: 'GitHub source' }),
    '.',
  ));

  return card;
}

// @ts-ignore unused
function additiveBreakdown(b: Build, conds: any): string {
  // Kept for backward compat; description-only short version
  const parts: string[] = [];
  for (const l of b.additiveLines) {
    if (l.isCritOnly) continue;
    if (l.applies(conds) && l.value > 0) parts.push(`${l.label} ${(l.value*100).toFixed(0)}%`);
  }
  let slotAdd = 0;
  for (const slot of b.slots) for (const aa of slot.affixes) if (aa.bucket === 'ADDITIVE') slotAdd += aa.value;
  if (slotAdd > 0) parts.push(`gear/extras ${(slotAdd*100).toFixed(1)}%`);
  return parts.length ? ` — sum of ${parts.join(', ')}` : '';
}

function additiveBreakdownMath(b: Build, conds: any, includeCrit: boolean): string {
  const parts: string[] = [];
  for (const l of b.additiveLines) {
    if (l.isCritOnly && !includeCrit) continue;
    if (l.applies({ ...conds, isCrit: includeCrit }) && l.value > 0) parts.push(l.value.toFixed(2));
  }
  let slotAdd = 0, slotCritAdd = 0;
  for (const slot of b.slots) for (const aa of slot.affixes) {
    if (aa.bucket === 'ADDITIVE') slotAdd += aa.value;
    if (aa.bucket === 'CRITADD' && includeCrit) slotCritAdd += aa.value;
  }
  if (slotAdd > 0) parts.push(slotAdd.toFixed(2));
  if (slotCritAdd > 0) parts.push(slotCritAdd.toFixed(2));
  return parts.length ? `1 + ${parts.join(' + ')}` : '';
}

function bucketBreakdownMath(b: Build, bucket: 'CSDM' | 'VDM' | 'DOTM' | 'ALLM'): string {
  const parts: string[] = [];
  for (const slot of b.slots) for (const aa of slot.affixes) {
    if (aa.bucket === bucket && aa.value !== 0) parts.push(aa.value.toFixed(2));
    if (bucket === 'ALLM' && (aa.bucket === 'NONPHYS' || aa.bucket === 'GEM') && aa.value !== 0) parts.push(aa.value.toFixed(2));
  }
  return parts.length ? `1 + ${parts.join(' + ')}` : '1';
}

function extraMultMath(b: Build): string {
  const factors: { label: string; v: number }[] = [];
  for (const slot of b.slots) for (const aa of slot.affixes) {
    if (aa.bucket === 'EXTRAMULT' && aa.value !== 0) factors.push({ label: aa.label || '?', v: 1 + aa.value });
  }
  if (factors.length === 0) return '';
  // Inline the math — okay even if many factors. Multi-line will wrap in the cell.
  return factors.map(f => f.v.toFixed(2)).join(' × ');
}

function buildPluggedIn(): HTMLElement {
  const wrap = el('div', { class: 'my-4 bg-zinc-950 border border-zinc-800 rounded p-4' });
  wrap.append(el('h3', { class: 'text-sm font-semibold text-amber-400 mb-3' }, '✨ Your build, plugged in'));
  const c = calc(build);
  if (c.weaponDmg === 0) {
    wrap.append(el('p', { class: 'text-xs text-zinc-500' }, 'Pick a weapon type to see the formula with your numbers.'));
    return wrap;
  }
  const cls = classFor(build);
  // Use the same scenario state as the Damage card so user can experiment from one place.
  const conds = { ...scenarioState };
  const scenario: any = build.disableCrit ? presetScenarios().find(s => s.id === 'dot') : { id: 'live', label: 'crit hit', conditions: conds };
  const isDot = !!scenario.isDot;
  const additive = additiveForScenario(build, isDot ? {} : conds);
  const critAdd = critOnlyAdditive(build);
  const vdmFactor = conds.vulnerable && !isDot ? c.vdm * 1.2 : 1;
  const base = c.weaponDmg * c.mainStatMult * vdmFactor * c.allm * c.skillCoef * c.extraMultProduct * build.enemyDamageFactor;
  const nonCritDmg = base * (1 + additive);
  const critDmg = base * (1 + additive + critAdd) * c.csdm * 1.5;
  const dotDmg = base * (1 + additive) * c.dotm;
  const avgDmg = isDot ? dotDmg : (critDmg * c.critChance + nonCritDmg * (1 - c.critChance));

  // Format numbers without comma thousand separators (math notation), with fixed decimals
  const dec = (n: number, d = 2) => n.toFixed(d);
  const hi = (s: string) => `<span class="text-amber-400 font-mono">${s}</span>`;

  // One table: Symbol matches the formula exactly | Description (text) | math (intermediate) | result (decimal)
  const tbl = el('table', { class: 'w-full text-xs my-3' });
  tbl.append(el('thead', {}, el('tr', { class: 'text-xs text-zinc-500 border-b border-zinc-800' },
    el('th', { class: 'text-left py-1 font-normal w-32' }, 'Factor'),
    el('th', { class: 'text-left py-1 font-normal' }, 'Description'),
    el('th', { class: 'text-right py-1 font-normal whitespace-nowrap' }, 'Math'),
    el('th', { class: 'text-right py-1 font-normal pl-3 whitespace-nowrap' }, 'Value'),
  )));
  type Row = [string, string, string, number];
  const usedAdd = isDot ? additive : (additive + critAdd);
  const isCritContext = !isDot;
  const addMath = additiveBreakdownMath(build, conds, isCritContext);
  // Skill coef step formula at N total ranks: base × (1 + 0.10 × (N - floor(N/5) - 1) + 0.15 × floor(N/5))
  const N = c.totalSkillRanks;
  const f = Math.floor(N / 5);
  const skillStep = N > 0 ? 1 + 0.10 * (N - f - 1) + 0.15 * f : 1;
  const skillMath = N > 0
    ? `${dec(build.skillDamagePct)} × (1 + 0.10×(${N}-${f}-1) + 0.15×${f}) = ${dec(build.skillDamagePct)} × ${dec(skillStep)}`
    : `${dec(build.skillDamagePct)} × 1`;
  const csdmMath = bucketBreakdownMath(build, 'CSDM');
  const vdmMath = bucketBreakdownMath(build, 'VDM');
  const dotmMath = bucketBreakdownMath(build, 'DOTM');
  const allmMath = bucketBreakdownMath(build, 'ALLM');
  const rows: Row[] = [
    ['W',                       'Average weapon damage from your equipped weapon(s).',                                        '',                                            c.weaponDmg],
    ['(1 + A)',                 isDot ? 'Sum of all additive damage % bonuses (the giant pool).' : (critAdd > 0 ? 'Additive damage bucket. On a crit, includes the +Crit Damage additive too; non-crit hits use just the base bucket.' : 'Sum of all additive damage % bonuses.'), addMath || `1 + ${dec(usedAdd)}`, 1 + usedAdd],
    [`(1 + S/${cls.divisor})`,  `${cls.mainStat} multiplier. Divisor is ${cls.divisor} for ${build.classId} (Barbarian uses 900, all others 800).`, `1 + ${dec(c.mainStatSum, 0)}/${cls.divisor}`, c.mainStatMult],
    ['C',                       'Skill damage coefficient. Step formula: base × (1 + 0.10·(N - ⌊N/5⌋ - 1) + 0.15·⌊N/5⌋) where N = total ranks. Every multiple of 5 ranks gets a 5% bonus on top.', skillMath, c.skillCoef],
    [String.raw`\prod_i M_i`,    'Product of standalone aspect/unique multipliers. Each one is its own factor.', extraMultMath(build), c.extraMultProduct],
  ];
  if (!isDot) {
    rows.push([String.raw`(1.5 \cdot M_{crit})^c`, 'Crit factor: 1.5 inherent crit baseline times the Critical Strike Damage Multiplier bucket. Active only on crit hits (c = 1).', `1.5 × (${csdmMath})`, c.csdm * 1.5]);
    rows.push([String.raw`(1.2 \cdot M_{vuln})^v`, 'Vulnerable factor: 1.2 inherent vuln baseline times the Vulnerable Damage Multiplier bucket. Active only against vulnerable targets (v = 1).', conds.vulnerable ? `1.2 × (${vdmMath})` : 'inactive (v = 0)', vdmFactor]);
  } else {
    rows.push([String.raw`M_{dot}^d`, 'Damage Over Time Multiplier bucket. Active only on DoT ticks (d = 1).', dotmMath, c.dotm]);
  }
  rows.push(['M_{all}',          'All / Element Damage Multiplier bucket. Includes weapon gem damage which sums into this bucket.', allmMath, c.allm]);
  rows.push(['(1 - R)',          `Enemy damage reduction. R = 0.80 for a level-appropriate enemy / training dummy (80% reduction).`, `1 - 0.80`, build.enemyDamageFactor]);

  const tb = el('tbody');
  for (const [sym, desc, math, val] of rows) {
    tb.append(el('tr', { class: 'border-b border-zinc-900 align-top' },
      el('td', { class: 'py-1 pr-3 align-top' }, katexInline(sym)),
      el('td', { class: 'py-1 text-zinc-400 align-top' }, desc),
      el('td', { class: 'py-1 text-right text-zinc-500 font-mono tabular-nums pl-2 align-top' }, math),
      el('td', { class: 'py-1 text-right font-mono text-amber-400 tabular-nums whitespace-nowrap pl-3 align-top' }, dec(val, 2)),
    ));
  }
  tbl.append(tb);
  wrap.append(tbl);

  // (Dropped the substituted equation walk-through. Rounding to 2 decimals across 9+ factors
  // accumulates ~0.5% drift, which made the printed result not match a calculator. The precise
  // value below is from internal full-precision math.)
  // Big result (precise, from internal full-precision math)
  wrap.append(el('div', { class: 'mt-3 pt-3 border-t border-zinc-800 flex items-baseline justify-between' },
    el('span', { class: 'text-sm text-zinc-300' }, isDot ? 'DoT tick' : `Crit hit damage`),
    el('span', { class: 'text-2xl font-bold text-amber-400 font-mono' }, fmtBigNum(isDot ? dotDmg : critDmg)),
  ));
  if (!isDot) {
    wrap.append(el('div', { class: 'text-xs text-zinc-500 mt-2' }, `Avg (with ${(c.critChance*100).toFixed(0)}% crit chance) = ${fmtBigNum(avgDmg)}`));
  }
  void hi; // unused helper
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
  const btn = el('button', { class: 'text-xs px-3 py-1.5 rounded bg-amber-600 hover:bg-amber-500 text-zinc-950 font-medium', title: 'Copy a shareable link that encodes the current build' }, 'Copy Share Link');
  btn.addEventListener('click', async () => {
    const url = buildShareUrl(build);
    try { await navigator.clipboard.writeText(url); }
    catch { prompt('Copy this link:', url); }
    const old = btn.textContent;
    btn.textContent = 'Copied!';
    setTimeout(() => { btn.textContent = old; }, 1500);
  });
  return btn;
}

function snapshotBtn() {
  if (build.snapshot) {
    const btn = el('button', { class: 'text-xs px-3 py-1.5 rounded bg-zinc-700 hover:bg-zinc-600 text-zinc-100', title: 'Stop comparing against the snapshot (does not change current build)' }, '📌 Clear Snapshot');
    btn.addEventListener('click', () => { build.snapshot = null; persist(build); mount(); });
    return btn;
  }
  const btn = el('button', { class: 'text-xs px-3 py-1.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300', title: 'Freeze current build to compare against future changes' }, '📌 Snapshot');
  btn.addEventListener('click', () => {
    const snap = cloneBuild(build); snap.snapshot = null;
    build.snapshot = snap;
    persist(build);
    mount();
  });
  return btn;
}

function restoreSnapshotBtn() {
  if (!build.snapshot) return el('span', { class: 'hidden' });
  const btn = el('button', { class: 'text-xs px-3 py-1.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300', title: 'Revert current build to the snapshot state' }, '↩ Restore');
  btn.addEventListener('click', () => {
    if (!build.snapshot) return;
    if (!confirm('Revert current build to the snapshot? Unsnapshot edits will be lost.')) return;
    const restored = cloneBuild(build.snapshot);
    restored.snapshot = null;
    build = restored;
    persist(build);
    mount();
  });
  return btn;
}

function jsonBtn() {
  const btn = el('button', { class: 'text-xs px-3 py-1.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300', title: 'View / edit / copy build JSON' }, '{ } JSON');
  btn.addEventListener('click', () => openJsonDialog());
  return btn;
}

function loadSampleBtn() {
  const btn = el('button', { class: 'text-xs px-3 py-1.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300', title: 'Load a fully-populated sample build (Paladin / Blessed Hammer)' }, '✨ Sample build');
  btn.addEventListener('click', () => {
    const isEmpty = build.baseMainStat === 0 && build.skillDamagePct === 0
      && build.slots.every(s => s.affixes.length === 0 && (s.weaponTypeId ?? 'none') === 'none');
    if (!isEmpty && !confirm('Replace the current build with the sample? Your current build will be lost (Snapshot/Reset can recover it).')) return;
    const parsed = importJsonObject(samplePaladin);
    if (!parsed) { alert('Sample build failed to load. (Bug — please report.)'); return; }
    build = parsed;
    persist(build);
    mount();
  });
  return btn;
}

function openJsonDialog() {
  const overlay = el('div', { class: 'fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4' });
  const panel = el('div', { class: 'bg-zinc-900 border border-zinc-700 rounded-lg shadow-xl w-full max-w-2xl max-h-[85vh] flex flex-col' });

  const header = el('div', { class: 'flex items-center justify-between px-4 py-3 border-b border-zinc-800' },
    el('h3', { class: 'text-sm font-medium text-zinc-200' }, 'Build JSON'),
    Object.assign(el('button', { class: 'text-zinc-500 hover:text-zinc-200 text-lg leading-none', 'aria-label': 'Close' }), { textContent: '✕' }),
  );
  (header.lastChild as HTMLElement).addEventListener('click', () => overlay.remove());

  const ta = el('textarea', {
    class: 'flex-1 min-h-[300px] w-full bg-zinc-950 text-zinc-200 text-xs font-mono p-3 rounded border border-zinc-800 focus:outline-none focus:border-amber-600 resize-none',
    spellcheck: 'false',
  }) as HTMLTextAreaElement;
  ta.value = exportJson(build);

  const status = el('span', { class: 'text-xs text-zinc-500' }, '');

  const copyBtn = el('button', { class: 'text-xs px-3 py-1.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300' }, 'Copy');
  copyBtn.addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(ta.value); status.textContent = 'Copied to clipboard'; status.className = 'text-xs text-emerald-400'; }
    catch { status.textContent = 'Copy failed — select & copy manually'; status.className = 'text-xs text-red-400'; }
  });

  const applyBtn = el('button', { class: 'text-xs px-3 py-1.5 rounded bg-amber-600 hover:bg-amber-500 text-zinc-950 font-medium' }, 'Apply');
  applyBtn.addEventListener('click', () => {
    const parsed = importJson(ta.value);
    if (!parsed) { status.textContent = 'Invalid JSON — not applied'; status.className = 'text-xs text-red-400'; return; }
    build = parsed;
    persist(build);
    mount();
    overlay.remove();
  });

  const cancelBtn = el('button', { class: 'text-xs px-3 py-1.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300' }, 'Close');
  cancelBtn.addEventListener('click', () => overlay.remove());

  const body = el('div', { class: 'flex-1 flex flex-col min-h-0 p-4 gap-3' });
  body.append(
    el('p', { class: 'text-xs text-zinc-500' }, 'Edit the JSON and click Apply to load it. Copy to share or back up.'),
    ta,
    el('div', { class: 'flex items-center justify-between gap-2 flex-wrap' },
      status,
      el('div', { class: 'flex gap-2' }, copyBtn, applyBtn, cancelBtn),
    ),
  );

  panel.append(header, body);
  overlay.append(panel);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
  document.body.append(overlay);
  // Focus textarea so the user can immediately edit / select-all.
  setTimeout(() => ta.focus(), 0);
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
