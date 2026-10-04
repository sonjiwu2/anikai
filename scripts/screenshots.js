// QA helper: the visual matrix. Saves JPEG screenshots to docs/screenshots as <page>-<width>.jpg.
// Usage (server must be running, e.g. `npm run preview`), from a scratch directory:
//   playwright-cli open http://localhost:4173/
//   playwright-cli run-code --filename=<repo>/scripts/screenshots.js
// Adjust BASE and OUT below if your port or path differs.
async (page) => {
  const BASE = 'http://localhost:4173'
  const OUT = 'C:/Users/Admin/Desktop/anikai/docs/screenshots/'
  const errors = []
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text().slice(0, 160))
  })
  page.on('pageerror', (e) => errors.push('PAGEERROR ' + String(e).slice(0, 160)))
  const shot = async (name) => {
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(450)
    await page.screenshot({ path: OUT + name + '.jpg', type: 'jpeg', quality: 82 })
  }
  const open = async (path, name) => {
    await page.goto(BASE + path)
    await shot(name)
  }

  // Start clean, capture the empty state, then load the example collection.
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.goto(BASE + '/collection')
  await page.evaluate(() => localStorage.clear())
  await page.reload()
  await shot('collection-empty-1440')
  await page.getByRole('button', { name: 'Загрузить пример коллекции' }).click()

  // A list with a very long, unbroken name for the long-title check.
  await page.getByRole('button', { name: 'Создать список' }).first().click()
  await page
    .locator('dialog[open]')
    .getByLabel('Название')
    .fill('Оченьдлинноеназваниеспискабезпробеловкотороенедолжноломатьвёрстку и ещё несколько слов')
  await page.locator('dialog[open]').getByRole('button', { name: 'Создать список' }).click()
  await page.waitForURL('**/collection/list/*')
  const longList = new URL(page.url()).pathname

  const routes = [
    ['home', '/'],
    ['catalog', '/catalog'],
    ['schedule', '/schedule'],
    ['collection', '/collection'],
    ['anime', '/anime/frieren'],
    ['anime-about', '/anime/frieren?tab=about'],
    ['watch', '/watch/frieren/s1e06'],
    ['watch-no-source', '/watch/jujutsu-kaisen/s3e01'],
    ['profile', '/profile'],
    ['history', '/profile/history'],
    ['settings', '/settings'],
    ['settings-data', '/settings/data'],
    ['list', '/collection/list/demo-cozy'],
    ['not-found', '/nope'],
  ]
  // Every page at the two reference sizes.
  for (const [w, h] of [
    [1440, 1000],
    [390, 844],
  ]) {
    await page.setViewportSize({ width: w, height: h })
    for (const [name, path] of routes) await open(path, `${name}-${w}`)
  }
  // Grid breakpoints.
  const key = [
    ['home', '/'],
    ['catalog', '/catalog'],
    ['anime', '/anime/frieren'],
    ['watch', '/watch/frieren/s1e06'],
    ['collection', '/collection'],
  ]
  for (const w of [360, 768, 1024, 1920]) {
    await page.setViewportSize({ width: w, height: w < 500 ? 780 : 1000 })
    for (const [name, path] of key) await open(path, `${name}-${w}`)
  }
  // Phone held sideways.
  await page.setViewportSize({ width: 844, height: 390 })
  await open('/watch/frieren/s1e06', 'watch-landscape-844x390')
  await open('/', 'home-landscape-844x390')
  // Long title.
  await page.setViewportSize({ width: 390, height: 844 })
  await open(longList, 'list-long-title-390')
  await page.setViewportSize({ width: 1440, height: 1000 })
  await open(longList, 'list-long-title-1440')
  // 200% zoom of a 1280px window is a 640px layout viewport.
  await page.setViewportSize({ width: 640, height: 500 })
  await open('/', 'home-zoom200-640')
  await open('/watch/frieren/s1e06', 'watch-zoom200-640')
  await open('/settings', 'settings-zoom200-640')
  // Sheets, dialogs and menus.
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto(BASE + '/catalog')
  await page.waitForLoadState('networkidle')
  await page.getByRole('button', { name: 'Фильтры' }).click()
  await shot('catalog-filters-sheet-390')
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: 'Поиск' }).click()
  await page.keyboard.type('маг')
  await shot('search-dialog-390')
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.goto(BASE + '/')
  await page.waitForLoadState('networkidle')
  await page.getByRole('combobox', { name: 'Поиск аниме' }).fill('ван')
  await shot('search-dropdown-1440')
  await page.goto(BASE + '/profile')
  await page.waitForLoadState('networkidle')
  await page.getByRole('button', { name: 'Редактировать профиль' }).click()
  await shot('profile-edit-1440')
  await page.goto(BASE + '/collection')
  await page.waitForLoadState('networkidle')
  await page.getByRole('button', { name: /^Действия: / }).first().click()
  await shot('collection-menu-1440')
  return 'done; console errors: ' + JSON.stringify(errors)
}
