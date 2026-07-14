(function () {
    'use strict';

    if (!window.Lampa || !window.$) return;
    if (window.__uacomments_plugin_started) return;
    window.__uacomments_plugin_started = true;

    var UACOMMENTS_VERSION = '1.0.0';

    //  Модифікація команди BazarNet | LampaUa.
    // Плагін збирає українські коментарі з кількох джерел і показує їх у картці фільму.

    // Базові проксі для отримання HTML із зовнішніх сайтів.
    var PROXIES = [
        'https://cors.lampa.stream/',
        'https://cors.eu.org/',
        'https://corsproxy.io/?url='
    ];

    // Поточний стан плагіна.
    var state = {
        active: false,
        activity: null,
        button: null,
        comments: [],
        loading: false,
        mountTimer: 0,
        requestId: 0
    };

    var Viewer = {
        active: false,
        root: null,
        list: [],
        index: 0,
        prevController: '',
        hideTimer: 0
    };

    // Локалізація інтерфейсу (uk / en / ru).
    var I18N = {
        plugin_name: { uk: 'UA Коментарі', en: 'UA Comments', ru: 'UA Комментарии' },
        block_title: { uk: 'UA Коментарі', en: 'UA Comments', ru: 'UA Комментарии' },
        status_searching: { uk: 'Шукаємо коментарі...', en: 'Searching comments...', ru: 'Ищем комментарии...' },
        status_not_found: { uk: 'Коментарів не знайдено', en: 'Comments not found', ru: 'Комментарии не найдены' },
        button_comments: { uk: 'Коментарі', en: 'Comments', ru: 'Комментарии' },
        read_full: { uk: 'Читати повністю', en: 'Read full', ru: 'Читать полностью' },
        user: { uk: 'Користувач', en: 'User', ru: 'Пользователь' },
        critic: { uk: 'Критик', en: 'Critic', ru: 'Критик' },
        source_default: { uk: 'Джерело', en: 'Source', ru: 'Источник' },
        source_kb_review: { uk: 'KinoBaza: рецензія', en: 'KinoBaza review', ru: 'KinoBaza: рецензия' },
        about_description: {
            uk: 'UA Comments: збір і відображення коментарів у картці фільму з українських джерел.',
            en: 'UA Comments: collects and displays comments in the movie card from Ukrainian sources.',
            ru: 'UA Comments: сбор и отображение комментариев в карточке фильма из украинских источников.'
        },
        settings_sources: { uk: 'Джерела коментарів', en: 'Comment Sources', ru: 'Источники комментариев' },
        settings_viewer_style: { uk: 'Оформлення вікна перегляду', en: 'Viewer Appearance', ru: 'Оформление окна просмотра' },

        use_uakino: { uk: 'UaKino', en: 'UaKino', ru: 'UaKino' },
        use_uakino_desc: { uk: 'Шукати коментарі на uakino.best', en: 'Search comments on uakino.best', ru: 'Искать комментарии на uakino.best' },
        use_uaflix: { uk: 'UAFlix', en: 'UAFlix', ru: 'UAFlix' },
        use_uaflix_desc: { uk: 'Шукати коментарі на uafix.net', en: 'Search comments on uafix.net', ru: 'Искать комментарии на uafix.net' },
        use_uaserials: { uk: 'UASerials', en: 'UASerials', ru: 'UASerials' },
        use_uaserials_desc: { uk: 'Шукати коментарі на uaserials.com', en: 'Search comments on uaserials.com', ru: 'Искать комментарии на uaserials.com' },
        use_kinobaza: { uk: 'KinoBaza', en: 'KinoBaza', ru: 'KinoBaza' },
        use_kinobaza_desc: { uk: 'Шукати коментарі та рецензії на kinobaza.com.ua', en: 'Search comments and reviews on kinobaza.com.ua', ru: 'Искать комментарии и рецензии на kinobaza.com.ua' },

        viewer_width: { uk: 'Ширина вікна', en: 'Viewer width', ru: 'Ширина окна' },
        viewer_font: { uk: 'Розмір шрифту вікна', en: 'Viewer font size', ru: 'Размер шрифта окна' },

        size_small: { uk: 'Малий', en: 'Small', ru: 'Малый' },
        size_medium: { uk: 'Середній', en: 'Medium', ru: 'Средний' },
        size_large: { uk: 'Великий', en: 'Large', ru: 'Большой' },
        size_full: { uk: 'На всю ширину', en: 'Full width', ru: 'Во всю ширину' },
        compact: { uk: 'Компактний', en: 'Compact', ru: 'Компактный' }
    };

    function langCode() {
        var lang = String(Lampa.Storage.get('language', 'uk') || 'uk').toLowerCase();
        if (lang.indexOf('en') === 0) return 'en';
        if (lang.indexOf('ru') === 0) return 'ru';
        return 'uk';
    }

    function t(key) {
        var pack = I18N[key] || {};
        var lang = langCode();
        return pack[lang] || pack.uk || key;
    }

    // Допоміжне читання boolean-налаштувань із Lampa.Storage.
    function getBool(key, def) {
        var value = Lampa.Storage.get(key);
        if (value === undefined || value === null) return !!def;
        return !(value === false || value === 'false' || value === 0 || value === '0');
    }

    function getVal(key, def) {
        var value = Lampa.Storage.get(key);
        return value === undefined || value === null || value === '' ? def : value;
    }

    // Оновлення CSS-змінних відповідно до налаштувань користувача.
    function updateCssVars() {
        try {
            var root = document.documentElement;
            root.style.setProperty('--uac-viewer-font', getVal('uac_viewer_font', '1.25em'));
            root.style.setProperty('--uac-viewer-width', getVal('uac_viewer_width', '720px'));
        } catch (e) {}
    }

    function escapeHtml(str) {
        return String(str || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function safeTextToHtml(str) {
        return escapeHtml(str).replace(/\n/g, '<br>');
    }

    function cleanupText(str) {
        return String(str || '')
            .replace(/\r/g, '')
            .replace(/[ \t]+\n/g, '\n')
            .replace(/\n[ \t]+/g, '\n')
            .replace(/\n{3,}/g, '\n\n')
            .replace(/\s*(read more|\.\.\.|…)\s*$/i, '')
            .trim();
    }

    // Прибирає службові рядки та кнопки дій із тексту коментаря.
    function stripCommentJunk(str) {
        var text = cleanupText(str);
        if (!text) return '';

        var actionLine = /^(вiдповiсти|відповісти|ответить|reply|цитувати|цитировать|quote|скарга|жалоба|report|поскаржитись|пожаловаться|редагувати|редактировать|edit)$/i;
        var statusLine = /^(гiсть|гість|гость|guest|користувач|пользователь|user)(\b|$)/i;
        var dateLine = /^(\d{1,2}[.\-/]\d{1,2}([.\-/]\d{2,4})?([, ]+\d{1,2}:\d{2})?|\d{1,2}\s+[а-яіїєёa-z]+\s+\d{2,4}([, ]+\d{1,2}:\d{2})?)$/i;

        var lines = text.split('\n');
        var out = [];
        var i;

        for (i = 0; i < lines.length; i++) {
            var line = cleanupText(lines[i]);
            if (!line) continue;
            if (actionLine.test(line)) continue;
            if (statusLine.test(line)) continue;
            if (dateLine.test(line)) continue;
            if (/^\d{1,2}:\d{2}$/.test(line)) continue;
            if (/^(online|offline)$/i.test(line)) continue;
            if (/^(\.\.\.|…|-{2,})$/.test(line)) continue;
            out.push(line);
        }

        return cleanupText(out.join('\n'));
    }

    function normLineForCompare(str) {
        return String(str || '')
            .toLowerCase()
            .replace(/[.,:;!?'"\-–—_()[\]{}]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
    }

    // Прибирає дубль автора та службові "гість/гості" на початку тексту коментаря.
    function removeAuthorDupLines(text, author) {
        var cleaned = cleanupText(text);
        if (!cleaned) return '';

        var authorNorm = normLineForCompare(author);
        var lines = cleaned.split('\n');
        var out = [];
        var i;
        var leadService = /^(гiсть|гість|гость|гостi|гості|guests?|users?|користувач|пользователь)(\b|$)/i;

        for (i = 0; i < lines.length; i++) {
            var raw = cleanupText(lines[i]);
            if (!raw) continue;

            var norm = normLineForCompare(raw);
            if (!norm) continue;

            // На початку коментаря прибираємо дубль автора або службові рядки.
            if (out.length < 2) {
                if (authorNorm && norm === authorNorm) continue;
                if (authorNorm && norm.indexOf(authorNorm) !== -1 && leadService.test(raw)) continue;
                if (leadService.test(raw) && norm.split(' ').length <= 3) continue;
            }

            out.push(raw);
        }

        return cleanupText(out.join('\n'));
    }

    function extractCommentText(node) {
        var textNode = node.find('[itemprop="reviewBody"], .comm-text, .comment-content, .comment-body, .comment-text, .js-comment-body, .content, .text, .message').first();
        var clean = textNode.length ? textNode.clone() : node.clone();

        clean.find('script,style,iframe,svg,path,button,a').remove();
        clean.find('.comm-good-bad,.comment-reply,.reply,[class*="reply"],[class*="quote"],[class*="date"],[class*="time"],[class*="meta"],[class*="status"],[class*="tools"],[class*="action"],[class*="share"],[class*="like"],[class*="rate"],[class*="complain"]').remove();
        clean.find('[datetime],[itemprop="datePublished"],time').remove();
        clean.find('br').replaceWith('\n');
        clean.find('p').each(function () { $(this).append('\n'); });

        return stripCommentJunk(clean.text());
    }

    function normalizeTitle(str) {
        return String(str || '')
            .toLowerCase()
            .replace(/\([^)]*\)|\[[^\]]*\]/g, ' ')
            .replace(/[^a-z0-9\u0400-\u04ff\s]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
    }

    function similarTitle(a, b) {
        var x = normalizeTitle(a);
        var y = normalizeTitle(b);
        if (!x || !y) return true;
        if (x === y || x.indexOf(y) !== -1 || y.indexOf(x) !== -1) return true;

        var xa = x.split(' ');
        var ya = y.split(' ');
        var i, hit = 0;
        for (i = 0; i < xa.length; i++) {
            if (xa[i] && ya.indexOf(xa[i]) !== -1) hit++;
        }
        return hit >= Math.max(2, Math.floor(xa.length * 0.6));
    }

    // Безпечний парсер HTML (блокуємо завантаження src/href у вставленому DOM).
    function parseHTML(html) {
        var safe = String(html || '')
            .replace(/<img([^>]*)src\s*=/gi, '<img$1data-src=')
            .replace(/<script([^>]*)src\s*=/gi, '<script$1data-src=')
            .replace(/<iframe([^>]*)src\s*=/gi, '<iframe$1data-src=')
            .replace(/<link([^>]*)href\s*=/gi, '<link$1data-href=');
        return $('<div>' + safe + '</div>');
    }

    function refreshScroll() {
        try {
            var render = activityRender(state.activity);
            var scroll = render.length ? render.find('.scroll').first() : $('.scroll').first();
            if (!scroll.length) return;
            var iScroll = scroll.data('iscroll');
            if (iScroll && iScroll.refresh) iScroll.refresh();
        } catch (e) {}
    }

    // Оновлює колекцію селекторів для коректної навігації (up/down/left/right).
    function refreshControllerCollection() {
        try {
            if (!state.active || Viewer.active || !window.Lampa || !Lampa.Controller || !Lampa.Controller.collectionSet) return;
            var render = activityRender(state.activity);
            if (!render.length) return;
            Lampa.Controller.collectionSet(render);
        } catch (e) {}
    }

    function proxyUrl(proxy, url) {
        if (proxy.indexOf('?url=') !== -1) return proxy + encodeURIComponent(url);
        return proxy + url;
    }

    // HTTP-запит через ланцюжок CORS-проксі з fallback.
    function request(url, ok, fail, index) {
        var i = index || 0;
        if (i >= PROXIES.length) {
            if (fail) fail();
            return;
        }

        $.ajax({
            url: proxyUrl(PROXIES[i], url),
            method: 'GET',
            timeout: 12000,
            success: function (res) {
                var body = res;
                if (body && typeof body === 'object') {
                    if (typeof body.contents === 'string') body = body.contents;
                    else if (typeof body.data === 'string') body = body.data;
                    else body = JSON.stringify(body);
                }

                if (typeof body !== 'string' || body.length < 100) {
                    request(url, ok, fail, i + 1);
                    return;
                }

                ok(body);
            },
            error: function () {
                request(url, ok, fail, i + 1);
            }
        });
    }

    function getMovieTitles(movie) {
        var title = (movie && (movie.title || movie.name) || '').trim();
        var original = (movie && (movie.original_title || movie.original_name) || '').trim();
        var items = [];

        if (movie && movie.imdb_id) items.push(movie.imdb_id);
        if (original) items.push(original);
        if (title && title.toLowerCase() !== original.toLowerCase()) items.push(title);

        var uniq = [];
        for (var i = 0; i < items.length; i++) {
            if (items[i] && uniq.indexOf(items[i]) === -1) uniq.push(items[i]);
        }
        return uniq;
    }

    function movieYear(movie) {
        var date = (movie && (movie.release_date || movie.first_air_date) || '').match(/^(\d{4})/);
        return date ? date[1] : '';
    }

    function toAbsoluteUrl(base, href) {
        if (!href) return '';
        if (href.indexOf('http://') === 0 || href.indexOf('https://') === 0) return href;
        if (href[0] === '/') return base + href;
        return base + '/' + href;
    }

    // Універсальний збір коментарів із HTML-сторінки.
    function extractComments(html, source, scopeSelector) {
        var doc = parseHTML(html);
        var scope = scopeSelector && doc.find(scopeSelector).length ? doc.find(scopeSelector).first() : doc;
        var selectors = '.comment, .comm-item, div[id^="comment-id-"], div[id^="comment_"], [itemprop="review"], div[id^="review_container_"]';
        var nodes = scope.find(selectors);
        var out = [];
        var seen = {};

        if (!nodes.length && scope[0] !== doc[0]) nodes = doc.find(selectors);

        nodes.each(function () {
            var node = $(this);
            if (node.parents(selectors).length > 0) return;

            var author = node.find('[itemprop="name"], .comm-author, .comment-author, .name, .user, .acc-name, a.text-reset.fw-bold, b, strong').first().text().trim();
            var text = removeAuthorDupLines(extractCommentText(node), author);
            if (!author) author = t('user');
            if (!text || text.length < 8) return;

            var sig = (author + '|' + text.substring(0, 120)).toLowerCase();
            if (seen[sig]) return;
            seen[sig] = true;

            out.push({
                source: source,
                author: author,
                text: text,
                isReview: node.is('[itemprop="review"]') || node.is('div[id^="review_container_"]')
            });
        });

        return out;
    }

    // Спеціальний парсер для KinoBaza (окремо рецензії та звичайні коментарі).
    function parseKinoBaza(html) {
        var doc = parseHTML(html);
        var out = [];
        var seen = {};

        function add(author, text, isReview) {
            var a = (author || '').trim() || (isReview ? t('critic') : t('user'));
            var textClean = removeAuthorDupLines(stripCommentJunk(text), a);
            if (!textClean || textClean.length < 8) return;
            var sig = (a + '|' + textClean.substring(0, 120)).toLowerCase();
            if (seen[sig]) return;
            seen[sig] = true;
            out.push({ source: 'KinoBaza', author: a, text: textClean, isReview: !!isReview });
        }

        doc.find('div[id^="review_container_"], [itemprop="review"]').each(function () {
            var node = $(this);
            var author = node.find('[itemprop="name"], a.text-reset.fw-bold[href*="/@"], a[href*="/user"], b, strong').first().text();
            var body = node.find('[itemprop="reviewBody"], .review-text, .content').first().clone();
            body.find('script,style,iframe,svg,path,button,a').remove();
            body.find('[datetime],[itemprop="datePublished"],time,[class*="date"],[class*="time"],[class*="meta"],[class*="reply"],[class*="quote"],[class*="action"],[class*="share"],[class*="like"],[class*="rate"],[class*="complain"]').remove();
            body.find('br').replaceWith('\n');
            body.find('p').each(function () { $(this).append('\n\n'); });
            add(author, body.text(), true);
        });

        doc.find('div[id^="comment_"]').each(function () {
            var node = $(this);
            var author = node.find('a.text-reset.fw-bold, a[href*="/@"], .name, b, strong').first().text();
            var body = node.find('.js-comment-body, .comment-text, .content').first().clone();
            body.find('script,style,iframe,svg,path,button,a').remove();
            body.find('[datetime],[itemprop="datePublished"],time,[class*="date"],[class*="time"],[class*="meta"],[class*="reply"],[class*="quote"],[class*="action"],[class*="share"],[class*="like"],[class*="rate"],[class*="complain"]').remove();
            body.find('br').replaceWith('\n');
            body.find('p').each(function () { $(this).append('\n'); });
            add(author, body.text(), false);
        });

        return out;
    }

    function extractLinks(doc, site) {
        var links = [];
        doc.find(site.resultsSelector).slice(0, 12).each(function () {
            var node = $(this);
            var link = node.find(site.linkSelector).first();
            if (!link.length && node.is('a')) link = node;

            var href = link.attr('href');
            if (!href) return;

            var absolute = toAbsoluteUrl(site.base, href);
            if (absolute && links.indexOf(absolute) === -1) links.push(absolute);
        });
        return links;
    }

    // Пошук релізу на сайті + вивантаження коментарів зі знайденої сторінки.
    function searchSite(site, movie, done) {
        var queries = getMovieTitles(movie);
        var qIndex = 0;
        var year = movieYear(movie);
        var matchTitle = (movie && (movie.title || movie.name || movie.original_title || movie.original_name)) || '';

        function nextQuery() {
            if (qIndex >= queries.length) {
                done([]);
                return;
            }

            var query = queries[qIndex++];
            if (!query || query.length < 2) {
                nextQuery();
                return;
            }

            request(site.base + site.searchPath + encodeURIComponent(query), function (html) {
                var direct = extractComments(html, site.name, site.commentsSelector);
                if (direct.length) {
                    done(direct);
                    return;
                }

                var doc = parseHTML(html);
                var links = extractLinks(doc, site);
                var i = 0;

                function nextLink() {
                    if (i >= links.length) {
                        nextQuery();
                        return;
                    }

                    var url = links[i++];
                    request(url, function (page) {
                        var titleMatch = page.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
                        var pageTitle = titleMatch ? cleanupText(titleMatch[1]) : '';
                        var yearOk = !year || pageTitle.indexOf(year) !== -1 || page.indexOf(year) !== -1;

                        if (similarTitle(matchTitle, pageTitle) && yearOk) {
                            var comments = extractComments(page, site.name, site.commentsSelector);
                            if (comments.length) {
                                done(comments);
                                return;
                            }
                        }

                        nextLink();
                    }, nextLink);
                }

                nextLink();
            }, nextQuery);
        }

        nextQuery();
    }

    function fetchUaKino(movie, done) {
        var site = {
            name: 'UaKino',
            base: 'https://uakino.best',
            searchPath: '/index.php?do=search&subaction=search&story=',
            resultsSelector: 'div.movie-item, .shortstory',
            linkSelector: 'a.movie-title, a.full-movie, .poster > a, a',
            commentsSelector: '.comments, #dle-comments-list'
        };

        if (!movie || !movie.imdb_id) {
            searchSite(site, movie, done);
            return;
        }

        request(site.base + site.searchPath + encodeURIComponent(movie.imdb_id), function (html) {
            var direct = extractComments(html, site.name, site.commentsSelector);
            if (direct.length) {
                done(direct);
                return;
            }

            var doc = parseHTML(html);
            var first = extractLinks(doc, site)[0];
            if (!first) {
                searchSite(site, movie, done);
                return;
            }

            request(first, function (page) {
                var comments = extractComments(page, site.name, site.commentsSelector);
                if (comments.length) done(comments);
                else searchSite(site, movie, done);
            }, function () {
                searchSite(site, movie, done);
            });
        }, function () {
            searchSite(site, movie, done);
        });
    }

    function fetchUAFlix(movie, done) {
        searchSite({
            name: 'UAFlix',
            base: 'https://uafix.net',
            searchPath: '/search.html?do=search&subaction=search&story=',
            resultsSelector: '.video-item, .sres-wrap, article.shortstory',
            linkSelector: 'a',
            commentsSelector: '#dle-comments-list, .comments'
        }, movie, done);
    }

    function fetchUASerials(movie, done) {
        searchSite({
            name: 'UASerials',
            base: 'https://uaserials.com',
            searchPath: '/index.php?do=search&subaction=search&story=',
            resultsSelector: '.short-item, .movie-item, .shortstory',
            linkSelector: 'a.short-title, a.movie-title, .short-img, a',
            commentsSelector: '#dle-comments-list, .comments'
        }, movie, done);
    }

    function fetchKinoBaza(movie, done) {
        var query = (movie && movie.imdb_id) || (movie && (movie.original_title || movie.title || movie.name)) || '';
        if (!query) {
            done([]);
            return;
        }

        request('https://kinobaza.com.ua/search?q=' + encodeURIComponent(query), function (html) {
            var firstPass = parseKinoBaza(html);
            if (firstPass.length) {
                done(firstPass);
                return;
            }

            var doc = parseHTML(html);
            var links = [];
            doc.find('a[href^="/titles/"], a[href*="kinobaza.com.ua/titles/"]').slice(0, 8).each(function () {
                var href = $(this).attr('href');
                var url = toAbsoluteUrl('https://kinobaza.com.ua', href);
                if (url && links.indexOf(url) === -1) links.push(url);
            });

            var i = 0;
            function nextLink() {
                if (i >= links.length) {
                    done([]);
                    return;
                }

                request(links[i++], function (page) {
                    var items = parseKinoBaza(page);
                    if (items.length) done(items);
                    else nextLink();
                }, nextLink);
            }

            nextLink();
        }, function () {
            done([]);
        });
    }

    function dedupeComments(list) {
        var out = [];
        var seen = {};
        for (var i = 0; i < list.length; i++) {
            var item = list[i];
            var sig = (item.source + '|' + item.author + '|' + item.text.substring(0, 140)).toLowerCase();
            if (seen[sig]) continue;
            seen[sig] = true;
            out.push(item);
        }
        return out;
    }

    // Паралельний збір з усіх увімкнених джерел.
    function fetchAll(movie, done) {
        var useUaKino = getBool('uacom_src_uakino', true);
        var useUAFlix = getBool('uacom_src_uaflix', true);
        var useUASerials = getBool('uacom_src_uaserials', true);
        var useKinoBaza = getBool('uacom_src_kinobaza', true);

        var jobs = [];
        if (useUaKino) jobs.push({ key: 'ua', run: fetchUaKino });
        if (useUAFlix) jobs.push({ key: 'fl', run: fetchUAFlix });
        if (useUASerials) jobs.push({ key: 'us', run: fetchUASerials });
        if (useKinoBaza) jobs.push({ key: 'kb', run: fetchKinoBaza });

        if (!jobs.length) {
            done([]);
            return;
        }

        var data = { ua: [], fl: [], us: [], kb: [] };
        var left = jobs.length;

        function finishOne(key, list) {
            data[key] = Array.isArray(list) ? list : [];
            left--;
            if (left > 0) return;

            var kbReviews = data.kb.filter(function (x) { return x.isReview; });
            var kbComments = data.kb.filter(function (x) { return !x.isReview; });
            var all = kbReviews.slice();
            var max = Math.max(data.ua.length, data.fl.length, data.us.length, kbComments.length);
            var i;

            for (i = 0; i < max; i++) {
                if (data.ua[i]) all.push(data.ua[i]);
                if (data.fl[i]) all.push(data.fl[i]);
                if (data.us[i]) all.push(data.us[i]);
                if (kbComments[i]) all.push(kbComments[i]);
            }

            done(dedupeComments(all));
        }

        jobs.forEach(function (job) {
            var doneOnce = false;
            var timer = setTimeout(function () {
                if (doneOnce) return;
                doneOnce = true;
                finishOne(job.key, []);
            }, 20000);

            job.run(movie, function (list) {
                if (doneOnce) return;
                doneOnce = true;
                clearTimeout(timer);
                finishOne(job.key, list);
            });
        });
    }

    function activityRender(activity) {
        try {
            if (activity && activity.render) {
                var render = activity.render();
                if (render && render.length) return render;
            }
        } catch (e) {}
        return $();
    }

    // Пошук контейнера кнопок у картці (стандартна тема / Applecation).
    function findButtonHost(activity) {
        var render = activityRender(activity);
        var host;

        if (render.length) {
            host = render.find('.full-start-new__buttons').first();
            if (host.length) return host;

            host = render.find('.buttons--container').first();
            if (host.length) return host;

            host = render.find('.full-start__footer, .full-start__icons').first();
            if (host.length) return host;

            return $();
        }

        if (activity) return $();

        host = $('.full-start-new__buttons').first();
        if (host.length) return host;

        host = $('.buttons--container').first();
        if (host.length) return host;

        return $('.full-start__footer, .full-start__icons').first();
    }

    function notify(text) {
        try {
            if (window.Lampa && Lampa.Noty && Lampa.Noty.show) Lampa.Noty.show(text);
        } catch (e) {}
    }

    function buttonLabel() {
        if (state.loading) return t('status_searching');
        var total = (state.comments || []).length;
        return t('button_comments') + ' (' + total + ')';
    }

    function updateButtonLabel() {
        if (!state.button || !state.button.length) return;
        state.button.find('span').text(buttonLabel());
        state.button.toggleClass('uac-button-disabled', !!state.loading);
    }

    function mountButton() {
        if (state.button && state.button.length && $.contains(document.documentElement, state.button[0])) {
            updateButtonLabel();
            return true;
        }

        var host = findButtonHost(state.activity);
        if (!host || !host.length) return false;

        state.button = $(
            '<div class="full-start__button selector button--uacomments">' +
                '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">' +
                    '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>' +
                '</svg>' +
                '<span></span>' +
            '</div>'
        );

        state.button.on('hover:enter click', function () {
            if (!state.active) return;
            if (state.loading) {
                notify(t('status_searching'));
                return;
            }
            if (!state.comments || !state.comments.length) {
                notify(t('status_not_found'));
                return;
            }
            openViewer(state.comments, 0);
        });

        var options = host.find('.button--options').first();
        if (options.length) options.before(state.button);
        else host.append(state.button);

        updateButtonLabel();
        refreshScroll();
        refreshControllerCollection();
        setTimeout(refreshControllerCollection, 50);
        return true;
    }

    function clearMountTimer() {
        if (state.mountTimer) {
            clearInterval(state.mountTimer);
            state.mountTimer = 0;
        }
    }

    function startMountRetries() {
        clearMountTimer();
        var attempts = 0;
        state.mountTimer = setInterval(function () {
            if (!state.active) {
                clearMountTimer();
                return;
            }

            attempts++;
            if (mountButton()) {
                clearMountTimer();
                return;
            }

            if (attempts > 50) clearMountTimer();
        }, 250);
    }

    function sourceLabel(source, isReview) {
        if (source === 'KinoBaza' && isReview) return t('source_kb_review');
        return source || t('source_default');
    }

    // Зберігає коментарі та оновлює кнопку у картці.
    function renderComments(list) {
        if (!state.active) return;
        state.comments = Array.isArray(list) ? list : [];
        state.loading = false;

        if (mountButton()) {
            updateButtonLabel();
            refreshControllerCollection();
            setTimeout(refreshControllerCollection, 50);
        } else {
            startMountRetries();
        }
    }

    function closeViewer() {
        if (!Viewer.active) return;
        Viewer.active = false;

        if (Viewer.hideTimer) {
            clearTimeout(Viewer.hideTimer);
            Viewer.hideTimer = 0;
        }

        if (Viewer.root) {
            Viewer.root.removeClass('show');
            var rootToRemove = Viewer.root;
            Viewer.hideTimer = setTimeout(function () {
                rootToRemove.remove();
                Viewer.hideTimer = 0;
            }, 320);
            Viewer.root = null;
        }

        try {
            if (Viewer.prevController) Lampa.Controller.toggle(Viewer.prevController);
        } catch (e) {}
    }

    function drawViewer() {
        if (!Viewer.active || !Viewer.root) return;
        var current = Viewer.list[Viewer.index] || {};
        Viewer.root.find('.uac-viewer-title').text(sourceLabel(current.source, current.isReview));
        Viewer.root.find('.uac-viewer-author').text(current.author || t('user'));
        Viewer.root.find('.uac-viewer-counter').text((Viewer.index + 1) + ' / ' + Viewer.list.length);
        Viewer.root.find('.uac-viewer-text').html(safeTextToHtml(current.text || ''));
        Viewer.root.find('.uac-viewer-left').toggleClass('active', Viewer.index > 0);
        Viewer.root.find('.uac-viewer-right').toggleClass('active', Viewer.index < Viewer.list.length - 1);
    }

    // Відкриття модального вікна з повним текстом коментаря.
    function openViewer(list, index) {
        closeViewer();

        Viewer.active = true;
        Viewer.list = list || [];
        Viewer.index = index || 0;
        Viewer.prevController = '';

        try {
            Viewer.prevController = (Lampa.Controller.enabled() || {}).name || '';
        } catch (e) {}

        Viewer.root = $(
            '<div class="uac-viewer-overlay">' +
                '<div class="uac-viewer-modal">' +
                    '<div class="uac-viewer-head">' +
                        '<div class="uac-viewer-leftside">' +
                            '<div class="uac-viewer-arrow uac-viewer-left">&#9664;</div>' +
                            '<div class="uac-viewer-meta">' +
                                '<div class="uac-viewer-title"></div>' +
                                '<div class="uac-viewer-author"></div>' +
                            '</div>' +
                        '</div>' +
                        '<div class="uac-viewer-rightside">' +
                            '<div class="uac-viewer-counter"></div>' +
                            '<div class="uac-viewer-arrow uac-viewer-right">&#9654;</div>' +
                            '<div class="uac-viewer-close selector">&#10005;</div>' +
                        '</div>' +
                    '</div>' +
                    '<div class="uac-viewer-text"></div>' +
                '</div>' +
            '</div>'
        );

        $('body').append(Viewer.root);
        setTimeout(function () {
            if (Viewer.root) Viewer.root.addClass('show');
        }, 10);

        Viewer.root.find('.uac-viewer-close').on('hover:enter click', function () {
            closeViewer();
        });
        Viewer.root.find('.uac-viewer-left').on('click', function () {
            if (Viewer.index > 0) {
                Viewer.index--;
                drawViewer();
            }
        });
        Viewer.root.find('.uac-viewer-right').on('click', function () {
            if (Viewer.index < Viewer.list.length - 1) {
                Viewer.index++;
                drawViewer();
            }
        });

        try {
            Lampa.Controller.add('uac_viewer', {
                toggle: function () {
                    Lampa.Controller.collectionSet(Viewer.root);
                    Lampa.Controller.collectionFocus(Viewer.root.find('.uac-viewer-close')[0], Viewer.root);
                },
                up: function () {
                    var box = Viewer.root.find('.uac-viewer-text');
                    box.scrollTop(box.scrollTop() - 180);
                },
                down: function () {
                    var box = Viewer.root.find('.uac-viewer-text');
                    box.scrollTop(box.scrollTop() + 180);
                },
                left: function () {
                    if (Viewer.index > 0) {
                        Viewer.index--;
                        drawViewer();
                    }
                },
                right: function () {
                    if (Viewer.index < Viewer.list.length - 1) {
                        Viewer.index++;
                        drawViewer();
                    }
                },
                back: function () {
                    closeViewer();
                }
            });
            Lampa.Controller.toggle('uac_viewer');
        } catch (e) {}

        drawViewer();
    }

    function stop() {
        state.active = false;
        state.activity = null;
        state.loading = false;
        state.comments = [];
        clearMountTimer();
        closeViewer();

        if (state.button) {
            state.button.remove();
            state.button = null;
        }
    }

    function start(movie, activity) {
        stop();

        state.active = true;
        state.activity = activity || null;
        state.loading = true;
        state.comments = [];
        state.requestId++;
        var reqId = state.requestId;

        startMountRetries();

        fetchAll(movie || {}, function (comments) {
            if (!state.active || reqId !== state.requestId) return;
            renderComments(comments || []);
        });
    }

    // Стилі плагіна: кнопка в картці + Apple-подібне модальне вікно.
    function addStyles() {
        var style = document.createElement('style');
        style.textContent =
            '.button--uacomments svg{width:1.25em;height:1.25em}' +
            '.button--uacomments.uac-button-disabled{opacity:.6}' +

            '@keyframes appleAppear{0%{opacity:0;transform:translateY(60px) scale(.96);filter:blur(10px)}100%{opacity:1;transform:translateY(0) scale(1);filter:blur(0)}}' +
            '.uac-viewer-overlay{position:fixed;inset:0;background:transparent;z-index:10000;display:flex;align-items:center;justify-content:center;padding:20px;backdrop-filter:blur(100px);-webkit-backdrop-filter:blur(100px);opacity:0;visibility:hidden;pointer-events:none;transition:opacity .3s ease,visibility .3s ease}' +
            '.uac-viewer-overlay.show{opacity:1;visibility:visible;pointer-events:all}' +
            '.uac-viewer-modal{width:var(--uac-viewer-width,720px);max-width:96vw;height:86vh;max-height:920px;background:rgba(22,30,38,.18);backdrop-filter:blur(24px) saturate(145%);-webkit-backdrop-filter:blur(24px) saturate(145%);border:.5px solid rgba(255,255,255,.10);border-radius:38px;box-shadow:0 14px 36px rgba(0,0,0,.24);display:flex;flex-direction:column;overflow:hidden;animation:appleAppear .9s cubic-bezier(.22,1,.36,1) backwards;will-change:transform,opacity}' +
            '.uac-viewer-head{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:16px 20px;background:linear-gradient(180deg,rgba(255,255,255,.035),rgba(255,255,255,.008));border-bottom:1px solid rgba(255,255,255,.06)}' +
            '.uac-viewer-leftside{display:flex;align-items:center;gap:12px;min-width:0;flex:1}' +
            '.uac-viewer-rightside{display:flex;align-items:center;gap:10px;flex-shrink:0}' +
            '.uac-viewer-arrow{width:42px;height:42px;border-radius:14px;display:flex;align-items:center;justify-content:center;background:rgba(255,255,255,.08);color:#8c8f9a;cursor:pointer;user-select:none;transition:all .25s cubic-bezier(.4,0,.2,1);border:1px solid rgba(255,255,255,.1)}' +
            '.uac-viewer-arrow.active{color:#fff;border-color:rgba(255,255,255,.22);background:rgba(255,255,255,.12)}' +
            '.uac-viewer-arrow.active:hover{transform:scale(1.04)}' +
            '.uac-viewer-meta{min-width:0;overflow:hidden;flex:1}' +
            '.uac-viewer-title{font-size:.84em;color:#d8deef;opacity:.92}' +
            '.uac-viewer-author{font-size:1.1em;font-weight:700;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}' +
            '.uac-viewer-counter{font-weight:700;color:#dbe0eb;opacity:.75;min-width:6ch;text-align:right}' +
            '.uac-viewer-close{width:42px;height:42px;border-radius:14px;display:flex;align-items:center;justify-content:center;background:rgba(255,255,255,.10);color:#fff;cursor:pointer;transition:all .3s cubic-bezier(.4,0,.2,1);border:1px solid rgba(255,255,255,.14)}' +
            '.uac-viewer-close:hover{background:rgba(255,255,255,.2);transform:scale(1.02)}' +
            '.uac-viewer-close.focus,.uac-viewer-close:active{transform:scale(.97);background:rgba(255,255,255,.26)}' +
            '.uac-viewer-text{padding:28px 24px;overflow-y:auto;font-size:var(--uac-viewer-font,1.25em);line-height:1.62;color:rgba(255,255,255,.95);white-space:normal}' +
            '.uac-viewer-text::-webkit-scrollbar{width:.5em}' +
            '.uac-viewer-text::-webkit-scrollbar-track{background:rgba(255,255,255,.1);border-radius:1em}' +
            '.uac-viewer-text::-webkit-scrollbar-thumb{background:rgba(255,255,255,.3);border-radius:1em}' +
            '.uac-viewer-text::-webkit-scrollbar-thumb:hover{background:rgba(255,255,255,.5)}' +
            '@media (max-width:900px){.uac-viewer-overlay{padding:10px}.uac-viewer-modal{height:90vh;border-radius:26px}}';
        document.head.appendChild(style);
    }

    // Додавання налаштувань у меню Lampa.
    function addSettings() {
        if (!Lampa.SettingsApi) return;

        var component = 'uacomments_settings';
        Lampa.SettingsApi.addComponent({
            component: component,
            name: t('plugin_name'),
            icon: '<svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>'
        });

        function addTrigger(name, label, description, def) {
            Lampa.SettingsApi.addParam({
                component: component,
                param: { name: name, type: 'trigger', default: def },
                field: { name: label, description: description }
            });
        }

        function addTitle(name, label) {
            Lampa.SettingsApi.addParam({
                component: component,
                param: { name: name, type: 'title' },
                field: { name: label }
            });
        }

        function addSelect(name, label, values, def) {
            Lampa.SettingsApi.addParam({
                component: component,
                param: { name: name, type: 'select', values: values, default: def },
                field: { name: label, description: '' },
                onChange: function (value) {
                    Lampa.Storage.set(name, value);
                    updateCssVars();
                }
            });
        }

        // Інформаційний блок про плагін.
        Lampa.SettingsApi.addParam({
            component: component,
            param: {
                name: 'uac_about',
                type: 'static'
            },
            field: {
                name: '<div>UA Comments v' + UACOMMENTS_VERSION + ' • BazarNet | LampaUa</div>'
            },
            onRender: function (item) {
                item.css('opacity', '0.7');
                item.find('.settings-param__name').css({
                    'font-size': '1.2em',
                    'margin-bottom': '0.3em'
                });
                item.append('<div style="font-size: 0.9em; padding: 0 1.2em; line-height: 1.4;"><br>' + t('about_description') + '</div>');
            }
        });

        addTitle('uac_title_sources', t('settings_sources'));

        addTrigger('uacom_src_uakino', t('use_uakino'), t('use_uakino_desc'), true);
        addTrigger('uacom_src_uaflix', t('use_uaflix'), t('use_uaflix_desc'), true);
        addTrigger('uacom_src_uaserials', t('use_uaserials'), t('use_uaserials_desc'), true);
        addTrigger('uacom_src_kinobaza', t('use_kinobaza'), t('use_kinobaza_desc'), true);

        addTitle('uac_title_viewer', t('settings_viewer_style'));

        addSelect('uac_viewer_width', t('viewer_width'), {
            '720px': t('compact'),
            '900px': t('size_medium'),
            '1200px': t('size_large'),
            '95vw': t('size_full')
        }, '720px');

        addSelect('uac_viewer_font', t('viewer_font'), {
            '1.05em': t('size_small'),
            '1.25em': t('size_medium'),
            '1.5em': t('size_large')
        }, '1.25em');
    }

    // Головна ініціалізація плагіна.
    function init() {
        addStyles();
        updateCssVars();
        addSettings();

        Lampa.Listener.follow('full', function (event) {
            // У Lampa подія завершення картки історично називається саме "complite".
            if (event.type === 'complite') {
                start(event.data && event.data.movie, event.object && event.object.activity);
            } else if (event.type === 'destroy' || event.type === 'start') {
                stop();
            }
        });
    }

    if (window.appready) init();
    else {
        Lampa.Listener.follow('app', function (event) {
            if (event.type === 'ready') init();
        });
    }
})();
