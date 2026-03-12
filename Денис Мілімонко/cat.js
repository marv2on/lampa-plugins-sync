(function () {
  "use strict";

  const i18n = {
    uk: {
      netflix: "Netflix",
      netflix_button: "Netflix",
      select_type: "Netflix – Вибери тип",
      sort_title: "Netflix – Сортування",
      top: "Топ",
      new: "Нові",
      movies: "Фільми",
      series: "Серіали"
    },
    en: {
      netflix: "Netflix",
      netflix_button: "Netflix",
      select_type: "Netflix – Select type",
      sort_title: "Netflix – Sort",
      top: "Top",
      new: "New",
      movies: "Movies",
      series: "Series"
    }
  };

  const lang = Lampa.Storage.get('language', 'uk');
  const t = i18n[lang] || i18n.uk;

  function openNetflixActivity(type, sort) {
    let url = "";
    let title = t.netflix;

    if (type === "movie") {
      url = `discover/movie?language=ua&with_watch_providers=8&watch_region=UA`;
      title += ` – ${t.movies}`;
    } else {
      url = `discover/tv?language=ua&with_networks=213`;
      title += ` – ${t.series}`;
    }

    const isNew = sort === "first_air_date.desc" || sort === "primary_release_date.desc";

    if (isNew) {
      url += "&vote_count.gte=300";
      title += ` – ${t.new}`;
    } else {
      title += ` – ${t.top}`;
    }

    if (sort) url += `&sort_by=${sort}`;

    Lampa.Activity.push({
      url: url,
      title: title,
      component: "category_full",
      source: "tmdb",
      card_type: "true",
      page: 1
    });
  }

  function showNetflixSortFilter(type) {
    const sortItems = [
      { title: t.top, value: "" },
      { title: t.new, value: type === "movie" ? "primary_release_date.desc" : "first_air_date.desc" }
    ];

    Lampa.Select.show({
      title: t.sort_title,
      items: sortItems,
      no_scroll: true,
      onSelect: (selected) => openNetflixActivity(type, selected.value)
    });
  }

  function showNetflixTypeFilter() {
    Lampa.Select.show({
      title: t.select_type,
      items: [
        { title: t.series, value: "tv" },
        { title: t.movies, value: "movie" }
      ],
      no_scroll: true,
      onSelect: (selected) => showNetflixSortFilter(selected.value)
    });
  }

  function addMenuItem(title, id, onClick) {
    const ITEM_TV_SELECTOR = '[data-action="tv"]';
    const ITEM_MOVE_TIMEOUT = 2000;

    const moveItemAfter = function moveItemAfter(item, after) {
      return setTimeout(function () {
        const menuRoot = Lampa.Menu.render();
        if (menuRoot.length) {
          const $after = menuRoot.find(after);
          const $item = $(item);
          if ($after.length && $item.length) {
            $after.after($item);
          }
        }
      }, ITEM_MOVE_TIMEOUT);
    };

    function tryAppend() {
      const menuList = $(".menu .menu__list").eq(0);

      if (menuList.length) {
        const item = $(`
          <li class="menu__item selector" data-action="${id}">
            <div class="menu__ico">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
                <path fill="currentColor" d="M84 0v512h88V308l88 204h88V0h-88v204l-88-204z"/>
              </svg>
            </div>
            <div class="menu__text">${title}</div>
          </li>
        `);
        item.on("hover:enter", onClick);
        menuList.append(item);
        moveItemAfter(`[data-action="${id}"]`, ITEM_TV_SELECTOR);
      } else {
        setTimeout(tryAppend, 300);
      }
    }

    tryAppend();
  }

  function init() {
    if (window.netflix_enhanced_ready) return;

    const raw = Lampa.Storage.get("netflix_enhanced_entry");
    const enabled = raw === true || raw === "true";

    if (enabled) addMenuItem(t.netflix, "netflix_main", showNetflixTypeFilter);

    // Settings
    Lampa.SettingsApi.addComponent({
      component: "netflix_enhanced",
      name: "Netflix",
      icon: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><path fill="currentColor" d="M84 0v512h88V308l88 204h88V0h-88v204l-88-204z"/></svg>'
    });

    Lampa.SettingsApi.addParam({
      component: "netflix_enhanced",
      param: {
        name: "netflix_enhanced_entry",
        type: "trigger",
        default: false
      },
      field: {
        name: t.netflix_button
      },
      onChange: function (value) {
        const normalized = value === true || value === "true";
        const existing = $(`[data-action='netflix_main']`);
        if (normalized) {
          if (!existing.length) addMenuItem(t.netflix, "netflix_main", showNetflixTypeFilter);
        } else {
          existing.remove();
        }
      }
    });

    window.netflix_enhanced_ready = true;
  }

  if (window.appready) init();
  else {
    Lampa.Listener.follow("app", function (e) {
      if (e.type === "ready") init();
    });

    setTimeout(() => {
      if (!window.netflix_enhanced_ready) init();
    }, 1000);
  }
})();
