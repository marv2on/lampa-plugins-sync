(function() {
    'use strict';

    function safeText(str) {
        return (str || '').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>');
    }

    function parseHTML(html) {
        try {
            if (typeof html !== 'string' || !html) return $();
            var parser = new DOMParser();
            var doc = parser.parseFromString(html, "text/html");
            return $(doc.body);
        } catch (e) {
            console.error('UaComentsY: Критична помилка в parseHTML:', e);
            return $();
        }
    }

    function getTriggerSafe(key, defaultVal) {
        if (!window.Lampa || !window.Lampa.Storage) return defaultVal;
        var val = window.Lampa.Storage.get(key);
        if (val === undefined || val === null) return defaultVal;
        if (val === 'false' || val === false) return false;
        return true;
    }

    function updateCSSVars() {
        try {
            var root = document.documentElement;
            if (!window.Lampa || !window.Lampa.Storage) return;
            root.style.setProperty('--uacom-width', window.Lampa.Storage.get('uacom_width', '40ch') || '40ch');
            root.style.setProperty('--uacom-lines', window.Lampa.Storage.get('uacom_lines', '3') || '3');
            root.style.setProperty('--uacom-fsize', window.Lampa.Storage.get('uacom_fontsize', '1.15em') || '1.15em');
            root.style.setProperty('--uacom-noty-width', window.Lampa.Storage.get('uacom_noty_width', '800px') || '800px');
            root.style.setProperty('--uacom-noty-fsize', window.Lampa.Storage.get('uacom_noty_fsize', '1.3em') || '1.3em');
        } catch(e) {}
    }

    function createSettings() {
        if (!window.Lampa || !window.Lampa.SettingsApi) return;
        var COMP_NAME = 'uacomentsy';

        window.Lampa.SettingsApi.addComponent({
            component: COMP_NAME,
            name: 'UaKomentsY',
            icon: '<svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>'
        });

        function addStatic(comp, name, title, desc, onClick) {
            window.Lampa.SettingsApi.addParam({
                component: comp, param: { name: name, type: "static" },
                field: { name: title, description: desc },
                onRender: function (item) { item.on("hover:enter click", onClick); }
            });
        }

        function addToggle(comp, name, title, desc, def) {
            window.Lampa.SettingsApi.addParam({ component: comp, param: { name: name, type: "trigger", default: def }, field: { name: title, description: desc } });
        }

        function addSelect(comp, name, title, desc, values, def) {
            window.Lampa.SettingsApi.addParam({
                component: comp, param: { name: name, type: "select", values: values, default: def },
                field: { name: title, description: desc },
                onChange: function(val) { window.Lampa.Storage.set(name, val); updateCSSVars(); }
            });
        }

        addStatic(COMP_NAME, 'uacom_support', 'Підтримати', 'Натисніть, щоб відкрити сторінку https://lampalampa.free.nf/', function() {
            if (window.Lampa.Noty) window.Lampa.Noty.show('Перейдіть за адресою: https://lampalampa.free.nf/');
            setTimeout(function() { if (window.open) window.open('https://lampalampa.free.nf/', '_blank'); }, 500);
        });

        window.Lampa.SettingsApi.addParam({ component: COMP_NAME, param: { name: 'uacom_title_src', type: 'title' }, field: { name: 'Джерела коментарів' } });
        addToggle(COMP_NAME, 'uacom_src_uakino', 'Джерело: UaKino', 'Шукати коментарі на UaKino', true);
        addToggle(COMP_NAME, 'uacom_src_uaflix', 'Джерело: UAFlix', 'Шукати коментарі на UAFlix', true);
        addToggle(COMP_NAME, 'uacom_src_uaserials', 'Джерело: UASerials', 'Шукати коментарі на UASerials', true);
        addToggle(COMP_NAME, 'uacom_src_kinobaza', 'Джерело: KinoBaza', 'Шукати коментарі на KinoBaza', true);

        window.Lampa.SettingsApi.addParam({ component: COMP_NAME, param: { name: 'uacom_title_ui', type: 'title' }, field: { name: 'Зовнішній вигляд (Картки)' } });
        addSelect(COMP_NAME, 'uacom_width', 'Ширина картки', 'Налаштування ширини блоку', { '30ch': 'Вузька', '40ch': 'Середня', '60ch': 'Широка', '80vw': 'На весь екран' }, '40ch');
        addSelect(COMP_NAME, 'uacom_lines', 'Висота тексту (рядки)', 'Максимальна кількість рядків', { '2': '2 рядки', '3': '3 рядки', '4': '4 рядки', '5': '5 рядків', '10': '10 рядків' }, '3');
        addSelect(COMP_NAME, 'uacom_fontsize', 'Розмір шрифту', '', { '0.9em': 'Дрібний', '1.15em': 'Середній', '1.3em': 'Великий', '1.5em': 'Дуже великий' }, '1.15em');

        window.Lampa.SettingsApi.addParam({ component: COMP_NAME, param: { name: 'uacom_title_notify', type: 'title' }, field: { name: 'Відкритий коментар' } });
        addSelect(COMP_NAME, 'uacom_noty_width', 'Ширина вікна', '', { '600px': 'Компактне', '800px': 'Середнє', '1200px': 'Широке', '95vw': 'На весь екран' }, '800px');
        addSelect(COMP_NAME, 'uacom_noty_fsize', 'Розмір шрифту', '', { '1.1em': 'Дрібний', '1.3em': 'Середній', '1.6em': 'Великий', '2.0em': 'Дуже великий' }, '1.3em');
    }

    var UaCommentViewer = {
        active: false,
        element: null,
        comments:[],
        currentIndex: 0,
        focusedCardElement: null,
        keydownHandler: null,
        isClosing: false,
        previousController: null,

        show: function(commentsList, startIndex, focusedCardElement) {
            if (this.active) this.close();
            this.active = true;
            this.isClosing = false;
            this.comments = commentsList;
            this.currentIndex = startIndex;
            this.focusedCardElement = focusedCardElement;

            var html = '<div class="uacom-overlay">' +
                            '<div class="uacom-modal">' +
                                '<div class="uacom-body"></div>' +
                                '<div class="uacom-head">' + 
                                    '<div class="uacom-leftside">' +
                                        '<div class="uacom-arrow arrow-left">&#9664;</div>' +
                                        '<div class="uacom-meta">' +
                                            '<div class="uacom-title"></div>' +
                                            '<div class="uacom-author"></div>' +
                                        '</div>' +
                                    '</div>' +
                                    '<div class="uacom-rightside">' +
                                        '<div class="uacom-counter"></div>' +
                                        '<div class="uacom-arrow arrow-right">&#9654;</div>' +
                                        '<div class="uacom-close selector">&#10005;</div>' +
                                    '</div>' +
                                '</div>' +
                            '</div>' +
                        '</div>';

            this.element = $(html);
            $('body').append(this.element);

            var _this = this;
            this.element.find('.uacom-close').on('hover:enter click', function(e) { 
                e.preventDefault(); e.stopPropagation(); 
                _this.close(); 
            });
            this.element.find('.arrow-left').on('click', function() { _this.goLeft(); });
            this.element.find('.arrow-right').on('click', function() { _this.goRight(); });
            this.element.find('.uacom-body').on('touchmove', function(e) { e.stopPropagation(); });
            
            this.element.on('click', function(e) {
                if (e.target === this) {
                    e.preventDefault(); e.stopPropagation();
                    _this.close();
                }
            });

            this.updateUI();

            // Lampa-нативний підхід: реєструємо контролер вікна, щоб Lampa сама перехоплювала кнопки
            if (window.Lampa && window.Lampa.Controller) {
                var enabledC = window.Lampa.Controller.enabled();
                this.previousController = enabledC ? enabledC.name : 'full';

                window.Lampa.Controller.add('uacom_viewer', {
                    toggle: function() {
                        window.Lampa.Controller.collectionSet(_this.element[0]);
                        window.Lampa.Controller.collectionFocus(_this.element.find('.uacom-close')[0], _this.element[0]);
                    },
                    left: function() { _this.goLeft(); },
                    right: function() { _this.goRight(); },
                    up: function() {
                        var body = _this.element.find('.uacom-body');
                        if (body.length) body[0].scrollTop -= 180;
                    },
                    down: function() {
                        var body = _this.element.find('.uacom-body');
                        if (body.length) body[0].scrollTop += 180;
                    },
                    enter: function() {
                        var focused = _this.element.find('.focus');
                        if (focused.length) {
                            focused.trigger('hover:enter').trigger('click');
                        } else {
                            _this.close();
                        }
                    },
                    back: function() {
                        _this.close(); // Надійно перехоплює подію "назад" у Tizen/WebOS
                    }
                });
                window.Lampa.Controller.toggle('uacom_viewer');
            } else {
                // Відкат для середовищ без Lampa.Controller
                setTimeout(function() {
                    var closeBtn = _this.element.find('.uacom-close')[0];
                    if (closeBtn) closeBtn.focus();
                }, 20);

                this.keydownHandler = this.keydownHandler || this.handleKeydown.bind(this);
                window.addEventListener('keydown', this.keydownHandler, true);
            }
        },

        handleKeydown: function(e) {
            var code = e.keyCode;
            if (code === 37) { 
                e.preventDefault(); e.stopPropagation(); 
                this.goLeft(); 
            } else if (code === 39) { 
                e.preventDefault(); e.stopPropagation(); 
                this.goRight(); 
            } else if (code === 38) { 
                e.preventDefault(); e.stopPropagation(); 
                var body = this.element.find('.uacom-body');
                if (body.length) body[0].scrollTop -= 180;
            } else if (code === 40) { 
                e.preventDefault(); e.stopPropagation(); 
                var body = this.element.find('.uacom-body');
                if (body.length) body[0].scrollTop += 180;
            } else if (code === 13 || code === 8 || code === 27 || code === 10009 || code === 461) { 
                e.preventDefault(); e.stopPropagation(); 
                this.close(); 
            }
        },

        updateUI: function() {
            if (!this.element) return;
            var data = this.comments[this.currentIndex];
            var sourceIcon = '';
            
            if (data.source === 'UaKino') sourceIcon = '<img src="https://yarikrazor-star.github.io/lmp/uak.png" class="ua-source-icon" style="width:16px; height:16px; border-radius:3px; margin-right:6px;">';
            else if (data.source === 'UAFlix') sourceIcon = '<img src="https://yarikrazor-star.github.io/lmp/uaf.png" class="ua-source-icon" style="width:16px; height:16px; border-radius:3px; margin-right:6px;">';
            else if (data.source === 'UASerials') sourceIcon = '<img src="https://upload.wikimedia.org/wikipedia/commons/d/d4/Clapperboard_-_The_Noun_Project.svg" class="ua-source-icon" style="filter: brightness(0) invert(1); width:16px; height:16px; border-radius:3px; margin-right:6px;">';
            else if (data.source === 'KinoBaza') sourceIcon = '<img src="https://kinobaza.com.ua/assets/img/kinobazav4.svg" class="ua-source-icon" style="width:16px; height:16px; border-radius:3px; margin-right:6px;">';

            var titleStr = sourceIcon + (data.source === 'KinoBaza' && data.isReview ? 'Рецензія' : data.source);

            this.element.find('.uacom-title').html(titleStr);
            this.element.find('.uacom-author').text(data.author);
            this.element.find('.uacom-counter').text((this.currentIndex + 1) + ' / ' + this.comments.length);
            
            var body = this.element.find('.uacom-body');
            body.html(safeText(data.text));
            // Додатковий захист від можливих посилань (щоб уникнути 404 помилки)
            body.find('a').removeAttr('href target');
            body[0].scrollTop = 0;

            this.element.find('.arrow-left').toggleClass('active', this.currentIndex > 0);
            this.element.find('.arrow-right').toggleClass('active', this.currentIndex < this.comments.length - 1);
        },

        goLeft: function() {
            if (this.currentIndex > 0) {
                this.currentIndex--;
                this.updateUI();
            }
        },

        goRight: function() {
            if (this.currentIndex < this.comments.length - 1) {
                this.currentIndex++;
                this.updateUI();
            }
        },

        close: function() {
            if (!this.active || this.isClosing) return;
            this.isClosing = true;
            this.active = false;
            
            if (window.Lampa && window.Lampa.Controller) {
                // Повертаємо керування базовому вікну при закритті
                window.Lampa.Controller.toggle(this.previousController || 'full');
            } else {
                window.removeEventListener('keydown', this.keydownHandler, true);
            }

            if (this.element) {
                this.element.remove();
                this.element = null;
            }
            
            var finalIndex = this.currentIndex;
            var initialCard = this.focusedCardElement;

            setTimeout(function() {
                var targetCard = $('.ua-comment-card[data-idx="' + finalIndex + '"]');
                var target = targetCard.length ? targetCard[0] : initialCard;
                
                if (target && window.Lampa && window.Lampa.Controller) {
                    var slider = $(target).closest('.ua-comments-slider');
                    if (slider.length) {
                        Lampa.Controller.collectionSet(slider[0]);
                        Lampa.Controller.collectionFocus(target, slider[0]);
                    } else {
                        Lampa.Controller.focus(target);
                    }
                }
            }, 400);
        }
    };

    var proxies =[
        'https://cors.lampa.stream/',
        'https://cors.eu.org/',
        'https://corsproxy.io/?url='
    ];

    var network = {
        req: function(url, onSuccess, onError, proxyIdx) {
            var pIdx = proxyIdx || 0;
            if (pIdx >= proxies.length) { if (onError) onError(); return; }
            $.ajax({
                url: proxies[pIdx] + encodeURIComponent(url),
                method: 'GET',
                dataType: 'text',
                timeout: 8000,
                success: function(res) {
                    try {
                        if (typeof res === 'string' && res.length < 200) network.req(url, onSuccess, onError, pIdx + 1);
                        else onSuccess(res);
                    } catch(e) {
                        console.error('UaComentsY Network Success Error:', e);
                        if (onError) onError();
                    }
                },
                error: function() { network.req(url, onSuccess, onError, pIdx + 1); }
            });
        }
    };

    var parser = {
        parse: function(html, source, primarySelector) {
            var list =[];
            try {
                var doc = parseHTML(html);
                if (!doc || !doc.length) return[]; 
                
                var commentsBlock = doc;
                if (primarySelector) {
                    var foundBlock = doc.find(primarySelector);
                    if (foundBlock.length > 0) commentsBlock = foundBlock;
                }

                var items = commentsBlock.find('.comment, div[id^="comment-id-"], .comm-item');
                if (!items.length && commentsBlock !== doc) {
                    items = doc.find('.comment, div[id^="comment-id-"], .comm-item');
                }

                var signs =[];
                items.each(function() {
                    try {
                        var el = $(this);
                        if (el.parents('.comment, div[id^="comment-id-"], .comm-item').length > 0) return;
                        
                        var author = el.find('.comm-author, .name, .comment-author, .acc-name, b').first().text().trim();
                        var textEl = el.find('.comm-text, .comment-content, .text, .comment-body, div[id^="comm-id-"]').clone();
                        
                        textEl.find('div, script, style, iframe, .comm-good-bad').remove(); 
                        textEl.find('br').replaceWith('\n'); 
                        
                        var text = textEl.text().trim();
                        text = text.replace(/(?:\s*(?:читати далі|показати повністю|читать далее|показать повністю|read more|…|\.\.\.|\.\.))\s*$/ig, '');
                        
                        if (author && text) {
                            var sign = author + '|' + text.substring(0, 50);
                            if (signs.indexOf(sign) === -1) {
                                signs.push(sign);
                                list.push({ author: author, source: source, text: text });
                            }
                        }
                    } catch(e) {}
                });
            } catch(e) {
                console.error('UaComentsY Parser Error:', e);
            }
            return list;
        }
    };

    var finder = {
        areTitlesSimilar: function(searchTitle, pageTitle) {
            try {
                var clean = function(str) {
                    return str.toLowerCase()
                        .replace(/\(.*\)|\[.*\]/g, '')
                        .replace(/фільм|мультфільм|серіал|сезон|серія|дивитись|онлайн|всі серії|скачати|торрент|hd|якість|безкоштовно/g, '')
                        .replace(/[^a-z0-9а-яіїєґ\s]/g, '')
                        .replace(/\s+/g, ' ').trim();
                };

                var cleanSearch = clean(searchTitle);
                var cleanPage = clean(pageTitle);

                if (!cleanSearch) return true;
                if (!cleanPage) return false;

                if (cleanPage.indexOf(cleanSearch) !== -1 || cleanSearch.indexOf(cleanPage) !== -1) return true;

                var getWords = function(str) {
                    var parts = str.split(' ');
                    var res =[];
                    for (var i = 0; i < parts.length; i++) {
                        if (parts[i] && res.indexOf(parts[i]) === -1) res.push(parts[i]);
                    }
                    return res;
                };

                var searchWords = getWords(cleanSearch);
                var pageWords = getWords(cleanPage);

                if (searchWords.length === 0) return true;

                var intersection = 0;
                for (var j = 0; j < searchWords.length; j++) {
                    if (pageWords.indexOf(searchWords[j]) !== -1) intersection++;
                }

                if (intersection === 0) return false;

                if ((intersection / pageWords.length) >= 0.9) return true;
                if ((intersection / searchWords.length) >= 0.7) return true;

                return false;
            } catch(e) { return false; }
        },
        
        search: function(site, movie, callback) {
            try {
                var tUa = movie.title || movie.name || '';
                var tEn = movie.original_title || movie.original_name || '';
                var yearStr = movie.release_date || movie.first_air_date || '';
                var yearMatch = yearStr.match(/^(\d{4})/);
                var year = yearMatch ? parseInt(yearMatch[1]) : 0;
                var isTv = movie.type === 'tv' || typeof movie.first_air_date !== 'undefined' || (movie.name && !movie.title);
                
                var queries =[];
                if (tEn) queries.push(tEn);
                if (tUa && tUa.toLowerCase() !== tEn.toLowerCase()) queries.push(tUa);

                var titleToMatch = tUa ? tUa : tEn;
                var qIdx = 0;
                
                var runQuery = function() {
                    if (qIdx >= queries.length) return callback([]);
                    var q = queries[qIdx++];
                    if (!q || q.trim().length < 2) return runQuery();
                    
                    var searchUrl = site.base + site.search + encodeURIComponent(q);
                    network.req(searchUrl, function(html) {
                        try {
                            var doc = parseHTML(html);
                            var links =[];
                            
                            doc.find(site.selector).slice(0, 10).each(function() {
                                var it = $(this);
                                var lnk = it.find(site.linkSelector).first();
                                if (!lnk.length && it.is('a')) lnk = it;
                                var href = lnk.attr('href');
                                if (href && links.indexOf(href) === -1) {
                                    if (href.indexOf('http') !== 0) href = site.base + (href.indexOf('/') === 0 ? '' : '/') + href;
                                    links.push(href);
                                }
                            });

                            if (links.length === 0) return runQuery();

                            var lIdx = 0;
                            var checkLink = function() {
                                if (lIdx >= links.length) return runQuery();
                                var targetUrl = links[lIdx++];

                                network.req(targetUrl, function(page) {
                                    try {
                                        var headMatch = page.match(/<head[^>]*>([\s\S]*?)<\/head>/i);
                                        var pageTitle = '';
                                        if (headMatch && headMatch[1]) {
                                            var tMatch = headMatch[1].match(/<title[^>]*>([\s\S]*?)<\/title>/i);
                                            if (tMatch && tMatch[1]) pageTitle = tMatch[1];
                                        } else {
                                            var tMatch2 = page.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
                                            if (tMatch2 && tMatch2[1]) pageTitle = tMatch2[1];
                                        }
                                        
                                        if (!finder.areTitlesSimilar(titleToMatch, pageTitle)) return checkLink();

                                        var titleLower = pageTitle.toLowerCase();
                                        var isYearValid = false;
                                        if (year) {
                                            var titleYears = pageTitle.match(/\b(19\d{2}|20\d{2})\b/g);
                                            if (titleYears && titleYears.length > 0) {
                                                if (titleYears.indexOf(year.toString()) !== -1) isYearValid = true;
                                            } else {
                                                var strictYearRegex = new RegExp('(?:рік|год|year|випуск)[\\s\\S]{0,50}?\\b' + year + '\\b|<a[^>]+href="[^"]*(?:\\/year\\/|\\/god\\/|year=)[^"]*"[^>]*>\\s*' + year + '\\s*<\\/a>', 'i');
                                                if (strictYearRegex.test(page)) isYearValid = true;
                                            }
                                        } else { 
                                            isYearValid = true; 
                                        }

                                        if (!isYearValid) return checkLink();

                                        var isTypeValid = false;
                                        var tvPattern = /(серіал|сезон|серія|серії|дорама|епізод)/i;
                                        if (isTv) {
                                            if (tvPattern.test(titleLower)) isTypeValid = true;
                                        } else {
                                            if (!tvPattern.test(titleLower)) isTypeValid = true;
                                        }

                                        if (isTypeValid) {
                                            var comments = parser.parse(page, site.name, site.commentsSelector);
                                            return callback(comments);
                                        } else {
                                            return checkLink(); 
                                        }
                                    } catch (e) { checkLink(); }
                                }, function() { checkLink(); });
                            };
                            checkLink();
                        } catch(e) { runQuery(); }
                    }, function() { runQuery(); });
                };
                runQuery();
            } catch(e) { callback([]); }
        }
    };

    function UaCommentItem(data, allComments, index) {
        this.data = data;
        this.allComments = allComments;
        this.index = index;
        this.html = null;
    }

    UaCommentItem.prototype.create = function() {
        try {
            var _this = this;
            var root = $('<div class="ua-comment-card selector" data-idx="' + this.index + '"></div>');
            var topMeta = $('<div class="ua-comment-meta"></div>');
            var textNode = $('<div class="ua-comment-text"></div>');
            var bottomMeta = $('<div class="ua-comment-footer"></div>');

            var sourceIcon = '';
            var reviewBadge = '';
            if (this.data.source === 'UaKino') {
                sourceIcon = '<img src="https://yarikrazor-star.github.io/lmp/uak.png" class="ua-source-icon">';
            } else if (this.data.source === 'UAFlix') {
                sourceIcon = '<img src="https://yarikrazor-star.github.io/lmp/uaf.png" class="ua-source-icon">';
            } else if (this.data.source === 'UASerials') {
                sourceIcon = '<img src="https://upload.wikimedia.org/wikipedia/commons/d/d4/Clapperboard_-_The_Noun_Project.svg" class="ua-source-icon" style="filter: brightness(0) invert(1);">';
            } else if (this.data.source === 'KinoBaza') {
                sourceIcon = '<img src="https://kinobaza.com.ua/assets/img/kinobazav4.svg" class="ua-source-icon">';
                if (this.data.isReview) {
                    reviewBadge = '<span style="background: rgba(255, 193, 7, 0.2); color: #ffc107; padding: 2px 8px; border-radius: 4px; font-size: 0.8em; margin-left: 8px; border: 1px solid rgba(255, 193, 7, 0.5); white-space: nowrap; flex-shrink: 0;">Рецензія</span>';
                }
            }

            topMeta.append('<div class="ua-chip author">' + sourceIcon + '<span class="author-name">' + this.data.author + '</span>' + reviewBadge + '</div>');
            textNode.html(safeText(this.data.text));
            bottomMeta.append('<div class="ua-chip read-more" style="display: none;">Читати повністю</div>');

            root.append(topMeta).append(textNode).append(bottomMeta);

            root.on('hover:focus', function() {
                var slider = root.closest('.ua-comments-slider');
                if (!slider.length) return;
                var targetLeft = root[0].offsetLeft - 15;
                slider.stop(true, true).animate({ scrollLeft: targetLeft }, 200);
            });

            root.on('hover:enter click', function(e) {
                // Блокування подвійних натисків, щоб не викликати 404
                e.preventDefault(); e.stopPropagation();
                
                var slider = root.closest('.ua-comments-slider');
                if (slider.length && slider.data('isDragging')) return;
                if (UaCommentViewer.active) return;
                
                UaCommentViewer.show(_this.allComments, _this.index, root[0]);
            });

            this.html = root;
        } catch(e) { 
            console.error('UaComentsY Item Error:', e);
            this.html = $('<div></div>');
        }
        return this;
    };

    function InlineComments() {
        var fetchedComments =[];
        var observer = null;
        var currentStatus = '';
        var isSearchFinished = false;

        this.init = function() {
            var _this = this;
            var style = document.createElement('style');
            
            style.innerHTML = 
                ".ua-comments-root { width: 100%; max-width: 100vw; position: relative; margin-bottom: 5px; padding: 0px; z-index: 5; }\n" +
                ".ua-comments-slider { display: flex; flex-wrap: nowrap; overflow-x: auto; overflow-y: hidden; padding: 15px 15px 0px 15px; width: 100%; box-sizing: border-box; align-items: stretch; position: relative; scrollbar-width: none; -ms-overflow-style: none; -webkit-overflow-scrolling: touch; }\n" +
                ".ua-comments-slider::-webkit-scrollbar { display: none; }\n" +
                ".ua-comments-slider::after { content: ''; flex: 0 0 85vw; display: block; }\n" +
                
                ".ua-status-card { width: 98%; background: rgba(0,0,0,0.5); border-radius: 14px; padding: 15px; box-sizing: border-box; text-align: center; color: #fff; font-size: 1.2em; margin: 0 auto; transition: background 0.3s ease; }\n" +
                ".ua-status-card.focus { border-color: #fff; box-shadow: 0 0 15px rgba(255,255,255,0.4); }\n" +
                
                ".ua-comment-card { flex: 0 0 var(--uacom-width, 40ch); width: var(--uacom-width, 40ch); max-width: 80vw; border-radius: 16px; border: 1px solid rgba(255, 255, 255, 0.1); background: #1a222c; padding: 18px; box-sizing: border-box; display: flex; flex-direction: column; transition: transform 0.25s ease, border-color 0.25s ease, box-shadow 0.25s ease, background 0.25s ease; flex-shrink: 0; cursor: pointer; margin-right: 20px; }\n" +
                ".ua-comment-card.focus { border-color: rgba(255,255,255,0.4); transform: translateY(-4px); box-shadow: 0 12px 30px rgba(0,0,0,0.6); background: #26323f; color: #fff; }\n" +
                ".ua-comment-card.focus .ua-comment-text { color: #fff; }\n" +
                ".ua-comment-card.focus .ua-chip.read-more { background: rgba(255,255,255,0.9); color: #000; font-weight: bold; }\n" +
                
                ".ua-comment-meta { display: flex; justify-content: flex-start; align-items: center; margin-bottom: 15px; flex-wrap: nowrap; width: 100%; overflow: hidden; }\n" +
                ".ua-comment-meta > * { margin-right: 10px; }\n" +
                ".ua-comment-meta > *:last-child { margin-right: 0; }\n" +
                
                ".ua-chip { background: rgba(0,0,0,0.3); padding: 5px 12px; border-radius: 8px; font-size: 0.85em; color: #ccc; display: flex; align-items: center; flex-shrink: 0; max-width: 100%; box-sizing: border-box; }\n" +
                ".ua-chip.author { color: #fff; font-weight: bold; background: rgba(255,255,255,0.08); flex-shrink: 1; min-width: 0; }\n" +
                ".ua-source-icon { width: 16px; height: 16px; border-radius: 3px; flex-shrink: 0; margin-right: 8px; }\n" +
                ".author-name { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; display: block; flex-shrink: 1; min-width: 0; }\n" +
                
                ".ua-comment-text { font-size: var(--uacom-fsize, 1.15em); line-height: 1.5; color: #ddd; display: -webkit-box; -webkit-line-clamp: var(--uacom-lines, 3); -webkit-box-orient: vertical; overflow: hidden; margin-bottom: auto; padding-bottom: 2px; }\n" +
                ".ua-comment-footer { margin-top: 10px; display: flex; justify-content: flex-end; min-height: 24px; }\n" +
                ".ua-chip.read-more { background: rgba(255,255,255,0.1); font-size: 0.8em; align-items: center; transition: all 0.2s; }\n" +
                
                "@keyframes uacomAppear{0%{opacity:0;transform:translateY(30px)}100%{opacity:1;transform:translateY(0)}}\n" +
                
                ".uacom-overlay { position:fixed; top:0; left:0; right:0; bottom:0; width:100%; height:100%; background:rgba(0,0,0,0.85); z-index:100000; display:flex; align-items:center; justify-content:center; padding:20px; box-sizing:border-box; transition:opacity 0.3s; }\n" +
                ".uacom-modal { width:var(--uacom-noty-width, 800px); max-width:96vw; height:85vh; max-height:920px; background:#1a222c; border:1px solid rgba(255,255,255,0.1); border-radius:16px; box-shadow:0 14px 36px rgba(0,0,0,0.8); display:flex; flex-direction:column; overflow:hidden; animation:uacomAppear 0.4s ease-out; }\n" +
                
                "@supports (backdrop-filter: blur(20px)) or (-webkit-backdrop-filter: blur(20px)) { \n" +
                    ".uacom-overlay { background: rgba(0, 0, 0, 0.4); backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px); } \n" +
                    ".uacom-modal { background: rgba(22, 30, 38, 0.55); backdrop-filter: blur(24px) saturate(145%); -webkit-backdrop-filter: blur(24px) saturate(145%); border-radius: 30px; } \n" +
                    ".ua-comment-card { background: rgba(22, 30, 38, 0.4); backdrop-filter: blur(15px) saturate(130%); -webkit-backdrop-filter: blur(15px) saturate(130%); } \n" +
                    ".ua-comment-card.focus { background: rgba(255, 255, 255, 0.1); } \n" +
                "}\n" +
                
                ".uacom-head { display:flex; align-items:center; justify-content:space-between; padding:16px 20px; background:rgba(17, 23, 29, 0.98); border-top:1px solid rgba(255,255,255,0.06); box-sizing: border-box; }\n" +
                ".uacom-leftside { display:flex; align-items:center; min-width:0; flex:1; }\n" +
                ".uacom-rightside { display:flex; align-items:center; flex-shrink:0; }\n" +
                ".uacom-leftside .uacom-arrow { margin-right:12px; }\n" +
                ".uacom-rightside .uacom-counter { margin-right:15px; }\n" +
                ".uacom-rightside .uacom-arrow { margin-right:12px; }\n" +
                
                ".uacom-arrow { width:42px; height:42px; border-radius:14px; display:flex; align-items:center; justify-content:center; background:rgba(255,255,255,0.08); color:#8c8f9a; cursor:pointer; transition:all 0.25s; border:1px solid rgba(255,255,255,0.1); font-size:1.2em; }\n" +
                ".uacom-arrow.active { color:#fff; border-color:rgba(255,255,255,0.22); background:rgba(255,255,255,0.12); }\n" +
                ".uacom-arrow.active:hover { transform:scale(1.04); }\n" +
                ".uacom-meta { min-width:0; overflow:hidden; flex:1; }\n" +
                ".uacom-title { font-size:0.85em; color:#d8deef; opacity:0.9; display:flex; align-items:center; }\n" +
                ".uacom-author { font-size:1.15em; font-weight:bold; color:#fff; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }\n" +
                ".uacom-counter { font-weight:bold; color:#dbe0eb; opacity:0.75; min-width:5ch; text-align:right; font-size:1.1em; }\n" +
                ".uacom-close { width:42px; height:42px; border-radius:14px; display:flex; align-items:center; justify-content:center; background:rgba(255,255,255,0.1); color:#fff; cursor:pointer; transition:all 0.3s; border:1px solid rgba(255,255,255,0.14); font-size:1.2em; }\n" +
                ".uacom-close:hover { background:rgba(255,255,255,0.2); transform:scale(1.02); }\n" +
                ".uacom-close.focus, .uacom-close:active { transform:scale(0.97); background:rgba(255,255,255,0.26); border-color:#fff; box-shadow:0 0 15px rgba(255,255,255,0.4); outline:none; }\n" +
                ".uacom-body { padding:28px 24px; overflow-y:auto; font-size:var(--uacom-noty-fsize, 1.3em); line-height:1.6; color:rgba(255,255,255,0.95); white-space:pre-wrap; flex:1; }\n" +
                ".uacom-body::-webkit-scrollbar { width:8px; display:block; }\n" +
                ".uacom-body::-webkit-scrollbar-track { background:rgba(255,255,255,0.05); border-radius:10px; }\n" +
                ".uacom-body::-webkit-scrollbar-thumb { background:rgba(255,255,255,0.2); border-radius:10px; }\n" +
                ".uacom-body::-webkit-scrollbar-thumb:hover { background:rgba(255,255,255,0.4); }\n" +
                
                "@media (orientation: portrait), (max-width: 768px) { .ua-comment-card { flex: 0 0 85vw !important; width: 85vw !important; } .uacom-modal { width: 95vw; height: 90vh; } }\n";
            document.head.appendChild(style);

            if (window.Lampa && window.Lampa.Listener) {
                window.Lampa.Listener.follow('full', function(e) {
                    try {
                        if (e.type === 'complite') { _this.destroy(); _this.fetch(e.data.movie); }
                        else if (e.type === 'destroy') { _this.destroy(); }
                    } catch(err) {
                        console.error('UaComentsY Listener Error:', err);
                    }
                });
            }
        };

        this.refreshScroll = function() {
            var mainScroll = $('.scroll').data('iscroll');
            if (mainScroll) mainScroll.refresh();
        };

        this.destroy = function() {
            UaCommentViewer.close();
            fetchedComments =[];
            isSearchFinished = false;
            currentStatus = '';
            if (observer) { observer.disconnect(); observer = null; }
            $('.ua-comments-root').remove();
        };
        
        this.fetch = function(movie) {
            var _this = this;
            try {
                var useUaKino = getTriggerSafe('uacom_src_uakino', true);
                var useUaFlix = getTriggerSafe('uacom_src_uaflix', true);
                var useUaSerials = getTriggerSafe('uacom_src_uaserials', true);
                var useKinoBaza = getTriggerSafe('uacom_src_kinobaza', true);
                
                var totalSources = 0;
                if (useUaKino) totalSources++;
                if (useUaFlix) totalSources++;
                if (useUaSerials) totalSources++;
                if (useKinoBaza) totalSources++;

                if (totalSources === 0) {
                    currentStatus = 'Всі джерела вимкнені в налаштуваннях';
                    isSearchFinished = true;
                    _this.inject();
                    return;
                }

                var releaseDateStr = movie.release_date || movie.first_air_date || '';
                if (!releaseDateStr) {
                    currentStatus = 'Рік виходу не вказано, пошук коментарів неможливий.';
                    isSearchFinished = true;
                    _this.inject();
                    return;
                }

                var releaseDate = new Date(releaseDateStr);
                var today = new Date();
                today.setHours(0, 0, 0, 0);

                if (releaseDate > today) {
                    currentStatus = 'Реліз ще не відбувся, коментарів поки що немає.';
                    isSearchFinished = true;
                    _this.inject();
                    return;
                }

                var data = { ua: [], fl: [], us: [], kb:[] };
                var done = 0;
                
                isSearchFinished = false;
                currentStatus = 'Пошук коментарів...';
                _this.startObserver(); 
                
                var finish = function() {
                    done++;
                    if (done >= totalSources) {
                        var all =[];
                        var kbReviews = data.kb.filter(function(c) { return c.isReview; });
                        var kbComments = data.kb.filter(function(c) { return !c.isReview; });
                        
                        all = all.concat(kbReviews);
                        
                        var max = Math.max(data.ua.length, data.fl.length, data.us.length, kbComments.length);
                        for (var i = 0; i < max; i++) {
                            if (data.ua[i]) all.push(data.ua[i]);
                            if (data.fl[i]) all.push(data.fl[i]);
                            if (data.us[i]) all.push(data.us[i]);
                            if (kbComments[i]) all.push(kbComments[i]);
                        }
                        
                        fetchedComments = all;
                        isSearchFinished = true;

                        if (all.length === 0) currentStatus = 'Коментарі не знайдено';
                        _this.inject(); 
                    }
                };

                if (useUaKino) {
                    var fallbackUaKino = function() {
                        finder.search({ 
                            name: 'UaKino', base: 'https://uakino.best', search: '/index.php?do=search&subaction=search&story=', 
                            selector: 'div.movie-item, .shortstory', linkSelector: 'a.movie-title, a.full-movie, .poster > a', commentsSelector: '.comments'
                        }, movie, function(res) { data.ua = res; finish(); });
                    };

                    if (movie.imdb_id) {
                        var uakinoSearchUrl = 'https://uakino.best/index.php?do=search&subaction=search&story=' + encodeURIComponent(movie.imdb_id);
                        network.req(uakinoSearchUrl, function(html) {
                            try {
                                var doc = parseHTML(html);
                                if (doc.find('.comments').length > 0 || doc.find('#dle-comments-list').length > 0) {
                                    data.ua = parser.parse(html, 'UaKino', '.comments');
                                    finish();
                                    return;
                                }
                                var linkEl = doc.find('div.movie-item, .shortstory').first().find('a.movie-title, a.full-movie, .poster > a').first();
                                if (!linkEl.length) linkEl = doc.find('div.movie-item, .shortstory').first().find('a').first();
                                var href = linkEl.attr('href');
                                
                                if (href) {
                                    if (href.indexOf('http') !== 0) href = 'https://uakino.best' + (href.indexOf('/') === 0 ? '' : '/') + href;
                                    network.req(href, function(pageHtml) {
                                        try {
                                            data.ua = parser.parse(pageHtml, 'UaKino', '.comments');
                                            finish();
                                        } catch(e) { fallbackUaKino(); }
                                    }, function() { fallbackUaKino(); });
                                } else { fallbackUaKino(); }
                            } catch(err) { fallbackUaKino(); }
                        }, function() { fallbackUaKino(); });
                    } else { fallbackUaKino(); }
                }

                if (useUaFlix) {
                    try {
                        var flixCompleted = false;
                        var flixTimeout = setTimeout(function() { if (!flixCompleted) { flixCompleted = true; data.fl =[]; finish(); } }, 15000); 
                        finder.search({ 
                            name: 'UAFlix', base: 'https://uafix.net', search: '/search.html?do=search&subaction=search&story=', 
                            selector: '.video-item, .sres-wrap, article.shortstory', linkSelector: 'a', commentsSelector: '#dle-comments-list'
                        }, movie, function(res) { if (!flixCompleted) { clearTimeout(flixTimeout); flixCompleted = true; data.fl = res; finish(); } });
                    } catch(e) { finish(); }
                }

                if (useUaSerials) {
                    try {
                        var usCompleted = false;
                        var usTimeout = setTimeout(function() { if (!usCompleted) { usCompleted = true; data.us =[]; finish(); } }, 15000); 
                        
                        if (!movie.imdb_id) {
                            if (!usCompleted) { clearTimeout(usTimeout); usCompleted = true; data.us =[]; finish(); }
                        } else {
                            var usQueries =[];
                            var usEn = movie.original_title || movie.original_name || '';
                            var usUa = movie.title || movie.name || '';
                            if (usEn) usQueries.push(usEn);
                            if (usUa && usUa.toLowerCase() !== usEn.toLowerCase()) usQueries.push(usUa);

                            var usQIdx = 0;
                            var runUsQuery = function() {
                                if (usQIdx >= usQueries.length) {
                                    if (!usCompleted) { clearTimeout(usTimeout); usCompleted = true; data.us =[]; finish(); }
                                    return;
                                }
                                var q = usQueries[usQIdx++];
                                if (!q || q.trim().length < 2) return runUsQuery();

                                var searchUrl = 'https://uaserials.com/index.php?do=search&subaction=search&story=' + encodeURIComponent(q);
                                network.req(searchUrl, function(html) {
                                    var doc = parseHTML(html);
                                    var links =[];
                                    doc.find('.short-item, .movie-item, .shortstory').slice(0, 10).each(function() {
                                        var lnk = $(this).find('a.short-title, a.movie-title, .short-img, a').first();
                                        var href = lnk.attr('href');
                                        if (href && links.indexOf(href) === -1) {
                                            if (href.indexOf('http') !== 0) href = 'https://uaserials.com' + (href.indexOf('/') === 0 ? '' : '/') + href;
                                            links.push(href);
                                        }
                                    });

                                    if (links.length === 0) return runUsQuery();

                                    var lIdx = 0;
                                    var checkUsLink = function() {
                                        if (lIdx >= links.length) return runUsQuery();
                                        var targetUrl = links[lIdx++];

                                        network.req(targetUrl, function(pageHtml) {
                                            if (usCompleted) return;
                                            var pDoc = parseHTML(pageHtml);
                                            var imdbLinkEl = pDoc.find('.short-rate-imdb').first();
                                            var imdbLink = imdbLinkEl.length ? imdbLinkEl.attr('href') : null;
                                            var matchFound = false;

                                            if (imdbLink) {
                                                var m = imdbLink.match(/(tt\d+)/);
                                                if (m && m[1] === movie.imdb_id) matchFound = true;
                                            }

                                            if (matchFound) {
                                                var comments = parser.parse(pageHtml, 'UASerials', '#dle-comments-list');
                                                if (!usCompleted) { clearTimeout(usTimeout); usCompleted = true; data.us = comments; finish(); }
                                            } else {
                                                checkUsLink();
                                            }
                                        }, function() { checkUsLink(); });
                                    };
                                    checkUsLink();
                                }, function() { runUsQuery(); });
                            };
                            runUsQuery();
                        }
                    } catch(e) { finish(); }
                }

                if (useKinoBaza) {
                    try {
                        var kbCompleted = false;
                        var kbTimeout = setTimeout(function() { if (!kbCompleted) { kbCompleted = true; data.kb =[]; finish(); } }, 15000); 
                        
                        if (movie.imdb_id) {
                            var kbSearchUrl = 'https://kinobaza.com.ua/search?q=' + encodeURIComponent(movie.imdb_id);
                            network.req(kbSearchUrl, function(html) {
                                if (kbCompleted) return;
                                
                                var processKb = function(pageHtml) {
                                    var kbList =[];
                                    try {
                                        var pageDoc = parseHTML(pageHtml);
                                        var cleanText = function(str) { return str.replace(/[^\S\r\n]+/g, ' ').replace(/\n\s*\n\s*\n+/g, '\n\n').trim(); };

                                        pageDoc.find('div[id^="review_container_"],[itemprop="review"]').each(function() {
                                            try {
                                                var el = $(this);
                                                var authorEl = el.find('[itemprop="name"]').first();
                                                if (!authorEl.length) authorEl = el.find('a.text-reset.fw-bold[href*="/@"], a[href*="/user"], b, strong').first();
                                                var author = authorEl.text().trim() || 'Критик';
                                                
                                                var bodyEl = el.find('[itemprop="reviewBody"]').first();
                                                if (!bodyEl.length) bodyEl = el.find('.content, .review-text').first(); 
                                                
                                                if (bodyEl.length) {
                                                    var cloneBody = bodyEl.clone();
                                                    cloneBody.find('br').replaceWith('\n');
                                                    cloneBody.find('p').each(function() { $(this).append('\n\n'); });
                                                    cloneBody.find('script, style, iframe').remove();
                                                    var text = cleanText(cloneBody.text());
                                                    text = text.replace(/(?:\s*(?:читати далі|показати повністю|читать далее|показать повністю|read more|…|\.\.\.|\.\.))\s*$/ig, '');
                                                    if (text && text.length > 5) kbList.push({ author: author, source: 'KinoBaza', text: text, isReview: true });
                                                }
                                            } catch(e){}
                                        });
                                        
                                        pageDoc.find('div[id^="comment_"]').each(function() {
                                            try {
                                                var el = $(this);
                                                var authorEl = el.find('a.text-reset.fw-bold').first();
                                                if (!authorEl.length) authorEl = el.find('a[href*="/@"], .name, b, strong').first();
                                                var author = authorEl.text().trim() || 'Глядач';
                                                
                                                var bodyEl = el.find('.js-comment-body').first();
                                                if (!bodyEl.length) bodyEl = el.find('.comment-text, .content').first(); 
                                                
                                                if (bodyEl.length) {
                                                    var cloneBody = bodyEl.clone();
                                                    cloneBody.find('br').replaceWith('\n');
                                                    cloneBody.find('p').each(function() { $(this).append('\n'); });
                                                    cloneBody.find('script, style, iframe').remove();
                                                    var text = cleanText(cloneBody.text());
                                                    text = text.replace(/(?:\s*(?:читати далі|показати повністю|читать далее|показать повністю|read more|…|\.\.\.|\.\.))\s*$/ig, '');
                                                    if (text && text.length > 5) kbList.push({ author: author, source: 'KinoBaza', text: text, isReview: false });
                                                }
                                            } catch(e){}
                                        });
                                    } catch(e) { console.error('UaComentsY KB Error:', e); }
                                    
                                    data.kb = kbList;
                                    clearTimeout(kbTimeout);
                                    kbCompleted = true;
                                    finish();
                                };

                                var initialDoc = parseHTML(html);
                                if (initialDoc.find('div[id^="review_container_"]').length === 0 && initialDoc.find('div[id^="comment_"]').length === 0) {
                                    var firstLink = initialDoc.find('a[href^="/titles/"]').first().attr('href');
                                    if (firstLink) {
                                        var fullUrl = firstLink.indexOf('http') === 0 ? firstLink : 'https://kinobaza.com.ua' + firstLink;
                                        network.req(fullUrl, function(pageHtml) {
                                            if (kbCompleted) return;
                                            processKb(pageHtml); 
                                        }, function() {
                                            if (!kbCompleted) { clearTimeout(kbTimeout); kbCompleted = true; data.kb =[]; finish(); }
                                        });
                                        return;
                                    }
                                }
                                processKb(html);
                            }, function() { if (!kbCompleted) { clearTimeout(kbTimeout); kbCompleted = true; data.kb =[]; finish(); } });
                        } else {
                            clearTimeout(kbTimeout);
                            kbCompleted = true;
                            data.kb =[];
                            finish();
                        }
                    } catch(e) { finish(); }
                }
            } catch (err) {
                console.error('UaComentsY Main Fetch Error:', err);
                currentStatus = 'Помилка завантаження';
                isSearchFinished = true;
                _this.inject();
            }
        };

        this.startObserver = function() {
            var _this = this;
            _this.inject(); 
            observer = new MutationObserver(function(mutations) {
                var shouldInject = false;
                for (var i = 0; i < mutations.length; i++) {
                    if (mutations[i].addedNodes.length && $(mutations[i].target).closest('.ua-comments-root').length === 0) {
                        shouldInject = true; break;
                    }
                }
                if (shouldInject) _this.inject();
            });
            observer.observe(document.body, { childList: true, subtree: true });
        };

        this.inject = function() {
            var _this = this;
            try {
                var focusedRemoved = false;
                
                $('.items-line').each(function() {
                    var el = $(this);
                    var title = el.find('.items-line__title').text().trim();
                    var hasAddBtn = el.find('.full-review-add').length > 0;
                    
                    if (title === 'Коментарі' || hasAddBtn) {
                        if (el.find('.focus').length > 0 || el.hasClass('focus')) focusedRemoved = true;
                        el.remove();
                    }
                });

                if ($('.ua-comments-slider').length && fetchedComments.length > 0) return;

                var targetBlock = null;
                $('.full-descr__details').each(function() {
                    if ($(this).find('.full-descr__info, .full--budget, .full--countries').length > 0) targetBlock = $(this);
                });
                if (!targetBlock || !targetBlock.length) return; 

                var root = $('.ua-comments-root');
                if (!root.length) {
                    root = $('<div class="ua-comments-root items-line"></div>');
                    targetBlock.before(root);
                }

                if (!isSearchFinished || (isSearchFinished && fetchedComments.length === 0)) {
                    var statusCard = root.find('.ua-status-card');
                    if (!statusCard.length) {
                        statusCard = $('<div class="ua-status-card selector"></div>');
                        root.html(statusCard);
                        _this.refreshScroll(); 
                    }
                    if (statusCard.text() !== currentStatus) statusCard.text(currentStatus);
                    return;
                }

                if (isSearchFinished && fetchedComments.length > 0) {
                    var currentFocus = $('.focus').last();

                    root.empty(); 
                    var slider = $('<div class="ua-comments-slider"></div>');

                    slider.on('touchstart', function(e) {
                        if (!e.originalEvent || !e.originalEvent.touches) return;
                        $(this).data('touchStartX', e.originalEvent.touches[0].clientX);
                        $(this).data('touchStartY', e.originalEvent.touches[0].clientY);
                        $(this).data('isDragging', false);
                    });

                    slider.on('touchmove', function(e) {
                        if (!e.originalEvent || !e.originalEvent.touches) return;
                        var touchX = e.originalEvent.touches[0].clientX;
                        var touchY = e.originalEvent.touches[0].clientY;
                        var startX = $(this).data('touchStartX');
                        var startY = $(this).data('touchStartY');
                        
                        var diffX = Math.abs(touchX - startX);
                        var diffY = Math.abs(touchY - startY);
                        
                        if (diffX > 10 || diffY > 10) {
                            $(this).data('isDragging', true);
                        }
                        if (diffX > diffY && diffX > 10) {
                            e.stopPropagation();
                        }
                    });

                    fetchedComments.forEach(function(comment, idx) {
                        var item = new UaCommentItem(comment, fetchedComments, idx);
                        slider.append(item.create().html);
                    });

                    root.append(slider);
                    _this.refreshScroll(); 

                    setTimeout(function() {
                        slider.find('.ua-comment-card').each(function() {
                            var cardEl = $(this);
                            var textNode = cardEl.find('.ua-comment-text')[0];
                            if (textNode && textNode.scrollHeight > textNode.clientHeight + 3) { 
                                cardEl.find('.ua-chip.read-more').css('display', 'flex');
                            }
                        });
                    }, 300);

                    if (window.Lampa && window.Lampa.Controller) {
                        if (focusedRemoved && slider.find('.ua-comment-card').length) {
                            var firstCard = slider.find('.ua-comment-card').first()[0];
                            if (firstCard) window.Lampa.Controller.focus(firstCard);
                        } else if (currentFocus.length && currentFocus[0] !== document.body && $.contains(document.documentElement, currentFocus[0])) {
                            window.Lampa.Controller.focus(currentFocus[0]);
                        }
                    }
                }
            } catch (err) { console.error('UaComentsY Inject Error:', err); }
        };
    }

    function startPlugin() {
        if (window.uacomentsy_plugin_started) return;
        window.uacomentsy_plugin_started = true;
        
        updateCSSVars();
        if (window.Lampa) new InlineComments().init();
    }

    if (window.appready) {
        createSettings();
        startPlugin();
    } else {
        if (window.Lampa && window.Lampa.Listener) {
            window.Lampa.Listener.follow("app", function (e) {
                if (e.type === "ready") {
                    createSettings();
                    startPlugin();
                }
            });
        }
    }

})();