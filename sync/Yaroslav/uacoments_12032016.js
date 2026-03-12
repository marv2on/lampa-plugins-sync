(function() {
    'use strict';

    // --- Допоміжна функція безпечного виводу тексту ---
    function safeText(str) {
        return (str || '').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>');
    }

    // --- Центрування картки при фокусі ---
    function centerCard(cardEl) {
        var container = cardEl.parent();
        if (!container.length) return;
        var targetLeft = cardEl[0].offsetLeft;
        var targetWidth = cardEl.width();
        var containerWidth = container.width();
        var scrollLeft = targetLeft - (containerWidth / 2) + (targetWidth / 2);
        container.stop().animate({ scrollLeft: scrollLeft }, 200);
    }

    // --- ОНОВЛЕНИЙ Менеджер модального вікна коментаря ---
    var CommentModal = {
        focusedCard: null,
        
        // Функція, що адаптує шрифт всередині модального вікна
        adaptModalFontSize: function() {
            var textEl = document.querySelector('.ua-comment-modal-text');
            if (!textEl) return;
            
            // Скидаємо розмір шрифту до початкового
            textEl.style.fontSize = '1.3em';
            
            var currentSize = 1.3;
            // Поки реальна висота тексту більша за доступну область І шрифт ще можна зменшувати
            while (textEl.scrollHeight > textEl.clientHeight && currentSize > 0.7) {
                currentSize -= 0.05;
                textEl.style.fontSize = currentSize + 'em';
            }
        },

        // Функція, що створює та показує модальне вікно
        show: function(data, originalCardElement) {
            if (document.querySelector('.ua-comment-modal-overlay')) return;

            this.focusedCard = originalCardElement;
            
            var sourceIcon = '';
            if (data.source === 'UaKino') {
                sourceIcon = '<img src="https://yarikrazor-star.github.io/lmp/uak.png" class="ua-source-icon">';
            } else if (data.source === 'UAFlix') {
                sourceIcon = '<img src="https://yarikrazor-star.github.io/lmp/uaf.png" class="ua-source-icon">';
            } else if (data.source === 'UASerials') {
                sourceIcon = '<img src="https://upload.wikimedia.org/wikipedia/commons/d/d4/Clapperboard_-_The_Noun_Project.svg" class="ua-source-icon" style="filter: brightness(0) invert(1);">';
            }

            var modalHTML = `
                <div class="ua-comment-modal-overlay">
                    <div class="ua-comment-modal-window">
                        <div class="ua-comment-modal-close">✕</div>
                        <div class="ua-comment-meta" style="padding-right: 35px;">
                            <div class="ua-chip author">${sourceIcon}<span>${data.author}</span></div>
                        </div>
                        <div class="ua-comment-modal-text">${safeText(data.text)}</div>
                    </div>
                </div>
            `;
            
            $('body').append(modalHTML);

            // Даємо браузеру момент на рендерінг, а потім адаптуємо шрифт
            setTimeout(this.adaptModalFontSize, 10);

            // Додаємо слухачі подій для закриття
            
            // 1. Клік на хрестик
            $('.ua-comment-modal-close').on('click', function() {
                CommentModal.hide();
            });

            // 2. Клік по фону (overlay), поза самим вікном
            $('.ua-comment-modal-overlay').on('click', function(e) {
                if (e.target === this) {
                    CommentModal.hide();
                }
            });

            // 3. Свайп вправо (для телефонів / тачскрінів)
            var touchStartX = 0;
            $('.ua-comment-modal-overlay').on('touchstart', function(e) {
                touchStartX = e.originalEvent.touches ? e.originalEvent.touches[0].clientX : e.clientX;
            });
            $('.ua-comment-modal-overlay').on('touchend', function(e) {
                var touchEndX = e.originalEvent.changedTouches ? e.originalEvent.changedTouches[0].clientX : e.clientX;
                if (touchEndX - touchStartX > 60) { // Якщо свайпнули вправо більше ніж на 60px
                    CommentModal.hide();
                }
            });

            // 4. Кнопки пульта (назад, ОК тощо)
            window.addEventListener('keydown', this.closeHandler, true);
        },
        
        hide: function() {
            $('.ua-comment-modal-overlay').remove();
            window.removeEventListener('keydown', this.closeHandler, true);
            
            if (this.focusedCard) {
                Lampa.Controller.focus(this.focusedCard);
            }
        },
        
        closeHandler: function(e) {
            e.preventDefault();
            e.stopPropagation();
            CommentModal.hide();
        }
    };


    // --- 1. Налаштування проксі ---
    var proxies =[
        'https://cors.lampa.stream/',
        'https://cors.eu.org/',
        'https://corsproxy.io/?url='
    ];

    // --- 2. Мережевий шар ---
    var network = {
        req: function(url, onSuccess, onError, proxyIdx) {
            proxyIdx = proxyIdx || 0;
            if (proxyIdx >= proxies.length) { if (onError) onError(); return; }
            $.ajax({
                url: proxies[proxyIdx] + encodeURIComponent(url),
                method: 'GET',
                timeout: 6000,
                success: function(res) {
                    if ((res || '').length < 200) network.req(url, onSuccess, onError, proxyIdx + 1);
                    else onSuccess(res);
                },
                error: function() { network.req(url, onSuccess, onError, proxyIdx + 1); }
            });
        }
    };

    // --- 3. Парсер коментарів ---
    var parser = {
        parse: function(html, source, primarySelector) {
            var list =[];
            var doc = $('<div>' + html + '</div>');
            
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
                var el = $(this);
                if (el.parents('.comment, div[id^="comment-id-"], .comm-item').length > 0) return;
                
                var author = el.find('.comm-author, .name, .comment-author, .acc-name, b').first().text().trim();
                
                var textEl = el.find('.comm-text, .comment-content, .text, .comment-body, div[id^="comm-id-"]').clone();
                textEl.find('div, script, style, .comm-good-bad').remove();
                textEl.find('br').replaceWith('\n'); 
                var text = textEl.text().trim();
                
                if (author && text) {
                    var sign = author + '|' + text.substring(0, 50);
                    if (signs.indexOf(sign) === -1) {
                        signs.push(sign);
                        list.push({ author: author, source: source, text: text });
                    }
                }
            });
            return list;
        }
    };

    // --- 4. Пошукова логіка з жорсткою фільтрацією ---
    var finder = {
        areTitlesSimilar: function(searchTitle, pageTitle) {
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

            if (cleanPage.includes(cleanSearch) || cleanSearch.includes(cleanPage)) {
                return true;
            }

            var searchWords = new Set(cleanSearch.split(' ').filter(Boolean)); 
            var pageWords = new Set(cleanPage.split(' ').filter(Boolean));

            if (searchWords.size === 0) return true;

            var intersection = new Set([...searchWords].filter(word => pageWords.has(word)));
            if (intersection.size === 0) return false;

            var pageToSearchSimilarity = intersection.size / pageWords.size;
            if (pageToSearchSimilarity >= 0.9) return true;

            var searchToPageSimilarity = intersection.size / searchWords.size;
            if (searchToPageSimilarity >= 0.7) return true;

            return false;
        },
        
        search: function(site, movie, callback) {
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
                    var doc = $('<div>' + html + '</div>');
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
                            var headMatch = page.match(/<head[^>]*>([\s\S]*?)<\/head>/i);
                            var pageTitle = '';
                            if (headMatch) {
                                var tMatch = headMatch[1].match(/<title[^>]*>([\s\S]*?)<\/title>/i);
                                if (tMatch) pageTitle = tMatch[1];
                            } else {
                                var tMatch = page.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
                                if (tMatch) pageTitle = tMatch[1];
                            }
                            
                            if (!finder.areTitlesSimilar(titleToMatch, pageTitle)) return checkLink();

                            var titleLower = pageTitle.toLowerCase();
                            
                            var isYearValid = false;
                            if (year) {
                                var yearRegex = new RegExp('\\b' + year + '\\b');
                                if (yearRegex.test(titleLower) || yearRegex.test(page)) isYearValid = true;
                            } else { isYearValid = true; }

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
                        }, function() { checkLink(); });
                    };
                    checkLink();
                }, function() { runQuery(); });
            };
            runQuery();
        }
    };

    // --- 5. Компонент Картки Коментаря ---
    class UaCommentItem {
        constructor(data) {
            this.data = data;
            this.html = null;
        }

        create() {
            var root = $('<div class="ua-comment-card selector"></div>');
            var topMeta = $('<div class="ua-comment-meta"></div>');
            var textNode = $('<div class="ua-comment-text"></div>');
            var bottomMeta = $('<div class="ua-comment-footer"></div>');

            var sourceIcon = '';
            if (this.data.source === 'UaKino') {
                sourceIcon = '<img src="https://yarikrazor-star.github.io/lmp/uak.png" class="ua-source-icon">';
            } else if (this.data.source === 'UAFlix') {
                sourceIcon = '<img src="https://yarikrazor-star.github.io/lmp/uaf.png" class="ua-source-icon">';
            } else if (this.data.source === 'UASerials') {
                sourceIcon = '<img src="https://upload.wikimedia.org/wikipedia/commons/d/d4/Clapperboard_-_The_Noun_Project.svg" class="ua-source-icon" style="filter: brightness(0) invert(1);">';
            }

            topMeta.append('<div class="ua-chip author">' + sourceIcon + '<span>' + this.data.author + '</span></div>');
            textNode.html(safeText(this.data.text));
            bottomMeta.append('<div class="ua-chip read-more" style="display: none;">Читати повністю</div>');

            root.append(topMeta).append(textNode).append(bottomMeta);

            root.on('hover:focus', function() {
                centerCard(root);
            });

            root.on('hover:enter', () => {
                if (!root.hasClass('can-open')) return; 
                CommentModal.show(this.data, root[0]);
            });

            this.html = root;
            return this;
        }
    }

    // --- 6. Менеджер Коментарів ---
    function InlineComments() {
        var fetchedComments =[];
        var observer = null;
        var currentStatus = '';
        var isSearchFinished = false;

        this.init = function() {
            var _this = this;
            
            var style = document.createElement('style');
            style.innerHTML = `
                .ua-comments-root { width: 100%; max-width: 100vw; overflow: hidden; position: relative; margin-bottom: 2px; z-index: 5; }
                .ua-comments-slider { display: flex; flex-wrap: nowrap; overflow-x: auto; padding: 10px 5px 20px 5px; gap: 20px; scrollbar-width: none; scroll-behavior: smooth; width: 100%; box-sizing: border-box; align-items: flex-start; }
                .ua-comments-slider::-webkit-scrollbar { display: none; }
                
                .ua-status-card { width: 98%; background: rgba(0,0,0,0.5); border-radius: 14px; padding: 15px; box-sizing: border-box; text-align: center; color: #fff; font-size: 1.2em; margin: 0 auto; transition: background 0.3s ease; }
                .ua-status-card.focus { background: rgba(0,0,0,0.7); }
                
                .ua-comment-card { flex: 0 0 500px; width: 500px; max-width: 80vw; border-radius: 14px; border: 1px solid rgba(255, 255, 255, 0.12); background: rgba(0, 0, 0, 0.5); padding: 20px; box-sizing: border-box; display: flex; flex-direction: column; transition: transform 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease; flex-shrink: 0; }
                .ua-comment-card.focus { border-color: rgba(255, 255, 255, 0.6); transform: translateY(-4px); box-shadow: 0 10px 25px rgba(0,0,0,0.5); background: rgba(255, 255, 255, 0.1); color: #fff; }
                
                .ua-comment-meta { display: flex; justify-content: flex-start; align-items: center; margin-bottom: 15px; gap: 10px; flex-wrap: wrap; }
                .ua-chip { background: rgba(0,0,0,0.3); padding: 5px 12px; border-radius: 8px; font-size: 0.85em; color: #ccc; display: flex; align-items: center; gap: 8px; white-space: nowrap; }
                .ua-chip.author { color: #fff; font-weight: bold; background: rgba(255,255,255,0.05); }
                .ua-source-icon { width: 16px; height: 16px; border-radius: 3px; }
                
                .ua-comment-text { font-size: 1.25em; line-height: 1.45; color: #ddd; display: -webkit-box; -webkit-line-clamp: 5; -webkit-box-orient: vertical; overflow: hidden; margin-bottom: 15px; }
                .ua-comment-card.focus .ua-comment-text { color: #fff; }
                
                .ua-comment-footer { margin-top: auto; display: flex; justify-content: flex-end; }
                .ua-chip.read-more { background: rgba(255,255,255,0.08); font-size: 0.8em; }
                .ua-comment-card.focus .ua-chip.read-more { background: #fff; color: #000; font-weight: bold; }
                
                /* ОНОВЛЕНІ СТИЛІ ДЛЯ МОДАЛЬНОГО ВІКНА */
                .ua-comment-modal-overlay { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.85); z-index: 1000; display: flex; align-items: center; justify-content: center; }
                .ua-comment-modal-window { position: relative; background: #1e1e1e; border: 1px solid rgba(255,255,255,0.2); border-radius: 16px; padding: 25px; max-width: 90vw; width: auto; min-width: 60vw; max-height: 90vh; overflow: hidden; display: flex; flex-direction: column; }
                .ua-comment-modal-close { position: absolute; top: 15px; right: 15px; width: 32px; height: 32px; background: rgba(255,255,255,0.1); border-radius: 50%; display: flex; align-items: center; justify-content: center; color: #fff; font-size: 1.1em; cursor: pointer; z-index: 10; transition: background 0.3s ease; }
                .ua-comment-modal-close:hover { background: rgba(255,255,255,0.3); }
                .ua-comment-modal-text { font-size: 1.3em; line-height: 1.5; color: #eee; white-space: pre-wrap; word-wrap: break-word; overflow: hidden; }
                
                @media (orientation: portrait), (max-width: 768px) {
                    .ua-comment-card { flex: 0 0 85vw !important; width: 85vw !important; }
                    .ua-comment-text { -webkit-line-clamp: 7; }
                    .ua-comment-modal-window { max-width: 95vw; min-width: 90vw; max-height: 90vh; padding: 20px; }
                    .ua-comment-modal-close { top: 10px; right: 10px; width: 28px; height: 28px; font-size: 1em; }
                }
            `;
            document.head.appendChild(style);

            Lampa.Listener.follow('full', function(e) {
                if (e.type === 'complite') { _this.destroy(); _this.fetch(e.data.movie); }
                else if (e.type === 'destroy') { _this.destroy(); }
            });
        };

        this.refreshScroll = function() {
            var mainScroll = $('.scroll').data('iscroll');
            if (mainScroll) mainScroll.refresh();
        };

        this.destroy = function() {
            CommentModal.hide();
            fetchedComments =[];
            isSearchFinished = false;
            currentStatus = '';
            if (observer) { observer.disconnect(); observer = null; }
            $('.ua-comments-root').remove();
        };
        
        this.fetch = function(movie) {
            var _this = this;
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

            var data = { ua:[], fl:[], us:[] };
            var done = 0;
            var totalSources = 3; 
            
            isSearchFinished = false;
            currentStatus = 'Пошук коментарів UaKino, UAFlix та UASerials...';
            _this.startObserver(); 
            
            var finish = function() {
                done++;
                if (done >= totalSources) {
                    var all =[];
                    var max = Math.max(data.ua.length, data.fl.length, data.us.length);
                    for (var i = 0; i < max; i++) {
                        if (data.ua[i]) all.push(data.ua[i]);
                        if (data.fl[i]) all.push(data.fl[i]);
                        if (data.us[i]) all.push(data.us[i]);
                    }
                    
                    fetchedComments = all;
                    isSearchFinished = true;

                    if (all.length === 0) currentStatus = 'Коментарі не знайдено';
                    _this.inject(); 
                }
            };

            finder.search({ 
                name: 'UaKino', base: 'https://uakino.best', search: '/index.php?do=search&subaction=search&story=', 
                selector: 'div.movie-item, .shortstory', linkSelector: 'a.movie-title, a.full-movie, .poster > a', commentsSelector: '.comments'
            }, movie, function(res) { data.ua = res; finish(); });

            var flixCompleted = false;
            var flixTimeout = setTimeout(function() { if (!flixCompleted) { flixCompleted = true; data.fl =[]; finish(); } }, 15000); 

            finder.search({ 
                name: 'UAFlix', base: 'https://uafix.net', search: '/search.html?do=search&subaction=search&story=', 
                selector: '.video-item, .sres-wrap, article.shortstory', linkSelector: 'a', commentsSelector: '#dle-comments-list'
            }, movie, function(res) { if (!flixCompleted) { clearTimeout(flixTimeout); flixCompleted = true; data.fl = res; finish(); } });

            var usCompleted = false;
            var usTimeout = setTimeout(function() { if (!usCompleted) { usCompleted = true; data.us =[]; finish(); } }, 15000); 

            finder.search({ 
                name: 'UASerials', base: 'https://uaserials.com', search: '/index.php?do=search&subaction=search&story=', 
                selector: '.short-item, .movie-item, .shortstory', linkSelector: 'a.short-title, a.movie-title, .short-img, a', commentsSelector: '#dle-comments-list'
            }, movie, function(res) { if (!usCompleted) { clearTimeout(usTimeout); usCompleted = true; data.us = res; finish(); } });
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
                var isStatusCardFocused = root.find('.ua-status-card').hasClass('focus');
                var currentFocus = $('.focus').last();

                root.empty(); 
                var slider = $('<div class="ua-comments-slider"></div>');

                fetchedComments.forEach(function(comment) {
                    var item = new UaCommentItem(comment);
                    slider.append(item.create().html);
                });

                root.append(slider);
                _this.refreshScroll(); 

                setTimeout(function() {
                    slider.find('.ua-comment-card').each(function() {
                        var cardEl = $(this);
                        var textNode = cardEl.find('.ua-comment-text')[0];
                        if (textNode && (textNode.scrollHeight > textNode.clientHeight + 3)) {
                            cardEl.find('.ua-chip.read-more').css('display', 'flex');
                            cardEl.addClass('can-open');
                        }
                    });
                }, 300);

                if ((isStatusCardFocused || focusedRemoved) && slider.find('.ua-comment-card').length) {
                    Lampa.Controller.focus(slider.find('.ua-comment-card').first()[0]);
                } else if (currentFocus.length && currentFocus[0] !== document.body) {
                    Lampa.Controller.focus(currentFocus[0]);
                }
            }
        };
    }

    if (window.Lampa) {
        new InlineComments().init();
    }
})();