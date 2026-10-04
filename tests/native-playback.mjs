import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'
import { chromium } from 'playwright'

const base = process.env.ANIKAI_URL ?? 'http://127.0.0.1:4173'
const browser = await chromium.launch({ headless: true, ...(process.env.ANIKAI_BROWSER_PATH ? { executablePath: process.env.ANIKAI_BROWSER_PATH } : {}) })
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, locale: 'ru-RU' })
const page = await context.newPage()
const errors = []
page.on('pageerror', e => errors.push(e.message))
let checks = 0
const check = (name, ok) => { assert.ok(ok, name); console.log(`ok ${++checks}: ${name}`) }
const ready = () => page.waitForFunction(() => document.querySelector('video')?.readyState >= 1, null, { timeout: 45_000 })
const metadata = () => page.locator('video').evaluate(v => ({ time: v.currentTime, duration: v.duration, paused: v.paused, speed: v.playbackRate }))
const storage = async () => {
  // The user store batches localStorage writes after UI actions.
  await page.waitForTimeout(350)
  return page.evaluate(() => JSON.parse(localStorage.getItem('anikai:user:v1') ?? '{}'))
}
const seek = value => page.locator('.player__seek').evaluate((el, value) => {
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, value)
  el.dispatchEvent(new Event('input', { bubbles: true }))
}, value)
try {
  await page.goto(`${base}/watch/frieren/s1e01`)
  await ready()
  check('Rutube episode uses Anikai video element without iframe', await page.locator('iframe').count() === 0 && await page.locator('.player__video').count() === 1)
  check('full episode instead of the demo trailer', (await metadata()).duration > 1400)
  await page.locator('.player__big').click()
  await page.waitForFunction(() => document.querySelector('video').currentTime > 1 && !document.querySelector('video').paused)
  check('real video starts playing', !(await metadata()).paused)
  await page.getByRole('button', { name: 'Настройки воспроизведения', exact: true }).click()
  await page.getByRole('menuitemradio', { name: '720p', exact: true }).click()
  check('720p quality preference is saved', (await storage()).preferences?.preferredQuality === 720)
  await page.getByRole('button', { name: 'Настройки воспроизведения', exact: true }).click()
  await page.getByRole('menuitemradio', { name: '1.5×', exact: true }).click()
  check('playback speed is controlled by Anikai', (await metadata()).speed === 1.5)
  await seek(120)
  await page.waitForFunction(() => document.querySelector('video').currentTime >= 120)
  await page.locator('.player__row').getByRole('button', { name: 'Пауза', exact: true }).click()
  await page.waitForTimeout(400)
  check('seek and pause save the episode position', (await storage()).progress?.['frieren/s1e01']?.position >= 120)
  await page.reload()
  await ready()
  check('saved position survives reload', (await metadata()).time >= 120)
  check('saved speed survives reload', (await metadata()).speed === 1.5)
  await page.getByRole('button', { name: 'Отметить опенинг', exact: true }).click()
  const dialog = page.locator('dialog[open]')
  await dialog.getByLabel('Начало', { exact: true }).fill('2:00')
  await dialog.getByLabel('Конец', { exact: true }).fill('3:00')
  await dialog.getByRole('button', { name: 'Сохранить', exact: true }).click()
  await page.getByRole('button', { name: 'Пропустить опенинг', exact: true }).click()
  check('opening skip controls the native video', (await metadata()).time >= 180)
  const duration = (await metadata()).duration
  await seek(duration - 1.5)
  await page.locator('.player__big').click()
  await page.waitForURL('**/watch/frieren/s1e02', { timeout: 15_000 })
  await ready()
  check('end advances to the next real episode', page.url().endsWith('/frieren/s1e02'))
  check('completed episode is recorded', (await storage()).progress?.['frieren/s1e01']?.completed === true)
  await page.locator('.player__row').getByRole('button', { name: 'Пауза', exact: true }).click()
  await mkdir(new URL('../docs/screenshots/', import.meta.url), { recursive: true })
  await page.screenshot({ path: new URL('../docs/screenshots/native-frieren.png', import.meta.url).pathname.replace(/^\/(\w:)/, '$1') })

  await page.goto(`${base}/watch/steins-gate/s1e06`)
  await ready()
  check('AniLiberty fallback has a full episode', (await metadata()).duration > 1300)
  check('fallback plays in Anikai without iframe', await page.locator('iframe').count() === 0 && await page.getByText('AniLiberty', { exact: true }).count() > 0)
  await page.locator('.player__big').click()
  await page.waitForFunction(() => document.querySelector('video').currentTime > 1, null, { timeout: 20_000 })
  check('fallback actually plays', !(await metadata()).paused)
  await page.screenshot({ path: new URL('../docs/screenshots/native-aniliberty.png', import.meta.url).pathname.replace(/^\/(\w:)/, '$1') })

  await page.goto(`${base}/watch/dandadan/s1e01`)
  await page.locator('.nosource').waitFor({ state: 'visible' })
  check('missing episode is explicit instead of a demo', await page.locator('.nosource').isVisible() && await page.locator('video').count() === 0)
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto(`${base}/watch/frieren/s1e01`)
  await ready()
  check('native player fits a phone screen', await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth))
  await page.screenshot({ path: new URL('../docs/screenshots/native-mobile.png', import.meta.url).pathname.replace(/^\/(\w:)/, '$1') })
  check('no application errors', errors.length === 0)
  console.log(`Passed ${checks} live playback checks`)
} finally { await browser.close() }
