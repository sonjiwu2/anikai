import { chromium } from 'playwright'
import { readFile, writeFile } from 'node:fs/promises'
const url = process.argv[2] ?? 'https://ok.ru/video/c1541449'
if (!/^https:\/\/(?:m\.)?ok\.ru\//.test(url)) throw new Error('Only public OK pages are supported')
const browser = await chromium.launch({ headless: true, ...(process.env.ANIKAI_BROWSER_PATH ? { executablePath: process.env.ANIKAI_BROWSER_PATH } : {}) })
try {
  const page = await browser.newPage()
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30_000 })
  await page.waitForTimeout(2500)
  const ids = new Set()
  for (let i = 0; i < 10; i++) {
    const links = await page.locator('a[href]').evaluateAll(elements => elements.map(el => el.getAttribute('href')))
    links.forEach(link => { const id = /\/video\/(\d{6,17})(?:[/?#]|$)/.exec(link ?? '')?.[1]; if (id) ids.add(id) })
    const more = page.locator('.js-show-more').first()
    if (!await more.isVisible().catch(() => false)) { console.log('No visible next page', await more.count()); break }
    await more.click()
    await page.waitForTimeout(1500)
  }
  const file = new URL('./.cache/ok-candidates.json', import.meta.url)
  const previous = JSON.parse(await readFile(file).catch(() => '[]'))
  const all = [...new Set([...previous, ...ids])]
  await writeFile(file, JSON.stringify(all, null, 2))
  console.log(`Discovered ${ids.size} public videos; ${all.length} total candidates`)
} finally { await browser.close() }
