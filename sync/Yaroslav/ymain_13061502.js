
(function () {
    'use strict';

    if (typeof Lampa === 'undefined') return;

    var CONFIG = { 
        tmdbApiKey: '', 
        cacheTime: 23 * 60 * 60 * 1000, 
        language: 'uk',
        endpoint: 'https://wh.lme.isroot.in/',
        timeout: 6000, 
        queue: { maxParallel: 15 }, 
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
    ];

    const DEFAULT_ROWS_SETTINGS =[
        { id: 'ym_row_history', title: 'Історія перегляду', defOrder: '1', default: true },
        { id: 'ym_row_uaflix', title: 'UaFlix', defOrder: '2', default: true },
        { id: 'ym_row_movies_new', title: 'Новинки фільмів', defOrder: '3', default: true },
        { id: 'ym_row_series_new', title: 'Новинки серіалів', defOrder: '4', default: true },
        { id: 'ym_row_collections', title: 'Підбірки', defOrder: '5', default: true },
        { id: 'ym_row_kinobaza', title: 'Новинки Стрімінгів UA', defOrder: '6', default: true },
        { id: 'ym_row_community', title: 'Приховані геми LME', defOrder: '7', default: true },
        { id: 'ym_row_movies_watch', title: 'Популярні фільми', defOrder: '8', default: true },
        { id: 'ym_row_series_pop', title: 'Популярні серіали', defOrder: '9', default: true },
        { id: 'ym_row_random', title: 'Випадкові фільми', defOrder: '10', default: true }
    ];

    var inflight = {};
    var lmeCache = null;
    var listCache = {};      
    var tmdbItemCache = {};  
    var itemUrlCache = {};   
    var seasonsCache = {};
    var inflightRatings = {};
    var uaFlixDetailsCache = {};

    Lampa.Lang.add({
        main: 'Головна UA',
        title_main: 'Головна UA',
        title_tmdb: 'Головна UA'
    });

    var mdblistSvg = "data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' width='24' height='24' fill='%23ffffff' style='opacity:1;'%3E%3Cpath d='M1.928.029A2.47 2.47 0 0 0 .093 1.673c-.085.248-.09.629-.09 10.33s.005 10.08.09 10.33a2.51 2.51 0 0 0 1.512 1.558l.276.108h20.237l.277-.108a2.51 2.51 0 0 0 1.512-1.559c.085-.25.09-.63.09-10.33s-.005-10.08-.09-10.33A2.51 2.51 0 0 0 22.395.115l-.277-.109L12.117 0C6.615-.004 2.032.011 1.929.029m7.48 8.067l2.123 2.004v1.54c0 .897-.02 1.536-.043 1.527s-.92-.845-1.995-1.86c-1.071-1.01-1.962-1.84-1.977-1.84s-.024 1.91-.024 4.248v4.25H4.911V6.085h1.188l1.183.006zm9.729 3.93v5.94h-2.63l-.01-4.25l-.013-4.25l-1.907 1.795a367 367 0 0 1-1.98 1.864c-.076.056-.08-.047-.08-1.489v-1.555l2.127-1.995l2.127-1.995l1.187-.005h1.184z'/%3E%3C/svg%3E";
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

    function isMobile() {
        return window.innerWidth < 768 || window.innerHeight > window.innerWidth;
    }

    function getCardsLimit() {
        var val = Lampa.Storage.get('uas_row_cards_count');
        var num = parseInt(val, 10);
        return isNaN(num) ? 10 : num;
    }

    function isLazyLoadEnabled() {
        return Lampa.Storage.get('uas_lazy_load') !== false;
    }

    var Cache7Days = {
        ttl: 7 * 24 * 60 * 60 * 1000, 
        get: function(key) {
            var data = Lampa.Storage.get(key);
            if (data && typeof data === 'object' && data.time) {
                if (Date.now() - data.time < this.ttl) return data.val;
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
                    if (key && prefixes.some(function(p) { return key.startsWith(p); })) {
                        var data = Lampa.Storage.get(key);
                        if (!data || !data.time || (now - data.time > ttl)) keysToRemove.push(key);
                    }
                }
                var mem = Lampa.Storage.get('@@', true) || {};
                keysToRemove.forEach(function(k) {
                    if(mem[k]) delete mem[k];
                    localStorage.removeItem(k);
                });
            } catch(e){}
        }, 5000); 
    }

    function getAltDesignType() {
        var t = Lampa.Storage.get('uas_alt_design_type');
        if (t !== null && t !== undefined && t !== '') return String(t);
        return Lampa.Storage.get('uas_alt_design_enable') ? '1' : '0';
    }
    
    function getBgMode() {
        var m = Lampa.Storage.get('uas_bg_mode');
        if (m === null || m === undefined || m === '') return '1';
        return String(m);
    }

    function updateDynamicStyles() {
        var altType = getAltDesignType();
        if (altType === '1' || altType === '2') {
            document.body.classList.add('uas-alt-design-active');
        } else {
            document.body.classList.remove('uas-alt-design-active');
        }
        if (altType === '2') {
            document.body.classList.add('uas-alt-design-2');
        } else {
            document.body.classList.remove('uas-alt-design-2');
        }

        var badgeSize = Lampa.Storage.get('uas_alt_badge_size') || '0.7';
        document.body.style.setProperty('--uas-badge-size', badgeSize + 'em');

        var hideText = Lampa.Storage.get('uas_text_hide');
        if (hideText === true || hideText === 'true') {
            document.body.classList.add('uas-hide-text');
        } else {
            document.body.classList.remove('uas-hide-text');
        }

        document.body.style.setProperty('--uas-text-align', Lampa.Storage.get('uas_text_align') || 'center');
        document.body.style.setProperty('--uas-desc-align', Lampa.Storage.get('uas_text_desc_align') || 'left');
        document.body.style.setProperty('--uas-title-size', (Lampa.Storage.get('uas_text_title_size') || '1.1') + 'em');
        document.body.style.setProperty('--uas-desc-size', (Lampa.Storage.get('uas_text_desc_size') || '0.85') + 'em');

        var bgMode = getBgMode();
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
                window.localStorage.setItem('__t__', '1');
                window.localStorage.removeItem('__t__');
                return window.localStorage;
            }
        } catch (e) {}
        return {
            getItem: function (k) { return memoryStore[k] || null; },
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
        var self = this, storage = {};
        function cleanupExpired() {
            var now = Date.now(), changed = false;
            for (var key in storage) {
                var node = storage[key];
                if (!node || !node.timestamp) { delete storage[key]; changed = true; continue; }
                if (node.timestamp <= now - (node.value ? config.positiveTtl : config.negativeTtl)) {
                    delete storage[key]; changed = true;
                }
            }
            if (changed) self.save();
        }
        self.save = debounce(function () { Lampa.Storage.set(config.key, storage); }, 400);
        self.init = function () { storage = Lampa.Storage.get(config.key, {}) || {}; cleanupExpired(); };
        self.get = function (id) {
            var node = storage[id];
            if (!node || !node.timestamp) return null;
            if (node.timestamp > Date.now() - (node.value ? config.positiveTtl : config.negativeTtl)) return node.value;
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
        index: {}, supported: ('caches' in window), activeBlobUrls: [],
        init: function() {
            try { this.index = JSON.parse(Lampa.Storage.get('uas_alt_img_index') || '{}'); this.cleanup(); } catch(e) { this.index = {}; }
        },
        saveIndex: debounce(function() { Lampa.Storage.set('uas_alt_img_index', JSON.stringify(this.index)); }, 1000),
        revokeOldBlobs: function() {
            while (this.activeBlobUrls.length > 150) {
                try { URL.revokeObjectURL(this.activeBlobUrls.shift()); } catch(e) {}
            }
        },
        cleanup: async function() {
            if (!this.supported) return;
            try {
                let now = Date.now(), cache = await caches.open(ALT_CACHE_NAME), changed = false;
                for (let url in this.index) {
                    if (now - this.index[url].time > CACHE_TTL_MS) { await cache.delete(url); delete this.index[url]; changed = true; }
                }
                
                let totalSize = Object.keys(this.index).reduce((acc, k) => acc + (this.index[k].size || 50000), 0);
                if (totalSize > MAX_CACHE_SIZE_MB * 1024 * 1024) {
                    let sortedKeys = Object.keys(this.index).sort((a, b) => this.index[a].time - this.index[b].time);
                    while (totalSize > MAX_CACHE_SIZE_MB * 1024 * 1024 && sortedKeys.length > 0) {
                        let oldestUrl = sortedKeys.shift();
                        totalSize -= (this.index[oldestUrl].size || 50000);
                        await cache.delete(oldestUrl); delete this.index[oldestUrl]; changed = true;
                    }
                }
                if (changed) this.saveIndex();
            } catch(e) {}
        },
        get: async function(url) {
            if (!this.supported || !this.index[url]) return null;
            try {
                let cache = await caches.open(ALT_CACHE_NAME), res = await cache.match(url);
                if (res) {
                    this.index[url].time = Date.now(); this.saveIndex();
                    let objUrl = URL.createObjectURL(await res.blob());
                    this.activeBlobUrls.push(objUrl); this.revokeOldBlobs();
                    return objUrl;
                }
            } catch(e) {} return null;
        },
        setAndGet: async function(url) {
            if (!this.supported) return url;
            try {
                let res = await fetch(url);
                if (res.ok) {
                    let clone = res.clone(), blob = await res.blob(), cache = await caches.open(ALT_CACHE_NAME);
                    await cache.put(url, clone);
                    this.index[url] = { time: Date.now(), size: blob.size };
                    this.saveIndex(); this.cleanup();
                    let objUrl = URL.createObjectURL(blob);
                    this.activeBlobUrls.push(objUrl); this.revokeOldBlobs();
                    return objUrl;
                }
            } catch(e) {} return url; 
        }
    };

    var BgManager = {
        container: null, layer1: null, layer2: null, currentLayer: 1, activeUrl: '', timer: null,
        init: function() {
            if (this.container) return;
            this.container = document.createElement('div'); this.container.id = 'uas-bg-container';
            this.layer1 = document.createElement('div'); this.layer1.className = 'uas-bg-layer active';
            this.layer2 = document.createElement('div'); this.layer2.className = 'uas-bg-layer';
            this.container.appendChild(this.layer1); this.container.appendChild(this.layer2);
            document.body.appendChild(this.container);
        },
        change: function(url, instant) {
            if (getBgMode() === '0' || !url || this.activeUrl === url) return;
            clearTimeout(this.timer);
            var _this = this;
            var execute = function() {
                _this.activeUrl = url;
                var nextLayer = _this.currentLayer === 1 ? _this.layer2 : _this.layer1;
                var activeLayer = _this.currentLayer === 1 ? _this.layer1 : _this.layer2;
                nextLayer.style.backgroundImage = 'url(' + url + ')';
                nextLayer.classList.add('active'); activeLayer.classList.remove('active');
                _this.currentLayer = _this.currentLayer === 1 ? 2 : 1;
            };
            if (instant) {
                execute();
            } else {
                this.timer = setTimeout(execute, 0);
            }
        },
        hide: function() { if (this.container) this.container.style.display = 'none'; },
        show: function() { if (this.container) this.container.style.display = 'block'; }
    };

    var LazyLoader = {
        observer: null,
        init: function() {
            if (this.observer) return;
            this.observer = new IntersectionObserver((entries, observer) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        var el = entry.target;
                        if (el._lazyQueue) { el._lazyQueue.forEach(fn => fn()); delete el._lazyQueue; }
                        observer.unobserve(el);
                    }
                });
            }, { rootMargin: '500px' }); 
        },
        add: function(el, fn) {
            this.init();
            if (!el._lazyQueue) { el._lazyQueue = []; this.observer.observe(el); }
            el._lazyQueue.push(fn);
        }
    };

    var requestQueue = {
        activeCount: 0, queue:[], maxParallel: CONFIG.queue.maxParallel,
        add: function (task) { this.queue.push(task); this.process(); },
        process: function () {
            var _this = this;
            while (this.activeCount < this.maxParallel && this.queue.length) {
                var task = this.queue.shift(); this.activeCount++;
                Promise.resolve().then(task).catch(()=>{})["finally"](function() { _this.activeCount--; _this.process(); });
            }
        }
    };

    async function fetchHtml(url, timeoutMs) {
        if (!timeoutMs) timeoutMs = 5000;
        for (let i = 0; i < PROXIES.length; i++) {
            try {
                let proxy = PROXIES[i];
                let fetchUrl = proxy.indexOf('?url=') !== -1 ? proxy + encodeURIComponent(url) : proxy + url;
                let fetchPromise = fetch(fetchUrl);
                let timeoutPromise = new Promise(function(_, reject) { setTimeout(function() { reject(new Error('timeout')); }, timeoutMs); });
                
                let res = await Promise.race([fetchPromise, timeoutPromise]);
                if (res.ok) {
                    let text = await res.text();
                    if (text && text.length > 500 && text.indexOf('<html') !== -1 && text.indexOf('just a moment...') === -1) {
                        return text;
                    }
                }
            } catch (e) {}
        }
        return '';
    }

    async function fetchUaFlixHtml(url, timeoutMs) {
        if (!timeoutMs) timeoutMs = 3000;
        for (let i = 0; i < PROXIES.length; i++) {
            try {
                let proxy = PROXIES[i];
                let fetchUrl = proxy.indexOf('?url=') !== -1 ? proxy + encodeURIComponent(url) : proxy + url;
                
                let fetchPromise = fetch(fetchUrl);
                let timeoutPromise = new Promise(function(_, reject) { setTimeout(function() { reject(new Error('timeout')); }, timeoutMs); });
                
                let res = await Promise.race([fetchPromise, timeoutPromise]);
                if (res.ok) {
                    let text = await res.text();
                    if (text && text.length > 500 && text.indexOf('<html') !== -1 && text.indexOf('just a moment...') === -1) {
                        return text;
                    }
                }
            } catch (e) {}
        }
        return '';
    }

    async function fetchUaFlixHtmlPost(url, paramsObj, timeoutMs) {
        if (!timeoutMs) timeoutMs = 4000;
        
        let bodyParts = [];
        for (let key in paramsObj) {
            bodyParts.push(encodeURIComponent(key) + '=' + encodeURIComponent(paramsObj[key]));
        }
        let bodyStr = bodyParts.join('&');

        for (let i = 0; i < PROXIES.length; i++) {
            let proxy = PROXIES[i];
            if (proxy.indexOf('allorigins') !== -1) continue; 
            
            try {
                let fetchUrl = proxy.indexOf('?url=') !== -1 ? proxy + encodeURIComponent(url) : proxy + url;
                let fetchPromise = fetch(fetchUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
                        'X-Requested-With': 'XMLHttpRequest'
                    },
                    body: bodyStr
                });
                let timeoutPromise = new Promise(function(_, reject) { setTimeout(function() { reject(new Error('timeout')); }, timeoutMs); });
                
                let res = await Promise.race([fetchPromise, timeoutPromise]);
                if (res.ok) {
                    let text = await res.text();
                    if (text && text.length > 50 && text.indexOf('just a moment...') === -1) {
                        return text;
                    }
                }
            } catch (e) {}
        }
        return '';
    }

    function getTmdbKey() {
        return (Lampa.Storage.get('uas_pro_tmdb_apikey') || '').trim() || CONFIG.tmdbApiKey || (Lampa.TMDB && Lampa.TMDB.key ? Lampa.TMDB.key() : '4ef0d7355d9ffb5151e987764708ce96');
    }

    function getTmdbEndpoint(path) {
        let url = Lampa.TMDB.api(path);
        if (url.indexOf('api_key') === -1) url += (url.indexOf('?') !== -1 ? '&' : '?') + 'api_key=' + getTmdbKey();
        return url.startsWith('http') ? url : 'https://api.themoviedb.org/3/' + url;
    }

    async function getImdbIdForTmdb(tmdbId, type) {
        if (!tmdbId) return null;
        let cacheKey = 'alt_imdb_v1_' + tmdbId, cached = Cache7Days.get(cacheKey);
        if (cached) return cached;
        try {
            let res = await fetch(PROXIES[0] + getTmdbEndpoint(`${type}/${tmdbId}/external_ids`)).then(r => r.json());
            if (res && res.imdb_id) { Cache7Days.set(cacheKey, res.imdb_id); return res.imdb_id; }
        } catch(e) {}
        return null;
    }

    function safeFetch(url, timeoutMs = 5000) {
        return new Promise((resolve, reject) => {
            var xhr = new XMLHttpRequest(); xhr.open('GET', url, true);
            xhr.timeout = timeoutMs;
            xhr.onreadystatechange = () => {
                if (xhr.readyState === 4) {
                    if (xhr.status >= 200 && xhr.status < 300) resolve({ ok: true, json: () => Promise.resolve(JSON.parse(xhr.responseText)) });
                    else reject(new Error('HTTP ' + xhr.status));
                }
            };
            xhr.ontimeout = () => reject(new Error('timeout'));
            xhr.onerror = () => reject(new Error('Network error')); xhr.send(null);
        });
    }

    function fetchCommunityWatches(url) {
        return new Promise((resolve, reject) => {
            if (window.Lampa && Lampa.Network) Lampa.Network.silent(url, resolve, reject);
            else safeFetch(url).then(r=>r.json()).then(resolve).catch(reject);
        });
    }

    async function fetchTmdbWithFallback(type, id) {
        let res = await fetch(PROXIES[0] + getTmdbEndpoint(`${type}/${id}?language=uk`)).then(r=>r.json()).catch(()=>null);
        if (res && (!res.overview || !res.overview.trim())) {
            let enRes = await fetch(PROXIES[0] + getTmdbEndpoint(`${type}/${id}?language=en`)).then(r=>r.json()).catch(()=>null);
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
            inflight[meta.cacheKey] = new Promise(resolve => {
                requestQueue.add(() => {
                    var url = CONFIG.endpoint + '?tmdb_id=' + encodeURIComponent(meta.tmdbId) + '&serial=' + meta.serial + '&silent=true';
                    return new Promise(res => { Lampa.Network.silent(url, r => res(isSuccessResponse(r)), () => res(false), null, { timeout: CONFIG.timeout }); })
                    .then(isSuccess => { lmeCache.set(meta.cacheKey, isSuccess); resolve(isSuccess); })
                    .finally(() => delete inflight[meta.cacheKey]);
                });
            });
        }
        return inflight[meta.cacheKey];
    }

    async function fetchExtRatings(tmdbId, type) {
        let cacheKey = 'ext_ratings_v1_' + tmdbId, cached = Cache7Days.get(cacheKey);
        if (cached) return cached;
        if (!inflightRatings[tmdbId]) {
            inflightRatings[tmdbId] = (async () => {
                let imdbId = await getImdbIdForTmdb(tmdbId, type), results = {};
                if (!imdbId) return results;
                let omdbKey = Lampa.Storage.get('uas_omdb_api_key', '').trim(), mdblistKey = Lampa.Storage.get('uas_mdblist_api_key', '').trim();
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
                            (mdbRes.ratings || []).forEach(r => {
                                if (r.source === 'trakt') results.trakt = r.value;
                                if (r.source === 'letterboxd') results.letterboxd = r.value;
                                if (r.source === 'tomatoesaudience') results.popcorn = r.value;
                                if (r.source === 'metacritic' && !results.mc) results.mc = r.value;
                                if (r.source === 'tomatoes' && !results.rt) results.rt = r.value;
                                if (r.source === 'imdb' && !results.imdb) results.imdb = r.value;
                            });
                        }
                    } catch(e) {}
                }
                Cache7Days.set(cacheKey, results); return results;
            })();
        }
        return await inflightRatings[tmdbId];
    }

    function formatExtRating(val, key) {
        let num = parseFloat(val);
        if (isNaN(num) || num <= 0) return null;
        if (key === 'letterboxd') num *= 2;
        else if (['mc', 'rt', 'mdblist', 'popcorn', 'trakt'].indexOf(key) !== -1 && num > 10) num /= 10;
        return num.toFixed(1);
    }

    function renderFlag(cardHtml, targetContainer, useAltDesign) {
        var view = cardHtml.querySelector('.card__view');
        if (!view || cardHtml.querySelector('.card__ua_flag')) return;
        var badge = document.createElement('div'); badge.className = 'card__ua_flag';
        if (useAltDesign) badge.innerText = 'UA';
        (targetContainer || view).appendChild(badge);
    }

    function fetchSeriesData(tmdbId) {
        return new Promise((resolve, reject) => {
            var now = Date.now();
            if (seasonsCache[tmdbId] && (now - seasonsCache[tmdbId].timestamp < CONFIG.cacheTime)) return resolve(seasonsCache[tmdbId].data);
            if (window.Lampa && Lampa.TMDB && typeof Lampa.TMDB.tv === 'function') {
                Lampa.TMDB.tv(tmdbId, data => {
                    seasonsCache[tmdbId] = { data: data, timestamp: now };
                    try { safeStorage.setItem('seasonBadgeCacheV5', JSON.stringify(seasonsCache)); } catch (e) {}
                    resolve(data);
                }, reject, { language: CONFIG.language });
            } else {
                safeFetch('https://api.themoviedb.org/3/tv/' + tmdbId + '?api_key=' + getTmdbKey() + '&language=' + CONFIG.language)
                .then(r => r.json()).then(data => {
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
        var currentSeason = tmdbData.seasons && tmdbData.seasons.find(s => s.season_number === last.season_number);
        if (currentSeason && last.season_number > 0) {
            var isComplete = currentSeason.episode_count > 0 && last.episode_number >= currentSeason.episode_count;
            var text = isComplete ? "S" + last.season_number : "S" + last.season_number + " " + last.episode_number + "/" + currentSeason.episode_count;
            var finalContainer = targetContainer || cardHtml.querySelector('.card__view');
            if (!finalContainer) return;
            var typeBadge = cardHtml.querySelector('.card__type');
            if (!typeBadge) { typeBadge = document.createElement('div'); typeBadge.className = 'card__type'; finalContainer.appendChild(typeBadge); }
            else if (typeBadge.parentNode !== finalContainer) finalContainer.appendChild(typeBadge);
            
            typeBadge.innerHTML = text; typeBadge.classList.add('card__type--season'); typeBadge.style.display = 'flex';
            var altType = getAltDesignType();
            if (altType !== '1' && altType !== '2') typeBadge.style.backgroundColor = isComplete ? 'rgba(46, 204, 113, 0.8)' : 'rgba(170, 20, 20, 0.8)';
            else typeBadge.style.backgroundColor = ''; 
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
        let doc = new DOMParser().parseFromString(html, "text/html"), links =[];
        let els = doc.querySelectorAll('a[href]');
        for (let i = 0; i < els.length; i++) {
            let a = els[i];
            let href = a.getAttribute('href');
            if (href && href.match(/\/\d+-[^/]+\.html$/) && href.indexOf('#') === -1) {
                let fullUrl = href.startsWith('http') ? href : 'https://uaserials.com' + href;
                if (links.indexOf(fullUrl) === -1) links.push(fullUrl);
            }
        }
        return links;
    }

    function extractUaserialsCollections(html) {
        let doc = new DOMParser().parseFromString(html, "text/html"), results =[], seen = {};
        let els = doc.querySelectorAll('a[href*="/collections/"]');
        for (let i = 0; i < els.length; i++) {
            let a = els[i];
            let href = a.getAttribute('href');
            if (href && href.match(/\/collections\/\d+/) && href.indexOf('/page/') === -1) {
                let fullUrl = href.startsWith('http') ? href : 'https://uaserials.com' + href;
                let title = (a.querySelector('img') ? a.querySelector('img').getAttribute('alt') : '') || a.textContent.trim();
                if (!title && a.closest && a.closest('.short, .collection-item, article')) {
                    let titleEl = a.closest('.short, .collection-item, article').querySelector('.short-title, .title, .name, h2, h3, .collection-title');
                    if (titleEl) title = titleEl.textContent.trim();
                }
                title = title.replace(/[\n\r]+/g, ' ').replace(/\s*\d+\s*$/, '').trim();
                if (title && title.length > 2 && !seen[fullUrl]) { seen[fullUrl] = true; results.push({ title: title, url: fullUrl }); }
            }
        }
        return results;
    }

    // --- UaFlix Fetcher ---
    function extractUaFlixLinks(html) {
        let doc = new DOMParser().parseFromString(html, "text/html"), links = [], seen = {};
        let container = doc.querySelector('#dle-content') || doc.querySelector('.main') || doc.querySelector('main') || doc.body;
        if (!container) container = doc;

        let els = container.querySelectorAll('a[href]');
        for (let i = 0; i < els.length; i++) {
            let a = els[i];
            let href = a.getAttribute('href');
            if (href && (href.indexOf('/films/') !== -1 || href.indexOf('/serials/') !== -1 || href.indexOf('/cartoons/') !== -1)) {
                let path = href.replace(/^https?:\/\/[^\/]+/, '').split('?')[0].split('#')[0];
                let parts = path.split('/').filter(Boolean);
                
                if (parts.length >= 2 && path.indexOf('page/') === -1) {
                    let isNav = false;
                    if (a.closest) {
                        isNav = a.closest('nav, header, footer, .sidebar, .menu, .sort, .navigation, .sect-header, .sect-content-top');
                    }
                    if (!isNav) {
                        let fullUrl = href.startsWith('http') ? href : (href.startsWith('/') ? 'https://uafix.net' + href : 'https://uafix.net/' + href);
                        if (!seen[fullUrl]) { 
                            seen[fullUrl] = true; 
                            links.push(fullUrl); 
                        }
                    }
                }
            }
        }
        return links;
    }

    function extractUaFlixDetails(itemHtml, link) {
        let doc = new DOMParser().parseFromString(itemHtml, "text/html");
        let origTitle = '', year = '';
        let type = link.indexOf('/serials/') !== -1 ? 'tv' : link.indexOf('/films/') !== -1 ? 'movie' : null;

        let engRus = doc.querySelector('.eng-rus');
        if (engRus && engRus.textContent.trim()) {
            origTitle = engRus.textContent.split('/')[0].replace(/['"«»]/g, '').trim();
        } else {
            let lis = doc.querySelectorAll('ul.finfo li');
            for (let i = 0; i < lis.length; i++) {
                let tc = lis[i].textContent;
                if (tc.indexOf('Ориг. назва:') !== -1 || tc.indexOf('Оригінальна назва:') !== -1) {
                    let clone = lis[i].cloneNode(true);
                    let s = clone.querySelector('span');
                    if (s) s.remove();
                    let ah = clone.querySelector('[itemprop="alternativeHeadline"]');
                    if (ah) ah.remove();
                    
                    origTitle = clone.textContent.trim().split('/')[0].replace(/['"«»]/g, '').trim();
                    break;
                }
            }
        }

        if (!origTitle) {
            let altHead = doc.querySelector('[itemprop="alternativeHeadline"]');
            if (altHead && altHead.textContent.trim()) {
                origTitle = altHead.textContent.split('/')[0].replace(/['"«»]/g, '').trim();
            }
        }

        if (!origTitle) {
            let h1 = doc.querySelector('h1[itemprop="name"]');
            if (h1 && h1.textContent.trim()) {
                let h1Text = h1.textContent.replace(/['"«»]/g, '').trim();
                let parts = h1Text.split('/');
                if (parts.length > 1) {
                    origTitle = parts[1].replace(/\(\d{4}\).*/, '').trim();
                } else {
                    origTitle = h1Text.replace(/\(\d{4}\).*/, '').trim();
                }
            }
        }

        let yearSpan = doc.querySelector('.year');
        if (yearSpan && yearSpan.textContent.trim()) {
            year = yearSpan.textContent.split('/')[0].trim();
        } else {
            let lis = doc.querySelectorAll('ul.finfo li');
            for (let i = 0; i < lis.length; i++) {
                if (lis[i].textContent.indexOf('Рік виходу:') !== -1) {
                    let clone = lis[i].cloneNode(true);
                    let s = clone.querySelector('span');
                    if (s) s.remove();
                    year = clone.textContent.trim().split('/')[0].trim();
                    break;
                }
            }
        }

        if (!year) {
            let my = doc.querySelector('a[href*="/year/"]');
            if (my) year = my.textContent.trim();
        }

        origTitle = origTitle.replace(/\u00A0/g, ' ').replace(/\s+/g, ' ').trim();
        year = year.replace(/\D/g, ''); 
        if (year.length > 4) year = year.substring(0, 4);

        return { title: origTitle, year: year, type: type };
    }

    async function fetchUaFlixCatalog(url, limit, noCache) {
        if (!noCache && listCache[url]) return listCache[url];
        
        let html = '';
        if (url.indexOf('page/') !== -1) {
            html = await fetchUaFlixHtml(url, 4000);
        } else {
            html = await fetchUaFlixHtmlPost(url, { 'xf_sort': 'get', 'xf_field': 'default', 'xf_value': 'date' }, 4000);
            if (!html || html.length < 100) html = await fetchUaFlixHtml(url, 4000); 
        }

        let rawLinks = extractUaFlixLinks(html);
        let excludeWords = ['action', 'comedy', 'drama', 'thriller', 'horror', 'detective', 'melodrama', 'fantasy', 'adventure', 'family', 'anime', 'documentary', 'biography', 'history', 'sport', 'music', 'western', 'war', 'ukrainian', 'dubbing'];
        
        let links = [];
        for (let i = 0; i < rawLinks.length; i++) {
            let p = rawLinks[i].split('/').filter(Boolean);
            let lastPart = p[p.length - 1] || '';
            if (excludeWords.indexOf(lastPart.toLowerCase()) === -1) {
                links.push(rawLinks[i]);
            }
        }

        let finalItems = [];
        let unique = {};
        
        let resultsArray = new Array(links.length).fill(null);
        let index = 0;
        let concurrency = 10; 

        await new Promise(resolve => {
            let active = 0;
            function next() {
                let currentValidCount = resultsArray.filter(Boolean).length;
                if (currentValidCount >= limit || (index >= links.length && active === 0)) {
                    resolve();
                    return;
                }
                while (active < concurrency && index < links.length && currentValidCount < limit) {
                    let currentIndex = index++;
                    let link = links[currentIndex];
                    active++;
                    
                    (function(cIndex, cLink) {
                        Promise.resolve().then(async function() {
                            try {
                                let details = uaFlixDetailsCache[cLink];
                                if (!details) {
                                    let itemHtml = await fetchUaFlixHtml(cLink, 2500); 
                                    if (itemHtml) {
                                        details = extractUaFlixDetails(itemHtml, cLink);
                                        if (details && details.title && details.year) {
                                            uaFlixDetailsCache[cLink] = details;
                                        }
                                    }
                                }
                                
                                if (details && details.title && details.year) {
                                    let tmdbRes = await searchTmdbByTitleAndYear(details.title, details.year, details.type);
                                    if (tmdbRes && tmdbRes.id && (tmdbRes.backdrop_path || tmdbRes.poster_path) && !unique[tmdbRes.id]) {
                                        unique[tmdbRes.id] = true;
                                        resultsArray[cIndex] = tmdbRes;
                                    }
                                }
                            } catch(e) {}
                            active--;
                            next();
                        });
                    })(currentIndex, link);
                }
            }
            next();
        });

        finalItems = resultsArray.filter(Boolean).slice(0, limit);
        if (!noCache && finalItems.length) listCache[url] = finalItems; 
        return finalItems;
    }
    // --- UaFlix Fetcher END ---

    function extractKinobazaItems(html) {
        let doc = new DOMParser().parseFromString(html, "text/html"), results =[], seen = {};
        let els = doc.querySelectorAll('h4.text-muted.h6.d-inline-block');
        for (let j = 0; j < els.length; j++) {
            let h4 = els[j];
            let enTitle = h4.textContent.trim(), container = h4.parentElement, small = null;
            for (let i = 0; i < 5 && container && container.tagName !== 'BODY'; i++) {
                small = container.querySelector('small.text-muted');
                if (small && small.textContent.match(/\(\d{4}\)/)) break;
                small = null; container = container.parentElement;
            }
            let year = small ? (small.textContent.match(/\((\d{4})\)/) || [])[1] : null;
            let isTv = /Серіал|сезон|епізод|Мінісеріал/i.test(container ? container.textContent : h4.parentElement.textContent);
            let expectedType = isTv ? 'tv' : 'movie', key = enTitle + year + expectedType;
            if (enTitle && year && !seen[key]) { seen[key] = true; results.push({ title: enTitle, year: year, type: expectedType }); }
        }
        if (!results.length) {
            let aEls = doc.querySelectorAll('a[href^="/titles/"]');
            for (let j = 0; j < aEls.length; j++) {
                let a = aEls[j];
                let title = a.textContent.trim();
                if (title.length > 1) {
                    let year = null, container = a.parentElement;
                    for (let i = 0; i < 4 && container && container.tagName !== 'BODY'; i++) {
                        let text = container.textContent, yearMatch = text.match(/(?:^|\s|\()((?:19|20)\d{2})(?:\)|\s|$)/);
                        if (yearMatch) { year = yearMatch[1]; break; }
                        container = container.parentElement;
                    }
                    if (!year) year = (a.getAttribute('href').match(/(?:19|20)\d{2}/) || [])[0];
                    let isTv = /Серіал|сезон|епізод|Мінісеріал/i.test(container ? container.textContent : a.parentElement.textContent);
                    let expectedType = isTv ? 'tv' : 'movie';
                    if (year && !seen[title + year + expectedType]) {
                        seen[title + year + expectedType] = true; results.push({ title: title, year: year, type: expectedType });
                    }
                }
            }
        }
        return results;
    }

    async function getImdbId(url) {
        if (itemUrlCache[url]) return itemUrlCache[url];
        let html = await fetchHtml(url);
        let id = html ? html.match(/imdb\.com\/title\/(tt\d+)/i) : null;
        if (id) itemUrlCache[url] = id[1]; return id ? id[1] : null;
    }

    async function processInQueue(items, processFn, concurrency) {
        let results = new Array(items.length), index = 0;
        let workers = [];
        for (let w = 0; w < (concurrency || 10); w++) { 
            workers.push((async () => {
                while (index < items.length) {
                    let i = index++;
                    try { let res = await processFn(items[i]); if (res) results[i] = res; } catch (e) {}
                }
            })());
        }
        await Promise.all(workers); return results.filter(Boolean);
    }

    async function processSingleItem(url) {
        let imdb = await getImdbId(url);
        if (!imdb) return null;
        if (tmdbItemCache[imdb]) return tmdbItemCache[imdb];
        try {
            let data = await fetch(PROXIES[0] + getTmdbEndpoint(`find/${imdb}?external_source=imdb_id&language=uk`)).then(r => r.json());
            let res = data.movie_results && data.movie_results.length ? Object.assign({}, data.movie_results[0], { media_type: 'movie' }) : data.tv_results && data.tv_results.length ? Object.assign({}, data.tv_results[0], { media_type: 'tv' }) : null;
            if (res && (!res.overview || !res.overview.trim())) {
                let enData = await fetch(PROXIES[0] + getTmdbEndpoint(`find/${imdb}?external_source=imdb_id&language=en`)).then(r => r.json());
                let enRes = enData.movie_results && enData.movie_results.length ? enData.movie_results[0] : enData.tv_results && enData.tv_results.length ? enData.tv_results[0] : null;
                if (enRes && enRes.overview) res.overview = enRes.overview;
            }
            if (res) tmdbItemCache[imdb] = res; return res;
        } catch(e) { return null; }
    }

    async function searchTmdbByTitleAndYear(title, year, expectedType) {
        let cacheKey = 'kinobaza_search_' + title + '_' + year + '_' + (expectedType || 'any');
        if (tmdbItemCache[cacheKey]) return tmdbItemCache[cacheKey];
        let endpoints = expectedType === 'tv' ? ['search/tv', 'search/multi'] : expectedType === 'movie' ? ['search/movie', 'search/multi'] : ['search/multi'];
        
        let bestResult = null;
        let bestScore = -1;

        function cleanStr(str) {
            return (str || '').toLowerCase().replace(/[^\wа-яА-ЯёЁіІїЇєЄґҐ]/g, '');
        }

        for (let pIdx = 0; pIdx < endpoints.length; pIdx++) {
            let path = endpoints[pIdx];
            try {
                let dataUk = await fetch(PROXIES[0] + getTmdbEndpoint(`${path}?query=${encodeURIComponent(title)}&language=uk`)).then(r => r.json());
                let dataEn = await fetch(PROXIES[0] + getTmdbEndpoint(`${path}?query=${encodeURIComponent(title)}&language=en`)).then(r => r.json());
                
                let combined = (dataUk.results || []).concat(dataEn.results || []);
                let uniqueIds = {};
                let results = [];
                for (let i = 0; i < combined.length; i++) {
                    let r = combined[i];
                    if (!uniqueIds[r.id]) {
                        uniqueIds[r.id] = true;
                        results.push(r);
                    }
                }

                if (results.length) {
                    for (let i = 0; i < results.length; i++) {
                        let r = results[i];
                        let rType = r.media_type || expectedType || (r.first_air_date ? 'tv' : 'movie');
                        if (expectedType && rType !== expectedType && path.indexOf('search/multi') !== -1) continue;

                        let rYear = (r.release_date || r.first_air_date || '').substring(0, 4);
                        let yearDiff = Math.abs(parseInt(rYear) - parseInt(year));
                        if (isNaN(yearDiff)) yearDiff = 10;

                        if (yearDiff <= 1 || !year) {
                            let score = 0;
                            if (yearDiff === 0) score += 30;
                            else if (yearDiff === 1) score += 10;
                            
                            let t1 = (r.title || r.name || '').toLowerCase().trim();
                            let t2 = (r.original_title || r.original_name || '').toLowerCase().trim();
                            let s = title.toLowerCase().trim();
                            
                            let c1 = cleanStr(t1), c2 = cleanStr(t2), cs = cleanStr(s);

                            if (t1 === s || t2 === s) score += 50;
                            else if ((c1 === cs && cs.length > 0) || (c2 === cs && cs.length > 0)) score += 40;
                            else if (t1.startsWith(s) || t2.startsWith(s)) score += 15;
                            else if (t1.indexOf(s) !== -1 || t2.indexOf(s) !== -1 || s.indexOf(t1) !== -1 || s.indexOf(t2) !== -1) score += 5;
                            
                            if (score > bestScore) {
                                bestScore = score;
                                bestResult = r;
                            }
                        }
                    }
                }
            } catch(e) {}
            
            if (bestResult && bestScore >= 70) break;
        }
        
        if (bestResult) {
            let res = bestResult;
            if (!res.overview || !res.overview.trim()) {
                try {
                    let enType = res.media_type || expectedType || (res.first_air_date ? 'tv' : 'movie');
                    let enData = await fetch(PROXIES[0] + getTmdbEndpoint(`${enType}/${res.id}?language=en`)).then(r => r.json());
                    if (enData && enData.overview) res.overview = enData.overview;
                } catch(e) {}
            }
            res.media_type = res.media_type || expectedType || (res.first_air_date ? 'tv' : 'movie');
            tmdbItemCache[cacheKey] = res; 
            return res;
        }
        return null;
    }

    async function fetchCatalogPage(url, limit) {
        if (!limit) limit = 10;
        if (listCache[url]) return listCache[url];
        let links = extractItemLinks(await fetchHtml(url)).slice(0, limit);
        let tmdbItems = await processInQueue(links, processSingleItem, 10); 
        let unique = {}, finalItems = tmdbItems.filter(i => i && i.id && (i.backdrop_path || i.poster_path) && !unique[i.id] && (unique[i.id] = true));
        if (finalItems.length) listCache[url] = finalItems; return finalItems;
    }

    async function fetchKinobazaCatalog(url, limit, noCache) {
        if (!noCache && listCache[url]) return listCache[url];
        let items = extractKinobazaItems(await fetchHtml(url));
        let tmdbItems = await processInQueue(items, async i => searchTmdbByTitleAndYear(i.title, i.year, i.type), 10); 
        let unique = {}, finalItems = tmdbItems.filter(i => i && i.id && (i.backdrop_path || i.poster_path) && !unique[i.id] && (unique[i.id] = true));
        if (limit) finalItems = finalItems.slice(0, limit);
        if (!noCache && finalItems.length) listCache[url] = finalItems; return finalItems;
    }

    async function getLmeTmdbItems(items) {
        var promises = items.map(async item => {
            if (!item) return null;
            let type, id;
            if (typeof item.id === 'string' && item.id.indexOf(':') !== -1) {
                let parts = item.id.split(':');
                type = parts[0]; id = parts[1];
            }
            else if (item.source_id && item.type) { type = item.type; id = item.source_id; }
            else if (item.id && (item.media_type || item.type)) { type = item.media_type || item.type; id = item.id; }
            else return null;
            
            let tmdbData = await fetchTmdbWithFallback(type, id);
            return tmdbData && !tmdbData.error && (tmdbData.backdrop_path || tmdbData.poster_path) ? Object.assign({}, tmdbData, { media_type: type }) : null;
        });
        let res = await Promise.all(promises);
        return res.filter(Boolean);
    }

    function fetchLogo(movie, itemElement) {
        var langPref = Lampa.Storage.get('ym_logo_lang') || 'uk_en';
        var quality = Lampa.Storage.get('ym_img_quality') || 'w300';
        var mType = movie.media_type || (movie.name ? 'tv' : 'movie');
        var altType = getAltDesignType();
        var isAlt1 = altType === '1';
        var isAlt2 = altType === '2';
        
        var isWideCustom = itemElement[0].classList.contains('card--wide-custom');
        var isHistoryCard = itemElement[0].classList.contains('card--history-custom');
        var isHoriz = isWideCustom || isHistoryCard;

        var alt2StandardPoster = Lampa.Storage.get('uas_alt2_standard_poster') === true;
        var needsCleanPoster = isAlt2 && !isHoriz && !alt2StandardPoster;
        var needsLogo = langPref !== 'off' && (!isAlt1 || !isHoriz) && (!isAlt2 || isHoriz || !alt2StandardPoster);

        var viewEl = itemElement[0].querySelector('.card__view');
        if (!viewEl) return;

        var posClass = 'logo-pos-' + (Lampa.Storage.get(isHoriz ? 'ym_logo_pos_hor' : 'ym_logo_pos_ver') || 'center');
        [].forEach.call(itemElement[0].querySelectorAll('.card-custom-logo, .card-custom-logo-text'), el => el.classList.remove('logo-pos-top', 'logo-pos-center', 'logo-pos-bottom'));

        function applyCleanPoster(url) {
            if (!needsCleanPoster) return;
            var imgEl = itemElement[0].querySelector('.card__img');
            if (!imgEl) return;

            if (!url || url === 'none') {
                if (imgEl.dataset.fallbackSrc && !imgEl.dataset.fallbackLoaded) {
                    imgEl.dataset.fallbackLoaded = 'true';
                    delete imgEl.src; 
                    imgEl.src = imgEl.dataset.fallbackSrc;
                }
                return;
            }

            if (imgEl.dataset.cleanLoaded === url) return;

            var cleanUrl = PROXIES[0] + Lampa.TMDB.image('t/p/' + quality + url);
            var tmp = new Image();
            tmp.onload = function() {
                delete imgEl.src; 
                imgEl.src = cleanUrl;
                imgEl.dataset.cleanLoaded = url;
                imgEl.classList.add('uas-poster-loaded');
                var parentCard = imgEl.closest('.card');
                if (parentCard) {
                    parentCard.classList.remove('card--preload');
                    parentCard.classList.add('card--loaded');
                }
            };
            tmp.onerror = function() {
                if (imgEl.dataset.fallbackSrc) {
                    delete imgEl.src;
                    imgEl.src = imgEl.dataset.fallbackSrc;
                }
            };
            tmp.src = cleanUrl;
        }

        var cacheKey = 'logo_uas_v10_' + quality + '_' + langPref + '_' + mType + '_' + movie.id;
        var posterCacheKey = 'poster_clean_v3_' + quality + '_' + mType + '_' + movie.id;

        function renderLogo(logoUrl) {
            if (!needsLogo) return;
            [].forEach.call(itemElement[0].querySelectorAll('.card-custom-logo-text'), el => el.remove());
            if (logoUrl && logoUrl !== 'none') {
                var img = itemElement[0].querySelector('.card-custom-logo');
                if (!img) {
                    img = document.createElement('img');
                    img.className = 'card-custom-logo ' + posClass;
                    viewEl.appendChild(img);
                } else img.className = 'card-custom-logo ' + posClass;
                
                img.onerror = () => { img.style.display = 'none'; renderTextLogo(); };
                var sizeNum = parseInt(Lampa.Storage.get('ym_logo_size') || '40', 10) || 40;
                if (!isHoriz) sizeNum = Math.min(sizeNum + 30, 90);
                img.style.setProperty('width', sizeNum + '%', 'important');
                img.style.setProperty('height', 'auto', 'important');
                img.style.display = 'block'; img.src = logoUrl;
            } else renderTextLogo();
        }

        function renderTextLogo() {
            if (!needsLogo) return;
            [].forEach.call(itemElement[0].querySelectorAll('.card-custom-logo'), el => el.remove());
            var textLogo = itemElement[0].querySelector('.card-custom-logo-text');
            if (!textLogo) {
                textLogo = document.createElement('div');
                textLogo.className = 'card-custom-logo-text ' + posClass;
                var useOriginal = langPref.indexOf('en') !== -1 && (movie.original_title || movie.original_name);
                textLogo.innerText = useOriginal ? (movie.original_title || movie.original_name) : (movie.title || movie.name);
                viewEl.appendChild(textLogo);
            } else textLogo.className = 'card-custom-logo-text ' + posClass;
            var finalSize = (isHoriz ? 2.0 : 1.2) * ((parseInt(Lampa.Storage.get('ym_logo_size') || '40', 10) || 40) / 40);
            textLogo.style.setProperty('font-size', finalSize + 'em', 'important');
        }

        if (!needsLogo && !needsCleanPoster) {
            [].forEach.call(itemElement[0].querySelectorAll('.card-custom-logo, .card-custom-logo-text'), el => el.remove());
            return;
        }

        var cachedLogo = Cache7Days.get(cacheKey);
        var cachedPosterData = Cache7Days.get(posterCacheKey);
        
        var isPosterClean = true, pPath = null;
        if (cachedPosterData && cachedPosterData !== 'none') {
            let parts = cachedPosterData.split('|'); pPath = parts[0]; isPosterClean = parts[1] === 'clean';
        } else if (cachedPosterData === 'none') isPosterClean = false;

        var requireFetch = (needsLogo && !cachedLogo && langPref.indexOf('text_') === -1) || (needsCleanPoster && !cachedPosterData);

        if (!requireFetch) {
            if (needsCleanPoster) applyCleanPoster(pPath || 'none');
            if (needsLogo) {
                if (langPref.indexOf('text_') !== -1) renderTextLogo();
                else if (!needsCleanPoster || isPosterClean) renderLogo(cachedLogo);
                else [].forEach.call(itemElement[0].querySelectorAll('.card-custom-logo, .card-custom-logo-text'), el => el.remove());
            } else [].forEach.call(itemElement[0].querySelectorAll('.card-custom-logo, .card-custom-logo-text'), el => el.remove());
        } else {
            fetch(PROXIES[0] + getTmdbEndpoint(`${mType}/${movie.id}/images?include_image_language=uk,en,null`)).then(r => r.json()).then(res => {
                var finalLogo = 'none', isCleanFlag = true, cleanPath = 'none';
                if (needsLogo) {
                    var found = null;
                    if (res && res.logos) {
                        found = (langPref === 'uk' ? res.logos.find(l => l.iso_639_1 === 'uk') : langPref === 'en' ? res.logos.find(l => l.iso_639_1 === 'en') : res.logos.find(l => l.iso_639_1 === 'uk') || res.logos.find(l => l.iso_639_1 === 'en'));
                    }
                    if (found) finalLogo = PROXIES[0] + Lampa.TMDB.image('t/p/' + quality + found.file_path);
                    Cache7Days.set(cacheKey, finalLogo);
                }
                if (needsCleanPoster) {
                    if (res && res.posters && res.posters.length) {
                        var cleanP = res.posters.find(p => p.iso_639_1 === null);
                        cleanPath = cleanP ? cleanP.file_path : res.posters[0].file_path;
                        isCleanFlag = !!cleanP;
                        Cache7Days.set(posterCacheKey, cleanPath + '|' + (isCleanFlag ? 'clean' : 'dirty'));
                    } else { isCleanFlag = false; Cache7Days.set(posterCacheKey, 'none'); }
                    applyCleanPoster(cleanPath);
                }
                if (needsLogo) {
                    if (needsCleanPoster && !isCleanFlag) [].forEach.call(itemElement[0].querySelectorAll('.card-custom-logo, .card-custom-logo-text'), el => el.remove());
                    else if (langPref.indexOf('text_') !== -1) renderTextLogo();
                    else renderLogo(finalLogo);
                }
            }).catch(() => {
                if (needsLogo) { Cache7Days.set(cacheKey, 'none'); langPref.indexOf('text_') !== -1 ? renderTextLogo() : renderLogo('none'); }
                if (needsCleanPoster) { Cache7Days.set(posterCacheKey, 'none'); applyCleanPoster('none'); }
            });
        }
    }

    function makeTitleButtonItem(title, url, iconUrl) {
        return {
            title: title, is_title_btn: true, url: url,
            params: {
                createInstance: () => Lampa.Maker.make('Card', { title: title }, m => m.only('Card', 'Callback')),
                emit: {
                    onCreate: function () {
                        var item = $(this.html); item.addClass('card--title-btn').empty(); 
                        if (!url) { item.removeClass('selector focusable'); item.addClass('card--title-btn-static'); }
                        item.append('<div class="title-btn-text">' + (iconUrl ? `<img src="${iconUrl}" class="title-btn-icon" onerror="this.style.display='none'" />` : '') + title + '</div>');
                    },
                    onlyEnter: function () {
                        if (url) Lampa.Activity.push({ url: url, title: title, component: 'category_full', page: 1, source: 'uas_pro_source' });
                    }
                }
            }
        };
    }

    function makeCollectionButtonItem(collection) {
        return {
            title: collection.title, is_collection_btn: true, url: collection.url,
            params: {
                createInstance: () => Lampa.Maker.make('Card', { title: collection.title }, m => m.only('Card', 'Callback')),
                emit: {
                    onCreate: function () {
                        var item = $(this.html); item.addClass('card--collection-btn').empty(); 
                        item.append('<div class="collection-title">' + collection.title + '</div>');
                    },
                    onlyEnter: function () {
                        Lampa.Activity.push({ url: collection.url, title: collection.title, component: 'category_full', page: 1, source: 'uas_pro_source', is_uas_collection: true });
                    }
                }
            }
        };
    }

    function makeFavoriteCardItem(bgUrl, fullBgUrl) {
        return {
            title: 'Обране', is_title_btn: true,
            params: {
                createInstance: () => Lampa.Maker.make('Card', { title: 'Обране' }, m => m.only('Card', 'Callback')),
                emit: {
                    onCreate: function () {
                        var view = $(this.html).addClass('card--history-custom').find('.card__view').empty(); 
                        view.css({ 'background-image': bgUrl ? `url(${bgUrl})` : 'rgba(30,30,30,0.8)', 'background-size': 'cover', 'background-position': 'center', 'padding-bottom': '56.25%', 'height': '0', 'position': 'relative', 'display': 'block' });
                        view.append('<div class="card-backdrop-overlay" style="background: rgba(0,0,0,0.65);"></div><div style="position: absolute; top:0; left:0; right:0; bottom:0; display:flex; flex-direction: column; align-items:center; justify-content:center; z-index: 2; padding: 10%; box-sizing: border-box;"><svg style="width: 35%; height: 35%; margin-bottom: 0.5em; filter: drop-shadow(0px 2px 4px rgba(0,0,0,0.8)); color: #fff;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path></svg><div style="font-size: 1.1em; font-weight: bold; text-shadow: 0px 2px 4px rgba(0,0,0,0.8); text-align: center; color: #fff;">Обране</div></div>');
                        if (fullBgUrl && !window.uas_initial_bg_set) { window.uas_initial_bg_set = true; BgManager.change(fullBgUrl, true); }
                        $(this.html).on('hover:focus mouseenter', () => { if (fullBgUrl) BgManager.change(fullBgUrl); });
                    },
                    onlyEnter: function () { Lampa.Activity.push({ url: '', title: 'Обране', component: 'bookmarks', page: 1 }); }
                }
            }
        };
    }

    function makeHistoryButtonCardItem(bgUrl, fullBgUrl) {
        return {
            title: 'Історія', is_title_btn: true,
            params: {
                createInstance: () => Lampa.Maker.make('Card', { title: 'Історія' }, m => m.only('Card', 'Callback')),
                emit: {
                    onCreate: function () {
                        var view = $(this.html).addClass('card--history-custom').find('.card__view').empty(); 
                        view.css({ 'background-image': bgUrl ? `url(${bgUrl})` : 'rgba(30,30,30,0.8)', 'background-size': 'cover', 'background-position': 'center', 'padding-bottom': '56.25%', 'height': '0', 'position': 'relative', 'display': 'block' });
                        view.append('<div class="card-backdrop-overlay" style="background: rgba(0,0,0,0.65);"></div><div style="position: absolute; top:0; left:0; right:0; bottom:0; display:flex; flex-direction: column; align-items:center; justify-content:center; z-index: 2; padding: 10%; box-sizing: border-box;"><svg style="width: 35%; height: 35%; margin-bottom: 0.5em; filter: drop-shadow(0px 2px 4px rgba(0,0,0,0.8)); color: #fff;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg><div style="font-size: 1.1em; font-weight: bold; text-shadow: 0px 2px 4px rgba(0,0,0,0.8); text-align: center; color: #fff;">Історія</div></div>');
                        if (fullBgUrl && !window.uas_initial_bg_set) { window.uas_initial_bg_set = true; BgManager.change(fullBgUrl, true); }
                        $(this.html).on('hover:focus mouseenter', () => { if (fullBgUrl) BgManager.change(fullBgUrl); });
                    },
                    onlyEnter: function () { Lampa.Activity.push({ title: 'Історія переглядів', component: 'favorite', type: 'history', source: 'tmdb', page: 1 }); }
                }
            }
        };
    }

    function makeHistoryCardItem(movie) {
        return {
            title: movie.title || movie.name,
            params: {
                createInstance: () => Lampa.Maker.make('Card', movie, m => m.only('Card', 'Callback')),
                emit: {
                    onCreate: function () {
                        var item = $(this.html).addClass('card--history-custom');
                        var view = item.find('.card__view').empty(); 
                        var imgUrlPath = movie.backdrop_path || movie.poster_path;
                        var quality = Lampa.Storage.get('ym_img_quality') || 'w300';
                        var imgUrl = imgUrlPath ? PROXIES[0] + Lampa.TMDB.image('t/p/' + quality + imgUrlPath) : '';
                        view.css({ 'background-image': imgUrl ? `url(${imgUrl})` : 'none', 'background-size': 'cover', 'background-position': 'center', 'padding-bottom': '56.25%', 'height': '0', 'position': 'relative' });
                        view.append('<div class="card-backdrop-overlay"></div>');

                        var voteVal = parseFloat(movie.vote_average);
                        if (getAltDesignType() === '0' && !isNaN(voteVal) && voteVal > 0 && Lampa.Storage.get('uas_badge_rating') !== false) {
                            view.append(`<div class="card__vote">${voteVal.toFixed(1)}</div>`);
                        }
                        isLazyLoadEnabled() ? LazyLoader.add(item[0], () => fetchLogo(movie, item)) : fetchLogo(movie, item);
                        
                        var fullBgUrl = movie.backdrop_path ? PROXIES[0] + Lampa.TMDB.image('t/p/w1280' + movie.backdrop_path) : '';
                        if (fullBgUrl && !window.uas_initial_bg_set) { window.uas_initial_bg_set = true; BgManager.change(fullBgUrl, true); }
                        item.on('hover:focus mouseenter', () => { var bg = movie.custom_full_bg || fullBgUrl; if (bg) BgManager.change(bg); });
                    },
                    onlyEnter: function () { Lampa.Activity.push({ url: '', component: 'full', id: movie.id, method: movie.media_type || (movie.name ? 'tv' : 'movie'), card: movie, source: movie.source || 'tmdb' }); }
                }
            }
        };
    }

    function makeWideCardItem(movie) {
        return {
            title: movie.title || movie.name,
            params: {
                createInstance: () => Lampa.Maker.make('Card', movie, m => m.only('Card', 'Callback')),
                emit: {
                    onCreate: function () {
                        var item = $(this.html).addClass('card--wide-custom');
                        var view = item.find('.card__view').empty();
                        var quality = Lampa.Storage.get('ym_img_quality') || 'w300'; 
                        
                        var imgPath = movie.backdrop_path || movie.poster_path;
                        var imgUrl = imgPath ? PROXIES[0] + Lampa.TMDB.image('t/p/' + quality + imgPath) : '';
                        
                        view.css({ 'background-image': imgUrl ? `url(${imgUrl})` : 'none', 'background-size': 'cover', 'background-position': 'center', 'padding-bottom': '56.25%', 'height': '0', 'position': 'relative' });
                        view.append('<div class="card-backdrop-overlay"></div>');

                        var voteVal = parseFloat(movie.vote_average);
                        if (getAltDesignType() === '0' && !isNaN(voteVal) && voteVal > 0 && Lampa.Storage.get('uas_badge_rating') !== false) {
                            view.append(`<div class="card__vote">${voteVal.toFixed(1)}</div>`);
                        }
                        var yearStr = String(movie.release_date || movie.first_air_date || '').substring(0, 4);
                        if (yearStr.length === 4 && Lampa.Storage.get('uas_badge_year') !== false) {
                            view.append(`<div class="card-badge-age">${yearStr}</div>`);
                        }

                        isLazyLoadEnabled() ? LazyLoader.add(item[0], () => fetchLogo(movie, item)) : fetchLogo(movie, item);
                        item.append(`<div class="custom-title-bottom">${movie.title || movie.name}</div><div class="custom-overview-bottom">${movie.overview || 'Опис відсутній.'}</div>`);

                        var fullBgUrl = imgPath ? PROXIES[0] + Lampa.TMDB.image('t/p/w1280' + imgPath) : '';
                        if (fullBgUrl && !window.uas_initial_bg_set) { window.uas_initial_bg_set = true; BgManager.change(fullBgUrl, true); }
                        item.on('hover:focus mouseenter', () => { var bg = movie.custom_full_bg || fullBgUrl; if (bg) BgManager.change(bg); });
                    },
                    onlyEnter: function () { Lampa.Activity.push({ url: '', component: 'full', id: movie.id, method: movie.media_type || (movie.name ? 'tv' : 'movie'), card: movie, source: movie.source || 'tmdb' }); }
                }
            }
        };
    }

    function makeStandardCardItem(movie) {
        return {
            title: movie.title || movie.name,
            params: {
                createInstance: () => Lampa.Maker.make('Card', movie, m => m.only('Card', 'Callback')),
                emit: {
                    onCreate: function () {
                        var item = $(this.html);
                        isLazyLoadEnabled() ? LazyLoader.add(item[0], () => fetchLogo(movie, item)) : fetchLogo(movie, item);
                        
                        var fullBgUrl = movie.backdrop_path ? PROXIES[0] + Lampa.TMDB.image('t/p/w1280' + movie.backdrop_path) : '';
                        if (fullBgUrl && !window.uas_initial_bg_set) { window.uas_initial_bg_set = true; BgManager.change(fullBgUrl, true); }
                        item.on('hover:focus mouseenter', () => { var bg = movie.custom_full_bg || fullBgUrl; if (bg) BgManager.change(bg); });
                    },
                    onlyEnter: function () { Lampa.Activity.push({ url: '', component: 'full', id: movie.id, method: movie.media_type || (movie.name ? 'tv' : 'movie'), card: movie, source: movie.source || 'tmdb' }); }
                }
            }
        };
    }

    function loadHistoryRow(callback) {
        let hist =[], allFavs = {};
        try { if (Lampa.Favorite && Lampa.Favorite.all) { allFavs = Lampa.Favorite.all() || {}; hist = allFavs.history || []; } } catch(e) {}
        
        let results =[], getRandImg = (arr) => {
            let valid = (arr || []).filter(i => i && (i.backdrop_path || i.poster_path));
            if (!valid.length) return { img:'', bg:'' };
            let r = valid[Math.floor(Math.random() * valid.length)], path = r.backdrop_path || r.poster_path;
            var quality = Lampa.Storage.get('ym_img_quality') || 'w300';
            return { img: PROXIES[0] + Lampa.TMDB.image('t/p/' + quality + path), bg: PROXIES[0] + Lampa.TMDB.image('t/p/w1280' + path) };
        };

        if (Lampa.Storage.get('uas_show_fav_card') !== false) {
            let randFav = getRandImg([].concat(allFavs.book || [], allFavs.like || []));
            results.push(makeFavoriteCardItem(randFav.img, randFav.bg));
        }
        if (Lampa.Storage.get('uas_show_history_btn') !== false) {
            let randHist = getRandImg(hist);
            results.push(makeHistoryButtonCardItem(randHist.img, randHist.bg));
        }

        if (hist.length) {
            let unique = {};
            results = results.concat(hist.filter(h => h && h.id && (h.title || h.name) && !unique[h.id] && (unique[h.id] = true)).slice(0, getCardsLimit()).map(makeHistoryCardItem));
        }

        callback(results.length ? { results: results, title: '', uas_content_row: true, params: { items: { mapping: 'line', view: getCardsLimit() } } } : { results:[] });
    }

    async function loadRow(urlId, loadUrl, title, callback) {
        try {
            let limit = getCardsLimit();
            let pageData = await fetchCatalogPage(loadUrl, limit);
            let mapFn = isMobile() ? makeStandardCardItem : makeWideCardItem;
            callback({ results: pageData.map(mapFn), title: '', source: 'uas_pro_source', uas_content_row: true, params: { items: { mapping: 'line', view: limit } } });
        } catch(e) { callback({ results:[] }); }
    }

    async function loadUaFlixRow(urlId, loadUrl, title, callback) {
        try {
            let limit = getCardsLimit();
            let pageData = await fetchUaFlixCatalog(loadUrl, limit);
            let mapFn = isMobile() ? makeStandardCardItem : makeWideCardItem;
            callback({ results: pageData.map(mapFn), title: '', source: 'uas_pro_source', uas_content_row: true, params: { items: { mapping: 'line', view: limit } } });
        } catch(e) { callback({ results:[] }); }
    }

    async function loadKinobazaRow(urlId, loadUrl, title, callback) {
        try {
            let limit = getCardsLimit();
            let pageData = await fetchKinobazaCatalog(loadUrl + '1', limit);
            let mapFn = isMobile() ? makeStandardCardItem : makeWideCardItem;
            callback({ results: pageData.map(mapFn), title: '', source: 'uas_pro_source', uas_content_row: true, params: { items: { mapping: 'line', view: limit } } });
        } catch(e) { callback({ results:[] }); }
    }

    async function loadUaserialsCollectionsRow(urlId, loadUrl, title, callback) {
        try {
            let items = extractUaserialsCollections(await fetchHtml(loadUrl)).sort(() => 0.5 - Math.random());
            callback({ results: items.slice(0, 7).map(makeCollectionButtonItem), title: '', source: 'uas_pro_source', uas_content_row: true, params: { items: { mapping: 'line', view: 7 } } });
        } catch(e) { callback({ results:[] }); }
    }

    async function loadCommunityGemsRow(callback) {
        try {
            let limit = getCardsLimit(), res = await safeFetch(`https://wh.lme.isroot.in/v2/top?period=7d&top=asc&min_rating=7&per_page=${limit}&page=1`).then(r=>r.json()).catch(()=>({items:[]}));
            let mappedData = await getLmeTmdbItems(Array.isArray(res) ? res : (res.items ||[]));
            let mapFn = isMobile() ? makeStandardCardItem : makeWideCardItem;
            callback({ results: mappedData.map(mapFn), title: '', source: 'uas_pro_source', uas_content_row: true, params: { items: { mapping: 'line', view: limit } } });
        } catch(e) { callback({ results:[] }); }
    }

    async function loadRandomMoviesRow(callback) {
        try {
            let url = 'https://kinobaza.com.ua/titles?order_by=random&type=&rating=1&rating_max=10&imdb_rating=7&imdb_rating_max=10&imdb_votes=5000&per_page=30&translated=has_ukr_audio&_t=' + Date.now();
            let randData = await fetchKinobazaCatalog(url, 5, true);
            let mapFn = isMobile() ? makeStandardCardItem : makeWideCardItem;
            callback({ results: randData.map(mapFn), title: '', uas_content_row: true, params: { items: { mapping: 'line', view: 5 } } });
        } catch(e) { callback({ results:[] }); }
    }

    function getOrCreateLoadingToast() {
        let toast = document.getElementById('uas-loading-toast');
        if (!toast) {
            toast = document.createElement('div'); toast.id = 'uas-loading-toast'; toast.innerText = 'Завантаження нових карток...';
            toast.style.cssText = 'display:none; position:fixed; bottom:30px; left:50%; transform:translateX(-50%); background:rgba(40,40,40,0.95); color:#fff; padding:12px 24px; border-radius:8px; z-index:99999; font-size:1.2em; font-weight:bold; pointer-events:none; box-shadow: 0 4px 10px rgba(0,0,0,0.5); opacity:0; transition: opacity 0.3s ease;';
            document.body.appendChild(toast);
        } return toast;
    }

    function showLoadingToast() { let t = getOrCreateLoadingToast(); t.style.display = 'block'; void t.offsetWidth; t.style.opacity = '1'; }
    function hideLoadingToast() { let t = getOrCreateLoadingToast(); t.style.opacity = '0'; setTimeout(() => { if (t.style.opacity === '0') t.style.display = 'none'; }, 300); }

    async function fetchPageData(targetPage, baseUrl, isLME, isKinobazaOnline, isUasCollection, isUasCollectionsList, isUaFlix, params) {
        if (isLME) {
            let res = await fetchCommunityWatches(`https://wh.lme.isroot.in/v2/top?period=7d&top=asc&min_rating=7&per_page=20&page=${targetPage}`).catch(()=>({items:[]}));
            let mappedLME = await getLmeTmdbItems(Array.isArray(res) ? res : (res.items ||[]));
            return { mapped: mappedLME, total: res.total_pages || 10 };
        } else if (isUaFlix) {
            let targetUrl = targetPage === 1 ? baseUrl : baseUrl + 'page/' + targetPage + '/';
            let normData = await fetchUaFlixCatalog(targetUrl, 20);
            return { mapped: normData, total: 50 };
        } else if (isUasCollectionsList) {
            if (targetPage > 1) return { mapped:[], total: 1 };
            if (!listCache[baseUrl]) listCache[baseUrl] = extractUaserialsCollections(await fetchHtml(baseUrl)).map(makeCollectionButtonItem);
            return { mapped: listCache[baseUrl], total: 1 };
        } else if (isUasCollection) {
            let listUrl = targetPage > 1 ? (params.url.endsWith('.html') ? params.url.replace('.html', `/page/${targetPage}/`) : params.url.replace(/\/$/, '') + `/page/${targetPage}/`) : params.url;
            if (!listCache[listUrl]) listCache[listUrl] = await fetchCatalogPage(listUrl, 20);
            return { mapped: listCache[listUrl], total: 50 };
        } else if (isKinobazaOnline) {
            let knbData = await fetchKinobazaCatalog(baseUrl + targetPage, 30);
            return { mapped: knbData, total: 50 };
        } else {
            let normData = await fetchCatalogPage(targetPage === 1 ? baseUrl : `${baseUrl}page/${targetPage}/`, 20);
            return { mapped: normData, total: 50 };
        }
    }

    Lampa.Api.sources.uas_pro_source = {
        list: async function (params, oncomplete, onerror) {
            let page = params.page || 1, baseUrl = '', isLME = false, isKinobazaOnline = false, isUasCollection = params.is_uas_collection, isUasCollectionsList = false, isUaFlix = false;
            if (params.url === 'uaflix_new') { baseUrl = 'https://uafix.net/dubbing/'; isUaFlix = true; }
            else if (params.url === 'uas_movies_new') baseUrl = 'https://uaserials.com/films/p/';
            else if (params.url === 'uas_movies_pop') baseUrl = 'https://uaserials.my/filmss/w/';
            else if (params.url === 'uas_series_new') baseUrl = 'https://uaserials.com/series/p/';
            else if (params.url === 'uas_series_pop') baseUrl = 'https://uaserials.com/series/w/';
            else if (params.url === 'kinobaza_streaming') { baseUrl = 'https://kinobaza.com.ua/online?order_by=date_desc&rating=1&rating_max=10&imdb_rating=1&imdb_rating_max=10&per_page=30&translated=has_ukr_audio&page='; isKinobazaOnline = true; }
            else if (params.url === 'uas_collections_list') { isUasCollectionsList = true; baseUrl = 'https://uaserials.com/collections/'; }
            else if (params.url === 'uas_community') isLME = true;
            else if (!isUasCollection) return onerror();

            if (page > 1) showLoadingToast();
            try {
                let res;
                if (page === 1) {
                    let r = await Promise.all([
                        fetchPageData(1, baseUrl, isLME, isKinobazaOnline, isUasCollection, isUasCollectionsList, isUaFlix, params),
                        fetchPageData(2, baseUrl, isLME, isKinobazaOnline, isUasCollection, isUasCollectionsList, isUaFlix, params)
                    ]);
                    res = { mapped: r[0].mapped.concat(r[1].mapped), total: r[0].total };
                } else {
                    res = await fetchPageData(page + 1, baseUrl, isLME, isKinobazaOnline, isUasCollection, isUasCollectionsList, isUaFlix, params);
                }
                
                if (page > 1) hideLoadingToast();
                if (res && res.mapped && res.mapped.length > 0) oncomplete({ results: res.mapped, page: page, total_pages: res.total });
                else onerror();
            } catch (e) { if (page > 1) hideLoadingToast(); onerror(); }
        }
    };

    function createSettings() {
        if (!window.Lampa || !Lampa.SettingsApi) return;
        
        Lampa.SettingsApi.addComponent({ component: 'ymainpage', name: 'YMainPage', icon: `<svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="3" y1="9" x2="21" y2="9"></line><line x1="9" y1="21" x2="9" y2="9"></line></svg>` });
        Lampa.SettingsApi.addComponent({ component: 'ymainpage_rows', name: 'Налаштування рядків', icon: `<svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line><line x1="3" y1="6" x2="3.01" y2="6"></line><line x1="3" y1="12" x2="3.01" y2="12"></line><line x1="3" y1="18" x2="3.01" y2="18"></line></svg>` });
        Lampa.SettingsApi.addComponent({ component: 'ymainpage_ext_rt', name: 'Рейтинги на картці', icon: `<svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>` });

        Lampa.SettingsApi.addParam({ component: 'ymainpage', param: { name: 'uas_support_yarik', type: 'button' }, field: { name: "Підтримати розробників: Yarik's Mod's", description: 'https://lampalampa.free.nf/' } });
        Lampa.SettingsApi.addParam({ component: 'ymainpage', param: { name: 'uas_support_lme', type: 'button' }, field: { name: 'Підтримати розробників: LampaME', description: 'https://lampame.github.io/' } });
        Lampa.SettingsApi.addParam({ component: 'ymainpage', param: { name: 'uas_lazy_load', type: 'trigger', default: true }, field: { name: 'Ліниве завантаження (Lazy Load)', description: 'Завантажувати важкі елементи карток тільки при їх появі на екрані' } });
        Lampa.SettingsApi.addParam({ component: 'ymainpage', param: { name: 'uas_row_cards_count', type: 'select', values: { '5':'5 карток', '7':'7 карток', '10':'10 карток', '13':'13 карток', '15':'15 карток' }, default: '10' }, field: { name: 'Кількість карток головної в ряду', description: 'Не стосується випадкових фільмів та підбірок' } });
        Lampa.SettingsApi.addParam({ component: 'ymainpage', param: { name: 'uas_show_flag', type: 'trigger', default: true }, field: { name: 'Відображення УКР озвучок', description: 'Пошук та відображення прапорця на картках' } });
        Lampa.SettingsApi.addParam({ component: 'ymainpage', param: { name: 'uas_show_fav_card', type: 'trigger', default: true }, field: { name: 'Картка "Обране" в історії', description: 'Показувати швидкий доступ до Обраного першим у рядку історії' } });
        Lampa.SettingsApi.addParam({ component: 'ymainpage', param: { name: 'uas_show_history_btn', type: 'trigger', default: true }, field: { name: 'Картка "Історія" в історії', description: 'Показувати швидкий доступ до Історії поруч із Обраним' } });
        Lampa.SettingsApi.addParam({ component: 'ymainpage', param: { name: 'ym_logo_lang', type: 'select', values: { 'uk': 'Тільки українською', 'uk_en': 'Укр + Англ (За замовчуванням)', 'en': 'Тільки англійською', 'text_uk': 'Завжди текст (Укр)', 'text_en': 'Завжди текст (Англ)', 'off': 'Вимкнути (Тільки фон)' }, default: 'uk_en' }, field: { name: 'Мова логотипів', description: 'Оберіть пріоритет мови для логотипів' } });
        Lampa.SettingsApi.addParam({ component: 'ymainpage', param: { name: 'ym_logo_size', type: 'select', values: { '10': '10%', '20': '20%', '30': '30%', '40': '40%', '50': '50%', '60': '60%', '70': '70%', '80': '80%', '90': '90%', '100': '100%' }, default: '40' }, field: { name: 'Розмір логотипу', description: 'Ширина логотипу як відсоток від ширини картки (10%–100%)' } });
        Lampa.SettingsApi.addParam({ component: 'ymainpage', param: { name: 'ym_logo_pos_hor', type: 'select', values: { 'top': 'Зверху', 'center': 'Посередині', 'bottom': 'Знизу' }, default: 'center' }, field: { name: 'Позиція лого (Горизонтальні картки)', description: 'Де розміщувати логотип на широких картках' } });
        Lampa.SettingsApi.addParam({ component: 'ymainpage', param: { name: 'ym_logo_pos_ver', type: 'select', values: { 'top': 'Зверху', 'center': 'Посередині', 'bottom': 'Знизу' }, default: 'center' }, field: { name: 'Позиція лого (Вертикальні картки)', description: 'Де розміщувати логотип на звичайних картках' } });
        Lampa.SettingsApi.addParam({ component: 'ymainpage', param: { name: 'ym_img_quality', type: 'select', values: { 'w200': 'w200 (Низька)', 'w300': 'w300', 'w500': 'w500', 'w780': 'w780', 'original': 'Оригінал' }, default: 'w300' }, field: { name: 'Якість зображень (Фон/Лого)', description: 'Впливає на швидкість завантаження сторінки' } });
        Lampa.SettingsApi.addParam({ component: 'ymainpage', param: { name: 'uas_bg_mode', type: 'select', values: { '0': 'Вимкнено', '1': 'Плавний перехід', '2': 'Без переходу' }, default: '1' }, field: { name: 'Розмитий фон на Головній', description: 'Налаштування поведінки фону за картками' } });
        Lampa.SettingsApi.addParam({ component: 'ymainpage', param: { name: 'uas_pro_tmdb_btn', type: 'button' }, field: { name: 'Власний TMDB API ключ', description: 'Натисніть, щоб ввести ключ' } });
        Lampa.SettingsApi.addParam({ component: 'ymainpage', param: { name: 'uas_rows_menu_btn', type: 'button' }, field: { name: 'Налаштування рядків Головної', description: 'Увімкнути/Вимкнути та змінити порядок рядків' } });

        Lampa.SettingsApi.addParam({ component: 'ymainpage_rows', param: { name: 'uas_rows_back', type: 'button' }, field: { name: 'Назад', description: 'Повернутись до основних налаштувань' } });
        DEFAULT_ROWS_SETTINGS.forEach(function(r) {
            Lampa.SettingsApi.addParam({ component: 'ymainpage_rows', param: { name: r.id, type: 'trigger', default: r.default }, field: { name: 'Вимкнути / Увімкнути: ' + r.title, description: 'Показувати цей рядок' } });
            Lampa.SettingsApi.addParam({ component: 'ymainpage_rows', param: { name: r.id + '_order', type: 'select', values: { '1': 'Позиція 1', '2': 'Позиція 2', '3': 'Позиція 3', '4': 'Позиція 4', '5': 'Позиція 5', '6': 'Позиція 6', '7': 'Позиція 7', '8': 'Позиція 8', '9': 'Позиція 9', '10': 'Позиція 10' }, default: r.defOrder }, field: { name: 'Порядок: ' + r.title, description: 'Яким по рахунку виводити цей рядок' } });
        });

        Lampa.SettingsApi.addParam({ component: 'ymainpage', param: { name: 'uas_text_divider', type: 'title' }, field: { name: 'Налаштування тексту', description: '' } });
        Lampa.SettingsApi.addParam({ component: 'ymainpage', param: { name: 'uas_text_hide', type: 'trigger', default: false }, field: { name: 'Приховати текст', description: 'Повністю сховати назви та опис під картками' } });
        Lampa.SettingsApi.addParam({ component: 'ymainpage', param: { name: 'uas_text_align', type: 'select', values: { 'left': 'Ліворуч', 'center': 'По центру', 'right': 'Праворуч' }, default: 'center' }, field: { name: 'Вирівнювання назви', description: 'Оберіть вирівнювання назви' } });
        Lampa.SettingsApi.addParam({ component: 'ymainpage', param: { name: 'uas_text_desc_align', type: 'select', values: { 'left': 'Ліворуч', 'center': 'По центру', 'right': 'Праворуч' }, default: 'left' }, field: { name: 'Вирівнювання опису', description: 'Оберіть вирівнювання тексту опису' } });
        Lampa.SettingsApi.addParam({ component: 'ymainpage', param: { name: 'uas_text_title_size', type: 'select', values: { '0.8': '0.8', '0.9': '0.9', '1.0': '1.0', '1.1': '1.1', '1.2': '1.2', '1.3': '1.3' }, default: '1.1' }, field: { name: 'Розмір тексту: Назва', description: '' } });
        Lampa.SettingsApi.addParam({ component: 'ymainpage', param: { name: 'uas_text_desc_size', type: 'select', values: { '0.7': '0.7', '0.75': '0.75', '0.85': '0.85', '0.95': '0.95', '1.05': '1.05' }, default: '0.85' }, field: { name: 'Розмір тексту: Опис', description: '' } });

        Lampa.SettingsApi.addParam({ component: 'ymainpage', param: { name: 'uas_alt_design_divider', type: 'title' }, field: { name: 'Альтернативний вигляд', description: 'Налаштування дизайну карток' } });
        Lampa.SettingsApi.addParam({ component: 'ymainpage', param: { name: 'uas_alt_design_type', type: 'select', values: { '0': 'Вимкнено (Стандартний)', '1': 'Альтернативний вигляд 1 (easyratingsdb)', '2': 'Альтернативний вигляд 2 (TMDB + Нові бейджі)' }, default: '0' }, field: { name: 'Тип дизайну карток', description: 'Оберіть стиль відображення' } });
        
        Lampa.SettingsApi.addParam({ component: 'ymainpage', param: { name: 'uas_alt2_standard_poster', type: 'trigger', default: false }, field: { name: 'Стандартні постери (Альт 2)', description: 'Вимкнути "чисті" постери та логотипи для звичайних карток' } });
        
        Lampa.SettingsApi.addParam({ component: 'ymainpage', param: { name: 'uas_alt_apikey_btn', type: 'button' }, field: { name: 'easyratingsdb Api key', description: 'Для Альт. вигляду 1. Натисніть, щоб ввести ключ' } });
        Lampa.SettingsApi.addParam({ component: 'ymainpage', param: { name: 'uas_alt_badge_size', type: 'select', values: { '0.55': '55%', '0.65': '65%', '0.7': '70%', '0.75': '75%', '0.85': '85%', '0.95': '95%', '1.1': '110%' }, default: '0.7' }, field: { name: 'Розмір бейджів', description: 'Змінює розмір овальних бейджів' } });
        Lampa.SettingsApi.addParam({ component: 'ymainpage', param: { name: 'uas_alt_badge_pos', type: 'select', values: { 'tl': 'Верхній Лівий', 'tr': 'Верхній Правий', 'ml': 'Середина Лівий', 'mr': 'Середина Правий', 'bl': 'Нижній Лівий', 'br': 'Нижній Правий', 'top_horz': 'В ряд зверху', 'bottom_horz': 'В ряд знизу' }, default: 'tl' }, field: { name: 'Позиція бейджів (Рік, Сезони, UA)', description: '' } });
        Lampa.SettingsApi.addParam({ component: 'ymainpage', param: { name: 'uas_alt_rating_pos', type: 'select', values: { 'tl': 'Верхній Лівий', 'tr': 'Верхній Правий', 'ml': 'Середина Лівий', 'mr': 'Середина Правий', 'bl': 'Нижній Лівий', 'br': 'Нижній Правий', 'top_horz': 'В ряд зверху', 'bottom_horz': 'В ряд знизу' }, default: 'tr' }, field: { name: 'Позиція рейтингу', description: '' } });

        Lampa.SettingsApi.addParam({ component: 'ymainpage', param: { name: 'uas_badges_divider', type: 'title' }, field: { name: 'Наявність бейджів', description: '' } });
        Lampa.SettingsApi.addParam({ component: 'ymainpage', param: { name: 'uas_badge_year', type: 'trigger', default: true }, field: { name: 'Бейдж Року', description: 'Відображати рік випуску на картці' } });
        Lampa.SettingsApi.addParam({ component: 'ymainpage', param: { name: 'uas_badge_season', type: 'trigger', default: true }, field: { name: 'Бейдж Сезону/Серії', description: 'Відображати кількість сезонів та серій' } });
        Lampa.SettingsApi.addParam({ component: 'ymainpage', param: { name: 'uas_badge_rating', type: 'trigger', default: true }, field: { name: 'Бейдж Рейтингу (TMDB)', description: 'Відображати стандартну оцінку на картках' } });
        Lampa.SettingsApi.addParam({ component: 'ymainpage', param: { name: 'uas_ext_rt_menu_btn', type: 'button' }, field: { name: 'Рейтинги на картці', description: 'Налаштування зовнішніх оцінок (OMDB/MDBList)' } });

        Lampa.SettingsApi.addParam({ component: 'ymainpage_ext_rt', param: { name: 'uas_ext_rt_back', type: 'button' }, field: { name: 'Назад', description: 'Повернутись' } });
        Lampa.SettingsApi.addParam({ component: 'ymainpage_ext_rt', param: { name: 'uas_ext_ratings_enable', type: 'trigger', default: false }, field: { name: 'Увімкнути зовнішні рейтинги', description: 'Показувати додаткові оцінки на картках' } });
        Lampa.SettingsApi.addParam({ component: 'ymainpage_ext_rt', param: { name: 'uas_omdb_key_btn', type: 'button' }, field: { name: 'OMDB API Key', description: 'Ключ (omdbapi.com)' } });
        Lampa.SettingsApi.addParam({ component: 'ymainpage_ext_rt', param: { name: 'uas_mdblist_key_btn', type: 'button' }, field: { name: 'MDBList API Key', description: 'Ключ (mdblist.com)' } });
        
        ['tmdb', 'imdb', 'rt', 'mc', 'letterboxd', 'trakt', 'mdblist', 'popcorn'].forEach(function(k) {
            Lampa.SettingsApi.addParam({ component: 'ymainpage_ext_rt', param: { name: 'uas_ext_rt_'+k, type: 'trigger', default: true }, field: { name: k.toUpperCase(), description: '' } });
        });

        Lampa.Settings.listener.follow('open', function(e) {
            if (e.name === 'ymainpage') {
                e.body.find('[data-name="uas_support_yarik"]').on('hover:enter', function() { window.open('https://lampalampa.free.nf/', '_blank'); });
                e.body.find('[data-name="uas_support_lme"]').on('hover:enter', function() { window.open('https://lampame.github.io/main/#uk', '_blank'); });
                e.body.find('[data-name="uas_rows_menu_btn"]').on('hover:enter', function() { Lampa.Settings.create('ymainpage_rows'); });
                e.body.find('[data-name="uas_ext_rt_menu_btn"]').on('hover:enter', function() { Lampa.Settings.create('ymainpage_ext_rt'); });
                e.body.find('[data-name="uas_pro_tmdb_btn"]').on('hover:enter', function() { Lampa.Input.edit({ title: 'TMDB API', value: Lampa.Storage.get('uas_pro_tmdb_apikey') || '', free: true, nosave: true }, function(v) { if (v !== undefined) { Lampa.Storage.set('uas_pro_tmdb_apikey', v.trim()); Lampa.Noty.show('Збережено.'); } }); });
                e.body.find('[data-name="uas_alt_apikey_btn"]').on('hover:enter', function() { Lampa.Input.edit({ title: 'API Ключ easyratingsdb', value: Lampa.Storage.get('uas_alt_design_apikey') || '', free: true, nosave: true }, function(v) { if (v !== undefined) { Lampa.Storage.set('uas_alt_design_apikey', v.trim()); Lampa.Noty.show('Збережено.'); } }); });
            } else if (e.name === 'ymainpage_ext_rt') {
                e.body.find('[data-name="uas_ext_rt_back"]').on('hover:enter', function() { Lampa.Settings.create('ymainpage'); });
                e.body.find('[data-name="uas_omdb_key_btn"]').on('hover:enter', function() { Lampa.Input.edit({ title: 'OMDB', value: Lampa.Storage.get('uas_omdb_api_key') || '', free: true, nosave: true }, function(v) { if(v!==undefined){ Lampa.Storage.set('uas_omdb_api_key', v.trim()); Lampa.Noty.show('Збережено.'); } }); });
                e.body.find('[data-name="uas_mdblist_key_btn"]').on('hover:enter', function() { Lampa.Input.edit({ title: 'MDBList', value: Lampa.Storage.get('uas_mdblist_api_key') || '', free: true, nosave: true }, function(v) { if(v!==undefined){ Lampa.Storage.set('uas_mdblist_api_key', v.trim()); Lampa.Noty.show('Збережено.'); } }); });
            } else if (e.name === 'ymainpage_rows') {
                e.body.find('[data-name="uas_rows_back"]').on('hover:enter', function() { Lampa.Settings.create('ymainpage'); });
            }
        });

        Lampa.Settings.listener.follow('change', function(e) {
            var keys = ['uas_alt_design_type', 'uas_alt_badge_size', 'uas_text_hide', 'uas_text_align', 'uas_text_desc_align', 'uas_text_title_size', 'uas_text_desc_size', 'uas_bg_mode'];
            if (keys.indexOf(e.name) !== -1) updateDynamicStyles();
        });
    }

    function overrideApi() {
        Lampa.Api.sources.tmdb.main = function (params, oncomplite, onerror) {
            var rowDefs =[
                { id: 'ym_row_history', defOrder: 1, type: 'history', url: '', title: 'Історія перегляду', icon: '' },
                { id: 'ym_row_uaflix', defOrder: 2, type: 'uaflix', url: 'uaflix_new', loadUrl: 'https://uafix.net/dubbing/', title: 'UaFlix', icon: 'https://yarikrazor-star.github.io/lmp/uaflix.png' },
                { id: 'ym_row_movies_new', defOrder: 3, type: 'uas', url: 'uas_movies_new', loadUrl: 'https://uaserials.com/films/p/', title: 'Новинки фільмів', icon: 'https://upload.wikimedia.org/wikipedia/commons/5/51/Ukraine_film_clapperboard.svg' },
                { id: 'ym_row_series_new', defOrder: 4, type: 'uas', url: 'uas_series_new', loadUrl: 'https://uaserials.com/series/p/', title: 'Новинки серіалів', icon: 'https://upload.wikimedia.org/wikipedia/commons/3/3a/Mplayer.svg' },
                { id: 'ym_row_collections', defOrder: 5, type: 'uas_collections', url: 'uas_collections_list', loadUrl: 'https://uaserials.com/collections/', title: 'Підбірки', icon: 'https://upload.wikimedia.org/wikipedia/commons/e/ef/Film-award-stub.svg' },
                { id: 'ym_row_kinobaza', defOrder: 6, type: 'kinobaza', url: 'kinobaza_streaming', loadUrl: 'https://kinobaza.com.ua/online?order_by=date_desc&rating=1&rating_max=10&imdb_rating=1&imdb_rating_max=10&per_page=30&translated=has_ukr_audio&page=', title: 'Новинки Стрімінгів UA', icon: 'https://upload.wikimedia.org/wikipedia/commons/a/a5/Netflix_meaningful_logo.svg' },
                { id: 'ym_row_community', defOrder: 7, type: 'community', url: 'uas_community', title: 'Приховані геми LME', icon: 'https://upload.wikimedia.org/wikipedia/commons/b/b2/Anime_eye_film.png' },
                { id: 'ym_row_movies_watch', defOrder: 8, type: 'uas', url: 'uas_movies_pop', loadUrl: 'https://uaserials.my/filmss/w/', title: 'Популярні фільми', icon: 'https://upload.wikimedia.org/wikipedia/commons/7/7e/Filmreel-icon.svg' },
                { id: 'ym_row_series_pop', defOrder: 9, type: 'uas', url: 'uas_series_pop', loadUrl: 'https://uaserials.com/series/w/', title: 'Популярні серіали', icon: 'https://upload.wikimedia.org/wikipedia/commons/f/f6/Tvfilm.svg' },
                { id: 'ym_row_random', defOrder: 10, type: 'random', url: '', title: 'Випадкові фільми', icon: 'https://upload.wikimedia.org/wikipedia/commons/a/a3/Magicfilm_icon.svg' }
            ];

            let activeRows =[];
            for (let i = 0; i < rowDefs.length; i++) {
                let def = rowDefs[i];
                let enabled = Lampa.Storage.get(def.id);
                if (enabled === null || enabled === undefined || enabled === '') {
                    var f = DEFAULT_ROWS_SETTINGS.find(function(r) { return r.id === def.id; });
                    enabled = f ? f.default : true;
                } else enabled = (enabled === true || enabled === 'true');
                if (enabled) {
                    activeRows.push(Object.assign({}, def, { order: parseInt(Lampa.Storage.get(def.id + '_order')) || def.defOrder }));
                }
            }
            activeRows.sort(function(a, b) { return a.order - b.order; });
            
            let parts_data =[];
            activeRows.forEach(function(def) {
                if (def.type !== 'history') parts_data.push(function(cb) { cb({ results:[makeTitleButtonItem(def.title, def.url, def.icon)], title: '', uas_title_row: true, params: { items: { mapping: 'line', view: 1 } } }); });
                parts_data.push(function(cb) {
                    if (def.type === 'history') loadHistoryRow(cb);
                    else if (def.type === 'uaflix') loadUaFlixRow(def.url, def.loadUrl, def.title, cb);
                    else if (def.type === 'uas') loadRow(def.url, def.loadUrl, def.title, cb);
                    else if (def.type === 'kinobaza') loadKinobazaRow(def.url, def.loadUrl, def.title, cb);
                    else if (def.type === 'uas_collections') loadUaserialsCollectionsRow(def.url, def.loadUrl, def.title, cb);
                    else if (def.type === 'community') loadCommunityGemsRow(cb);
                    else if (def.type === 'random') loadRandomMoviesRow(cb);
                });
            });

            if(!parts_data.length) parts_data.push(function(cb) { loadRow('uas_movies_new', 'https://uaserials.com/films/p/', 'Новинки фільмів', cb); });
            Lampa.Api.partNext(parts_data, 2, oncomplite, onerror);
        };
    }

    function start() {
        if (window.uaserials_pro_v8_loaded) return;
        window.uaserials_pro_v8_loaded = true;

        if (!Lampa.Storage.get('ym_rows_init_v8_fix_16')) {
            Lampa.Storage.set('ym_rows_init_v8_fix_16', true);
            DEFAULT_ROWS_SETTINGS.forEach(function(r) { 
                Lampa.Storage.set(r.id + '_order', r.defOrder);
                if (Lampa.Storage.get(r.id) === null) Lampa.Storage.set(r.id, r.default); 
            });
            ['uas_show_flag','uas_show_fav_card','uas_show_history_btn','uas_badge_year','uas_badge_season','uas_badge_rating','uas_lazy_load'].forEach(function(k) { if(Lampa.Storage.get(k) === null) Lampa.Storage.set(k, true); });
            if (Lampa.Storage.get('ym_logo_size') === null) Lampa.Storage.set('ym_logo_size', '40');
            if (Lampa.Storage.get('uas_bg_mode') === null) Lampa.Storage.set('uas_bg_mode', '1');
        }

        updateDynamicStyles(); cleanOldCaches(); lmeCache = new Cache(CONFIG.cache); lmeCache.init();
        AltImageCache.init(); BgManager.init(); createSettings();

        var style = document.createElement('style');
        style.innerHTML = `
            .card .card__age { display: none !important; }
            .card__view .card-badge-age { display: block !important; right: 0 !important; top: 0 !important; padding: 0.2em 0.45em !important; background: rgba(0, 0, 0, 0.6) !important; position: absolute !important; margin-top: 0 !important; font-size: 1.1em !important; z-index: 10 !important; color: #fff !important; font-weight: bold !important; }
            .card--wide-custom { width: 25em !important; margin-right: 0.2em !important; margin-bottom: 0 !important; position: relative; cursor: pointer; transition: transform 0.2s ease, z-index 0.2s ease; z-index: 1; }
            .card--wide-custom .card__view { border-radius: 0.4em !important; overflow: hidden !important; box-shadow: 0 3px 6px rgba(0,0,0,0.5); }
            .card--wide-custom .card-backdrop-overlay { position: absolute; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0, 0, 0, 0.5); pointer-events: none; border-radius: 0.4em !important; z-index: 1; }
            .card--wide-custom.focus { z-index: 99 !important; transform: scale(1.08) !important; }
            .card--wide-custom.focus .card__view { box-shadow: 0 10px 25px rgba(0,0,0,0.9) !important; border: 3px solid #fff !important; outline: none !important; }
            .card--wide-custom.focus .card__view::after, .card--wide-custom.focus .card__view::before { display: none !important; content: none !important; }
            .card-custom-logo { position: absolute; left: 50%; z-index: 5; filter: drop-shadow(0px 3px 5px rgba(0,0,0,0.8)); pointer-events: none; transition: filter 0.3s ease; }
            .card-custom-logo-text { position: absolute; left: 50%; width: 80%; text-align: center; font-weight: 600; color: #fff; text-shadow: 0px 2px 4px rgba(0,0,0,0.8); z-index: 5; pointer-events: none; word-wrap: break-word; white-space: normal; line-height: 1.2; font-family: sans-serif; display: flex; align-items: center; justify-content: center; }
            .card--wide-custom .card-custom-logo-text { text-shadow: none !important; }
            .logo-pos-center { top: 50%; transform: translate(-50%, -50%); } .logo-pos-top { top: 8%; transform: translateX(-50%); } .logo-pos-bottom { bottom: 8%; top: auto; transform: translateX(-50%); }
            .card--wide-custom > div:not(.card__view):not(.custom-title-bottom):not(.custom-overview-bottom) { display: none !important; }
            .custom-title-bottom { width: 100%; text-align: var(--uas-text-align, center) !important; font-size: var(--uas-title-size, 1.1em) !important; font-weight: bold; margin-top: 0.3em; color: #fff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; padding: 0 0.2em; display: block !important; }
            .custom-overview-bottom { width: 100%; text-align: var(--uas-desc-align, left) !important; font-size: var(--uas-desc-size, 0.85em) !important; color: #bbb; line-height: 1.2; margin-top: 0.2em; padding: 0 0.2em; display: -webkit-box !important; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; white-space: normal; }
            .card .card__title { text-align: var(--uas-text-align, center) !important; font-size: var(--uas-title-size, 1.0em) !important; }
            body.uas-hide-text .card__title, body.uas-hide-text .custom-title-bottom, body.uas-hide-text .custom-overview-bottom { display: none !important; }
            .card__vote { right: 0 !important; bottom: 0 !important; padding: 0.2em 0.45em !important; z-index: 2; position: absolute !important; font-weight: bold; background: rgba(0,0,0,0.6); }
            .card__type { position: absolute !important; left: 0 !important; top: 0 !important; width: auto !important; height: auto !important; line-height: 1 !important; padding: 0.3em !important; background: rgba(0, 0, 0, 0.5) !important; display: flex !important; align-items: center; justify-content: center; z-index: 2; color: #fff !important; transition: background 0.3s !important; }
            .card__type svg { width: 1.5em !important; height: 1.5em !important; }
            .card__type.card__type--season { font-size: 1.1em !important; font-weight: bold !important; padding: 0.2em 0.45em !important; font-family: Roboto, Arial, sans-serif !important; }
            .card__ua_flag { position: absolute !important; left: 0 !important; bottom: 0 !important; width: 2.4em !important; height: 1.4em !important; font-size: 1.3em !important; background: linear-gradient(180deg, #0057b8 50%, #ffd700 50%) !important; opacity: 0.8 !important; z-index: 2; }
            .card--wide-custom .card-badge-age { border-radius: 0 0 0 0.5em !important; } .card--wide-custom .card__vote { border-radius: 0.5em 0 0 0 !important; } .card--wide-custom .card__type { border-radius: 0 0 0.5em 0 !important; } .card--wide-custom .card__ua_flag { border-radius: 0 0.5em 0 0 !important; }
            body:not(.uas-alt-design-active) .card:not(.card--wide-custom):not(.card--history-custom) .card-badge-age { border-radius: 0 0.8em 0 0.8em !important; }
            body:not(.uas-alt-design-active) .card:not(.card--wide-custom):not(.card--history-custom) .card__vote { border-radius: 0.8em 0 0.8em 0 !important; }
            body:not(.uas-alt-design-active) .card:not(.card--wide-custom):not(.card--history-custom) .card__type { border-radius: 0.8em 0 0.8em 0 !important; }
            body:not(.uas-alt-design-active) .card:not(.card--wide-custom):not(.card--history-custom) .card__ua_flag { border-radius: 0 0.8em 0 0.8em !important; }
            body.uas-alt-design-active .card__vote, body.uas-alt-design-active .card-rating, body.uas-alt-design-active .card .card__vote { display: none !important; opacity: 0 !important; visibility: hidden !important; }
            body.uas-alt-design-active:not(.uas-alt-design-2) .card--wide-custom .card-backdrop-overlay { display: none !important; background: transparent !important; }
            body.uas-alt-design-active:not(.uas-alt-design-2) .card--wide-custom .card__view::after, body.uas-alt-design-active:not(.uas-alt-design-2) .card--wide-custom .card__view::before { display: none !important; content: none !important; }
            .settings__menu [data-component="ymainpage_ext_rt"], .settings__menu [data-component="ymainpage_rows"] { display: none !important; }
            
            /* Основа контейнера бейджів, зменшений gap (0.1em) */
            .card .card-custom-badges { position: absolute !important; display: flex !important; flex-direction: column !important; gap: 0.1em !important; z-index: 20 !important; pointer-events: none !important; background: transparent !important; }
            
            /* Стандартні позиції (кути та центри) */
            .card .badge-pos-tl { left: 0.3em !important; top: 0.55em !important; align-items: flex-start !important; } 
            .card .badge-pos-tr { right: 0.3em !important; top: 0.55em !important; align-items: flex-end !important; }
            .card .badge-pos-ml { left: 0.3em !important; top: 50% !important; transform: translateY(-50%) !important; align-items: flex-start !important; } 
            .card .badge-pos-mr { right: 0.3em !important; top: 50% !important; transform: translateY(-50%) !important; align-items: flex-end !important; }
            .card .badge-pos-bl { left: 0.3em !important; bottom: 0.55em !important; align-items: flex-start !important; } 
            .card .badge-pos-br { right: 0.3em !important; bottom: 0.55em !important; align-items: flex-end !important; }
            
            /* Горизонтальні позиції (спільний контейнер з flex-wrap) */
            .card .badge-pos-top_horz { top: 0.55em !important; left: 0 !important; width: 100% !important; flex-direction: row !important; align-items: center !important; justify-content: center !important; flex-wrap: wrap !important; padding: 0 0.3em !important; box-sizing: border-box !important; }
            .card .badge-pos-bottom_horz { bottom: 0.55em !important; left: 0 !important; width: 100% !important; flex-direction: row !important; align-items: center !important; justify-content: center !important; flex-wrap: wrap !important; padding: 0 0.3em !important; box-sizing: border-box !important; }
            
            /* Внутрішні групи бейджів (для збереження блоку при перенесенні рядка) */
            .card .inner-badges-group, .card .inner-ratings-group { display: flex !important; flex-direction: row !important; flex-wrap: wrap !important; justify-content: center !important; gap: 0.1em !important; }
            
            /* Порядок виведення: якщо зверху - рейтинги над бейджами, якщо знизу - бейджі над рейтингами */
            .card .badge-pos-top_horz .inner-ratings-group { order: 1 !important; }
            .card .badge-pos-top_horz .inner-badges-group { order: 2 !important; }
            .card .badge-pos-bottom_horz .inner-badges-group { order: 1 !important; }
            .card .badge-pos-bottom_horz .inner-ratings-group { order: 2 !important; }
            
            /* Загальний вигляд усіх альт. бейджів */
            .card .card-custom-badges .card-badge-age, .card .card-custom-badges .card__type, .card .card-custom-badges .card__ua_flag, .card .card-custom-badges .ext-rating-badge { position: static !important; margin: 0 !important; height: 1.8em !important; min-height: 1.8em !important; width: auto !important; border-radius: 2em !important; display: flex !important; align-items: center !important; justify-content: center !important; background: rgba(0, 0, 0, 0.55) !important; padding: 0 0.6em !important; font-size: var(--uas-badge-size, 0.7em) !important; font-weight: 700 !important; color: #fff !important; box-shadow: none !important; line-height: 1 !important; border: 1px solid rgba(255,255,255,0.15) !important; box-sizing: border-box !important; }
            .card .ext-rating-badge img { margin-right: 0.35em !important; width: 1.1em !important; height: 1.1em !important; object-fit: contain !important; filter: drop-shadow(0 1px 1px rgba(0,0,0,0.5)) !important; }
            
            /* Порядок всередині груп для збереження внутрішньої логіки */
            .card .card-alt-rating { order: 0 !important; } .card .card-custom-badges .card-badge-age { order: 1 !important; } .card .card-custom-badges .card__type { order: 2 !important; } .card .card-custom-badges .card__ua_flag { order: 3 !important; } .card .card-custom-badges .ext-rating-badge { order: 4 !important; }
            
            .card .card-custom-badges .card__ua_flag { display: flex !important; visibility: visible !important; opacity: 1 !important; text-shadow: none !important; box-shadow: none !important; }
            
            /* Відступи від країв */
            body:not(.uas-alt-design-active) .card .card-custom-badges.badge-pos-tl, body:not(.uas-alt-design-active) .card .card-custom-badges.badge-pos-tr { top: 2.2em !important; }
            body:not(.uas-alt-design-active) .card .card-custom-badges.badge-pos-bl, body:not(.uas-alt-design-active) .card .card-custom-badges.badge-pos-br { bottom: 2.2em !important; }
            body:not(.uas-alt-design-active) .card .card-custom-badges.badge-pos-top_horz { top: 2.2em !important; }
            body:not(.uas-alt-design-active) .card .card-custom-badges.badge-pos-bottom_horz { bottom: 2.2em !important; }
            
            .card--history-custom .card-custom-badges, .card--history-custom .card-left-badges, .card--history-custom .card__vote, .card--history-custom .card-badge-age, .card--history-custom .card__type, .card--history-custom .card__ua_flag { display: none !important; }
            .uas-poster-loaded { animation: uasImgFadeIn 0.5s ease-out forwards !important; }
            @keyframes uasImgFadeIn { from { opacity: 0.5; filter: blur(3px); } to { opacity: 1; filter: blur(0); } }
            .items-line[data-uas-title-row="true"] .items-line__head, .items-line[data-uas-content-row="true"] .items-line__head { display: none !important; }
            .items-line[data-uas-title-row="true"], .items-line[data-uas-title-row="true"] .items-line__body, .items-line[data-uas-title-row="true"] .scroll__item { margin-top: 0 !important; padding-top: 0 !important; padding-bottom: 0 !important; margin-bottom: 0 !important; } .items-line[data-uas-title-row="true"]{ margin-bottom: 0.5em !important; }
            .items-line[data-uas-content-row="true"], .items-line[data-uas-content-row="true"] .items-line__body, .items-line[data-uas-content-row="true"] .scroll__item { margin-top: 0 !important; padding-top: 0 !important; padding-bottom: 0 !important; margin-bottom: 0 !important; } .items-line[data-uas-content-row="true"]{ margin-top: 0.1em !important; margin-bottom: 0.5em !important; }
            .card--title-btn { width: 100vw !important; max-width: 100% !important; height: auto !important; background: transparent !important; border-radius: 1.5em !important; margin: 0.2em 0 !important; display: flex !important; align-items: center !important; justify-content: flex-start !important; padding: 0.5em 1.5em !important; cursor: pointer !important; border: 2px solid transparent !important; box-sizing: border-box !important; transition: transform 0.2s ease, border 0.2s ease, background 0.2s ease !important; }
            .card--title-btn.focus { background: rgba(255, 255, 255, 0.05) !important; border: 2px solid #fff !important; transform: scale(1.01) !important; }
            .title-btn-text { display: flex !important; align-items: center !important; font-size: 1.4em !important; font-weight: bold !important; color: #777 !important; transition: color 0.2s ease, transform 0.2s ease !important; }
            .title-btn-icon { height: 1.1em !important; width: auto !important; margin-right: 0.5em !important; filter: drop-shadow(0px 1px 2px rgba(0,0,0,0.5)) !important; }
            .card--title-btn.focus .title-btn-text { color: #fff !important; } .card--title-btn-static { cursor: default !important; } .card--title-btn-static .title-btn-text { opacity: 0.5 !important; }
            .card--title-btn .card__view, .card--title-btn .card__view::after, .card--title-btn .card__view::before { display: none !important; }
            .card--collection-btn { width: 16em !important; height: 7em !important; background: rgba(40,40,40,0.8) !important; border-radius: 0.8em !important; margin-right: 0.8em !important; margin-bottom: 0.8em !important; display: flex !important; flex-direction: column !important; align-items: center !important; justify-content: center !important; padding: 1em !important; cursor: pointer !important; border: 2px solid transparent !important; box-shadow: 0 4px 6px rgba(0,0,0,0.3) !important; transition: transform 0.2s ease, background 0.2s ease, border 0.2s ease !important; text-align: center !important; box-sizing: border-box !important; }
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
            .uas-bg-layer.active { opacity: 1; } body.uas-bg-disabled #uas-bg-container { display: none !important; } body.uas-bg-instant .uas-bg-layer { transition: opacity 0s !important; }
            body.uas-main-active .background { display: none !important; opacity: 0 !important; } body.uas-main-active .wrap { position: relative; z-index: 2; }
            
            /* ========================================================================= */
            /* МОБІЛЬНИЙ ВИГЛЯД (2 КАРТКИ НА ЕКРАН + ДИНАМІЧНІ ПІДБІРКИ)                 */
            /* ========================================================================= */
            @media (orientation: portrait), (max-width: 768px) {
                /* Усі стандартні та кастомні картки на головній в рядках: ширина 44vw, 2 на екран */
                .items-line[data-uas-content-row="true"] .scroll__body > .card,
                .items-line[data-uas-content-row="true"] .items-cards > .card {
                    width: 44vw !important;
                    min-width: 44vw !important;
                    max-width: 44vw !important;
                    margin-right: 0.6em !important;
                }
                
                .card--wide-custom, .card--history-custom {
                    width: 44vw !important;
                    min-width: 44vw !important;
                    max-width: 44vw !important;
                }

                /* Динамічна висота та повний текст для Підбірок */
                .card--collection-btn {
                    width: 44vw !important;
                    min-width: 44vw !important;
                    max-width: 44vw !important;
                    height: auto !important;
                    min-height: 24vw !important;
                    aspect-ratio: auto !important;
                    padding: 0.8em 0.5em !important;
                    justify-content: center !important;
                }
                
                .card--collection-btn .collection-title {
                    display: block !important;
                    -webkit-line-clamp: unset !important;
                    overflow: visible !important;
                    white-space: normal !important;
                    word-wrap: break-word !important;
                    font-size: 1.05em !important;
                }

                .card--wide-custom .custom-overview-bottom { display: none !important; }
                .card--wide-custom .custom-title-bottom { font-size: 1em !important; margin-top: 0.1em; }
                .items-line[data-uas-title-row="true"] { margin-bottom: 0 !important; }
                .items-line[data-uas-content-row="true"] { margin-bottom: 0.2em !important; }
                .card--title-btn { margin: 0 !important; padding: 0.2em 1em !important; min-height: 2em !important; }
                .title-btn-text { font-size: 1.1em !important; }
            }
        `;
        document.head.appendChild(style);

        Lampa.Listener.follow('line', function(e) { if (e.type === 'create' && e.data && e.line && e.line.render) { var el = e.line.render(); if (e.data.uas_title_row) el.attr('data-uas-title-row', 'true'); if (e.data.uas_content_row) el.attr('data-uas-content-row', 'true'); } });
        var initialFocusHandled = true; 
        Lampa.Listener.follow('activity', function(e) {
            if (e.type === 'start') {
                initialFocusHandled = false; window.uas_initial_bg_set = false; 
                if (e.component === 'main' || e.component === 'tmdb' || !e.component) { document.body.classList.add('uas-main-active'); BgManager.show(); }
                else { document.body.classList.remove('uas-main-active'); BgManager.hide(); }
                updateDynamicStyles();
            }
        });
        Lampa.Listener.follow('controller', function(e) { if (e.type === 'focus' && !initialFocusHandled) { initialFocusHandled = true; if ($(e.target).hasClass('card--title-btn')) setTimeout(function() { Lampa.Controller.move('down'); }, 20); } });

        var CardMaker = Lampa.Maker.map('Card');
        var originalOnVisible = CardMaker.Card.onVisible;

        CardMaker.Card.onVisible = function () {
            if (!this.html || !this.data) return;
            var cardInstance = this, html = this.html, data = this.data;
            var altDesignType = getAltDesignType(), useAltDesign = altDesignType === '1' || altDesignType === '2';
            var isWideCard = html.classList.contains('card--wide-custom'), isHistoryCard = html.classList.contains('card--history-custom');
            var isSpecialCard = html.classList.contains('card--title-btn') || html.classList.contains('card--collection-btn') || data.is_title_btn || data.is_collection_btn;
            
            var isStandardVerticalAlt2 = altDesignType === '2' && !isWideCard && !isHistoryCard && !isSpecialCard && Lampa.Storage.get('uas_alt2_standard_poster') !== true;

            if (isStandardVerticalAlt2) {
                var imgEl = html.querySelector('.card__img');
                if (imgEl && !imgEl.dataset.srcIntercepted) {
                    imgEl.dataset.srcIntercepted = 'true';
                    Object.defineProperty(imgEl, 'src', { set: function(val) { this.dataset.fallbackSrc = val; }, get: function() { return this.dataset.fallbackSrc || ''; }, configurable: true });
                }
            }

            if (!isSpecialCard) originalOnVisible.apply(this, arguments);
            else this.visible = true; 

            if (isSpecialCard) return;

            var view = html.querySelector('.card__view');
            
            var getContainer = function(posClass, isRating) {
                var clsName = 'badge-pos-' + posClass;
                var container = view.querySelector('.card-custom-badges.' + clsName);
                if (!container) { 
                    container = document.createElement('div'); 
                    container.className = 'card-custom-badges ' + clsName; 
                    view.appendChild(container); 
                }

                var isHorz = posClass === 'top_horz' || posClass === 'bottom_horz';
                if (isHorz) {
                    var innerClass = isRating ? 'inner-ratings-group' : 'inner-badges-group';
                    var innerContainer = container.querySelector('.' + innerClass);
                    if (!innerContainer) {
                        innerContainer = document.createElement('div');
                        innerContainer.className = innerClass;
                        container.appendChild(innerContainer);
                    }
                    return innerContainer;
                }

                return container;
            };

            var badgePos = Lampa.Storage.get('uas_alt_badge_pos') || 'tl', ratingPos = Lampa.Storage.get('uas_alt_rating_pos') || 'tr';
            var targetContainer = useAltDesign ? getContainer(badgePos, false) : view;
            var ratingContainer = getContainer(ratingPos, true);

            if (useAltDesign) html.classList.add('uas-alt-card'); else html.classList.remove('uas-alt-card');

            var showRating = Lampa.Storage.get('uas_badge_rating') !== false;
            var vote = html.getElementsByClassName('card__vote');
            if (useAltDesign || !showRating) {
                for (let v = 0; v < vote.length; v++) { vote[v].style.setProperty('display', 'none', 'important'); vote[v].style.setProperty('opacity', '0', 'important'); }
                if (useAltDesign) { var ratings = html.getElementsByClassName('card-rating'); for (let r = 0; r < ratings.length; r++) ratings[r].style.setProperty('display', 'none', 'important'); }
            } else if (vote.length && !isWideCard && !isHistoryCard) {
                var color = getColor(parseFloat(vote[0].textContent.trim()), 0.8); if (color) vote[0].style.backgroundColor = color;
            }

            if (view && data) {
                var ageBadge = view.querySelector('.card-badge-age');
                if (Lampa.Storage.get('uas_badge_year') !== false) {
                    if (!ageBadge) {
                        var yearStr = String(data.release_date || data.first_air_date || '').substring(0, 4);
                        if (yearStr.length === 4) { ageBadge = document.createElement('div'); ageBadge.className = 'card-badge-age'; ageBadge.innerText = yearStr; targetContainer.appendChild(ageBadge); }
                    } else if (ageBadge.parentNode !== targetContainer) targetContainer.appendChild(ageBadge);
                } else if (ageBadge) ageBadge.style.setProperty('display', 'none', 'important');
            }

            var doHeavyTasks = function() {
                if (Lampa.Storage.get('uas_ext_ratings_enable') === true && data.id && !isHistoryCard) {
                    if (!useAltDesign && Lampa.Storage.get('uas_ext_rt_tmdb') !== false) for (let v = 0; v < vote.length; v++) vote[v].style.setProperty('display', 'none', 'important');
                    if (Lampa.Storage.get('uas_ext_rt_tmdb') !== false && data.vote_average > 0) {
                        if (!ratingContainer.querySelector(`.ext-rt-tmdb`)) {
                            let badge = document.createElement('div'); badge.className = `ext-rt-tmdb ext-rating-badge`; badge.innerHTML = `<img src="${rateIcons.tmdb}"><span>${data.vote_average.toFixed(1)}</span>`; ratingContainer.appendChild(badge);
                        }
                    }
                    fetchExtRatings(data.id, data.media_type || (data.name ? 'tv' : 'movie')).then(function(ratings) {
                        if (!ratings || !cardInstance.html || !cardInstance.html.parentNode) return; 
                        ['imdb', 'rt', 'mc', 'letterboxd', 'trakt', 'mdblist', 'popcorn'].forEach(function(key) {
                            if (ratings[key] && Lampa.Storage.get('uas_ext_rt_' + key) !== false && !ratingContainer.querySelector(`.ext-rt-${key}`)) {
                                let badge = document.createElement('div'), displayVal = formatExtRating(ratings[key], key);
                                if (displayVal) { badge.className = `ext-rt-${key} ext-rating-badge`; badge.innerHTML = `<img src="${rateIcons[key]}"><span>${displayVal}</span>`; ratingContainer.appendChild(badge); }
                            }
                        });
                    });
                } else if (altDesignType === '2' && !isHistoryCard && data.vote_average && showRating) {
                    var voteValAlt = parseFloat(data.vote_average);
                    if (!isNaN(voteValAlt) && voteValAlt > 0) {
                        var rBadge = view.querySelector('.card-alt-rating');
                        if (!rBadge) { rBadge = document.createElement('div'); rBadge.className = 'card-alt-rating ext-rating-badge'; rBadge.innerHTML = `<img src="${rateIcons.tmdb}"><span>${voteValAlt.toFixed(1)}</span>`; ratingContainer.appendChild(rBadge); }
                        else if (rBadge.parentNode !== ratingContainer) ratingContainer.appendChild(rBadge);
                    }
                }

                if (altDesignType === '1' && data.id && Lampa.Storage.get('uas_alt_design_apikey')) {
                    if (!isHistoryCard) {
                        getImdbIdForTmdb(data.id, data.media_type || (data.name ? 'tv' : 'movie')).then(async function(imdb) {
                            if (imdb) {
                                var targetUrl = 'https://easyratingsdb.com/' + Lampa.Storage.get('uas_alt_design_apikey') + (isWideCard ? '/backdrop/' : '/poster/') + imdb + '.jpg';
                                var cachedUrl = await AltImageCache.get(targetUrl);
                                if (isWideCard) {
                                    if (cachedUrl) { view.style.backgroundImage = `url(${cachedUrl})`; data.custom_full_bg = targetUrl; }
                                    else { var t = new Image(); t.onload = function() { AltImageCache.setAndGet(targetUrl).then(function(u) { view.style.backgroundImage = `url(${u})`; data.custom_full_bg = targetUrl; }); }; t.src = targetUrl; }
                                } else {
                                    var img = html.querySelector('.card__img');
                                    if (img && !img.dataset.alt1Loaded) {
                                        img.dataset.alt1Loaded = 'true';
                                        var quality = Lampa.Storage.get('ym_img_quality') || 'w300';
                                        var fbSrc = PROXIES[0] + Lampa.TMDB.image('t/p/' + quality + data.poster_path);
                                        if (cachedUrl) img.src = cachedUrl;
                                        else {
                                            var tmp = new Image();
                                            tmp.onload = function() { AltImageCache.setAndGet(targetUrl).then(function(u) { img.src = u; img.classList.add('uas-poster-loaded'); }); };
                                            tmp.onerror = function() { img.src = fbSrc; }; tmp.src = targetUrl;
                                        }
                                    }
                                }
                            }
                        });
                    }
                }

                if (Lampa.Storage.get('uas_show_flag') !== false && data.id) {
                    var oldFlag = html.querySelector('.card__ua_flag');
                    if (!oldFlag) {
                        var meta = createMediaMeta(data);
                        if (meta) {
                            var cached = lmeCache.get(meta.cacheKey);
                            if (cached === true) renderFlag(html, targetContainer, useAltDesign);
                            else if (cached !== false) loadFlag(meta).then(function(isSuccess) { if (isSuccess && cardInstance.html && cardInstance.html.parentNode) renderFlag(cardInstance.html, targetContainer, useAltDesign); });
                        }
                    } else {
                        if (oldFlag.parentNode !== targetContainer) targetContainer.appendChild(oldFlag);
                        oldFlag.innerText = useAltDesign ? 'UA' : '';
                    }
                } else if (Lampa.Storage.get('uas_show_flag') === false) {
                    var oldFlagToRemove = html.querySelector('.card__ua_flag'); if (oldFlagToRemove) oldFlagToRemove.remove();
                }

                if (Lampa.Storage.get('uas_badge_season') !== false && (data.media_type === 'tv' || data.name || data.number_of_seasons) && data.id) {
                    fetchSeriesData(data.id).then(function(tmdbData) { if (cardInstance.html && cardInstance.html.parentNode && cardInstance.data === data) renderSeasonBadge(cardInstance.html, tmdbData, targetContainer); }).catch(function(){});
                } else if (Lampa.Storage.get('uas_badge_season') === false) {
                    var seasonBadge = html.querySelector('.card__type--season') || html.querySelector('.card__type'); if (seasonBadge) seasonBadge.style.setProperty('display', 'none', 'important');
                }

                if (!isWideCard && !isHistoryCard && !isSpecialCard) {
                    if (altDesignType === '2' && !html.dataset.alt2LogoFetched) {
                        if (data.id) { html.dataset.alt2LogoFetched = 'true'; fetchLogo(data, $(html)); }
                        else {
                            var imgElFb = html.querySelector('.card__img');
                            if (imgElFb && imgElFb.dataset.fallbackSrc && !imgElFb.dataset.fallbackLoaded) {
                                imgElFb.dataset.fallbackLoaded = 'true'; delete imgElFb.src; imgElFb.src = imgElFb.dataset.fallbackSrc;
                            }
                        }
                    }
                }
            };
            isLazyLoadEnabled() ? LazyLoader.add(html, doHeavyTasks) : doHeavyTasks();
        };

        overrideApi();
    }

    if (window.appready) start(); else Lampa.Listener.follow('app', function(e) { if (e.type === 'ready') start(); });

})();