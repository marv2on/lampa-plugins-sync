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
    var inflightRatings = {};

    Lampa.Lang.add({
        main: 'Головна UA',
        title_main: 'Головна UA',
        title_tmdb: 'Головна UA'
    });

    // --- ІКОНКИ ДЛЯ РЕЙТИНГІВ ---
    var mdblistSvg = "data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' width='24' height='24' fill='%23ffffff' style='opacity:1;'%3E%3Cpath d='M1.928.029A2.47 2.47 0 0 0 .093 1.673c-.085.248-.09.629-.09 10.33s.005 10.08.09 10.33a2.51 2.51 0 0 0 1.512 1.558l.276.108h20.237l.277-.108a2.51 2.51 0 0 0 1.512-1.559c.085-.25.09-.63.09-10.33s-.005-10.08-.09-10.33A2.51 2.51 0 0 0 22.395.115l-.277-.109L12.117 0C6.615-.004 2.032.011 1.929.029m7.48 8.067l2.123 2.004v1.54c0 .897-.02 1.536-.043 1.527s-.92-.845-1.995-1.86c-1.071-1.01-1.962-1.84-1.977-1.84s-.024 1.91-.024 4.248v4.25H4.911V6.085h1.188l1.183.006zm9.729 3.93v5.94h-2.63l-.01-4.25l-.013-4.25l-1.907 1.795a367 367 0 0 1-1.98 1.864c-.076.056-.08-.047-.08-1.489v-1.555l2.127-1.995l2.122-1.995l1.187-.005h1.184z'/%3E%3C/svg%3E";
    var rateIcons = {
        imdb: 'https://upload.wikimedia.org/wikipedia/commons/5/53/IMDB_-_SuperTinyIcons.svg',
        rt: 'https://upload.wikimedia.org/wikipedia/commons/5/5b/Rotten_Tomatoes.svg',
        mc: 'https://upload.wikimedia.org/wikipedia/commons/e/e1/Metacritic_logo_Roundel.svg',
        tmdb: 'https://upload.wikimedia.org/wikipedia/commons/8/89/Tmdb.new.logo.svg',
        trakt: 'https://upload.wikimedia.org/wikipedia/commons/3/3d/Trakt.tv-favicon.svg',
        mdblist: mdblistSvg,
        popcorn: 'https://upload.wikimedia.org/wikipedia/commons/d/da/Rotten_Tomatoes_positive_audience.svg',
        letterboxd: 'https://upload.wikimedia.org/wikipedia/commons/9/9b/Letterboxd_2023_logo.png'
    };

    // --- УНІВЕРСАЛЬНИЙ КЕШ НА 7 ДНІВ ---
    var Cache7Days = {
        ttl: 7 * 24 * 60 * 60 * 1000, // 7 днів
        get: function(key) {
            var data = Lampa.Storage.get(key);
            if (data && typeof data === 'object' && data.time) {
                if (Date.now() - data.time < this.ttl) {
                    return data.val;
                }
            }
            return null;
        },
        set: function(key, val) {
            Lampa.Storage.set(key, { val: val, time: Date.now() });
        }
    };

    function cleanOldCaches() {
        setTimeout(function() {
            try {
                var now = Date.now();
                var ttl = 7 * 24 * 60 * 60 * 1000;
                var prefixes = ['logo_uas_v10_', 'poster_clean_v3_', 'ext_ratings_v1_', 'alt_imdb_v1_'];
                
                var keysToRemove = [];
                for (var i = 0; i < localStorage.length; i++) {
                    var key = localStorage.key(i);
                    if (key && prefixes.some(p => key.startsWith(p))) {
                        var data = Lampa.Storage.get(key);
                        if (!data || !data.time || (now - data.time > ttl)) {
                            keysToRemove.push(key);
                        }
                    }
                }
                keysToRemove.forEach(k => {
                    var mem = Lampa.Storage.get('@@', true);
                    if(mem && mem[k]) delete mem[k];
                    localStorage.removeItem(k);
                });
            } catch(e){}
        }, 5000); 
    }

    function getAltDesignType() {
        var t = Lampa.Storage.get('uas_alt_design_type');
        if (t !== null && t !== undefined && t !== '') return String(t);
        var legacy = Lampa.Storage.get('uas_alt_design_enable');
        if (legacy === true || legacy === 'true') return '1';
        return '0';
    }

    function updateDynamicStyles() {
        var altType = getAltDesignType();
        if (altType === '1' || altType === '2') {
            document.body.classList.add('uas-alt-design-active');
            if (altType === '2') {
                document.body.classList.add('uas-alt-design-2');
            } else {
                document.body.classList.remove('uas-alt-design-2');
            }
        } else {
            document.body.classList.remove('uas-alt-design-active');
            document.body.classList.remove('uas-alt-design-2');
        }

        var badgeSize = Lampa.Storage.get('uas_alt_badge_size') || '0.7';
        document.body.style.setProperty('--uas-badge-size', badgeSize + 'em');

        var hideText = Lampa.Storage.get('uas_text_hide');
        if (hideText === true || hideText === 'true') document.body.classList.add('uas-hide-text');
        else document.body.classList.remove('uas-hide-text');

        var textAlign = Lampa.Storage.get('uas_text_align') || 'center';
        document.body.style.setProperty('--uas-text-align', textAlign);

        var descAlign = Lampa.Storage.get('uas_text_desc_align') || 'left';
        document.body.style.setProperty('--uas-desc-align', descAlign);

        var titleSize = Lampa.Storage.get('uas_text_title_size') || '1.1';
        document.body.style.setProperty('--uas-title-size', titleSize + 'em');

        var descSize = Lampa.Storage.get('uas_text_desc_size') || '0.85';
        document.body.style.setProperty('--uas-desc-size', descSize + 'em');

        var bgModeRaw = Lampa.Storage.get('uas_bg_mode');
        var bgMode = (bgModeRaw === null || bgModeRaw === undefined || bgModeRaw === '') ? '1' : String(bgModeRaw);

        if (bgMode === '0') {
            document.body.classList.add('uas-bg-disabled');
        } else {
            document.body.classList.remove('uas-bg-disabled');
        }
        if (bgMode === '2') {
            document.body.classList.add('uas-bg-instant');
        } else {
            document.body.classList.remove('uas-bg-instant');
        }
    }

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

    const ALT_CACHE_NAME = 'uas_alt_images_v1';
    const MAX_CACHE_SIZE_MB = 300;
    const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

    var AltImageCache = {
        index: {},
        supported: ('caches' in window),
        activeBlobUrls: [],
        init: function() {
            try {
                this.index = JSON.parse(Lampa.Storage.get('uas_alt_img_index') || '{}');
                this.cleanup();
            } catch(e) { this.index = {}; }
        },
        saveIndex: debounce(function() {
            Lampa.Storage.set('uas_alt_img_index', JSON.stringify(this.index));
        }, 1000),
        revokeOldBlobs: function() {
            while (this.activeBlobUrls.length > 150) {
                var oldUrl = this.activeBlobUrls.shift();
                try { URL.revokeObjectURL(oldUrl); } catch(e) {}
            }
        },
        cleanup: async function() {
            if (!this.supported) return;
            try {
                let now = Date.now();
                let cache = await caches.open(ALT_CACHE_NAME);
                let keys = Object.keys(this.index);
                let changed = false;

                for (let url of keys) {
                    if (now - this.index[url].time > CACHE_TTL_MS) {
                        await cache.delete(url);
                        delete this.index[url];
                        changed = true;
                    }
                }

                let totalSize = Object.values(this.index).reduce((acc, val) => acc + (val.size || 50000), 0);
                if (totalSize > MAX_CACHE_SIZE_MB * 1024 * 1024) {
                    let sortedKeys = Object.keys(this.index).sort((a, b) => this.index[a].time - this.index[b].time);
                    while (totalSize > MAX_CACHE_SIZE_MB * 1024 * 1024 && sortedKeys.length > 0) {
                        let oldestUrl = sortedKeys.shift();
                        totalSize -= (this.index[oldestUrl].size || 50000);
                        await cache.delete(oldestUrl);
                        delete this.index[oldestUrl];
                        changed = true;
                    }
                }
                if (changed) this.saveIndex();
            } catch(e) {}
        },
        get: async function(url) {
            if (!this.supported || !this.index[url]) return null;
            try {
                let cache = await caches.open(ALT_CACHE_NAME);
                let res = await cache.match(url);
                if (res) {
                    this.index[url].time = Date.now();
                    this.saveIndex();
                    let blob = await res.blob();
                    let objUrl = URL.createObjectURL(blob);
                    this.activeBlobUrls.push(objUrl);
                    this.revokeOldBlobs();
                    return objUrl;
                }
            } catch(e) {}
            return null;
        },
        setAndGet: async function(url) {
            if (!this.supported) return url;
            try {
                let res = await fetch(url);
                if (res.ok) {
                    let clone = res.clone();
                    let blob = await res.blob();
                    let cache = await caches.open(ALT_CACHE_NAME);
                    await cache.put(url, clone);
                    this.index[url] = { time: Date.now(), size: blob.size };
                    this.saveIndex();
                    this.cleanup(); 
                    let objUrl = URL.createObjectURL(blob);
                    this.activeBlobUrls.push(objUrl);
                    this.revokeOldBlobs();
                    return objUrl;
                }
            } catch(e) {}
            return url; 
        }
    };

    var BgManager = {
        container: null,
        layer1: null,
        layer2: null,
        currentLayer: 1,
        activeUrl: '',
        timer: null,
        init: function() {
            if (this.container) return;
            this.container = document.createElement('div');
            this.container.id = 'uas-bg-container';

            this.layer1 = document.createElement('div');
            this.layer1.className = 'uas-bg-layer active';
            this.layer2 = document.createElement('div');
            this.layer2.className = 'uas-bg-layer';

            this.container.appendChild(this.layer1);
            this.container.appendChild(this.layer2);
            document.body.appendChild(this.container);
        },
        change: function(url, instant) {
            var bgModeRaw = Lampa.Storage.get('uas_bg_mode');
            var bgMode = (bgModeRaw === null || bgModeRaw === undefined || bgModeRaw === '') ? '1' : String(bgModeRaw);
            if (bgMode === '0') return; // Якщо вимкнено - взагалі ігноруємо зміну фону

            if (!url || this.activeUrl === url) return;
            
            clearTimeout(this.timer);
            var _this = this;
            
            var execute = function() {
                _this.activeUrl = url;

                var nextLayer = _this.currentLayer === 1 ? _this.layer2 : _this.layer1;
                var activeLayer = _this.currentLayer === 1 ? _this.layer1 : _this.layer2;

                nextLayer.style.backgroundImage = 'url(' + url + ')';
                nextLayer.classList.add('active');
                activeLayer.classList.remove('active');

                _this.currentLayer = _this.currentLayer === 1 ? 2 : 1;
            };

            if (instant) {
                execute();
            } else {
                this.timer = setTimeout(execute, 0);
            }
        },
        hide: function() {
            if (this.container) this.container.style.display = 'none';
        },
        show: function() {
            if (this.container) this.container.style.display = 'block';
        }
    };

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

    async function getImdbIdForTmdb(tmdbId, type) {
        if (!tmdbId) return null;
        let cacheKey = 'alt_imdb_v1_' + tmdbId;
        let cached = Cache7Days.get(cacheKey);
        if (cached) return cached;
        
        let endpoint = getTmdbEndpoint(`${type}/${tmdbId}/external_ids`);
        try {
            let res = await fetch(PROXIES[0] + endpoint).then(r => r.json());
            if (res && res.imdb_id) {
                Cache7Days.set(cacheKey, res.imdb_id);
                return res.imdb_id;
            }
        } catch(e) {}
        return null;
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

    async function fetchExtRatings(tmdbId, type) {
        let cacheKey = 'ext_ratings_v1_' + tmdbId;
        let cached = Cache7Days.get(cacheKey);
        if (cached) return cached;
        
        if (!inflightRatings[tmdbId]) {
            inflightRatings[tmdbId] = (async () => {
                let imdbId = await getImdbIdForTmdb(tmdbId, type);
                let results = {};
                if (!imdbId) return results;

                let omdbKey = Lampa.Storage.get('uas_omdb_api_key', '').trim();
                let mdblistKey = Lampa.Storage.get('uas_mdblist_api_key', '').trim();

                if (omdbKey) {
                    try {
                        let omdbRes = await fetch(`https://www.omdbapi.com/?apikey=${omdbKey}&i=${imdbId}`).then(r => r.json());
                        if (omdbRes && omdbRes.Response !== "False") {
                            if (omdbRes.Metascore && omdbRes.Metascore !== 'N/A') results.mc = omdbRes.Metascore;
                            if (omdbRes.imdbRating && omdbRes.imdbRating !== 'N/A') results.imdb = omdbRes.imdbRating;
                            let rt = (omdbRes.Ratings || []).find(r => r.Source === 'Rotten Tomatoes');
                            if (rt) results.rt = rt.Value.replace('%', '');
                        }
                    } catch(e) {}
                }

                if (mdblistKey) {
                    try {
                        let mdbRes = await fetch(`https://mdblist.com/api/?apikey=${mdblistKey}&i=${imdbId}`).then(r => r.json());
                        if (mdbRes) {
                            if (mdbRes.score) results.mdblist = mdbRes.score;
                            if (mdbRes.ratings) {
                                mdbRes.ratings.forEach(r => {
                                    if (r.source === 'trakt') results.trakt = r.value;
                                    if (r.source === 'letterboxd') results.letterboxd = r.value;
                                    if (r.source === 'tomatoesaudience') results.popcorn = r.value;
                                    if (r.source === 'metacritic' && !results.mc) results.mc = r.value;
                                    if (r.source === 'tomatoes' && !results.rt) results.rt = r.value;
                                    if (r.source === 'imdb' && !results.imdb) results.imdb = r.value;
                                });
                            }
                        }
                    } catch(e) {}
                }
                Cache7Days.set(cacheKey, results);
                return results;
            })();
        }
        return await inflightRatings[tmdbId];
    }

    function formatExtRating(val, key) {
        let num = parseFloat(val);
        if (isNaN(num) || num <= 0) return null;
        if (key === 'letterboxd') num = num * 2;
        else if (['mc', 'rt', 'mdblist', 'popcorn', 'trakt'].includes(key)) {
            if (num > 10) num = num / 10;
        }
        return num.toFixed(1);
    }

    function renderFlag(cardHtml, targetContainer, useAltDesign) {
        var view = cardHtml.querySelector('.card__view');
        if (!view || cardHtml.querySelector('.card__ua_flag')) return;
        var badge = document.createElement('div');
        badge.className = 'card__ua_flag';

        if (useAltDesign) badge.innerText = 'UA';

        var finalContainer = targetContainer || view;
        finalContainer.appendChild(badge);
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

    function renderSeasonBadge(cardHtml, tmdbData, targetContainer) {
        if (!tmdbData || !tmdbData.last_episode_to_air) return;
        var last = tmdbData.last_episode_to_air;
        var currentSeason = tmdbData.seasons.filter(function(s) { return s.season_number === last.season_number; })[0];
        
        if (currentSeason && last.season_number > 0) {
            var isComplete = currentSeason.episode_count > 0 && last.episode_number >= currentSeason.episode_count;
            var text = isComplete ? "S" + last.season_number : "S" + last.season_number + " " + last.episode_number + "/" + currentSeason.episode_count;
            
            var view = cardHtml.querySelector('.card__view');
            if (!view) return;
            var finalContainer = targetContainer || view;

            var typeBadge = cardHtml.querySelector('.card__type');
            if (!typeBadge) {
                typeBadge = document.createElement('div');
                typeBadge.className = 'card__type';
                finalContainer.appendChild(typeBadge);
            } else if (typeBadge.parentNode !== finalContainer) {
                finalContainer.appendChild(typeBadge);
            }
            
            typeBadge.innerHTML = text;
            typeBadge.classList.add('card__type--season');
            
            var altType = getAltDesignType();
            if (altType !== '1' && altType !== '2') {
                typeBadge.style.backgroundColor = isComplete ? 'rgba(46, 204, 113, 0.8)' : 'rgba(170, 20, 20, 0.8)';
            } else {
                typeBadge.style.backgroundColor = ''; 
            }
            
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
        var langPref = Lampa.Storage.get('ym_logo_lang', 'uk_en');
        var mType = movie.media_type || (movie.name ? 'tv' : 'movie');
        var altType = getAltDesignType();
        var isAlt1 = altType === '1';
        var isAlt2 = altType === '2';
        var isWideCustom = itemElement.hasClass('card--wide-custom');
        var isHistoryCard = itemElement.hasClass('card--history-custom');
        var isHoriz = isWideCustom || isHistoryCard;

        var posHor = Lampa.Storage.get('ym_logo_pos_hor') || 'center';
        var posVer = Lampa.Storage.get('ym_logo_pos_ver') || 'center';
        var posClass = 'logo-pos-' + (isHoriz ? posHor : posVer);

        itemElement.find('.card-custom-logo, .card-custom-logo-text').removeClass('logo-pos-top logo-pos-center logo-pos-bottom');

        function applyCleanPoster(url) {
            if (!isAlt2 || isHoriz || !url || url === 'none') return;
            var imgEl = itemElement[0].querySelector('.card__img');
            if (imgEl && !imgEl.classList.contains('uas-clean-poster')) {
                var newImg = imgEl.cloneNode(true);
                imgEl.parentNode.replaceChild(newImg, imgEl);
                newImg.classList.add('uas-poster-fade');
                newImg.classList.add('uas-clean-poster');
                setTimeout(() => {
                    newImg.src = PROXIES[0] + Lampa.TMDB.image('t/p/w300' + url);
                    newImg.onload = () => {
                        newImg.classList.remove('uas-poster-fade');
                        newImg.classList.add('uas-poster-loaded');
                    };
                }, 50);
            }
        }

        var quality = Lampa.Storage.get('ym_img_quality', 'w300');
        var cacheKey = 'logo_uas_v10_' + quality + '_' + langPref + '_' + mType + '_' + movie.id;
        var posterCacheKey = 'poster_clean_v3_' + mType + '_' + movie.id; 

        if (langPref === 'off' || (isAlt1 && isHoriz)) {
            itemElement.find('.card-custom-logo, .card-custom-logo-text, .card-api-logo-bottom').remove();
            if (!isHoriz && isAlt2) {
                var cData = Cache7Days.get(posterCacheKey);
                if (cData && cData !== 'none') applyCleanPoster(cData.split('|')[0]);
                else {
                    fetch(PROXIES[0] + getTmdbEndpoint(`${mType}/${movie.id}/images?include_image_language=null`)).then(r=>r.json()).then(res => {
                        if (res.posters && res.posters.length > 0) {
                            Cache7Days.set(posterCacheKey, res.posters[0].file_path + '|clean');
                            applyCleanPoster(res.posters[0].file_path);
                        } else Cache7Days.set(posterCacheKey, 'none');
                    }).catch(()=>{});
                }
            }
            return;
        }

        function renderLogo(logoUrl) {
            if (logoUrl && logoUrl !== 'none') {
                itemElement.find('.card-custom-logo-text').remove();
                var img = itemElement.find('.card-custom-logo')[0];
                if (!img) {
                    img = document.createElement('img');
                    img.className = 'card-custom-logo ' + posClass;
                    itemElement.find('.card__view').append(img);
                } else {
                    img.className = 'card-custom-logo ' + posClass;
                }
                img.onload = null;
                img.onerror = function() {
                    this.style.display = 'none';
                    renderTextLogo();
                };
                try {
                    var sizeVal = Lampa.Storage.get('ym_logo_size');
                    if (sizeVal === null || sizeVal === undefined || sizeVal === '') sizeVal = '40';
                    var sizeNum = parseInt(sizeVal, 10);
                    if (isNaN(sizeNum)) sizeNum = 40;
                    if (!isHoriz) {
                        sizeNum = Math.min(sizeNum + 30, 90);
                    }
                    img.style.setProperty('width', sizeNum + '%', 'important');
                    img.style.setProperty('max-width', sizeNum + '%', 'important');
                    img.style.setProperty('height', 'auto', 'important');
                } catch (e) {}
                img.style.display = 'block';
                img.src = logoUrl;
            } else {
                renderTextLogo();
            }
        }

        function renderTextLogo() {
            itemElement.find('.card-custom-logo').remove();
            
            var textLogo = itemElement[0].querySelector('.card-custom-logo-text');
            if (!textLogo) {
                textLogo = document.createElement('div');
                textLogo.className = 'card-custom-logo-text ' + posClass;
                var txt = movie.title || movie.name;
                if (langPref === 'en' || langPref === 'text_en') {
                    txt = movie.original_title || movie.original_name || txt;
                }
                textLogo.innerText = txt;
                itemElement.find('.card__view').append(textLogo);
            } else {
                $(textLogo).addClass(posClass);
            }

            var sizeVal = Lampa.Storage.get('ym_logo_size');
            if (sizeVal === null || sizeVal === undefined || sizeVal === '') sizeVal = '40';
            var sizeNum = parseInt(sizeVal, 10);
            if (isNaN(sizeNum)) sizeNum = 40;

            var multiplier = sizeNum / 40;
            var baseSize = isHoriz ? 2.0 : 1.2;
            var finalSize = baseSize * multiplier;

            textLogo.style.setProperty('font-size', finalSize + 'em', 'important');
        }

        var cachedLogo = Cache7Days.get(cacheKey);
        var cachedPosterData = Cache7Days.get(posterCacheKey);
        
        var isPosterClean = true;
        var pPath = null;
        if (cachedPosterData && cachedPosterData !== 'none') {
            let parts = cachedPosterData.split('|');
            pPath = parts[0];
            isPosterClean = parts[1] === 'clean';
        } else if (cachedPosterData === 'none') {
            isPosterClean = false; 
        }

        var needFetch = !cachedLogo || (isAlt2 && !isHoriz && !cachedPosterData);

        if (!needFetch) {
            if (isAlt2 && !isHoriz) {
                if (pPath) applyCleanPoster(pPath);
                if (!isPosterClean) {
                    itemElement.find('.card-custom-logo, .card-custom-logo-text').remove();
                } else {
                    if (langPref === 'text_uk' || langPref === 'text_en') renderTextLogo();
                    else renderLogo(cachedLogo);
                }
            } else {
                if (langPref === 'text_uk' || langPref === 'text_en') renderTextLogo();
                else renderLogo(cachedLogo);
            }
        } else {
            let endpoint = getTmdbEndpoint(`${mType}/${movie.id}/images?include_image_language=uk,en,null`);
            fetch(PROXIES[0] + endpoint).then(r => r.json()).then(function(res) {
                var finalLogo = 'none';
                if (res.logos && res.logos.length > 0) {
                    var found = null;
                    if (langPref === 'uk') found = res.logos.find(l => l.iso_639_1 === 'uk');
                    else if (langPref === 'en') found = res.logos.find(l => l.iso_639_1 === 'en');
                    else found = res.logos.find(l => l.iso_639_1 === 'uk') || res.logos.find(l => l.iso_639_1 === 'en');
                    if (found) finalLogo = PROXIES[0] + Lampa.TMDB.image('t/p/' + quality + found.file_path);
                }
                Cache7Days.set(cacheKey, finalLogo);

                var isCleanFlag = true;
                if (isAlt2 && !isHoriz) {
                    if (res.posters && res.posters.length > 0) {
                        var cleanP = res.posters.find(p => p.iso_639_1 === null);
                        var posterPath = cleanP ? cleanP.file_path : res.posters[0].file_path;
                        isCleanFlag = !!cleanP;
                        Cache7Days.set(posterCacheKey, posterPath + '|' + (isCleanFlag ? 'clean' : 'dirty'));
                        applyCleanPoster(posterPath);
                    } else {
                        isCleanFlag = false;
                        Cache7Days.set(posterCacheKey, 'none');
                    }
                }

                if (isAlt2 && !isHoriz && !isCleanFlag) {
                    itemElement.find('.card-custom-logo, .card-custom-logo-text').remove();
                } else {
                    if (langPref === 'text_uk' || langPref === 'text_en') renderTextLogo();
                    else renderLogo(finalLogo);
                }
            }).catch(function() {
                Cache7Days.set(cacheKey, 'none');
                if (isAlt2 && !isHoriz) Cache7Days.set(posterCacheKey, 'none');
                
                if (isAlt2 && !isHoriz) itemElement.find('.card-custom-logo, .card-custom-logo-text').remove();
                else {
                    if (langPref === 'text_uk' || langPref === 'text_en') renderTextLogo();
                    else renderLogo('none');
                }
            });
        }
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

    function makeFavoriteCardItem(bgUrl, fullBgUrl) {
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

                        if (fullBgUrl && !window.uas_initial_bg_set) {
                            window.uas_initial_bg_set = true;
                            BgManager.change(fullBgUrl, true);
                        }

                        var updateBg = function() {
                            if (fullBgUrl) BgManager.change(fullBgUrl);
                        };
                        item.on('hover:focus', updateBg);
                        item.on('mouseenter', updateBg);
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

    function makeHistoryButtonCardItem(bgUrl, fullBgUrl) {
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

                        if (fullBgUrl && !window.uas_initial_bg_set) {
                            window.uas_initial_bg_set = true;
                            BgManager.change(fullBgUrl, true);
                        }

                        var updateBg = function() {
                            if (fullBgUrl) BgManager.change(fullBgUrl);
                        };
                        item.on('hover:focus', updateBg);
                        item.on('mouseenter', updateBg);
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

                        var altType = getAltDesignType();
                        var useAltDesign = altType === '1' || altType === '2';
                        var voteVal = parseFloat(movie.vote_average);
                        
                        var showRating = Lampa.Storage.get('uas_badge_rating');
                        if (showRating === null || showRating === undefined || showRating === '') showRating = true;

                        if (!useAltDesign && !isNaN(voteVal) && voteVal > 0 && showRating) {
                            var voteDiv = document.createElement('div');
                            voteDiv.className = 'card__vote';
                            voteDiv.innerText = voteVal.toFixed(1);
                            view.append(voteDiv);
                        }

                        fetchLogo(movie, item);

                        var fullBgUrl = movie.backdrop_path ? PROXIES[0] + Lampa.TMDB.image('t/p/w300' + movie.backdrop_path) : '';

                        if (fullBgUrl && !window.uas_initial_bg_set) {
                            window.uas_initial_bg_set = true;
                            BgManager.change(fullBgUrl, true);
                        }

                        var updateBg = function() {
                            var finalBg = movie.custom_full_bg || fullBgUrl;
                            if (finalBg) BgManager.change(finalBg);
                        };
                        item.on('hover:focus', updateBg);
                        item.on('mouseenter', updateBg);
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

                        var altType = getAltDesignType();
                        var useAltDesign = altType === '1' || altType === '2';
                        var voteVal = parseFloat(movie.vote_average);
                        
                        var showRating = Lampa.Storage.get('uas_badge_rating');
                        if (showRating === null || showRating === undefined || showRating === '') showRating = true;

                        if (!useAltDesign && !isNaN(voteVal) && voteVal > 0 && showRating) {
                            var voteDiv = document.createElement('div');
                            voteDiv.className = 'card__vote';
                            voteDiv.innerText = voteVal.toFixed(1);
                            view.append(voteDiv);
                        }

                        var showYear = Lampa.Storage.get('uas_badge_year');
                        if (showYear === null || showYear === undefined || showYear === '') showYear = true;

                        var yearStr = (movie.release_date || movie.first_air_date || '').toString().substring(0, 4);
                        if (yearStr && yearStr.length === 4 && showYear) {
                            var ageDiv = document.createElement('div');
                            ageDiv.className = 'card-badge-age'; 
                            ageDiv.innerText = yearStr;
                            view.append(ageDiv);
                        }

                        fetchLogo(movie, item);

                        var descText = movie.overview || 'Опис відсутній.';
                        item.append('<div class="custom-title-bottom">' + (movie.title || movie.name) + '</div>');
                        item.append('<div class="custom-overview-bottom">' + descText + '</div>');

                        var fullBgUrl = movie.backdrop_path ? PROXIES[0] + Lampa.TMDB.image('t/p/w300' + movie.backdrop_path) : '';

                        if (fullBgUrl && !window.uas_initial_bg_set) {
                            window.uas_initial_bg_set = true;
                            BgManager.change(fullBgUrl, true);
                        }

                        var updateBg = function() {
                            var finalBg = movie.custom_full_bg || fullBgUrl;
                            if (finalBg) BgManager.change(finalBg);
                        };
                        item.on('hover:focus', updateBg);
                        item.on('mouseenter', updateBg);
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
        let randFavBgFull = '';
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
                randFavBgFull = imgUrlPath ? (PROXIES[0] + Lampa.TMDB.image('t/p/w1280' + imgUrlPath)) : '';
            }
        } catch(e) {}

        let randHistImg = '';
        let randHistBgFull = '';
        try {
            let validHist = (allFavs.history ||[]).filter(item => item && (item.backdrop_path || item.poster_path));
            if (validHist.length > 0) {
                let randItem = validHist[Math.floor(Math.random() * validHist.length)];
                let quality = Lampa.Storage.get('ym_img_quality', 'w300');
                let imgUrlPath = randItem.backdrop_path || randItem.poster_path;
                randHistImg = imgUrlPath ? (PROXIES[0] + Lampa.TMDB.image('t/p/' + quality + imgUrlPath)) : '';
                randHistBgFull = imgUrlPath ? (PROXIES[0] + Lampa.TMDB.image('t/p/w1280' + imgUrlPath)) : '';
            }
        } catch(e) {}

        let showFav = Lampa.Storage.get('uas_show_fav_card');
        if (showFav === null || showFav === undefined || showFav === '' || showFav === true || showFav === 'true') {
            results.push(makeFavoriteCardItem(randFavImg, randFavBgFull));
        }

        let showHistBtn = Lampa.Storage.get('uas_show_history_btn');
        if (showHistBtn === null || showHistBtn === undefined || showHistBtn === '' || showHistBtn === true || showHistBtn === 'true') {
            results.push(makeHistoryButtonCardItem(randHistImg, randHistBgFull));
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

        // Підменю Рядків
        Lampa.SettingsApi.addComponent({
            component: 'ymainpage_rows',
            name: 'Налаштування рядків',
            icon: `<svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line><line x1="3" y1="6" x2="3.01" y2="6"></line><line x1="3" y1="12" x2="3.01" y2="12"></line><line x1="3" y1="18" x2="3.01" y2="18"></line></svg>`
        });

        // Підменю Зовнішніх рейтингів
        Lampa.SettingsApi.addComponent({
            component: 'ymainpage_ext_rt',
            name: 'Рейтинги на картці',
            icon: `<svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>`
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
            'text_en': 'Завжди текст (Англ)',
            'off': 'Вимкнути (Тільки фон)'
        };
        Lampa.SettingsApi.addParam({
            component: 'ymainpage',
            param: { name: 'ym_logo_lang', type: 'select', values: langValues, default: 'uk_en' },
            field: { name: 'Мова логотипів', description: 'Оберіть пріоритет мови для логотипів' }
        });

        var logoSizeValues = {
            '10': '10%', '20': '20%', '30': '30%', '40': '40%', '50': '50%', '60': '60%', '70': '70%', '80': '80%', '90': '90%', '100': '100%'
        };
        Lampa.SettingsApi.addParam({
            component: 'ymainpage',
            param: { name: 'ym_logo_size', type: 'select', values: logoSizeValues, default: '40' },
            field: { name: 'Розмір логотипу', description: 'Ширина логотипу як відсоток від ширини картки (10%–100%)' }
        });

        var logoPosValues = {
            'top': 'Зверху',
            'center': 'Посередині (За замовчуванням)',
            'bottom': 'Знизу'
        };
        Lampa.SettingsApi.addParam({
            component: 'ymainpage',
            param: { name: 'ym_logo_pos_hor', type: 'select', values: logoPosValues, default: 'center' },
            field: { name: 'Позиція лого (Горизонтальні картки)', description: 'Де розміщувати логотип на широких картках' }
        });
        Lampa.SettingsApi.addParam({
            component: 'ymainpage',
            param: { name: 'ym_logo_pos_ver', type: 'select', values: logoPosValues, default: 'center' },
            field: { name: 'Позиція лого (Вертикальні картки)', description: 'Де розміщувати логотип на звичайних картках' }
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

        var bgModeValues = {
            '0': 'Вимкнено',
            '1': 'Плавний перехід (За замовчуванням)',
            '2': 'Без переходу (Різко)'
        };
        Lampa.SettingsApi.addParam({
            component: 'ymainpage',
            param: { name: 'uas_bg_mode', type: 'select', values: bgModeValues, default: '1' },
            field: { name: 'Розмитий фон на Головній', description: 'Налаштування поведінки фону за картками' }
        });

        Lampa.SettingsApi.addParam({
            component: 'ymainpage',
            param: { name: 'uas_pro_tmdb_btn', type: 'button' },
            field: { name: 'Власний TMDB API ключ', description: 'Натисніть, щоб ввести ключ (працює першочергово)' }
        });

        // --- Вхід в меню Рядків ---
        Lampa.SettingsApi.addParam({
            component: 'ymainpage',
            param: { name: 'uas_rows_menu_btn', type: 'button' },
            field: { name: 'Налаштування рядків Головної', description: 'Увімкнути/Вимкнути та змінити порядок рядків' }
        });

        // --- Заповнення підменю Рядків ---
        Lampa.SettingsApi.addParam({ component: 'ymainpage_rows', param: { name: 'uas_rows_back', type: 'button' }, field: { name: 'Назад', description: 'Повернутись до основних налаштувань' } });
        let orderValues = { '1': 'Позиція 1', '2': 'Позиція 2', '3': 'Позиція 3', '4': 'Позиція 4', '5': 'Позиція 5', '6': 'Позиція 6', '7': 'Позиція 7', '8': 'Позиція 8', '9': 'Позиція 9' };
        DEFAULT_ROWS_SETTINGS.forEach(r => {
            Lampa.SettingsApi.addParam({
                component: 'ymainpage_rows',
                param: { name: r.id, type: 'trigger', default: r.default },
                field: { name: 'Вимкнути / Увімкнути: ' + r.title, description: 'Показувати цей рядок на головній' }
            });
            Lampa.SettingsApi.addParam({
                component: 'ymainpage_rows',
                param: { name: r.id + '_order', type: 'select', values: orderValues, default: r.defOrder },
                field: { name: 'Порядок: ' + r.title, description: 'Яким по рахунку виводити цей рядок' }
            });
        });

        // --- Налаштування тексту ---
        Lampa.SettingsApi.addParam({
            component: 'ymainpage',
            param: { name: 'uas_text_divider', type: 'title' },
            field: { name: 'Налаштування тексту', description: 'Керування текстом карток' }
        });

        Lampa.SettingsApi.addParam({
            component: 'ymainpage',
            param: { name: 'uas_text_hide', type: 'trigger', default: false },
            field: { name: 'Приховати текст', description: 'Повністю сховати назви та опис під картками' }
        });

        var textAlignValues = { 'left': 'Ліворуч', 'center': 'По центру', 'right': 'Праворуч' };
        Lampa.SettingsApi.addParam({
            component: 'ymainpage',
            param: { name: 'uas_text_align', type: 'select', values: textAlignValues, default: 'center' },
            field: { name: 'Вирівнювання назви', description: 'Оберіть вирівнювання назви' }
        });
        Lampa.SettingsApi.addParam({
            component: 'ymainpage',
            param: { name: 'uas_text_desc_align', type: 'select', values: textAlignValues, default: 'left' },
            field: { name: 'Вирівнювання опису', description: 'Оберіть вирівнювання тексту опису' }
        });

        var titleSizeValues = {
            '0.8': 'Дуже малий (0.8)',
            '0.9': 'Малий (0.9)',
            '1.0': 'Стандартний (1.0)',
            '1.1': 'Збільшений (1.1)',
            '1.2': 'Великий (1.2)',
            '1.3': 'Дуже великий (1.3)'
        };
        Lampa.SettingsApi.addParam({
            component: 'ymainpage',
            param: { name: 'uas_text_title_size', type: 'select', values: titleSizeValues, default: '1.1' },
            field: { name: 'Розмір тексту: Назва', description: 'Для горизонтальних та вертикальних карток' }
        });

        var descSizeValues = {
            '0.7': 'Дуже малий (0.7)',
            '0.75': 'Малий (0.75)',
            '0.85': 'Стандартний (0.85)',
            '0.95': 'Збільшений (0.95)',
            '1.05': 'Великий (1.05)'
        };
        Lampa.SettingsApi.addParam({
            component: 'ymainpage',
            param: { name: 'uas_text_desc_size', type: 'select', values: descSizeValues, default: '0.85' },
            field: { name: 'Розмір тексту: Опис', description: 'Для горизонтальних карток' }
        });

        // --- Налаштування Альтернативного вигляду ---
        Lampa.SettingsApi.addParam({
            component: 'ymainpage',
            param: { name: 'uas_alt_design_divider', type: 'title' },
            field: { name: 'Альтернативний вигляд', description: 'Налаштування дизайну карток' }
        });

        var altDesignValues = {
            '0': 'Вимкнено (Стандартний)',
            '1': 'Альтернативний вигляд 1 (easyratingsdb)',
            '2': 'Альтернативний вигляд 2 (TMDB + Нові бейджі)'
        };
        Lampa.SettingsApi.addParam({
            component: 'ymainpage',
            param: { name: 'uas_alt_design_type', type: 'select', values: altDesignValues, default: '0' },
            field: { name: 'Тип дизайну карток', description: 'Оберіть стиль відображення' }
        });

        Lampa.SettingsApi.addParam({
            component: 'ymainpage',
            param: { name: 'uas_alt_apikey_btn', type: 'button' },
            field: { name: 'easyratingsdb Api key', description: 'Для Альт. вигляду 1. Натисніть, щоб ввести ключ' }
        });

        var badgeSizeValues = {
            '0.55': 'Дуже малий (55%)',
            '0.65': 'Малий (65%)',
            '0.7': 'Стандартний (70%)',
            '0.75': 'Збільшений (75%)',
            '0.85': 'Великий (85%)',
            '0.95': 'Дуже великий (95%)',
            '1.1': 'Гігантський (110%)'
        };
        Lampa.SettingsApi.addParam({
            component: 'ymainpage',
            param: { name: 'uas_alt_badge_size', type: 'select', values: badgeSizeValues, default: '0.7' },
            field: { name: 'Розмір бейджів', description: 'Змінює розмір овальних бейджів' }
        });

        var badgePosValues = {
            'tl': 'Верхній Лівий (За замовчуванням)',
            'tr': 'Верхній Правий',
            'ml': 'Середина Лівий',
            'mr': 'Середина Правий',
            'bl': 'Нижній Лівий',
            'br': 'Нижній Правий'
        };
        Lampa.SettingsApi.addParam({
            component: 'ymainpage',
            param: { name: 'uas_alt_badge_pos', type: 'select', values: badgePosValues, default: 'tl' },
            field: { name: 'Позиція бейджів (Рік, Сезони, UA)', description: 'В якому місці відображати інформацію на картках' }
        });

        Lampa.SettingsApi.addParam({
            component: 'ymainpage',
            param: { name: 'uas_alt_rating_pos', type: 'select', values: badgePosValues, default: 'tr' },
            field: { name: 'Позиція рейтингу', description: 'В якому місці відображати бейджі рейтингів' }
        });

        // --- Налаштування видимості бейджів ---
        Lampa.SettingsApi.addParam({
            component: 'ymainpage',
            param: { name: 'uas_badges_divider', type: 'title' },
            field: { name: 'Наявність бейджів', description: 'Керування відображенням бейджів на картках' }
        });

        Lampa.SettingsApi.addParam({
            component: 'ymainpage',
            param: { name: 'uas_badge_year', type: 'trigger', default: true },
            field: { name: 'Бейдж Року', description: 'Відображати рік випуску на картці' }
        });

        Lampa.SettingsApi.addParam({
            component: 'ymainpage',
            param: { name: 'uas_badge_season', type: 'trigger', default: true },
            field: { name: 'Бейдж Сезону/Серії', description: 'Відображати кількість сезонів та серій' }
        });

        Lampa.SettingsApi.addParam({
            component: 'ymainpage',
            param: { name: 'uas_badge_rating', type: 'trigger', default: true },
            field: { name: 'Бейдж Рейтингу (TMDB)', description: 'Відображати стандартну оцінку на картках' }
        });

        // --- Вхід в меню Рейтингів ---
        Lampa.SettingsApi.addParam({
            component: 'ymainpage',
            param: { name: 'uas_ext_rt_menu_btn', type: 'button' },
            field: { name: 'Рейтинги на картці', description: 'Налаштування зовнішніх оцінок (OMDB/MDBList)' }
        });

        // --- Заповнення підменю Рейтингів ---
        Lampa.SettingsApi.addParam({ component: 'ymainpage_ext_rt', param: { name: 'uas_ext_rt_back', type: 'button' }, field: { name: 'Назад', description: 'Повернутись до основних налаштувань' } });
        Lampa.SettingsApi.addParam({ component: 'ymainpage_ext_rt', param: { name: 'uas_ext_ratings_enable', type: 'trigger', default: false }, field: { name: 'Увімкнути зовнішні рейтинги', description: 'Показувати додаткові оцінки на картках' } });
        Lampa.SettingsApi.addParam({ component: 'ymainpage_ext_rt', param: { name: 'uas_omdb_key_btn', type: 'button' }, field: { name: 'OMDB API Key', description: 'Ключ (omdbapi.com)' } });
        Lampa.SettingsApi.addParam({ component: 'ymainpage_ext_rt', param: { name: 'uas_mdblist_key_btn', type: 'button' }, field: { name: 'MDBList API Key', description: 'Ключ (mdblist.com)' } });
        
        var rtList = { tmdb:'TMDB (Стандартний)', imdb:'IMDb', rt:'Rotten Tomatoes', mc:'Metacritic', letterboxd:'Letterboxd', trakt:'Trakt', mdblist:'MDBList', popcorn:'Popcorn' };
        Object.keys(rtList).forEach(function(k) {
            Lampa.SettingsApi.addParam({ component: 'ymainpage_ext_rt', param: { name: 'uas_ext_rt_'+k, type: 'trigger', default: true }, field: { name: rtList[k], description: 'Показувати ' + rtList[k] } });
        });

        Lampa.Settings.listener.follow('open', function (e) {
            if (e.name === 'ymainpage') {
                e.body.find('[data-name="uas_support_yarik"]').on('hover:enter', function () {
                    window.open('https://lampalampa.free.nf/', '_blank');
                });
                
                e.body.find('[data-name="uas_support_lme"]').on('hover:enter', function () {
                    window.open('https://lampame.github.io/main/#uk', '_blank');
                });

                e.body.find('[data-name="uas_rows_menu_btn"]').on('hover:enter', function () {
                    Lampa.Settings.create('ymainpage_rows');
                });

                e.body.find('[data-name="uas_ext_rt_menu_btn"]').on('hover:enter', function () {
                    Lampa.Settings.create('ymainpage_ext_rt');
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

                e.body.find('[data-name="uas_alt_apikey_btn"]').on('hover:enter', function () {
                    var currentKey = Lampa.Storage.get('uas_alt_design_apikey') || '';
                    Lampa.Input.edit({
                        title: 'API Ключ easyratingsdb', value: currentKey, free: true, nosave: true
                    }, function (new_val) {
                        if (new_val !== undefined) {
                            Lampa.Storage.set('uas_alt_design_apikey', new_val.trim());
                            Lampa.Noty.show('Ключ збережено. Зміни застосовано.');
                        }
                    });
                });
            } else if (e.name === 'ymainpage_ext_rt') {
                e.body.find('[data-name="uas_ext_rt_back"]').on('hover:enter', function () {
                    Lampa.Settings.create('ymainpage');
                });

                e.body.find('[data-name="uas_omdb_key_btn"]').on('hover:enter', function () {
                    var currentKey = Lampa.Storage.get('uas_omdb_api_key') || '';
                    Lampa.Input.edit({ title: 'OMDB API Key', value: currentKey, free: true, nosave: true }, function (new_val) {
                        if (new_val !== undefined) { Lampa.Storage.set('uas_omdb_api_key', new_val.trim()); Lampa.Noty.show('Збережено.'); }
                    });
                });

                e.body.find('[data-name="uas_mdblist_key_btn"]').on('hover:enter', function () {
                    var currentKey = Lampa.Storage.get('uas_mdblist_api_key') || '';
                    Lampa.Input.edit({ title: 'MDBList API Key', value: currentKey, free: true, nosave: true }, function (new_val) {
                        if (new_val !== undefined) { Lampa.Storage.set('uas_mdblist_api_key', new_val.trim()); Lampa.Noty.show('Збережено.'); }
                    });
                });
            } else if (e.name === 'ymainpage_rows') {
                e.body.find('[data-name="uas_rows_back"]').on('hover:enter', function () {
                    Lampa.Settings.create('ymainpage');
                });
            }
        });

        Lampa.Settings.listener.follow('change', function (e) {
            if (['uas_alt_design_type', 'uas_alt_badge_size', 'uas_text_hide', 'uas_text_align', 'uas_text_desc_align', 'uas_text_title_size', 'uas_text_desc_size', 'uas_bg_mode'].includes(e.name)) {
                updateDynamicStyles();
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
            
            var logoSize = Lampa.Storage.get('ym_logo_size');
            if (logoSize === null || logoSize === undefined || logoSize === '') Lampa.Storage.set('ym_logo_size', '40');
            
            // Ініціалізація нових перемикачів бейджів
            let bYear = Lampa.Storage.get('uas_badge_year');
            if (bYear === null || bYear === undefined || bYear === '') Lampa.Storage.set('uas_badge_year', true);

            let bSeason = Lampa.Storage.get('uas_badge_season');
            if (bSeason === null || bSeason === undefined || bSeason === '') Lampa.Storage.set('uas_badge_season', true);

            let bRating = Lampa.Storage.get('uas_badge_rating');
            if (bRating === null || bRating === undefined || bRating === '') Lampa.Storage.set('uas_badge_rating', true);

            // Ініціалізація фону
            let bgm = Lampa.Storage.get('uas_bg_mode');
            if (bgm === null || bgm === undefined || bgm === '') Lampa.Storage.set('uas_bg_mode', '1');
        }

        updateDynamicStyles();
        cleanOldCaches();

        lmeCache = new Cache(CONFIG.cache);
        lmeCache.init();
        
        AltImageCache.init(); 

        BgManager.init(); 

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
            
            .card--wide-custom.focus { z-index: 99 !important; transform: scale(1.08) !important; }
            .card--wide-custom.focus .card__view { box-shadow: 0 10px 25px rgba(0,0,0,0.9) !important; border: 3px solid #fff !important; outline: none !important; }
            .card--wide-custom.focus .card__view::after, .card--wide-custom.focus .card__view::before { display: none !important; content: none !important; }

            /* Базові стилі для ЛОГО */
            .card-custom-logo { position: absolute; left: 50%; z-index: 5; filter: drop-shadow(0px 3px 5px rgba(0,0,0,0.8)); pointer-events: none; transition: filter 0.3s ease; }
            .card-custom-logo-text { position: absolute; left: 50%; width: 80%; text-align: center; font-weight: 600; color: #fff; text-shadow: 0px 2px 4px rgba(0,0,0,0.8); z-index: 5; pointer-events: none; word-wrap: break-word; white-space: normal; line-height: 1.2; font-family: sans-serif; display: flex; align-items: center; justify-content: center; }
            .card--wide-custom .card-custom-logo-text { text-shadow: none !important; }

            /* Класи позиціонування ЛОГО */
            .logo-pos-center { top: 50%; transform: translate(-50%, -50%); }
            .logo-pos-top { top: 8%; transform: translateX(-50%); }
            .logo-pos-bottom { bottom: 8%; top: auto; transform: translateX(-50%); }

            .card--wide-custom > div:not(.card__view):not(.custom-title-bottom):not(.custom-overview-bottom) { display: none !important; }
            
            /* Динамічні стилі тексту */
            .custom-title-bottom { 
                width: 100%; text-align: var(--uas-text-align, center) !important; font-size: var(--uas-title-size, 1.1em) !important; 
                font-weight: bold; margin-top: 0.3em; color: #fff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; 
                padding: 0 0.2em; display: block !important; visibility: visible !important; opacity: 1 !important; 
            }
            .custom-overview-bottom { 
                width: 100%; text-align: var(--uas-desc-align, left) !important; font-size: var(--uas-desc-size, 0.85em) !important; 
                color: #bbb; line-height: 1.2; margin-top: 0.2em; padding: 0 0.2em; display: -webkit-box !important; 
                -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; white-space: normal; 
                visibility: visible !important; opacity: 1 !important; 
            }
            .card .card__title {
                text-align: var(--uas-text-align, center) !important;
                font-size: var(--uas-title-size, 1.0em) !important;
            }

            body.uas-hide-text .card__title,
            body.uas-hide-text .custom-title-bottom,
            body.uas-hide-text .custom-overview-bottom {
                display: none !important;
            }
            
            .card__vote { right: 0 !important; bottom: 0 !important; padding: 0.2em 0.45em !important; z-index: 2; position: absolute !important; font-weight: bold; background: rgba(0,0,0,0.6); }
            .card__type { position: absolute !important; left: 0 !important; top: 0 !important; width: auto !important; height: auto !important; line-height: 1 !important; padding: 0.3em !important; background: rgba(0, 0, 0, 0.5) !important; display: flex !important; align-items: center; justify-content: center; z-index: 2; color: #fff !important; transition: background 0.3s !important; }
            .card__type svg { width: 1.5em !important; height: 1.5em !important; }
            .card__type.card__type--season { font-size: 1.1em !important; font-weight: bold !important; padding: 0.2em 0.45em !important; font-family: Roboto, Arial, sans-serif !important; }
            .card__ua_flag { position: absolute !important; left: 0 !important; bottom: 0 !important; width: 2.4em !important; height: 1.4em !important; font-size: 1.3em !important; background: linear-gradient(180deg, #0057b8 50%, #ffd700 50%) !important; opacity: 0.8 !important; z-index: 2; }
            
            .card--wide-custom .card-badge-age { border-radius: 0 0 0 0.5em !important; }
            .card--wide-custom .card__vote { border-radius: 0.5em 0 0 0 !important; } 
            .card--wide-custom .card__type { border-radius: 0 0 0.5em 0 !important; }  
            .card--wide-custom .card__ua_flag { border-radius: 0 0.5em 0 0 !important; }

            body:not(.uas-alt-design-active) .card:not(.card--wide-custom):not(.card--history-custom) .card-badge-age { border-radius: 0 0.8em 0 0.8em !important; }
            body:not(.uas-alt-design-active) .card:not(.card--wide-custom):not(.card--history-custom) .card__vote { border-radius: 0.8em 0 0.8em 0 !important; }
            body:not(.uas-alt-design-active) .card:not(.card--wide-custom):not(.card--history-custom) .card__type { border-radius: 0.8em 0 0.8em 0 !important; }
            body:not(.uas-alt-design-active) .card:not(.card--wide-custom):not(.card--history-custom) .card__ua_flag { border-radius: 0 0.8em 0 0.8em !important; }

            /* --- АЛЬТЕРНАТИВНИЙ ДИЗАЙН --- */
            body.uas-alt-design-active .card__vote,
            body.uas-alt-design-active .card-rating,
            body.uas-alt-design-active .card .card__vote { display: none !important; opacity: 0 !important; visibility: hidden !important; }
            
            body.uas-alt-design-active:not(.uas-alt-design-2) .card--wide-custom .card-backdrop-overlay { display: none !important; background: transparent !important; }
            body.uas-alt-design-active:not(.uas-alt-design-2) .card--wide-custom .card__view::after,
            body.uas-alt-design-active:not(.uas-alt-design-2) .card--wide-custom .card__view::before { display: none !important; content: none !important; }
            
            /* Приховування підменю з лівого списку налаштувань */
            .settings__menu [data-component="ymainpage_ext_rt"],
            .settings__menu [data-component="ymainpage_rows"] { display: none !important; }

            /* Динамічний контейнер бейджів (Альтернативний дизайн та Рейтинги) */
            .card .card-custom-badges {
                position: absolute !important; 
                display: flex !important; 
                flex-direction: column !important; 
                gap: 0.2em !important; 
                z-index: 20 !important; 
                pointer-events: none !important; 
                background: transparent !important;
            }
            .card .badge-pos-tl { left: 0.3em !important; top: 0.55em !important; align-items: flex-start !important; }
            .card .badge-pos-tr { right: 0.3em !important; top: 0.55em !important; align-items: flex-end !important; }
            .card .badge-pos-ml { left: 0.3em !important; top: 50% !important; transform: translateY(-50%) !important; align-items: flex-start !important; }
            .card .badge-pos-mr { right: 0.3em !important; top: 50% !important; transform: translateY(-50%) !important; align-items: flex-end !important; }
            .card .badge-pos-bl { left: 0.3em !important; bottom: 0.55em !important; align-items: flex-start !important; }
            .card .badge-pos-br { right: 0.3em !important; bottom: 0.55em !important; align-items: flex-end !important; }
            
            /* Спільний овал для всіх бейджів всередині контейнера */
            .card .card-custom-badges > div {
                position: static !important; 
                margin: 0 !important; 
                height: 1.8em !important; 
                min-height: 1.8em !important;
                width: auto !important;
                border-radius: 2em !important; 
                display: flex !important; 
                align-items: center !important; 
                justify-content: center !important;
                background: rgba(0, 0, 0, 0.55) !important; 
                padding: 0 0.6em !important; 
                font-size: var(--uas-badge-size, 0.7em) !important; 
                font-weight: 700 !important;
                color: #fff !important; 
                box-shadow: none !important; 
                line-height: 1 !important;
                border: 1px solid rgba(255,255,255,0.15) !important; 
                box-sizing: border-box !important;
            }

            .card .ext-rating-badge img { margin-right: 0.35em !important; width: 1.1em !important; height: 1.1em !important; object-fit: contain !important; filter: drop-shadow(0 1px 1px rgba(0,0,0,0.5)) !important; }
            
            .card .card-alt-rating { order: 0 !important; }
            .card .card-custom-badges .card-badge-age { order: 1 !important; }
            .card .card-custom-badges .card__type { order: 2 !important; }
            .card .card-custom-badges .card__ua_flag { order: 3 !important; }
            .card .card-custom-badges .ext-rating-badge { order: 4 !important; }

            .card .badge-pos-bl .ext-rating-badge, .card .badge-pos-br .ext-rating-badge { order: 0 !important; }
            .card .badge-pos-bl .card__ua_flag, .card .badge-pos-br .card__ua_flag { order: 1 !important; }
            .card .badge-pos-bl .card__type,    .card .badge-pos-br .card__type    { order: 2 !important; }
            .card .badge-pos-bl .card-badge-age,.card .badge-pos-br .card-badge-age{ order: 3 !important; }

            .card .badge-pos-ml .card__ua_flag, .card .badge-pos-mr .card__ua_flag { order: 1 !important; }
            .card .badge-pos-ml .card-badge-age,.card .badge-pos-mr .card-badge-age{ order: 2 !important; }
            .card .badge-pos-ml .card__type,    .card .badge-pos-mr .card__type    { order: 3 !important; }

            .card .card-custom-badges .card__ua_flag { 
                background: rgba(0, 0, 0, 0.55) !important; 
                border: 1px solid rgba(255,255,255,0.15) !important;
                display: flex !important;
                visibility: visible !important;
                opacity: 1 !important;
                padding: 0 0.6em !important;  
                font-size: var(--uas-badge-size, 0.7em) !important;
                color: #fff !important; 
                text-shadow: none !important; 
                box-shadow: none !important; 
            }

            /* Зміщення контейнера рейтингів для стандартного дизайну, щоб не перекривати базові кутові бейджі */
            body:not(.uas-alt-design-active) .card .card-custom-badges.badge-pos-tl { top: 2.2em !important; }
            body:not(.uas-alt-design-active) .card .card-custom-badges.badge-pos-tr { top: 2.2em !important; }
            body:not(.uas-alt-design-active) .card .card-custom-badges.badge-pos-bl { bottom: 2.2em !important; }
            body:not(.uas-alt-design-active) .card .card-custom-badges.badge-pos-br { bottom: 2.2em !important; }

            body.uas-main-active .card__ua_flag { display: none !important; visibility: hidden !important; opacity: 0 !important; }

            .card--history-custom .card-custom-badges,
            .card--history-custom .card-left-badges,
            .card--history-custom .card__vote,
            .card--history-custom .card-badge-age,
            .card--history-custom .card__type,
            .card--history-custom .card__ua_flag { display: none !important; visibility: hidden !important; opacity: 0 !important; }
            
            /* --- Плавна поява постерів --- */
            .uas-poster-fade { opacity: 0.5 !important; filter: blur(3px) !important; transition: opacity 0.3s ease, filter 0.3s ease !important; }
            .uas-poster-loaded { animation: uasImgFadeIn 0.5s ease-out forwards !important; }
            @keyframes uasImgFadeIn {
                from { opacity: 0.5; filter: blur(3px); }
                to { opacity: 1; filter: blur(0); }
            }
            /* ----------------------------------------------------- */

            .items-line[data-uas-title-row="true"] .items-line__head { display: none !important; }
            .items-line[data-uas-content-row="true"] .items-line__head { display: none !important; }
            
            .items-line[data-uas-title-row="true"] { margin-top: 0 !important; margin-bottom: 0.5em !important; padding-top: 0 !important; padding-bottom: 0 !important; }
            .items-line[data-uas-title-row="true"] .items-line__body { margin-top: 0 !important; margin-bottom: 0 !important; padding-top: 0 !important; padding-bottom: 0 !important; }
            .items-line[data-uas-title-row="true"] .scroll__item { margin-top: 0 !important; margin-bottom: 0 !important; padding-top: 0 !important; padding-bottom: 0 !important; }
            
            .items-line[data-uas-content-row="true"] { margin-top: 0.1em !important; margin-bottom: 0.5em !important; padding-top: 0 !important; padding-bottom: 0 !important; }
            .items-line[data-uas-content-row="true"] .items-line__body { margin-top: 0 !important; margin-bottom: 0 !important; padding-top: 0 !important; padding-bottom: 0 !important; }
            .items-line[data-uas-content-row="true"] .scroll__item { margin-top: 0 !important; margin-bottom: 0 !important; padding-top: 0 !important; padding-bottom: 0 !important; }

            .card--title-btn { width: 100vw !important; max-width: 100% !important; height: auto !important; background: transparent !important; border-radius: 1.5em !important; margin: 0.2em 0 !important; display: flex !important; align-items: center !important; justify-content: flex-start !important; padding: 0.5em 1.5em !important; cursor: pointer !important; border: 2px solid transparent !important; box-shadow: none !important; box-sizing: border-box !important; transition: transform 0.2s ease, border 0.2s ease, background 0.2s ease !important; }
            .card--title-btn.focus { background: rgba(255, 255, 255, 0.05) !important; border: 2px solid #fff !important; transform: scale(1.01) !important; }
            .title-btn-text { display: flex !important; align-items: center !important; font-size: 1.4em !important; font-weight: bold !important; color: #777 !important; border: none !important; padding: 0 !important; line-height: 1.2 !important; text-align: left !important; transition: color 0.2s ease, transform 0.2s ease !important; }
            .title-btn-icon { height: 1.1em !important; width: auto !important; margin-right: 0.5em !important; filter: drop-shadow(0px 1px 2px rgba(0,0,0,0.5)) !important; }
            .card--title-btn.focus .title-btn-text { color: #fff !important; text-shadow: none !important; }
            .card--title-btn-static { cursor: default !important; }
            .card--title-btn-static .title-btn-text { opacity: 0.5 !important; }
            .card--title-btn .card__view, .card--title-btn .card__view::after, .card--title-btn .card__view::before { display: none !important; }

            .card--collection-btn { width: 16em !important; height: 7em !important; background: rgba(40,40,40,0.8) !important; border-radius: 0.8em !important; margin-right: 0.8em !important; margin-bottom: 0.8em !important; display: flex !important; flex-direction: column !important; align-items: center !important; justify-content: center !important; padding: 1em !important; cursor: pointer !important; border: 2px solid transparent !important; box-shadow: 0 4px 6px rgba(0,0,0,0.3) !important; transition: transform 0.2s ease, background 0.2s ease, border 0.2s ease !important; text-align: center !important; box-sizing: border-box !important; position: relative; }
            .card--collection-btn.focus { background: rgba(60,60,60,0.9) !important; border: 2px solid #fff !important; transform: scale(1.05) !important; z-index: 99 !important; }
            .card--collection-btn .collection-title { font-size: 1.1em !important; font-weight: bold !important; color: #fff !important; line-height: 1.3 !important; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
            .card--collection-btn .card__view, .card--collection-btn .card__view::after, .card--collection-btn .card__view::before { display: none !important; }

            .card--history-custom { width: 16em !important; margin-right: 0.8em !important; margin-bottom: 0 !important; position: relative; cursor: pointer; transition: transform 0.2s ease, z-index 0.2s ease; z-index: 1; }
            .card--history-custom .card__view { border-radius: 0.8em !important; overflow: hidden !important; box-shadow: 0 4px 6px rgba(0,0,0,0.3); }
            .card--history-custom.focus { z-index: 99 !important; transform: scale(1.08) !important; }
            .card--history-custom.focus .card__view { box-shadow: 0 10px 25px rgba(0,0,0,0.9) !important; border: 2px solid #fff !important; outline: none !important; }
            .card--history-custom.focus .card__view::after, .card--history-custom.focus .card__view::before { display: none !important; content: none !important; }
            .card--history-custom > div:not(.card__view) { display: none !important; }

            #uas-bg-container { position: fixed; top: 0; left: 0; right: 0; bottom: 0; width: 100vw; height: 100vh; z-index: 1; pointer-events: none; background-color: #000; display: none; }
            .uas-bg-layer { position: absolute; top: 0; left: 0; width: 100%; height: 100%; background-size: cover; background-position: center; opacity: 0; transition: opacity 1s ease-in-out; filter: blur(10px) brightness(0.4); transform: scale(1.05); }
            .uas-bg-layer.active { opacity: 1; }
            
            /* Нові стилі для налаштування фону */
            body.uas-bg-disabled #uas-bg-container { display: none !important; }
            body.uas-bg-instant .uas-bg-layer { transition: opacity 0s !important; }
            
            /* Повністю глушимо стандартний фон Lampa на головній сторінці завжди! */
            body.uas-main-active .background { display: none !important; opacity: 0 !important; }
            body.uas-main-active .wrap { position: relative; z-index: 2; } 

            @media (orientation: portrait), (max-width: 768px) {
                .card--wide-custom { width: 14em !important; }
                .card--history-custom { width: 14em !important; }
                .card--collection-btn { width: 14em !important; height: auto !important; aspect-ratio: 16/9; }
                .card--wide-custom .custom-overview-bottom { display: none !important; }
                .card--wide-custom .custom-title-bottom { font-size: 1em !important; margin-top: 0.1em; }
                .items-line[data-uas-title-row="true"] { margin-bottom: 0 !important; }
                .items-line[data-uas-content-row="true"] { margin-bottom: 0.2em !important; }
                .card--title-btn { margin: 0 !important; padding: 0.2em 1em !important; min-height: 2em !important; }
                .title-btn-text { font-size: 1.1em !important; }
            }
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
                window.uas_initial_bg_set = false; 
                
                var isMain = e.component === 'main' || e.component === 'tmdb';
                if (isMain || !e.component) {
                    document.body.classList.add('uas-main-active');
                    BgManager.show();
                } else {
                    document.body.classList.remove('uas-main-active');
                    BgManager.hide();
                }

                updateDynamicStyles();
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
            
            var isSpecialCard = isTitleBtn || isCollectionBtn || data.is_title_btn || data.is_collection_btn;

            if (!isSpecialCard) {
                originalOnVisible.apply(this, arguments);
            } else {
                this.visible = true; 
            }

            if (isSpecialCard) return;

            var view = html.querySelector('.card__view');
            var altDesignType = getAltDesignType();
            var isAlt1 = altDesignType === '1';
            var isAlt2 = altDesignType === '2';
            var useAltDesign = isAlt1 || isAlt2;
            var altToken = Lampa.Storage.get('uas_alt_design_apikey');
            
            var getContainer = function(posClass) {
                var clsName = 'badge-pos-' + posClass;
                var container = view.querySelector('.card-custom-badges.' + clsName);
                if (!container) {
                    container = document.createElement('div');
                    container.className = 'card-custom-badges ' + clsName;
                    view.appendChild(container);
                }
                return container;
            };

            var badgePos = Lampa.Storage.get('uas_alt_badge_pos') || 'tl';
            var ratingPos = Lampa.Storage.get('uas_alt_rating_pos') || 'tr';

            var targetContainer;
            var ratingContainer = getContainer(ratingPos); // Рейтинги завжди йдуть у свій флекс-контейнер

            if (useAltDesign) {
                if (view) html.classList.add('uas-alt-card');
                targetContainer = getContainer(badgePos); // В Альт дизайні базові бейджі йдуть у загальний флекс-контейнер
            } else {
                if (html.classList) html.classList.remove('uas-alt-card');
                targetContainer = view; // У Стандартному дизайні базові бейджі прив'язуються до кутів самої картки
            }

            // Перевірка налаштування відображення стандартного рейтингу
            var showRating = Lampa.Storage.get('uas_badge_rating');
            if (showRating === null || showRating === undefined || showRating === '') showRating = true;

            var vote = html.getElementsByClassName('card__vote');
            if (useAltDesign || !showRating) {
                for (let v = 0; v < vote.length; v++) {
                    vote[v].style.setProperty('display', 'none', 'important');
                    vote[v].style.setProperty('opacity', '0', 'important');
                }
                if (useAltDesign) {
                    var ratings = html.getElementsByClassName('card-rating');
                    for (let r = 0; r < ratings.length; r++) {
                        ratings[r].style.setProperty('display', 'none', 'important');
                    }
                }
            } else if (vote.length > 0 && !isWideCard && !isHistoryCard) {
                var color = getColor(parseFloat(vote[0].textContent.trim()), 0.8);
                if (color) vote[0].style.backgroundColor = color;
            }

            // Додавання Зовнішніх рейтингів та TMDB у вигляді бейджів
            if (Lampa.Storage.get('uas_ext_ratings_enable') === true && data.id && !isHistoryCard) {
                
                // Якщо увімкнено зовнішній бейдж TMDB на стандартному вигляді — приховуємо класичний рейтинг в правому нижньому куті
                if (!useAltDesign && Lampa.Storage.get('uas_ext_rt_tmdb', true)) {
                    for (let v = 0; v < vote.length; v++) {
                        vote[v].style.setProperty('display', 'none', 'important');
                    }
                }

                // Додаємо TMDB, якщо увімкнено
                if (Lampa.Storage.get('uas_ext_rt_tmdb', true) && data.vote_average > 0) {
                    let existing = ratingContainer.querySelector(`.ext-rt-tmdb`);
                    if (!existing) {
                        let badge = document.createElement('div');
                        badge.className = `ext-rt-tmdb ext-rating-badge`;
                        badge.innerHTML = `<img src="${rateIcons.tmdb}"><span>${data.vote_average.toFixed(1)}</span>`;
                        ratingContainer.appendChild(badge);
                    }
                }

                // Завантажуємо та додаємо зовнішні (OMDB/MDBList)
                fetchExtRatings(data.id, data.media_type || (data.name ? 'tv' : 'movie')).then(ratings => {
                    if (!ratings) return;
                    if (!cardInstance.html || !cardInstance.html.parentNode) return; 

                    ['imdb', 'rt', 'mc', 'letterboxd', 'trakt', 'mdblist', 'popcorn'].forEach(key => {
                        if (ratings[key] && Lampa.Storage.get('uas_ext_rt_' + key, true)) {
                            let existing = ratingContainer.querySelector(`.ext-rt-${key}`);
                            if (!existing) {
                                let badge = document.createElement('div');
                                badge.className = `ext-rt-${key} ext-rating-badge`;
                                let displayVal = formatExtRating(ratings[key], key);
                                if (displayVal) {
                                    badge.innerHTML = `<img src="${rateIcons[key]}"><span>${displayVal}</span>`;
                                    ratingContainer.appendChild(badge);
                                }
                            }
                        }
                    });
                });
            } else if (isAlt2 && !isHistoryCard && data.vote_average && showRating) {
                // Стандартна поведінка для Альт Вигляду 2, якщо зовнішні рейтинги вимкнені
                var voteValAlt = parseFloat(data.vote_average);
                if (!isNaN(voteValAlt) && voteValAlt > 0) {
                    var rBadge = view.querySelector('.card-alt-rating');
                    if (!rBadge) {
                        rBadge = document.createElement('div');
                        rBadge.className = 'card-alt-rating ext-rating-badge';
                        rBadge.innerHTML = `<img src="${rateIcons.tmdb}"><span>${voteValAlt.toFixed(1)}</span>`;
                        ratingContainer.appendChild(rBadge);
                    } else if (rBadge.parentNode !== ratingContainer) {
                        ratingContainer.appendChild(rBadge);
                    }
                }
            }

            // Завантаження постерів і лого для вертикальних карток в Альт Вигляді 2
            if (!isWideCard && !isHistoryCard && !isSpecialCard) {
                if (isAlt2 && data.id && !html.dataset.alt2LogoFetched) {
                    html.dataset.alt2LogoFetched = 'true';
                    fetchLogo(data, $(html));
                }
            }

            // --- ЗАВАНТАЖЕННЯ ЗОБРАЖЕНЬ З EASYRATINGSDB ТІЛЬКИ ДЛЯ АЛЬТ 1 ---
            if (isAlt1 && data.id && altToken) {
                if (!isHistoryCard) {
                    getImdbIdForTmdb(data.id, data.media_type || (data.name ? 'tv' : 'movie')).then(async function(imdb) {
                        if (imdb) {
                            var targetUrl = isWideCard 
                                ? 'https://easyratingsdb.com/' + altToken + '/backdrop/' + imdb + '.jpg'
                                : 'https://easyratingsdb.com/' + altToken + '/poster/' + imdb + '.jpg';
                                
                            var cachedUrl = await AltImageCache.get(targetUrl);

                            if (isWideCard) {
                                if (cachedUrl) {
                                    view.style.backgroundImage = 'url(' + cachedUrl + ')';
                                    data.custom_full_bg = targetUrl;
                                } else {
                                    var tempBg = new Image();
                                    tempBg.onload = function() {
                                        AltImageCache.setAndGet(targetUrl).then(finalUrl => {
                                            view.style.backgroundImage = 'url(' + finalUrl + ')';
                                            data.custom_full_bg = targetUrl;
                                        });
                                    };
                                    tempBg.src = targetUrl;
                                }
                            } else {
                                var img = html.querySelector('.card__img');
                                if (img) {
                                    var newImg = img.cloneNode(true);
                                    img.parentNode.replaceChild(newImg, img);
                                    
                                    if (cachedUrl) {
                                        newImg.src = cachedUrl;
                                    } else {
                                        var fallbackSrc = PROXIES[0] + Lampa.TMDB.image('t/p/w300' + data.poster_path);
                                        var tempImg = new Image();
                                        tempImg.onload = function() {
                                            AltImageCache.setAndGet(targetUrl).then(finalUrl => {
                                                newImg.classList.add('uas-poster-fade');
                                                setTimeout(() => {
                                                    newImg.src = finalUrl;
                                                    newImg.onload = () => {
                                                        newImg.classList.remove('uas-poster-fade');
                                                        newImg.classList.add('uas-poster-loaded');
                                                    };
                                                }, 50);
                                            });
                                        };
                                        tempImg.onerror = function() {
                                            newImg.src = fallbackSrc;
                                        };
                                        tempImg.src = targetUrl;
                                    }
                                }
                            }
                        }
                    });
                }
            }

            // Відображення бейджа Року
            var showYear = Lampa.Storage.get('uas_badge_year');
            if (showYear === null || showYear === undefined || showYear === '') showYear = true;

            if (view && data) {
                var ageBadge = view.querySelector('.card-badge-age');
                if (showYear) {
                    if (!ageBadge) {
                        var yearStr = (data.release_date || data.first_air_date || '').toString().substring(0, 4);
                        if (yearStr && yearStr.length === 4) {
                            ageBadge = document.createElement('div');
                            ageBadge.className = 'card-badge-age';
                            ageBadge.innerText = yearStr;
                            targetContainer.appendChild(ageBadge);
                        }
                    } else if (ageBadge.parentNode !== targetContainer) {
                        targetContainer.appendChild(ageBadge);
                    }
                } else if (ageBadge) {
                    ageBadge.style.setProperty('display', 'none', 'important');
                }
            }

            var showFlag = Lampa.Storage.get('uas_show_flag');
            if (showFlag === null || showFlag === undefined || showFlag === '') showFlag = true;
            else if (showFlag === 'false') showFlag = false;
            else if (showFlag === 'true') showFlag = true;

            // Відображення Прапорця UA
            if (showFlag && data.id) {
                var oldFlag = html.querySelector('.card__ua_flag');
                if (!oldFlag) {
                    var meta = createMediaMeta(data);
                    if (meta) {
                        var cached = lmeCache.get(meta.cacheKey);
                        if (cached === true) renderFlag(html, targetContainer, useAltDesign);
                        else if (cached !== false) {
                            loadFlag(meta).then(function (isSuccess) {
                                if (isSuccess && cardInstance.html && cardInstance.html.parentNode) renderFlag(cardInstance.html, targetContainer, useAltDesign);
                            });
                        }
                    }
                } else {
                    if (oldFlag.parentNode !== targetContainer) {
                        targetContainer.appendChild(oldFlag);
                    }
                    if (useAltDesign) oldFlag.innerText = 'UA';
                    else oldFlag.innerText = '';
                }
            } else if (!showFlag) {
                var oldFlagToRemove = html.querySelector('.card__ua_flag');
                if (oldFlagToRemove) oldFlagToRemove.remove();
            }

            // Відображення бейджа Сезону
            var showSeason = Lampa.Storage.get('uas_badge_season');
            if (showSeason === null || showSeason === undefined || showSeason === '') showSeason = true;

            if (showSeason && (data.media_type === 'tv' || data.name || data.number_of_seasons) && data.id) {
                fetchSeriesData(data.id).then(function(tmdbData) {
                    if (cardInstance.html && cardInstance.html.parentNode && cardInstance.data === data) {
                        renderSeasonBadge(cardInstance.html, tmdbData, targetContainer);
                    }
                }).catch(function(){});
            } else if (!showSeason) {
                var seasonBadge = html.querySelector('.card__type--season') || html.querySelector('.card__type');
                if (seasonBadge) seasonBadge.style.setProperty('display', 'none', 'important');
            }
        };

        overrideApi();
    }

    if (window.appready) start();
    else Lampa.Listener.follow('app', function (e) { if (e.type === 'ready') start(); });

})();