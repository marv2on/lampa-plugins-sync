(function () {
    'use strict';

    if (typeof Lampa === 'undefined') return;

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
        { id: 'ym_row_collections', title: 'Підбірки', defOrder: '4', default: true },
        { id: 'ym_row_kinobaza', title: 'Новинки Стрімінгів UA', defOrder: '5', default: true },
        { id: 'ym_row_community', title: 'Приховані геми LME', defOrder: '6', default: true },
        { id: 'ym_row_movies_watch', title: 'Популярні фільми', defOrder: '7', default: true },
        { id: 'ym_row_series_pop', title: 'Популярні серіали', defOrder: '8', default: true },
        { id: 'ym_row_random', title: 'Випадкові фільми', defOrder: '9', default: true }
    ];

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

    function fetchCommunityWatches(url) {
        return new Promise(function(resolve, reject) {
            if (window.Lampa && Lampa.Network) {
                Lampa.Network.silent(url, function(json) {
                    resolve(json);
                }, function(err) {
                    reject(err);
                });
            } else {
                safeFetch(url).then(r=>r.json()).then(resolve).catch(reject);
            }
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

    function renderSeasonBadge(cardHtml, tmdbData) {
        if (!tmdbData || !tmdbData.last_episode_to_air) return;
        var last = tmdbData.last_episode_to_air;
        var currentSeason = tmdbData.seasons.filter(function(s) { return s.season_number === last.season_number; })[0];
        
        if (currentSeason && last.season_number > 0) {
            var isComplete = currentSeason.episode_count > 0 && last.episode_number >= currentSeason.episode_count;
            var text = isComplete ? "S" + last.season_number : "S" + last.season_number + " " + last.episode_number + "/" + currentSeason.episode_count;
            
            var typeBadge = cardHtml.querySelector('.card__type');
            if (!typeBadge) {
                var view = cardHtml.querySelector('.card__view');
                if (!view) return;
                typeBadge = document.createElement('div');
                typeBadge.className = 'card__type';
                view.appendChild(typeBadge);
            }
            var bgColor = isComplete ? 'rgba(46, 204, 113, 0.8)' : 'rgba(170, 20, 20, 0.8)';
            typeBadge.innerHTML = text;
            typeBadge.classList.add('card__type--season');
            typeBadge.style.backgroundColor = bgColor;
            typeBadge.style.display = 'flex';
        }
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

    function extractUaserialsCollections(html) {
        let doc = new DOMParser().parseFromString(html, "text/html");
        let results =[];
        let seen = {};
        
        doc.querySelectorAll('a[href*="/collections/"]').forEach(a => {
            let href = a.getAttribute('href');
            if (href && href.match(/\/collections\/\d+/) && !href.includes('/page/')) {
                let fullUrl = href.startsWith('http') ? href : 'https://uaserials.com' + href;
                
                let title = '';
                let img = a.querySelector('img');
                if (img) title = img.getAttribute('alt') || '';
                
                if (!title) title = a.textContent.trim();
                
                if (!title) {
                    let parent = a.closest('.short, .collection-item, article');
                    if (parent) {
                        let titleEl = parent.querySelector('.short-title, .title, .name, h2, h3, .collection-title');
                        if (titleEl) title = titleEl.textContent.trim();
                    }
                }
                
                title = title.replace(/[\n\r]+/g, ' ').replace(/\s*\d+\s*$/, '').trim();
                
                if (title && title.length > 2 && !seen[fullUrl]) {
                    seen[fullUrl] = true;
                    results.push({ title: title, url: fullUrl });
                }
            }
        });
        return results;
    }

    function extractKinobazaItems(html) {
        let doc = new DOMParser().parseFromString(html, "text/html");
        let results =[];
        let seen = {};

        doc.querySelectorAll('h4.text-muted.h6.d-inline-block').forEach(h4 => {
            let enTitle = h4.textContent.trim();
            let parent = h4.parentElement;
            let small = null;
            let container = parent;
            
            for (let i = 0; i < 5; i++) {
                if (!container || container.tagName === 'BODY') break;
                small = container.querySelector('small.text-muted');
                if (small && small.textContent.match(/\(\d{4}\)/)) break;
                small = null;
                container = container.parentElement;
            }
            let yearMatch = small ? small.textContent.match(/\((\d{4})\)/) : null;
            let year = yearMatch ? yearMatch[1] : null;
            
            let searchContext = container ? container.textContent : (parent ? parent.textContent : "");
            let isTv = /Серіал|сезон|епізод|Мінісеріал/i.test(searchContext);
            let expectedType = isTv ? 'tv' : 'movie';
            
            let key = enTitle + year + expectedType;
            if (enTitle && year && !seen[key]) {
                seen[key] = true;
                results.push({ title: enTitle, year: year, type: expectedType });
            }
        });

        if (results.length === 0) {
            doc.querySelectorAll('a[href^="/titles/"]').forEach(a => {
                let title = a.textContent.trim();
                if (title.length > 1) {
                    let year = null;
                    let parent = a.parentElement;
                    let container = parent;
                    for (let i = 0; i < 4; i++) {
                        if (!container || container.tagName === 'BODY') break;
                        let text = container.textContent;
                        let yearMatch = text.match(/(?:^|\s|\()((?:19|20)\d{2})(?:\)|\s|$)/);
                        if (yearMatch) {
                            year = yearMatch[1];
                            break;
                        }
                        container = container.parentElement;
                    }
                    
                    if (!year) {
                        let hrefMatch = a.getAttribute('href').match(/(?:19|20)\d{2}/);
                        if (hrefMatch) year = hrefMatch[0];
                    }

                    let searchContext = container ? container.textContent : (parent ? parent.textContent : "");
                    let isTv = /Серіал|сезон|епізод|Мінісеріал/i.test(searchContext);
                    let expectedType = isTv ? 'tv' : 'movie';

                    if (year) {
                        let key = title + year + expectedType;
                        if (!seen[key]) {
                            seen[key] = true;
                            results.push({ title: title, year: year, type: expectedType });
                        }
                    }
                }
            });
        }

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
        let results = new Array(items.length);
        let index = 0;
        async function worker() {
            while (index < items.length) {
                let currentIndex = index++;
                try {
                    let res = await processFn(items[currentIndex]);
                    if (res) results[currentIndex] = res;
                } catch (e) {}
            }
        }
        let workers =[];
        for (let i = 0; i < concurrency; i++) workers.push(worker());
        await Promise.all(workers);
        return results.filter(Boolean);
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

    async function searchTmdbByTitleAndYear(title, year, expectedType) {
        let cacheKey = 'kinobaza_search_' + title + '_' + year + '_' + (expectedType || 'any');
        if (tmdbItemCache[cacheKey]) return tmdbItemCache[cacheKey];

        let endpointsToTry =[];
        if (expectedType === 'tv') endpointsToTry.push('search/tv', 'search/multi');
        else if (expectedType === 'movie') endpointsToTry.push('search/movie', 'search/multi');
        else endpointsToTry.push('search/multi');

        for (let path of endpointsToTry) {
            let endpoint = getTmdbEndpoint(`${path}?query=${encodeURIComponent(title)}&language=uk`);
            try {
                let data = await fetch(PROXIES[0] + endpoint).then(r => r.json());
                if (data && data.results && data.results.length > 0) {
                    
                    let res = data.results.find(r => {
                        if (expectedType && r.media_type && r.media_type !== expectedType && path === 'search/multi') return false;
                        let rYear = (r.release_date || r.first_air_date || '').substring(0, 4);
                        return rYear === year || rYear === (parseInt(year)-1).toString() || rYear === (parseInt(year)+1).toString();
                    }); 

                    if (!res) {
                        res = data.results.find(r => {
                            if (expectedType && r.media_type && r.media_type !== expectedType && path === 'search/multi') return false;
                            let t1 = (r.original_title || r.original_name || '').toLowerCase();
                            let t2 = title.toLowerCase();
                            return t1 === t2;
                        });
                    }

                    if (res) {
                        if (!res.overview || res.overview.trim() === '') {
                            let enEndpoint = getTmdbEndpoint(`${path}?query=${encodeURIComponent(title)}&language=en`);
                            let enData = await fetch(PROXIES[0] + enEndpoint).then(r => r.json());
                            let enRes = (enData.results ||[]).find(r => r.id === res.id);
                            if (enRes && enRes.overview) res.overview = enRes.overview;
                        }
                        if (!res.media_type) res.media_type = expectedType || (res.first_air_date ? 'tv' : 'movie');
                        tmdbItemCache[cacheKey] = res;
                        return res;
                    }
                }
            } catch(e) {}
        }
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

    async function fetchKinobazaCatalog(url, limit, noCache = false) {
        if (!noCache && listCache[url]) return listCache[url];
        let html = await fetchHtml(url);
        let items = extractKinobazaItems(html);
        
        let tmdbItems = await processInQueue(items, async (item) => {
            return await searchTmdbByTitleAndYear(item.title, item.year, item.type);
        }, 5);

        let unique = {};
        let finalItems = tmdbItems.filter(item => {
            if (!item || !item.id || !item.backdrop_path) return false;
            if (unique[item.id]) return false;
            unique[item.id] = true;
            return true;
        });

        if (limit) finalItems = finalItems.slice(0, limit);

        if (!noCache && finalItems.length > 0) listCache[url] = finalItems;
        return finalItems;
    }

    async function getLmeTmdbItems(items) {
        let promises = items.map(async (item) => {
            if(!item) return null;
            
            let type, id;
            if (item.id && typeof item.id === 'string' && item.id.includes(':')) {
                let parts = item.id.split(':');
                type = parts[0];
                id = parts[1];
            } else if (item.source_id && item.type) {
                type = item.type;
                id = item.source_id;
            } else if (item.id && (item.media_type || item.type)) {
                type = item.media_type || item.type;
                id = item.id;
            } else {
                return null;
            }

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

    function fetchLogo(movie, itemElement) {
        var mType = movie.media_type || (movie.name ? 'tv' : 'movie');
        var langPref = Lampa.Storage.get('ym_logo_lang', 'uk_en');
        var quality = Lampa.Storage.get('ym_img_quality', 'w300');
        
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

        if (langPref === 'text_uk' || langPref === 'text_en') {
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
                img.onload = function() { itemElement.find('.card__view').append(img); };
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

                        var iconHtml = iconUrl ? '<img src="' + iconUrl + '" class="title-btn-icon" onerror="this.style.display=\'none\'" />' : '';
                        item.append('<div class="title-btn-text">' + iconHtml + title + '</div>');
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

                        item.append('<div class="collection-title">' + collection.title + '</div>');
                    },
                    onlyEnter: function () {
                        Lampa.Activity.push({
                            url: collection.url,
                            title: collection.title,
                            component: 'category_full',
                            page: 1,
                            source: 'uas_pro_source',
                            is_uas_collection: true
                        });
                    }
                }
            }
        };
    }

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

    function makeHistoryButtonCardItem(bgUrl) {
        return {
            title: 'Історія',
            is_title_btn: true,
            params: {
                createInstance: function () {
                    return Lampa.Maker.make('Card', { title: 'Історія' }, function (module) { return module.only('Card', 'Callback'); });
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
                            '<svg style="width: 35%; height: 35%; margin-bottom: 0.5em; filter: drop-shadow(0px 2px 4px rgba(0,0,0,0.8)); color: #fff;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>' +
                            '<div style="font-size: 1.1em; font-weight: bold; text-shadow: 0px 2px 4px rgba(0,0,0,0.8); text-align: center; color: #fff;">Історія</div>' +
                            '</div>');
                    },
                    onlyEnter: function () {
                        Lampa.Activity.push({
                            title: 'Історія переглядів',
                            component: 'favorite',
                            type: 'history',
                            source: 'tmdb',
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

                        fetchLogo(movie, item);
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

                        fetchLogo(movie, item);

                        var descText = movie.overview || 'Опис відсутній.';
                        item.append('<div class="custom-title-bottom">' + (movie.title || movie.name) + '</div>');
                        item.append('<div class="custom-overview-bottom">' + descText + '</div>');
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
        
        let randFavImg = '';
        try {
            let favItems =[];
            if (allFavs.book) favItems = favItems.concat(allFavs.book);
            if (allFavs.like) favItems = favItems.concat(allFavs.like);
            
            let validFavs = favItems.filter(item => item && (item.backdrop_path || item.poster_path));
            if (validFavs.length > 0) {
                let randItem = validFavs[Math.floor(Math.random() * validFavs.length)];
                let quality = Lampa.Storage.get('ym_img_quality', 'w300');
                let imgUrlPath = randItem.backdrop_path || randItem.poster_path;
                randFavImg = imgUrlPath ? (PROXIES[0] + Lampa.TMDB.image('t/p/' + quality + imgUrlPath)) : '';
            }
        } catch(e) {}

        let randHistImg = '';
        try {
            let validHist = (allFavs.history ||[]).filter(item => item && (item.backdrop_path || item.poster_path));
            if (validHist.length > 0) {
                let randItem = validHist[Math.floor(Math.random() * validHist.length)];
                let quality = Lampa.Storage.get('ym_img_quality', 'w300');
                let imgUrlPath = randItem.backdrop_path || randItem.poster_path;
                randHistImg = imgUrlPath ? (PROXIES[0] + Lampa.TMDB.image('t/p/' + quality + imgUrlPath)) : '';
            }
        } catch(e) {}

        let showFav = Lampa.Storage.get('uas_show_fav_card');
        if (showFav === null || showFav === undefined || showFav === '' || showFav === true || showFav === 'true') {
            results.push(makeFavoriteCardItem(randFavImg));
        }

        let showHistBtn = Lampa.Storage.get('uas_show_history_btn');
        if (showHistBtn === null || showHistBtn === undefined || showHistBtn === '' || showHistBtn === true || showHistBtn === 'true') {
            results.push(makeHistoryButtonCardItem(randHistImg));
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

    async function loadUaserialsCollectionsRow(urlId, loadUrl, title, callback) {
        try {
            let html = await fetchHtml(loadUrl);
            let items = extractUaserialsCollections(html);
            
            items.sort(() => 0.5 - Math.random());
            let mapped = items.slice(0, 7).map(makeCollectionButtonItem);
            
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

    async function loadRandomMoviesRow(callback) {
        try {
            let baseRandomUrl = 'https://kinobaza.com.ua/titles?q=&search_type=&order_by=random&display=&user_rated_year=0&user_seen_year=0&type=&tv_status=&ys=&ye=&rating=1&rating_max=10&votes=&imdb_rating=7&imdb_rating_max=10&imdb_votes=5000&metacritic_min=&metacritic_max=&tomato_min=&tomato_max=&age_min=&age_max=&per_page=30&distributor=&translated=has_ukr_audio';
            let fetchUrl = baseRandomUrl + '&_t=' + Date.now();
            
            let movies = await fetchKinobazaCatalog(fetchUrl, 5, true); 
            
            callback({ 
                results: movies.map(makeWideCardItem), 
                title: '', 
                uas_content_row: true,
                params: { items: { mapping: 'line', view: 5 } } 
            });
        } catch(e) { callback({ results:[] }); }
    }

    function getOrCreateLoadingToast() {
        let toast = document.getElementById('uas-loading-toast');
        if (!toast) {
            toast = document.createElement('div');
            toast.id = 'uas-loading-toast';
            toast.innerText = 'Завантаження нових карток...';
            toast.style.cssText = 'display:none; position:fixed; bottom:30px; left:50%; transform:translateX(-50%); background:rgba(40,40,40,0.95); color:#fff; padding:12px 24px; border-radius:8px; z-index:99999; font-size:1.2em; font-weight:bold; pointer-events:none; box-shadow: 0 4px 10px rgba(0,0,0,0.5); opacity:0; transition: opacity 0.3s ease;';
            document.body.appendChild(toast);
        }
        return toast;
    }

    function showLoadingToast() {
        let toast = getOrCreateLoadingToast();
        toast.style.display = 'block';
        void toast.offsetWidth; 
        toast.style.opacity = '1';
    }

    function hideLoadingToast() {
        let toast = getOrCreateLoadingToast();
        toast.style.opacity = '0';
        setTimeout(() => {
            if (toast.style.opacity === '0') toast.style.display = 'none';
        }, 300);
    }

    async function fetchPageData(targetPage, baseUrl, isLME, isKinobazaOnline, isUasCollection, isUasCollectionsList, params) {
        let pageMapped =[];
        let pageTotal = 50;

        if (isLME) {
            let listUrl = `https://wh.lme.isroot.in/v2/top?period=7d&top=asc&min_rating=7&per_page=20&page=${targetPage}`;
            let res = await fetchCommunityWatches(listUrl).catch(()=>({items:[]}));
            let items = Array.isArray(res) ? res : (res.items ||[]);
            pageTotal = res.total_pages || 10;
            pageMapped = await getLmeTmdbItems(items); 
        } else if (isUasCollectionsList) {
            if (targetPage > 1) {
                return { mapped:[], total: 1 };
            }
            let listUrl = baseUrl;
            if (listCache[listUrl]) {
                pageMapped = listCache[listUrl];
            } else {
                let html = await fetchHtml(listUrl);
                let items = extractUaserialsCollections(html);
                pageMapped = items.map(makeCollectionButtonItem);
                if (pageMapped.length > 0) listCache[listUrl] = pageMapped;
            }
            pageTotal = 1;
        } else if (isUasCollection) {
            let listUrl = params.url;
            if (targetPage > 1) {
                if (listUrl.endsWith('.html')) {
                    listUrl = listUrl.replace('.html', '/page/' + targetPage + '/');
                } else {
                    listUrl = listUrl.replace(/\/$/, '') + '/page/' + targetPage + '/';
                }
            }
            if (listCache[listUrl]) {
                pageMapped = listCache[listUrl];
            } else {
                let items = await fetchCatalogPage(listUrl, 20);
                pageMapped = items; 
                if (pageMapped.length > 0) listCache[listUrl] = pageMapped;
            }
        } else if (isKinobazaOnline) {
            let listUrl = baseUrl + targetPage;
            let items = await fetchKinobazaCatalog(listUrl, 30);
            pageMapped = items;
        } else {
            let listUrl = targetPage === 1 ? baseUrl : `${baseUrl}page/${targetPage}/`;
            let items = await fetchCatalogPage(listUrl, 20); 
            pageMapped = items; 
        }

        return { mapped: pageMapped, total: pageTotal };
    }

    Lampa.Api.sources.uas_pro_source = {
        list: async function (params, oncomplete, onerror) {
            let requestedPage = params.page || 1;
            let baseUrl = '';
            let isLME = false;
            let isKinobazaOnline = false;
            let isUasCollection = params.is_uas_collection;
            let isUasCollectionsList = false;

            if (params.url === 'uas_movies_new') baseUrl = 'https://uaserials.com/films/p/';
            else if (params.url === 'uas_movies_pop') baseUrl = 'https://uaserials.my/filmss/w/';
            else if (params.url === 'uas_series_new') baseUrl = 'https://uaserials.com/series/p/';
            else if (params.url === 'uas_series_pop') baseUrl = 'https://uaserials.com/series/w/';
            else if (params.url === 'kinobaza_streaming') {
                baseUrl = 'https://kinobaza.com.ua/online?q=&search_type=&order_by=date_desc&display=&user_rated_year=0&user_seen_year=0&type=&tv_status=&ys=&ye=&rating=1&rating_max=10&votes=&imdb_rating=1&imdb_rating_max=10&imdb_votes=&metacritic_min=&metacritic_max=&tomato_min=&tomato_max=&age_min=&age_max=&per_page=30&distributor=&translated=has_ukr_audio&page=';
                isKinobazaOnline = true;
            }
            else if (params.url === 'uas_collections_list') {
                isUasCollectionsList = true;
                baseUrl = 'https://uaserials.com/collections/';
            }
            else if (params.url === 'uas_community') isLME = true;
            else if (!isUasCollection) return onerror();

            if (requestedPage > 1) {
                showLoadingToast();
            }

            try {
                let mapped =[];
                let totalPages = 50; 

                async function fetchSafe(targetPage) {
                    try {
                        return await fetchPageData(targetPage, baseUrl, isLME, isKinobazaOnline, isUasCollection, isUasCollectionsList, params);
                    } catch(e) {
                        return { mapped:[], total: 50 };
                    }
                }

                if (requestedPage === 1) {
                    let[res1, res2] = await Promise.all([ fetchSafe(1), fetchSafe(2) ]);
                    mapped = res1.mapped.concat(res2.mapped);
                    totalPages = res1.total; 
                } else {
                    let res = await fetchSafe(requestedPage + 1);
                    mapped = res.mapped;
                    totalPages = res.total;
                }

                if (requestedPage > 1) hideLoadingToast();

                if (mapped.length > 0) {
                    oncomplete({
                        results: mapped,
                        page: requestedPage,
                        total_pages: totalPages
                    });
                } else { 
                    onerror(); 
                }
            } catch (e) { 
                if (requestedPage > 1) hideLoadingToast();
                onerror(); 
            }
        }
    };

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

        Lampa.SettingsApi.addParam({
            component: 'ymainpage',
            param: { name: 'uas_show_history_btn', type: 'trigger', default: true },
            field: { name: 'Картка "Історія" в історії', description: 'Показувати швидкий доступ до Історії поруч із Обраним' }
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

    function overrideApi() {
        Lampa.Api.sources.tmdb.main = function (params, oncomplite, onerror) {
            var rowDefs =[
                { id: 'ym_row_history', defOrder: 1, type: 'history', url: '', title: 'Історія перегляду', icon: '' },
                { id: 'ym_row_movies_new', defOrder: 2, type: 'uas', url: 'uas_movies_new', loadUrl: 'https://uaserials.com/films/p/', title: 'Новинки фільмів', icon: 'https://upload.wikimedia.org/wikipedia/commons/5/51/Ukraine_film_clapperboard.svg' },
                { id: 'ym_row_series_new', defOrder: 3, type: 'uas', url: 'uas_series_new', loadUrl: 'https://uaserials.com/series/p/', title: 'Новинки серіалів', icon: 'https://upload.wikimedia.org/wikipedia/commons/3/3a/Mplayer.svg' },
                { id: 'ym_row_collections', defOrder: 4, type: 'uas_collections', url: 'uas_collections_list', loadUrl: 'https://uaserials.com/collections/', title: 'Підбірки', icon: 'https://upload.wikimedia.org/wikipedia/commons/e/ef/Film-award-stub.svg' },
                { id: 'ym_row_kinobaza', defOrder: 5, type: 'kinobaza', url: 'kinobaza_streaming', loadUrl: 'https://kinobaza.com.ua/online?q=&search_type=&order_by=date_desc&display=&user_rated_year=0&user_seen_year=0&type=&tv_status=&ys=&ye=&rating=1&rating_max=10&votes=&imdb_rating=1&imdb_rating_max=10&imdb_votes=&metacritic_min=&metacritic_max=&tomato_min=&tomato_max=&age_min=&age_max=&per_page=30&distributor=&translated=has_ukr_audio&page=', title: 'Новинки Стрімінгів UA', icon: 'https://upload.wikimedia.org/wikipedia/commons/a/a5/Netflix_meaningful_logo.svg' },
                { id: 'ym_row_community', defOrder: 6, type: 'community', url: 'uas_community', title: 'Приховані геми LME', icon: 'https://upload.wikimedia.org/wikipedia/commons/b/b2/Anime_eye_film.png' },
                { id: 'ym_row_movies_watch', defOrder: 7, type: 'uas', url: 'uas_movies_pop', loadUrl: 'https://uaserials.my/filmss/w/', title: 'Популярні фільми', icon: 'https://upload.wikimedia.org/wikipedia/commons/7/7e/Filmreel-icon.svg' },
                { id: 'ym_row_series_pop', defOrder: 8, type: 'uas', url: 'uas_series_pop', loadUrl: 'https://uaserials.com/series/w/', title: 'Популярні серіали', icon: 'https://upload.wikimedia.org/wikipedia/commons/f/f6/Tvfilm.svg' },
                { id: 'ym_row_random', defOrder: 9, type: 'random', url: '', title: 'Випадкові фільми', icon: 'https://upload.wikimedia.org/wikipedia/commons/a/a3/Magicfilm_icon.svg' }
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
                    else if (def.type === 'uas_collections') loadUaserialsCollectionsRow(def.url, def.loadUrl, def.title, cb);
                    else if (def.type === 'community') loadCommunityGemsRow(cb);
                    else if (def.type === 'random') loadRandomMoviesRow(cb);
                });
            });

            if(parts_data.length === 0) {
                parts_data.push((cb) => loadRow('uas_movies_new', 'https://uaserials.com/films/p/', 'Новинки фільмів', cb));
            }

            Lampa.Api.partNext(parts_data, 2, oncomplite, onerror);
        };
    }

    function start() {
        if (window.uaserials_pro_v8_loaded) return;
        window.uaserials_pro_v8_loaded = true;

        if (!Lampa.Storage.get('ym_rows_init_v8_fix_8')) {
            Lampa.Storage.set('ym_rows_init_v8_fix_8', true);
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

            let shb = Lampa.Storage.get('uas_show_history_btn');
            if (shb === null || shb === undefined || shb === '') Lampa.Storage.set('uas_show_history_btn', true);
        }

        lmeCache = new Cache(CONFIG.cache);
        lmeCache.init();

        createSettings();

        var style = document.createElement('style');
        style.innerHTML = `
            .card .card__age { display: none !important; }

            .card__view .card-badge-age { 
                display: block !important; right: 0 !important; top: 0 !important; padding: 0.2em 0.45em !important; 
                background: rgba(0, 0, 0, 0.6) !important; 
                position: absolute !important; margin-top: 0 !important; font-size: 1.1em !important; 
                z-index: 10 !important; color: #fff !important; font-weight: bold !important;
            }

            .card--wide-custom { width: 25em !important; margin-right: 0.2em !important; margin-bottom: 0 !important; position: relative; cursor: pointer; transition: transform 0.2s ease, z-index 0.2s ease; z-index: 1; }
            
            .card--wide-custom .card__view { border-radius: 0.4em !important; overflow: hidden !important; box-shadow: 0 3px 6px rgba(0,0,0,0.5); }
            .card--wide-custom .card-backdrop-overlay { position: absolute; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0, 0, 0, 0.5); pointer-events: none; border-radius: 0.4em !important; z-index: 1; }
            
            .card--wide-custom.focus { z-index: 99 !important; transform: scale(1.08); }
            .card--wide-custom.focus .card__view { box-shadow: 0 10px 25px rgba(0,0,0,0.9) !important; border: 3px solid #fff !important; outline: none !important; }
            .card--wide-custom.focus .card__view::after, .card--wide-custom.focus .card__view::before { display: none !important; content: none !important; }

            .card-custom-logo { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 70% !important; height: 70% !important; max-width: 70% !important; max-height: 70% !important; padding: 0 !important; margin: 0 !important; object-fit: contain; z-index: 5; filter: drop-shadow(0px 3px 5px rgba(0,0,0,0.8)); pointer-events: none; transition: filter 0.3s ease; }
            
            .card-custom-logo-text { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 80%; max-height: 70%; text-align: center; font-size: 2em; font-weight: 600; color: #fff; text-shadow: none !important; z-index: 5; pointer-events: none; word-wrap: break-word; white-space: normal; line-height: 1.2; font-family: sans-serif; display: flex; align-items: center; justify-content: center; }

            .card--wide-custom > div:not(.card__view):not(.custom-title-bottom):not(.custom-overview-bottom) { display: none !important; }
            .custom-title-bottom { width: 100%; text-align: left; font-size: 1.1em; font-weight: bold; margin-top: 0.3em; color: #fff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; padding: 0 0.2em; }
            .custom-overview-bottom { width: 100%; text-align: left; font-size: 0.85em; color: #bbb; line-height: 1.2; margin-top: 0.2em; padding: 0 0.2em; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; white-space: normal; }
            
            .card__vote { right: 0 !important; bottom: 0 !important; padding: 0.2em 0.45em !important; z-index: 2; position: absolute !important; font-weight: bold; background: rgba(0,0,0,0.6); }
            .card__type { position: absolute !important; left: 0 !important; top: 0 !important; width: auto !important; height: auto !important; line-height: 1 !important; padding: 0.3em !important; background: rgba(0, 0, 0, 0.5) !important; display: flex !important; align-items: center; justify-content: center; z-index: 2; color: #fff !important; transition: background 0.3s !important; }
            .card__type svg { width: 1.5em !important; height: 1.5em !important; }
            .card__type.card__type--season { font-size: 1.1em !important; font-weight: bold !important; padding: 0.2em 0.45em !important; font-family: Roboto, Arial, sans-serif !important; }
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

            .card--title-btn {
                width: 100vw !important; 
                max-width: 100% !important; 
                height: auto !important;
                background: transparent !important;
                border-radius: 1.5em !important;
                margin: 0.2em 0 !important;
                display: flex !important;
                align-items: center !important;
                justify-content: flex-start !important; 
                padding: 0.5em 1.5em !important; 
                cursor: pointer !important;
                border: 2px solid transparent !important; 
                box-shadow: none !important;
                box-sizing: border-box !important;
                transition: transform 0.2s ease, border 0.2s ease, background 0.2s ease !important;
            }

            .card--title-btn.focus {
                background: rgba(255, 255, 255, 0.05) !important;
                border: 2px solid #fff !important;
                box-shadow: none !important;
                outline: none !important;
                transform: scale(1.01) !important;
            }

            .title-btn-text {
                display: flex !important;
                align-items: center !important;
                font-size: 1.4em !important;
                font-weight: bold !important;
                color: #777 !important; 
                border: none !important; 
                padding: 0 !important;
                line-height: 1.2 !important;
                text-align: left !important;
                transition: color 0.2s ease, transform 0.2s ease !important;
            }

            .title-btn-icon {
                height: 1.1em !important;
                width: auto !important;
                margin-right: 0.5em !important;
                filter: drop-shadow(0px 1px 2px rgba(0,0,0,0.5)) !important;
            }

            .card--title-btn.focus .title-btn-text {
                color: #fff !important; 
                text-shadow: none !important; 
                box-shadow: none !important; 
            }

            .card--title-btn-static {
                cursor: default !important;
            }
            .card--title-btn-static .title-btn-text {
                opacity: 0.5 !important; 
            }

            .card--title-btn .card__view, 
            .card--title-btn .card__view::after, 
            .card--title-btn .card__view::before {
                display: none !important;
            }

            .card--collection-btn {
                width: 16em !important;
                height: 7em !important;
                background: rgba(40,40,40,0.8) !important;
                border-radius: 0.8em !important;
                margin-right: 0.8em !important;
                margin-bottom: 0.8em !important;
                display: flex !important;
                flex-direction: column !important;
                align-items: center !important;
                justify-content: center !important;
                padding: 1em !important;
                cursor: pointer !important;
                border: 2px solid transparent !important;
                box-shadow: 0 4px 6px rgba(0,0,0,0.3) !important;
                transition: transform 0.2s ease, background 0.2s ease, border 0.2s ease !important;
                text-align: center !important;
                box-sizing: border-box !important;
                position: relative;
            }

            .card--collection-btn.focus {
                background: rgba(60,60,60,0.9) !important;
                border: 2px solid #fff !important;
                transform: scale(1.05) !important;
                z-index: 99 !important;
            }

            .card--collection-btn .collection-title {
                font-size: 1.1em !important;
                font-weight: bold !important;
                color: #fff !important;
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
            
            .card--history-custom.focus { z-index: 99 !important; transform: scale(1.08); }
            .card--history-custom.focus .card__view { box-shadow: 0 10px 25px rgba(0,0,0,0.9) !important; border: 2px solid #fff !important; outline: none !important; }
            .card--history-custom.focus .card__view::after, .card--history-custom.focus .card__view::before { display: none !important; content: none !important; }

            .card--history-custom > div:not(.card__view) { display: none !important; }

            .card--history-custom .card-badge-age { border-radius: 0 0 0 0.8em !important; }
            .card--history-custom .card__vote { border-radius: 0.8em 0 0 0 !important; } 
            .card--history-custom .card__type { border-radius: 0 0 0.8em 0 !important; }  
            .card--history-custom .card__ua_flag { border-radius: 0 0.8em 0 0 !important; }

            .card--history-custom .card-custom-logo-text { font-size: 1.2em !important; padding: 0 0.5em; }
        `;
        document.head.appendChild(style);

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
            if (e.type === 'focus' && !initialFocusHandled) {
                initialFocusHandled = true; 
                var target = $(e.target);
                if (target.hasClass('card--title-btn')) {
                    setTimeout(function() {
                        Lampa.Controller.move('down');
                    }, 20); 
                }
            }
        });

        var CardMaker = Lampa.Maker.map('Card');
        var originalOnVisible = CardMaker.Card.onVisible;

        CardMaker.Card.onVisible = function () {
            var html = this.html;
            var data = this.data;
            if (!html || !data) return;

            var cardInstance = this;

            var isWideCard = html.classList && html.classList.contains('card--wide-custom') || $(html).hasClass('card--wide-custom');
            var isHistoryCard = html.classList && html.classList.contains('card--history-custom') || $(html).hasClass('card--history-custom');
            var isTitleBtn = html.classList && html.classList.contains('card--title-btn') || $(html).hasClass('card--title-btn');
            var isCollectionBtn = html.classList && html.classList.contains('card--collection-btn') || $(html).hasClass('card--collection-btn');
            
            var isSpecialCard = isWideCard || isHistoryCard || isTitleBtn || isCollectionBtn || data.is_title_btn || data.is_collection_btn;

            if (!isSpecialCard) {
                originalOnVisible.apply(this, arguments);
            } else {
                this.visible = true; 
            }

            if (isTitleBtn || isCollectionBtn || data.is_title_btn || data.is_collection_btn) return;

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

            var showFlag = Lampa.Storage.get('uas_show_flag');
            if (showFlag === null || showFlag === undefined || showFlag === '') showFlag = true;
            else if (showFlag === 'false') showFlag = false;
            else if (showFlag === 'true') showFlag = true;

            if (showFlag && data.id && !isSpecialCard) {
                var oldFlag = html.querySelector('.card__ua_flag');
                if (oldFlag) oldFlag.remove();

                var meta = createMediaMeta(data);
                if (meta) {
                    var cached = lmeCache.get(meta.cacheKey);
                    if (cached === true) renderFlag(html);
                    else if (cached !== false) {
                        loadFlag(meta).then(function (isSuccess) {
                            if (isSuccess && cardInstance.html && cardInstance.html.parentNode) renderFlag(cardInstance.html);
                        });
                    }
                }
            } else if (!showFlag && !isSpecialCard) {
                var oldFlag = html.querySelector('.card__ua_flag');
                if (oldFlag) oldFlag.remove();
            }

            if ((data.media_type === 'tv' || data.name || data.number_of_seasons) && data.id) {
                fetchSeriesData(data.id).then(function(tmdbData) {
                    if (cardInstance.html && cardInstance.html.parentNode && cardInstance.data === data) {
                        renderSeasonBadge(cardInstance.html, tmdbData);
                    }
                }).catch(function(){});
            }
        };

        overrideApi();
    }

    if (window.appready) start();
    else Lampa.Listener.follow('app', function (e) { if (e.type === 'ready') start(); });

})();