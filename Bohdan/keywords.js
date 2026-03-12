(function () {
    'use strict';

    function KeywordsPlugin() {
        var _this = this;
        
        // Вбудована SVG іконка
        var ICON_TAG = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M21.41 11.58l-9-9C12.05 2.22 11.55 2 11 2H4c-1.1 0-2 .9-2 2v7c0 .55.22 1.05.59 1.42l9 9c.36.36.86.58 1.41.58.55 0 1.05-.22 1.41-.59l7-7c.37-.36.59-.86.59-1.41 0-.55-.23-1.06-.59-1.42zM5.5 7C4.67 7 4 6.33 4 5.5S4.67 4 5.5 4 7 4.67 7 5.5 6.33 7 5.5 7z"/></svg>';

        if (Lampa.Lang) {
            Lampa.Lang.add({
                plugin_keywords_title: { en: 'Tags', uk: 'Теги' },
                plugin_keywords_movies: { en: 'Movies', uk: 'Фільми' },
                plugin_keywords_tv: { en: 'TV Series', uk: 'Серіали' },
                plugin_keywords_none: { en: 'No tags', uk: 'Теги відсутні' }
            });
        }

        this.init = function () {
            if (!Lampa.Listener) return;

            Lampa.Listener.follow('full', function (e) {
                if (e.type == 'complite' || e.type == 'complete') {
                    var card = e.data.movie;
                    if (card && (card.source == 'tmdb' || e.data.source == 'tmdb') && card.id) {
                        var render = e.object.activity.render();
                        _this.drawButton(render);
                        _this.getKeywords(render, card);
                    }
                }
            });

            $('<style>').prop('type', 'text/css').html(
                '.keywords-icon-svg { width: 1.4em; height: 1.4em; margin-right: 0.5em; } ' +
                '.button--keywords { display: flex; align-items: center; opacity: 0.5; pointer-events: none; } ' + 
                '.button--keywords.ready { opacity: 1; pointer-events: auto; }'
            ).appendTo('head');
        };

        this.drawButton = function (render) {
            var container = render.find('.full-start-new__buttons, .full-start__buttons').first();
            if (!container.length || container.find('.button--keywords').length) return;

            var title = Lampa.Lang.translate('plugin_keywords_title');
            var btn = $('<div class="full-start__button selector button--keywords"><div class="keywords-icon-svg">' + ICON_TAG + '</div><span>' + title + '</span></div>');

            var bookmarkBtn = container.find('.button--book, .button--like').first();
            if (bookmarkBtn.length) {
                bookmarkBtn.before(btn);
            } else {
                container.append(btn);
            }
        };

        this.getKeywords = function (render, card) {
            var method = (card.original_name || card.name) ? 'tv' : 'movie';
            var url = Lampa.TMDB.api(method + '/' + card.id + '/keywords?api_key=' + Lampa.TMDB.key());

            $.ajax({
                url: url,
                dataType: 'json',
                success: function (resp) {
                    var tags = resp.keywords || resp.results || [];
                    if (tags.length > 0) {
                        _this.translateTags(tags, function(translatedTags) {
                            _this.activateButton(render, translatedTags);
                        });
                    }
                },
                error: function() {}
            });
        };

        this.translateTags = function (tags, callback) {
            var lang = Lampa.Storage.get('language', 'uk');
            if (lang !== 'uk') return callback(tags);

            var tagsWithContext = tags.map(function(t) { return "Movie tag: " + t.name; });
            var url = 'https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=uk&dt=t&q=' + encodeURIComponent(tagsWithContext.join(' ||| '));

            $.ajax({
                url: url,
                dataType: 'json',
                success: function (result) {
                    try {
                        var translatedText = '';
                        if (result && result[0]) result[0].forEach(function(item) { if (item[0]) translatedText += item[0]; });
                        var translatedArray = translatedText.split('|||');
                        tags.forEach(function(tag, index) {
                            if (translatedArray[index]) {
                                tag.name = translatedArray[index]
                                    .replace(/позначка до фільму[:\s]*/gi, '')
                                    .replace(/тег до фільму[:\s]*/gi, '')
                                    .replace(/тег фільму[:\s]*/gi, '')
                                    .replace(/movie tag[:\s]*/gi, '')
                                    .replace(/^[:\s\-]*/, '')
                                    .trim();
                            }
                        });
                        callback(tags);
                    } catch (e) { callback(tags); }
                },
                error: function () { callback(tags); }
            });
        };

        this.activateButton = function (render, tags) {
            var btn = render.find('.button--keywords');
            if (!btn.length) return; 

            btn.addClass('ready');

            btn.off('hover:enter click').on('hover:enter click', function () {
                _this.openTagsMenu(tags, btn, render);
            });
        };

        this.openTagsMenu = function(tags, btnElement, renderContainer) {
            var controllerName = Lampa.Controller.enabled().name;
            var items = tags.map(function(tag) {
                return { 
                    title: tag.name.charAt(0).toUpperCase() + tag.name.slice(1), 
                    tag_data: tag 
                };
            });

            Lampa.Select.show({
                title: Lampa.Lang.translate('plugin_keywords_title'),
                items: items,
                onSelect: function (selectedItem) {
                    _this.openTypeMenu(selectedItem.tag_data, tags, btnElement, renderContainer);
                },
                onBack: function () {
                    // === ТУТ САМЕ ТОЙ КОД, ЩО ПРАЦЮВАВ ===
                    // Пересмикуємо активність, щоб відновити свайпи на телефоні
                    if (Lampa.Activity.active() && Lampa.Activity.active().activity) {
                        Lampa.Activity.active().activity.toggle();
                    } else {
                        Lampa.Controller.toggle(controllerName);
                    }

                    // А фокус ставимо тільки для ТБ (щоб не було рамок на телефоні)
                    if (!Lampa.Platform.is('touch')) {
                        Lampa.Controller.collectionFocus(btnElement[0], renderContainer[0]);
                    }
                }
            });
        };

        this.openTypeMenu = function(tag, allTags, btnElement, renderContainer) {
            Lampa.Select.show({
                title: tag.name,
                items: [
                    { title: Lampa.Lang.translate('plugin_keywords_movies'), method: 'movie' },
                    { title: Lampa.Lang.translate('plugin_keywords_tv'), method: 'tv' }
                ],
                onSelect: function(item) {
                    Lampa.Activity.push({
                        url: 'discover/' + item.method + '?with_keywords=' + tag.id + '&sort_by=popularity.desc',
                        title: tag.name,
                        component: 'category_full',
                        source: 'tmdb',
                        page: 1
                    });
                },
                onBack: function() {
                    // Повертаємося до списку тегів
                    _this.openTagsMenu(allTags, btnElement, renderContainer);
                }
            });
        };
    }

    if (!window.plugin_keywords_instance) {
        window.plugin_keywords_instance = new KeywordsPlugin();
        window.plugin_keywords_instance.init();
    }
})();
