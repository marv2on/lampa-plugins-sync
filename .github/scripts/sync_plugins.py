#!/usr/bin/env python3
import os
import hashlib
import urllib.request
from datetime import datetime

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
TIMEOUT = 15

def md5(content):
    return hashlib.md5(content).hexdigest()

def fetch(url):
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=TIMEOUT) as r:
            return r.read()
    except Exception as e:
        print(f"  ⚠ fetch error: {e}")
        return None

def snapshot_name(filename, dt):
    stamp = dt.strftime("%d%m%H%M")
    base, ext = os.path.splitext(filename)
    return f"{base}_{stamp}{ext}"

def sync_plugin(subfolder, filename, url, now):
    folder = os.path.join(PLUGINS_DIR, subfolder)
    os.makedirs(folder, exist_ok=True)
    latest_path = os.path.join(folder, filename)
    print(f"[{subfolder}] {filename}")
    new_content = fetch(url)
    if new_content is None:
        return
    if os.path.exists(latest_path):
        with open(latest_path, "rb") as f:
            if md5(f.read()) == md5(new_content):
                print("  ✓ без змін")
                return
    snap = snapshot_name(filename, now)
    with open(os.path.join(folder, snap), "wb") as f:
        f.write(new_content)
    with open(latest_path, "wb") as f:
        f.write(new_content)
    print(f"  ✅ оновлено → {snap}")

def main():
    now = datetime.utcnow()
    print(f"=== Sync {now.strftime('%d.%m.%Y %H:%M')} UTC ===\n")
    for subfolder, filename, url in PLUGINS:
        sync_plugin(subfolder, filename, url, now)
    print("\n=== Done ===")

if __name__ == "__main__":
    main()
