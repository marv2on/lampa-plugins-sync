(function () {
    'use strict';

    if (window.ymod_loaded) return;
    window.ymod_loaded = true;

    var YMOD = 'ymod_';

    function isEnabled(mod) {
        return Lampa.Storage.get(YMOD + 'enable_' + mod, true);
    }

    var yIcon = '<svg width="24" height="24" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><text x="50%" y="54%" dominant-baseline="middle" text-anchor="middle" font-weight="900" font-size="20" fill="currentColor">Y</text></svg>';

    var mdblistSvg = "data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' width='24' height='24' fill='%23ffffff' style='opacity:1;'%3E%3Cpath d='M1.928.029A2.47 2.47 0 0 0 .093 1.673c-.085.248-.09.629-.09 10.33s.005 10.08.09 10.33a2.51 2.51 0 0 0 1.512 1.558l.276.108h20.237l.277-.108a2.51 2.51 0 0 0 1.512-1.559c.085-.25.09-.63.09-10.33s-.005-10.08-.09-10.33A2.51 2.51 0 0 0 22.395.115l-.277-.109L12.117 0C6.615-.004 2.032.011 1.929.029m7.48 8.067l2.123 2.004v1.54c0 .897-.02 1.536-.043 1.527s-.92-.845-1.995-1.86c-1.071-1.01-1.962-1.84-1.977-1.84s-.024 1.91-.024 4.248v4.25H4.911V6.085h1.188l1.183.006zm9.729 3.93v5.94h-2.63l-.01-4.25l-.013-4.25l-1.907 1.795a367 367 0 0 1-1.98 1.864c-.076.056-.08-.047-.08-1.489v-1.555l2.127-1.995l2.122-1.995l1.187-.005h1.184z'/%3E%3C/svg%3E";

    var rateIcons = {
        imdb: 'https://upload.wikimedia.org/wikipedia/commons/5/53/IMDB_-_SuperTinyIcons.svg',
        rt: 'https://upload.wikimedia.org/wikipedia/commons/5/5b/Rotten_Tomatoes.svg',
        mc: 'https://upload.wikimedia.org/wikipedia/commons/e/e1/Metacritic_logo_Roundel.svg',
        tmdb: 'https://upload.wikimedia.org/wikipedia/commons/8/89/Tmdb.new.logo.svg',
        cub: 'https://raw.githubusercontent.com/yumata/lampa/9381985ad4371d2a7d5eb5ca8e3daf0f32669eb7/img/logo-icon.svg',
        oscar: 'https://upload.wikimedia.org/wikipedia/commons/f/f8/Oscar_gold_silhouette.svg',
        award: 'https://upload.wikimedia.org/wikipedia/commons/e/e8/Barnstar_film_3.svg',
        trakt: 'https://upload.wikimedia.org/wikipedia/commons/3/3d/Trakt.tv-favicon.svg',
        mdblist: mdblistSvg,
        popcorn: 'https://upload.wikimedia.org/wikipedia/commons/d/da/Rotten_Tomatoes_positive_audience.svg',
        letterboxd: 'https://upload.wikimedia.org/wikipedia/commons/9/9b/Letterboxd_2023_logo.png'
    };

    var uatorIcons = {
        ua: 'https://yarikrazor-star.github.io/lmp/ua.svg',
        none: 'https://yarikrazor-star.github.io/lmp/dontknow.svg',
        top: 'https://yarikrazor-star.github.io/lmp/stream.svg',
        seeds: 'https://yarikrazor-star.github.io/lmp/upload.svg',
        audio: 'https://yarikrazor-star.github.io/lmp/zvuk.svg',
        dv: 'https://upload.wikimedia.org/wikipedia/commons/0/03/Dolby_Vision_2021_logo.svg',
        hdr: 'https://yarikrazor-star.github.io/lmp/hdr.svg'
    };

    var renderOrder = {
        'oscar': 1, 'award': 2, 'tmdb': 3, 'imdb': 4, 'rt': 5,
        'mc': 6, 'trakt': 7, 'cub': 8, 'popcorn': 9, 'mdblist': 10, 'letterboxd': 11
    };

    var availableRatings =[
        { key: 'tmdb', name: 'TMDB', default: true },
        { key: 'imdb', name: 'IMDb', default: true },
        { key: 'rt', name: 'Rotten Tomatoes', default: true },
        { key: 'mc', name: 'Metacritic', default: true },
        { key: 'trakt', name: 'Trakt TV', default: true },
        { key: 'cub', name: 'Lampa (CUB)', default: true },
        { key: 'popcorn', name: 'RT Audience (Popcorn)', default: true },
        { key: 'mdblist', name: 'MDBList Score', default: true },
        { key: 'letterboxd', name: 'Letterboxd', default: true },
        { key: 'awards', name: 'Нагороди (Awards)', default: true }
    ];

    var countryNames = {
        'us': 'США', 'usa': 'США', 'gb': 'Велика Британія', 'uk': 'Велика Британія',
        'ua': 'Україна', 'ca': 'Канада', 'hk': 'Гонконг', 'fr': 'Франція',
        'de': 'Німеччина', 'it': 'Італія', 'es': 'Іспанія', 'jp': 'Японія',
        'kr': 'Південна Корея', 'cn': 'Китай', 'pl': 'Польща', 'au': 'Австралія',
        'ie': 'Ірландія', 'be': 'Бельгія', 'dk': 'Данія', 'no': 'Норвегія',
        'se': 'Швеція', 'fi': 'Фінляндія', 'tr': 'Туреччина', 'in': 'Індія',
        'br': 'Бразилія', 'mx': 'Мексика', 'nl': 'Нідерланди', 'at': 'Австрія',
        'ch': 'Швейцарія', 'cz': 'Чехія', 'hu': 'Угорщина', 'nz': 'Нова Зеландія',
        'za': 'ПАР', 'il': 'Ізраїль', 'th': 'Таїланд', 'tw': 'Тайвань', 
        'ru': 'Країна-агресор', 'pt': 'Португалія', 'gr': 'Греція',
        'is': 'Ісландія', 'ro': 'Румунія', 'bg': 'Болгарія',
        'ar': 'Аргентина', 'cl': 'Чилі', 'co': 'Колумбія', 'pe': 'Перу',
        'id': 'Індонезія', 'my': 'Малайзія', 'ph': 'Філіппіни', 'sg': 'Сінгапур',
        'vn': 'В\'єтнам', 'ae': 'ОАЕ', 'sa': 'Саудівська Аравія', 'eg': 'Єгипет'
    };

    var titleCache = Lampa.Storage.get("title_cache_hybrid_v3") || {};
    var studiosCache = {};
    var uatorCache = {};

    var styles = `
        .ymod-slogan-hidden .full-start__tagline, 
        .ymod-slogan-hidden [class*="tagline"],
        .ymod-slogan-hidden .full-start__description + div:not([class]) {
            display: none !important; height: 0px !important; min-height: 0px !important; margin: 0px !important; padding: 0px !important;
            font-size: 0px !important; line-height: 0 !important; visibility: hidden !important; opacity: 0 !important;
            pointer-events: none !important; position: absolute !important; z-index: -1;
        }
        .ymod-slogan-hidden .full-start__title { margin-bottom: 5px !important; }
        .ymod-slogan-hidden .full-start__details { margin-top: 0px !important; margin-bottom: 10px !important; }
        
        .plugin-hybrid-title { margin-top: 5px; margin-bottom: 5px; width: 100%; position: relative; z-index: 10; text-align: left; }
        .plugin-hybrid-title__body { line-height: 1.2; font-weight: bold; display: flex; align-items: baseline; flex-wrap: wrap; justify-content: flex-start; }
        
        .omdb-mdb-yarik-rate { display: flex; flex-wrap: wrap; align-items: center; width: 100%; min-height: 25px; margin: 0; }
        .omdb-mdb-yarik-rate.is-bw-text .custom-rating div { color: #cccccc !important; }
        .full-start__rate.custom-rating { display: inline-flex !important; align-items: center !important; margin: 0 !important; flex-shrink: 0 !important; gap: 0.35em; white-space: nowrap !important; }
        .custom-rating .rating-icon-wrap { width: 1.1em; height: 1.1em; display: flex; align-items: center; justify-content: center; }
        .custom-rating img { width: 100%; height: 100%; object-fit: contain; display: block; }
        .custom-rating div { font-weight: bold; line-height: 1; font-size: 1em !important; }
        .omdb-api-val { margin-left: auto; font-size: 0.9em; opacity: 0.7; max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; padding-left: 10px; }
        
        .ymod-ratings-enabled .rate--tmdb, .ymod-ratings-enabled .rate--imdb, .ymod-ratings-enabled .rate--kp, .ymod-ratings-enabled .full-start__rates { display: none !important; }
        
        .rate--studio.studio-logo { align-items: center; vertical-align: middle; border-radius: 8px; transition: all 0.2s ease; height: auto; cursor: pointer; }
        .rate--studio.studio-logo.focus { background: rgba(255,255,255,0.2) !important; border: 1px solid #fff; transform: scale(1.05); }
        .rate--studio.studio-logo img { max-width: 200px; width: auto; object-fit: contain; transition: filter 0.3s ease; }
        .studio-logo-text { font-size: 0.8em; font-weight: bold; color: #fff !important; white-space: nowrap; }
        
        .quality-badges-container { display: flex; align-items: center; }
        .qb-unified-block { display: flex; flex-wrap: nowrap; align-items: center; gap: 0.45em; }
        .quality-badge { display: inline-flex; align-items: center; gap: 0.35em; color: #fff; white-space: nowrap; flex-shrink: 0; height: 1.1em; }
        .qb-text { font-weight: bold; line-height: 1.1em; height: 1.1em; display: flex; align-items: center; }
        .qb-prefix-icon { height: 1.1em !important; width: auto; display: block; object-fit: contain; margin: 0; }
        .qb-text-icon { height: 1.1em !important; line-height: 1.1em !important; font-size: 0.85em !important; font-weight: 900; display: inline-flex; align-items: center; justify-content: center; background: #fff; color: #000; padding: 0 0.25em; border-radius: 2px; box-sizing: border-box; vertical-align: top; }
        .qb-not-found { opacity: 0.6; }
        
        .card .qb-unified-block { position: absolute; top: 0.5rem; left: 0.5rem; z-index: 10; flex-direction: column; align-items: flex-start; gap: 0.2rem; font-size: 0.7em !important; }
        .card .quality-badge { background: rgba(0, 0, 0, 0.6); padding: 2px 4px; border-radius: 4px; height: 1em; }
        .card .qb-prefix-icon, .card .qb-text-icon { height: 1em !important; }
        .card .qb-text { height: 1em; line-height: 1em; }

        @media screen and (orientation: portrait), screen and (max-width: 767px) {
            .plugin-hybrid-title { text-align: center !important; }
            .plugin-hybrid-title__body { justify-content: center !important; }
            .omdb-mdb-yarik-rate { justify-content: center; }
            .plugin-uk-title-combined { align-items: center !important; text-align: center !important; }
            .studio-logos-container { justify-content: center !important; }
            .quality-badges-container { width: 100%; justify-content: center; display: block !important; margin: 10px 0; clear: both; }
            .qb-unified-block { flex-wrap: wrap; justify-content: center; width: 100%; }

            /* Центрування вікового рейтингу та статусу */
            .card__age { 
                text-align: center !important; 
                width: 100% !important; 
                display: block !important; 
            }
            .full-start__pg { 
                text-align: center !important; 
                display: flex !important; 
                justify-content: center !important; 
                align-items: center !important; 
                margin-left: auto !important; 
                margin-right: auto !important; 
            }
            .full-start-new__details, .full-start__details { 
                justify-content: center !important; 
                display: flex !important; 
                flex-wrap: wrap !important;
            }
            .full-start-new__details > *, .full-start__details > * { 
                text-align: center !important; 
                margin: 0.45em !important; 
            }
        }
        
        div[data-component="ym_logo"], div[data-component="ym_title"], div[data-component="ym_ratings"], div[data-component="ym_ratings_select"], div[data-component="ym_studios"], div[data-component="ym_uator"] { display: none !important; }
    `;
    $('head').append('<style id="ymod-global-styles">' + styles + '</style>');

    function updateBodyClasses() {
        if (isEnabled('slogan')) $('body').addClass('ymod-slogan-hidden');
        else $('body').removeClass('ymod-slogan-hidden');
        if (isEnabled('ratings')) $('body').addClass('ymod-ratings-enabled');
        else $('body').removeClass('ymod-ratings-enabled');
    }
    updateBodyClasses();

    function ymodCleanSlogan() {
        var full = document.querySelector('.full-start');
        if (full) {
            var nodes = full.querySelectorAll('div, span, p');
            nodes.forEach(function(node) {
                if (node.innerText && node.innerText.length > 3 && node.innerText.length < 150) {
                    var prev = node.previousElementSibling;
                    if (prev && prev.classList.contains('full-start__details')) {
                        node.style.display = 'none';
                        node.setAttribute('data-slogan-hidden', 'true');
                    }
                }
            });
        }
    }

    var sloganObserver = new MutationObserver(function() {
        if (isEnabled('slogan')) ymodCleanSlogan();
    });
    sloganObserver.observe(document.body, { childList: true, subtree: true });

    function analyzeAndInvert(img, threshold) {
        try {
            var canvas = document.createElement('canvas');
            var ctx = canvas.getContext('2d');
            canvas.width = img.naturalWidth || img.width;
            canvas.height = img.naturalHeight || img.height;
            if (canvas.width === 0 || canvas.height === 0) return;
            ctx.drawImage(img, 0, 0);
            var imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            var data = imageData.data;
            var darkPixels = 0;
            var totalPixels = 0;
            for (var i = 0; i < data.length; i += 4) {
                var alpha = data[i + 3];
                if (alpha < 10) continue;
                totalPixels++;
                var r = data[i], g = data[i + 1], b = data[i + 2];
                var brightness = (r * 299 + g * 587 + b * 114) / 1000;
                if (brightness < 120) darkPixels++;
            }
            if (totalPixels > 0 && (darkPixels / totalPixels) >= threshold) {
                img.style.filter += " brightness(0) invert(1)";
            }
        } catch (e) {}
    }

    function handleLogo(e) {
        var TARGET_WIDTH = "7em";
        var data = e.data.movie;
        var type = data.name ? "tv" : "movie";
        var title_elem = e.object.activity.render().find(".full-start-new__title");
        var head_elem = e.object.activity.render().find(".full-start-new__head");
        var details_elem = e.object.activity.render().find(".full-start-new__details");
        var dom_title = title_elem[0];

        if (window.innerHeight > window.innerWidth) title_elem.css("text-align", "center");
        else title_elem.css("text-align", "left");

        if (Lampa.Storage.get("logo_glav", "0") == "1") return;

        var user_lang = Lampa.Storage.get("logo_lang", "uk");
        var target_lang = user_lang ? user_lang : Lampa.Storage.get("language");
        var size = Lampa.Storage.get("logo_size", "original");
        var cache_key = "logo_cache_v2_" + type + "_" + data.id + "_" + target_lang;

        if (head_elem.length && details_elem.length && details_elem.find(".logo-moved-head").length === 0) {
            var content = head_elem.html();
            if (content) {
                head_elem.hide();
                if (details_elem.children().length > 0) details_elem.append('<span class="full-start-new__split logo-moved-separator">●</span>');
                details_elem.append('<span class="logo-moved-head">' + content + "</span>");
            }
        }

        function startLogoAnimation(img_url, save_to_cache) {
            if (save_to_cache) Lampa.Storage.set(cache_key, img_url);
            var img = new Image();
            img.crossOrigin = "anonymous";
            img.src = img_url;
            var start_text_height = dom_title ? dom_title.getBoundingClientRect().height : 0;
            
            img.onload = function () {
                if (dom_title) {
                    dom_title.style.height = ""; dom_title.style.margin = "0"; dom_title.style.padding = "0";
                    dom_title.style.overflow = ""; dom_title.style.display = ""; dom_title.style.transition = "none";
                    dom_title.style.boxSizing = ""; dom_title.style.opacity = "1";
                    if (window.innerHeight > window.innerWidth) dom_title.style.textAlign = "center";
                    else dom_title.style.textAlign = "left";
                }
                img.style.marginTop = "0"; img.style.marginBottom = "0"; img.style.paddingTop = "0em"; img.style.paddingBottom = "0em";
                
                var use_text_height = Lampa.Storage.get("logo_use_text_height", false);
                if (use_text_height && start_text_height) {
                    img.style.height = start_text_height + "px"; img.style.width = "auto";
                } else {
                    if (window.innerWidth < 768) { img.style.width = "100%"; img.style.height = "auto"; }
                    else { img.style.width = TARGET_WIDTH; img.style.height = "auto"; }
                }
                
                img.style.maxWidth = "50vw";
                img.style.maxHeight = "15vh";
                
                img.style.boxSizing = "border-box"; img.style.display = "block"; img.style.objectFit = "contain";
                if (window.innerHeight > window.innerWidth) { img.style.objectPosition = "center"; img.style.marginLeft = "auto"; img.style.marginRight = "auto"; }
                else { img.style.objectPosition = "left bottom"; img.style.marginLeft = "0"; img.style.marginRight = "0"; }
                
                img.style.opacity = "1"; img.style.transition = "none";
                var saturation = Lampa.Storage.get("logo_saturation", "1");
                img.style.filter = "drop-shadow(3px 3px 3px rgba(0, 0, 0, 0.5)) saturate(" + saturation + ")";
                
                analyzeAndInvert(img, 0.85);
                title_elem.empty().append(img);
                title_elem.css({ opacity: "1", transition: "none" });
            };
            img.onerror = function () {
                Lampa.Storage.set(cache_key, "none");
                title_elem.css({ opacity: "1" });
            };
        }

        var cached_url = Lampa.Storage.get(cache_key);
        if (cached_url && cached_url !== "none") {
            startLogoAnimation(cached_url, false);
            return;
        }

        if (data.id) {
            var url = Lampa.TMDB.api(type + "/" + data.id + "/images?api_key=" + Lampa.TMDB.key() + "&include_image_language=" + target_lang + ",en,null");
            $.get(url, function (data_api) {
                var final_logo = null;
                if (data_api.logos && data_api.logos.length > 0) {
                    var found = data_api.logos.find(function(l) { return l.iso_639_1 == target_lang; }) || data_api.logos.find(function(l) { return l.iso_639_1 == "en"; });
                    if (found) final_logo = found.file_path;
                }
                if (final_logo) {
                    var img_url = Lampa.TMDB.image("/t/p/" + size + final_logo.replace(".svg", ".png"));
                    startLogoAnimation(img_url, true);
                } else {
                    Lampa.Storage.set(cache_key, "none");
                }
            });
        }
    }

    function getCountryUA(iso) {
        if (!iso) return '';
        var code = iso.toLowerCase().trim();
        return countryNames[code] || Lampa.Lang.translate(code) || iso;
    }

    function renderHybridTitle(render, ukTitle, enTitle, hasLogo, year, country) {
        if (!render) return;
        $(".plugin-hybrid-title", render).remove();
        var mode = Lampa.Storage.get('hybrid_title_mode', 'smart');
        var sizeKey = Lampa.Storage.get('hybrid_title_size', 'm');
        var displayTitle = (mode === 'smart' && hasLogo) ? enTitle : ukTitle;
        if (!displayTitle || displayTitle === "undefined") displayTitle = "";

        var sizes = {
            'xs': { title: '1.0em', info: '0.8em' }, 's': { title: '1.2em', info: '0.9em' },
            'm': { title: '1.4em', info: '1.0em' }, 'l': { title: '1.7em', info: '1.1em' },
            'xl': { title: '2.0em', info: '1.2em' }, 'xxl': { title: '2.4em', info: '1.3em' },
            'giant': { title: '3.0em', info: '1.5em' }
        };
        var currentSize = sizes[sizeKey] || sizes['m'];

        var details =[];
        if (year && year !== "undefined") details.push(year);
        if (country && country !== "undefined") details.push(country);
        var secondaryInfo = details.length > 0 ? ' • ' + details.join(' • ') : '';

        var html = '<div class="plugin-hybrid-title"><div class="plugin-hybrid-title__body">' +
            '<span style="font-size: ' + currentSize.title + '; color: #fff; opacity: 0.8;">' + displayTitle + '</span>' + 
            '<span style="font-size: ' + currentSize.info + '; color: #fff; opacity: 0.5; margin-left: 6px;">' + secondaryInfo + '</span>' +
            '</div></div>';

        var target = $(".full-start-new__title", render);
        if(!target.length) target = $(".full-start__title", render);
        target.after(html);
    }

    function handleHybridTitle(e) {
        var card = e.data.movie;
        var render = e.object.activity.render();
        var cached = titleCache[card.id];
        var now = Date.now();

        if (cached && (now - cached.timestamp < 2592000000)) {
            renderHybridTitle(render, cached.ukTitle, cached.enTitle, cached.hasLogo, cached.year, cached.country);
            return;
        }

        var type = card.first_air_date ? "tv" : "movie";
        var url = "https://api.themoviedb.org/3/" + type + "/" + card.id + "?api_key=" + Lampa.TMDB.key() + "&append_to_response=translations,images&include_image_language=uk,en,null";

        $.getJSON(url, function (data) {
            var hasUkrainianLogo = false;
            if (data.images && data.images.logos) {
                hasUkrainianLogo = data.images.logos.some(function (l) { return l.iso_639_1 === "uk"; });
            }
            var originalName = data.original_title || data.original_name || card.original_title || card.original_name || "";
            var enTitle = data.title || data.name || originalName;
            var ukTitle = enTitle;
            if (data.translations && data.translations.translations) {
                var translation = data.translations.translations.find(function (t) { return t.iso_3166_1 === "UA" || t.iso_639_1 === "uk"; });
                if (translation) ukTitle = translation.data.title || translation.data.name || enTitle;
            }
            var dateStr = data.release_date || data.first_air_date || "";
            var year = dateStr ? dateStr.split("-")[0] : "";
            var countryList = (data.production_countries ||[]).map(function (c) { return getCountryUA(c.iso_3166_1); });
            var countryString = countryList.join(" / ");

            titleCache[card.id] = { ukTitle: ukTitle || "", enTitle: enTitle || "", hasLogo: hasUkrainianLogo, year: year || "", country: countryString || "", timestamp: now };
            Lampa.Storage.set("title_cache_hybrid_v3", titleCache);
            renderHybridTitle(render, ukTitle, enTitle, hasUkrainianLogo, year, countryString);
        }).fail(function() {
            var fallbackTitle = card.title || card.name || card.original_title || "";
            renderHybridTitle(render, fallbackTitle, fallbackTitle, false, "", "");
        });
    }

    function normalizeRating(val, type) {
        if (!val && val !== 0) return '0.0';
        var strVal = String(val).replace('%', ''); 
        var num = parseFloat(strVal);
        if (isNaN(num)) return '0.0';
        if (type === 'letterboxd' && num <= 5) num = num * 2;
        else if (num > 10) num = num / 10;
        return num.toFixed(1);
    }

    function getRatingColor(rating) {
        var val = parseFloat(rating);
        if (!val || val === 0) return '#fff';
        if (val < 3) return '#ff4d4d';
        else if (val < 5) return '#ff9f43';
        else if (val < 7.0) return '#feca57';
        else return '#2ecc71';
    }

    function addRatingBlock(container, className, iconUrl, rawValue, keyName) {
        if (keyName && !Lampa.Storage.get('omdb_rating_toggle_' + keyName, true)) return;
        if (container.find('.' + className).length > 0) return; 
        if (!rawValue || rawValue === '0' || rawValue === '0.0' || rawValue === 'N/A' || rawValue === '0%') return;
        
        var isAward = (keyName === 'awards');
        var finalValue = isAward ? rawValue : normalizeRating(rawValue, keyName);
        if (!isAward && finalValue === '0.0') return;

        var color = isAward ? '#feca57' : getRatingColor(finalValue);
        if (isAward) color = (className.indexOf('oscar') > -1) ? '#feca57' : '#fff';
        var orderKey = keyName;
        if (className.indexOf('oscar') > -1) orderKey = 'oscar';
        else if (className.indexOf('award') > -1) orderKey = 'award';

        var size = Lampa.Storage.get('omdb_rating_size', '1.1em');
        var order = renderOrder[orderKey] || 50;
        var sat = Lampa.Storage.get('omdb_rating_saturation', '75%');
        
        var block = $('<div class="full-start__rate custom-rating ' + className + '" style="font-size: ' + size + '; order: ' + order + ';">\
            <div class="rating-icon-wrap"><img src="' + iconUrl + '" style="filter: saturate(' + sat + ');" /></div>\
            <div style="color: ' + color + '">' + finalValue + '</div>\
        </div>');
        container.append(block);
    }

    function getCubRating(e) {
        if (!e.object || !e.object.source || !(e.object.source === 'cub' || e.object.source === 'tmdb')) return null;
        var reactionCoef = { fire: 10, nice: 7.5, think: 5, bore: 2.5, shit: 0 };
        var sum = 0, cnt = 0;
        if (e.data && e.data.reactions && e.data.reactions.result) {
            e.data.reactions.result.forEach(function(r) {
                if (r.counter) { sum += (r.counter * reactionCoef[r.type]); cnt += r.counter; }
            });
        }
        if (cnt >= 20) {
            var isTv = e.object.method === 'tv';
            var avg = isTv ? 7.436 : 6.584;
            var m = isTv ? 69 : 274;
            return ((avg * m + sum) / (m + cnt)).toFixed(1);
        }
        return null;
    }

    function handleRatings(e) {
        var render = e.object.activity.render();
        var movie = e.data.movie;
        
        var container = render.find('.omdb-mdb-yarik-rate');
        if (container.length > 1) { container.not(':first').remove(); container = render.find('.omdb-mdb-yarik-rate').first(); }

        if (container.length === 0) {
            container = $('<div class="omdb-mdb-yarik-rate"></div>');
            var cardifyLeft = render.find('.cardify__left');
            if (cardifyLeft.length > 0) {
                var localRateLine = cardifyLeft.find('.full-start-new__rate-line, .full-start__rate-line').first();
                var localTitle = cardifyLeft.find('.full-start-new__title, .full-start__title').first();
                if (localRateLine.length > 0) container.insertBefore(localRateLine);
                else if (localTitle.length > 0) container.insertAfter(localTitle);
                else cardifyLeft.append(container);
            } else {
                var rateLine = render.find('.full-start-new__rate-line, .full-start__rate-line').first();
                var titleLine = render.find('.full-start-new__title, .full-start__title').first();
                var infoBlock = render.find('.full-start__info');
                if (rateLine.length > 0) container.insertBefore(rateLine);
                else if (titleLine.length > 0) container.insertAfter(titleLine);
                else if (infoBlock.length > 0) infoBlock.prepend(container);
            }
        }

        var marginVal = Lampa.Storage.get('omdb_rating_margin', '10px');
        var sat = Lampa.Storage.get('omdb_rating_saturation', '75%');
        container.css({ 'gap': Lampa.Storage.get('omdb_rating_gap', '0.5em'), 'margin-top': marginVal, 'margin-bottom': marginVal });
        if (sat === '0%') container.addClass('is-bw-text');
        else container.removeClass('is-bw-text');

        if (movie.vote_average > 0) addRatingBlock(container, 'rate--tmdb-custom', rateIcons.tmdb, movie.vote_average, 'tmdb');
        var cubVal = getCubRating(e);
        if (cubVal) addRatingBlock(container, 'rate--cub-custom', rateIcons.cub, cubVal, 'cub');

        var imdb_id = movie.imdb_id || (movie.external_ids ? movie.external_ids.imdb_id : '');

        var requestMDBList = function(id) {
            var key = Lampa.Storage.get('omdb_mdblist_api_key', '');
            if (!key) return;
            $.getJSON('https://mdblist.com/api/?apikey=' + key + '&i=' + id, function(data) {
                if (!data) return;
                if (data.score) addRatingBlock(container, 'rate--mdblist-score', rateIcons.mdblist, data.score, 'mdblist');
                if (data.ratings && Array.isArray(data.ratings)) {
                    data.ratings.forEach(function(r) {
                        if (r.source === 'trakt') addRatingBlock(container, 'rate--mdblist-trakt', rateIcons.trakt, r.value, 'trakt');
                        if (r.source === 'letterboxd') addRatingBlock(container, 'rate--mdblist-lb', rateIcons.letterboxd, r.value, 'letterboxd');
                        if (r.source === 'tomatoesaudience') addRatingBlock(container, 'rate--mdblist-popcorn', rateIcons.popcorn, r.value, 'popcorn');
                        if (r.source === 'metacritic' && container.find('.rate--omdb-meta').length === 0) addRatingBlock(container, 'rate--mdblist-meta', rateIcons.mc, r.value, 'mc');
                        if (r.source === 'tomatoes' && container.find('.rate--omdb-rt').length === 0) addRatingBlock(container, 'rate--mdblist-rt', rateIcons.rt, r.value, 'rt');
                        if (r.source === 'imdb' && container.find('.rate--omdb-imdb').length === 0) addRatingBlock(container, 'rate--mdblist-imdb', rateIcons.imdb, r.value, 'imdb');
                    });
                }
            });
        };

        var requestOMDB = function(id) {
            var key = Lampa.Storage.get('omdb_api_key', '');
            if (!key) return requestMDBList(id);
            $.getJSON('https://www.omdbapi.com/?apikey=' + key + '&i=' + id, function(data) {
                if (data && data.Response !== "False") {
                    if (data.Awards && data.Awards !== "N/A") {
                        var oscars = data.Awards.match(/Won (\d+) Oscar/i);
                        var wins = data.Awards.match(/(\d+) win/i);
                        if (oscars && parseInt(oscars[1]) > 0) addRatingBlock(container, 'rate--omdb-oscar', rateIcons.oscar, oscars[1], 'awards');
                        if (wins && parseInt(wins[1]) > 0) addRatingBlock(container, 'rate--omdb-awards', rateIcons.award, wins[1], 'awards');
                    }
                    if (data.Metascore && data.Metascore !== 'N/A') addRatingBlock(container, 'rate--omdb-meta', rateIcons.mc, data.Metascore, 'mc');
                    var rt = (data.Ratings ||[]).find(function(r) { return r.Source === 'Rotten Tomatoes'; });
                    if (rt) addRatingBlock(container, 'rate--omdb-rt', rateIcons.rt, rt.Value, 'rt');
                    if (data.imdbRating && data.imdbRating !== 'N/A') addRatingBlock(container, 'rate--omdb-imdb', rateIcons.imdb, data.imdbRating, 'imdb');
                }
            }).always(function() { requestMDBList(id); });
        };

        if (imdb_id) requestOMDB(imdb_id);
        else if (movie.id) {
            var type = (e.object.method === 'tv' || movie.number_of_seasons) ? 'tv' : 'movie';
            Lampa.Network.silent(Lampa.TMDB.api(type + '/' + movie.id + '/external_ids?api_key=' + Lampa.TMDB.key()), function (res) {
                if (res && res.imdb_id) requestOMDB(res.imdb_id);
            });
        }
    }

   function renderStudiosTitle(render, title, movie) {
        if (!render) return;
        $(".plugin-uk-title-combined", render).remove();
        
        var showBg = Lampa.Storage.get("studio_logo_bg", true);
        var sizeEm = Lampa.Storage.get("studio_logo_size", '0.7em');
        var gapEm = Lampa.Storage.get("studio_logo_gap", '0.2em');
        var saturation = Lampa.Storage.get("studio_logo_saturation", '1');

        var html = '';
        if (movie && movie.production_companies) {
            var companies = movie.production_companies.slice(0, 3);
            companies.forEach(function (co, index) {
                var content = co.logo_path ? '<img src="https://image.tmdb.org/t/p/h100' + co.logo_path + '" title="' + co.name + '" crossorigin="anonymous" class="studio-img-check">' : '<span class="studio-logo-text">' + co.name + '</span>';
                
                if (!showBg && index > 0) {
                    html += '<span style="color: rgba(255,255,255,0.4); margin: 0 ' + gapEm + '; font-size: 0.6em; display: inline-flex; align-items: center;">●</span>';
                }

                html += '<div class="rate--studio studio-logo ymod-studio-item" data-id="' + co.id + '" data-name="' + co.name + '" style="display: inline-flex; vertical-align: middle;">' + content + '</div>';
            });
        }
        if (!html) return;

        var bgCSS = showBg 
            ? 'background: rgba(255,255,255,0.08) !important; padding: 5px 12px !important; margin-right: ' + gapEm + ' !important;' 
            : 'background: transparent !important; border: none !important; padding: 5px 0px !important; margin-bottom: 0.2em !important;';

        var wrap = $('<div class="plugin-uk-title-combined" style="margin-top: 10px; margin-bottom: 5px; text-align: left; width: 100%; display: flex; flex-direction: column; align-items: flex-start;"><div class="studio-logos-container" style="display: flex; align-items: center; flex-wrap: wrap;">' + html + '</div></div>');
        
        var target = $(".plugin-hybrid-title", render);
        if (!target.length) target = $(".full-start-new__title", render);
        if (!target.length) target = $(".full-start__title", render);
        target.after(wrap);

        $('.rate--studio', render).css('cssText', bgCSS + ' filter: saturate(' + saturation + ');');
        $('.rate--studio img', render).css('cssText', 'height: ' + sizeEm + ' !important; filter: brightness(1) invert(0);');

        $('.studio-img-check', render).each(function() {
            var img = this;
            if (img.complete) analyzeAndInvert(img, 0.85);
            else img.onload = function() { analyzeAndInvert(img, 0.85); };
        });

        $('.rate--studio', render).on('hover:enter', function () {
            var id = $(this).data('id');
            if (id) Lampa.Activity.push({ url: 'movie', id: id, title: $(this).data('name'), component: 'company', source: 'tmdb', page: 1 });
        });

        setTimeout(function() {
            var studios = render.find('.ymod-studio-item:not(.selector)');
            if (studios.length) {
                studios.addClass('selector');
                var current = Lampa.Controller.enabled();
                if (current && (current.name === 'full_start' || current.name === 'full_descr')) {
                    current.collection = render.find('.selector');
                }
            }
        }, 1000);
    }

    function handleStudios(e) {
        var card = e.data.movie;
        var render = e.object.activity.render();
        var now = Date.now();
        var cached = studiosCache[card.id];

        if (cached && (now - cached.timestamp < 180000)) {
            renderStudiosTitle(render, cached.uk_title, cached.full_data);
        } else {
            var type = card.first_air_date ? "tv" : "movie";
            Lampa.Api.sources.tmdb.get(type + "/" + card.id + "?append_to_response=translations", {}, function (data) {
                var tr = data.translations ? data.translations.translations :[];
                var found = tr.find(function (t) { return t.iso_3166_1 === "UA" || t.iso_639_1 === "uk"; });
                var uk = found ? (found.data.title || found.data.name) : (card.title || card.name);
                studiosCache[card.id] = { uk_title: uk, full_data: data, timestamp: now };
                renderStudiosTitle(render, uk, data);
            }, function() { renderStudiosTitle(render, card.title || card.name, card); });
        }
    }

    function getResolutionLabel(width) {
        var w = parseInt(width || 0);
        if (w >= 3800) return '4K';
        if (w >= 2500) return '2K';
        if (w >= 1900) return 'FHD';
        if (w >= 1200) return 'HD';
        return 'SD';
    }

    function getBestAndPopular(results, movie) {
        if (!results || !Array.isArray(results)) return { ukr: false };
        
        // ВАЖЛИВО: Надійний, суворий вираз з межами слів, щоб уникнути російських фільмів
        var ukrPattern = /(^|[^а-яёієґїa-z])(ukr|ukrainian|українськ[а-яёієґї]*|укр|ua|укрдубляж|укрпереклад|укрмов[а-яёієґї]*)($|[^а-яёієґїa-z])/i;
        var ukrResults =[];
        var movieYear = parseInt(movie.release_date || movie.first_air_date || movie.year || 0);
        var isTv = !!(movie.name || movie.first_air_date); 

        results.forEach(function(item) {
            var title = (item.Title || '').toLowerCase();
            
            if (movieYear > 0 && !isTv) {
                var yearMatch = title.match(/\b(19|20)\d{2}\b/g);
                if (yearMatch) {
                    var correctYear = yearMatch.some(function(y) { return Math.abs(parseInt(y) - movieYear) <= 1; });
                    if (!correctYear) return;
                }
            }
            
            // Очищення сміття, доменів та хибних збігів
            var titleClean = title
                .replace(/[a-z0-9\-]+\.(ua|uk)\b/ig, '') 
                .replace(/(укр[а-яёієґї]*|ukr[a-z]*|ua|ukrainian)[\s\.\,\_\-\|]*(sub|суб)[a-zа-яёієґї]*/ig, '')
                .replace(/(sub|суб)[a-zа-яёієґї]*[\s\.\,\_\-\|]*(укр[а-яёієґї]*|ukr[a-z]*|ua|ukrainian)/ig, '');
                
            var hasUkr = ukrPattern.test(titleClean);

            if (!hasUkr && item.ffprobe && Array.isArray(item.ffprobe)) {
                hasUkr = item.ffprobe.some(function(s) {
                    if (s.codec_type !== 'audio') return false;
                    var l = (s.tags && s.tags.language ? s.tags.language : '').toLowerCase();
                    var t = (s.tags && s.tags.title ? s.tags.title : '').toLowerCase();
                    return l === 'uk' || l === 'ukr' || l === 'ua' || ukrPattern.test(t);
                });
            }

            // НОВЕ ПРАВИЛО ДЛЯ ТРЕКЕРІВ (діє, лише якщо за тегами/назвою ще не знайдено)
            if (!hasUkr) {
                var trackerName = (item.tracker || item.Tracker || item.name || '').toLowerCase();
                if (trackerName.indexOf('toloka') !== -1 || trackerName.indexOf('mazepa') !== -1) {
                    hasUkr = true;
                }
            }

            if (hasUkr) {
                var width = 0;
                if (item.ffprobe) {
                    item.ffprobe.forEach(function(s) { if (s.codec_type === 'video' && s.width) width = Math.max(width, parseInt(s.width)); });
                }
                if (width === 0) {
                    if (/2160|4k|uhd/i.test(title)) width = 3840; 
                    else if (/1080|fhd/i.test(title)) width = 1920; 
                    else if (/720|hd/i.test(title)) width = 1280; 
                    else if (/480|sd/i.test(title)) width = 720; 
                    else width = 720;
                }
                item.detectedWidth = width;
                item.seedersCount = parseInt(item.Seeders || 0);
                ukrResults.push(item);
            }
        });

        if (ukrResults.length === 0) return { ukr: false };

        var best = ukrResults.reduce(function(p, c) { 
            if (p.detectedWidth > c.detectedWidth) return p;
            if (p.detectedWidth < c.detectedWidth) return c;
            return (p.seedersCount > c.seedersCount) ? p : c;
        });
        var popular = ukrResults.reduce(function(p, c) { return (p.seedersCount > c.seedersCount) ? p : c; });
        var tech = { hdr: false, dv: false, audio: null };
        var maxChannels = 0;

        ukrResults.forEach(function(item) {
            if (item.ffprobe) {
                item.ffprobe.forEach(function(s) { if (s.codec_type === 'audio' && s.channels) maxChannels = Math.max(maxChannels, parseInt(s.channels)); });
            }
            var t = item.Title.toLowerCase();
            if (t.match(/7\.1|8ch/)) maxChannels = Math.max(maxChannels, 8);
            else if (t.match(/5\.1|6ch/)) maxChannels = Math.max(maxChannels, 6);
            else if (t.match(/2\.0/)) maxChannels = Math.max(maxChannels, 2);
        });

        if (maxChannels > 0) tech.audio = (maxChannels >= 8) ? '7.1' : (maxChannels >= 6) ? '5.1' : (maxChannels >= 4) ? '4.0' : '2.0';

        if (best.ffprobe) {
            best.ffprobe.forEach(function(s) {
                if (s.codec_type === 'video') {
                    var side = JSON.stringify(s.side_data_list ||[]);
                    if (/vision|dovi/i.test(side)) tech.dv = true;
                    if (s.color_transfer === 'smpte2084') tech.hdr = true;
                }
            });
        }
        var bTitle = best.Title.toLowerCase();
        if (!tech.dv && /vision|dovi/i.test(bTitle)) tech.dv = true;
        if (!tech.hdr && /hdr/i.test(bTitle)) tech.hdr = true;

        return { ukr: true, bestRes: getResolutionLabel(best.detectedWidth), popRes: getResolutionLabel(popular.detectedWidth), popSeeds: popular.seedersCount, tech: tech };
    }

    function renderUator(container, data) {
        container.find('.qb-unified-block').remove();
        if (!data) return;

        var size = Lampa.Storage.get('uator_rating_size', '1.1em');
        var saturation = Lampa.Storage.get('uator_saturation', '100%');
        var block = $('<div class="qb-unified-block" style="font-size: '+size+'"></div>');
        
        if (!data.ukr) {
            var iconHtml = (saturation === '0%') ? '<span class="qb-text-icon">UA</span>' : '<img src="'+uatorIcons.none+'" class="qb-prefix-icon" style="filter: saturate('+saturation+')">';
            block.append('<div class="quality-badge qb-not-found">' + iconHtml + '<span class="qb-text">немає</span></div>');
        } else {
            var items =[ {i: uatorIcons.ua, t: data.bestRes, type: 'ua'}, {i: uatorIcons.top, t: data.popRes}, {i: uatorIcons.seeds, t: data.popSeeds} ];
            if (data.tech.audio) items.push({i: uatorIcons.audio, t: data.tech.audio});
            if (data.tech.dv) items.push({i: uatorIcons.dv, t: '', type: 'dv'});
            if (data.tech.hdr) items.push({i: uatorIcons.hdr, t: '', type: 'hdr'});
            
            items.forEach(function(it) {
                var iconHtml = '';
                if (it.i) {
                    var style = 'filter: saturate('+saturation+');';
                    if (it.type === 'ua' && saturation === '0%') iconHtml = '<span class="qb-text-icon">UA</span>';
                    else {
                        if (it.type === 'dv') style = 'filter: brightness(0) invert(1);';
                        else if (it.type === 'hdr') style = 'filter: grayscale(1);';
                        iconHtml = '<img src="'+it.i+'" class="qb-prefix-icon" style="'+style+'">';
                    }
                }
                var textHtml = it.t ? '<span class="qb-text">' + it.t + '</span>' : '';
                block.append('<div class="quality-badge">' + iconHtml + textHtml + '</div>');
            });
        }
        container.append(block);
    }

    function processUatorCards() {
        if (!isEnabled('uator')) return;
        $('.card:not(.qb-processed)').each(function() {
            var card = $(this);
            var movie = card.data('item');
            if (movie && movie.id) {
                card.addClass('qb-processed');
                var key = movie.id + '_' + (movie.title || movie.name);
                if (uatorCache[key] && uatorCache[key].ukr) {
                    renderUator(card.find('.card__view'), uatorCache[key]);
                } else {
                    var localSearch = movie.title || movie.name;
                    var origSearch = movie.original_title || movie.original_name;
                    
                    // ПОДВІЙНИЙ ПОШУК
                    Lampa.Parser.get({ search: localSearch, movie: movie, page: 1 }, function(res) {
                        var data = (res && res.Results) ? getBestAndPopular(res.Results, movie) : { ukr: false };
                        if (data.ukr) { 
                            uatorCache[key] = data; 
                            renderUator(card.find('.card__view'), data); 
                        } else if (origSearch && origSearch !== localSearch) {
                            Lampa.Parser.get({ search: origSearch, movie: movie, page: 1 }, function(res2) {
                                var data2 = (res2 && res2.Results) ? getBestAndPopular(res2.Results, movie) : { ukr: false };
                                uatorCache[key] = data2;
                                if (data2.ukr) renderUator(card.find('.card__view'), data2);
                            }, function() { uatorCache[key] = data; });
                        } else {
                            uatorCache[key] = data;
                        }
                    }, function() { uatorCache[key] = { ukr: false }; });
                }
            }
        });
    }
    setInterval(processUatorCards, 2000);

    function handleUatorFull(e) {
        var renderTarget = e.object.activity.render();
        var isPortrait = window.innerHeight > window.innerWidth;
        var cont = $('.quality-badges-container', renderTarget);
        if (!cont.length) { 
            cont = $('<div class="quality-badges-container"></div>'); 
            if (isPortrait) {
                var title = $('.full-start-new__title, .full-start__title', renderTarget);
                title.after(cont);
            } else {
                var rateLine = $('.full-start-new__rate-line, .full-start__rate-line', renderTarget);
                if (rateLine.length) rateLine.append(cont);
                else $('.full-start__info', renderTarget).append(cont);
            }
        }
        
        var movie = e.data.movie;
        var localSearch = movie.title || movie.name;
        var origSearch = movie.original_title || movie.original_name;
        
        // ПОДВІЙНИЙ ПОШУК
        Lampa.Parser.get({ search: localSearch, movie: movie, page: 1 }, function(res) {
            var data = (res && res.Results) ? getBestAndPopular(res.Results, movie) : { ukr: false };
            if (data.ukr) { 
                renderUator(cont, data); 
            } else if (origSearch && origSearch !== localSearch) {
                Lampa.Parser.get({ search: origSearch, movie: movie, page: 1 }, function(res2) {
                    var data2 = (res2 && res2.Results) ? getBestAndPopular(res2.Results, movie) : { ukr: false };
                    renderUator(cont, data2);
                }, function() { renderUator(cont, data); });
            } else {
                renderUator(cont, data);
            }
        }, function() { renderUator(cont, { ukr: false }); });
    }

    Lampa.Listener.follow('full', function(e) {
        if (e.type === 'complite' || e.type === 'ready') {
            if (isEnabled('slogan')) ymodCleanSlogan();
        }
        if (e.type === 'complite' || e.type === 'complete') {
            if (isEnabled('logo')) handleLogo(e);
            if (isEnabled('hybrid')) handleHybridTitle(e);
            if (isEnabled('studios')) handleStudios(e);
            if (isEnabled('ratings')) {
                setTimeout(function() { handleRatings(e); }, 100);
                setTimeout(function() { handleRatings(e); }, 1000);
            }
            if (isEnabled('uator')) handleUatorFull(e);
        }
    });

    function createSettings() {
        var MAIN_C = 'yariks_mod_main';
        Lampa.SettingsApi.addComponent({ component: MAIN_C, name: "Yarik's Mod", icon: yIcon });
        Lampa.SettingsApi.addComponent({ component: 'ym_logo', name: 'Лого (Smart)' });
        Lampa.SettingsApi.addComponent({ component: 'ym_title', name: 'Додаткова назва' });
        Lampa.SettingsApi.addComponent({ component: 'ym_ratings', name: 'OMDB & MDBList' });
        Lampa.SettingsApi.addComponent({ component: 'ym_ratings_select', name: 'Вибір рейтингів' });
        Lampa.SettingsApi.addComponent({ component: 'ym_studios', name: 'Лого студій' });
        Lampa.SettingsApi.addComponent({ component: 'ym_uator', name: 'Uator' });

        function addStatic(comp, name, title, desc, onClick) {
            Lampa.SettingsApi.addParam({ component: comp, param: { name: name, type: "static" }, field: { name: title, description: desc }, onRender: function (item) { item.on("hover:enter", onClick); } });
        }
        function addToggle(comp, modName, title, desc) {
            Lampa.SettingsApi.addParam({ component: comp, param: { name: YMOD + 'enable_' + modName, type: "trigger", default: true }, field: { name: title, description: desc }, onChange: function(val) { Lampa.Storage.set(YMOD + 'enable_' + modName, val); updateBodyClasses(); } });
        }
        function addSelect(comp, name, title, desc, values, def) {
            Lampa.SettingsApi.addParam({ component: comp, param: { name: name, type: "select", values: values, default: def }, field: { name: title, description: desc } });
        }
        function backTo(comp, target) {
            addStatic(comp, comp+'_back', "Назад", "Повернутися", function() { Lampa.Settings.create(target); });
        }
        function clearCacheBtn(comp, title, prefix) {
            addStatic(comp, comp+'_clear', title, "Очистити кеш плагіну", function() {
                for (var i = 0; i < localStorage.length; i++) {
                    var key = localStorage.key(i);
                    if (key && key.indexOf(prefix) !== -1) { localStorage.removeItem(key); i--; }
                }
                Lampa.Noty.show("Кеш очищено. Перезавантаження...");
                setTimeout(function() { window.location.reload(); }, 1000);
            });
        }

        addStatic(MAIN_C, "ym_info_link", "Інформація + Подякувати", "http://lampalampa.free.nf", function() { window.open('http://lampalampa.free.nf', '_blank'); });
        addToggle(MAIN_C, 'slogan', "Приховування слогану", "Прибрати короткі слогани під назвою");
        
        addStatic(MAIN_C, "ym_logo_entry", "Лого (Smart)", "Налаштування заміни тексту на лого", function() { Lampa.Settings.create('ym_logo'); });
        backTo('ym_logo', MAIN_C);
        addToggle('ym_logo', 'logo', "Увімкнути плагін", "Відображати графічні логотипи");
        addSelect('ym_logo', "logo_glav", "Режим заміни", "", { 1: "Показати назву", 0: "Показати лого" }, "0");
        addSelect('ym_logo', "logo_lang", "Мова логотипа", "Пріоритет мови", { "": "Як у Lampa", en: "English", uk: "Українська" }, "uk");
        addSelect('ym_logo', "logo_size", "Якість (Розмір)", "", { w300: "w300", w500: "w500", w780: "w780", original: "Оригінал" }, "original");
        addSelect('ym_logo', "logo_saturation", "Насиченість", "", { "1": "100%", "0.75": "75%", "0.5": "50%", "0.25": "25%", "0": "0% (Ч/Б)" }, "1");
        Lampa.SettingsApi.addParam({ component: 'ym_logo', param: { name: "logo_use_text_height", type: "trigger", default: false }, field: { name: "Лого по висоті тексту", description: "Масштабувати під розмір шрифту" } });
        clearCacheBtn('ym_logo', "Очистити кеш логотипів", "logo_cache_v2_");

        addStatic(MAIN_C, "ym_title_entry", "Додаткова назва", "Оригінальна назва, рік, країна", function() { Lampa.Settings.create('ym_title'); });
        backTo('ym_title', MAIN_C);
        addToggle('ym_title', 'hybrid', "Увімкнути плагін", "Відображати додаткову інформацію");
        addSelect('ym_title', "hybrid_title_mode", "Режим", "", { 'smart': 'Залежно від лого', 'always_ua': 'Завжди українська' }, 'smart');
        addSelect('ym_title', "hybrid_title_size", "Розмір", "", { 'xs': 'Дуже мала', 's': 'Мала', 'm': 'Нормальна (стандарт)', 'l': 'Велика', 'xl': 'Дуже велика', 'xxl': 'Максимальна', 'giant': 'Гігантська' }, 'xs');
        clearCacheBtn('ym_title', "Очистити кеш назв", "title_cache_hybrid_v3");

        addStatic(MAIN_C, "ym_ratings_entry", "Рейтинги (OMDB/MDBList)", "Налаштування додаткових оцінок", function() { Lampa.Settings.create('ym_ratings'); });
        backTo('ym_ratings', MAIN_C);
        addToggle('ym_ratings', 'ratings', "Увімкнути плагін", "Відображати зовнішні рейтинги");
        
        Lampa.SettingsApi.addParam({ component: 'ym_ratings', param: { name: "omdb_api_key_set", type: "static" }, field: { name: "OMDB API Key", description: "Встановити ключ" }, onRender: function (item) {
            var valEl = $('<div class="omdb-api-val">' + (Lampa.Storage.get('omdb_api_key', '') || 'Не встановлено') + '</div>');
            item.find('.settings-param__descr').after(valEl);
            item.on('hover:enter', function() {
                Lampa.Input.edit({ title: 'OMDB API Key', value: Lampa.Storage.get('omdb_api_key', ''), free: true, nosave: true }, function(newValue) { Lampa.Storage.set('omdb_api_key', newValue); valEl.text(newValue || 'Не встановлено'); });
            });
        }});
        Lampa.SettingsApi.addParam({ component: 'ym_ratings', param: { name: "mdblist_api_key_set", type: "static" }, field: { name: "MDBList API Key", description: "Встановити ключ" }, onRender: function (item) {
            var valEl = $('<div class="omdb-api-val">' + (Lampa.Storage.get('omdb_mdblist_api_key', '') || 'Не встановлено') + '</div>');
            item.find('.settings-param__descr').after(valEl);
            item.on('hover:enter', function() {
                Lampa.Input.edit({ title: 'MDBList API Key', value: Lampa.Storage.get('omdb_mdblist_api_key', ''), free: true, nosave: true }, function(newValue) { Lampa.Storage.set('omdb_mdblist_api_key', newValue); valEl.text(newValue || 'Не встановлено'); });
            });
        }});
        addSelect('ym_ratings', 'omdb_rating_size', 'Розмір рейтингів', '', { '0.5em': 'XS', '0.8em': 'S', '1.1em': 'M (Стандарт)', '1.5em': 'L', '2.0em': 'XL' }, '1.1em');
        addSelect('ym_ratings', 'omdb_rating_gap', 'Відстань між рейтингами', '', { '0px': '0', '0.2em': '0.2em', '0.5em': '0.5em (Стандарт)', '1em': '1em', '1.5em': '1.5em', '2em': '2em' }, '0.5em');
        addSelect('ym_ratings', 'omdb_rating_margin', 'Відступ до інших рядків', '', { '-1em': '-1em', '-0.5em': '-0.5em', '0px': '0', '10px': '10px (Стандарт)', '0.5em': '0.5em', '1em': '1em', '1.5em': '1.5em', '2em': '2em' }, '10px');
        addSelect('ym_ratings', 'omdb_rating_saturation', 'Насиченість', '', { '100%': '100% (Стандарт)', '75%': '75%', '50%': '50%', '25%': '25%', '0%': '0% (Ч/Б)' }, '75%');
        addStatic('ym_ratings', "omdb_select_ratings", "Вибір рейтингів", "Вкл/Викл джерел", function() { Lampa.Settings.create('ym_ratings_select'); });
        
        backTo('ym_ratings_select', 'ym_ratings');
        availableRatings.forEach(function(rating) {
            Lampa.SettingsApi.addParam({ component: 'ym_ratings_select', param: { name: 'omdb_rating_toggle_' + rating.key, type: 'trigger', default: rating.default }, field: { name: rating.name } });
        });

        addStatic(MAIN_C, "ym_studios_entry", "Лого студій", "Відображення виробничих компаній", function() { Lampa.Settings.create('ym_studios'); });
        backTo('ym_studios', MAIN_C);
        addToggle('ym_studios', 'studios', "Увімкнути плагін", "Відображати логотипи студій");
        Lampa.SettingsApi.addParam({ component: 'ym_studios', param: { name: "studio_logo_bg", type: "trigger", default: true }, field: { name: "Підложка", description: "Напівпрозорий фон за логотипом" } });
        addSelect('ym_studios', "studio_logo_size", "Розмір лого", "", { '0.5em':'0.5em', '0.6em':'0.6em', '0.7em':'0.7em (Стандарт)', '0.8em':'0.8em', '0.9em':'0.9em', '1.0em':'1.0em', '1.1em':'1.1em', '1.3em':'1.3em', '1.5em':'1.5em', '2.0em':'2.0em', '2.5em':'2.5em' }, '0.7em');
        addSelect('ym_studios', "studio_logo_gap", "Відступ між лого", "", { '0px':'0', '0.2em':'0.2em', '0.5em':'0.5em', '1.0em':'1.0em', '1.2em':'1.2em', '1.5em':'1.5em', '2.0em':'2.0em' }, '0.2em');
        addSelect('ym_studios', "studio_logo_saturation", "Насиченість", "", { '1': '100%', '0.75': '75%', '0.5': '50%', '0.25': '25%', '0': '0% (Ч/Б)' }, '1');

        addStatic(MAIN_C, "ym_uator_entry", "Uator", "Налаштування маркерів UA контенту", function() { Lampa.Settings.create('ym_uator'); });
        backTo('ym_uator', MAIN_C);
        addToggle('ym_uator', 'uator', "Увімкнути плагін", "Відображати значки торрентів");
        addSelect('ym_uator', 'uator_saturation', 'Насиченість', '', { '100%': '100% (Стандарт)', '75%': '75%', '50%': '50%', '25%': '25%', '0%': '0% (Ч/Б)' }, '100%');
        addSelect('ym_uator', 'uator_rating_size', 'Розмір значків', '', { '0.5em': 'XS', '0.8em': 'S', '1.1em': 'M (Стандарт)', '1.5em': 'L', '2.0em': 'XL' }, '1.1em');
    }

    if (window.appready) createSettings();
    else Lampa.Listener.follow("app", function (e) { if (e.type === "ready") createSettings(); });

})();