"""End-to-end scenarios for Anikai (Python Playwright).

Runs against a running dev or preview server:

    npm run dev
    py tests/scenarios.py                 # all scenarios
    py tests/scenarios.py playback notes  # only the named ones
    ANIKAI_URL=http://localhost:4173 py tests/scenarios.py

Each scenario gets a fresh browser context (clean storage). The script prints one line per check
and exits with code 1 if anything failed.
"""

import json
import os
import re
import sys
import tempfile
from pathlib import Path

from playwright.sync_api import Browser, Page, sync_playwright

BASE = os.environ.get("ANIKAI_URL", "http://localhost:5173").rstrip("/")
STORAGE_KEY = "anikai:user:v1"
DESKTOP = {"width": 1440, "height": 1000}
PHONE = {"width": 390, "height": 844}

results: list[tuple[str, bool, str]] = []
current = ""


def check(name: str, ok: bool, detail: str = "") -> bool:
    results.append((f"{current}: {name}", bool(ok), detail))
    print(f"  {'ok  ' if ok else 'FAIL'} {name}{'' if ok or not detail else '  -> ' + detail}")
    return bool(ok)


def open_page(browser: Browser, viewport=DESKTOP, **context_args) -> Page:
    context = browser.new_context(viewport=viewport, locale="ru-RU", **context_args)
    page = context.new_page()
    page.errors = []  # type: ignore[attr-defined]
    page.on("pageerror", lambda e: page.errors.append(f"pageerror: {e}"))  # type: ignore[attr-defined]
    page.on(
        "console",
        lambda m: page.errors.append(f"console: {m.text[:200]}")  # type: ignore[attr-defined]
        if m.type == "error" and "Failed to load resource" not in m.text
        else None,
    )
    return page


def go(page: Page, path: str) -> None:
    page.goto(BASE + path)
    page.wait_for_load_state("networkidle")


def user_data(page: Page) -> dict:
    # The store batches writes; give it a moment before reading.
    page.wait_for_timeout(300)
    raw = page.evaluate(f"localStorage.getItem('{STORAGE_KEY}')")
    return json.loads(raw) if raw else {}


def no_overflow(page: Page) -> bool:
    return page.evaluate("document.documentElement.scrollWidth <= document.documentElement.clientWidth")


def video(page: Page, expr: str):
    return page.evaluate(f"(() => {{ const v = document.querySelector('video'); return {expr} }})()")


def set_range(page: Page, selector: str, value: float) -> None:
    """Drive a native range input the way a user drag would (React listens to the input event)."""
    page.eval_on_selector(
        selector,
        """(el, value) => {
            Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, String(value));
            el.dispatchEvent(new Event('input', { bubbles: true }));
        }""",
        value,
    )


def start_playback(page: Page) -> None:
    page.wait_for_function("document.querySelector('video')?.readyState >= 1")
    page.locator(".player__big").click()
    page.wait_for_function("document.querySelector('video').currentTime > 0.6 && !document.querySelector('video').paused")


def finish(page: Page) -> None:
    check("нет ошибок в консоли", not page.errors, "; ".join(page.errors[:3]))  # type: ignore[attr-defined]
    page.context.close()


# ---------------------------------------------------------------------------


def search_to_player(browser: Browser) -> None:
    page = open_page(browser)
    go(page, "/")
    check("без истории блока «Продолжить просмотр» нет", page.get_by_text("Продолжить просмотр").count() == 0)
    box = page.get_by_role("combobox", name="Поиск аниме")
    box.fill("  ФРИРЕН ")
    first = page.get_by_role("option").first
    check("поиск находит по русскому названию без учёта регистра", "Фрирен" in first.inner_text())
    box.fill("frieren")
    check("поиск находит по английскому названию", "Фрирен" in page.get_by_role("option").first.inner_text())
    box.press("ArrowDown")
    box.press("Enter")
    page.wait_for_url("**/anime/frieren")
    check("Enter открывает выбранный результат", page.locator("h1.detail__title").inner_text().startswith("Провожающая"))
    check("активный раздел — «Каталог»", page.locator(".header__link[aria-current=page]").inner_text() == "Каталог")
    page.get_by_role("link", name="Смотреть с начала").click()
    page.wait_for_url("**/watch/frieren/s1e01")
    page.wait_for_selector(".eplist__item")
    check("заголовок вкладки для плеера", page.title() == "Провожающая в последний путь Фрирен, серия 1 — Anikai", page.title())
    page.locator(".eplist__item").nth(1).click()
    page.wait_for_url("**/watch/frieren/s1e02")
    page.wait_for_selector(".eplist__item[aria-current=true]")
    check("переключение на существующую серию", page.locator(".eplist__item[aria-current=true] .eplist__name").inner_text() == "Серия 2")
    finish(page)


def collection_flow(browser: Browser) -> None:
    page = open_page(browser)
    go(page, "/catalog?q=дандадан")
    card = page.locator(".poster-card").first
    card.hover()
    page.get_by_role("button", name="Добавить в коллекцию: Дандадан").click()
    check("после добавления остаёмся в каталоге", "/catalog" in page.url)
    go(page, "/collection")
    check("тайтл в «В планах»", page.get_by_role("tab", name=re.compile("В планах")).get_attribute("aria-selected") == "true")
    page.get_by_role("button", name="Действия: Дандадан").click()
    page.get_by_role("menuitemradio", name="Смотрю").click()
    check("счётчик «Смотрю» = 1", "1" in page.get_by_role("tab", name=re.compile("^Смотрю")).inner_text())

    page.get_by_role("button", name="Создать список").first.click()
    dialog = page.locator("dialog[open]")
    dialog.get_by_role("button", name="Создать список").click()
    check("пустое название списка не принимается", dialog.get_by_role("alert").count() == 1)
    dialog.get_by_label("Название").fill("На выходные")
    dialog.get_by_role("button", name="Создать список").click()
    page.wait_for_url("**/collection/list/*")
    list_url = page.url
    page.get_by_role("button", name="Добавить аниме").first.click()
    page.locator("dialog[open]").get_by_label("Поиск по каталогу").fill("дандадан")
    page.locator("dialog[open] .pick-list__item").first.click()
    page.locator("dialog[open]").get_by_role("button", name="Готово").click()
    check("аниме появилось в списке", page.locator(".poster-card__title").first.inner_text() == "Дандадан")

    page.reload()
    page.wait_for_load_state("networkidle")
    check("список пережил обновление страницы", page.locator(".poster-card__title").first.inner_text() == "Дандадан")
    data = user_data(page)
    check("статус сохранён", data["collection"]["dandadan"]["status"] == "watching")
    check("список сохранён", data["lists"][0]["title"] == "На выходные" and data["lists"][0]["animeIds"] == ["dandadan"])

    # A second tab of the same browser picks the change up without a reload.
    other = page.context.new_page()
    other.goto(BASE + "/collection")
    other.wait_for_load_state("networkidle")
    go(page, "/anime/frieren")
    page.get_by_role("button", name="В коллекцию").click()
    other.wait_for_timeout(700)
    check("вторая вкладка получила изменение", "1" in other.get_by_role("tab", name=re.compile("В планах")).inner_text())

    go(page, list_url.replace(BASE, ""))
    page.get_by_role("button", name="Удалить").click()
    page.locator("dialog[open]").get_by_role("button", name="Удалить список").click()
    page.wait_for_url("**/collection")
    check("список удалён после подтверждения", user_data(page)["lists"] == [])
    finish(page)


def catalog_filters(browser: Browser) -> None:
    page = open_page(browser)
    go(page, "/catalog")
    found = page.locator(".catalog__found")

    def total() -> int:
        m = re.search(r"(\d+) аниме", found.inner_text())
        return int(m.group(1)) if m else 0

    everything = total()
    check("счётчик показывает фактический размер каталога", everything == 35, str(everything))
    check("на странице не больше 20 карточек", page.locator(".poster-card").count() == 20)

    page.get_by_label("Экшен", exact=True).check()
    action = total()
    page.get_by_label("Фэнтези", exact=True).check()
    both = total()
    check("второй жанр сужает выборку", 0 < both < action < everything, f"{everything}/{action}/{both}")
    check("фильтры записаны в URL", "genre=" in page.url and "page=" not in page.url, page.url)
    check("число карточек равно счётчику", page.locator(".poster-card").count() == min(both, 20))

    page.get_by_role("combobox", name="Сортировка").select_option("title")
    titles = page.locator(".poster-card__title").all_inner_texts()
    check("сортировка по названию", titles == page.evaluate("t => [...t].sort((a, b) => a.localeCompare(b, 'ru'))", titles), str(titles[:3]))

    page.get_by_role("button", name=re.compile("Все жанры")).click()
    page.get_by_label("Спорт", exact=True).check()
    check("несовместимые фильтры дают пустое состояние", page.locator(".empty").is_visible() and page.locator(".poster-card").count() == 0)
    page.get_by_role("button", name="Сбросить поиск и фильтры").click()
    check("сброс возвращает весь каталог", total() == everything)

    page.get_by_role("button", name="Страница 2").click()
    check("пагинация: вторая страница в URL", "page=2" in page.url)
    check("на второй странице остаток", page.locator(".poster-card").count() == everything - 20)
    page.get_by_label("Экшен", exact=True).check()
    check("смена фильтра возвращает на первую страницу", "page=" not in page.url, page.url)
    page.go_back()
    page.wait_for_timeout(300)
    check("«назад» восстанавливает страницу 2", "page=2" in page.url and page.locator(".pagination [aria-current=page]").inner_text() == "2", page.url)

    go(page, "/catalog")
    search = page.get_by_role("searchbox", name="Поиск по каталогу")
    search.click()
    page.keyboard.type("Дандадан", delay=0)
    check("быстрый ввод в поиск не теряет символы", search.input_value() == "Дандадан" and total() == 1, search.input_value())
    check("запрос записан в URL", "q=" in page.url)

    go(page, "/catalog?q=zzzz")
    check("пустой результат поиска", "ничего не найдено" in found.inner_text().lower())
    page.get_by_role("button", name="Фильмы").click()
    check("быстрая вкладка «Фильмы» отмечает формат", page.get_by_label("Фильм", exact=True).is_checked())
    check("нет горизонтального переполнения", no_overflow(page))
    finish(page)


def playback(browser: Browser) -> None:
    page = open_page(browser)
    go(page, "/watch/frieren/s1e01")
    check("источник серии подписан", page.get_by_text("Серия воспроизводится в плеере Anikai.", exact=False).is_visible())
    start_playback(page)
    check("видео реально воспроизводится", video(page, "v.currentTime > 0 && !v.paused && v.videoWidth > 0"))
    check("проигрывается полная серия", video(page, "v.duration") > 1400, str(video(page, "v.duration")))

    page.locator(".player__row").get_by_role("button", name="Пауза").click()
    check("пауза", video(page, "v.paused"))

    set_range(page, ".player__seek", 20)
    check("перемотка по шкале", abs(video(page, "v.currentTime") - 20) < 0.5, str(video(page, "v.currentTime")))
    check("счётчик времени связан с видео", page.locator(".player__time").inner_text().startswith("0:20"))
    page.locator(".player__row").get_by_role("button", name="Вперёд на 10 секунд").click()
    check("+10 секунд", abs(video(page, "v.currentTime") - 30) < 0.5)
    page.locator(".player__row").get_by_role("button", name="Назад на 10 секунд").click()
    set_range(page, ".player__seek", 2)
    page.locator(".player__row").get_by_role("button", name="Назад на 10 секунд").click()
    check("перемотка назад не уходит ниже нуля", video(page, "v.currentTime") == 0)

    set_range(page, ".player__vol", 0.3)
    check("громкость", abs(video(page, "v.volume") - 0.3) < 0.01)
    page.get_by_role("button", name="Выключить звук").click()
    check("mute", video(page, "v.muted"))
    page.get_by_role("button", name="Включить звук").click()

    check("без дорожки субтитров переключатель скрыт", page.get_by_role("button", name=re.compile("Включить субтитры")).count() == 0)

    before = video(page, "v.currentTime")
    page.get_by_role("button", name="Настройки воспроизведения").click()
    page.get_by_role("menuitemradio", name="720p", exact=True).click()
    page.wait_for_function("JSON.parse(localStorage.getItem('anikai:user:v1')).preferences.preferredQuality === 720")
    check("смена качества сохраняет позицию", abs(video(page, "v.currentTime") - before) < 1.5)
    page.get_by_role("button", name="Настройки воспроизведения").click()
    page.get_by_role("menuitemradio", name="1.5×").click()
    check("скорость", video(page, "v.playbackRate") == 1.5)

    # Keyboard shortcuts with focus on the page, not on a control.
    page.evaluate("document.activeElement.blur()")
    set_range(page, ".player__seek", 10)
    page.evaluate("document.activeElement.blur()")
    page.keyboard.press("l")
    check("клавиша L: +10 с", abs(video(page, "v.currentTime") - 20) < 0.6, str(video(page, "v.currentTime")))
    page.keyboard.press("k")
    page.wait_for_function("!document.querySelector('video').paused")
    page.keyboard.press("Space")
    page.wait_for_function("document.querySelector('video').paused")
    check("клавиши K и пробел", True)
    page.keyboard.press("m")
    check("клавиша M", video(page, "v.muted"))
    page.get_by_label("Новая заметка").click()
    page.keyboard.type("k m ")
    check("в поле ввода горячие клавиши не срабатывают", video(page, "v.paused && v.muted"))

    page.get_by_role("button", name="Во весь экран").click()
    page.wait_for_timeout(400)
    check("полноэкранный режим", page.evaluate("document.fullscreenElement?.classList.contains('player') === true"))
    page.get_by_role("button", name="Выйти из полноэкранного режима").click()
    pip = page.evaluate("document.pictureInPictureEnabled")
    check("мини-плеер: кнопка есть только при поддержке", (page.get_by_role("button", name="Мини-плеер").count() > 0) == bool(pip), f"pip={pip}")
    page.get_by_role("button", name="Режим кино").click()
    check("режим кино меняет компоновку", page.locator(".watch.is-theater").count() == 1)
    ratio = page.evaluate("(() => { const r = document.querySelector('.player').getBoundingClientRect(); return r.width / r.height })()")
    check("в режиме кино кадр остаётся 16:9", abs(ratio - 16 / 9) < 0.02, str(ratio))
    finish(page)


def progress_resume(browser: Browser) -> None:
    page = open_page(browser)
    go(page, "/watch/frieren/s1e03")
    start_playback(page)
    set_range(page, ".player__seek", 18)
    page.wait_for_timeout(1500)
    page.locator(".player__row").get_by_role("button", name="Пауза").click()
    saved = user_data(page)["progress"]["frieren/s1e03"]
    check("прогресс записан на паузе", 17 < saved["position"] < 22 and not saved["completed"], str(saved))
    check("начатое аниме попало в «Смотрю»", user_data(page)["collection"]["frieren"]["status"] == "watching")

    page.reload()
    page.wait_for_function("document.querySelector('video')?.readyState >= 1 && document.querySelector('video').currentTime > 1")
    check("после перезагрузки продолжаем с сохранённого места", abs(video(page, "v.currentTime") - saved["position"]) < 2.5, str(video(page, "v.currentTime")))
    check("подсказка «Продолжаем с…»", page.get_by_text("Продолжаем с").is_visible())
    check("автозапуска со звуком нет", video(page, "v.paused"))

    go(page, "/")
    check("на главной появился «Продолжить просмотр»", page.get_by_role("heading", name="Продолжить просмотр").is_visible())
    check("карточка ведёт на ту же серию", page.locator(".continue-card__link").first.get_attribute("href") == "/watch/frieren/s1e03")

    # A position inside the last seconds starts the episode over instead of resuming at the very end.
    page.evaluate(
        f"""() => {{
            const d = JSON.parse(localStorage.getItem('{STORAGE_KEY}'));
            d.progress['frieren/s1e03'].position = 51; d.progress['frieren/s1e03'].duration = 52;
            localStorage.setItem('{STORAGE_KEY}', JSON.stringify(d));
        }}"""
    )
    go(page, "/watch/frieren/s1e03")
    page.wait_for_function("document.querySelector('video')?.readyState >= 1")
    check("остановка в последних секундах не возобновляется с конца", video(page, "v.currentTime") < 1)

    # Dragging past the threshold is not "watched"; playing through the end is.
    go(page, "/watch/frieren/s1e04")
    start_playback(page)
    set_range(page, ".player__seek", video(page, "v.duration") * 0.95)
    page.wait_for_timeout(900)
    page.keyboard.press("k")
    page.wait_for_timeout(400)
    entry = user_data(page)["progress"].get("frieren/s1e04")
    check("перемотка за порог не отмечает серию просмотренной", entry is not None and entry["completed"] is False, str(entry))
    finish(page)


def notes(browser: Browser) -> None:
    page = open_page(browser)
    go(page, "/watch/frieren/s1e01")
    page.wait_for_function("document.querySelector('video')?.readyState >= 1")
    set_range(page, ".player__seek", 15)
    field = page.get_by_label("Новая заметка")
    field.click()
    field.fill("Первая заметка <b>не html</b>")
    page.get_by_role("button", name="Добавить заметку").click()
    item = page.locator(".notes__item").first
    check("заметка добавлена с таймкодом", item.locator(".notes__time").inner_text() == "0:15")
    check("текст выводится как текст, без HTML", item.locator("b").count() == 0 and "<b>" in item.locator(".notes__text").inner_text())

    set_range(page, ".player__seek", 40)
    page.get_by_role("button", name="Перейти к 0:15").click()
    check("таймкод перематывает видео", abs(video(page, "v.currentTime") - 15) < 0.5)

    page.get_by_role("button", name="Изменить заметку на 0:15").click()
    page.get_by_label("Текст заметки").fill("Исправленная заметка")
    page.get_by_role("button", name="Сохранить").click()
    check("заметка изменена", item.locator(".notes__text").inner_text() == "Исправленная заметка")

    page.reload()
    page.wait_for_load_state("networkidle")
    check("заметка пережила обновление", page.locator(".notes__text").first.inner_text() == "Исправленная заметка")
    go(page, "/anime/frieren?tab=notes")
    link = page.locator("a.notes__time").first
    check("заметка видна на странице аниме со ссылкой на момент", link.get_attribute("href") == "/watch/frieren/s1e01?t=15")
    link.click()
    page.wait_for_function("document.querySelector('video')?.readyState >= 1")
    check("ссылка открывает серию на таймкоде", abs(video(page, "v.currentTime") - 15) < 1)

    page.get_by_role("button", name="Удалить заметку на 0:15").click()
    check("заметка удалена", page.locator(".notes__item").count() == 0)
    page.get_by_role("button", name="Вернуть").click()
    check("удаление можно отменить", page.locator(".notes__item").count() == 1)
    finish(page)


def profile_settings(browser: Browser) -> None:
    page = open_page(browser)
    go(page, "/profile")
    check("метрики считаются из данных", page.locator(".profile__stat dd").all_inner_texts() == ["0", "0", "0", "0"])
    page.get_by_role("button", name="Редактировать профиль").click()
    dialog = page.locator("dialog[open]")
    dialog.get_by_label("Имя").fill("")
    dialog.get_by_role("button", name="Сохранить профиль").click()
    check("пустое имя не принимается", dialog.get_by_role("alert").count() == 1)
    dialog.get_by_label("Имя").fill("Аня Тестова")
    dialog.get_by_label("О себе").fill("Смотрю по вечерам")
    dialog.locator("label:has(img[alt='Аня'])").click()
    dialog.get_by_role("button", name="Сохранить профиль").click()
    check("имя обновилось", page.locator("h1").inner_text() == "Аня Тестова")

    go(page, "/settings")
    switch = page.get_by_role("switch", name="Автопереход к следующей серии")
    switch.click()
    check("переключатель выключен", switch.get_attribute("aria-checked") == "false")
    page.get_by_role("link", name="Внешний вид").click()
    page.get_by_text("Компактные", exact=True).click()
    check("плотность применена", page.evaluate("document.documentElement.dataset.density") == "compact")
    page.get_by_role("combobox", name="Часовой пояс истории").select_option("Asia/Vladivostok")

    page.reload()
    page.wait_for_load_state("networkidle")
    data = user_data(page)
    check("профиль пережил обновление", data["profile"]["name"] == "Аня Тестова" and data["profile"]["avatar"] == {"kind": "preset", "id": "anya"})
    check(
        "настройки пережили обновление",
        data["preferences"]["autoNext"] is False and data["preferences"]["density"] == "compact" and data["preferences"]["timeZone"] == "Asia/Vladivostok",
    )
    check("аватар в шапке обновился", "anya" in (page.locator(".header__profile img").get_attribute("src") or ""))
    go(page, "/settings/nope")
    check("неизвестный раздел настроек ведёт на первый", page.url.endswith("/settings"))
    finish(page)


def backup(browser: Browser) -> None:
    page = open_page(browser, accept_downloads=True)
    go(page, "/settings/data")
    numbers = page.locator(".settings__summary dd")
    page.get_by_role("button", name="Загрузить пример").click()
    filled = numbers.all_inner_texts()
    check("пример коллекции загружен по явному действию", int(filled[0]) > 0 and int(filled[2]) == 2, str(filled))
    before = user_data(page)

    with page.expect_download() as info:
        page.get_by_role("button", name="Экспортировать").click()
    download = info.value
    check("имя файла резервной копии", re.fullmatch(r"anikai-backup-\d{4}-\d{2}-\d{2}\.json", download.suggested_filename) is not None, download.suggested_filename)
    tmp = Path(tempfile.mkdtemp())
    good = tmp / download.suggested_filename
    download.save_as(good)
    exported = json.loads(good.read_text(encoding="utf-8"))
    check("в копии есть версия схемы и данные", exported["app"] == "anikai" and exported["schemaVersion"] == 1 and exported["data"]["collection"] == before["collection"])

    page.get_by_role("button", name="Сбросить данные").click()
    page.locator("dialog[open]").get_by_role("button", name="Отмена").click()
    check("отмена сброса ничего не меняет", numbers.all_inner_texts() == filled)
    page.get_by_role("button", name="Сбросить данные").click()
    page.locator("dialog[open]").get_by_role("button", name="Сбросить").click()
    check("сброс после подтверждения", numbers.all_inner_texts() == ["0", "0", "0", "0"])

    bad = tmp / "bad.json"
    bad.write_text("{ это не json", encoding="utf-8")
    foreign = tmp / "foreign.json"
    foreign.write_text(json.dumps({"app": "other", "schemaVersion": 1, "data": {}}), encoding="utf-8")
    wrong = tmp / "wrong.json"
    wrong.write_text(json.dumps({"app": "anikai", "schemaVersion": 1, "data": {"schemaVersion": 1, "collection": [1, 2]}}), encoding="utf-8")
    page.get_by_role("button", name="Загрузить пример").click()
    for name, file in (("битый JSON", bad), ("чужой файл", foreign), ("неверная структура", wrong)):
        page.locator("input[type=file]").set_input_files(str(file))
        page.wait_for_timeout(200)
        rejected = page.get_by_role("alert").filter(has_text="Импорт не выполнен").count() == 1
        check(f"некорректный импорт отклонён: {name}", rejected and numbers.all_inner_texts() == filled, str(numbers.all_inner_texts()))

    page.get_by_role("button", name="Сбросить данные").click()
    page.locator("dialog[open]").get_by_role("button", name="Сбросить").click()
    page.locator("input[type=file]").set_input_files(str(good))
    page.locator("dialog[open]").get_by_role("button", name="Добавить к моим данным").click()
    after = user_data(page)
    check("импорт восстановил коллекцию", after["collection"] == before["collection"])
    check("импорт восстановил прогресс, списки и заметки", after["progress"] == before["progress"] and after["lists"] == before["lists"] and after["notes"] == before["notes"])

    page.locator("input[type=file]").set_input_files(str(good))
    dialog = page.locator("dialog[open]")
    dialog.get_by_text("Заменить всё").click()
    dialog.get_by_role("button", name="Заменить данные").click()
    page.locator("dialog[open]").get_by_role("button", name="Заменить", exact=True).click()
    check("замена после подтверждения", user_data(page) == before)
    go(page, "/collection")
    check("данные сразу видны на других страницах", page.locator(".collection-card").count() > 0)
    finish(page)


def edge_states(browser: Browser) -> None:
    page = open_page(browser)
    go(page, "/watch/dandadan/s1e01")
    check("серия без источника: понятное состояние", page.get_by_text("Видео для этой серии пока не добавлено").is_visible() and page.locator("video").count() == 0)
    for path, text in (
        ("/anime/nope", "Такого аниме нет в каталоге"),
        ("/watch/frieren/s9e99", "Такой серии нет"),
        ("/watch/nope/s1e01", "Такого аниме нет в каталоге"),
        ("/collection/list/nope", "Такого списка нет"),
        ("/totally/unknown", "Такой страницы нет"),
    ):
        go(page, path)
        check(f"404: {path}", page.get_by_role("heading", name=text).count() == 1)

    go(page, "/anime/frieren?tab=about")
    page.reload()
    page.wait_for_load_state("networkidle")
    check("прямое открытие и обновление вложенного маршрута", page.get_by_role("tab", name="Об аниме").get_attribute("aria-selected") == "true")
    check("описание и источник на вкладке «Об аниме»", page.locator(".about__text p").count() > 1 and page.locator(".about__source").get_by_role("link", name="Shikimori").count() == 1)
    facts = page.locator(".about__facts").inner_text()
    check("оценки показаны с источниками", "Shikimori" in facts and "AniList" in facts and "из 10" in facts and "из 100" in facts)
    check("оценка на карточке совпадает с оценкой Shikimori", page.locator(".detail__rating").inner_text().replace("\n", " ").startswith("Оценка 9.") or "Shikimori" in page.locator(".detail__rating").inner_text())
    page.errors.clear()  # type: ignore[attr-defined]

    page.context.route("**/api/video/**", lambda route: route.abort())
    go(page, "/watch/frieren/s1e01")
    page.wait_for_selector(".player__message")
    check("ошибка видео показана с кнопкой повтора", page.get_by_text("Видео не загрузилось").is_visible())
    page.context.unroute("**/api/video/**")
    page.get_by_role("button", name="Повторить").click()
    page.wait_for_function("document.querySelector('video').readyState >= 1")
    check("повторная загрузка восстанавливает плеер", page.locator(".player__message").count() == 0)

    page.context.route("**/media/posters/**", lambda route: route.abort())
    go(page, "/catalog")
    page.wait_for_timeout(500)
    check("битые картинки заменены заглушкой", page.locator(".img__fallback").count() >= 20)
    heights = page.evaluate("[...document.querySelectorAll('.poster-card__art')].map(e => Math.round(e.getBoundingClientRect().height))")
    check("сетка не ломается без картинок", len(set(heights)) == 1 and no_overflow(page), str(set(heights)))
    page.context.unroute("**/media/posters/**")
    page.errors.clear()  # type: ignore[attr-defined]
    finish(page)


def dialogs_keyboard(browser: Browser) -> None:
    page = open_page(browser)
    go(page, "/collection")
    trigger = page.get_by_role("button", name="Создать список").first
    trigger.focus()
    page.keyboard.press("Enter")
    check("диалог открыт с клавиатуры, фокус внутри", page.evaluate("document.activeElement.closest('dialog[open]') !== null"))
    for _ in range(9):
        page.keyboard.press("Tab")
    check("фокус не покидает диалог", page.evaluate("document.activeElement.closest('dialog[open]') !== null"))
    check("фон заблокирован", page.evaluate("document.documentElement.classList.contains('is-locked')"))
    page.keyboard.press("Escape")
    check("Escape закрывает диалог", page.locator("dialog[open]").count() == 0)
    check("фокус вернулся на кнопку", page.evaluate("document.activeElement.textContent.includes('Создать список')"))
    check("прокрутка разблокирована", not page.evaluate("document.documentElement.classList.contains('is-locked')"))

    page.get_by_role("button", name="Загрузить пример коллекции").click()
    menu_button = page.get_by_role("button", name=re.compile("^Действия: ")).first
    menu_button.focus()
    page.keyboard.press("Enter")
    check("меню открыто, фокус на первом пункте", page.evaluate("document.activeElement.getAttribute('role')") == "menuitemradio")
    page.keyboard.press("ArrowDown")
    check("стрелки двигают фокус в меню", page.evaluate("document.activeElement.textContent") == "В планах")
    page.keyboard.press("Escape")
    check("Escape закрывает меню и возвращает фокус", page.locator("[role=menu]").count() == 0 and page.evaluate("document.activeElement.getAttribute('aria-haspopup')") == "menu")

    go(page, "/")
    page.keyboard.press("Tab")
    check("первый Tab — ссылка «К содержимому»", page.evaluate("document.activeElement.textContent") == "К содержимому")
    finish(page)

    phone = open_page(browser, viewport=PHONE, has_touch=True, is_mobile=True)
    go(phone, "/catalog")
    phone.get_by_role("button", name="Фильтры").click()
    sheet = phone.locator("dialog[open]")
    phone.wait_for_timeout(450)  # let the sheet finish sliding in
    box = sheet.bounding_box()
    check("фильтры на телефоне — нижний лист", box is not None and abs(box["y"] + box["height"] - PHONE["height"]) < 2, str(box))
    apply = sheet.get_by_role("button", name=re.compile(r"Показать \d+ аниме"))
    all_label = apply.inner_text()
    sheet.get_by_label("Экшен", exact=True).check()
    check("кнопка листа показывает число результатов", apply.inner_text() != all_label, apply.inner_text())
    check("в листе есть «Сбросить»", sheet.get_by_role("button", name="Сбросить").is_enabled())
    apply.click()
    check("лист закрыт, фильтр применён", phone.locator("dialog[open]").count() == 0 and "genre=" in phone.url)

    phone.get_by_role("button", name="Поиск").click()
    check("поиск на телефоне: поле в фокусе", phone.evaluate("document.activeElement.getAttribute('role')") == "combobox")
    phone.keyboard.type("ван")
    phone.keyboard.press("ArrowDown")
    phone.keyboard.press("Enter")
    phone.wait_for_url("**/anime/one-piece")
    check("поиск на телефоне открывает аниме", phone.locator("dialog[open]").count() == 0)
    check("нижняя навигация из четырёх пунктов", phone.locator(".bottom-nav__item").count() == 4 and phone.locator(".bottom-nav").is_visible())
    check("активный пункт — «Каталог»", phone.locator(".bottom-nav__item[aria-current=page]").inner_text() == "Каталог")
    finish(phone)


def autonext(browser: Browser) -> None:
    page = open_page(browser)
    go(page, "/watch/bocchi-the-rock/s1e11")
    start_playback(page)
    set_range(page, ".player__seek", video(page, "v.duration") - 1.5)
    page.wait_for_selector(".player__end")
    check("после конца серии идёт обратный отсчёт", "Следующая серия через" in page.locator(".player__end").inner_text())
    page.wait_for_url("**/watch/bocchi-the-rock/s1e12", timeout=15000)
    check("автопереход открыл следующую серию", True)
    progress = user_data(page)["progress"]
    check("досмотренная серия отмечена", progress["bocchi-the-rock/s1e11"]["completed"] is True)

    page.wait_for_function("document.querySelector('video')?.readyState >= 1")
    if video(page, "v.paused"):
        page.locator(".player__big").click()
    set_range(page, ".player__seek", video(page, "v.duration") - 1.5)
    page.wait_for_selector(".player__end")
    check("на последней серии нет зацикливания", "Это последняя серия" in page.locator(".player__end").inner_text())
    check("кнопка «Следующая» выключена на границе", page.get_by_role("button", name="Следующая").is_disabled())
    page.wait_for_timeout(1500)
    check("остаёмся на последней серии", page.url.endswith("/s1e12"))

    go(page, "/settings")
    page.get_by_role("switch", name="Автопереход к следующей серии").click()
    go(page, "/watch/bocchi-the-rock/s1e01")
    start_playback(page)
    set_range(page, ".player__seek", video(page, "v.duration") - 1.5)
    page.wait_for_selector(".player__end")
    check("с выключенным автопереходом отсчёта нет", "Серия закончилась" in page.locator(".player__end").inner_text())
    check("первая серия: «Предыдущая» выключена", page.get_by_role("button", name="Предыдущая").is_disabled())

    go(page, "/collection")
    page.get_by_role("button", name=re.compile("^Действия: ")).first.click()
    page.get_by_role("menuitemradio", name="Просмотрено").click()
    data = user_data(page)
    done = [k for k, v in data["progress"].items() if k.startswith("bocchi-the-rock/") and v["completed"]]
    check("«Просмотрено» отмечает все серии", len(done) == 12, str(len(done)))
    position = data["progress"]["bocchi-the-rock/s1e01"]
    page.get_by_role("tab", name=re.compile("^Просмотрено")).click()
    page.get_by_role("button", name=re.compile("^Действия: ")).first.click()
    page.get_by_role("menuitemradio", name="Смотрю").click()
    check("смена статуса обратно не уничтожает историю", user_data(page)["progress"]["bocchi-the-rock/s1e01"] == position)
    finish(page)


def responsive(browser: Browser) -> None:
    routes = ["/", "/catalog", "/collection", "/anime/frieren", "/watch/frieren/s1e06", "/profile", "/profile/history", "/settings", "/settings/data"]
    page = open_page(browser)
    go(page, "/collection")
    page.get_by_role("button", name="Загрузить пример коллекции").click()
    # A title long enough to stress every card it appears in.
    go(page, "/collection")
    page.get_by_role("button", name="Создать список").first.click()
    page.locator("dialog[open]").get_by_label("Название").fill("Оченьдлинноеназваниеспискабезпробеловкотороенедолжноломатьвёрстку и ещё слова")
    page.locator("dialog[open]").get_by_role("button", name="Создать список").click()
    page.wait_for_url("**/collection/list/*")
    routes.append(page.url.replace(BASE, ""))

    for width in (360, 390, 430, 768, 1024, 1280, 1440, 1920):
        page.set_viewport_size({"width": width, "height": 900})
        bad = []
        for path in routes:
            go(page, path)
            if not no_overflow(page):
                bad.append(path)
        check(f"{width}px: нет горизонтального переполнения", not bad, ", ".join(bad))

    page.set_viewport_size({"width": 1920, "height": 1000})
    go(page, "/")
    width = page.evaluate("document.querySelector('.hero').getBoundingClientRect().width")
    check("на 1920px контент ограничен по ширине", width <= 1440, str(width))

    page.set_viewport_size({"width": 844, "height": 390})
    go(page, "/watch/frieren/s1e06")
    check("телефон в альбомной ориентации: нижняя навигация убрана на плеере", not page.locator(".bottom-nav").is_visible())
    box = page.locator(".player").bounding_box()
    check("альбомная ориентация: плеер помещается по высоте", box is not None and box["height"] <= 390, str(box))
    check("альбомная ориентация: нет переполнения", no_overflow(page))

    # 200% zoom is equivalent to halving the layout viewport.
    page.set_viewport_size({"width": 640, "height": 450})
    bad = [p for p in routes if (go(page, p), not no_overflow(page))[1]]
    check("масштаб 200% (1280→640): нет переполнения", not bad, ", ".join(bad))

    page.set_viewport_size(PHONE)
    go(page, "/collection")
    nav = page.locator(".bottom-nav").bounding_box()
    last = page.evaluate("document.querySelector('main').getBoundingClientRect().bottom + window.scrollY")
    total = page.evaluate("document.documentElement.scrollHeight")
    check("нижняя навигация не перекрывает конец страницы", nav is not None and total - last < 1 and page.evaluate("parseFloat(getComputedStyle(document.querySelector('main')).paddingBottom)") >= nav["height"])
    small = page.evaluate(
        """[...document.querySelectorAll('a, button')].filter(e => {
            const r = e.getBoundingClientRect();
            // A pseudo-element that enlarges the hit area (stretched link, padded icon) counts as size.
            const padded = ['::before', '::after'].some(p => { const s = getComputedStyle(e, p); return s.content !== 'none' && s.position === 'absolute' });
            return r.width > 0 && !padded && (r.height < 32 || r.width < 32) && !e.closest('.meta, .detail__crumbs, p');
        }).map(e => (e.getAttribute('aria-label') || e.textContent || '').trim().slice(0, 30))"""
    )
    check("касаемые элементы не мельче 32px", not small, str(small[:5]))
    finish(page)


def storage_failures(browser: Browser) -> None:
    page = open_page(browser)
    page.context.add_init_script(
        f"if (!sessionStorage.getItem('seeded')) {{ sessionStorage.setItem('seeded', '1'); localStorage.setItem('{STORAGE_KEY}', '{{broken json'); }}"
    )
    go(page, "/")
    check("повреждённые данные не дают белый экран", page.locator(".hero").is_visible())
    check("о восстановлении сообщено", "повреждены" in page.get_by_role("alert").first.inner_text())
    check("повреждённая копия сохранена отдельно", page.evaluate(f"localStorage.getItem('{STORAGE_KEY}:corrupt')") == "{broken json")
    page.errors.clear()  # type: ignore[attr-defined]
    finish(page)

    page = open_page(browser)
    page.context.add_init_script("Storage.prototype.setItem = function () { throw new DOMException('denied', 'SecurityError') }")
    go(page, "/anime/frieren")
    page.get_by_role("button", name="В коллекцию").click()
    page.wait_for_timeout(500)
    check("без хранилища приложение работает в памяти", page.get_by_role("button", name="Изменить статус в коллекции").count() == 1)
    check("о невозможности сохранить сообщено", "не даёт сохранять" in page.get_by_role("alert").first.inner_text())
    page.get_by_role("link", name="Моя коллекция").click()
    page.wait_for_selector(".collection__grid, .empty")
    check("данные живут между страницами до закрытия вкладки", page.locator(".collection-card").count() == 1)
    page.errors.clear()  # type: ignore[attr-defined]
    finish(page)

    page = open_page(browser, reduced_motion="reduce")
    go(page, "/")
    duration = page.evaluate("getComputedStyle(document.querySelector('.btn')).transitionDuration")
    check("prefers-reduced-motion отключает переходы", all(float(d.replace("s", "")) < 0.001 for d in duration.split(", ")), duration)
    finish(page)

    page = open_page(browser)
    go(page, "/")
    html = page.content().lower()
    check("старого названия YORU нет", "yoru" not in html)
    check("название Anikai в заголовке и логотипе", "Anikai" in page.title() and page.locator(".logo__word").inner_text() == "anikai")
    check("favicon — SVG Anikai", page.locator("link[rel=icon]").get_attribute("href") == "/favicon.svg")
    finish(page)


# Stand-ins for the platforms' embed players. They speak the same postMessage protocol as the real
# ones, so the integration is tested without the network, adverts or anyone's actual videos.
RUTUBE_STUB = """<!doctype html><meta charset="utf-8"><body style="margin:0;background:#000;color:#fff;font:16px sans-serif">
<p id="s" style="padding:16px"></p><script>
var t = Number(new URLSearchParams(location.search).get('t') || 0), d = 600, playing = false;
function post(type, data) { parent.postMessage(JSON.stringify({ type: type, data: data || {} }), '*'); }
function show() { document.getElementById('s').textContent = 'rutube stub ' + location.pathname + ' t=' + t.toFixed(1); }
function tick() { post('player:currentTime', { time: t, duration: d }); show(); }
function finish() { t = d; playing = false; tick(); post('player:playComplete', {}); }
window.jump = function (to) { t = to; tick(); };
addEventListener('message', function (e) {
  var m; try { m = JSON.parse(e.data); } catch (_) { return; }
  if (m.type === 'player:play') { playing = true; post('player:changeState', { state: 'playing' }); }
  if (m.type === 'player:pause') { playing = false; post('player:changeState', { state: 'pause' }); }
  if (m.type === 'player:setCurrentTime') { t = m.data.time; tick(); }
});
setInterval(function () { if (!playing) return; t += 0.25; if (t >= d) finish(); else tick(); }, 250);
post('player:ready', {}); post('player:durationChange', { duration: d }); tick();
</script>"""

VK_STUB = """<!doctype html><meta charset="utf-8"><body style="margin:0;background:#000;color:#fff;font:16px sans-serif">
<p id="s" style="padding:16px"></p><script>
var t = 0, d = 300, playing = false;
function post(event) { parent.postMessage({ event: event, time: t, duration: d }, '*'); document.getElementById('s').textContent = 'vk stub t=' + t.toFixed(1); }
window.jump = function (to) { t = to; post('timeupdate'); };
addEventListener('message', function (e) {
  var m = e.data || {};
  if (m.method === 'init') post('inited');
  if (m.method === 'play') { playing = true; post('started'); }
  if (m.method === 'pause') { playing = false; post('paused'); }
  if (m.method === 'seek') { t = m.time; post('seeked'); }
});
setInterval(function () { if (!playing) return; t += 0.25; if (t >= d) { t = d; playing = false; post('ended'); } else post('timeupdate'); }, 250);
</script>"""

RUTUBE_A = "a" * 32
RUTUBE_B = "b" * 32


def embeds(browser: Browser) -> None:
    page = open_page(browser)
    page.context.route("https://rutube.ru/play/embed/**", lambda r: r.fulfill(body=RUTUBE_STUB, content_type="text/html"))
    page.context.route("https://vk.com/video_ext.php**", lambda r: r.fulfill(body=VK_STUB, content_type="text/html"))

    def frame():
        return page.frames[-1]

    def frame_time() -> float:
        return frame().evaluate("t")

    go(page, "/watch/jujutsu-kaisen/s3e01")
    check("источник каталога можно заменить своей ссылкой", page.locator(".watch__tools").get_by_role("button", name="Привязать видео").count() == 1)
    page.locator(".watch__tools").get_by_role("button", name="Привязать видео").click()
    dialog = page.locator("dialog[open]")
    links = dialog.get_by_label("Ссылки — по одной на строку")
    links.fill("https://example.com/video/123")
    dialog.get_by_role("button", name="Привязать видео").click()
    check("посторонняя ссылка отклонена", "Не распознаны строки: 1" in dialog.get_by_role("alert").inner_text())
    links.fill("javascript:alert(1)\nhttps://rutube.ru/video/private/" + RUTUBE_A + "/")
    check("опасные и приватные ссылки отклонены", "Не распознаны строки: 1, 2" in dialog.get_by_role("alert").inner_text())

    # Every link form that should be recognised.
    links.fill(
        "\n".join(
            [
                f"https://rutube.ru/video/{RUTUBE_A}/",
                f"rutube.ru/play/embed/{RUTUBE_B}",
                "https://vkvideo.ru/video-123_456",
                "https://vk.com/video-123_457?list=abc",
                "https://vk.com/video_ext.php?oid=-123&id=458&hash=0123456789abcdef",
                "https://vk.com/video?z=video-123_459%2Fpl_cat_trends",
            ]
        )
    )
    check("распознаны все формы ссылок Rutube и VK", "Распознано ссылок: 6" in dialog.locator(".link-preview").inner_text(), dialog.locator(".link-preview").inner_text())
    dialog.get_by_role("button", name=re.compile("^Привязать: 6")).click()
    data = user_data(page)
    keys = sorted(k for k in data["sources"] if k.startswith("jujutsu-kaisen/"))
    check("ссылки разложены по сериям по порядку", keys == [f"jujutsu-kaisen/s3e0{i}" for i in range(1, 7)], str(keys))
    check("хеш VK сохранён", data["sources"]["jujutsu-kaisen/s3e05"].get("hash") == "0123456789abcdef")

    iframe = page.locator("iframe.player__frame")
    check("серия открывается во встроенном плеере Rutube", iframe.get_attribute("src") == f"https://rutube.ru/play/embed/{RUTUBE_A}", iframe.get_attribute("src") or "")
    check("источник подписан", page.get_by_text("Видео с Rutube.").is_visible())
    check("в списке серий привязанные серии больше не «без видео»", "видео не добавлено" not in page.locator(".eplist__item").nth(1).inner_text())

    # Opening marks for the whole season.
    page.get_by_role("button", name="Отметить опенинг").click()
    dialog = page.locator("dialog[open]")
    dialog.get_by_label("Начало").fill("1:30")
    dialog.get_by_label("Конец").fill("0:10")
    dialog.get_by_role("button", name="Сохранить").click()
    check("конец раньше начала не принимается", "позже начала" in dialog.get_by_role("alert").inner_text())
    dialog.get_by_label("Начало").fill("0:10")
    dialog.get_by_label("Конец").fill("1:30")
    dialog.get_by_role("button", name="Сохранить").click()
    check("опенинг отмечен для сезона", "0:10–1:30 · весь сезон" in page.locator(".watch__opening").inner_text())

    page.evaluate("document.activeElement.blur()")
    page.keyboard.press("k")
    page.wait_for_function("document.querySelector('.player__opening') !== null", timeout=20000)
    check("кнопка пропуска появляется внутри опенинга", 10 <= frame_time() < 90, str(frame_time()))
    page.get_by_role("button", name="Пропустить опенинг").click()
    page.wait_for_timeout(400)
    check("пропуск перематывает плеер площадки к концу опенинга", 90 <= frame_time() < 93, str(frame_time()))
    check("после опенинга кнопки нет", page.get_by_role("button", name="Пропустить опенинг").count() == 0)

    page.keyboard.press("l")
    page.wait_for_timeout(300)
    check("клавиша L перематывает встроенный плеер", frame_time() >= 100, str(frame_time()))
    page.keyboard.press("k")
    page.wait_for_timeout(500)
    saved = user_data(page)["progress"].get("jujutsu-kaisen/s3e01")
    check("прогресс встроенного видео сохранён", saved is not None and saved["position"] >= 100 and saved["duration"] == 600 and not saved["completed"], str(saved))

    page.reload()
    page.wait_for_selector("iframe.player__frame")
    src = page.locator("iframe.player__frame").get_attribute("src") or ""
    check("после перезагрузки плеер стартует с сохранённой секунды", re.search(r"\?t=1\d\d$", src) is not None, src)

    # Note timecode drives the embedded player too.
    field = page.get_by_label("Новая заметка")
    field.click()
    field.fill("момент")
    page.get_by_role("button", name="Добавить заметку").click()
    stamp = page.locator(".notes__time").first.inner_text()
    frame().evaluate("window.jump(300)")
    page.locator(".notes__time").first.click()
    page.wait_for_timeout(300)
    check("таймкод заметки перематывает встроенный плеер", 100 <= frame_time() < 200, f"{stamp} -> {frame_time()}")

    # End of the video: completion and auto-advance into the next attached episode.
    page.evaluate("document.activeElement.blur()")
    page.keyboard.press("k")
    frame().evaluate("window.jump(598.5)")
    page.wait_for_selector(".player__end")
    check("после конца встроенного видео идёт отсчёт", "Следующая серия через" in page.locator(".player__end").inner_text())
    page.wait_for_url("**/watch/jujutsu-kaisen/s3e02", timeout=9000)
    check("серия отмечена просмотренной", user_data(page)["progress"]["jujutsu-kaisen/s3e01"]["completed"] is True)
    page.wait_for_selector("iframe.player__frame")
    check("следующая серия открылась со своим видео", (page.locator("iframe.player__frame").get_attribute("src") or "").endswith(RUTUBE_B))

    # VK Video.
    go(page, "/watch/jujutsu-kaisen/s3e03")
    src = page.locator("iframe.player__frame").get_attribute("src") or ""
    check("VK: адрес встраивания с js_api", src.startswith("https://vk.com/video_ext.php?") and "oid=-123" in src and "id=456" in src and "js_api=1" in src, src)
    check("VK: источник подписан", page.get_by_text("Видео с VK Видео.").is_visible())
    page.wait_for_timeout(1200)  # the player answers "inited" to our init
    page.evaluate("document.activeElement.blur()")
    page.keyboard.press("k")
    page.wait_for_function("document.querySelector('.player__opening') !== null", timeout=20000)
    page.get_by_role("button", name="Пропустить опенинг").click()
    page.wait_for_timeout(400)
    check("VK: пропуск опенинга по отметке сезона", 90 <= frame_time() < 93, str(frame_time()))
    page.keyboard.press("k")
    page.wait_for_timeout(500)
    saved = user_data(page)["progress"].get("jujutsu-kaisen/s3e03")
    check("VK: прогресс сохранён", saved is not None and saved["position"] >= 90 and saved["duration"] == 300, str(saved))
    go(page, "/watch/jujutsu-kaisen/s3e05")
    check("VK: хеш попадает в адрес встраивания", "hash=0123456789abcdef" in (page.locator("iframe.player__frame").get_attribute("src") or ""))

    # Detaching.
    page.get_by_role("button", name="Отвязать").click()
    page.wait_for_selector("video.player__video")
    check("после отвязки возвращается источник каталога", page.locator("video.player__video").is_visible() and page.locator("iframe.player__frame").count() == 0)
    page.get_by_role("button", name="Вернуть").click()
    check("отвязку можно отменить", page.locator("iframe.player__frame").count() == 1)

    go(page, "/settings/data")
    check("в настройках виден счётчик привязанных видео", "сейчас их 6" in page.locator(".settings__panel").inner_text())
    page.get_by_role("button", name="Отвязать все").click()
    page.locator("dialog[open]").get_by_role("button", name="Отвязать все").click()
    after = user_data(page)
    check("«Отвязать все» убирает ссылки, но не прогресс и отметки", after["sources"] == {} and "jujutsu-kaisen/s3e01" in after["progress"] and len(after["openings"]) == 1)

    # The same opening tools on a local file, plus the redesigned player chrome.
    go(page, "/watch/frieren/s1e01")
    check("заголовок внутри кадра", page.locator(".player__title").inner_text() == "Провожающая в последний путь Фрирен")
    page.wait_for_function("document.querySelector('video')?.readyState >= 1")
    set_range(page, ".player__seek", 5)
    page.get_by_role("button", name="Отметить опенинг").click()
    dialog = page.locator("dialog[open]")
    dialog.get_by_role("button", name="Взять текущий момент").first.click()
    check("«Взять текущий момент» подставляет время плеера", dialog.get_by_label("Начало").input_value() == "0:05")
    dialog.get_by_label("Конец").fill("0:15")
    dialog.get_by_text("Только эта серия").click()
    dialog.get_by_role("button", name="Сохранить").click()
    check("отрезок опенинга показан на шкале", page.locator(".player__segment").count() == 1)
    set_range(page, ".player__seek", 7)
    page.get_by_role("button", name="Пропустить опенинг").click()
    check("пропуск опенинга на локальном видео", abs(video(page, "v.currentTime") - 15) < 0.5, str(video(page, "v.currentTime")))
    go(page, "/watch/frieren/s1e02")
    page.wait_for_function("document.querySelector('video')?.readyState >= 1")
    set_range(page, ".player__seek", 7)
    check("отметка «только эта серия» не действует на другие", page.get_by_role("button", name="Пропустить опенинг").count() == 0)
    page.locator(".player__row").get_by_role("button", name="Следующая серия").click()
    page.wait_for_url("**/watch/frieren/s1e03")
    check("кнопка следующей серии в плеере", True)
    finish(page)


SCENARIOS = {
    "embeds": embeds,
    "search_to_player": search_to_player,
    "collection_flow": collection_flow,
    "catalog_filters": catalog_filters,
    "playback": playback,
    "progress_resume": progress_resume,
    "notes": notes,
    "profile_settings": profile_settings,
    "backup": backup,
    "edge_states": edge_states,
    "dialogs_keyboard": dialogs_keyboard,
    "autonext": autonext,
    "responsive": responsive,
    "storage_failures": storage_failures,
}


def main() -> int:
    global current
    names = sys.argv[1:] or list(SCENARIOS)
    unknown = [n for n in names if n not in SCENARIOS]
    if unknown:
        print(f"Unknown scenarios: {', '.join(unknown)}. Available: {', '.join(SCENARIOS)}")
        return 2
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True, args=["--autoplay-policy=no-user-gesture-required"],
                                    **({"executable_path": os.environ["ANIKAI_BROWSER_PATH"]} if os.environ.get("ANIKAI_BROWSER_PATH") else {}))
        for name in names:
            current = name
            print(f"\n{name}")
            try:
                SCENARIOS[name](browser)
            except Exception as error:  # a crash in one scenario must not hide the others
                check("сценарий выполнился до конца", False, f"{type(error).__name__}: {str(error)[:300]}")
                for context in browser.contexts:
                    context.close()
        browser.close()
    failed = [r for r in results if not r[1]]
    print(f"\n{len(results) - len(failed)} passed, {len(failed)} failed")
    for name, _, detail in failed:
        print(f"  FAIL {name}{'  -> ' + detail if detail else ''}")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")  # type: ignore[union-attr]
    sys.exit(main())
