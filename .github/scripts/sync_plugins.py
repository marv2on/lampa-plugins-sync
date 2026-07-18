#!/usr/bin/env python3
"""
Синхронизация Lampa-плагинов из внешних источников.

Главное правило: падение/недоступность/протухание ОДНОЙ ссылки
не должно ломать весь прогон и не должно портить уже скачанный
рабочий файл. Если скачать не удалось — просто пропускаем плагин
и переходим к следующему, оставляя старую версию на месте.
"""
import os
import sys
import json
import time
import hashlib
import urllib.request
import urllib.error
from datetime import datetime, timezone

PLUGINS = [
    ("navigatorAlex", "NewPhoneMenu.js",        "https://arst113.github.io/log/NewPhoneMenu.js"),
    ("navigatorAlex", "NewMenu.js",             "https://arst113.github.io/log/NewMenu.js"),
    ("apxubatop",     "tvbutton.js",            "https://apxubatop.github.io/lmpPlugs/tvbutton.js"),
    ("bazzzilius",    "gold_theme.js",          "https://bazzzilius.github.io/scripts/gold_theme.js"),
    ("BDVBurik",      "rezkacomment.js",        "https://bdvburik.github.io/rezkacomment.js"),
    ("BDVBurik",      "rightmouse.js",          "https://bdvburik.github.io/rightmouse.js"),
    ("BDVBurik",      "title.js",               "https://bdvburik.github.io/title.js"),
    ("Bohdan",        "keywords.js",            "https://bodya-elven.github.io/different/keywords.js"),
    ("bywolf88",      "interface_mod_new.js",   "https://bywolf88.github.io/lampa-plugins/interface_mod_new.js"),
    ("CheeZe",        "buttons.js",             "https://mylampa1.github.io/buttons.js"),
    ("CheeZe",        "source_sort.js",         "https://mylampa1.github.io/source_sort.js"),
    ("cub",           "iptv.js",                "https://cub.red/plugin/iptv"),
    ("cub",           "youtube-player.js",      "https://cub.red/plugin/youtube-player"),
    ("darkestclouds", "applecation.min.js",     "https://darkestclouds.github.io/plugins/applecation/applecation.min.js"),
    ("den41k",        "netflix_premium_style.js", "https://ourbeerdelivery.github.io/pluginlmp/netflix_premium_style.js"),
    ("hlushok",       "redirect.js",            "https://hlushok.github.io/lampa-plugin/redirect.js"),
    ("hlushok",       "applecation.js",         "http://lampaua.mooo.com/applecation.js"),
    ("hlushok",       "buttons.js",             "http://lampaua.mooo.com/buttons.js"),
    ("hlushok",       "likhtar.js",             "http://lampaua.mooo.com/likhtar.js"),
    ("hlushok",       "ymain.js",               "http://lampaua.mooo.com/ymain.js"),
    ("hlushok",       "ymain.js",               "http://lampaua.mooo.com/uacoments.js"),
    ("igo8748",       "dscinemawolf.js",        "https://igo8748.github.io/can-/dscinemawolf.js"),
    ("ipavlin98",     "season-fix.js",          "https://ipavlin98.github.io/lmp-plugins/season-fix.js"),
    ("ipavlin98",     "cardify.js",             "https://ipavlin98.github.io/lmp-plugins/cardify.js"),
    ("ipavlin98",     "logo.js",                "https://ipavlin98.github.io/lmp-plugins/logo.js"),
    ("ipavlin98",     "series-progress-fix.js", "https://ipavlin98.github.io/lmp-plugins/series-progress-fix.js"),
    ("ipavlin98",     "torr-styles.js",         "https://ipavlin98.github.io/lmp-plugins/torr-styles.js"),
    ("ipavlin98",     "ultimate-skip.js",       "https://ipavlin98.github.io/lmp-plugins/ultimate-skip.js"),
    ("ipavlin98",     "pip.js",                 "https://ipavlin98.github.io/lmp-plugins/pip.js"),
    ("levende",       "lampac-src-filter.js",   "https://levende.github.io/lampa-plugins/lampac-src-filter.js"),
    ("levende",       "lnum.js",                "https://levende.github.io/lampa-plugins/lnum.js"),
    ("lme",           "Nightingale.js",         "https://lampame.github.io/main/n.js"),
    ("lme",           "pubtorr.js",             "https://lampame.github.io/main/pubtorr.js"),
    ("lme",           "hikka.js",               "https://lampame.github.io/main/hikka.js"),
    ("lme",           "torrentmanager.js",      "https://lampame.github.io/main/torrentmanager.js"),
    ("lme",           "tsTracksProbe.js",       "https://lampame.github.io/main/tstracks.js"),
    ("mastermagic98", "upcoming.js",            "https://mastermagic98.github.io/l_plugins/upcoming.js"),
    ("mastermagic98", "cat_ua.js",              "https://mastermagic98.github.io/l_plugins/cat_ua.js"),
    ("mastermagic98", "nc.js",                  "https://mastermagic98.github.io/l_plugins/nc.js"),
    ("mastermagic98", "+buttons.js",            "https://mastermagic98.github.io/interface/+buttons.js"),
    ("num_jacred",    "nmprs.js",               "https://num.jac-red.ru/plugin/nmprs.js"),
    ("RomanV",        "surs.js",                "https://aviamovie.github.io/surs.js"),
    ("RomanV",        "surs_select.js",         "https://aviamovie.github.io/surs_select.js"),
    ("RomanV",        "surs_nav_buttons.js",    "https://aviamovie.github.io/surs_nav_buttons.js"),
    ("RomanV",        "surs_strmngs_row.js",    "https://aviamovie.github.io/surs_strmngs_row.js"),
    ("RomanV",        "reload-1.js",            "https://aviamovie.github.io/reload-1.js"),
    ("RomanV/v2",     "surs.js",                "https://aviamovie.github.io/v2/surs.js"),
    ("RomanV/v3",     "surs.js",                "https://aviamovie.github.io/v3/surs.js"),
    ("RomanV/v3",     "surs_nav_buttons.js",    "https://aviamovie.github.io/v3/surs_nav_buttons.js"),
    ("RomanV/v3",     "surs_strmngs_row.js",    "https://aviamovie.github.io/v3/surs_strmngs_row.js"),
    ("llowmikee",     "theme.js",               "https://llowmikee.github.io/Alcopac_theme/theme.js"),
    ("VaZ0NeZ",       "rate.js",                "https://amikdn.github.io/rate.js"),
    ("Vanya",         "NewPhoneCard.js",        "https://arst113.github.io/log/NewPhoneCard.js"),
    ("Zhenya",        "Mobile_Interface.js",    "https://crowley38.github.io/Mobile_Interface.js"),
    ("Ziuzin",        "likhtar.js",             "https://syvyj.github.io/studios_4lampa/likhtar.js"),
    ("Ziuzin",        "studios.js",             "https://syvyj.github.io/studios_4lampa/studios.js"),
    ("Petr",          "Dorama.js",              "https://xxhekpxx2307.github.io/Plagins/Dorama.js"),
    ("Yaroslav",      "ymain.js",               "http://lampalampa.free.nf/ymain.js"),
    ("Yaroslav",      "ymod.js",                "http://lampalampa.free.nf/ymod.js"),
    ("Yaroslav",      "ycardmod.js",            "http://lampalampa.free.nf/ycardmod.js"),
    ("Yaroslav",      "uacoments.js",           "http://lampalampa.free.nf/uacoments.js"),
    ("Yaroslav",      "interfaceymod.js",       "http://lampalampa.free.nf/interfaceymod.js"),
]

PLUGINS_DIR = "sync"
STATE_FILE = os.path.join(PLUGINS_DIR, ".sync_state.json")

CONNECT_TIMEOUT = 15      # секунд на один запрос
RETRIES = 3                # попыток на URL
RETRY_DELAY = 3            # секунд между попытками (растёт линейно)
MIN_VALID_SIZE = 5         # байт — совсем пустой ответ считаем мусором

# Если сервер вместо js отдаёт html-заглушку (парковка домена, 404-страница
# от какого-то прокси, которая не кинула HTTPError и т.п.) — не затираем файл.
HTML_MARKERS = (b"<!doctype html", b"<html", b"<HTML", b"<!DOCTYPE HTML")


def md5(content: bytes) -> str:
    return hashlib.md5(content).hexdigest()


def looks_like_html(content: bytes) -> bool:
    head = content[:200].lstrip()
    return any(head.startswith(marker) for marker in HTML_MARKERS)


def fetch(url: str):
    """
    Возвращает (content, error_message).
    content is None если все попытки провалились или ответ выглядит как мусор.
    Никогда не бросает исключение наружу.
    """
    last_error = None
    for attempt in range(1, RETRIES + 1):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
            with urllib.request.urlopen(req, timeout=CONNECT_TIMEOUT) as r:
                content = r.read()
            if len(content) < MIN_VALID_SIZE:
                last_error = f"пустой/подозрительно короткий ответ ({len(content)} байт)"
            elif looks_like_html(content):
                last_error = "похоже на HTML-заглушку, а не на .js — пропускаю"
            else:
                return content, None
        except urllib.error.HTTPError as e:
            # 404/410 и т.п. — ссылка неактуальна, повторять смысла нет
            if e.code in (404, 410):
                return None, f"HTTP {e.code} (ссылка неактуальна)"
            last_error = f"HTTP {e.code}"
        except (urllib.error.URLError, TimeoutError) as e:
            last_error = f"сеть/таймаут: {e.reason if hasattr(e, 'reason') else e}"
        except Exception as e:
            last_error = f"неожиданная ошибка: {e}"

        if attempt < RETRIES:
            time.sleep(RETRY_DELAY * attempt)

    return None, last_error


def snapshot_name(filename: str, dt: datetime) -> str:
    stamp = dt.strftime("%d%m%H%M")
    base, ext = os.path.splitext(filename)
    return f"{base}_{stamp}{ext}"


def load_state() -> dict:
    if os.path.exists(STATE_FILE):
        try:
            with open(STATE_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            return {}
    return {}


def save_state(state: dict) -> None:
    os.makedirs(PLUGINS_DIR, exist_ok=True)
    with open(STATE_FILE, "w", encoding="utf-8") as f:
        json.dump(state, f, ensure_ascii=False, indent=2, sort_keys=True)


def sync_plugin(subfolder: str, filename: str, url: str, now: datetime, state: dict) -> str:
    """Возвращает статус: 'updated' | 'unchanged' | 'failed'."""
    key = f"{subfolder}/{filename}"
    folder = os.path.join(PLUGINS_DIR, subfolder)
    os.makedirs(folder, exist_ok=True)
    latest_path = os.path.join(folder, filename)

    print(f"[{subfolder}] {filename}")
    content, error = fetch(url)

    entry = state.get(key, {})

    if content is None:
        fails = entry.get("consecutive_failures", 0) + 1
        entry.update({
            "consecutive_failures": fails,
            "last_error": error,
            "last_checked": now.isoformat(),
        })
        state[key] = entry
        # Не трогаем существующий файл — оставляем последнюю рабочую версию.
        note = " (файла ещё не было)" if not os.path.exists(latest_path) else " (оставляю старую версию)"
        marker = "⚠" if fails < 5 else "⛔"
        print(f"  {marker} не удалось получить: {error}{note} [неудач подряд: {fails}]")
        return "failed"

    # успешный ответ — сбрасываем счётчик неудач
    entry.update({
        "consecutive_failures": 0,
        "last_error": None,
        "last_checked": now.isoformat(),
    })
    state[key] = entry

    if os.path.exists(latest_path):
        with open(latest_path, "rb") as f:
            if md5(f.read()) == md5(content):
                print("  ✓ без изменений")
                return "unchanged"

    snap = snapshot_name(filename, now)
    with open(os.path.join(folder, snap), "wb") as f:
        f.write(content)
    with open(latest_path, "wb") as f:
        f.write(content)
    print(f"  ✅ обновлено → {snap}")
    return "updated"


def main():
    now = datetime.now(timezone.utc)
    print(f"=== Sync {now.strftime('%d.%m.%Y %H:%M')} UTC ===\n")

    state = load_state()
    counts = {"updated": 0, "unchanged": 0, "failed": 0}
    failed_list = []

    for subfolder, filename, url in PLUGINS:
        try:
            status = sync_plugin(subfolder, filename, url, now, state)
        except Exception as e:
            # последний рубеж: даже если в sync_plugin что-то пошло совсем
            # не так, один плагин не должен положить весь прогон
            print(f"  ⛔ непредвиденный сбой на {subfolder}/{filename}: {e}")
            status = "failed"
        counts[status] += 1
        if status == "failed":
            failed_list.append(f"{subfolder}/{filename}")

    save_state(state)

    print("\n=== Итог ===")
    print(f"Обновлено: {counts['updated']}   Без изменений: {counts['unchanged']}   Не удалось: {counts['failed']}")
    if failed_list:
        print("Проблемные ссылки:")
        for item in failed_list:
            print(f"  - {item}")

    summary_path = os.environ.get("GITHUB_STEP_SUMMARY")
    if summary_path:
        with open(summary_path, "a", encoding="utf-8") as f:
            f.write(f"### Sync {now.strftime('%d.%m.%Y %H:%M')} UTC\n\n")
            f.write(f"- ✅ Обновлено: {counts['updated']}\n")
            f.write(f"- ✓ Без изменений: {counts['unchanged']}\n")
            f.write(f"- ⚠️ Не удалось: {counts['failed']}\n")
            if failed_list:
                f.write("\n<details><summary>Проблемные ссылки</summary>\n\n")
                for item in failed_list:
                    f.write(f"- `{item}`\n")
                f.write("\n</details>\n")

    # Всегда завершаемся успешно — падение отдельных ссылок это нормальная
    # ситуация, а не повод ронять весь workflow.
    sys.exit(0)


if __name__ == "__main__":
    main()
