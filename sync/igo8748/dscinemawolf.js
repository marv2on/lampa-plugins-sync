(function () {
    'use strict';

    // Основний об'єкт плагіна
    var CinemaByWolf = {
        name: 'cinemabywolf',
        version: '2.1.1',
        debug: true,
        settings: {
            enabled: true,
            show_ru: true,
            show_en: true,
            show_ua: true
        }
    };

    // Список російських кінотеатрів
    var RU_CINEMAS = [
        { name: 'Start', networkId: '2493' },
        { name: 'Premier', networkId: '2859' },
        { name: 'KION', networkId: '4085' },
        { name: 'Okko', networkId: '3871' },
        { name: 'КиноПоиск', networkId: '3827' },
        { name: 'Wink', networkId: '5806' },
        { name: 'ИВИ', networkId: '3923' },
        { name: 'Смотрим', networkId: '5000' },
        { name: 'Первый', networkId: '558' },
        { name: 'СТС', networkId: '806' },
        { name: 'ТНТ', networkId: '1191' },
	    { name: 'Пятница', networkId: '3031' },
        { name: 'Россия 1', networkId: '412' },
        { name: 'НТВ', networkId: '1199' }
    ];
    // Список іноземних кінотеатрів
    var EN_CINEMAS = [
        { name: 'Netflix', networkId: '213' },
        { name: 'Apple TV', networkId: '2552' },
        { name: 'HBO', networkId: '49' },
        { name: 'SyFy', networkId: '77' },
        { name: 'NBC', networkId: '6' },
        { name: 'TV New Zealand', networkId: '1376' },
        { name: 'Hulu', networkId: '453' },
        { name: 'ABC', networkId: '49' },
        { name: 'CBS', networkId: '16' },
        { name: 'Amazon Prime', networkId: '1024' }
    ];
    // Список українських кінотеатрів
    var UA_CINEMAS = [
        { name: '1+1', networkId: '1254' },
        { name: 'ICTV', networkId: '1166' },
        { name: 'СТБ', networkId: '1206' }
    ];

    // Локалізація
    function addLocalization() {
        if (Lampa && Lampa.Lang) {
            Lampa.Lang.add({
                cinemabywolf_ru: {
                    ru: 'RU Кінотеатри',
                    en: 'RU Cinemas'
                },
                cinemabywolf_en: {
                    ru: 'EN Кінотеатри',
                    en: 'EN Cinemas'
                },
                cinemabywolf_ua: {
                    ru: 'UA Кінотеатри',
                    en: 'UA Cinemas'
                },
                cinemabywolf_title: {
                    ru: 'Онлайн кінотеатри',
                    en: 'Online Cinemas'
                }
            });
        }
    }

    // SVG іконки
    function getSVGIcon(type) {
        if (type === 'ru') {
            return '<svg width="24" height="24" viewBox="0 0 24 24"><rect width="24" height="8" y="0" fill="#fff"/><rect width="24" height="8" y="8" fill="#0039a6"/><rect width="24" height="8" y="16" fill="#d52b1e"/></svg>';
        } else {
            return '<svg width="24" height="24" viewBox="0 0 24 24"><rect width="24" height="24" fill="#00247d"/><text x="12" y="16" font-size="12" fill="#fff" text-anchor="middle" font-family="Arial">EN</text></svg>';
        }
    }

    // Видалити кнопки з головного меню
    function removeMenuButtons() {
        $('.cinemabywolf-btn-ru').remove();
        $('.cinemabywolf-btn-en').remove();
        $('.cinemabywolf-btn-ua').remove();
    }

    // Додавання кнопок у головне меню (в стилі @cinemas.js)
    function addMenuButtons() {
        if (CinemaByWolf.debug) {
            console.log('cinemabywolf: addMenuButtons викликана');
            console.log('cinemabywolf: show_ru =', CinemaByWolf.settings.show_ru);
            console.log('cinemabywolf: show_en =', CinemaByWolf.settings.show_en);
            console.log('cinemabywolf: show_ua =', CinemaByWolf.settings.show_ua);
        }

        // Видаляємо існуючі кнопки, якщо вони є
        $('.menu__item.cinemabywolf-btn-ru, .menu__item.cinemabywolf-btn-en, .menu__item.cinemabywolf-btn-ua').remove();

        var $menu = $('.menu .menu__list').eq(0);
        if (!$menu.length) {
            if (CinemaByWolf.debug) {
                console.log('cinemabywolf: меню не знайдено');
            }
            return;
        }

        // RU Кінотеатри
        if (String(CinemaByWolf.settings.show_ru).toLowerCase() !== 'false') {
            if (CinemaByWolf.debug) {
                console.log('cinemabywolf: додаємо RU кнопку');
            }
            var ico = `<svg xmlns="http://www.w3.org/2000/svg" width="1.2em" height="1.2em" viewBox="0 0 48 48">
                <text x="50%" y="55%" text-anchor="middle" font-family="Arial" font-size="38" 
                      font-weight="700" fill="currentColor" dominant-baseline="middle">
                    RU
                </text>
            </svg>`;
            var $btnRU = $(`
                <li class="menu__item selector cinemabywolf-btn-ru">
                    <div class="menu__ico">${ico}</div>
                    <div class="menu__text">Кінотеатри</div>
                </li>
            `);
            $btnRU.on('hover:enter', function () {
                openCinemasModal('ru');
            });
            $menu.append($btnRU);
        }

        // EN Кінотеатри
        if (String(CinemaByWolf.settings.show_en).toLowerCase() !== 'false') {
            if (CinemaByWolf.debug) {
                console.log('cinemabywolf: додаємо EN кнопку');
            }
            var ico = `<svg xmlns="http://www.w3.org/2000/svg" width="1.2em" height="1.2em" viewBox="0 0 48 48">
                <text x="50%" y="55%" text-anchor="middle" font-family="Arial" font-size="38" 
                      font-weight="700" fill="currentColor" dominant-baseline="middle">
                    EN
                </text>
            </svg>`;
            var $btnEN = $(`
                <li class="menu__item selector cinemabywolf-btn-en">
                    <div class="menu__ico">${ico}</div>
                    <div class="menu__text">Кінотеатри</div>
                </li>
            `);
            $btnEN.on('hover:enter', function () {
                openCinemasModal('en');
            });
            $menu.append($btnEN);
        }

        // UA Кінотеатри
        if (String(CinemaByWolf.settings.show_ua).toLowerCase() !== 'false') {
            if (CinemaByWolf.debug) {
                console.log('cinemabywolf: додаємо UA кнопку');
            }
            var ico = `<svg xmlns="http://www.w3.org/2000/svg" width="1.2em" height="1.2em" viewBox="0 0 48 48">
                <text x="50%" y="55%" text-anchor="middle" font-family="Arial" font-size="38" 
                      font-weight="700" fill="currentColor" dominant-baseline="middle">
                    UA
                </text>
            </svg>`;
            var $btnUA = $(`
                <li class="menu__item selector cinemabywolf-btn-ua">
                    <div class="menu__ico">${ico}</div>
                    <div class="menu__text">Кінотеатри</div>
                </li>
            `);
            $btnUA.on('hover:enter', function () {
                openCinemasModal('ua');
            });
            $menu.append($btnUA);
        }
    }

    // Отримати об'єкт мережі TMDB за networkId
    function getNetworkData(networkId) {
        if (Lampa && Lampa.TMDB && Lampa.TMDB.networks) {
            for (var i = 0; i < Lampa.TMDB.networks.length; i++) {
                if (String(Lampa.TMDB.networks[i].id) === String(networkId)) {
                    return Lampa.TMDB.networks[i];
                }
            }
        }
        return null;
    }

    // Отримати logo_path з Lampa.TMDB.networks
    function getLogoPathFromCache(networkId) {
        if (Lampa && Lampa.TMDB && Lampa.TMDB.networks) {
            for (var i = 0; i < Lampa.TMDB.networks.length; i++) {
                if (String(Lampa.TMDB.networks[i].id) === String(networkId)) {
                    return Lampa.TMDB.networks[i].logo_path || null;
                }
            }
        }
        return null;
    }

    // Отримати логотип (асинхронно): тільки з кешу Lampa.TMDB.networks, інакше літера
    function getCinemaLogo(networkId, name, callback) {
        var logoPath = getLogoPathFromCache(networkId);
        if (logoPath) {
            var url = Lampa.TMDB && Lampa.TMDB.image ? Lampa.TMDB.image('t/p/w300' + logoPath) : 'https://image.tmdb.org/t/p/w300' + logoPath;
            callback('<img src="' + url + '" alt="' + name + '" style="max-width:68px;max-height:68px;">');
            return;
        }
        // Пробуємо через проксі (як в @cinemas.js)
        var apiUrl = Lampa.TMDB.api('network/' + networkId + '?api_key=' + Lampa.TMDB.key());
        $.ajax({
            url: apiUrl,
            type: 'GET',
            success: function (data) {
                if (data && data.logo_path) {
                    var imgUrl = Lampa.TMDB && Lampa.TMDB.image ? Lampa.TMDB.image('t/p/w300' + data.logo_path) : 'https://image.tmdb.org/t/p/w300' + data.logo_path;
                    callback('<img src="' + imgUrl + '" alt="' + name + '" style="max-width:68px;max-height:68px;">');
                } else {
                    callback('<div style="font-size:22px;line-height:44px;color:#222;font-weight:bold;display:flex;align-items:center;justify-content:center;width:100%;height:100%;">' + name.charAt(0) + '</div>');
                }
            },
            error: function () {
                callback('<div style="font-size:22px;line-height:68px;color:#222;font-weight:bold;display:flex;align-items:center;justify-content:center;width:100%;height:100%;">' + name.charAt(0) + '</div>');
            }
        });
    }

    // Відкриття каталогу тільки серіалів за networkId
    function openCinemaCatalog(networkId, name) {
        var sort = CinemaByWolf.settings.sort_mode;
        // Для серіалів коригуємо сортування за датою
        if (sort === 'release_date.desc') sort = 'first_air_date.desc';
        if (sort === 'release_date.asc') sort = 'first_air_date.asc';
        Lampa.Activity.push({
            url: 'discover/tv',
            title: name,
            networks: networkId,
            sort_by: sort,
            component: 'category_full',
            source: 'tmdb',
            card_type: true,
            page: 1
        });
    }

    // --- Контролер для карток кінотеатрів ---
    function activateCardsController($container) {
        var name = 'cinemabywolf-cards';
        var $cards = $container.find('.cinemabywolf-card.selector');
        var lastFocus = 0;
        function getCardsPerRow() {
            if ($cards.length < 2) return 1;
            var firstTop = $cards.eq(0).offset().top;
            for (var i = 1; i < $cards.length; i++) {
                if ($cards.eq(i).offset().top !== firstTop) {
                    return i;
                }
            }
            return $cards.length;
        }
        function updateFocus(index) {
            $cards.removeClass('focus').attr('tabindex', '-1');
            if ($cards.eq(index).length) {
                $cards.eq(index).addClass('focus').attr('tabindex', '0').focus();
                // Прокрутка до картки, якщо вона не видна
                var card = $cards.get(index);
                if (card && card.scrollIntoView) {
                    card.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
                }
                lastFocus = index;
            }
        }
        Lampa.Controller.add(name, {
            toggle: function() {
                Lampa.Controller.collectionSet($container);
                updateFocus(lastFocus);
            },
            up: function() {
                var perRow = getCardsPerRow();
                var idx = lastFocus - perRow;
                if (idx >= 0) updateFocus(idx);
            },
            down: function() {
                var perRow = getCardsPerRow();
                var idx = lastFocus + perRow;
                if (idx < $cards.length) updateFocus(idx);
            },
            left: function() {
                var idx = lastFocus - 1;
                if (idx >= 0) updateFocus(idx);
            },
            right: function() {
                var idx = lastFocus + 1;
                if (idx < $cards.length) updateFocus(idx);
            },
            back: function() {
                Lampa.Modal.close();
                Lampa.Controller.toggle('menu');
            },
            enter: function() {
                $cards.eq(lastFocus).trigger('hover:enter');
            }
        });
        Lampa.Controller.toggle(name);
    }

    // Відкриття модального вікна з кінотеатрами (з логотипами і фільтрацією)
    function openCinemasModal(type) {
        var cinemas = type === 'ru' ? RU_CINEMAS : type === 'en' ? EN_CINEMAS : UA_CINEMAS;
        var enabled = type === 'ru' ? CinemaByWolf.settings.ru_cinemas : type === 'en' ? CinemaByWolf.settings.en_cinemas : CinemaByWolf.settings.ua_cinemas;
        var filtered = [];
        for (var i = 0; i < cinemas.length; i++) {
            if (enabled[cinemas[i].networkId]) filtered.push(cinemas[i]);
        }
        var titleText = type === 'ru' ? 'Російські онлайн кінотеатри' : type === 'en' ? 'Іноземні онлайн кінотеатри' : 'Українські онлайн кінотеатри';
        var svgIcon = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="2" y="5" width="20" height="14" rx="2" stroke="#00dbde" stroke-width="2"/><polygon points="10,9 16,12 10,15" fill="#fc00ff"/></svg>';
        var $header = $('<div class="cinemabywolf-modal-header"></div>');
        $header.append(svgIcon);
        $header.append('<span class="cinemabywolf-modal-title">' + titleText + '</span>');
        var $container = $('<div class="cinemabywolf-cards"></div>');
        for (var j = 0; j < filtered.length; j++) {
            (function (c) {
                var $card = $('<div class="cinemabywolf-card selector"></div>');
                var $logo = $('<div class="cinemabywolf-card__logo"></div>');
                getCinemaLogo(c.networkId, c.name, function(logoHtml) {
                    $logo.html(logoHtml);
                });
                $card.append($logo);
                $card.append('<div class="cinemabywolf-card__name">' + c.name + '</div>');
                $card.on('hover:enter', function () {
                    Lampa.Modal.close();
                    openCinemaCatalog(c.networkId, c.name);
                });
                $container.append($card);
            })(filtered[j]);
        }
        var $wrap = $('<div></div>');
        $wrap.append($header).append($container);
        Lampa.Modal.open({
            title: '',
            html: $wrap,
            onBack: function () {
                Lampa.Modal.close();
                Lampa.Controller.toggle('menu');
            },
            size: 'full'
        });
        setTimeout(function() {
            activateCardsController($container);
        }, 100);
    }

    // Додавання стилів
    function addStyles() {
        var style = '<style id="cinemabywolf-styles">'
            + '.cinemabywolf-cards { max-height: 70vh; overflow-y: auto; display: flex; flex-wrap: wrap; justify-content: center; border-radius: 18px; }'
            + '.cinemabywolf-cinema-btns { max-height: 70vh; overflow-y: auto; width: 100%; padding-right: 8px; }'
            + '.cinemabywolf-cinema-btn {  max-width: 500px; min-width: 260px; margin: 0 auto 18px auto; display: flex; align-items: center; justify-content: flex-start; padding: 0 0 0 32px; height: 68px; font-size: 1.6em !important; color: #888; background: rgba(24,24,40,0.95); border-radius: 14px; transition: background 0.2s, color 0.2s, opacity 0.2s; }'
            + '.cinemabywolf-cinema-btn__icon { font-size: 1.3em; margin-right: 24px; width: 32px; display: flex; align-items: center; justify-content: center; }'
            + '.cinemabywolf-cinema-btn.enabled .cinemabywolf-cinema-btn__icon { color: #fff; }'
            + '.cinemabywolf-cinema-btn:not(.enabled) .cinemabywolf-cinema-btn__icon { color: #666; }'
            + '.cinemabywolf-cinema-btn.enabled .cinemabywolf-cinema-btn__name { color: #fff; }'
            + '.cinemabywolf-cinema-btn:not(.enabled) .cinemabywolf-cinema-btn__name { color: #888; opacity: 0.7; }'
            + '.cinemabywolf-cinema-btn.focus { background: linear-gradient(90deg, #e94057 0%, #f27121 100%); color: #fff !important; outline: none; box-shadow: 0 0 0 2px #e94057, 0 0 12px #f27121; }'
            + '.cinemabywolf-card { width: 120px; height: 120px; background: rgba(24,24,40,0.95); border-radius: 16px; display: flex; flex-direction: column; align-items: center; justify-content: center; cursor: pointer; transition: box-shadow 0.2s, background 0.2s; margin: 12px; box-shadow: 0 2px 12px rgba(233, 64, 87, 0.08); border: 1.5px solid rgba(233, 64, 87, 0.08); }'
            + '.cinemabywolf-card.selector:focus, .cinemabywolf-card.selector:hover { box-shadow: 0 0 24px #e94057, 0 0 30px #f27121; background: linear-gradient(135deg, #1a1a1a 0%, #2a2a2a 100%); outline: none; border: 1.5px solid #e94057; }'
            + '.cinemabywolf-card__logo { width: 84px; height: 84px; background: #918d8db8; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 32px; color: #222; font-weight: bold; margin-bottom: 10px; box-shadow: 0 2px 8px rgba(233, 64, 87, 0.08); }'
            + '.cinemabywolf-card__name { color: #fff; font-size: 16px; text-align: center; text-shadow: 0 2px 8px rgba(233, 64, 87, 0.15); }'
            + '.cinemabywolf-modal-header { display: flex; flex-direction: row; align-items: center; justify-content: center; margin-bottom: 28px; width: 100%; }'
            + '.cinemabywolf-modal-header svg { width: 34px !important; height: 34px !important; min-width: 34px; min-height: 34px; max-width: 34px; max-height: 34px; display: inline-block; flex-shrink: 0; margin-right: 16px; }'
            + '.cinemabywolf-modal-title { font-size: 1.6em; font-weight: bold; color: #fff; background: linear-gradient(90deg, #8a2387, #e94057, #f27121); -webkit-background-clip: text; -webkit-text-fill-color: transparent; text-align: center; max-width: 90vw; word-break: break-word; white-space: normal; display: inline-block; text-shadow: 0 2px 8px rgba(233, 64, 87, 0.15); }'
            + '.ru-cinema-row.selector:focus, .en-cinema-row.selector:focus { outline: none; border-radius: 8px; box-shadow: 0 0 0 2px #e94057, 0 0 12px #f27121; background: linear-gradient(90deg, #2a2a2a 60%, #e94057 100%); color: #fff; }'
            + '@media (max-width: 600px) { .cinemabywolf-modal-title { font-size: 1em; } }'
            + '</style>';
        if (!$('#cinemabywolf-styles').length) $('head').append(style);
    }

    // --- НАЛАШТУВАННЯ ---
    var STORAGE_KEY = 'cinemabywolf_settings';
    // Список режимів сортування TMDB
    var SORT_MODES = {
        'popularity.desc': 'Популярні',
        'release_date.desc': 'За датою (нові)',
        'release_date.asc': 'За датою (старі)',
        'vote_average.desc': 'За рейтингом',
        'vote_count.desc': 'За кількістю голосів'
    };

    // Завантаження налаштувань з localStorage
    function loadSettings() {
        var saved = localStorage.getItem(STORAGE_KEY);
        if (CinemaByWolf.debug) {
            console.log('cinemabywolf: завантажуємо налаштування з localStorage', saved);
        }
        if (saved) {
            try {
                var obj = JSON.parse(saved);
                for (var k in obj) {
                    CinemaByWolf.settings[k] = obj[k];
                    if (CinemaByWolf.debug) {
                        console.log('cinemabywolf: завантажено налаштування', k, '=', obj[k]);
                    }
                }
            } catch (e) {
                if (CinemaByWolf.debug) {
                    console.error('cinemabywolf: помилка при завантаженні налаштувань', e);
                }
            }
        }
        // Для кожного кінотеатру окреме налаштування
        if (!CinemaByWolf.settings.ru_cinemas) {
            CinemaByWolf.settings.ru_cinemas = {};
            for (var i = 0; i < RU_CINEMAS.length; i++) {
                CinemaByWolf.settings.ru_cinemas[RU_CINEMAS[i].networkId] = true;
            }
        }
        if (!CinemaByWolf.settings.en_cinemas) {
            CinemaByWolf.settings.en_cinemas = {};
            for (var j = 0; j < EN_CINEMAS.length; j++) {
                CinemaByWolf.settings.en_cinemas[EN_CINEMAS[j].networkId] = true;
            }
        }
        if (!CinemaByWolf.settings.ua_cinemas) {
            CinemaByWolf.settings.ua_cinemas = {};
            for (var k = 0; k < UA_CINEMAS.length; k++) {
                CinemaByWolf.settings.ua_cinemas[UA_CINEMAS[k].networkId] = true;
            }
        }
        if (!CinemaByWolf.settings.sort_mode) {
            CinemaByWolf.settings.sort_mode = 'popularity.desc';
        }
        // Ініціалізація налаштувань відображення кнопок
        if (typeof CinemaByWolf.settings.show_ru === 'undefined') {
            CinemaByWolf.settings.show_ru = true;
        }
        if (typeof CinemaByWolf.settings.show_en === 'undefined') {
            CinemaByWolf.settings.show_en = true;
        }
        if (typeof CinemaByWolf.settings.show_ua === 'undefined') {
            CinemaByWolf.settings.show_ua = true;
        }
        if (CinemaByWolf.debug) {
            console.log('cinemabywolf: підсумкові налаштування', CinemaByWolf.settings);
        }
    }

    // Збереження налаштувань
    function saveSettings() {
        if (CinemaByWolf.debug) {
            console.log('cinemabywolf: зберігаємо налаштування', CinemaByWolf.settings);
        }
        localStorage.setItem(STORAGE_KEY, JSON.stringify(CinemaByWolf.settings));
    }

    // Модальне вікно для ввімкнення/вимкнення RU кінотеатрів
    function showRuCinemasSettings() {
        var $container = $('<div class="cinemabywolf-cinema-btns" style="display:flex;flex-direction:column;align-items:center;padding:20px;"></div>');
        for (var i = 0; i < RU_CINEMAS.length; i++) {
            (function(c, idx) {
                var enabled = CinemaByWolf.settings.ru_cinemas[c.networkId];
                var $btn = $('<div class="cinemabywolf-cinema-btn selector" tabindex="' + (idx === 0 ? '0' : '-1') + '"></div>');
                var icon = enabled ? '<span class="cinemabywolf-cinema-btn__icon">✔</span>' : '<span class="cinemabywolf-cinema-btn__icon">✖</span>';
                var nameHtml = '<span class="cinemabywolf-cinema-btn__name">' + c.name + '</span>';
                $btn.toggleClass('enabled', enabled);
                $btn.html(icon + nameHtml);
                $btn.on('hover:enter', function() {
                    var now = !CinemaByWolf.settings.ru_cinemas[c.networkId];
                    CinemaByWolf.settings.ru_cinemas[c.networkId] = now;
                    saveSettings();
                    $btn.toggleClass('enabled', now);
                    var icon = now ? '<span class="cinemabywolf-cinema-btn__icon">✔</span>' : '<span class="cinemabywolf-cinema-btn__icon">✖</span>';
                    $btn.html(icon + nameHtml);
                });
                $container.append($btn);
            })(RU_CINEMAS[i], i);
        }
        Lampa.Modal.open({
            title: 'Ввімкнення RU Кінотеатрів',
            html: $container,
            size: 'small',
            onBack: function() {
                Lampa.Modal.close();
                Lampa.Controller.toggle('settings');
            }
        });
        setTimeout(function() {
            var $btns = $container.find('.cinemabywolf-cinema-btn');
            var name = 'cinemabywolf-ru-btns';
            var lastFocus = 0;
            function updateFocus(index) {
                $btns.removeClass('focus').attr('tabindex', '-1');
                if ($btns.eq(index).length) {
                    $btns.eq(index).addClass('focus').attr('tabindex', '0').focus();
                    var btn = $btns.get(index);
                    if (btn && btn.scrollIntoView) {
                        btn.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
                    }
                    lastFocus = index;
                }
            }
            Lampa.Controller.add(name, {
                toggle: function() {
                    Lampa.Controller.collectionSet($btns);
                    updateFocus(lastFocus);
                },
                up: function() {
                    if (lastFocus > 0) updateFocus(lastFocus - 1);
                },
                down: function() {
                    if (lastFocus < $btns.length - 1) updateFocus(lastFocus + 1);
                },
                left: function() {},
                right: function() {},
                back: function() {
                    Lampa.Modal.close();
                    Lampa.Controller.toggle('settings');
                },
                enter: function() {
                    $btns.eq(lastFocus).trigger('hover:enter');
                }
            });
            Lampa.Controller.toggle(name);
        }, 100);
    }
    // Модальне вікно для ввімкнення/вимкнення EN кінотеатрів
    function showEnCinemasSettings() {
        var $container = $('<div class="cinemabywolf-cinema-btns" style="display:flex;flex-direction:column;align-items:center;padding:20px;"></div>');
        for (var i = 0; i < EN_CINEMAS.length; i++) {
            (function(c, idx) {
                var enabled = CinemaByWolf.settings.en_cinemas[c.networkId];
                var $btn = $('<div class="cinemabywolf-cinema-btn selector" tabindex="' + (idx === 0 ? '0' : '-1') + '"></div>');
                var icon = enabled ? '<span class="cinemabywolf-cinema-btn__icon">✔</span>' : '<span class="cinemabywolf-cinema-btn__icon">✖</span>';
                var nameHtml = '<span class="cinemabywolf-cinema-btn__name">' + c.name + '</span>';
                $btn.toggleClass('enabled', enabled);
                $btn.html(icon + nameHtml);
                $btn.on('hover:enter', function() {
                    var now = !CinemaByWolf.settings.en_cinemas[c.networkId];
                    CinemaByWolf.settings.en_cinemas[c.networkId] = now;
                    saveSettings();
                    $btn.toggleClass('enabled', now);
                    var icon = now ? '<span class="cinemabywolf-cinema-btn__icon">✔</span>' : '<span class="cinemabywolf-cinema-btn__icon">✖</span>';
                    $btn.html(icon + nameHtml);
                });
                $container.append($btn);
            })(EN_CINEMAS[i], i);
        }
        Lampa.Modal.open({
            title: 'Ввімкнення EN Кінотеатрів',
            html: $container,
            size: 'medium',
            onBack: function() {
                Lampa.Modal.close();
                Lampa.Controller.toggle('settings');
            }
        });
        setTimeout(function() {
            var $btns = $container.find('.cinemabywolf-cinema-btn');
            var name = 'cinemabywolf-en-btns';
            var lastFocus = 0;
            function updateFocus(index) {
                $btns.removeClass('focus').attr('tabindex', '-1');
                if ($btns.eq(index).length) {
                    $btns.eq(index).addClass('focus').attr('tabindex', '0').focus();
                    var btn = $btns.get(index);
                    if (btn && btn.scrollIntoView) {
                        btn.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
                    }
                    lastFocus = index;
                }
            }
            Lampa.Controller.add(name, {
                toggle: function() {
                    Lampa.Controller.collectionSet($btns);
                    updateFocus(lastFocus);
                },
                up: function() {
                    if (lastFocus > 0) updateFocus(lastFocus - 1);
                },
                down: function() {
                    if (lastFocus < $btns.length - 1) updateFocus(lastFocus + 1);
                },
                left: function() {},
                right: function() {},
                back: function() {
                    Lampa.Modal.close();
                    Lampa.Controller.toggle('settings');
                },
                enter: function() {
                    $btns.eq(lastFocus).trigger('hover:enter');
                }
            });
            Lampa.Controller.toggle(name);
        }, 100);
    }
    // Модальне вікно для ввімкнення/вимкнення UA кінотеатрів
    function showUaCinemasSettings() {
        var $container = $('<div class="cinemabywolf-cinema-btns" style="display:flex;flex-direction:column;align-items:center;padding:20px;"></div>');
        for (var i = 0; i < UA_CINEMAS.length; i++) {
            (function(c, idx) {
                var enabled = CinemaByWolf.settings.ua_cinemas[c.networkId];
                var $btn = $('<div class="cinemabywolf-cinema-btn selector" tabindex="' + (idx === 0 ? '0' : '-1') + '"></div>');
                var icon = enabled ? '<span class="cinemabywolf-cinema-btn__icon">✔</span>' : '<span class="cinemabywolf-cinema-btn__icon">✖</span>';
                var nameHtml = '<span class="cinemabywolf-cinema-btn__name">' + c.name + '</span>';
                $btn.toggleClass('enabled', enabled);
                $btn.html(icon + nameHtml);
                $btn.on('hover:enter', function() {
                    var now = !CinemaByWolf.settings.ua_cinemas[c.networkId];
                    CinemaByWolf.settings.ua_cinemas[c.networkId] = now;
                    saveSettings();
                    $btn.toggleClass('enabled', now);
                    var icon = now ? '<span class="cinemabywolf-cinema-btn__icon">✔</span>' : '<span class="cinemabywolf-cinema-btn__icon">✖</span>';
                    $btn.html(icon + nameHtml);
                });
                $container.append($btn);
            })(UA_CINEMAS[i], i);
        }
        Lampa.Modal.open({
            title: 'Ввімкнення UA Кінотеатрів',
            html: $container,
            size: 'small',
            onBack: function() {
                Lampa.Modal.close();
                Lampa.Controller.toggle('settings');
            }
        });
        setTimeout(function() {
            var $btns = $container.find('.cinemabywolf-cinema-btn');
            var name = 'cinemabywolf-ua-btns';
            var lastFocus = 0;
            function updateFocus(index) {
                $btns.removeClass('focus').attr('tabindex', '-1');
                if ($btns.eq(index).length) {
                    $btns.eq(index).addClass('focus').attr('tabindex', '0').focus();
                    var btn = $btns.get(index);
                    if (btn && btn.scrollIntoView) {
                        btn.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
                    }
                    lastFocus = index;
                }
            }
            Lampa.Controller.add(name, {
                toggle: function() {
                    Lampa.Controller.collectionSet($btns);
                    updateFocus(lastFocus);
                },
                up: function() {
                    if (lastFocus > 0) updateFocus(lastFocus - 1);
                },
                down: function() {
                    if (lastFocus < $btns.length - 1) updateFocus(lastFocus + 1);
                },
                left: function() {},
                right: function() {},
                back: function() {
                    Lampa.Modal.close();
                    Lampa.Controller.toggle('settings');
                },
                enter: function() {
                    $btns.eq(lastFocus).trigger('hover:enter');
                }
            });
            Lampa.Controller.toggle(name);
        }, 100);
    }

    // Основний компонент налаштувань
    function addSettingsComponent() {
        Lampa.SettingsApi.addComponent({
            component: 'cinemabywolf',
            name: 'Онлайн кінотеатри',
            icon: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="2" y="5" width="20" height="14" rx="2" stroke="currentColor" stroke-width="2"/><polygon points="10,9 16,12 10,15" fill="currentColor"/></svg>'
        });

        // Показувати RU Кінотеатри на головній
        Lampa.SettingsApi.addParam({
            component: 'cinemabywolf',
            param: { name: 'show_ru', type: 'trigger', default: CinemaByWolf.settings.show_ru },
            field: { name: 'Показувати RU Кінотеатри на головній' },
            onChange: function(val) {
                if (CinemaByWolf.debug) {
                    console.log('cinemabywolf: show_ru змінено на', val);
                }
                CinemaByWolf.settings.show_ru = val;
                saveSettings();
                refreshMenuButtons();
            }
        });
        // Показувати EN Кінотеатри на головній
        Lampa.SettingsApi.addParam({
            component: 'cinemabywolf',
            param: { name: 'show_en', type: 'trigger', default: CinemaByWolf.settings.show_en },
            field: { name: 'Показувати EN Кінотеатри на головній' },
            onChange: function(val) {
                if (CinemaByWolf.debug) {
                    console.log('cinemabywolf: show_en змінено на', val);
                }
                CinemaByWolf.settings.show_en = val;
                saveSettings();
                refreshMenuButtons();
            }
        });
        // Показувати UA Кінотеатри на головній
        Lampa.SettingsApi.addParam({
            component: 'cinemabywolf',
            param: { name: 'show_ua', type: 'trigger', default: CinemaByWolf.settings.show_ua },
            field: { name: 'Показувати UA Кінотеатри на головній' },
            onChange: function(val) {
                if (CinemaByWolf.debug) {
                    console.log('cinemabywolf: show_ua змінено на', val);
                }
                CinemaByWolf.settings.show_ua = val;
                saveSettings();
                refreshMenuButtons();
            }
        });
        // Кнопка для окремого меню RU
        Lampa.SettingsApi.addParam({
            component: 'cinemabywolf',
            param: { type: 'button', component: 'ru_cinemas_list' },
            field: { name: 'Ввімкнення RU Кінотеатрів', description: 'Вибрати які RU сервіси показувати' },
            onChange: showRuCinemasSettings
        });
        // Кнопка для окремого меню EN
        Lampa.SettingsApi.addParam({
            component: 'cinemabywolf',
            param: { type: 'button', component: 'en_cinemas_list' },
            field: { name: 'Ввімкнення EN Кінотеатрів', description: 'Вибрати які EN сервіси показувати' },
            onChange: showEnCinemasSettings
        });
        // Кнопка для окремого меню UA
        Lampa.SettingsApi.addParam({
            component: 'cinemabywolf',
            param: { type: 'button', component: 'ua_cinemas_list' },
            field: { name: 'Ввімкнення UA Кінотеатрів', description: 'Вибрати які UA сервіси показувати' },
            onChange: showUaCinemasSettings
        });
        // Режим сортування
        Lampa.SettingsApi.addParam({
            component: 'cinemabywolf',
            param: {
                name: 'sort_mode',
                type: 'select',
                values: SORT_MODES,
                default: CinemaByWolf.settings.sort_mode
            },
            field: { name: 'Режим сортування' },
            onChange: function(val) {
                CinemaByWolf.settings.sort_mode = val;
                saveSettings();
            }
        });
    }

    // Функція для повного оновлення кнопок меню
    function refreshMenuButtons() {
        $('.menu__item.cinemabywolf-btn-ru, .menu__item.cinemabywolf-btn-en, .menu__item.cinemabywolf-btn-ua').remove();
        addMenuButtons();
    }

    // Ініціалізація
    function startPlugin() {
        loadSettings();
        addLocalization();
        addStyles();
        addSettingsComponent();
        if (CinemaByWolf.debug) {
            console.log('cinemabywolf: налаштування завантажено', CinemaByWolf.settings);
        }
        Lampa.Listener.follow('app', function (e) {
            if (e.type === 'ready') {
                setTimeout(refreshMenuButtons, 1000);
            }
        });
        Lampa.Listener.follow('settings', function(e) {
            if (e.type === 'update') {
                refreshMenuButtons();
            }
        });
        // Новий слухач: оновлювати кнопки при кожному відкритті меню
        Lampa.Listener.follow('menu', function(e) {
            if (e.type === 'open') {
                refreshMenuButtons();
            }
        });
        if (CinemaByWolf.debug) {
            console.log('cinemabywolf: плагін ініціалізовано');
        }
    }

    startPlugin();

    // Експорт
    window.cinemabywolf = CinemaByWolf;

})();