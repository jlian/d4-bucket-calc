# D4 Damage Calc

A static web app that helps you find the highest-leverage stat slots on your **Diablo 4 Season 13 (Lord of Hatred)** build.

It's a faithful port of [Avarilyn](https://www.youtube.com/@avarilyn)'s damage optimization spreadsheet, made interactive, mobile-friendly, and shareable via URL.

🔗 **Live:** https://jlian.github.io/d4-damage-calc/

## What it does

Damage in D4 is a product of "buckets" — additive damage, main stat, multiple `[x]` multiplier categories, weapon damage, skill ranks, etc. Each bucket has *diminishing returns*: the more it has, the less each new affix is worth.

This tool tells you **which bucket is small** and therefore which affix would give you the biggest gain per slot.

## How to use

1. Pick your **class** (sets main stat divisor).
2. Strip your gear in-game and record your **naked baseline** main stat + additive total. *(Hover each in-game additive stat and use the BOTTOM number — the top one lies.)*
3. Enter your **weapon damage**, **skill coefficient** (level 1), and **base crit chance**.
4. Add each gear piece's affixes via the slot grid. Use the bucket dropdown so each affix lands in the right pool.
5. Optionally add **standalone `[x]` aspects/uniques** in the bottom card (Grandfather, Godslayer, etc.).
6. Look at the **Buckets** panel on the right. The top row (sorted by Weight) is your **highest-leverage upgrade target**.

The calculator persists state to your browser. The **Copy Share Link** button gives you a URL with all your inputs embedded — share with friends or save as a snapshot.

## Credits

- Damage formulas, methodology, and design from **[Avarilyn](https://www.youtube.com/@avarilyn)**:
  - [DEEP DIVE: DAMAGE CALCULATION IN DIABLO 4 EXPLAINED WITH PROOF](https://www.youtube.com/watch?v=2GKhCdxxqp8)
  - [DEEP DIVE: HOW TO OPTIMIZE YOUR DAMAGE IN DIABLO 4!](https://www.youtube.com/watch?v=as8y_zGlPrs)
  - [Original Google Sheets calculator](https://docs.google.com/spreadsheets/d/1qM6XySdTPuoCF4pEndWihBy0oONayRwZZ9WePkn_TFU/)

This tool is unofficial fan-made and not affiliated with Blizzard or Avarilyn. All math is theirs; this is just a different UI on top.

## Development

```bash
npm install
npm run dev    # dev server
npm run build  # static output to dist/
```

Pure client-side: Vite + TypeScript + Tailwind CSS. No backend. State lives in URL hash + localStorage. Deployed to GitHub Pages via Actions.

## License

MIT
