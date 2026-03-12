(function () {
    'use strict';

    // ═══════════════════════════════════════════════════════════════════
    // РОЗДІЛ 1: ІНІЦІАЛІЗАЦІЯ ТА КОНФІГУРАЦІЯ
    // ═══════════════════════════════════════════════════════════════════

    const PLUGIN_NAME = 'EasyTorrent';
    const VERSION = '1.1.0 Beta';
    const PLUGIN_ICON = '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" fill="currentColor"/></svg>';

    // Supabase config
    const SUPABASE_URL = 'https://xozswgtbcjorxzabawmk.supabase.co';
    const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhvenN3Z3RiY2pvcnh6YWJhd21rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEyODAzODksImV4cCI6MjA4Njg1NjM4OX0.ajYvu0KecRKZGLge_682oU5MD-WiQSM2jNZwuGHw2Uo';
    const WIZARD_URL = 'https://cevamnelampaplagin.github.io/plugins/';

    let pollingInterval = null;

    // Конфігурація за замовчуванням (використовується, якщо не задана користувацька)
    // Вимога v1.1.0 Beta:
    // - FHD (1080p)
    // - Без HDR (вважаємо SDR)
    // - Без 5.1/7.1/Atmos (стерео)
    // - Пріоритети параметрів: як у візарді
    // - Озвучки: як у візарді, але без української
    const DEFAULT_CONFIG = {
        "version": "2.1",
        "generated": "2026-02-17T13:43:12.099Z",
        "device": {
            "type": "tv_fhd",
            "supported_hdr": [],
            "supported_audio": ["stereo"]
        },
        "network": {
            "speed": "very_fast",
            "stability": "stable"
        },
        "parameter_priority": ["audio_track", "resolution", "availability", "bitrate", "hdr", "audio_quality"],
        "audio_track_priority": [1, 44, 6, 11, 0],
        "preferences": {
            "min_seeds": 3,
            "recommendation_count": 3,
            "languages": ["ukr"]
        },
        "scoring_rules": {
            "schema": "2.1",
            "base_score": 100,
            "weights": { "audio_track": 100, "resolution": 85, "availability": 70, "bitrate": 55, "hdr": 40, "audio_quality": 25 },
            "resolution": { "2160": 34, "1440": 42.5, "1080": 85, "720": 8.5, "480": -34 },
            "hdr": { "dolby_vision": -8, "hdr10plus": -6, "hdr10": -6, "sdr": 0 },
            "bitrate_bonus": {
                "thresholds": [
                    { "min": 0, "max": 5, "bonus": 2.75 },
                    { "min": 5, "max": 15, "bonus": 11 },
                    { "min": 15, "max": 30, "bonus": 8.25 },
                    { "min": 30, "max": 999, "bonus": 0 }
                ],
                "missing_penalty": -8.25
            },
            "availability": {
                "min_seeds": 3,
                "below_min_penalty": -14,
                "log10_multiplier": 8.4
            },
            "audio_track": {
                "curve": "linear",
                "max_points": 100
            },
            "audio_quality": {
                // За замовчуванням вважаємо: пристрій без 5.1/7.1/Atmos — балів не даємо
                "points": { "dolby_atmos": 0, "surround_71": 0, "surround_51": 0, "stereo": 0, "unknown": 0 }
            },
            "special_rules": []
        }
    };

    let USER_CONFIG = DEFAULT_CONFIG;
    const STORAGE_MODAL_UPDATE_V110 = 'easytorrent_modal_update_v110_shown';
    const STORAGE_MODAL_WELCOME = 'easytorrent_modal_welcome_shown';
    const STORAGE_CONFIG_KEY = 'easytorrent_config_json';
    let shouldShowUpdateModalV110 = false;
    let shouldShowWelcomeModal = false;
    let startupModalScheduler = null;
    const EXT_META_NAME = 'EasyTorrent';
    const EXT_META_AUTHOR = '@darkestclouds';
    const EXT_META_URL_HINTS = ['easytorrent'];

    // Переклади
    const translations = {
        easytorrent_title: { ru: 'Рекомендації торрентів', en: 'Torrent Recommendations', ua: 'Рекомендації торрентів' },
        easytorrent_desc: { ru: 'Показувати торенти, що рекомендуються, на основі якості, HDR і озвучки', en: 'Show recommended torrents based on quality, HDR and audio', ua: 'Показувати рекомендовані торренти на основі якості, HDR та озвучки' },
        recommended_section_title: { ru: 'Рекомендовані', en: 'Recommended', ua: 'Рекомендовані' },
        show_scores: { ru: 'Показувати оцінки', en: 'Show scores', ua: 'Показувати оцінки' },
        show_scores_desc: { ru: 'Відображати оцінку якості торрента', en: 'Display torrent quality score', ua: 'Відображати оцінку якості торренту' },
        ideal_badge: { ru: 'ідеальний', en: 'Ideal', ua: 'Ідеальний' },
        recommended_badge: { ru: 'Рекомендуется', en: 'Recommended', ua: 'Рекомендується' },
        config_json: { ru: 'Конфігурація (JSON)', en: 'Configuration (JSON)', ua: 'Конфігурація (JSON)' },
        config_json_desc: { ru: 'Натисніть , щоб переглянути або змінити налаштування', en: 'Click to view or change settings', ua: 'Натисніть для перегляду або змінити налаштування' },
        config_view: { ru: 'Переглянути параметри', en: 'View parameters', ua: 'Переглянути параметри' },
        config_edit: { ru: 'Вставить JSON', en: 'Paste JSON', ua: 'Вставити JSON' },
        config_reset: { ru: 'Скинути до заводських', en: 'Reset to defaults', ua: 'Скинути до заводських' },
        config_error: { ru: 'Помилка: Неправильний формат JSON', en: 'Error: Invalid JSON format', ua: 'Помилка: Невірний формат JSON' }
    };

    function t(key) {
        const lang = Lampa.Storage.get('language', 'ru');
        return translations[key] && (translations[key][lang] || translations[key].ru) || key;
    }

    function deepClone(obj) {
        return JSON.parse(JSON.stringify(obj));
    }

    function applyDefaultConfigAndPersist() {
        USER_CONFIG = deepClone(DEFAULT_CONFIG);
        try {
            Lampa.Storage.set(STORAGE_CONFIG_KEY, JSON.stringify(USER_CONFIG));
        } catch (e) {}
    }

    function isExtensionsScreen() {
        try {
            if (document && document.querySelector && document.querySelector('.extensions')) return true;
        } catch (e) {}

        try {
            const enabled = (Lampa.Controller && typeof Lampa.Controller.enabled === 'function') ? Lampa.Controller.enabled() : null;
            if (enabled && enabled.name === 'extensions') return true;
        } catch (e) {}

        return false;
    }

    function isPluginEnabled() {
        try {
            return !!Lampa.Storage.get('easytorrent_enabled', true);
        } catch (e) {
            return true;
        }
    }

    function ensureSelfPluginMetadataInStorage() {
        try {
            const raw = Lampa.Storage.get('plugins', '[]');
            const list = Array.isArray(raw) ? raw.slice() : (typeof raw === 'string' ? JSON.parse(raw) : []);
            if (!Array.isArray(list) || !list.length) return;

            let changed = false;

            const isMatch = (u) => {
                const url = String(u || '').toLowerCase();
                if (!url) return false;
                return EXT_META_URL_HINTS.some(h => url.includes(String(h).toLowerCase()));
            };

            const normalized = list.map(item => (typeof item === 'string' ? { url: item, status: 1 } : item));

            normalized.forEach(item => {
                if (!item || typeof item !== 'object') return;
                const url = item.url || item.link;
                if (!isMatch(url)) return;

                if (!item.name) {
                    item.name = EXT_META_NAME;
                    changed = true;
                }
                if (!item.author) {
                    item.author = EXT_META_AUTHOR;
                    changed = true;
                }
                if (!item.descr) {
                    item.descr = String(url || '').replace(/\n|\t|\r/g, ' ');
                    changed = true;
                }
            });

            if (changed) {
                Lampa.Storage.set('plugins', normalized);
            }

            // Якщо зараз відкрито екран Extensions — оновимо DOM одразу (щоб не чекати перезавантаження)
            try {
                const root = document && document.querySelector ? document.querySelector('.extensions') : null;
                if (root) {
                    root.querySelectorAll('.extensions__item').forEach(el => {
                        const descrEl = el.querySelector('.extensions__item-descr');
                        if (!descrEl) return;
                        const descr = String(descrEl.textContent || '');
                        if (!isMatch(descr)) return;

                        const nameEl = el.querySelector('.extensions__item-name');
                        const authorEl = el.querySelector('.extensions__item-author');

                        if (nameEl && (!nameEl.textContent || nameEl.textContent.trim() === 'Без названия')) {
                            nameEl.textContent = EXT_META_NAME;
                        }
                        if (authorEl && (!authorEl.textContent || authorEl.textContent.trim() === '@lampa')) {
                            authorEl.textContent = EXT_META_AUTHOR;
                        }
                    });
                }
            } catch (e) {}
        } catch (e) {
            console.warn('[EasyTorrent] ensureSelfPluginMetadataInStorage failed:', e);
        }
    }

    function hasPendingStartupModals() {
        const needUpdate = shouldShowUpdateModalV110 && !Lampa.Storage.get(STORAGE_MODAL_UPDATE_V110, false);
        const needWelcome = shouldShowWelcomeModal && !Lampa.Storage.get(STORAGE_MODAL_WELCOME, false);
        return needUpdate || needWelcome;
    }

    function ensureStartupModalScheduler() {
        if (startupModalScheduler) return;

        // Періодично перевіряємо умови (покинули extensions + плагін увімкнено) і показуємо модалку.
        startupModalScheduler = setInterval(() => {
            try {
                if (!hasPendingStartupModals()) {
                    clearInterval(startupModalScheduler);
                    startupModalScheduler = null;
                    return;
                }

                // Якщо плагін вимкнено — не показуємо. При ввімкненні scheduler запуститься через onChange.
                if (!isPluginEnabled()) return;

                // На extensions модалки НЕ показуємо (там багована поведінка) — покажемо пізніше.
                if (isExtensionsScreen()) return;

                showStartupModalIfNeeded();
            } catch (e) {}
        }, 1500);
    }


    function isObj(v) {
        return !!v && typeof v === 'object' && !Array.isArray(v);
    }

    function isStr(v) {
        return typeof v === 'string' && v.length > 0;
    }

    function isNum(v) {
        return typeof v === 'number' && Number.isFinite(v);
    }

    function isNumOrInt(v) {
        return isNum(v);
    }

    function cfgError(message) {
        return { ok: false, error: message };
    }

    function validateConfig(cfg) {
        if (!isObj(cfg)) return cfgError('Конфіг має бути об\'єктом JSON');

        const v = String(cfg.version || '');
        if (v === '2.0' || v.startsWith('2.0')) {
            return cfgError('Конфіги версії 2.0 більше не підтримуються. Згенеруйте новий конфіг (2.1) у візарді.');
        }
        if (!v.startsWith('2.1')) {
            return cfgError(`Непідтримувана версія конфігу: ${v || 'не вказана'}. Очікується 2.1.`);
        }

        if (!isObj(cfg.device)) return cfgError('Поле device відсутнє або невірного типу');
        if (!isStr(cfg.device.type)) return cfgError('Поле device.type відсутнє або невірного типу');
        if (!Array.isArray(cfg.device.supported_hdr)) return cfgError('Поле device.supported_hdr має бути масивом');
        if (!Array.isArray(cfg.device.supported_audio)) return cfgError('Поле device.supported_audio має бути масивом');

        if (!isObj(cfg.network)) return cfgError('Поле network відсутнє або невірного типу');
        if (!isStr(cfg.network.speed)) return cfgError('Поле network.speed відсутнє або невірного типу');
        if (!isStr(cfg.network.stability)) return cfgError('Поле network.stability відсутнє або невірного типу');

        if (!Array.isArray(cfg.parameter_priority) || cfg.parameter_priority.length === 0) return cfgError('Поле parameter_priority має бути непорожнім масивом');
        if (!Array.isArray(cfg.audio_track_priority) || cfg.audio_track_priority.length === 0) return cfgError('Поле audio_track_priority має бути непорожнім масивом');
        // Строго: тільки числові id з AUDIO_TRACKS
        for (const v of cfg.audio_track_priority) {
            if (!(typeof v === 'number' && Number.isFinite(v))) {
                return cfgError('Поле audio_track_priority має містити лише числові id озвучок (без рядкових назв)');
            }
            // AUDIO_TRACK_BY_ID ініціалізується нижче разом з AUDIO_TRACKS; тут використовуємо як довідник валідності id
            if (!AUDIO_TRACK_BY_ID || (AUDIO_TRACK_BY_ID.has && !AUDIO_TRACK_BY_ID.has(v))) {
                return cfgError('Поле audio_track_priority містить невідомий id озвучки');
            }
        }

        if (!isObj(cfg.preferences)) return cfgError('Поле preferences відсутнє або невірного типу');
        if (!isNumOrInt(cfg.preferences.min_seeds)) return cfgError('Поле preferences.min_seeds має бути числом');
        if (!isNumOrInt(cfg.preferences.recommendation_count)) return cfgError('Поле preferences.recommendation_count має бути числом');
        if (!Array.isArray(cfg.preferences.languages) || cfg.preferences.languages.length === 0) {
            return cfgError('Поле preferences.languages має бути непорожнім масивом (наприклад ["rus","eng"])');
        }
        for (const l of cfg.preferences.languages) {
            if (typeof l !== 'string' || !l.trim()) return cfgError('Поле preferences.languages має містити лише рядки');
        }

        if (!isObj(cfg.scoring_rules)) return cfgError('Поле scoring_rules відсутнє або невірного типу');
        const r = cfg.scoring_rules;
        if (String(r.schema || '') !== '2.1') return cfgError('Поле scoring_rules.schema має бути "2.1"');
        if (!isNumOrInt(r.base_score)) return cfgError('Поле scoring_rules.base_score має бути числом');

        if (!isObj(r.resolution)) return cfgError('Поле scoring_rules.resolution відсутнє або невірного типу');
        if (!isObj(r.hdr)) return cfgError('Поле scoring_rules.hdr відсутнє або невірного типу');

        if (!isObj(r.bitrate_bonus)) return cfgError('Поле scoring_rules.bitrate_bonus відсутнє або невірного типу');
        if (!Array.isArray(r.bitrate_bonus.thresholds)) return cfgError('Поле scoring_rules.bitrate_bonus.thresholds має бути масивом');
        if (!isNumOrInt(r.bitrate_bonus.missing_penalty)) return cfgError('Поле scoring_rules.bitrate_bonus.missing_penalty має бути числом');
        for (const t of r.bitrate_bonus.thresholds) {
            if (!isObj(t)) return cfgError('Елементи scoring_rules.bitrate_bonus.thresholds мають бути об\'єктами');
            if (!isNumOrInt(t.min) || !isNumOrInt(t.max) || !isNumOrInt(t.bonus)) {
                return cfgError('thresholds: кожен елемент має містити числові поля min/max/bonus');
            }
        }

        if (!isObj(r.availability)) return cfgError('Поле scoring_rules.availability відсутнє або невірного типу');
        if (!isNumOrInt(r.availability.min_seeds)) return cfgError('Поле scoring_rules.availability.min_seeds має бути числом');
        if (!isNumOrInt(r.availability.below_min_penalty)) return cfgError('Поле scoring_rules.availability.below_min_penalty має бути числом');
        if (!isNumOrInt(r.availability.log10_multiplier)) return cfgError('Поле scoring_rules.availability.log10_multiplier має бути числом');

        if (!isObj(r.audio_track)) return cfgError('Поле scoring_rules.audio_track відсутнє або невірного типу');
        if (!isStr(r.audio_track.curve)) return cfgError('Поле scoring_rules.audio_track.curve має бути рядком');
        if (!isNumOrInt(r.audio_track.max_points)) return cfgError('Поле scoring_rules.audio_track.max_points має бути числом');

        if (!isObj(r.audio_quality)) return cfgError('Поле scoring_rules.audio_quality відсутнє або невірного типу');
        if (!isObj(r.audio_quality.points)) return cfgError('Поле scoring_rules.audio_quality.points відсутнє або невірного типу');

        if (r.special_rules !== undefined && !Array.isArray(r.special_rules)) {
            return cfgError('Поле scoring_rules.special_rules має бути масивом (або відсутнім)');
        }

        return { ok: true };
    }

    function openEasyTorrentSettingsFromModal(prevController) {
        try {
            Lampa.Modal.close();
        } catch (e) {}

        // Повертаємося в налаштування і відкриваємо компонент
        Lampa.Controller.toggle('settings');
        setTimeout(() => {
            if (Lampa.Settings && typeof Lampa.Settings.create === 'function') {
                Lampa.Settings.create('easytorrent', {
                    onBack: () => {
                        Lampa.Controller.toggle('settings');
                    }
                });
            }
        }, 50);
    }

    function showStartupModalIfNeeded() {
        // На сторінці Extensions модалки не показуємо взагалі (покажемо пізніше scheduler'ом)
        if (isExtensionsScreen()) return false;

        const prev = (Lampa.Controller && typeof Lampa.Controller.enabled === 'function' && Lampa.Controller.enabled())
            ? Lampa.Controller.enabled().name
            : 'content';

        // Якщо оточення ще не готове (контролер/Modal/$), не ставимо прапорці — просто спробуємо пізніше
        const canOpen =
            !!(window.Lampa && Lampa.Modal && typeof Lampa.Modal.open === 'function') &&
            !!(window.Lampa && Lampa.Controller && typeof Lampa.Controller.toggle === 'function') &&
            (typeof $ === 'function');

        if (!canOpen) return false;

        // 1) Оновлення (якщо конфіг є, але відхилений/не підтримується)
        if (shouldShowUpdateModalV110 && !Lampa.Storage.get(STORAGE_MODAL_UPDATE_V110, false)) {
            const html = $(`
                <div class="about">
                    <div class="about__text">
                        <div><strong>Що змінилося:</strong></div>
                        <ol>
                            <li>Виправлено помилки розрахунку рейтингу</li>
                            <li>Додано бали за якість звуку (Atmos / 7.1 / 5.1)</li>
                            <li>Покращено розрахунки бітрейту та роботу з серіалами.</li>
                        </ol>
                        <p style="padding: 0.75em 0.9em; border-radius: 0.6em; background: rgba(255,193,7,0.14); border: 1px solid rgba(255,193,7,0.35);">
                            <strong style="color: #ffc107;">⚠️ ВАЖЛИВО:</strong>
                            Конфіг скинуто на стандартну конфігурацію через несумісність. Потрібно налаштувати заново.
                        </p>
                        <p><strong>Поточна конфігурація:</strong></p>
                        <ul>
                            <li>Пристрій: <strong>FHD (1080p)</strong></li>
                            <li>HDR: <strong>вимкнено (SDR)</strong></li>
                            <li>Звук: <strong>стерео</strong> (без 5.1/7.1/Atmos)</li>
                            <li>Пріоритети: <strong>Озвучка → Роздільність → Сіди → Бітрейт</strong></li>
                            <li>Мін. сідів: <strong>${DEFAULT_CONFIG.preferences.min_seeds}</strong>, рекомендацій: <strong>${DEFAULT_CONFIG.preferences.recommendation_count}</strong></li>
                        </ul>
                        <p>
                            Для нормальної роботи рекомендується заново налаштувати пріоритети:
                            <br><strong>Налаштування → EasyTorrent → “Розставити пріоритети”</strong>
                        </p>
                    </div>
                </div>
            `);

            try {
                Lampa.Modal.open({
                    title: `Оновлення EasyTorrent v${VERSION}`,
                    size: 'large',
                    html: html,
                    mask: true,
                    buttons_position: 'outside',
                    buttons: [
                        {
                            name: 'Відкрити налаштування',
                            onSelect: () => openEasyTorrentSettingsFromModal(prev)
                        },
                        {
                            name: 'Закрити',
                            onSelect: () => {
                                Lampa.Modal.close();
                                Lampa.Controller.toggle(prev);
                            }
                        }
                    ],
                    onBack: () => {
                        Lampa.Modal.close();
                        Lampa.Controller.toggle(prev);
                    }
                });

                // Ставимо прапорець ТІЛЬКИ після успішного відкриття
                Lampa.Storage.set(STORAGE_MODAL_UPDATE_V110, true);
                return true;
            } catch (e) {
                console.error('[EasyTorrent] Modal.open failed:', e);
                return false;
            }
        }

        // 2) Перший запуск (немає збереженого конфігу)
        if (shouldShowWelcomeModal && !Lampa.Storage.get(STORAGE_MODAL_WELCOME, false)) {
            const html = $(`
                <div class="about">
                    <div class="about__text">
                        <div>
                            Для нормальної роботи потрібно налаштувати пріоритети (озвучки/якість/сіди тощо).
                        </div>
                        <p>
                            Зараз встановлено стандартну конфігурацію:
                        </p>
                        <ul>
                            <li>Пристрій: <strong>FHD (1080p)</strong></li>
                            <li>HDR: <strong>вимкнено (SDR)</strong></li>
                            <li>Звук: <strong>стерео</strong> (без 5.1/7.1/Atmos)</li>
                            <li>Пріоритети: <strong>Озвучка → Роздільність → Сіди → Бітрейт</strong></li>
                            <li>Мін. сідів: <strong>${DEFAULT_CONFIG.preferences.min_seeds}</strong>, рекомендацій: <strong>${DEFAULT_CONFIG.preferences.recommendation_count}</strong></li>
                        </ul>
                        <p>
                            Перейдіть:
                            <br><strong>Налаштування → EasyTorrent → “Розставити пріоритети”</strong>
                            <br>та пройдіть налаштування на своєму телефоні через QR.
                        </p>
                    </div>
                </div>
            `);

            try {
                Lampa.Modal.open({
                    title: `EasyTorrent встановлено (v${VERSION})`,
                    size: 'large',
                    html: html,
                    mask: true,
                    buttons_position: 'outside',
                    buttons: [
                        {
                            name: 'Відкрити налаштування',
                            onSelect: () => openEasyTorrentSettingsFromModal(prev)
                        },
                        {
                            name: 'Закрити',
                            onSelect: () => {
                                Lampa.Modal.close();
                                Lampa.Controller.toggle(prev);
                            }
                        }
                    ],
                    onBack: () => {
                        Lampa.Modal.close();
                        Lampa.Controller.toggle(prev);
                    }
                });

                // Ставимо прапорець ТІЛЬКИ після успішного відкриття
                Lampa.Storage.set(STORAGE_MODAL_WELCOME, true);
                return true;
            } catch (e) {
                console.error('[EasyTorrent] Modal.open failed:', e);
                return false;
            }
        }

        return false;
    }

    function loadUserConfig() {
        const savedConfig = Lampa.Storage.get(STORAGE_CONFIG_KEY);
        if (savedConfig) {
            try {
                const parsed = typeof savedConfig === 'string' ? JSON.parse(savedConfig) : savedConfig;
                const check = validateConfig(parsed);
                if (check.ok) {
                    USER_CONFIG = parsed;
                    return;
                }

                // Конфіг є, але неправильний — не чіпаємо його, просто повідомляємо і працюємо на дефолті.
                shouldShowUpdateModalV110 = true;
                // По факту: щоб не зациклювати "привітальну" і не тримати битий конфіг, кладемо дефолт у storage.
                applyDefaultConfigAndPersist();
                console.warn('[EasyTorrent] Конфіг відхилено:', check.error);
                return; // важливо: не показуємо welcome, тому що конфіг "був", але відхилений
            } catch (e) {
                // Конфіг є, але не парситься (битий JSON) — це не "перший запуск"
                shouldShowUpdateModalV110 = true;
                applyDefaultConfigAndPersist();
                console.warn('[EasyTorrent] Конфіг пошкоджений і не може бути прочитаний:', e);
                return;
            }
        }
        // Перший запуск: ставимо дефолт і показуємо підказку (1 раз)
        shouldShowWelcomeModal = true;
        applyDefaultConfigAndPersist();
    }

    function saveUserConfig(config) {
        const stringConfig = typeof config === 'string' ? config : JSON.stringify(config);
        // Спочатку валідуємо. Нічого "за користувача" не виправляємо.
        try {
            const parsed = JSON.parse(stringConfig);
            const check = validateConfig(parsed);
            if (!check.ok) {
                Lampa.Noty && Lampa.Noty.show ? Lampa.Noty.show(check.error) : alert(check.error);
                // Не зберігаємо і не застосовуємо.
                return;
            }

            Lampa.Storage.set(STORAGE_CONFIG_KEY, stringConfig);
            USER_CONFIG = parsed;
        } catch (e) {
            USER_CONFIG = deepClone(DEFAULT_CONFIG);
        }
    }

    function showConfigDetails() {
        const cfg = USER_CONFIG;
        const items = [
            { title: 'Версія конфігу', subtitle: cfg.version, noselect: true },
            { title: 'Тип пристрою', subtitle: cfg.device.type.toUpperCase(), noselect: true },
            { title: 'Підтримка HDR', subtitle: cfg.device.supported_hdr.join(', ') || 'немає', noselect: true },
            { title: 'Підтримка звуку', subtitle: cfg.device.supported_audio.join(', ') || 'стерео', noselect: true },
            { title: 'Мови аудіо', subtitle: (cfg.preferences && Array.isArray(cfg.preferences.languages) ? cfg.preferences.languages.join(', ') : 'не задано'), noselect: true },
            { title: 'Пріоритет параметрів', subtitle: cfg.parameter_priority.join(' > '), noselect: true },
            { title: 'Пріоритет озвучок', subtitle: `${cfg.audio_track_priority.length} шт. • Натисніть для перегляду`, action: 'show_voices' },
            { title: 'Мінімальна кількість сідів', subtitle: cfg.preferences.min_seeds, noselect: true },
            { title: 'Кількість рекомендацій', subtitle: cfg.preferences.recommendation_count, noselect: true }
        ];

        Lampa.Select.show({
            title: 'Поточна конфігурація',
            items: items,
            onSelect: (item) => {
                if (item.action === 'show_voices') {
                    showVoicePriority();
                }
            },
            onBack: () => {
                Lampa.Controller.toggle('settings');
            }
        });
    }

    function showVoicePriority() {
        const cfg = USER_CONFIG;
        const items = cfg.audio_track_priority.map((voice, index) => {
            const id = normalizeAudioTrackIdOrNull(voice);
            const name = (typeof id === 'number' && AUDIO_TRACK_BY_ID.get(id))
                ? AUDIO_TRACK_BY_ID.get(id).name
                : String(voice);
            return {
                title: `${index + 1}. ${name}`,
            noselect: true
            };
        });
        const safeItems = items.length ? items : [{
            title: 'Порожньо',
            noselect: true
        }];

        Lampa.Select.show({
            title: 'Пріоритет озвучок',
            items: safeItems,
            onBack: () => {
                showConfigDetails();
            }
        });
    }

    // ═══════════════════════════════════════════════════════════════════
    // РОЗДІЛ 2: ЯДРО - АНАЛІЗ ТОРРЕНТІВ
    // ═══════════════════════════════════════════════════════════════════

    /**
     * Визначення роздільності відео з ffprobe або назви
     */
    function detectResolution(item) {
        const title = (item.Title || item.title || '').toLowerCase();
        
        if (item.ffprobe && Array.isArray(item.ffprobe)) {
            const video = item.ffprobe.find(s => s.codec_type === 'video');
            if (video && video.height) {
                item._et_resolution_debug = {
                    source: 'ffprobe',
                    width: video.width || null,
                    height: video.height || null
                };
                // 4K: висота >= 2160 АБО ширина >= 3800 (враховуємо кроп)
                if (video.height >= 2160 || (video.width && video.width >= 3800)) return 2160;
                // 2K: висота >= 1440 АБО ширина >= 2500
                if (video.height >= 1440 || (video.width && video.width >= 2500)) return 1440;
                // FHD: висота >= 1080 АБО ширина >= 1900
                if (video.height >= 1080 || (video.width && video.width >= 1900)) return 1080;
                // HD: висота >= 720 АБО ширина >= 1260
                if (video.height >= 720 || (video.width && video.width >= 1260)) return 720;
                return 480;
            }
        }
        item._et_resolution_debug = { source: 'title' };
        if (/\b2160p\b/.test(title) || /\b4k\b/.test(title)) return 2160;
        if (/\b1440p\b/.test(title) || /\b2k\b/.test(title)) return 1440;
        if (/\b1080p\b/.test(title)) return 1080;
        if (/\b720p\b/.test(title)) return 720;
        
        return null;
    }

    /**
     * Визначення HDR типу (обирає найкращий із знайдених)
     */
    function detectHdr(item, useInfoVideotype = false) {
        // NB: за замовчуванням визначаємо HDR тільки за назвою, тому що info.videotype може помилятися.
        // Якщо потрібно ввімкнути довіру до парсера — передайте useInfoVideotype=true.
        if (useInfoVideotype) {
            // 0) Якщо парсер уже визначив тип відео — можна довіряти йому (опціонально)
            // Приклади: info.videotype = 'sdr' | 'hdr10' | 'hdr10plus' | 'dolby_vision'
            const vi = item && item.info && (item.info.videotype || item.info.video_type || item.info.hdr);
            if (typeof vi === 'string' && vi) {
                const v = vi.toLowerCase();
                if (v === 'sdr') return 'sdr';
                if (v === 'hdr10') return 'hdr10';
                if (v === 'hdr10plus' || v === 'hdr10+') return 'hdr10plus';
                if (v === 'dolby_vision' || v === 'dovi' || v === 'dv') return 'dolby_vision';
                if (v === 'hdr') return 'hdr10'; // загальний маркер без уточнення
            }
        }

        const title = (item.Title || item.title || '').toLowerCase();
        const foundTypes = [];

        // HDR-токени мають бути "окремими": без літер/цифр зліва/справа.
        // Це захищає від хибних спрацьовувань типу "HDRezka" (hdr+буква) і подібних.
        const hasToken = (tokenPattern) => {
            try {
                const re = new RegExp(`(?:^|[^\\p{L}\\p{N}])(?:${tokenPattern})(?=$|[^\\p{L}\\p{N}])`, 'iu');
                return re.test(title);
            } catch (e) {
                // fallback без \p{L}\p{N}
                const re = new RegExp(`(?:^|[^a-z0-9_])(?:${tokenPattern})(?=$|[^a-z0-9_])`, 'i');
                return re.test(title);
            }
        };
        
        // З ffprobe
        if (item.ffprobe && Array.isArray(item.ffprobe)) {
            const video = item.ffprobe.find(s => s.codec_type === 'video');
            if (video && video.side_data_list) {
                const hasDv = video.side_data_list.some(data => 
                    data.side_data_type === 'DOVI configuration record' ||
                    data.side_data_type === 'Dolby Vision RPU'
                );
                if (hasDv) foundTypes.push('dolby_vision');
            }
        }
        
        // З назви - збираємо ВСІ знайдені типи (від специфічного до загального)
        // HDR10+ / HDR10PLUS
        if (hasToken('hdr10\\+') || hasToken('hdr10plus') || hasToken('hdr10\\s*plus')) {
            if (!foundTypes.includes('hdr10plus')) foundTypes.push('hdr10plus');
        }
        // HDR10 (важливо: не матчиться всередині HDR10PLUS через token-межі)
        if (hasToken('hdr-?10') || hasToken('hdr10')) {
            if (!foundTypes.includes('hdr10')) foundTypes.push('hdr10');
        }
        if (title.includes('dolby vision') || title.includes('dovi') || /\sp8\s/.test(title) || /\(dv\)/.test(title) || /\[dv\]/.test(title) || /\sdv\s/.test(title) || /,\s*dv\s/.test(title)) {
            if (!foundTypes.includes('dolby_vision')) foundTypes.push('dolby_vision');
        }
        // Загальний HDR-маркер (тільки як окремий токен: /HDR/, |HDR|, [HDR], (HDR), " HDR ")
        if (hasToken('hdr') && !foundTypes.includes('hdr10plus') && !foundTypes.includes('hdr10')) {
            foundTypes.push('hdr10');
        }
        if (hasToken('sdr')) {
            if (!foundTypes.includes('sdr')) foundTypes.push('sdr');
        }
        
        // Якщо нічого не знайдено, ймовірно SDR
        if (foundTypes.length === 0) {
            item._et_hdr_debug = { source: 'title', foundTypes: [], chosen: 'sdr' };
            return 'sdr';
        }
        
        // Обираємо НАЙКРАЩИЙ тип за значенням з конфігу
        const hdrScores = USER_CONFIG.scoring_rules.hdr;
        
        let bestType = foundTypes[0];
        let bestScore = hdrScores[bestType] || 0;
        
        foundTypes.forEach(type => {
            const score = hdrScores[type] || 0;
            if (score > bestScore) {
                bestScore = score;
                bestType = type;
            }
        });
        
        item._et_hdr_debug = { source: 'title', foundTypes: foundTypes.slice(0), chosen: bestType };
        return bestType;
    }


    /**
     * Визначення якості звуку (стерео/5.1/7.1/Atmos).
     * Це не "мова/озвучка", а саме формат/канали.
     */
    function detectAudioQuality(item) {
        const title = (item.Title || item.title || '').toLowerCase();

        // Atmos за назвою (найчастіше так і маркують)
        if (/\batmos\b/.test(title) || title.includes('dolby atmos')) return 'dolby_atmos';

        // Канали за назвою
        if (/\b7[ .]?1\b/.test(title) || title.includes('7.1ch') || title.includes('7 1')) return 'surround_71';
        if (/\b5[ .]?1\b/.test(title) || title.includes('5.1ch') || title.includes('5 1')) return 'surround_51';

        // ffprobe (якщо є): channels / channel_layout / tags
        if (item.ffprobe && Array.isArray(item.ffprobe)) {
            const audio = item.ffprobe.filter(s => s.codec_type === 'audio');
            // якщо знайшли кілька доріжок — беремо "найжирнішу"
            let best = null;
            audio.forEach(s => {
                const ch = typeof s.channels === 'number' ? s.channels : null;
                const layout = (s.channel_layout || '').toLowerCase();
                const t = (s.tags?.title || s.tags?.handler_name || '').toLowerCase();
                const isAtmos = t.includes('atmos') || layout.includes('atmos');

                // оцінка "жирності": атмос > 7.1 > 5.1 > стерео > невідомо
                let rank = 0;
                if (isAtmos) rank = 4;
                else if (layout.includes('7.1') || ch === 8) rank = 3;
                else if (layout.includes('5.1') || ch === 6) rank = 2;
                else if (layout.includes('stereo') || ch === 2) rank = 1;

                if (!best || rank > best.rank) best = { rank };
            });

            if (best) {
                if (best.rank === 4) return 'dolby_atmos';
                if (best.rank === 3) return 'surround_71';
                if (best.rank === 2) return 'surround_51';
                if (best.rank === 1) return 'stereo';
            }
        }

        // За замовчуванням вважаємо стерео (2.0) базовим варіантом
        return 'stereo';
    }

    /**
     * Вилучення бітрейту (пріоритет: ffprobe BPS → bit_rate → розрахунок з Size+Duration → поле bitrate → назва)
     */
    /**
    /**
 * Надійний розбір "сезон/серії" з торрент-заголовків (RU/UA/EN).
 *
 * Повертає об'єкт:
 * {
 *   season: number | null,
 *   seasonRange?: { start: number, end: number },
 *   episode: number | null,
 *   episodeRange?: { start: number, end: number },
 *   source: string,          // який патерн спрацював
 *   confidence: number       // 0..100 (умовно)
 * }
 *
 * Приклад:
 * extractSeasonEpisode("Stranger Things [05x01-03 из 08] ...")
 */

function normalizeTitle(input) {
    if (input == null) return "";
    let s = String(input);
  
    // Уніфікуємо тире/дефіси
    s = s.replace(/[\u2012\u2013\u2014\u2212]/g, "-");
  
    // Іноді трапляється кирилична "х" замість латинської "x" в 05х01
    s = s.replace(/х/gi, "x");
  
    // Нерозривні пробіли та множинні пробіли
    s = s.replace(/\u00A0/g, " ");
    s = s.replace(/\s+/g, " ").trim();
  
    return s;
  }
  
  function clampConfidence(n) {
    if (!Number.isFinite(n)) return 0;
    return Math.max(0, Math.min(100, Math.round(n)));
  }
  
  function toInt(x) {
    const n = parseInt(x, 10);
    return Number.isFinite(n) ? n : null;
  }
  
  function mkRange(a, b) {
    if (a == null) return null;
    if (b == null || b === a) return { start: a, end: a };
    return { start: Math.min(a, b), end: Math.max(a, b) };
  }
  
  function isPlausibleSeason(n) {
    return Number.isInteger(n) && n >= 1 && n <= 60; // запас на майбутнє/аніме
  }
  
  function isPlausibleEpisode(n) {
    // У аніме типу One Piece епізодів може бути сильно більше 500.
    return Number.isInteger(n) && n >= 0 && n <= 5000; // 0 для спецвипусків
  }
  
  function isYearLikeRange(a, b) {
    if (!Number.isInteger(a) || !Number.isInteger(b)) return false;
    if (a < 1900 || a > 2100) return false;
    if (b < 1900 || b > 2100) return false;
    if (b < a) return false;
    // Типові роки релізу: 1999-2024, 2010-2013 тощо.
    return (b - a) <= 60;
  }
  
  /**
   * Перевіряє, чи є тайтл "сміттям" (фільми, спецвипуски тощо)
   */
  function isTrash(title) {
    const lowTitle = title.toLowerCase();
    
    // Список патернів, які однозначно кажуть, що це не серіал або не епізод серіалу
    // Використовуємо unicode-friendly межі слова
    const trashPatterns = [
      /(?:^|[^\p{L}\p{N}])(фільм|фильм|film|movie|movies)(?=$|[^\p{L}\p{N}])/iu,
      // NB: "спешл" часто пишуть без "е", а "specials" — у множині
      /(?:^|[^\p{L}\p{N}])(спецвыпуск|спецвипуск|special|specials|sp|ova|ona|bonus|extra|екстра|спешл|спешел|спэшл|ова|она)(?=$|[^\p{L}\p{N}])/iu,
      /(?:^|[^\p{L}\p{N}])(трейлер|trailer|teaser|тизер)(?=$|[^\p{L}\p{N}])/iu,
      /(?:^|[^\p{L}\p{N}])(саундтрек|ost|soundtrack)(?=$|[^\p{L}\p{N}])/iu,
      /(?:^|[^\p{L}\p{N}])(кліп|clip|pv)(?=$|[^\p{L}\p{N}])/iu,
      /(?:^|[^\p{L}\p{N}])(інтерв'ю|interview)(?=$|[^\p{L}\p{N}])/iu,
      /(?:^|[^\p{L}\p{N}])(репортаж|report)(?=$|[^\p{L}\p{N}])/iu,
      /(?:^|[^\p{L}\p{N}])(промо|promo)(?=$|[^\p{L}\p{N}])/iu,
      /(?:^|[^\p{L}\p{N}])(уривок|preview)(?=$|[^\p{L}\p{N}])/iu,
      /(?:^|[^\p{L}\p{N}])(анонс|announcement)(?=$|[^\p{L}\p{N}])/iu,
      /(?:^|[^\p{L}\p{N}])(зйомки|making of|behind the scenes)(?=$|[^\p{L}\p{N}])/iu,
      /(?:^|[^\p{L}\p{N}])(збірник|collection)(?=$|[^\p{L}\p{N}])/iu,
      /(?:^|[^\p{L}\p{N}])(документальний|docu|documentary)(?=$|[^\p{L}\p{N}])/iu,
      /(?:^|[^\p{L}\p{N}])(концерт|concert|live)(?=$|[^\p{L}\p{N}])/iu,
      // Аніме-специфічні фільми та спецвипуски
      /movie\s*\d+/i,
      /film\s*\d+/i,
      /(?:^|[^\p{L}\p{N}])(мультфільм|аніме-фільм|спецепізод|спецсерія)(?=$|[^\p{L}\p{N}])/iu,
      /\bepisode of\b/i,
    ];
  
    for (const pattern of trashPatterns) {
      if (pattern.test(lowTitle)) return true;
    }
    
    return false;
  }
  
  function extractEpisodeTotal(title) {
    // "из 08", "з 8", "of 8"
    const m = /(?:^|[^\p{L}\p{N}])(?:из|з|of)\s*(\d{1,4})(?=$|[^\p{L}\p{N}])/iu.exec(title);
    if (!m) return null;
    const n = toInt(m[1]);
    return isPlausibleEpisode(n) ? n : null;
  }
  
  function isLikelyVoiceChannelXxXx(title, matchIndex, matchText) {
    // Основний хибнопозитивний кейс із ваших даних: "ДБ (2x2)"
    const compact = String(matchText).toLowerCase().replace(/\s+/g, "");
    if (compact === "2x2") return true;
  
    const before = title.slice(Math.max(0, matchIndex - 12), matchIndex).toLowerCase();
    const after = title.slice(matchIndex + matchText.length, matchIndex + matchText.length + 12).toLowerCase();
  
    const looksLikeDubContext = /(дб|dub)\s*\(/i.test(before);
    const looksLikeCloseParen = /^\s*\)/.test(after);
  
    return looksLikeDubContext && looksLikeCloseParen;
  }
  
  function scoreCandidate({ season, seasonRange, episode, episodeRange, base, title }) {
    if (title && isTrash(title)) return 0;
    let score = base;
  
    const s = season ?? seasonRange?.start ?? null;
    const e = episode ?? episodeRange?.start ?? null;
  
    if (s != null) score += 10;
    if (e != null) score += 10;
    if (s != null && e != null) score += 15;
  
    // Плюс за наявність діапазонів (зазвичай це "серії 1-4")
    if (seasonRange && seasonRange.end !== seasonRange.start) score += 5;
    if (episodeRange && episodeRange.end !== episodeRange.start) score += 5;
  
    // Жорсткі штрафи за малоймовірні значення (щоб не чіпляти 2025/2160p тощо)
    if (s != null && !isPlausibleSeason(s)) score -= 60;
    if (e != null && !isPlausibleEpisode(e)) score -= 60;
  
    return clampConfidence(score);
  }
  
  /**
   * Головна функція.
   */
  function extractSeasonEpisode(rawTitle) {
    const title = normalizeTitle(rawTitle);
    const episodeTotal = extractEpisodeTotal(title);
  
    // Вимога: фільми/спешли/OVA/extra тощо не цікавлять — вважаємо сміттям
    if (isTrash(title)) {
      return { season: null, episode: null, source: "trash", confidence: 0 };
    }
    const seasonCandidates = [];
    const episodeCandidates = [];
  
    // 1) Найнадійніші формати: S05E01, 05x01, 05x01-03, S05x01
    {
      // S05E01 / S5E1 / S05E01-03 / S05E01-E03 / S01x01
      const m = /s(\d{1,2})\s*[ex](\d{1,3})(?:\s*[-]\s*[ex]?(\d{1,3}))?\b/i.exec(title);
      if (m) {
        const season = toInt(m[1]);
        const e1 = toInt(m[2]);
        const e2 = toInt(m[3]);
        const episodeRange = mkRange(e1, e2);
        const episode = episodeRange ? episodeRange.start : null;
        
        if (isPlausibleSeason(season)) {
          seasonCandidates.push({ season, base: 90, name: "SxxEyy" });
        }
        if (isPlausibleEpisode(episode)) {
          episodeCandidates.push({ episode, episodeRange, base: 90, name: "SxxEyy" });
        }
      }
    }
  
    // 1.2) Компактні пакети по сезонах: 01-03x01-21 (сезони 1-3, серії 1-21)
    // Приклади: cevamnelampaplagin
    // - The Witcher [01-03x01-21 из 24]
    // - The Witcher [01-03x01-17 из 24]
    {
      const m = /\b(\d{1,2})\s*[-]\s*(\d{1,2})\s*x\s*(\d{1,3})(?:\s*[-]\s*(\d{1,4}))?\b/i.exec(title);
      if (m) {
        // Важливий фільтр: не плутати з "2x2" (канал/озвучка)
        if (!isLikelyVoiceChannelXxXx(title, m.index, m[0])) {
          const s1 = toInt(m[1]);
          const s2 = toInt(m[2]);
          const e1 = toInt(m[3]);
          const e2 = toInt(m[4]);
  
          const sRange = mkRange(s1, s2);
          const eRange = mkRange(e1, e2);
  
          if (sRange && isPlausibleSeason(sRange.start) && isPlausibleSeason(sRange.end)) {
            seasonCandidates.push({
              season: sRange.start,
              seasonRange: sRange.start !== sRange.end ? sRange : undefined,
              base: 92,
              name: "Srange x Erange",
            });
          }
          if (eRange && isPlausibleEpisode(eRange.start) && isPlausibleEpisode(eRange.end)) {
            episodeCandidates.push({
              episode: eRange.start,
              episodeRange: eRange.start !== eRange.end ? eRange : undefined,
              base: 92,
              name: "Srange x Erange",
            });
          }
        }
      }
    }
  
    {
      // 05x01 / 5x1 / 05x01-03
      const m = /\b(\d{1,2})\s*x\s*(\d{1,3})(?:\s*[-]\s*(\d{1,3}))?\b/i.exec(title);
      if (m) {
        if (isLikelyVoiceChannelXxXx(title, m.index, m[0])) {
          // "ДБ (2x2)" і подібне — не сезон/серія
        } else {
        const season = toInt(m[1]);
        const e1 = toInt(m[2]);
        const e2 = toInt(m[3]);
        const episodeRange = mkRange(e1, e2);
        const episode = episodeRange ? episodeRange.start : null;
        
        if (isPlausibleSeason(season)) {
          seasonCandidates.push({ season, base: 85, name: "xxXyy" });
        }
        if (isPlausibleEpisode(episode)) {
          episodeCandidates.push({ episode, episodeRange, base: 85, name: "xxXyy" });
        }
        }
      }
    }
  
    // 1.5) Частий формат для аніме/пакетів: діапазон серій або одна серія в []/()
    // Приклади:
    // - One Piece [1061-1121]
    // - One Piece (892-1051 серії)
    // - One Piece [1999, TV, 207-1122 еп.]
    // - One Piece [383 из ???]
    {
      // У квадратних або круглих дужках
      const mList = title.matchAll(/[\[\(]([^\]\)]+)[\]\)]?/g);
      for (const m of mList) {
        const inside = m[1];
        
        // Шукаємо діапазон: 1061-1121
        const rm = /(\d{1,4})\s*[-]\s*(\d{1,4})/g;
        let r;
        while ((r = rm.exec(inside)) !== null) {
          const a = toInt(r[1]);
          const b = toInt(r[2]);
          if (a == null || b == null || isYearLikeRange(a, b)) continue;
  
          const tail = inside.slice(r.index + r[0].length, r.index + r[0].length + 12).toLowerCase();
          const head = inside.slice(Math.max(0, r.index - 12), r.index).toLowerCase();
          const hasEpisodeHints = /(эп|еп|ep|из|з|of|tv|series|сер)/i.test(head + " " + tail);
  
          const looksLikeEpisodes = hasEpisodeHints || Math.max(a, b) >= 50;
          if (!looksLikeEpisodes) continue;
  
          const episodeRange = mkRange(a, b);
          const episode = episodeRange?.start ?? null;
          episodeCandidates.push({
            episode: isPlausibleEpisode(episode) ? episode : null,
            episodeRange: episodeRange && isPlausibleEpisode(episodeRange.start) ? episodeRange : undefined,
            base: hasEpisodeHints ? 75 : 70,
            name: "bracket range"
          });
        }
  
        // Шукаємо одиничне число з позначкою серії: [383 из ...], [еп 100], [серія 5]
        const sm = /(?:^|[^\d])(\d{1,4})(?:\s*(?:из|з|эп|еп|ep|сер|of|from))(?=$|[^\d])/i;
        const sm2 = /(?:эп|еп|ep|сер|серія|серия)\s*(\d{1,4})(?=$|[^\d])/i;
        
        const r_sm = sm.exec(inside) || sm2.exec(inside);
        if (r_sm) {
          const e = toInt(r_sm[1]);
          if (isPlausibleEpisode(e)) {
            episodeCandidates.push({
              episode: e,
              base: 65,
              name: "bracket single"
            });
          }
        }
      }
    }
  
    // 2) "Сезон: 5 / Серії: 1-4 з 8", "5 сезон: 1-7 серії з 8", укр "Сезон 5, серії 1-7"
  
    // Сезон: 5 / Сезони 1-4 / Season 5 / Season: 5
    {
      const reList = [
        // NB: \b в JS НЕ unicode-friendly (кирилиця не вважається \w), тому для RU/UA використовуємо \p{L}\p{N}
        // Найнадійніший RU/UA-формат: "5 сезон ..."
        { re: /(?:^|[^\p{L}\p{N}])(\d{1,2})(?:\s*[-]\s*(\d{1,2}))?\s*сезон(?:а|и|ів)?(?=$|[^\p{L}\p{N}])/iu, base: 75, name: "N сезон" },
  
        // "Сезон 5" або "Сезони 1-4"
        { re: /(?:^|[^\p{L}\p{N}])сезон(?:а|и|ів)?\s*(\d{1,2})(?:\s*[-]\s*(\d{1,2}))?(?=$|[^\p{L}\p{N}])/iu, base: 70, name: "Сезон N" },
  
        // "Сезон: 5" (ВАЖЛИВО: не плутати з "5 сезон: 1-7 серії", де після двокрапки йдуть серії)
        { re: /(?:^|[^\p{L}\p{N}])сезон(?:а|и|ів)?\s*:\s*(\d{1,2})(?:\s*[-]\s*(\d{1,2}))?/iu, base: 66, name: "Сезон: N" },
        { re: /\bseason\s*[: ]\s*(\d{1,2})(?:\s*[-]\s*(\d{1,2}))?\b/i, base: 55, name: "Season:" },
        { re: /\bseason\s*(\d{1,2})\b/i, base: 52, name: "Season N" },
        // У квадратних дужках [S01] - дуже надійно
        { re: /\[\s*s(\d{1,2})\s*\]/i, base: 80, name: "[Sxx]" },
        { re: /\bs(\d{1,2})\b/i, base: 50, name: "Sxx (season-only)" }, // наприклад "Stranger Things S05 ..."
      ];
  
      for (const { re, base, name } of reList) {
        const m = re.exec(title);
        if (!m) continue;
        // Пост-фільтр тільки для "Сезон: N": якщо одразу після матча йде "серії/episodes" БЕЗ роздільників на зразок "/" або "|" — це не сезон.
        if (name === "Сезон: N") {
          const afterMatch = title.slice(m.index + m[0].length, m.index + m[0].length + 20).toLowerCase();
          // Якщо одразу йде "серії", то це скоріше "Сезон: 1-8 серії" (де 1-8 це серії, а не сезон)
          // Але якщо є роздільник типу "/" або ",", то "Сезон: 1 / Серії: 1-8" — це сезон.
          if (/^[\s]* (сер|series|episode|эпиз)/i.test(afterMatch)) continue;
        }
  
        const s1 = toInt(m[1]);
        const s2 = toInt(m[2]);
        if (s1 == null) continue;
        const r = mkRange(s1, s2);
        seasonCandidates.push({
          season: r?.start ?? null,
          seasonRange: r && r.end !== r.start ? r : undefined,
          base,
          name,
        });
      }
    }
  
    // Епізоди/серії: 1-4, "1-7 серії з 8", "9 серія"
    {
      const reList = [
        { re: /(?:^|[^\p{L}\p{N}])(?:серії|серія|серій|эпизод(?:ы)?|episodes|эп\.?)\s*[: ]?\s*(\d{1,4})(?:\s*[-]\s*(\d{1,4}))?(?=$|[^\p{L}\p{N}])/iu, base: 60, name: "серії" },
        { re: /(?:^|[^\p{L}\p{N}])(\d{1,4})(?:\s*[-]\s*(\d{1,4}))?\s*(?:серії|серія|серій|эпизод(?:ы)?|эп\.?)(?=$|[^\p{L}\p{N}])/iu, base: 62, name: "1-4 серії" },
        // Діапазон + "серія" в однині: "928-929 серія"
        { re: /(?:^|[^\p{L}\p{N}])(\d{1,4})\s*[-]\s*(\d{1,4})\s*серія(?=$|[^\p{L}\p{N}])/iu, base: 62, name: "1-4 серія" },
        { re: /(?:^|[^\p{L}\p{N}])(\d{1,4})\s*(?:серія|серій)(?=$|[^\p{L}\p{N}])/iu, base: 54, name: "N серія" },
        // Формат "з N серій" або "з N"
        { re: /(?:серії|серій)\s*(\d{1,4})\s*(?:из|з)\s*(\d{1,4})/iu, base: 65, name: "серії X з Y" },
      ];
  
      for (const { re, base, name } of reList) {
        const m = re.exec(title);
        if (!m) continue;
        const e1 = toInt(m[1]);
        const e2 = toInt(m[2]);
        if (e1 == null) continue;
        const r = mkRange(e1, e2);
        episodeCandidates.push({
          episode: r?.start ?? null,
          episodeRange: r && r.end !== r.start ? r : undefined,
          base,
          name,
        });
      }
    }
  
    // Збираємо найкращий сезон і найкращі серії та об'єднуємо
    const bestSeason = seasonCandidates.sort((a, b) => b.base - a.base)[0] || null;
    const bestEpisode = episodeCandidates.sort((a, b) => b.base - a.base)[0] || null;
  
    if (bestSeason || bestEpisode) {
      const season = bestSeason?.season ?? null;
      const episode = bestEpisode?.episode ?? null;
      const seasonRange = bestSeason?.seasonRange;
      const episodeRange = bestEpisode?.episodeRange;
  
      // Легкий захист від хибних спрацьовувань за роком: якщо сезон раптом "2025" — викинемо.
      const finalSeason =
        season != null && isPlausibleSeason(season) ? season : null;
  
      const finalEpisode =
        episode != null && isPlausibleEpisode(episode) ? episode : null;
  
      const episodesCount =
        episodeRange ? (episodeRange.end - episodeRange.start + 1) : (finalEpisode != null ? 1 : null);
  
      const src = [bestSeason?.name, bestEpisode?.name].filter(Boolean).join(" + ") || "heuristic";
  
      return {
        season: finalSeason,
        seasonRange,
        episode: finalEpisode,
        episodeRange,
        episodesTotal: episodeTotal,
        episodesCount,
        source: src,
        confidence: scoreCandidate({
          season: finalSeason,
          seasonRange,
          episode: finalEpisode,
          episodeRange,
          base: Math.max(bestSeason?.base ?? 0, bestEpisode?.base ?? 0),
          title
        }),
      };
    }
  
    return { season: null, episode: null, source: "none", confidence: 0 };
  }

    /**
     * Визначення бітрейту (Мбіт/с)
     */
    function getBitrate(item, movie, isSerial = false, fallbackEpCount = 1, useFfprobe = false) {
        const title = item.Title || item.title || '';
        const size = item.Size || item.size_bytes || 0;
        const dbg = { source: null };
        
        // 1) FFPROBE (опціонально). За замовчуванням вимкнено, щоб бітрейт завжди рахувався однаково "як у Лампі"
        // і не було розбіжностей між роздачами з ffprobe і без нього.
        if (useFfprobe && item.ffprobe && Array.isArray(item.ffprobe)) {
            const video = item.ffprobe.find(s => s.codec_type === 'video');
            if (video) {
                if (video.tags && video.tags.BPS) {
                    const bps = parseInt(video.tags.BPS, 10);
                    if (!isNaN(bps) && bps > 0) {
                        dbg.source = 'ffprobe.tags.BPS';
                        dbg.bps = bps;
                        dbg.mbps = Math.round(bps / 1000000);
                        item._et_bitrate_debug = dbg;
                        return dbg.mbps;
                    }
                }
                if (video.bit_rate) {
                    const bitrate = parseInt(video.bit_rate, 10);
                    if (!isNaN(bitrate) && bitrate > 0) {
                        dbg.source = 'ffprobe.video.bit_rate';
                        dbg.bit_rate = bitrate;
                        dbg.mbps = Math.round(bitrate / 1000000);
                        item._et_bitrate_debug = dbg;
                        return dbg.mbps;
                    }
                }
            }
        }
        
        // 2) РОЗРАХУНОК ІЗ РОЗМІРУ ТА ТРИВАЛОСТІ (основний шлях)
        let runtime = movie?.runtime || movie?.duration || movie?.episode_run_time;
        
        // Якщо runtime - це масив (часто у серіалів), беремо середнє або перше значення
        if (Array.isArray(runtime)) {
            runtime = runtime.length > 0 ? runtime[0] : 0;
        }
        
        // Дефолт для серіалів, якщо тривалість зовсім не вказана
        if (!runtime && isSerial) runtime = 45;

        if (size > 0 && runtime > 0) {
            let epCount = 1;
            
            // МАГІЯ ПАКІВ ВМИКАЄТЬСЯ ТІЛЬКИ ДЛЯ СЕРІАЛІВ
            if (isSerial && typeof extractSeasonEpisode === 'function') {
                const epInfo = extractSeasonEpisode(title);
                
                if (epInfo && epInfo.episodesCount && epInfo.episodesCount > 1) {
                    epCount = epInfo.episodesCount;
                } else if (fallbackEpCount > 1) {
                    const is4K = /\b2160p\b|4k\b/i.test(title);
                    const threshold = is4K ? 30 * 1024 * 1024 * 1024 : 10 * 1024 * 1024 * 1024;
                    if (size > threshold) {
                        epCount = fallbackEpCount;
                    }
                }
            }

            const totalSeconds = (runtime * 60) * epCount;
            const bitSize = size * 8;
            const mbpsRaw = (bitSize / Math.pow(1000, 2)) / totalSeconds;
            const mbps = Math.round(mbpsRaw);
            
            // Зберігаємо захист від аномалій, але робимо кап налаштовуваним через конфіг
            const cap = USER_CONFIG?.scoring_rules?.bitrate_bonus?.max_mbps_cap;
            const maxCap = typeof cap === 'number' && cap > 0 ? cap : 150;
            if (mbps > 0) {
                dbg.source = 'size+duration';
                dbg.size_bytes = size;
                dbg.runtime_min = runtime;
                dbg.epCount = epCount;
                dbg.totalSeconds = totalSeconds;
                dbg.bitSize_bits = bitSize;
                dbg.mbps_raw = mbpsRaw;
                dbg.mbps_rounded = mbps;
                dbg.maxCap = maxCap;
                dbg.mbps = Math.min(mbps, maxCap);
                item._et_bitrate_debug = dbg;
                return dbg.mbps;
            }
        }
        
        // 3. З поля bitrate торрента (якщо є)
        if (item.bitrate) {
            const match = String(item.bitrate).match(/(\d+\.?\d*)/);
            if (match) {
                dbg.source = 'item.bitrate';
                dbg.raw = item.bitrate;
                dbg.mbps = Math.round(parseFloat(match[1]));
                item._et_bitrate_debug = dbg;
                return dbg.mbps;
            }
        }
        
        // 4. З назви торрента
        const bitrateMatch = title.match(/(\d+\.?\d*)\s*(?:Mbps|Мбіт)/i);
        if (bitrateMatch) {
            dbg.source = 'title';
            dbg.raw = bitrateMatch[0];
            dbg.mbps = Math.round(parseFloat(bitrateMatch[1]));
            item._et_bitrate_debug = dbg;
            return dbg.mbps;
        }
        
        dbg.source = 'unknown';
        item._et_bitrate_debug = dbg;
        return 0;
    }

    /**
     * Збірка всіх features торрента
     */
    /**
     * Збірка всіх features торрента
     */
    function buildFeatures(item, movie, isSerial = false, fallbackEpCount = 1) {
        const title = (item.Title || item.title || '').toLowerCase();
        const foundAudio = [];

        // 1. Збираємо озвучки з ffprobe
        if (item.ffprobe && Array.isArray(item.ffprobe)) {
            const audioTracks = item.ffprobe.filter(s => s.codec_type === 'audio');
            audioTracks.forEach(track => {
                const analyzed = analyzeAudioTrack(track);
                analyzed.forEach(type => {
                    if (!foundAudio.includes(type)) foundAudio.push(type);
                });
            });
        }

        // 2. Доповнюємо озвучками з назви
        AUDIO_TRACKS.forEach(tr => {
            if (foundAudio.includes(tr.id)) return;

            // Для загального "Дубляж" не намагаємося вгадувати за словом "дубляж" (забагато хибних спрацьовувань).
            // Але короткий токен "ДБ"/"Dub" — це достатньо надійний маркер дубляжу (RU) і очікувана поведінка.
            if (tr.id === 0) {
                const aliases = Array.isArray(tr.aliases) ? tr.aliases : [];
                const shortAliases = aliases.filter(a => String(a).trim().length <= 3); // 'дб', 'dub', etc.
                const match = shortAliases.some(alias => matchAliasInText(title, alias));
                if (match) foundAudio.push(tr.id);
                return;
            }

            // Український дубляж за тайтлом не вгадуємо (потрібно явне 'ukr/ua/укр' у тайтлі або ffprobe lang)
            if (tr.id === 1) return;

            const aliases = Array.isArray(tr.aliases) ? tr.aliases : [];
            const match = aliases.some(alias => matchAliasInText(title, alias));
            if (match) foundAudio.push(tr.id);
        });

        return {
            resolution: detectResolution(item),
            hdr_type: detectHdr(item),
            audio_tracks: foundAudio,
            audio_quality: detectAudioQuality(item),
            bitrate: getBitrate(item, movie, isSerial, fallbackEpCount)
        };
    }

    // ═══════════════════════════════════════════════════════════════════
    // РОЗДІЛ 3: МАГІЯ СКОРИНГУ ТА РЕКОМЕНДАЦІЙ
    // ═══════════════════════════════════════════════════════════════════

    const AUDIO_LANGUAGES = {
        'rus': ['rus', 'ru', 'russian'],
        'ukr': ['ukr', 'ua', 'ukrainian'],
        'eng': ['eng', 'en', 'english', 'und']
    };

    // Швидкий мапінг "будь-який код мови" -> канонічний ключ (rus/ukr/eng)
    const AUDIO_LANG_CANON_BY_CODE = (() => {
        const map = Object.create(null);
        Object.keys(AUDIO_LANGUAGES).forEach(k => {
            (AUDIO_LANGUAGES[k] || []).forEach(code => {
                map[String(code).toLowerCase()] = k;
            });
        });
        // канонічні ключі теж вважаємо валідними
        Object.keys(AUDIO_LANGUAGES).forEach(k => (map[k] = k));
        return map;
    })();

    function canonicalizeAudioLanguage(lang) {
        if (!lang) return null;
        const s = String(lang).toLowerCase();
        return AUDIO_LANG_CANON_BY_CODE[s] || s;
    }

    function getAllowedAudioLanguagesSet() {
        const arr = USER_CONFIG && USER_CONFIG.preferences && Array.isArray(USER_CONFIG.preferences.languages)
            ? USER_CONFIG.preferences.languages
            : [];
        const set = new Set();
        arr.forEach(l => {
            const c = canonicalizeAudioLanguage(l);
            if (c) set.add(c);
        });
        return set;
    }

    /**
     * Єдина модель "озвучок" (аудіо-треків).
     * Важливо: одна й та сама студія може зустрічатися в різних мовах.
     *
     * - id: стабільний ключ (використовується всередині features)
     * - type: DUB/MVO/AVO/PRO/ORIG тощо.
     * - name: відображуване ім'я
     * - aliases: аліаси/маркерні рядки (для розпізнавання з ffprobe/title)
     * - languages: список мов (ISO-639-2/коди)
     */
    const AUDIO_TRACKS = [
        { id: 0, type: 'DUB', name: 'Дубляж RU', aliases: ['дб', 'дубляж', 'dub'], languages: ['rus'] },
        { id: 1, type: 'DUB', name: 'Дубляж UKR', aliases: ['ukr', 'ua', 'укр', 'укра', 'дубляж'], languages: ['ukr'] },

        { id: 2, type: 'DUB', name: 'Дубляж Пифагор', aliases: ['пифагор'], languages: ['rus'] },
        { id: 3, type: 'DUB', name: 'Дубляж Red Head Sound', aliases: ['red head sound', 'rhs'], languages: ['rus'] },
        { id: 4, type: 'DUB', name: 'Дубляж Videofilm', aliases: ['videofilm'], languages: ['rus'] },
        { id: 5, type: 'DUB', name: 'Дубляж MovieDalen', aliases: ['moviedalen'], languages: ['rus'] },
        { id: 6, type: 'DUB', name: 'Дубляж LeDoyen', aliases: ['ledoyen'], languages: ['rus'] },
        { id: 7, type: 'DUB', name: 'Дубляж Whiskey Sound', aliases: ['whiskey sound'], languages: ['rus'] },
        { id: 8, type: 'DUB', name: 'Дубляж IRON VOICE', aliases: ['iron voice'], languages: ['rus'] },
        { id: 9, type: 'DUB', name: 'Дубляж AlexFilm', aliases: ['alexfilm'], languages: ['rus'] },
        { id: 10, type: 'DUB', name: 'Дубляж Amedia', aliases: ['amedia'], languages: ['rus'] },

        { id: 11, type: 'MVO', name: 'MVO HDRezka', aliases: ['hdrezka', 'rezka', 'hdrezka studio', 'rezka studio'], languages: ['rus', 'ukr'] },
        { id: 12, type: 'MVO', name: 'MVO LostFilm', aliases: ['lostfilm', 'lf'], languages: ['rus'] },
        { id: 13, type: 'MVO', name: 'MVO TVShows', aliases: ['tvshows', 'tv shows'], languages: ['rus'] },
        { id: 14, type: 'MVO', name: 'MVO Jaskier', aliases: ['jaskier', 'жаскир'], languages: ['rus'] },
        { id: 15, type: 'MVO', name: 'MVO RuDub', aliases: ['rudub'], languages: ['rus'] },
        { id: 16, type: 'MVO', name: 'MVO LE-Production', aliases: ['le-production', 'le production'], languages: ['rus'] },
        { id: 17, type: 'MVO', name: 'MVO Кубик в Кубе', aliases: ['кубик в кубе'], languages: ['rus'] },
        { id: 18, type: 'MVO', name: 'MVO NewStudio', aliases: ['newstudio', 'new studio', 'нью студио'], languages: ['rus'] },
        { id: 19, type: 'MVO', name: 'MVO Good People', aliases: ['good people'], languages: ['rus'] },
        { id: 20, type: 'MVO', name: 'MVO IdeaFilm', aliases: ['ideafilm', 'idea film'], languages: ['rus'] },
        { id: 21, type: 'MVO', name: 'MVO AMS', aliases: ['ams'], languages: ['rus'] },
        { id: 22, type: 'MVO', name: 'MVO Baibako', aliases: ['baibako'], languages: ['rus'] },
        { id: 23, type: 'MVO', name: 'MVO Profix Media', aliases: ['profix media', 'profix'], languages: ['rus'] },
        { id: 24, type: 'MVO', name: 'MVO NewComers', aliases: ['newcomers', 'new comers'], languages: ['rus'] },
        { id: 25, type: 'MVO', name: 'MVO GoLTFilm', aliases: ['goltfilm', 'golt film'], languages: ['rus'] },
        { id: 26, type: 'MVO', name: 'MVO JimmyJ', aliases: ['jimmyj', 'jimmy j'], languages: ['rus'] },
        { id: 27, type: 'MVO', name: 'MVO Kerob', aliases: ['kerob'], languages: ['rus'] },
        { id: 28, type: 'MVO', name: 'MVO LakeFilms', aliases: ['lakefilms', 'lake films'], languages: ['rus'] },
       
        { id: 29, type: 'MVO', name: 'MVO Twister', aliases: ['twister'], languages: ['rus'] },
        { id: 30, type: 'MVO', name: 'MVO Voice Project', aliases: ['voice project'], languages: ['rus'] },
        { id: 31, type: 'MVO', name: 'MVO Dragon Money Studio', aliases: ['dragon money', 'dms'], languages: ['rus'] },
        { id: 32, type: 'MVO', name: 'MVO Syncmer', aliases: ['syncmer'], languages: ['rus'] },
        { id: 33, type: 'MVO', name: 'MVO ColdFilm', aliases: ['coldfilm', 'cold film'], languages: ['rus'] },
        { id: 34, type: 'MVO', name: 'MVO SunshineStudio', aliases: ['sunshinestudio', 'sunshine studio'], languages: ['rus'] },
        { id: 35, type: 'MVO', name: 'MVO Ultradox', aliases: ['ultradox'], languages: ['rus'] },
        { id: 36, type: 'MVO', name: 'MVO Octopus', aliases: ['octopus'], languages: ['rus'] },
        { id: 37, type: 'MVO', name: 'MVO OMSKBIRD', aliases: ['omskbird records', 'omskbird'], languages: ['rus'] },

        { id: 38, type: 'AVO', name: 'AVO Володарский', aliases: ['володарский'], languages: ['rus'] },
        { id: 39, type: 'AVO', name: 'AVO Яроцкий', aliases: ['яроцкий', 'м. яроцкий'], languages: ['rus'] },
        { id: 40, type: 'AVO', name: 'AVO Сербин', aliases: ['сербин', 'ю. сербин'], languages: ['rus'] },

        { id: 41, type: 'PRO', name: 'PRO Gears Media', aliases: ['gears media'], languages: ['rus'] },
        { id: 42, type: 'PRO', name: 'PRO Hamsterstudio', aliases: ['hamsterstudio', 'hamster'], languages: ['rus'] },
        { id: 43, type: 'PRO', name: 'PRO P.S.Energy', aliases: ['p.s.energy', 'ps energy', 'p s energy'], languages: ['rus'] },

        { id: 44, type: 'UKR', name: 'UKR НеЗупиняйПродакшн', aliases: ['незупиняйпродакшн', 'незупиняй', 'nezupyniai'], languages: ['ukr'] },

        { id: 45, type: 'ORIG', name: 'Original', aliases: ['original', 'eng', 'english'], languages: ['eng'] }
    ];

    // Оптимізація: використовуємо Map під числові id і швидкий пошук за name
    const AUDIO_TRACK_BY_ID = new Map();              // id:number -> track
    const AUDIO_TRACK_ID_BY_NAME = new Map();         // nameLower:string -> id:number
    const AUDIO_TRACK_NAMES = new Set();              // name:string

    AUDIO_TRACKS.forEach(t => {
        AUDIO_TRACK_BY_ID.set(t.id, t);
        AUDIO_TRACK_ID_BY_NAME.set(String(t.name || '').toLowerCase(), t.id);
        AUDIO_TRACK_NAMES.add(t.name);
    });

    function normalizeAudioTrackIdOrNull(key) {
        if (key === null || key === undefined) return null;

        // Уже числовий id
        if (typeof key === 'number' && Number.isFinite(key)) {
            return AUDIO_TRACK_BY_ID.has(key) ? key : null;
        }

        const s = String(key).trim();
        if (!s) return null;

        // Строковий числовий id
        if (/^\d+$/.test(s)) {
            const n = parseInt(s, 10);
            return AUDIO_TRACK_BY_ID.has(n) ? n : null;
        }

        // Ім'я треку з конфігу
        const byName = AUDIO_TRACK_ID_BY_NAME.get(s.toLowerCase());
        return (typeof byName === 'number') ? byName : null;
    }

    function matchAliasInText(text, alias) {
        if (!text || !alias) return false;
        const t = String(text).toLowerCase();
        const a = String(alias).toLowerCase();
        if (!a) return false;

        // Короткі аліаси — тільки як окреме слово
        if (a.length <= 3) {
            const escaped = a.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            try {
                const re = new RegExp(`(?:^|[^\\p{L}\\p{N}])${escaped}(?=$|[^\\p{L}\\p{N}])`, 'iu');
                return re.test(t);
            } catch (e) {
                const re = new RegExp(`(?:^|[^a-z0-9_])${escaped}(?=$|[^a-z0-9_])`, 'i');
                return re.test(t);
            }
        }
        return t.includes(a);
    }

    /**
     * Зіставлення аудіо-доріжки з типом із пріоритету
     */
    function matchesAudioType(audioTrack, type) {
        if (!audioTrack || !type) return false;

        const trackId = normalizeAudioTrackIdOrNull(audioTrack);
        const wantedId = normalizeAudioTrackIdOrNull(type);

        // 1) Якщо обидва значення нормалізувалися в id — порівнюємо за id
        if (trackId !== null && wantedId !== null) return trackId === wantedId;

        // 2) Якщо пріоритет не розпізнано — збіг неможливий
        if (wantedId === null) return false;

        // 3) Backward-compat: якщо прийшов "сирий" рядок (не id/не name), пробуємо зматчити за аліасами потрібного треку
        const wanted = AUDIO_TRACK_BY_ID.get(wantedId);
        if (!wanted) return false;

        const raw = String(audioTrack).toLowerCase();
        return (wanted.aliases || []).some(alias => matchAliasInText(raw, alias));
    }

    /**
     * Аналізує ffprobe теги аудіо доріжки
     */
    function analyzeAudioTrack(track) {
        const tags = track.tags || {};
        const title = (tags.title || tags.handler_name || '').toLowerCase();
        const langRaw = (tags.language || '').toLowerCase();
        const lang = canonicalizeAudioLanguage(langRaw);
        const foundTypes = [];
        const allowedLangs = getAllowedAudioLanguagesSet();

        // Якщо мова треку відома і вона НЕ входить до дозволених — не враховуємо цей трек для скорингу озвучок.
        if (lang && allowedLangs.size && !allowedLangs.has(lang)) {
            return foundTypes;
        }

        AUDIO_TRACKS.forEach(tr => {
            const aliases = Array.isArray(tr.aliases) ? tr.aliases : [];
            const langs = Array.isArray(tr.languages) ? tr.languages : [];

            // Якщо мова відома — вимагаємо сумісність за мовою
            if (lang && langs.length) {
                const okLang = langs.some(l => String(l).toLowerCase() === lang);
                if (!okLang) return;
            }

            // Спочатку: аліас == lang (наприклад 'ukr'), допускаємо і raw-синоніми
            const langMatch = lang
                ? aliases.some(a => {
                    const al = String(a).toLowerCase();
                    return al === lang || (langRaw && al === langRaw);
                })
                : false;
            // Потім: аліаси в назві/handler
            const textMatch = aliases.some(a => matchAliasInText(title, a));

            if (langMatch || textMatch) foundTypes.push(tr.id);
        });
        
        return foundTypes;
    }

    /**
     * Рушій підрахунку балів на основі USER_CONFIG
     */
    function buildConfigBasedScorer() {
        const cfg = USER_CONFIG;
        const rules = cfg.scoring_rules;
        
        return function calculateScore(torrent) {
            let score = typeof rules.base_score === 'number' ? rules.base_score : 100;
            const features = torrent.features;
            const seeds = torrent.Seeds || torrent.seeds || torrent.Seeders || torrent.seeders || 0;
            
            let breakdown = {
                base: score,
                resolution: 0,
                hdr: 0,
                bitrate: 0,
                availability: 0,
                audio_track: 0,
                audio_quality: 0,
                special: 0
            };

            // 1) РОЗДІЛЬНІСТЬ (значення вже фінальні, візард їх зважив)
            const resScore = (rules.resolution && (rules.resolution[features.resolution] || rules.resolution[String(features.resolution)])) || 0;
            breakdown.resolution = resScore;
            score += resScore;
            
            // 2) HDR (значення вже фінальні)
            let hdrScore = (rules.hdr && rules.hdr[features.hdr_type]) || 0;
            breakdown.hdr = hdrScore;
            score += hdrScore;
            
            // 3) БІТРЕЙТ (thresholds.bonus вже фінальні)
            let bitrateScore = 0;
            
            if (features.bitrate > 0) {
                const thresholds = (rules.bitrate_bonus && Array.isArray(rules.bitrate_bonus.thresholds)) ? rules.bitrate_bonus.thresholds : [];
                for (const threshold of thresholds) {
                    if (features.bitrate >= threshold.min && features.bitrate < threshold.max) {
                        bitrateScore = threshold.bonus || 0;
                        break;
                    }
                }
            } else {
                // Немає даних бітрейту — штраф задається візардом
                bitrateScore = (rules.bitrate_bonus && typeof rules.bitrate_bonus.missing_penalty === 'number')
                    ? rules.bitrate_bonus.missing_penalty
                    : 0;
            }
            breakdown.bitrate = bitrateScore;
            score += bitrateScore;
            
            // 4) ОЗВУЧКА (нормалізований внесок, не залежить від довжини списку)
            // Важливо: тут очікуються ТІЛЬКИ числові id (і в cfg.audio_track_priority, і в features.audio_tracks).
            const audioPriority = Array.isArray(cfg.audio_track_priority) ? cfg.audio_track_priority : [];
            const audioTracks = Array.isArray(features.audio_tracks) ? features.audio_tracks : [];
            let audioScore = 0;

            if (audioPriority.length && audioTracks.length) {
                const trackSet = new Set(audioTracks.filter(v => typeof v === 'number' && Number.isFinite(v)));
            
            for (let i = 0; i < audioPriority.length; i++) {
                    const id = audioPriority[i];
                    if (!(typeof id === 'number' && Number.isFinite(id))) continue;
                    if (!trackSet.has(id)) continue;

                    const maxPoints = rules.audio_track && typeof rules.audio_track.max_points === 'number'
                        ? rules.audio_track.max_points
                        : 0;
                    const n = audioPriority.length;
                    const factor = n <= 1 ? 1 : (1 - (i / (n - 1))); // 1..0
                    audioScore = maxPoints * factor;
                    break;
                }
            }
            breakdown.audio_track = audioScore;
            score += audioScore;

            // 5) ЯКІСТЬ ЗВУКУ (канали/Atmos)
            const aqType = features.audio_quality || 'unknown';
            const aqPoints = (rules.audio_quality && rules.audio_quality.points && typeof rules.audio_quality.points[aqType] === 'number')
                ? rules.audio_quality.points[aqType]
                : ((rules.audio_quality && rules.audio_quality.points && typeof rules.audio_quality.points.unknown === 'number') ? rules.audio_quality.points.unknown : 0);
            breakdown.audio_quality = aqPoints;
            score += aqPoints;

            // 6) ДОСТУПНІСТЬ (СІДИ) — повністю задається в rules.availability
            let availScore = 0;
            const minSeeds = (rules.availability && typeof rules.availability.min_seeds === 'number')
                ? rules.availability.min_seeds
                : (cfg.preferences?.min_seeds || 1);

            if (seeds < minSeeds) {
                availScore = (rules.availability && typeof rules.availability.below_min_penalty === 'number')
                    ? rules.availability.below_min_penalty
                    : 0;
            } else {
                const mul = (rules.availability && typeof rules.availability.log10_multiplier === 'number')
                    ? rules.availability.log10_multiplier
                    : 0;
                availScore = Math.log10(seeds + 1) * mul;
            }
            breakdown.availability = availScore;
            score += availScore;

            // 7) SPECIAL RULES (якщо візард їх поклав)
            if (Array.isArray(rules.special_rules) && rules.special_rules.length) {
                let special = 0;
                for (const rule of rules.special_rules) {
                    if (!rule || typeof rule !== 'object') continue;
                    const cond = rule.if || rule.when;
                    if (!cond || typeof cond !== 'object') continue;

                    let ok = true;
                    if (typeof cond.resolution === 'number') ok = ok && (features.resolution === cond.resolution);
                    if (typeof cond.bitrate_min === 'number') ok = ok && (features.bitrate >= cond.bitrate_min);
                    if (typeof cond.seeds_min === 'number') ok = ok && (seeds >= cond.seeds_min);
                    if (typeof cond.hdr_type === 'string') ok = ok && (features.hdr_type === cond.hdr_type);
                    if (typeof cond.audio_quality === 'string') ok = ok && ((features.audio_quality || 'unknown') === cond.audio_quality);

                    if (ok) special += (typeof rule.bonus === 'number' ? rule.bonus : 0);
                }
                breakdown.special = special;
                score += special;
            }
            
            score = Math.max(0, Math.round(score));
            
            // Відлагоджувальний вивід
            if (Lampa.Storage.get('easytorrent_show_scores', false)) {
                const title = (torrent.Title || torrent.title || '').substring(0, 80);
                console.log('[Score]', title, {
                    total: score,
                    breakdown,
                    features: {
                        resolution: features.resolution,
                        hdr_type: features.hdr_type,
                        bitrate: features.bitrate,
                        audio_tracks: features.audio_tracks,
                        audio_quality: features.audio_quality
                    },
                    seeds,
                    // paramPriority залишаємо тільки для діагностики/UX, скоринг від нього безпосередньо не залежить
                    paramPriority: (cfg.parameter_priority || []).slice(0, 3)
                });
            }
            
            return { score, breakdown };
        };
    }

    /**
     * Обробка результатів парсера: оцінка, сортування, вибір топ-N
     * ВАЖЛИВО: Модифікуємо data.Results, переміщуючи топ-N на початок масиву
     */
    function processParserResults(data, params) {
        if (!Lampa.Storage.get('easytorrent_enabled', true)) return;
        if (!data.Results || !Array.isArray(data.Results)) return;

        console.log('[EasyTorrent] Отримано від парсера:', data.Results.length, 'торрентів');

        const movie = params?.movie;
        
        /**
         * ВИЗНАЧЕННЯ ТИПУ КОНТЕНТУ (як у ядрі Lampa)
         * original_name є тільки у серіалів, у фільмів - original_title
         * також перевіряємо наявність сезонів в об'єкті
         */
        const isSerial = !!(movie && (movie.original_name || movie.number_of_seasons > 0 || movie.seasons));

        /**
         * Для серіалів: враховуємо історію перегляду (online_watched_last)
         * - якщо історія є: пріоритет роздач, що містять останню серію
         * - ще вище: якщо є і наступна серія
         * - якщо історії немає: вважаємо S01E01
         * - якщо відповідних роздач немає: працюємо як зазвичай
         */
        const getSerialWatchedTarget = () => {
            if (!isSerial || !movie) return null;

            const titleKey = movie.number_of_seasons ? movie.original_name : movie.original_title;
            if (!titleKey) return { season: 1, episode: 1, hasHistory: false };

            // file_id як у ядрі: Utils.hash(movie.number_of_seasons ? movie.original_name : movie.original_title)
            const fileId = (Lampa.Utils && typeof Lampa.Utils.hash === 'function')
                ? Lampa.Utils.hash(titleKey)
                : String(titleKey);

            const raw = Lampa.Storage.get('online_watched_last', {});
            let watchedAll = raw;
            if (typeof raw === 'string') {
                try { watchedAll = JSON.parse(raw); } catch (e) { watchedAll = {}; }
            }
            const watched = watchedAll && watchedAll[fileId] ? watchedAll[fileId] : null;

            const season = watched && Number.isFinite(parseInt(watched.season, 10)) ? parseInt(watched.season, 10) : 1;
            const episode = watched && Number.isFinite(parseInt(watched.episode, 10)) ? parseInt(watched.episode, 10) : 1;

            return { season, episode, hasHistory: !!watched };
        };

        const serialTarget = getSerialWatchedTarget();

        const episodeContains = (epInfo, targetSeason, targetEpisode) => {
            if (!epInfo) return false;

            // season match
            let seasonOk = false;
            if (epInfo.seasonRange) {
                seasonOk = targetSeason >= epInfo.seasonRange.start && targetSeason <= epInfo.seasonRange.end;
            } else if (Number.isInteger(epInfo.season)) {
                seasonOk = epInfo.season === targetSeason;
            } else {
                // якщо сезон не вказаний (часто у одно-сезонних релізів) — допускаємо тільки для S01
                seasonOk = targetSeason === 1;
            }
            if (!seasonOk) return false;

            // episode match
            if (epInfo.episodeRange) {
                return targetEpisode >= epInfo.episodeRange.start && targetEpisode <= epInfo.episodeRange.end;
            }
            if (Number.isInteger(epInfo.episode)) return epInfo.episode === targetEpisode;

            // Якщо сезон вказаний, але епізодів немає — ймовірно "повний сезон/пак"
            return true;
        };

        const getEpisodePriority = (torrentTitle, targetSeason, targetEpisode) => {
            if (!isSerial || !serialTarget) return 0;
            if (typeof extractSeasonEpisode !== 'function') return 0;

            const epInfo = extractSeasonEpisode(torrentTitle || '');
            const hasLast = episodeContains(epInfo, targetSeason, targetEpisode);
            if (!hasLast) return 0;

            const hasNext = episodeContains(epInfo, targetSeason, targetEpisode + 1);
            return hasNext ? 2 : 1;
        };

        // ПРЕ-СКАН: Розумний пошук кількості серій (ТІЛЬКИ ДЛЯ СЕРІАЛІВ)
        let maxEpisodesInSet = 1;
        
        if (isSerial && typeof extractSeasonEpisode === 'function') {
            let maxCountFound = 1; // Реальні діапазони (1-5 = 5)
            
            data.Results.forEach(el => {
                const ep = extractSeasonEpisode(el.Title || el.title || '');
                // Важливо: episodesTotal ("з N") НЕ використовуємо як кількість серій у паку
                if (ep && ep.episodesCount && ep.episodesCount > maxCountFound) maxCountFound = ep.episodesCount;
            });

            maxEpisodesInSet = maxCountFound;

            if (maxEpisodesInSet > 1 && Lampa.Storage.get('easytorrent_debug', false)) {
                console.log(`[EasyTorrent][Debug] Режим серіалу. Аналіз: Макс-діапазон серій у паку=${maxCountFound}. Використовуємо=${maxEpisodesInSet}`);
            }
        }

        const calculateScore = buildConfigBasedScorer();

        // Оцінюємо всі торренти
        const scored = data.Results.map((element, index) => {
            // Передаємо прапорець isSerial і знайдену кількість серій
            const features = buildFeatures(element, movie, isSerial, maxEpisodesInSet);
            const result = calculateScore({ ...element, features });
            return {
                element,
                originalIndex: index,
                features,
                score: result.score,
                breakdown: result.breakdown
            };
        });

        console.log('[EasyTorrent] Усі торренти оцінено');

        // Сортуємо за оцінкою
        scored.sort((a, b) => {
            if (b.score !== a.score) return b.score - a.score;
            if (b.features.bitrate !== a.features.bitrate) {
                return b.features.bitrate - a.features.bitrate;
            }
            const seedsA = a.element.Seeds || a.element.seeds || a.element.Seeders || a.element.seeders || 0;
            const seedsB = b.element.Seeds || b.element.seeds || b.element.Seeders || b.element.seeders || 0;
            return seedsB - seedsA;
        });

        // Консольний лог всіх торрентів
        if (scored.length > 0) {
            console.log('=== ВСІ ТОРРЕНТИ (відсортовано за score) ===');
            scored.forEach((t, i) => {
                const seeds = t.element.Seeds || t.element.seeds || t.element.Seeders || t.element.seeders || 0;
                const bd = t.breakdown;
                const title = t.element.Title.substring(0, 100);
                
                const breakdownParts = [];
                if (bd.audio_track !== undefined && bd.audio_track !== 0) breakdownParts.push(`A:${bd.audio_track > 0 ? '+' : ''}${Math.round(bd.audio_track)}`);
                if (bd.audio_quality !== undefined && bd.audio_quality !== 0) breakdownParts.push(`AQ:${bd.audio_quality > 0 ? '+' : ''}${Math.round(bd.audio_quality)}`);
                if (bd.resolution !== undefined && bd.resolution !== 0) breakdownParts.push(`R:${bd.resolution > 0 ? '+' : ''}${Math.round(bd.resolution)}`);
                if (bd.bitrate !== undefined && bd.bitrate !== 0) breakdownParts.push(`B:${bd.bitrate > 0 ? '+' : ''}${Math.round(bd.bitrate)}`);
                if (bd.availability !== undefined && bd.availability !== 0) breakdownParts.push(`S:${bd.availability > 0 ? '+' : ''}${Math.round(bd.availability)}`);
                if (bd.hdr !== undefined && bd.hdr !== 0) breakdownParts.push(`H:${bd.hdr > 0 ? '+' : ''}${Math.round(bd.hdr)}`);
                if (bd.special !== undefined && bd.special !== 0) breakdownParts.push(`SP:${bd.special > 0 ? '+' : ''}${Math.round(bd.special)}`);
                
                const breakdownStr = breakdownParts.length > 0 ? `[${breakdownParts.join(' ')}]` : '[no breakdown]';
                
                console.log(`${i+1}. [${t.score}] ${t.features.resolution || '?'}p ${t.features.hdr_type} ${t.features.bitrate}mb Сіди:${seeds} ${breakdownStr} | ${title}`);
            });
            console.log(`=== ВСЬОГО: ${scored.length} торрентів ===`);
        }

        // Фільтруємо за мінімальною кількістю сідів
        const recommendCount = USER_CONFIG.preferences.recommendation_count || 3;
        const minSeeds = USER_CONFIG.preferences.min_seeds || 2;
        
        const eligible = scored.filter(t => {
            const seeds = t.element.Seeds || t.element.seeds || t.element.Seeders || t.element.seeders || 0;
            return seeds >= minSeeds;
        });
        
        

        // Додаємо оцінку до ВСІХ елементів для майбутнього використання у фільтрах
        scored.forEach(t => {
            t.element._recommendScore = t.score;
            t.element._recommendBreakdown = t.breakdown;
            // зберігаємо фічі, щоб красиво відмальовувати в UI (резолюція/HDR/бітрейт)
            t.element._recommendFeatures = t.features;

            // Для серіалів: маркер пріоритету епізодів (0/1/2)
            if (isSerial && serialTarget) {
                const title = t.element.Title || t.element.title || '';
                t.element._recommendEpisodePriority = getEpisodePriority(title, serialTarget.season, serialTarget.episode);
            } else {
                t.element._recommendEpisodePriority = 0;
            }
        });

        console.log('[EasyTorrent] Усі торренти промарковано балами');
        console.log('[EasyTorrent] Топ-рекомендації збережено');
    }

    // ═══════════════════════════════════════════════════════════════════
    // РОЗДІЛ 4: UI - СТВОРЕННЯ ЕЛЕМЕНТІВ ІНТЕРФЕЙСУ
    // ═══════════════════════════════════════════════════════════════════

    /**
     * Створення HTML breakdown для бейджів
     */
    function createBreakdownHTML(breakdown) {
        if (!breakdown || Object.keys(breakdown).length === 0) return '';

        const wrap = $('<div class="torrent-recommend-panel__chips"></div>');

        const items = [
            { key: 'audio_track', name: 'Озвучка' },
            { key: 'audio_quality', name: 'Звук' },
            { key: 'resolution', name: 'Розд.' },
            { key: 'bitrate', name: 'Бітрейт' },
            { key: 'availability', name: 'Сіди' },
            { key: 'hdr', name: 'HDR' },
            { key: 'special', name: 'Бонус' }
        ];

        items.forEach(it => {
            if (breakdown[it.key] === undefined || breakdown[it.key] === 0) return;

            const value = Math.round(breakdown[it.key]);
            const sign = value > 0 ? '+' : '';
            const cls = value >= 0 ? 'tr-chip--pos' : 'tr-chip--neg';

            wrap.append(`
                <div class="tr-chip ${cls}">
                    <span class="tr-chip__name">${it.name}</span>
                    <span class="tr-chip__val">${sign}${value}</span>
                </div>
            `);
        });

        return wrap;
    }

    /**
     * Додавання бейджів до торрентів в основному списку
     */
    function onTorrentRender(data) {
        if (!Lampa.Storage.get('easytorrent_enabled', true)) return;

        const { element, item } = data;
        const showScores = Lampa.Storage.get('easytorrent_show_scores', true);
        const debug = Lampa.Storage.get('easytorrent_debug', false);

        if (typeof element._recommendRank === 'undefined') return;

        item.find('.torrent-recommend-badge').remove(); // legacy
        item.find('.torrent-recommend-panel').remove();

        const rank = element._recommendRank;
        const score = element._recommendScore;
        const breakdown = element._recommendBreakdown || {};
        const recommendCount = USER_CONFIG.preferences.recommendation_count || 3;

        // Показуємо панель: завжди для топ-N, і (опціонально) для інших якщо ввімкнено оцінки
        const shouldShowPanel = element._recommendIsIdeal || rank < recommendCount || showScores || debug;
        if (!shouldShowPanel) return;

        const features = element._recommendFeatures || {};
        const hdrMap = {
            dolby_vision: 'DV',
            hdr10plus: 'HDR10+',
            hdr10: 'HDR10',
            sdr: 'SDR'
        };

        const metaParts = [];
        if (features.resolution) metaParts.push(`${features.resolution}p`);
        if (features.hdr_type) metaParts.push(hdrMap[features.hdr_type] || String(features.hdr_type).toUpperCase());
        if (features.bitrate) metaParts.push(`${features.bitrate} Mbps`);

        let variant = 'neutral';
        let label = '';
        if (element._recommendIsIdeal) {
            variant = 'ideal';
            label = t('ideal_badge');
        } else if (rank < recommendCount) {
            variant = 'recommended';
            label = `${t('recommended_badge')} • #${rank + 1}`;
        } else {
            variant = 'neutral';
            label = 'Оцінка';
        }

        const panel = $(`<div class="torrent-recommend-panel torrent-recommend-panel--${variant}"></div>`);

        const left = $(`<div class="torrent-recommend-panel__left"></div>`);
        left.append(`<div class="torrent-recommend-panel__label">${label}</div>`);
        if (metaParts.length) left.append(`<div class="torrent-recommend-panel__meta">${metaParts.join(' • ')}</div>`);

        const right = $(`<div class="torrent-recommend-panel__right"></div>`);
        if (showScores && typeof score !== 'undefined') {
            right.append(`<div class="torrent-recommend-panel__score">${score}</div>`);
        }

        panel.append(left);

        if (showScores) {
            const chips = createBreakdownHTML(breakdown);
            if (chips) panel.append(chips);
        }

        panel.append(right);

        // Приклеюємо до низу картки, як "рідний" футер
        item.append(panel);

        // Відладка: подробиці обчислень (без повторення конфіг-значень і без повторення вже показаних оцінок)
        if (debug) {
            const lines = [];

            // Resolution
            const rdbg = element._et_resolution_debug;
            if (rdbg && features.resolution) {
                if (rdbg.source === 'ffprobe') {
                    lines.push(`Роздільність: ${features.resolution}p (ffprobe ${rdbg.width || '?'}x${rdbg.height || '?'})`);
                } else {
                    lines.push(`Роздільність: ${features.resolution}p (title)`);
                }
            } else if (features.resolution) {
                lines.push(`Роздільність: ${features.resolution}p`);
            }

            // HDR
            const hdbg = element._et_hdr_debug;
            if (features.hdr_type) {
                if (hdbg && hdbg.source === 'title') {
                    const f = Array.isArray(hdbg.foundTypes) ? hdbg.foundTypes.join(',') : '';
                    lines.push(`HDR: ${features.hdr_type} (title tokens: ${f || 'none'} → ${hdbg.chosen || features.hdr_type})`);
                } else {
                    lines.push(`HDR: ${features.hdr_type}`);
                }
            }

            // Bitrate
            const bdbg = element._et_bitrate_debug;
            if (typeof features.bitrate === 'number') {
                lines.push(`Бітрейт: ${features.bitrate} Mbps`);
                if (bdbg && bdbg.source) {
                    lines.push(`Джерело бітрейту: ${bdbg.source}`);
                    if (bdbg.source === 'size+duration') {
                        // Формула (для серіалів теж): mbps = round(((sizeBytes*8)/1e6) / (runtimeMin*60*epCount))
                        lines.push(
                            `Формула бітрейту: round(((sizeBytes*8)/1e6) / (runtimeMin*60*epCount))`
                        );
                        lines.push(
                            `  sizeBytes=${bdbg.size_bytes}  runtimeMin=${bdbg.runtime_min}  epCount=${bdbg.epCount}  totalSeconds=${bdbg.totalSeconds}`
                        );
                        lines.push(
                            `  mbpsRaw=${Number.isFinite(bdbg.mbps_raw) ? bdbg.mbps_raw.toFixed(4) : bdbg.mbps_raw}  mbpsRounded=${bdbg.mbps_rounded}  cap=${bdbg.maxCap}  mbpsFinal=${bdbg.mbps}`
                        );
                    }
                }
            }

            // Audio tracks
            if (Array.isArray(features.audio_tracks) && features.audio_tracks.length) {
                const names = features.audio_tracks
                    .map(id => (AUDIO_TRACK_BY_ID && AUDIO_TRACK_BY_ID.get && AUDIO_TRACK_BY_ID.get(id)) ? AUDIO_TRACK_BY_ID.get(id).name : String(id))
                    .join(', ');
                lines.push(`Аудіодоріжки: ${names}`);
            }

            // Episode priority (serial logic)
            if (typeof element._recommendEpisodePriority !== 'undefined' && (element._recommendEpisodePriority || 0) > 0) {
                lines.push(`Пріоритет епізоду: ${element._recommendEpisodePriority}`);
            } else if (typeof element._recommendEpisodePriority !== 'undefined') {
                lines.push(`Пріоритет епізоду: 0`);
            }

            const pre = $('<div class="torrent-recommend-panel__debug"></div>');
            pre.css({
                'white-space': 'pre-wrap',
                'font-size': '0.85em',
                'line-height': '1.25',
                'opacity': '0.9',
                'margin-top': '0.4em'
            });
            pre.text(lines.join('\n'));
            panel.append(pre);
        }
    }

    /**
     * Додавання CSS стилів
     */
    function addStyles() {
        const css = `
/* Панель рекомендацій (футер всередині .torrent-item) */
.torrent-recommend-panel{
    display: flex;
    align-items: center;
    gap: 0.9em;
    margin: 0.8em -1em -1em;        /* "приклеюємо" до країв картки */
    padding: 0.75em 1em 0.85em;
    border-radius: 0 0 0.3em 0.3em; /* співпадає з torrent-item */
    border-top: 1px solid rgba(255,255,255,0.10);
    background: rgba(0,0,0,0.18);
    backdrop-filter: blur(6px);
    -webkit-backdrop-filter: blur(6px);
}

.torrent-recommend-panel__left{
    min-width: 0;
    flex: 1 1 auto;
}

.torrent-recommend-panel__label{
    font-size: 0.95em;
    font-weight: 800;
    letter-spacing: 0.2px;
    color: rgba(255,255,255,0.92);
    line-height: 1.15;
}

.torrent-recommend-panel__meta{
    margin-top: 0.25em;
    font-size: 0.82em;
    font-weight: 600;
    color: rgba(255,255,255,0.58);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.torrent-recommend-panel__right{
    flex: 0 0 auto;
    display: flex;
    align-items: center;
}

.torrent-recommend-panel__score{
    font-size: 1.05em;
    font-weight: 900;
    padding: 0.25em 0.55em;
    border-radius: 0.6em;
    background: rgba(255,255,255,0.10);
    border: 1px solid rgba(255,255,255,0.12);
    color: rgba(255,255,255,0.95);
}

/* Чіпси breakdown */
.torrent-recommend-panel__chips{
    display: flex;
    flex: 2 1 auto;
    gap: 0.45em;
    flex-wrap: wrap;
    justify-content: flex-start;
}

.torrent-recommend-panel__chips:empty{
    display: none;
}

.tr-chip{
    display: inline-flex;
    align-items: baseline;
    gap: 0.35em;
    padding: 0.28em 0.55em;
    border-radius: 999px;
    background: rgba(255,255,255,0.08);
    border: 1px solid rgba(255,255,255,0.10);
}

.tr-chip__name{
    font-size: 0.78em;
    font-weight: 700;
    color: rgba(255,255,255,0.60);
}

.tr-chip__val{
    font-size: 0.86em;
    font-weight: 900;
    color: rgba(255,255,255,0.92);
}

.tr-chip--pos{
    background: rgba(76,175,80,0.10);
    border-color: rgba(76,175,80,0.22);
}
.tr-chip--pos .tr-chip__val{ color: rgba(120,255,170,0.95); }

.tr-chip--neg{
    background: rgba(244,67,54,0.10);
    border-color: rgba(244,67,54,0.22);
}
.tr-chip--neg .tr-chip__val{ color: rgba(255,120,120,0.95); }

/* Варіанти */
.torrent-recommend-panel--ideal{
    background: linear-gradient(135deg, rgba(255,215,0,0.16) 0%, rgba(255,165,0,0.08) 100%);
    border-top-color: rgba(255,215,0,0.20);
}
.torrent-recommend-panel--ideal .torrent-recommend-panel__label{
    color: rgba(255,235,140,0.98);
}

.torrent-recommend-panel--recommended{
    background: rgba(76,175,80,0.08);
    border-top-color: rgba(76,175,80,0.18);
}
.torrent-recommend-panel--recommended .torrent-recommend-panel__label{
    color: rgba(160,255,200,0.92);
}

/* Анімація (дуже м'яка) */
.torrent-recommend-panel{
    animation: tr-panel-in 0.22s ease-out;
}
@keyframes tr-panel-in{
    from{ opacity: 0; transform: translateY(-3px); }
    to{ opacity: 1; transform: translateY(0); }
}

/* Підсвітка при фокусі картки */
.torrent-item.focus .torrent-recommend-panel{
    background: rgba(255,255,255,0.08);
    border-top-color: rgba(255,255,255,0.16);
}

/* Компакт: вузькі екрани — ховаємо мету, залишаємо чипси і скор */
@media (max-width: 520px){
    .torrent-recommend-panel{
        gap: 0.7em;
        padding: 0.65em 0.9em 0.75em;
    }
    .torrent-recommend-panel__meta{
        display: none;
    }
}
`;

        const style = document.createElement('style');
        style.textContent = css;
        document.head.appendChild(style);
    }

    /**
     * Додавання налаштувань плагіна в Lampa
     */
    function addSettings() {
        if (Lampa.Storage.get('easytorrent_enabled') === undefined) {
            Lampa.Storage.set('easytorrent_enabled', true);
        }
        if (Lampa.Storage.get('easytorrent_show_scores') === undefined) {
            Lampa.Storage.set('easytorrent_show_scores', true);
        }
        if (Lampa.Storage.get('easytorrent_debug') === undefined) {
            Lampa.Storage.set('easytorrent_debug', false);
        }

        Lampa.SettingsApi.addComponent({
            component: 'easytorrent',
            name: PLUGIN_NAME,
            icon: PLUGIN_ICON
        });

        // Додаємо інформацію про плагін
        Lampa.SettingsApi.addParam({
            component: 'easytorrent',
            param: {
                name: 'easytorrent_about',
                type: 'static'
            },
            field: {
                name: '<div>' + PLUGIN_NAME + ' ' + VERSION + '</div>'
            },
            onRender: function(item) {
                item.css('opacity', '0.7');
                item.find('.settings-param__name').css({
                    'font-size': '1.2em',
                    'margin-bottom': '0.3em'
                });
                item.append('<div style="font-size: 0.9em; padding: 0 1.2em; line-height: 1.4;">Автор: DarkestClouds<br>Переклад(українізація): cevamnelampaplagin<br>Система рекомендацій торрентів на основі якості, HDR та озвучки</div>');
            }
        });

        Lampa.SettingsApi.addParam({
            component: 'easytorrent',
            param: {
                name: 'easytorrent_enabled',
                type: 'trigger',
                default: true
            },
            field: {
                name: t('easytorrent_title'),
                description: t('easytorrent_desc')
            },
            onChange: (value) => {
                // value приходить рядком 'true'/'false'
                if (String(value) === 'true') {
                    ensureStartupModalScheduler();
                }
            }
        });

        Lampa.SettingsApi.addParam({
            component: 'easytorrent',
            param: {
                name: 'easytorrent_show_scores',
                type: 'trigger',
                default: true
            },
            field: {
                name: t('show_scores'),
                description: t('show_scores_desc')
            }
        });

        Lampa.SettingsApi.addParam({
            component: 'easytorrent',
            param: {
                name: 'easytorrent_debug',
                type: 'trigger',
                default: false
            },
            field: {
                name: 'Налагодження',
                description: 'Показувати в картці торренту подробиці розрахунків (HDR/серії/бітрейт тощо)'
            }
        });

        Lampa.SettingsApi.addParam({
            component: 'easytorrent',
            param: {
                name: 'easytorrent_config_json',
                type: 'static',
                default: JSON.stringify(DEFAULT_CONFIG)
            },
            field: {
                name: t('config_json'),
                description: t('config_json_desc')
            },
            onRender: (item) => {
                const updateDisplay = () => {
                    const cfg = USER_CONFIG;
                    const summary = `${cfg.device.type.toUpperCase()} | ${cfg.parameter_priority[0]}`;
                    item.find('.settings-param__value').text(summary);
                };

                updateDisplay();

                item.on('hover:enter', () => {
                    Lampa.Select.show({
                        title: t('config_json'),
                        items: [
                            { title: t('config_view'), action: 'view' },
                            { title: t('config_edit'), action: 'edit' },
                            { title: t('config_reset'), action: 'reset' }
                        ],
                        onSelect: (a) => {
                            if (a.action === 'view') {
                                showConfigDetails();
                            } else if (a.action === 'edit') {
                                Lampa.Input.edit({
                                    value: Lampa.Storage.get('easytorrent_config_json') || JSON.stringify(DEFAULT_CONFIG),
                                    free: true
                                }, (new_value) => {
                                    if (new_value) {
                                        try {
                                            const parsed = JSON.parse(new_value);
                                            const check = validateConfig(parsed);
                                            if (!check.ok) throw new Error(check.error);

                                            saveUserConfig(new_value);
                                            updateDisplay();
                                            Lampa.Noty.show('OK');
                                        } catch (e) {
                                            Lampa.Noty.show((e && e.message) ? e.message : t('config_error'));
                                        }
                                    }
                                    Lampa.Controller.toggle('settings');
                                });
                            } else if (a.action === 'reset') {
                                // Скидання — це явна дія користувача, застосовуємо дефолтний валідний конфіг
                                saveUserConfig(DEFAULT_CONFIG);
                                updateDisplay();
                                Lampa.Noty.show('OK');
                                Lampa.Controller.toggle('settings');
                            }
                        },
                        onBack: () => {
                            Lampa.Controller.toggle('settings');
                        }
                    });
                });
            }
        });

        // Кнопка "Розставити пріоритети"
        Lampa.SettingsApi.addParam({
            component: 'easytorrent',
            param: {
                name: 'easytorrent_qr_setup',
                type: 'static'
            },
            field: {
                name: 'Розставити пріоритети',
                description: 'Відкрийте візард на телефоні через QR-код'
            },
            onRender: (item) => {
                item.on('hover:enter', () => {
                    showQRSetup();
                });
            }
        });
    }

    // ═══════════════════════════════════════════════════════════════════
    // QR-КОД І POLLING
    // ═══════════════════════════════════════════════════════════════════

    function generatePairCode() {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let code = '';
        for (let i = 0; i < 6; i++) {
            code += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return code;
    }

    async function fetchConfigFromSupabase(id) {
        try {
            const url = `${SUPABASE_URL}/rest/v1/tv_configs?id=eq.${encodeURIComponent(id)}&select=data,updated_at`;
            
            const res = await fetch(url, {
                headers: {
                    'apikey': ANON_KEY,
                    'Authorization': `Bearer ${ANON_KEY}`
                }
            });
            
            if (!res.ok) {
                throw new Error(`Fetch failed: ${res.status}`);
            }
            
            const rows = await res.json();
            if (!rows.length) return null;
            
            return rows[0].data;
        } catch (error) {
            console.error('[EasyTorrent] Fetch error:', error);
            return null;
        }
    }

    function showQRSetup() {
        const pairCode = generatePairCode();
        const qrUrl = `${WIZARD_URL}?pairCode=${pairCode}`;
        
        // Створюємо вміст модального вікна
        const modal = $(`
            <div class="about">
                <div style="text-align: center; margin-bottom: 20px;">
                    <div id="qrCodeContainer" style="background: white; padding: 20px; border-radius: 15px; display: inline-block; margin-bottom: 20px;height: 20em;width: 20em;"></div>
                </div>
                <div class="about__text" style="text-align: center; margin-bottom: 15px;">
                    <strong>Або перейдіть вручну:</strong><br>
                    <span style="word-break: break-all;">${qrUrl}</span>
                </div>
                <div class="about__text" style="text-align: center;">
                    <strong>Код сполучення:</strong>
                    <div style="font-size: 2em; font-weight: bold; letter-spacing: 0.3em; margin: 10px 0; color: #667eea;">${pairCode}</div>
                </div>
                <div class="about__text" id="qrStatus" style="text-align: center; padding: 15px; background: rgba(255,255,255,0.05); border-radius: 10px; margin-top: 20px;">
                    ⏳ Очікування конфігурації...
                </div>
            </div>
        `);
        
        // Відкриваємо модалку
        Lampa.Modal.open({
            title: '🔗 Налаштування пріоритетів',
            html: modal,
            size: 'medium',
            onBack: () => {
                if (pollingInterval) {
                    clearInterval(pollingInterval);
                    pollingInterval = null;
                }
                Lampa.Modal.close();
                Lampa.Controller.toggle('settings_component');
            }
        });
        
        // Генеруємо QR-код
        setTimeout(() => {
            const qrContainer = document.getElementById('qrCodeContainer');
            if (qrContainer && Lampa.Utils && Lampa.Utils.qrcode) {
                try {
                    Lampa.Utils.qrcode(qrUrl, qrContainer);
                } catch (e) {
                    qrContainer.innerHTML = '<p style="color: #f44336;">Помилка генерації QR-кода</p>';
                }
            }
        }, 100);
        
        // Запускаємо polling
        let lastUpdated = null;
        pollingInterval = setInterval(async () => {
            const config = await fetchConfigFromSupabase(pairCode);
            
            if (config) {
                const configUpdated = config.generated;
                if (configUpdated !== lastUpdated) {
                    lastUpdated = configUpdated;
                    
                    // Застосовуємо конфіг
                    saveUserConfig(config);
                    
                    // Показуємо успіх
                    $('#qrStatus')
                        .html('✅ Конфігурацію отримано та застосовано!')
                        .css('color', '#4CAF50');
                    
                    // Закриваємо через 2 секунди
                    setTimeout(() => {
                        if (pollingInterval) {
                            clearInterval(pollingInterval);
                            pollingInterval = null;
                        }
                        Lampa.Modal.close();
                        Lampa.Noty.show('Конфігурацію оновлено!');
                        Lampa.Controller.toggle('settings_component');
                    }, 2000);
                }
            }
        }, 5000);
    }

    // ═══════════════════════════════════════════════════════════════════
    // РОЗДІЛ 5: ВТРУЧАННЯ В UI ЯДРА (MONKEY PATCHING)
    // ═══════════════════════════════════════════════════════════════════

    /**
     * Monkey patch парсера для перехоплення результатів
     */
    function patchParser() {
        const Parser = window.Lampa.Parser || (window.Lampa.Component ? window.Lampa.Component.Parser : null);
        
        if (!Parser || !Parser.get) {
            console.log('[EasyTorrent] Parser не знайдено або не має методу get');
            return;
        }

        console.log('[EasyTorrent] Патчимо Parser.get для перехоплення та фіксації топів');
        
        const originalGet = Parser.get;
        
        Parser.get = function(params, oncomplite, onerror) {
            const wrappedOncomplite = function(data) {
                if (data && data.Results && Array.isArray(data.Results)) {
                    processParserResults(data, params);

                    let currentResults = data.Results;
                    
                    /**
                     * Розумна функція фіксації топів всередині будь-якого набору даних (повного або відфільтрованого)
                     */
                    const forceTopItems = (items) => {
                        if (!Array.isArray(items) || items.length === 0) return items;
                        
                        // Беремо топ-N на основі оцінки саме в цьому наборі даних
                        const recommendCount = USER_CONFIG.preferences.recommendation_count || 3;
                        const minSeeds = USER_CONFIG.preferences.min_seeds || 0;
                        
                        // СПОЧАТКУ фільтруємо за сідами, ПОТІМ сортуємо і вибираємо топ-N
                        let candidates = [...items]
                            .filter(i => {
                                const seeds = i.Seeds || i.seeds || i.Seeders || i.seeders || 0;
                                return (i._recommendScore || 0) > 0 && seeds >= minSeeds;
                            });

                        // Для серіалів: якщо є хоча б одна роздача з останньою серією — беремо топи тільки з них
                        // (а ще вище — якщо є і наступна серія)
                        const maxEpPriority = candidates.reduce((m, it) => Math.max(m, it._recommendEpisodePriority || 0), 0);
                        if (maxEpPriority >= 1) {
                            candidates = candidates.filter(i => (i._recommendEpisodePriority || 0) >= 1);
                        }

                        const tops = candidates
                            .sort((a, b) => {
                                const ea = a._recommendEpisodePriority || 0;
                                const eb = b._recommendEpisodePriority || 0;
                                if (eb !== ea) return eb - ea;
                                return (b._recommendScore || 0) - (a._recommendScore || 0);
                            })
                            .slice(0, recommendCount);
                        
                        if (tops.length === 0) {
                            // Обнуляємо ранги, якщо топів немає (щоб старі бейджі не висіли)
                            items.forEach(item => item._recommendRank = 999);
                            return items;
                        }

                        // Збираємо підсумковий масив: спочатку наші рекомендації, потім все інше в початковому порядку
                        // ВАЖЛИВО: тут не можна використовувати items.filter, тому що ми патимо Array.prototype.filter
                        // для результатів. Якщо викликати патчений filter всередині фіксатора, він повторно "підніме" топи
                        // вже серед "інших" елементів і зламає користувацьке сортування хвоста (Size/Seeders/etc).
                        const other = Array.prototype.filter.call(items, i => !tops.includes(i));
                        const final = [...tops, ...other];
                        
                        // ВАЖЛИВО: Оновлюємо ранги для правильного відображення #1, #2, #3 у бейджах саме для поточного виду
                        final.forEach((item, index) => {
                            item._recommendRank = index;
                            item._recommendIsIdeal = index === 0 && (item._recommendScore || 0) >= 150;
                        });
                        
                        // Всім іншим ставимо великий ранг
                        other.forEach(item => item._recommendRank = 999);
                        
                        return final;
                    };

                    /**
                     * Патимо методи масиву, щоб рекомендації завжди були зверху
                     */
                    const patchArrayMethods = (array) => {
                        if (!array || array._recommendPatched) return array;
                        
                        // 1. Патимо SORT (для зміни сортування користувачем)
                        const originalSort = array.sort;
                        array.sort = function() {
                            originalSort.apply(this, arguments);
                            const fixed = forceTopItems(this);
                            for (let i = 0; i < fixed.length; i++) this[i] = fixed[i];
                            return this;
                        };

                        // 2. Патимо FILTER (для вибору сезону, озвучки тощо)
                        const originalFilter = array.filter;
                        array.filter = function() {
                            const filteredResult = originalFilter.apply(this, arguments);
                            // Для результату фільтрації теж застосовуємо фіксацію топів і патимо методи
                            const fixed = forceTopItems(filteredResult);
                            return patchArrayMethods(fixed);
                        };
                        
                        array._recommendPatched = true;
                        return array;
                    };

                    // Застосовуємо магію до основного масиву результатів
                    currentResults = patchArrayMethods(forceTopItems(currentResults));

                    try {
                        Object.defineProperty(data, 'Results', {
                            get: () => currentResults,
                            set: (v) => {
                                currentResults = patchArrayMethods(forceTopItems(v));
                            },
                            configurable: true,
                            enumerable: true
                        });
                        console.log('[EasyTorrent] Розумна контекстна фільтрація активована');
                    } catch (e) {
                        console.log('[EasyTorrent] Помилка при фіксації топів:', e);
                    }
                }
                
                return oncomplite.apply(this, arguments);
            };

            return originalGet.call(this, params, wrappedOncomplite, onerror);
        };

        console.log('[EasyTorrent] Parser.get пропатчено!');
    }

    /**
     * Підписка на події Lampa
     */
    function subscribeToEvents() {
        // Підписуємося на подію render кожного торрента для додавання бейджів
        Lampa.Listener.follow('torrent', (data) => {
            if (data.type === 'render') {
                onTorrentRender(data);
            }
        });

        // Скидання при відкритті нової сторінки торрентів
        Lampa.Listener.follow('activity', (data) => {
            if (data.type === 'start' && data.component === 'torrents') {
                console.log('[EasyTorrent] Нова сторінка торрентів');
            }
        });
    }

    // ═══════════════════════════════════════════════════════════════════
    // РОЗДІЛ 6: ГОЛОВНА ІНІЦІАЛІЗАЦІЯ
    // ═══════════════════════════════════════════════════════════════════

    function init() {
        console.log('[EasyTorrent]', VERSION);
        
        // Заповнюємо метадані плагіна в Extensions (name/author), якщо користувач додав тільки URL
        ensureSelfPluginMetadataInStorage();
        
        loadUserConfig();
        addStyles();
        addSettings();
        // Модалки не показуємо на екрані Extensions і коли плагін вимкнено.
        // Scheduler сам дочекається нормального екрана і покаже пізніше.
        setTimeout(() => {
            ensureStartupModalScheduler();
        }, 1200);

        if (window.Lampa && window.Lampa.Parser) {
            patchParser();
        } else {
            setTimeout(() => {
                patchParser();
            }, 1000);
        }

        subscribeToEvents();

        console.log('[EasyTorrent] Готовий до роботи!');
    }

    // Запуск при готовності додатка
    if (window.appready) {
        init();
    } else {
        Lampa.Listener.follow('app', (e) => {
            if (e.type === 'ready') {
                init();
            }
        });
    }

})();
