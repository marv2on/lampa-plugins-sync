(function () {
    'use strict';

    /**
     * Дорама / Asian Dramas + Donghua
     * Версія: 1.2.0 (оновлено: аніме виключено з дорам, топ донхуа замінено на популярні)
     * Опис: Добірки популярних дорам + китайська анімація (донхуа)
     */

    var DORAMA_CONFIG = {
        'dorama': {
            title: 'Дорама',
            icon: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.94-.49-7-3.85-7-7.93s3.06-7.44 7-7.93V17.93zm2-13.86c3.94.49 7 3.85 7 7.93s-3.06 7.44-7 7.93V4.07z"/></svg>',
            categories: [
                // ────────────────────────────────────────────────
                // Дорами (live-action) — без аніме
                // ────────────────────────────────────────────────

                {
                    "title": "Популярні дорами зараз",
                    "url": "discover/tv",
                    "params": {
                        "with_original_language": "ko|zh|ja",
                        "with_genres": "18",
                        "without_genres": "16",
                        "sort_by": "popularity.desc",
                        "vote_count.gte": "30"
                    }
                },

                {
                    "title": "Нові корейські дорами",
                    "url": "discover/tv",
                    "params": {
                        "with_original_language": "ko",
                        "with_genres": "18",
                        "without_genres": "16",
                        "sort_by": "first_air_date.desc",
                        "first_air_date.lte": "{current_date}",
                        "vote_count.gte": "3"
                    }
                },

                {
                    "title": "Найкращі дорами (високий рейтинг)",
                    "url": "discover/tv",
                    "params": {
                        "with_original_language": "ko|zh|ja",
                        "with_genres": "18",
                        "without_genres": "16",
                        "sort_by": "vote_average.desc",
                        "vote_average.gte": "7.8",
                        "vote_count.gte": "200"
                    }
                },

                {
                    "title": "Топ корейських дорам",
                    "url": "discover/tv",
                    "params": {
                        "with_original_language": "ko",
                        "with_genres": "18",
                        "without_genres": "16",
                        "sort_by": "vote_average.desc",
                        "vote_average.gte": "8.0",
                        "vote_count.gte": "500"
                    }
                },

                {
                    "title": "Романтичні дорами",
                    "url": "discover/tv",
                    "params": {
                        "with_original_language": "ko|zh|ja",
                        "with_genres": "18,10749",
                        "without_genres": "16",
                        "sort_by": "popularity.desc"
                    }
                },

                {
                    "title": "Історичні та фентезі дорами",
                    "url": "discover/tv",
                    "params": {
                        "with_original_language": "ko|zh|ja",
                        "with_genres": "10765,37",
                        "without_genres": "16",
                        "sort_by": "popularity.desc"
                    }
                },

                {
                    "title": "Китайські дорами (C-drama)",
                    "url": "discover/tv",
                    "params": {
                        "with_original_language": "zh",
                        "with_genres": "18",
                        "without_genres": "16",
                        "sort_by": "popularity.desc",
                        "vote_count.gte": "20"
                    }
                },

                {
                    "title": "Японські дорами (J-drama)",
                    "url": "discover/tv",
                    "params": {
                        "with_original_language": "ja",
                        "with_genres": "18",
                        "without_genres": "16",
                        "sort_by": "popularity.desc"
                    }
                },

                {
                    "title": "Дорами на Viki / Rakuten",
                    "url": "discover/tv",
                    "params": {
                        "with_watch_providers": "126",
                        "watch_region": "UA",
                        "without_genres": "16",
                        "sort_by": "popularity.desc"
                    }
                },

                // ────────────────────────────────────────────────
                // Китайські донхуа (анімація)
                // ────────────────────────────────────────────────

                {
                    "title": "Нові китайські донхуа",
                    "url": "discover/tv",
                    "params": {
                        "with_original_language": "zh",
                        "with_genres": "16",
                        "sort_by": "first_air_date.desc",
                        "first_air_date.lte": "{current_date}",
                        "vote_count.gte": "5"
                    }
                },

                {
                    "title": "Популярні китайські донхуа",
                    "url": "discover/tv",
                    "params": {
                        "with_original_language": "zh",
                        "with_genres": "16",
                        "sort_by": "popularity.desc",
                        "vote_count.gte": "10"
                    }
                }
            ]
        }
    };

    // ────────────────────────────────────────────────
    // Компоненти (без змін)
    // ────────────────────────────────────────────────

    function DoramaMain(object) {
        var comp = new Lampa.InteractionMain(object);
        var config = DORAMA_CONFIG[object.service_id];

        comp.create = function () {
            var _this = this;
            this.activity.loader(true);
            var categories = config.categories;
            var network = new Lampa.Reguest();
            var status = new Lampa.Status(categories.length);

            status.onComplite = function () {
                var fulldata = [];
                Object.keys(status.data).sort(function (a, b) { return a - b; }).forEach(function (key) {
                    var data = status.data[key];
                    if (data && data.results && data.results.length) {
                        var cat = categories[parseInt(key)];
                        Lampa.Utils.extendItemsParams(data.results, { style: { name: 'wide' } });
                        fulldata.push({
                            title: cat.title,
                            results: data.results,
                            url: cat.url,
                            params: cat.params,
                            service_id: object.service_id
                        });
                    }
                });

                if (fulldata.length) {
                    _this.build(fulldata);
                    _this.activity.loader(false);
                } else {
                    _this.empty();
                }
            };

            categories.forEach(function (cat, index) {
                var params = [];
                params.push('api_key=' + Lampa.TMDB.key());
                params.push('language=' + Lampa.Storage.get('language', 'uk'));

                if (cat.params) {
                    for (var key in cat.params) {
                        var val = cat.params[key];
                        if (val === '{current_date}') {
                            var d = new Date();
                            val = [d.getFullYear(), ('0' + (d.getMonth() + 1)).slice(-2), ('0' + d.getDate()).slice(-2)].join('-');
                        }
                        params.push(key + '=' + val);
                    }
                }

                var url = Lampa.TMDB.api(cat.url + '?' + params.join('&'));

                network.silent(url, function (json) {
                    status.append(index.toString(), json);
                }, function () {
                    status.error();
                });
            });

            return this.render();
        };

        comp.onMore = function (data) {
            Lampa.Activity.push({
                url: data.url,
                params: data.params,
                title: data.title,
                component: 'dorama_view',
                page: 1
            });
        };

        return comp;
    }

    function DoramaView(object) {
        var comp = new Lampa.InteractionCategory(object);
        var network = new Lampa.Reguest();

        function buildUrl(page) {
            var params = [];
            params.push('api_key=' + Lampa.TMDB.key());
            params.push('language=' + Lampa.Storage.get('language', 'uk'));
            params.push('page=' + page);

            if (object.params) {
                for (var key in object.params) {
                    var val = object.params[key];
                    if (val === '{current_date}') {
                        var d = new Date();
                        val = [d.getFullYear(), ('0' + (d.getMonth() + 1)).slice(-2), ('0' + d.getDate()).slice(-2)].join('-');
                    }
                    params.push(key + '=' + val);
                }
            }
            return Lampa.TMDB.api(object.url + '?' + params.join('&'));
        }

        comp.create = function () {
            var _this = this;
            network.silent(buildUrl(1), function (json) {
                _this.build(json);
            }, this.empty.bind(this));
        };

        comp.nextPageReuest = function (object, resolve, reject) {
            network.silent(buildUrl(object.page), resolve, reject);
        };

        return comp;
    }

    // ────────────────────────────────────────────────
    // Запуск та ін’єкція в меню
    // ────────────────────────────────────────────────

    function startPlugin() {
        if (window.plugin_dorama_ready) return;
        window.plugin_dorama_ready = true;

        Lampa.Component.add('dorama_main', DoramaMain);
        Lampa.Component.add('dorama_view', DoramaView);

        if (!$('#dorama-css').length) {
            $('body').append(`
                <style id="dorama-css">
                    .dorama_main .card--wide { width: 18.3em !important; }
                    .dorama_view .card--wide  { width: 18.3em !important; }
                    .dorama_view .category-full { padding-top: 1em; }
                </style>
            `);
        }

        function addMenuButton() {
            var menu = $('.menu .menu__list').eq(0);
            if (!menu.length) return;

            if (menu.find('.menu__item[data-sid="dorama"]').length) return;

            var btn = $(`<li class="menu__item selector" data-action="dorama_action" data-sid="dorama">
                <div class="menu__ico">${DORAMA_CONFIG.dorama.icon}</div>
                <div class="menu__text">${DORAMA_CONFIG.dorama.title}</div>
            </li>`);

            btn.on('hover:enter', function () {
                Lampa.Activity.push({
                    title: DORAMA_CONFIG.dorama.title,
                    component: 'dorama_main',
                    service_id: 'dorama',
                    page: 1
                });
            });

            menu.append(btn);
        }

        if (window.appready) {
            addMenuButton();
        } else {
            Lampa.Listener.follow('app', function (e) {
                if (e.type == 'ready') addMenuButton();
            });
        }

        setInterval(function () {
            if (window.appready && $('.menu .menu__list').eq(0).length) {
                addMenuButton();
            }
        }, 4000);
    }

    if (!window.plugin_dorama_ready) startPlugin();
})();
