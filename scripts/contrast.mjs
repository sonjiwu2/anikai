// QA helper: WCAG contrast ratios for the colour pairs the interface actually uses.
// Usage: node scripts/contrast.mjs
const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16))
const lum = ([r, g, b]) => {
  const f = (v) => ((v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
}
const ratio = (a, b) => {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}
/** Composite a translucent colour over a solid one. */
const over = (fg, alpha, bg) => fg.map((v, i) => Math.round(v * alpha + bg[i] * (1 - alpha)))

const bg = hex('#121318')
const surface = hex('#1b1d24')
const raised = hex('#252832')
const hover = hex('#2e313d')
const text = hex('#f4f3ef')
const muted = hex('#a2a6b1')
const accent = hex('#819bff')
const onAccent = hex('#0d1020')
const danger = hex('#ff8f8f')
const placeholder = hex('#8b909c')
const white = [255, 255, 255]

const pairs = [
  ['text on bg', text, bg, 4.5],
  ['text on surface', text, surface, 4.5],
  ['text on raised', text, raised, 4.5],
  ['muted on bg', muted, bg, 4.5],
  ['muted on surface', muted, surface, 4.5],
  ['muted on raised (menus, toasts)', muted, raised, 4.5],
  ['muted on hover surface', muted, hover, 4.5],
  ['accent text on bg', accent, bg, 4.5],
  ['accent text on surface', accent, surface, 4.5],
  ['accent on accent-soft over surface', accent, over(accent, 0.14, surface), 4.5],
  ['dark text on accent button', onAccent, accent, 4.5],
  ['dark text on accent-hover', onAccent, hex('#96acff'), 4.5],
  ['danger text on bg', danger, bg, 4.5],
  ['danger text on surface', danger, surface, 4.5],
  ['placeholder on surface', placeholder, surface, 4.5],
  ['badge text on media scrim over white art', text, over(hex('#0a0b0f'), 0.78, white), 4.5],
  ['white on player gradient end over white frame', white, over([0, 0, 0], 0.82, white), 4.5],
  ['checkbox border on surface (non-text)', hex('#6d7280'), surface, 3],
  ['text field border on bg (non-text)', hex('#6d7280'), bg, 3],
  ['text field border on surface (non-text)', hex('#6d7280'), surface, 3],
  // The switch is identified by its thumb; the track only has to differ between on and off.
  ['toggle off thumb on track (non-text)', hex('#d9dbe2'), hex('#3a3e4b'), 3],
  ['toggle on track (accent) on surface (non-text)', accent, surface, 3],
  ['focus ring accent on bg (non-text)', accent, bg, 3],
]

let failed = 0
for (const [name, fg, back, min] of pairs) {
  const r = ratio(fg, back)
  const ok = r >= min
  if (!ok) failed++
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${r.toFixed(2).padStart(5)}:1  (min ${min})  ${name}`)
}
process.exit(failed ? 1 : 0)
