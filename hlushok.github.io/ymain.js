(function () {
    'use strict';

    if (typeof Lampa === 'undefined') return;

    // Базова конфігурація мережі, кешування та доступу до TMDB.
    var CONFIG = { 
        tmdbApiKey: '', 
        cacheTime: 23 * 60 * 60 * 1000, 
        language: 'uk',
        endpoint: 'https://wh.lme.isroot.in/',
        timeout: 10000,
        queue: { maxParallel: 10 }, 
        cache: {
            key: 'lme_wh_cache_v5', 
            size: 3000,
            positiveTtl: 1000 * 60 * 60 * 24,
            negativeTtl: 1000 * 60 * 60 * 6
        }
    };

    const PROXIES =[
        'https://cors.lampa.stream/',
        'https://cors.eu.org/',
        'https://corsproxy.io/?url='
    ];

    const DEFAULT_ROWS_SETTINGS =[
        { id: 'ym_row_history', title: 'Історія перегляду', defOrder: '1', default: true },
        { id: 'ym_row_movies_new', title: 'Новинки фільмів', defOrder: '2', default: true },
        { id: 'ym_row_series_new', title: 'Новинки серіалів', defOrder: '3', default: true },
        { id: 'ym_row_collections', title: 'Підбірки KinoBaza', defOrder: '4', default: true },
        { id: 'ym_row_kinobaza', title: 'Новинки Стрімінгів UA', defOrder: '5', default: true },
        { id: 'ym_row_community', title: 'Знахідки спільноти LME', defOrder: '6', default: true },
        { id: 'ym_row_movies_watch', title: 'Популярні фільми', defOrder: '7', default: true },
        { id: 'ym_row_series_pop', title: 'Популярні серіали', defOrder: '8', default: true },
        { id: 'ym_row_random', title: 'Випадкова підбірка', defOrder: '9', default: true }
    ];

    // Стан запитів і проміжні кеші в межах поточної сесії застосунку.
    var inflight = {};
    var lmeCache = null;
    var listCache = {};      
    var tmdbItemCache = {};  
    var itemUrlCache = {};   
    var seasonsCache = {};

    Lampa.Lang.add({
        main: 'Головна UA',
        title_main: 'Головна UA',
        title_tmdb: 'Головна UA'
    });

    var safeStorage = (function () {
        var memoryStore = {};
        try {
            if (typeof window.localStorage !== 'undefined') {
                var testKey = '__season_test_v5__';
                window.localStorage.setItem(testKey, '1');
                window.localStorage.removeItem(testKey);
                return window.localStorage;
            }
        } catch (e) {}
        return {
            getItem: function (k) { return memoryStore.hasOwnProperty(k) ? memoryStore[k] : null; },
            setItem: function (k, v) { memoryStore[k] = String(v); },
            removeItem: function (k) { delete memoryStore[k]; }
        };
    })();

    try { seasonsCache = JSON.parse(safeStorage.getItem('seasonBadgeCacheV5') || '{}'); } catch (e) {}

    function debounce(func, wait) {
        var timer;
        return function () {
            var context = this, args = arguments;
            clearTimeout(timer);
            timer = setTimeout(function () { func.apply(context, args); }, wait);
        };
    }

    function escapeHtml(value) {
        return String(value == null ? '' : value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function asBool(value, fallback) {
        if (value === null || value === undefined || value === '') return !!fallback;
        if (value === true || value === 'true' || value === 1 || value === '1') return true;
        if (value === false || value === 'false' || value === 0 || value === '0') return false;
        return !!value;
    }

    function getContrastMode() {
        var mode = Lampa.Storage.get('ym_contrast_mode', 'standard');
        return mode === 'high' ? 'high' : 'standard';
    }

    function getSeasonBadgeStyle() {
        var style = Lampa.Storage.get('ym_season_badge_style', 'default');
        return (style === 'soft' || style === 'contrast') ? style : 'default';
    }

    function isLiteMode() {
        return asBool(Lampa.Storage.get('ym_lite_mode', false), false);
    }

    // Застосовує візуальні та продуктивні параметри через CSS-класи на body.
    function applyUiPreferences() {
        if (!document || !document.body) return;
        var mode = getContrastMode();
        var lite = isLiteMode();
        var safeArea = asBool(Lampa.Storage.get('ym_safe_area', true), true);
        var seasonStyle = getSeasonBadgeStyle();

        document.body.classList.toggle('ym-contrast-high', mode === 'high');
        document.body.classList.toggle('ym-lite-mode', lite);
        document.body.classList.toggle('ym-safe-area-off', !safeArea);
        document.body.classList.remove('ym-season-style-default', 'ym-season-style-soft', 'ym-season-style-contrast');
        document.body.classList.add('ym-season-style-' + seasonStyle);
    }

    // Ініціалізує відсутні ключі налаштувань для стабільної та передбачуваної роботи.
    function ensureUiDefaults() {
        var contrast = Lampa.Storage.get('ym_contrast_mode');
        if (contrast === null || contrast === undefined || contrast === '') Lampa.Storage.set('ym_contrast_mode', 'standard');

        var lite = Lampa.Storage.get('ym_lite_mode');
        if (lite === null || lite === undefined || lite === '') Lampa.Storage.set('ym_lite_mode', false);

        var safeArea = Lampa.Storage.get('ym_safe_area');
        if (safeArea === null || safeArea === undefined || safeArea === '') Lampa.Storage.set('ym_safe_area', true);

        var showSeason = Lampa.Storage.get('ym_show_season_badge');
        if (showSeason === null || showSeason === undefined || showSeason === '') Lampa.Storage.set('ym_show_season_badge', false);

        var seasonStyle = Lampa.Storage.get('ym_season_badge_style');
        if (seasonStyle === null || seasonStyle === undefined || seasonStyle === '') Lampa.Storage.set('ym_season_badge_style', 'default');
    }

    // Булевий кеш із різним TTL для позитивних і негативних результатів.
    function Cache(config) {
        var self = this;
        var storage = {};
        function cleanupExpired() {
            var now = Date.now(), changed = false, keys = Object.keys(storage);
            for (var i = 0; i < keys.length; i++) {
                var key = keys[i], node = storage[key];
                if (!node || !node.timestamp || typeof node.value !== 'boolean') { delete storage[key]; changed = true; continue; }
                var ttl = node.value ? config.positiveTtl : config.negativeTtl;
                if (node.timestamp <= now - ttl) { delete storage[key]; changed = true; }
            }
            if (changed) self.save();
        }
        self.save = debounce(function () { Lampa.Storage.set(config.key, storage); }, 400);
        self.init = function () { storage = Lampa.Storage.get(config.key, {}) || {}; cleanupExpired(); };
        self.get = function (id) {
            var node = storage[id];
            if (!node || !node.timestamp || typeof node.value !== 'boolean') return null;
            var ttl = node.value ? config.positiveTtl : config.negativeTtl;
            if (node.timestamp > Date.now() - ttl) return node.value;
            delete storage[id]; self.save(); return null;
        };
        self.set = function (id, value) {
            cleanupExpired();
            storage[id] = { timestamp: Date.now(), value: !!value };
            self.save();
        };
    }

    // Легка черга для обмеження кількості паралельних мережевих задач.
    var requestQueue = {
        activeCount: 0, queue:[], maxParallel: CONFIG.queue.maxParallel,
        add: function (task) { this.queue.push(task); this.process(); },
        process: function () {
            var _this = this;
            while (this.activeCount < this.maxParallel && this.queue.length) {
                var task = this.queue.shift(); this.activeCount++;
                Promise.resolve().then(task)["catch"](function () {})["finally"](function () { _this.activeCount--; _this.process(); });
            }
        }
    };

    // Завантажує HTML через CORS-проксі з послідовним резервним сценарієм.
    async function fetchHtml(url) {
        for (let proxy of PROXIES) {
            try {
                let proxyUrl = proxy.includes('?url=') ? proxy + encodeURIComponent(url) : proxy + url;
                let res = await fetch(proxyUrl);
                if (res.ok) {
                    let text = await res.text();
                    if (text && text.length > 500 && text.includes('<html') && !text.includes('just a moment...')) {
                        return text;
                    }
                }
            } catch (e) {}
        }
        return '';
    }

    function getTmdbKey() {
        let custom = (Lampa.Storage.get('uas_pro_tmdb_apikey') || '').trim();
        return custom || CONFIG.tmdbApiKey || (Lampa.TMDB && Lampa.TMDB.key ? Lampa.TMDB.key() : '4ef0d7355d9ffb5151e987764708ce96');
    }

    function getTmdbEndpoint(path) {
        let url = Lampa.TMDB.api(path);
        if (!url.includes('api_key')) url += (url.includes('?') ? '&' : '?') + 'api_key=' + getTmdbKey();
        if (!url.startsWith('http')) url = 'https://api.themoviedb.org/3/' + url;
        return url;
    }

    function safeFetch(url) {
        return new Promise(function (resolve, reject) {
            var xhr = new XMLHttpRequest(); xhr.open('GET', url, true);
            xhr.onreadystatechange = function () {
                if (xhr.readyState === 4) {
                    if (xhr.status >= 200 && xhr.status < 300) resolve({ ok: true, json: function() { return Promise.resolve(JSON.parse(xhr.responseText)); } });
                    else reject(new Error('HTTP ' + xhr.status));
                }
            };
            xhr.onerror = function () { reject(new Error('Network error')); }; xhr.send(null);
        });
    }

    async function fetchTmdbWithFallback(type, id) {
        let endpoint = getTmdbEndpoint(`${type}/${id}?language=uk`);
        let res = await fetch(PROXIES[0] + endpoint).then(r=>r.json()).catch(()=>null);
        if (res && (!res.overview || res.overview.trim() === '')) {
            let enEndpoint = getTmdbEndpoint(`${type}/${id}?language=en`);
            let enRes = await fetch(PROXIES[0] + enEndpoint).then(r=>r.json()).catch(()=>null);
            if (enRes && enRes.overview) res.overview = enRes.overview;
        }
        return res;
    }

    function createMediaMeta(data) {
        var tmdbId = parseInt(data && data.id, 10);
        if (!Number.isFinite(tmdbId) || tmdbId <= 0) return null;
        var mediaKind = String(data.media_type || '').toLowerCase();
        if (mediaKind !== 'tv' && mediaKind !== 'movie') {
            if (data.original_name || data.first_air_date || data.number_of_seasons) mediaKind = 'tv';
            else if (data.title || data.original_title || data.release_date) mediaKind = 'movie';
            else return null;
        }
        return { tmdbId: tmdbId, mediaKind: mediaKind, serial: mediaKind === 'tv' ? 1 : 0, cacheKey: mediaKind + ':' + tmdbId };
    }

    function isSuccessResponse(response) {
        if (response === true) return true;
        if (response && typeof response === 'object' && !Array.isArray(response)) {
            if (response.error || response.status === 'error' || response.success === false || response.ok === false) return false;
            if (response.success === true || response.status === 'success' || response.ok === true) return true;
            return Object.keys(response).length > 0;
        }
        return false;
    }

    function loadFlag(meta) {
        if (!inflight[meta.cacheKey]) {
            inflight[meta.cacheKey] = new Promise(function (resolve) {
                requestQueue.add(function () {
                    var url = CONFIG.endpoint + '?tmdb_id=' + encodeURIComponent(meta.tmdbId) + '&serial=' + meta.serial + '&silent=true';
                    return new Promise(function (res) { Lampa.Network.silent(url, function (r) { res(isSuccessResponse(r)); }, function () { res(false); }, null, { timeout: CONFIG.timeout }); })
                    .then(function (isSuccess) { lmeCache.set(meta.cacheKey, isSuccess); resolve(isSuccess); })
                    .finally(function () { delete inflight[meta.cacheKey]; });
                });
            });
        }
        return inflight[meta.cacheKey];
    }

    function renderFlag(cardHtml) {
        var view = cardHtml.querySelector('.card__view');
        if (!view || view.querySelector('.card__ua_flag')) return;
        var badge = document.createElement('div');
        badge.className = 'card__ua_flag';
        view.appendChild(badge);
    }

    // Завантажує TV-дані з TMDB з персистентним кешем для бейджа сезонів.
    function fetchSeriesData(tmdbId) {
        return new Promise(function (resolve, reject) {
            var now = (new Date()).getTime();
            if (seasonsCache[tmdbId] && (now - seasonsCache[tmdbId].timestamp < CONFIG.cacheTime)) return resolve(seasonsCache[tmdbId].data);
            
            if (window.Lampa && Lampa.TMDB && typeof Lampa.TMDB.tv === 'function') {
                Lampa.TMDB.tv(tmdbId, function (data) {
                    seasonsCache[tmdbId] = { data: data, timestamp: now };
                    try { safeStorage.setItem('seasonBadgeCacheV5', JSON.stringify(seasonsCache)); } catch (e) {}
                    resolve(data);
                }, reject, { language: CONFIG.language });
            } else {
                var url = 'https://api.themoviedb.org/3/tv/' + tmdbId + '?api_key=' + getTmdbKey() + '&language=' + CONFIG.language;
                safeFetch(url).then(function (r) { return r.json(); }).then(function(data) {
                    seasonsCache[tmdbId] = { data: data, timestamp: now };
                    try { safeStorage.setItem('seasonBadgeCacheV5', JSON.stringify(seasonsCache)); } catch (e) {}
                    resolve(data);
                }).catch(reject);
            }
        });
    }

    // Очищає плагінні та застарілі бейджі сезонів перед новим рендером.
    function clearSeasonBadges(cardHtml) {
        var oldBadges = cardHtml.querySelectorAll('.card__type--season-ym, .card__type--season');
        for (var i = 0; i < oldBadges.length; i++) {
            var badge = oldBadges[i];
            var text = (badge.textContent || '').trim();
            // Видаляємо службові бейджі плагіна і застарілі варіанти формату "Sx".
            if (badge.classList.contains('card__type--season-ym') || /^S\d+/i.test(text)) {
                badge.remove();
            }
        }
    }

    // Очищає бейджі сезонів у вже відрендерених картках (коли опцію вимкнено).
    function clearAllVisibleSeasonBadges() {
        if (!document) return;
        var cards = document.querySelectorAll('.card');
        for (var i = 0; i < cards.length; i++) clearSeasonBadges(cards[i]);
    }

    function formatSeasonCountText(seasonNumber) {
        var n10 = seasonNumber % 10;
        var n100 = seasonNumber % 100;
        if (n10 === 1 && n100 !== 11) return seasonNumber + ' сезон';
        if (n10 >= 2 && n10 <= 4 && (n100 < 12 || n100 > 14)) return seasonNumber + ' сезони';
        return seasonNumber + ' сезонів';
    }

    // Рендерить окремий бейдж сезону/прогресу серій для TV-карток.
    function renderSeasonBadge(cardHtml, tmdbData) {
        var view = cardHtml.querySelector('.card__view');
        if (!view) return;

        // UI перевикористовує DOM-картки, тому спочатку очищаємо старі бейджі.
        clearSeasonBadges(cardHtml);

        if (!tmdbData || !tmdbData.last_episode_to_air || !Array.isArray(tmdbData.seasons)) return;
        var last = tmdbData.last_episode_to_air;
        var currentSeason = tmdbData.seasons.find(function (s) { return s.season_number === last.season_number; });
        if (!currentSeason || last.season_number <= 0) return;

        var isComplete = currentSeason.episode_count > 0 && last.episode_number >= currentSeason.episode_count;
        var text = isComplete
            ? formatSeasonCountText(last.season_number)
            : (last.season_number + ' сезон • ' + last.episode_number + '/' + currentSeason.episode_count);

        var badge = document.createElement('div');
        badge.className = 'card__type card__type--season card__type--season-ym ' + (isComplete ? 'is-complete' : 'is-airing');
        badge.setAttribute('data-ym-season', '1');
        badge.textContent = text;
        view.appendChild(badge);
    }

    function getColor(rating, alpha) {
        var rgb = '';
        if (rating >= 0 && rating <= 3) rgb = '231, 76, 60';
        else if (rating > 3 && rating <= 5) rgb = '230, 126, 34';
        else if (rating > 5 && rating <= 6.5) rgb = '241, 196, 15';
        else if (rating > 6.5 && rating < 8) rgb = '52, 152, 219';
        else if (rating >= 8 && rating <= 10) rgb = '46, 204, 113';
        return rgb ? 'rgba(' + rgb + ', ' + alpha + ')' : null;
    }

    function extractItemLinks(html) {
        let doc = new DOMParser().parseFromString(html, "text/html");
        let links =[];
        doc.querySelectorAll('a[href]').forEach(a => {
            let href = a.getAttribute('href');
            if (href && href.match(/\/\d+-[^/]+\.html$/) && !href.includes('#')) {
                let fullUrl = href.startsWith('http') ? href : 'https://uaserials.com' + href;
                if (!links.includes(fullUrl)) links.push(fullUrl);
            }
        });
        return links;
    }

    function extractKinobazaItems(html) {
        let doc = new DOMParser().parseFromString(html, "text/html");
        let results =[];
        let seen = {};

        doc.querySelectorAll('h4.text-muted.h6.d-inline-block').forEach(h4 => {
            let enTitle = h4.textContent.trim();
            let parent = h4.parentElement;
            let small = null;
            for (let i = 0; i < 5; i++) {
                if (!parent || parent.tagName === 'BODY') break;
                small = parent.querySelector('small.text-muted');
                if (small && small.textContent.match(/\(\d{4}\)/)) break;
                small = null;
                parent = parent.parentElement;
            }
            let yearMatch = small ? small.textContent.match(/\((\d{4})\)/) : null;
            let year = yearMatch ? yearMatch[1] : null;
            
            let key = enTitle + year;
            if (enTitle && year && !seen[key]) {
                seen[key] = true;
                results.push({ title: enTitle, year: year });
            }
        });

        if (results.length === 0) {
            doc.querySelectorAll('a[href^="/titles/"]').forEach(a => {
                let title = a.textContent.trim();
                if (title.length > 1) {
                    let year = null;
                    let parent = a.parentElement;
                    for (let i = 0; i < 4; i++) {
                        if (!parent || parent.tagName === 'BODY') break;
                        let text = parent.textContent;
                        let yearMatch = text.match(/(?:^|\s|\()((?:19|20)\d{2})(?:\)|\s|$)/);
                        if (yearMatch) {
                            year = yearMatch[1];
                            break;
                        }
                        parent = parent.parentElement;
                    }
                    
                    if (!year) {
                        let hrefMatch = a.getAttribute('href').match(/(?:19|20)\d{2}/);
                        if (hrefMatch) year = hrefMatch[0];
                    }

                    if (year) {
                        let key = title + year;
                        if (!seen[key]) {
                            seen[key] = true;
                            results.push({ title: title, year: year });
                        }
                    }
                }
            });
        }

        return results;
    }

    function extractKinobazaCollections(html) {
        let doc = new DOMParser().parseFromString(html, "text/html");
        let results =[];
        let seen = {};
        
        doc.querySelectorAll('a[href^="/lists/"]').forEach(a => {
            let href = a.getAttribute('href');
            if (href.match(/^\/lists\/[a-zA-Z0-9_-]+$/) && !href.includes('edit')) {
                let fullUrl = 'https://kinobaza.com.ua' + href;
                let title = a.textContent.trim();
                if (title.length > 2 && !seen[fullUrl]) {
                    seen[fullUrl] = true;
                    results.push({
                        title: title,
                        url: fullUrl
                    });
                }
            }
        });
        return results;
    }

    async function getImdbId(url) {
        if (itemUrlCache[url]) return itemUrlCache[url];
        let html = await fetchHtml(url);
        let match = html.match(/imdb\.com\/title\/(tt\d+)/i);
        let id = match ? match[1] : null;
        if (id) itemUrlCache[url] = id;
        return id;
    }

    async function processInQueue(items, processFn, concurrency = 5) {
        let results =[];
        let index = 0;
        async function worker() {
            while (index < items.length) {
                let currentIndex = index++;
                try {
                    let res = await processFn(items[currentIndex]);
                    if (res) results.push(res);
                } catch (e) {}
            }
        }
        let workers =[];
        for (let i = 0; i < concurrency; i++) workers.push(worker());
        await Promise.all(workers);
        return results;
    }

    async function processSingleItem(url) {
        let imdb = await getImdbId(url);
        if (!imdb) return null;
        if (tmdbItemCache[imdb]) return tmdbItemCache[imdb];

        let endpoint = getTmdbEndpoint(`find/${imdb}?external_source=imdb_id&language=uk`);
        try {
            let data = await fetch(PROXIES[0] + endpoint).then(r => r.json());
            let res = null;
            if (data.movie_results && data.movie_results.length > 0) { res = data.movie_results[0]; res.media_type = 'movie'; }
            else if (data.tv_results && data.tv_results.length > 0) { res = data.tv_results[0]; res.media_type = 'tv'; }
            
            if (res && (!res.overview || res.overview.trim() === '')) {
                let enEndpoint = getTmdbEndpoint(`find/${imdb}?external_source=imdb_id&language=en`);
                let enData = await fetch(PROXIES[0] + enEndpoint).then(r => r.json());
                let enRes = (enData.movie_results && enData.movie_results.length > 0) ? enData.movie_results[0] : (enData.tv_results && enData.tv_results.length > 0) ? enData.tv_results[0] : null;
                if (enRes && enRes.overview) res.overview = enRes.overview;
            }

            if (res) tmdbItemCache[imdb] = res;
            return res;
        } catch(e) { return null; }
    }

    async function searchTmdbByTitleAndYear(title, year) {
        let cacheKey = 'kinobaza_search_' + title + '_' + year;
        if (tmdbItemCache[cacheKey]) return tmdbItemCache[cacheKey];

        let endpoint = getTmdbEndpoint(`search/multi?query=${encodeURIComponent(title)}&language=uk`);
        try {
            let data = await fetch(PROXIES[0] + endpoint).then(r => r.json());
            if (data && data.results && data.results.length > 0) {
                // Строга перевірка року (допускаємо похибку +-1 рік для регіональних релізів)
                let res = data.results.find(r => {
                    let rYear = (r.release_date || r.first_air_date || '').substring(0, 4);
                    return rYear === year || rYear === (parseInt(year)-1).toString() || rYear === (parseInt(year)+1).toString();
                }); 

                if (res) {
                    if (!res.overview || res.overview.trim() === '') {
                        let enEndpoint = getTmdbEndpoint(`search/multi?query=${encodeURIComponent(title)}&language=en`);
                        let enData = await fetch(PROXIES[0] + enEndpoint).then(r => r.json());
                        let enRes = (enData.results ||[]).find(r => r.id === res.id);
                        if (enRes && enRes.overview) res.overview = enRes.overview;
                    }
                    if (!res.media_type) res.media_type = res.first_air_date ? 'tv' : 'movie';
                    tmdbItemCache[cacheKey] = res;
                    return res;
                }
            }
        } catch(e) {}
        return null;
    }

    async function fetchCatalogPage(url, limit = 15) {
        if (listCache[url]) return listCache[url];
        let listHtml = await fetchHtml(url);
        let links = extractItemLinks(listHtml).slice(0, limit); 
        let tmdbItems = await processInQueue(links, processSingleItem, 5);
        
        let unique = {};
        let finalItems = tmdbItems.filter(item => {
            if (!item || !item.id || !item.backdrop_path) return false;
            if (unique[item.id]) return false;
            unique[item.id] = true;
            return true;
        });

        if (finalItems.length > 0) listCache[url] = finalItems;
        return finalItems;
    }

    async function fetchKinobazaCatalog(url, limit) {
        if (listCache[url]) return listCache[url];
        let html = await fetchHtml(url);
        let items = extractKinobazaItems(html);
        
        let tmdbItems = await processInQueue(items, async (item) => {
            return await searchTmdbByTitleAndYear(item.title, item.year);
        }, 5);

        let unique = {};
        let finalItems = tmdbItems.filter(item => {
            if (!item || !item.id || !item.backdrop_path) return false;
            if (unique[item.id]) return false;
            unique[item.id] = true;
            return true;
        });

        if (limit) finalItems = finalItems.slice(0, limit);

        if (finalItems.length > 0) listCache[url] = finalItems;
        return finalItems;
    }

    async function getLmeTmdbItems(items) {
        let promises = items.map(async (item) => {
            if(!item || !item.id) return null;
            let parts = item.id.split(':');
            if (parts.length !== 2) return null;
            let type = parts[0], id = parts[1];
            let tmdbData = await fetchTmdbWithFallback(type, id);
            if (tmdbData && !tmdbData.error && tmdbData.backdrop_path) {
                tmdbData.media_type = type;
                return tmdbData;
            }
            return null;
        });
        let results = await Promise.all(promises);
        return results.filter(Boolean);
    }

    function analyzeAndInvert(imgElement) {
        if (isLiteMode()) return;
        try {
            var canvas = document.createElement('canvas');
            var ctx = canvas.getContext('2d');
            canvas.width = imgElement.naturalWidth || imgElement.width;
            canvas.height = imgElement.naturalHeight || imgElement.height;
            if (canvas.width === 0 || canvas.height === 0) return;
            ctx.drawImage(imgElement, 0, 0);
            var imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            var data = imageData.data;
            var darkPixels = 0, totalPixels = 0;
            for (var i = 0; i < data.length; i += 4) {
                if (data[i + 3] < 10) continue; 
                totalPixels++;
                var brightness = (data[i] * 299 + data[i + 1] * 587 + data[i + 2] * 114) / 1000;
                if (brightness < 120) darkPixels++;
            }
            if (totalPixels > 0 && (darkPixels / totalPixels) >= 0.85) imgElement.style.filter += " brightness(0) invert(1)";
        } catch (e) { }
    }

    function fetchLogo(movie, itemElement) {
        var mType = movie.media_type || (movie.name ? 'tv' : 'movie');
        var langPref = Lampa.Storage.get('ym_logo_lang', 'uk_en');
        var quality = Lampa.Storage.get('ym_img_quality', 'w300');
        
        // Функція для відображення тільки тексту замість картинки
        function applyTextLogo() {
            var textLogo = document.createElement('div');
            textLogo.className = 'card-custom-logo-text';
            var txt = movie.title || movie.name;
            if (langPref === 'en' || langPref === 'text_en') {
                txt = movie.original_title || movie.original_name || txt;
            }
            textLogo.innerText = txt;
            itemElement.find('.card__view').append(textLogo);
        }

        // Якщо в налаштуваннях обрано тільки текст, відразу ставимо текст
        if (langPref === 'text_uk' || langPref === 'text_en' || isLiteMode()) {
            applyTextLogo();
            return;
        }

        var cacheKey = 'logo_uas_v8_' + quality + '_' + langPref + '_' + mType + '_' + movie.id;
        var cachedUrl = Lampa.Storage.get(cacheKey);

        function applyLogo(url) {
            if (url && url !== 'none') {
                var img = new Image();
                img.crossOrigin = "anonymous"; 
                img.className = 'card-custom-logo';
                img.onload = function() { analyzeAndInvert(img); itemElement.find('.card__view').append(img); };
                img.onerror = applyTextLogo;
                img.src = url;
            } else {
                applyTextLogo();
            }
        }
        
        if (cachedUrl) { applyLogo(cachedUrl); return; }

        let endpoint = getTmdbEndpoint(`${mType}/${movie.id}/images?include_image_language=uk,en,null`);
        fetch(PROXIES[0] + endpoint).then(r => r.json()).then(function(res) {
            var finalLogo = 'none';
            if (res.logos && res.logos.length > 0) {
                var found = null;
                if (langPref === 'uk') {
                    found = res.logos.find(l => l.iso_639_1 === 'uk');
                } else if (langPref === 'en') {
                    found = res.logos.find(l => l.iso_639_1 === 'en');
                } else {
                    found = res.logos.find(l => l.iso_639_1 === 'uk') || res.logos.find(l => l.iso_639_1 === 'en');
                }

                if (found) finalLogo = PROXIES[0] + Lampa.TMDB.image('t/p/' + quality + found.file_path);
            }
            Lampa.Storage.set(cacheKey, finalLogo);
            applyLogo(finalLogo);
        }).catch(function() {
            Lampa.Storage.set(cacheKey, 'none');
            applyLogo('none');
        });
    }

    // Реєструє картку для відкладеного рендеру логотипа, щоб зменшити стартове навантаження.
    function markCardForLazyLogo(cardElement, movie) {
        if (!cardElement || !movie) return;
        cardElement.__ymLogoMovie = movie;
        cardElement.__ymLogoLoaded = false;
    }

    // Завантажує логотип лише коли картка реально отримує фокус користувача.
    function ensureCardLogo(cardElement) {
        if (!cardElement || cardElement.__ymLogoLoaded || !cardElement.__ymLogoMovie) return;
        cardElement.__ymLogoLoaded = true;
        fetchLogo(cardElement.__ymLogoMovie, $(cardElement));
    }

    function makeTitleButtonItem(title, url, iconUrl) {
        return {
            title: title,
            is_title_btn: true,
            url: url,
            params: {
                createInstance: function () {
                    return Lampa.Maker.make('Card', { title: title }, function (module) { return module.only('Card', 'Callback'); });
                },
                emit: {
                    onCreate: function () {
                        var item = $(this.html);
                        item.addClass('card--title-btn');
                        item.empty(); 

                        if (!url) {
                            item.removeClass('selector focusable'); 
                            item.addClass('card--title-btn-static');
                        }

                        var iconHtml = iconUrl ? '<img src="' + escapeHtml(iconUrl) + '" class="title-btn-icon" onerror="this.style.display=\'none\'" />' : '';
                        item.append('<div class="title-btn-text">' + iconHtml + escapeHtml(title) + '</div>');
                    },
                    onlyEnter: function () {
                        if (url) {
                            Lampa.Activity.push({
                                url: url,
                                title: title,
                                component: 'category_full',
                                page: 1,
                                source: 'uas_pro_source'
                            });
                        }
                    }
                }
            }
        };
    }

    function makeCollectionButtonItem(collection) {
        return {
            title: collection.title,
            is_collection_btn: true,
            url: collection.url,
            params: {
                createInstance: function () {
                    return Lampa.Maker.make('Card', { title: collection.title }, function (module) { return module.only('Card', 'Callback'); });
                },
                emit: {
                    onCreate: function () {
                        var item = $(this.html);
                        item.addClass('card--collection-btn');
                        item.empty(); 

                        item.append('<div class="collection-title">' + escapeHtml(collection.title) + '</div>');
                    },
                    onlyEnter: function () {
                        Lampa.Activity.push({
                            url: collection.url,
                            title: collection.title,
                            component: 'category_full',
                            page: 1,
                            source: 'uas_pro_source',
                            is_kinobaza_list: true
                        });
                    }
                }
            }
        };
    }

    // Картка "Обране", яка додається на початок історії переглядів
    function makeFavoriteCardItem(bgUrl) {
        return {
            title: 'Обране',
            is_title_btn: true,
            params: {
                createInstance: function () {
                    return Lampa.Maker.make('Card', { title: 'Обране' }, function (module) { return module.only('Card', 'Callback'); });
                },
                emit: {
                    onCreate: function () {
                        var item = $(this.html);
                        item.addClass('card--history-custom');
                        var view = item.find('.card__view');
                        view.empty(); 
                        
                        view.css({
                            'background-image': bgUrl ? 'url(' + bgUrl + ')' : 'rgba(30,30,30,0.8)', 
                            'background-size': 'cover',
                            'background-position': 'center',
                            'padding-bottom': '56.25%', 
                            'height': '0', 
                            'position': 'relative',
                            'display': 'block'
                        });
                        
                        view.append('<div class="card-backdrop-overlay" style="background: rgba(0,0,0,0.65);"></div>');
                        
                        view.append('<div style="position: absolute; top:0; left:0; right:0; bottom:0; display:flex; flex-direction: column; align-items:center; justify-content:center; z-index: 2; padding: 10%; box-sizing: border-box;">' +
                            '<svg style="width: 35%; height: 35%; margin-bottom: 0.5em; filter: drop-shadow(0px 2px 4px rgba(0,0,0,0.8)); color: #fff;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path></svg>' +
                            '<div style="font-size: 1.1em; font-weight: bold; text-shadow: 0px 2px 4px rgba(0,0,0,0.8); text-align: center; color: #fff;">Обране</div>' +
                            '</div>');
                    },
                    onlyEnter: function () {
                        Lampa.Activity.push({
                            url: '',
                            title: 'Обране',
                            component: 'bookmarks',
                            page: 1
                        });
                    }
                }
            }
        };
    }

    function makeHistoryCardItem(movie) {
        return {
            title: movie.title || movie.name,
            params: {
                createInstance: function () {
                    return Lampa.Maker.make('Card', movie, function (module) { return module.only('Card', 'Callback'); });
                },
                emit: {
                    onCreate: function () {
                        var item = $(this.html);
                        item.addClass('card--history-custom');
                        var view = item.find('.card__view');
                        view.empty(); 
                        
                        var quality = Lampa.Storage.get('ym_img_quality', 'w300');
                        var imgUrlPath = movie.backdrop_path || movie.poster_path;
                        var imgUrl = imgUrlPath ? (PROXIES[0] + Lampa.TMDB.image('t/p/' + quality + imgUrlPath)) : '';
                        
                        view.css({
                            'background-image': imgUrl ? 'url(' + imgUrl + ')' : 'none', 
                            'background-size': 'cover', 
                            'background-position': 'center',
                            'padding-bottom': '56.25%', 
                            'height': '0', 
                            'position': 'relative'
                        });
                        
                        view.append('<div class="card-backdrop-overlay"></div>');

                        var voteVal = parseFloat(movie.vote_average);
                        if (!isNaN(voteVal) && voteVal > 0) {
                            var voteDiv = document.createElement('div');
                            voteDiv.className = 'card__vote';
                            voteDiv.innerText = voteVal.toFixed(1);
                            view.append(voteDiv);
                        }

                        // Логотип рендериться ліниво по фокусу для швидшого рендеру рядка.
                        markCardForLazyLogo(this.html, movie);
                    },
                    onlyEnter: function () {
                        var mType = movie.media_type || (movie.name ? 'tv' : 'movie');
                        Lampa.Activity.push({ url: '', component: 'full', id: movie.id, method: mType, card: movie, source: movie.source || 'tmdb' });
                    }
                }
            }
        };
    }

    function makeWideCardItem(movie) {
        return {
            title: movie.title || movie.name,
            params: {
                createInstance: function () {
                    return Lampa.Maker.make('Card', movie, function (module) { return module.only('Card', 'Callback'); });
                },
                emit: {
                    onCreate: function () {
                        var item = $(this.html);
                        item.addClass('card--wide-custom');
                        var view = item.find('.card__view');
                        view.empty(); 
                        
                        var quality = Lampa.Storage.get('ym_img_quality', 'w300');
                        var imgUrl = PROXIES[0] + Lampa.TMDB.image('t/p/' + quality + movie.backdrop_path);
                        view.css({
                            'background-image': 'url(' + imgUrl + ')', 'background-size': 'cover', 'background-position': 'center',
                            'padding-bottom': '56.25%', 'height': '0', 'position': 'relative'
                        });
                        
                        view.append('<div class="card-backdrop-overlay"></div>');

                        var voteVal = parseFloat(movie.vote_average);
                        if (!isNaN(voteVal) && voteVal > 0) {
                            var voteDiv = document.createElement('div');
                            voteDiv.className = 'card__vote';
                            voteDiv.innerText = voteVal.toFixed(1);
                            view.append(voteDiv);
                        }

                        var yearStr = (movie.release_date || movie.first_air_date || '').toString().substring(0, 4);
                        if (yearStr && yearStr.length === 4) {
                            var ageDiv = document.createElement('div');
                            ageDiv.className = 'card-badge-age'; 
                            ageDiv.innerText = yearStr;
                            view.append(ageDiv);
                        }

                        // Логотип рендериться ліниво по фокусу для швидшого рендеру рядка.
                        markCardForLazyLogo(this.html, movie);

                        var descText = movie.overview || 'Опис відсутній.';
                        item.append('<div class="custom-title-bottom">' + escapeHtml(movie.title || movie.name) + '</div>');
                        item.append('<div class="custom-overview-bottom">' + escapeHtml(descText) + '</div>');
                    },
                    onlyEnter: function () {
                        var mType = movie.media_type || (movie.name ? 'tv' : 'movie');
                        Lampa.Activity.push({ url: '', component: 'full', id: movie.id, method: mType, card: movie, source: movie.source || 'tmdb' });
                    }
                }
            }
        };
    }

    function loadHistoryRow(callback) {
        let hist =[];
        let allFavs = {};
        try {
            if (window.Lampa && Lampa.Favorite && typeof Lampa.Favorite.all === 'function') {
                allFavs = Lampa.Favorite.all() || {};
                if (allFavs.history) {
                    hist = allFavs.history;
                }
            }
        } catch(e) {}
        
        let results =[];
        
        let latestFavImg = '';
        try {
            let favItems =[];
            if (allFavs.book) favItems = favItems.concat(allFavs.book);
            if (allFavs.like) favItems = favItems.concat(allFavs.like);
            if (allFavs.history) favItems = favItems.concat(allFavs.history);
            
            let latestItem = favItems.find(item => item && (item.backdrop_path || item.poster_path));
            if (latestItem) {
                let quality = Lampa.Storage.get('ym_img_quality', 'w300');
                let imgUrlPath = latestItem.backdrop_path || latestItem.poster_path;
                latestFavImg = imgUrlPath ? (PROXIES[0] + Lampa.TMDB.image('t/p/' + quality + imgUrlPath)) : '';
            }
        } catch(e) {}

        let showFav = Lampa.Storage.get('uas_show_fav_card');
        if (showFav === null || showFav === undefined || showFav === '' || showFav === true || showFav === 'true') {
            results.push(makeFavoriteCardItem(latestFavImg));
        }

        if (hist && hist.length > 0) {
            let unique = {};
            let validItems = hist.filter(h => {
                if (h && h.id && (h.title || h.name) && !unique[h.id]) {
                    unique[h.id] = true;
                    return true;
                }
                return false;
            }).slice(0, 20);

            if (validItems.length > 0) {
                results = results.concat(validItems.map(makeHistoryCardItem));
            }
        }

        if (results.length > 0) {
            callback({ 
                results: results, 
                title: '', 
                uas_content_row: true, 
                params: { items: { mapping: 'line', view: 15 } } 
            });
        } else {
            callback({ results:[] });
        }
    }

    async function loadRow(urlId, loadUrl, title, callback) {
        try {
            let items = await fetchCatalogPage(loadUrl, 15);
            let mapped = items.map(makeWideCardItem);
            callback({ 
                results: mapped, 
                title: '', 
                source: 'uas_pro_source', 
                uas_content_row: true, 
                params: { items: { mapping: 'line', view: 15 } } 
            });
        } catch(e) { callback({ results:[] }); }
    }

    async function loadKinobazaRow(urlId, loadUrl, title, callback) {
        try {
            let fetchUrl = loadUrl + '1';
            let items = await fetchKinobazaCatalog(fetchUrl, 15);
            let mapped = items.map(makeWideCardItem);
            callback({ 
                results: mapped, 
                title: '', 
                source: 'uas_pro_source', 
                uas_content_row: true, 
                params: { items: { mapping: 'line', view: 15 } } 
            });
        } catch(e) { callback({ results:[] }); }
    }

    async function loadKinobazaCollectionsRow(urlId, loadUrl, title, callback) {
        try {
            let randPage = Math.floor(Math.random() * 30) + 1;
            let fetchUrl = loadUrl + randPage;
            
            let html = await fetchHtml(fetchUrl);
            let items = extractKinobazaCollections(html);
            
            let mapped = items.slice(0, 15).map(makeCollectionButtonItem);
            
            callback({ 
                results: mapped, 
                title: '', 
                source: 'uas_pro_source', 
                uas_content_row: true, 
                params: { items: { mapping: 'line', view: 15 } } 
            });
        } catch(e) { callback({ results:[] }); }
    }

    async function loadCommunityGemsRow(callback) {
        try {
            let listUrl = 'https://wh.lme.isroot.in/v2/top?period=7d&top=asc&min_rating=7&per_page=15&page=1';
            let res = await safeFetch(listUrl).then(r=>r.json()).catch(()=>({items:[]}));
            let items = Array.isArray(res) ? res : (res.items ||[]);

            let tmdbItems = await getLmeTmdbItems(items);
            let mappedResults = tmdbItems.map(makeWideCardItem);

            callback({ 
                results: mappedResults, 
                title: '', 
                source: 'uas_pro_source', 
                uas_content_row: true,
                params: { items: { mapping: 'line', view: 15 } } 
            });
        } catch(e) { callback({ results:[] }); }
    }

    async function loadRandomCollectionRow(callback) {
        try {
            let listHtml = await fetchHtml('https://uaserials.com/collections/');
            let doc = new DOMParser().parseFromString(listHtml, "text/html");
            let collLinks =[];
            doc.querySelectorAll('a[href]').forEach(a => {
                let href = a.getAttribute('href');
                if (href && href.match(/\/collections\/\d+/)) {
                    let fUrl = href.startsWith('http') ? href : 'https://uaserials.com' + href;
                    if (!collLinks.includes(fUrl)) collLinks.push(fUrl);
                }
            });
            if (collLinks.length === 0) throw new Error("No collections");

            let randomUrl = collLinks[Math.floor(Math.random() * collLinks.length)];
            let items = await fetchCatalogPage(randomUrl, 15);
            
            callback({ 
                results: items.map(makeWideCardItem), 
                title: '', 
                uas_content_row: true,
                params: { items: { mapping: 'line', view: 15 } } 
            });
        } catch(e) { callback({ results:[] }); }
    }

    Lampa.Api.sources.uas_pro_source = {
        list: async function (params, oncomplete, onerror) {
            let page = params.page || 1;
            let baseUrl = '';
            let isLME = false;
            let isKinobazaOnline = false;
            let isKinobazaList = params.is_kinobaza_list;
            let isKinobazaCollectionsList = false;

            if (params.url === 'uas_movies_new') baseUrl = 'https://uaserials.com/films/p/';
            else if (params.url === 'uas_movies_pop') baseUrl = 'https://uaserials.my/filmss/w/';
            else if (params.url === 'uas_series_new') baseUrl = 'https://uaserials.com/series/p/';
            else if (params.url === 'uas_series_pop') baseUrl = 'https://uaserials.com/series/w/';
            else if (params.url === 'kinobaza_streaming') {
                baseUrl = 'https://kinobaza.com.ua/online?order_by=date_desc&rating=1&rating_max=10&imdb_rating=1&imdb_rating_max=10&itunes_audio=1&rakuten_audio=1&netflix_audio=1&playmarket_audio=1&takflix_audio=1&sweet_audio=1&primevideo_audio=1&per_page=30&translated=has_ukr_audio&page=';
                isKinobazaOnline = true;
            }
            else if (params.url === 'kinobaza_collections_list') {
                isKinobazaCollectionsList = true;
                baseUrl = 'https://kinobaza.com.ua/lists?order_by=popular&page=';
            }
            else if (isKinobazaList) {
                baseUrl = params.url;
            }
            else if (params.url === 'uas_community') isLME = true;
            else return onerror();

            try {
                let mapped =[];
                let totalPages = 50; 

                if (isLME) {
                    let listUrl = `https://wh.lme.isroot.in/v2/top?period=7d&top=asc&min_rating=7&per_page=20&page=${page}`;
                    let res = await safeFetch(listUrl).then(r=>r.json());
                    let items = Array.isArray(res) ? res : (res.items ||[]);
                    totalPages = res.total_pages || 10;
                    
                    mapped = await getLmeTmdbItems(items); 
                } else if (isKinobazaCollectionsList) {
                    let listUrl = baseUrl + page;
                    let html = await fetchHtml(listUrl);
                    let items = extractKinobazaCollections(html);
                    mapped = items.map(makeCollectionButtonItem);
                } else if (isKinobazaList) {
                    let listUrl = baseUrl + (baseUrl.includes('?') ? '&' : '?') + 'page=' + page;
                    let html = await fetchHtml(listUrl);
                    let items = extractKinobazaItems(html);
                    let tmdbItems = await processInQueue(items, async (item) => {
                        return await searchTmdbByTitleAndYear(item.title, item.year);
                    }, 5);
                    
                    let unique = {};
                    let finalItems = tmdbItems.filter(item => {
                        if (!item || !item.id || !item.backdrop_path) return false;
                        if (unique[item.id]) return false;
                        unique[item.id] = true;
                        return true;
                    });
                    mapped = finalItems; 
                } else if (isKinobazaOnline) {
                    let listUrl = baseUrl + page;
                    let items = await fetchKinobazaCatalog(listUrl, 30);
                    mapped = items;
                } else {
                    let uasPage = page + 1; 
                    let listUrl = `${baseUrl}page/${uasPage}/`;
                    
                    let items = await fetchCatalogPage(listUrl, 20); 
                    mapped = items; 
                }

                if (mapped.length > 0) {
                    oncomplete({
                        results: mapped,
                        page: page,
                        total_pages: totalPages
                    });
                } else { onerror(); }
            } catch (e) { onerror(); }
        }
    };

    // Реєструє налаштування плагіна і дії в екрані налаштувань Lampa.
    function createSettings() {
        if (!window.Lampa || !Lampa.SettingsApi) return;
        Lampa.SettingsApi.addComponent({
            component: 'ymainpage',
            name: 'YMainPage',
            icon: `<svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="3" y1="9" x2="21" y2="9"></line><line x1="9" y1="21" x2="9" y2="9"></line></svg>`
        });

        Lampa.SettingsApi.addParam({
            component: 'ymainpage',
            param: { name: 'uas_support_yarik', type: 'button' },
            field: { name: "Підтримати розробників: Yarik's Mod's", description: 'https://lampalampa.free.nf/' }
        });
        
        Lampa.SettingsApi.addParam({
            component: 'ymainpage',
            param: { name: 'uas_support_lme', type: 'button' },
            field: { name: 'Підтримати розробників: LampaME', description: 'https://lampame.github.io/' }
        });

        Lampa.SettingsApi.addParam({
            component: 'ymainpage',
            param: { name: 'uas_show_flag', type: 'trigger', default: true },
            field: { name: 'Відображення УКР озвучок', description: 'Пошук та відображення прапорця на картках' }
        });

        Lampa.SettingsApi.addParam({
            component: 'ymainpage',
            param: { name: 'uas_show_fav_card', type: 'trigger', default: true },
            field: { name: 'Картка "Обране" в історії', description: 'Показувати швидкий доступ до Обраного першим у рядку історії' }
        });

        var langValues = {
            'uk': 'Тільки українською',
            'uk_en': 'Укр + Англ (За замовчуванням)',
            'en': 'Тільки англійською',
            'text_uk': 'Завжди текст (Укр)',
            'text_en': 'Завжди текст (Англ)'
        };
        Lampa.SettingsApi.addParam({
            component: 'ymainpage',
            param: { name: 'ym_logo_lang', type: 'select', values: langValues, default: 'uk_en' },
            field: { name: 'Мова логотипів', description: 'Оберіть пріоритет мови для логотипів' }
        });

        var qualValues = {
            'w300': 'w300 (За замовчуванням)',
            'w500': 'w500',
            'w780': 'w780',
            'original': 'Оригінал'
        };
        Lampa.SettingsApi.addParam({
            component: 'ymainpage',
            param: { name: 'ym_img_quality', type: 'select', values: qualValues, default: 'w300' },
            field: { name: 'Якість зображень (Фон/Лого)', description: 'Впливає на швидкість завантаження сторінки' }
        });

        var contrastValues = {
            'standard': 'Стандартний (Рекомендовано)',
            'high': 'Високий контраст'
        };
        Lampa.SettingsApi.addParam({
            component: 'ymainpage',
            param: { name: 'ym_contrast_mode', type: 'select', values: contrastValues, default: 'standard' },
            field: { name: 'Контраст інтерфейсу', description: 'Підсилює читабельність назв категорій та фокус-станів' }
        });

        Lampa.SettingsApi.addParam({
            component: 'ymainpage',
            param: { name: 'ym_lite_mode', type: 'trigger', default: false },
            field: { name: 'Lite mode для слабких пристроїв', description: 'Менше анімацій, тіней і рендеру логотипів для стабільнішої роботи' }
        });

        Lampa.SettingsApi.addParam({
            component: 'ymainpage',
            param: { name: 'ym_safe_area', type: 'trigger', default: true },
            field: { name: 'Safe area відступи', description: 'Додає безпечні відступи по краях екрана на Android TV/WebView' }
        });

        Lampa.SettingsApi.addParam({
            component: 'ymainpage',
            param: { name: 'ym_show_season_badge', type: 'trigger', default: false },
            field: { name: 'Бейдж сезону (8 сезонів / 8 сезон • 2/10)', description: 'Гібридний формат: завершений сезон показується як кількість сезонів, активний — як прогрес серій.' }
        });

        var seasonBadgeStyleValues = {
            'default': 'Класичний',
            'soft': 'Мʼякий',
            'contrast': 'Контрастний'
        };
        Lampa.SettingsApi.addParam({
            component: 'ymainpage',
            param: { name: 'ym_season_badge_style', type: 'select', values: seasonBadgeStyleValues, default: 'default' },
            field: { name: 'Стиль бейджа сезону', description: 'Оформлення бейджа "сезон/прогрес" на картках серіалів' }
        });

        let orderValues = { '1': 'Позиція 1', '2': 'Позиція 2', '3': 'Позиція 3', '4': 'Позиція 4', '5': 'Позиція 5', '6': 'Позиція 6', '7': 'Позиція 7', '8': 'Позиція 8', '9': 'Позиція 9' };

        DEFAULT_ROWS_SETTINGS.forEach(r => {
            Lampa.SettingsApi.addParam({
                component: 'ymainpage',
                param: { name: r.id, type: 'trigger', default: r.default },
                field: { name: 'Вимкнути / Увімкнути: ' + r.title, description: 'Показувати цей рядок на головній' }
            });
            Lampa.SettingsApi.addParam({
                component: 'ymainpage',
                param: { name: r.id + '_order', type: 'select', values: orderValues, default: r.defOrder },
                field: { name: 'Порядок: ' + r.title, description: 'Яким по рахунку виводити цей рядок' }
            });
        });

        Lampa.SettingsApi.addParam({
            component: 'ymainpage',
            param: { name: 'uas_pro_tmdb_btn', type: 'button' },
            field: { name: 'Власний TMDB API ключ', description: 'Натисніть, щоб ввести ключ (працює першочергово)' }
        });

        Lampa.Settings.listener.follow('open', function (e) {
            if (e.name === 'ymainpage') {
                e.body.find('[data-name="uas_support_yarik"]').on('hover:enter', function () {
                    window.open('https://lampalampa.free.nf/', '_blank');
                });
                
                e.body.find('[data-name="uas_support_lme"]').on('hover:enter', function () {
                    window.open('https://lampame.github.io/main/#uk', '_blank');
                });

                e.body.find('[data-name="uas_pro_tmdb_btn"]').on('hover:enter', function () {
                    var currentKey = Lampa.Storage.get('uas_pro_tmdb_apikey') || '';
                    Lampa.Input.edit({
                        title: 'Введіть TMDB API Ключ', value: currentKey, free: true, nosave: true
                    }, function (new_val) {
                        if (new_val !== undefined) {
                            Lampa.Storage.set('uas_pro_tmdb_apikey', new_val.trim());
                            Lampa.Noty.show('TMDB ключ збережено. Перезапустіть застосунок.');
                        }
                    });
                });
            }
        });
    }

    // Перевизначає головне джерело TMDB для формування керованих рядків головної.
    function overrideApi() {
        Lampa.Api.sources.tmdb.main = function (params, oncomplite, onerror) {
            var rowDefs =[
                { id: 'ym_row_history', defOrder: 1, type: 'history', url: '', title: 'Історія перегляду', icon: '' },
                { id: 'ym_row_movies_new', defOrder: 2, type: 'uas', url: 'uas_movies_new', loadUrl: 'https://uaserials.com/films/p/', title: 'Новинки фільмів', icon: 'https://upload.wikimedia.org/wikipedia/commons/5/51/Ukraine_film_clapperboard.svg' },
                { id: 'ym_row_series_new', defOrder: 3, type: 'uas', url: 'uas_series_new', loadUrl: 'https://uaserials.com/series/p/', title: 'Новинки серіалів', icon: 'https://upload.wikimedia.org/wikipedia/commons/3/3a/Mplayer.svg' },
                { id: 'ym_row_collections', defOrder: 4, type: 'kinobaza_collections', url: 'kinobaza_collections_list', loadUrl: 'https://kinobaza.com.ua/lists?order_by=popular&page=', title: 'Підбірки KinoBaza', icon: 'https://upload.wikimedia.org/wikipedia/commons/e/ef/Film-award-stub.svg' },
                { id: 'ym_row_kinobaza', defOrder: 5, type: 'kinobaza', url: 'kinobaza_streaming', loadUrl: 'https://kinobaza.com.ua/online?order_by=date_desc&rating=1&rating_max=10&imdb_rating=1&imdb_rating_max=10&itunes_audio=1&rakuten_audio=1&netflix_audio=1&playmarket_audio=1&takflix_audio=1&sweet_audio=1&primevideo_audio=1&per_page=30&translated=has_ukr_audio&page=', title: 'Новинки Стрімінгів UA', icon: 'https://upload.wikimedia.org/wikipedia/commons/a/a5/Netflix_meaningful_logo.svg' },
                { id: 'ym_row_community', defOrder: 6, type: 'community', url: 'uas_community', title: 'Знахідки спільноти LME', icon: 'https://upload.wikimedia.org/wikipedia/commons/b/b2/Anime_eye_film.png' },
                { id: 'ym_row_movies_watch', defOrder: 7, type: 'uas', url: 'uas_movies_pop', loadUrl: 'https://uaserials.my/filmss/w/', title: 'Популярні фільми', icon: 'https://upload.wikimedia.org/wikipedia/commons/7/7e/Filmreel-icon.svg' },
                { id: 'ym_row_series_pop', defOrder: 8, type: 'uas', url: 'uas_series_pop', loadUrl: 'https://uaserials.com/series/w/', title: 'Популярні серіали', icon: 'https://upload.wikimedia.org/wikipedia/commons/f/f6/Tvfilm.svg' },
                { id: 'ym_row_random', defOrder: 9, type: 'random', url: '', title: 'Випадкова підбірка', icon: 'https://upload.wikimedia.org/wikipedia/commons/a/a3/Magicfilm_icon.svg' }
            ];

            let activeRows =[];
            for (let def of rowDefs) {
                let defSetting = DEFAULT_ROWS_SETTINGS.find(r => r.id === def.id);
                let defaultEnabled = defSetting ? defSetting.default : true;
                
                let enabled = Lampa.Storage.get(def.id);
                if (enabled === null || enabled === undefined || enabled === '') {
                    enabled = defaultEnabled;
                } else if (enabled === 'false') {
                    enabled = false;
                } else if (enabled === 'true') {
                    enabled = true;
                }
                
                let orderVal = Lampa.Storage.get(def.id + '_order');
                let order = parseInt(orderVal);
                if (isNaN(order)) order = def.defOrder;
                
                if (enabled) activeRows.push({ ...def, order: order });
            }
            activeRows.sort((a, b) => a.order - b.order);
            
            let parts_data =[];
            
            activeRows.forEach(def => {
                if (def.type !== 'history') {
                    parts_data.push((cb) => {
                        cb({
                            results:[makeTitleButtonItem(def.title, def.url, def.icon)],
                            title: '', 
                            uas_title_row: true, 
                            params: { items: { mapping: 'line', view: 1 } }
                        });
                    });
                }

                parts_data.push((cb) => {
                    if (def.type === 'history') loadHistoryRow(cb);
                    else if (def.type === 'uas') loadRow(def.url, def.loadUrl, def.title, cb);
                    else if (def.type === 'kinobaza') loadKinobazaRow(def.url, def.loadUrl, def.title, cb);
                    else if (def.type === 'kinobaza_collections') loadKinobazaCollectionsRow(def.url, def.loadUrl, def.title, cb);
                    else if (def.type === 'community') loadCommunityGemsRow(cb);
                    else if (def.type === 'random') loadRandomCollectionRow(cb);
                });
            });

            if(parts_data.length === 0) {
                parts_data.push((cb) => loadRow('uas_movies_new', 'https://uaserials.com/films/p/', 'Новинки фільмів', cb));
            }

            Lampa.Api.partNext(parts_data, 2, oncomplite, onerror);
        };
    }

    // Точка входу: ініціалізація дефолтів, стилів, слухачів і перевизначення API.
    function start() {
        if (window.uaserials_pro_v8_loaded) return;
        window.uaserials_pro_v8_loaded = true;

        if (!Lampa.Storage.get('ym_rows_init_v8_fix_2')) {
            Lampa.Storage.set('ym_rows_init_v8_fix_2', true);
            DEFAULT_ROWS_SETTINGS.forEach(r => {
                let current = Lampa.Storage.get(r.id);
                if (current === null || current === undefined || current === '') {
                    Lampa.Storage.set(r.id, r.default);
                }
            });
            let sf = Lampa.Storage.get('uas_show_flag');
            if (sf === null || sf === undefined || sf === '') Lampa.Storage.set('uas_show_flag', true);
            
            let sfc = Lampa.Storage.get('uas_show_fav_card');
            if (sfc === null || sfc === undefined || sfc === '') Lampa.Storage.set('uas_show_fav_card', true);
        }

        lmeCache = new Cache(CONFIG.cache);
        lmeCache.init();

        ensureUiDefaults();
        createSettings();

        var style = document.createElement('style');
        style.innerHTML = `
            .card .card__age { display: none !important; }
            :root {
                --ym-surface-1: rgba(26, 33, 44, 0.62);
                --ym-surface-2: rgba(18, 23, 33, 0.82);
                --ym-surface-3: rgba(44, 55, 72, 0.92);
                --ym-text-main: #e7edf7;
                --ym-text-muted: #b6c2d4;
                --ym-text-dim: #91a0b6;
                --ym-focus: #d7e6ff;
                --ym-accent: #5aa8ff;
                --ym-accent-soft: rgba(90, 168, 255, 0.25);
                --ym-card-border: rgba(123, 155, 199, 0.36);
            }

            body.ym-contrast-high {
                --ym-surface-1: rgba(20, 30, 42, 0.86);
                --ym-surface-2: rgba(16, 23, 33, 0.96);
                --ym-surface-3: rgba(55, 71, 93, 0.98);
                --ym-text-main: #ffffff;
                --ym-text-muted: #dbe7f8;
                --ym-text-dim: #b6c9e6;
                --ym-focus: #ffffff;
                --ym-card-border: rgba(182, 214, 255, 0.66);
            }

            body.ym-lite-mode .card--wide-custom,
            body.ym-lite-mode .card--history-custom,
            body.ym-lite-mode .card--collection-btn,
            body.ym-lite-mode .card--title-btn {
                transition: none !important;
            }
            body.ym-lite-mode .card-custom-logo,
            body.ym-lite-mode .card-backdrop-overlay {
                display: none !important;
            }
            body.ym-lite-mode .card--title-btn,
            body.ym-lite-mode .card--collection-btn {
                box-shadow: none !important;
            }
            body.ym-lite-mode .card--wide-custom.focus .card__view,
            body.ym-lite-mode .card--history-custom.focus .card__view,
            body.ym-lite-mode .card--collection-btn.focus {
                box-shadow: none !important;
            }
            body.ym-lite-mode .card--wide-custom.focus,
            body.ym-lite-mode .card--history-custom.focus,
            body.ym-lite-mode .card--collection-btn.focus,
            body.ym-lite-mode .card--title-btn.focus {
                transform: none !important;
            }

            .card__view .card-badge-age { 
                display: block !important; right: 0 !important; top: 0 !important; padding: 0.2em 0.45em !important; 
                background: rgba(0, 0, 0, 0.6) !important; 
                position: absolute !important; margin-top: 0 !important; font-size: 1.1em !important; 
                z-index: 10 !important; color: #fff !important; font-weight: bold !important;
            }

            .card--wide-custom { width: 25em !important; margin-right: 0.2em !important; margin-bottom: 0 !important; position: relative; cursor: pointer; transition: transform 0.2s ease, z-index 0.2s ease; z-index: 1; }
            
            .card--wide-custom .card__view { border-radius: 0.4em !important; overflow: hidden !important; box-shadow: 0 3px 6px rgba(0,0,0,0.5); }
            .card--wide-custom .card-backdrop-overlay { position: absolute; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0, 0, 0, 0.5); pointer-events: none; border-radius: 0.4em !important; z-index: 1; }
            
            .card--wide-custom.focus { z-index: 99 !important; transform: scale(1.06); }
            .card--wide-custom.focus .card__view { box-shadow: 0 10px 25px rgba(0,0,0,0.9) !important; border: 3px solid var(--ym-focus) !important; outline: none !important; }
            .card--wide-custom.focus .card__view::after, .card--wide-custom.focus .card__view::before { display: none !important; content: none !important; }

            .card-custom-logo { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 70% !important; height: 70% !important; max-width: 70% !important; max-height: 70% !important; padding: 0 !important; margin: 0 !important; object-fit: contain; z-index: 5; filter: drop-shadow(0px 3px 5px rgba(0,0,0,0.8)); pointer-events: none; transition: filter 0.3s ease; }
            
            .card-custom-logo-text { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 80%; max-height: 70%; text-align: center; font-size: 2em; font-weight: 600; color: #fff; text-shadow: none !important; z-index: 5; pointer-events: none; word-wrap: break-word; white-space: normal; line-height: 1.2; font-family: sans-serif; display: flex; align-items: center; justify-content: center; }

            .card--wide-custom > div:not(.card__view):not(.custom-title-bottom):not(.custom-overview-bottom) { display: none !important; }
            .custom-title-bottom { width: 100%; text-align: left; font-size: 1.1em; font-weight: bold; margin-top: 0.3em; color: var(--ym-text-main); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; padding: 0 0.2em; text-shadow: 0 1px 2px rgba(0,0,0,0.7); }
            .custom-overview-bottom { width: 100%; text-align: left; font-size: 0.85em; color: var(--ym-text-muted); line-height: 1.2; margin-top: 0.2em; padding: 0 0.2em; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; white-space: normal; }
            
            .card__vote { right: 0 !important; bottom: 0 !important; padding: 0.2em 0.45em !important; z-index: 2; position: absolute !important; font-weight: bold; background: rgba(0,0,0,0.6); }
            .card__type { position: absolute !important; left: 0 !important; top: 0 !important; width: auto !important; height: auto !important; line-height: 1 !important; padding: 0.3em !important; background: rgba(0, 0, 0, 0.5) !important; display: flex !important; align-items: center; justify-content: center; z-index: 2; color: #fff !important; transition: background 0.3s !important; }
            .card__type svg { width: 1.5em !important; height: 1.5em !important; }
            .card__type.card__type--season {
                font-size: 1.02em !important;
                font-weight: 700 !important;
                padding: 0.23em 0.52em !important;
                font-family: Roboto, Arial, sans-serif !important;
                letter-spacing: 0.01em !important;
                border: 1px solid rgba(255,255,255,0.18) !important;
                box-shadow: 0 2px 6px rgba(0,0,0,0.32) !important;
                white-space: nowrap !important;
            }
            .card__type.card__type--season.card__type--season-ym.is-complete {
                background: linear-gradient(135deg, rgba(56, 193, 114, 0.95), rgba(33, 151, 90, 0.95)) !important;
                color: #fff !important;
            }
            .card__type.card__type--season.card__type--season-ym.is-airing {
                background: linear-gradient(135deg, rgba(74, 110, 164, 0.95), rgba(49, 79, 130, 0.95)) !important;
                color: #fff !important;
            }
            body.ym-season-style-soft .card__type.card__type--season.card__type--season-ym {
                border-color: rgba(255,255,255,0.10) !important;
                box-shadow: none !important;
                text-shadow: none !important;
            }
            body.ym-season-style-soft .card__type.card__type--season.card__type--season-ym.is-complete {
                background: rgba(52, 176, 109, 0.84) !important;
            }
            body.ym-season-style-soft .card__type.card__type--season.card__type--season-ym.is-airing {
                background: rgba(72, 104, 156, 0.84) !important;
            }
            body.ym-season-style-contrast .card__type.card__type--season.card__type--season-ym {
                border: 1px solid rgba(255,255,255,0.45) !important;
                box-shadow: 0 0 0 1px rgba(0,0,0,0.35), 0 3px 8px rgba(0,0,0,0.45) !important;
                text-shadow: 0 1px 2px rgba(0,0,0,0.65) !important;
            }
            body.ym-season-style-contrast .card__type.card__type--season.card__type--season-ym.is-complete {
                background: linear-gradient(135deg, rgba(33, 181, 99, 1), rgba(23, 142, 77, 1)) !important;
            }
            body.ym-season-style-contrast .card__type.card__type--season.card__type--season-ym.is-airing {
                background: linear-gradient(135deg, rgba(80, 132, 204, 1), rgba(47, 91, 160, 1)) !important;
            }
            .card__ua_flag { position: absolute !important; left: 0 !important; bottom: 0 !important; width: 2.4em !important; height: 1.4em !important; font-size: 1.3em !important; background: linear-gradient(180deg, #0057b8 50%, #ffd700 50%) !important; opacity: 0.8 !important; z-index: 2; }
            
            .card--wide-custom .card-badge-age { border-radius: 0 0 0 0.5em !important; }
            .card--wide-custom .card__vote { border-radius: 0.5em 0 0 0 !important; } 
            .card--wide-custom .card__type { border-radius: 0 0 0.5em 0 !important; }  
            .card--wide-custom .card__ua_flag { border-radius: 0 0.5em 0 0 !important; }

            .card:not(.card--wide-custom):not(.card--history-custom) .card-badge-age { border-radius: 0 0.8em 0 0.8em !important; }
            .card:not(.card--wide-custom):not(.card--history-custom) .card__vote { border-radius: 0.8em 0 0.8em 0 !important; }
            .card:not(.card--wide-custom):not(.card--history-custom) .card__type { border-radius: 0.8em 0 0.8em 0 !important; }
            .card:not(.card--wide-custom):not(.card--history-custom) .card__ua_flag { border-radius: 0 0.8em 0 0.8em !important; }

            .items-line[data-uas-title-row="true"] .items-line__head { display: none !important; }
            .items-line[data-uas-content-row="true"] .items-line__head { display: none !important; }
            
            .items-line[data-uas-title-row="true"] { margin-top: 0 !important; margin-bottom: 0.5em !important; padding-top: 0 !important; padding-bottom: 0 !important; }
            .items-line[data-uas-title-row="true"] .items-line__body { margin-top: 0 !important; margin-bottom: 0 !important; padding-top: 0 !important; padding-bottom: 0 !important; }
            .items-line[data-uas-title-row="true"] .scroll__item { margin-top: 0 !important; margin-bottom: 0 !important; padding-top: 0 !important; padding-bottom: 0 !important; }
            
            .items-line[data-uas-content-row="true"] { margin-top: 0.1em !important; margin-bottom: 0.5em !important; padding-top: 0 !important; padding-bottom: 0 !important; }
            .items-line[data-uas-content-row="true"] .items-line__body { margin-top: 0 !important; margin-bottom: 0 !important; padding-top: 0 !important; padding-bottom: 0 !important; }
            .items-line[data-uas-content-row="true"] .scroll__item { margin-top: 0 !important; margin-bottom: 0 !important; padding-top: 0 !important; padding-bottom: 0 !important; }

            .items-line[data-uas-title-row="true"],
            .items-line[data-uas-content-row="true"] {
                padding-left: 0.6em !important;
                padding-right: 0.6em !important;
                padding-left: max(env(safe-area-inset-left), 0.6em) !important;
                padding-right: max(env(safe-area-inset-right), 0.6em) !important;
            }
            body.ym-safe-area-off .items-line[data-uas-title-row="true"],
            body.ym-safe-area-off .items-line[data-uas-content-row="true"] {
                padding-left: 0 !important;
                padding-right: 0 !important;
            }

            .card--title-btn {
                width: 100% !important; 
                max-width: 100% !important; 
                height: auto !important;
                background: linear-gradient(90deg, var(--ym-surface-1), rgba(26, 33, 44, 0.15)) !important;
                border-radius: 1.1em !important;
                margin: 0.15em 0 !important;
                display: flex !important;
                align-items: center !important;
                justify-content: flex-start !important; 
                padding: 0.55em 1.2em !important; 
                cursor: pointer !important;
                border: 1px solid var(--ym-card-border) !important; 
                box-shadow: 0 4px 10px rgba(0,0,0,0.28) !important;
                box-sizing: border-box !important;
                transition: transform 0.2s ease, border 0.2s ease, background 0.2s ease, box-shadow 0.2s ease !important;
            }

            .card--title-btn.focus {
                background: linear-gradient(90deg, var(--ym-surface-3), rgba(34, 46, 63, 0.9)) !important;
                border: 1px solid var(--ym-focus) !important;
                box-shadow: 0 0 0 0.2em rgba(215,230,255,0.18), inset 0 0 0 1px rgba(255,255,255,0.08) !important;
                outline: none !important;
                transform: scale(1.015) !important;
            }

            .title-btn-text {
                display: flex !important;
                align-items: center !important;
                font-size: 1.3em !important;
                font-weight: 700 !important;
                color: var(--ym-text-main) !important; 
                border: none !important; 
                padding: 0 !important;
                line-height: 1.2 !important;
                text-align: left !important;
                letter-spacing: 0.01em !important;
                text-shadow: 0 1px 2px rgba(0,0,0,0.55) !important;
                transition: color 0.2s ease, transform 0.2s ease !important;
            }

            .title-btn-icon {
                height: 1.05em !important;
                width: auto !important;
                margin-right: 0.5em !important;
                filter: brightness(1.08) saturate(1.05) drop-shadow(0px 1px 2px rgba(0,0,0,0.5)) !important;
            }

            .card--title-btn.focus .title-btn-text {
                color: #fff !important; 
                text-shadow: 0 1px 3px rgba(0,0,0,0.75) !important; 
                box-shadow: none !important;
            }

            .card--title-btn-static {
                cursor: default !important;
            }
            .card--title-btn-static .title-btn-text {
                opacity: 0.78 !important;
                color: var(--ym-text-dim) !important;
            }

            .card--title-btn .card__view, 
            .card--title-btn .card__view::after, 
            .card--title-btn .card__view::before {
                display: none !important;
            }

            .card--collection-btn {
                width: 16em !important;
                height: 7.2em !important;
                background: linear-gradient(165deg, var(--ym-surface-2), rgba(20, 28, 39, 0.95)) !important;
                border-radius: 0.8em !important;
                margin-right: 0.8em !important;
                margin-bottom: 0.8em !important;
                display: flex !important;
                flex-direction: column !important;
                align-items: center !important;
                justify-content: center !important;
                padding: 1em !important;
                cursor: pointer !important;
                border: 1px solid var(--ym-card-border) !important;
                box-shadow: 0 5px 10px rgba(0,0,0,0.32) !important;
                transition: transform 0.2s ease, background 0.2s ease, border 0.2s ease !important;
                text-align: center !important;
                box-sizing: border-box !important;
                position: relative;
            }

            .card--collection-btn.focus {
                background: linear-gradient(160deg, var(--ym-surface-3), rgba(43, 56, 73, 0.95)) !important;
                border: 1px solid var(--ym-focus) !important;
                box-shadow: 0 0 0 0.2em rgba(215,230,255,0.16), 0 8px 16px rgba(0,0,0,0.35) !important;
                transform: scale(1.03) !important;
                z-index: 99 !important;
            }

            .card--collection-btn .collection-title {
                font-size: 1.1em !important;
                font-weight: bold !important;
                color: var(--ym-text-main) !important;
                text-shadow: 0 1px 2px rgba(0,0,0,0.65) !important;
                line-height: 1.3 !important;
                display: -webkit-box;
                -webkit-line-clamp: 2;
                -webkit-box-orient: vertical;
                overflow: hidden;
            }

            .card--collection-btn .card__view, 
            .card--collection-btn .card__view::after, 
            .card--collection-btn .card__view::before {
                display: none !important;
            }

            .card--history-custom {
                width: 16em !important;
                margin-right: 0.8em !important;
                margin-bottom: 0 !important;
                position: relative;
                cursor: pointer;
                transition: transform 0.2s ease, z-index 0.2s ease;
                z-index: 1;
            }
            
            .card--history-custom .card__view {
                border-radius: 0.8em !important;
                overflow: hidden !important;
                box-shadow: 0 4px 6px rgba(0,0,0,0.3);
            }
            
            .card--history-custom .card-backdrop-overlay {
                position: absolute; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0, 0, 0, 0.4); pointer-events: none; border-radius: 0.8em !important; z-index: 1;
            }
            
            .card--history-custom.focus { z-index: 99 !important; transform: scale(1.06); }
            .card--history-custom.focus .card__view { box-shadow: 0 10px 25px rgba(0,0,0,0.9) !important; border: 2px solid var(--ym-focus) !important; outline: none !important; }
            .card--history-custom.focus .card__view::after, .card--history-custom.focus .card__view::before { display: none !important; content: none !important; }

            .card--history-custom > div:not(.card__view) { display: none !important; }

            .card--history-custom .card-badge-age { border-radius: 0 0 0 0.8em !important; }
            .card--history-custom .card__vote { border-radius: 0.8em 0 0 0 !important; } 
            .card--history-custom .card__type { border-radius: 0 0 0.8em 0 !important; }  
            .card--history-custom .card__ua_flag { border-radius: 0 0.8em 0 0 !important; }

            .card--history-custom .card-custom-logo-text { font-size: 1.2em !important; padding: 0 0.5em; }

            @media (min-width: 2200px) {
                .card--wide-custom { width: 28em !important; }
                .card--history-custom { width: 18em !important; }
                .card--collection-btn { width: 18em !important; height: 8em !important; }
                .title-btn-text { font-size: 1.45em !important; }
            }

            @media (max-width: 1599px) {
                .card--wide-custom { width: 22em !important; }
                .card--history-custom { width: 14.5em !important; }
                .card--collection-btn { width: 14.2em !important; height: 6.8em !important; }
                .title-btn-text { font-size: 1.2em !important; }
            }

            @media (max-width: 1199px) {
                .card--title-btn { padding: 0.45em 0.95em !important; }
                .title-btn-text { font-size: 1.12em !important; }
                .card--wide-custom { width: 19em !important; }
                .card--history-custom { width: 12.8em !important; }
                .card--collection-btn { width: 12.3em !important; height: 5.9em !important; }
                .custom-title-bottom { font-size: 1.02em !important; }
                .custom-overview-bottom { font-size: 0.8em !important; }
            }

            @media (max-width: 767px) {
                .card--title-btn { padding: 0.42em 0.7em !important; border-radius: 0.9em !important; }
                .title-btn-text { font-size: 0.98em !important; line-height: 1.18 !important; }
                .title-btn-icon { height: 0.9em !important; margin-right: 0.4em !important; }
                .card--wide-custom { width: 15.8em !important; }
                .card--history-custom { width: 10.6em !important; }
                .card--collection-btn { width: 10.4em !important; height: 5.1em !important; padding: 0.7em !important; }
                .card--collection-btn .collection-title { font-size: 0.95em !important; }
                .card-custom-logo-text { font-size: 1.45em !important; }
                .card__vote, .card-badge-age, .card__type.card__type--season { font-size: 0.9em !important; }
            }

            @media (hover: none), (pointer: coarse) {
                .card--title-btn.focus, .card--collection-btn.focus { transform: scale(1.01) !important; }
                .card--wide-custom.focus, .card--history-custom.focus { transform: scale(1.03) !important; }
            }
        `;
        document.head.appendChild(style);
        applyUiPreferences();

        if (Lampa.Storage && Lampa.Storage.listener && typeof Lampa.Storage.listener.follow === 'function') {
            Lampa.Storage.listener.follow('change', function (e) {
                if (!e || !e.name) return;
                if (e.name === 'ym_contrast_mode' || e.name === 'ym_lite_mode' || e.name === 'ym_safe_area' || e.name === 'ym_season_badge_style') {
                    applyUiPreferences();
                }
                if (e.name === 'ym_show_season_badge' && !asBool(Lampa.Storage.get('ym_show_season_badge', false), false)) {
                    clearAllVisibleSeasonBadges();
                }
            });
        }

        Lampa.Listener.follow('line', function (e) {
            if (e.type === 'create' && e.data && e.line && e.line.render) {
                var el = e.line.render();
                if (e.data.uas_title_row) el.attr('data-uas-title-row', 'true');
                if (e.data.uas_content_row) el.attr('data-uas-content-row', 'true');
            }
        });

        var initialFocusHandled = true; 

        Lampa.Listener.follow('activity', function (e) {
            if (e.type === 'start') {
                initialFocusHandled = false;
            }
        });

        Lampa.Listener.follow('controller', function (e) {
            if (e.type !== 'focus') return;

            var target = $(e.target);
            if (target.length && (target.hasClass('card--wide-custom') || target.hasClass('card--history-custom'))) {
                ensureCardLogo(target[0]);
            }

            if (!initialFocusHandled) {
                initialFocusHandled = true;
                if (target.hasClass('card--title-btn')) {
                    setTimeout(function() {
                        Lampa.Controller.move('down');
                    }, 20);
                }
            }
        });

        var CardMaker = Lampa.Maker.map('Card');
        var originalOnVisible = CardMaker.Card.onVisible;

        // Розширює нативний onVisible картки додатковими бейджами та оверлеями.
        CardMaker.Card.onVisible = function () {
            originalOnVisible.apply(this, arguments);
            var cardInstance = this;
            var html = this.html;
            var data = this.data;
            if (!html || !data) return;

            if (data.is_title_btn || data.is_collection_btn) return;

            var isWideCard = html.classList.contains('card--wide-custom') || $(html).hasClass('card--wide-custom');
            var isHistoryCard = html.classList.contains('card--history-custom') || $(html).hasClass('card--history-custom');
            var isSpecialCard = isWideCard || isHistoryCard;
            var isFocused = html.classList.contains('focus') || $(html).hasClass('focus');

            var view = html.querySelector('.card__view');
            if (view && data) {
                var ageBadge = view.querySelector('.card-badge-age');
                if (!ageBadge) {
                    var yearStr = (data.release_date || data.first_air_date || '').toString().substring(0, 4);
                    if (yearStr && yearStr.length === 4) {
                        ageBadge = document.createElement('div');
                        ageBadge.className = 'card-badge-age';
                        ageBadge.innerText = yearStr;
                        view.appendChild(ageBadge);
                    }
                }
            }

            var vote = html.getElementsByClassName('card__vote');
            if (vote.length > 0) {
                var color = getColor(parseFloat(vote[0].textContent.trim()), 0.8);
                if (color) vote[0].style.backgroundColor = color;
            }

            // Ліниве завантаження логотипів: рендер лише для кастомних карток у фокусі.
            if (isSpecialCard && isFocused) ensureCardLogo(html);

            var showFlag = asBool(Lampa.Storage.get('uas_show_flag'), true);

            if (showFlag && data.id && !isSpecialCard) {
                var oldFlag = html.querySelector('.card__ua_flag');
                if (oldFlag) oldFlag.remove();

                var meta = createMediaMeta(data);
                if (meta) {
                    var cached = lmeCache.get(meta.cacheKey);
                    if (cached === true) renderFlag(html);
                    else if (cached !== false) {
                        loadFlag(meta).then(function (isSuccess) {
                            if (isSuccess && cardInstance.html.parentNode) renderFlag(cardInstance.html);
                        });
                    }
                }
            } else if (!showFlag && !isSpecialCard) {
                var oldFlag = html.querySelector('.card__ua_flag');
                if (oldFlag) oldFlag.remove();
            }

            var showSeasonBadge = asBool(Lampa.Storage.get('ym_show_season_badge', false), false);
            // Бейдж сезону опційний, бо додає додаткові TMDB-запити для видимих TV-карток.
            if (showSeasonBadge && (data.media_type === 'tv' || data.name || data.number_of_seasons) && data.id) {
                fetchSeriesData(data.id).then(function(tmdbData) {
                    if (cardInstance.html.parentNode && cardInstance.data === data) {
                        renderSeasonBadge(cardInstance.html, tmdbData);
                    }
                }).catch(function(){});
            } else {
                // Для перевикористаних DOM-вузлів: прибираємо застарілий бейдж на не-TV картках.
                clearSeasonBadges(html);
            }
        };

        overrideApi();
    }

    if (window.appready) start();
    else Lampa.Listener.follow('app', function (e) { if (e.type === 'ready') start(); });

})();
