(function () {
  'use strict';

  var Storage = Lampa.Storage;

  var config = {
    version: '1.0.0',
    menu_sort_items: [
      "Главная",
      "Избранное",
      "История",
      "IPTV",
      "Торренты",
      "NUMParser",
      "LNUM",
      "Лента",
      "Фильмы",
      "Сериалы",
      "Мультфильмы",
      "Аниме",
      "Каталог",
      "Релизы",
      "Расписание",
      "В качестве",
      // "Спорт",
      "Подписки"
      // "TraktTV",
      // "Персоны",
      // "Фильтр",
      // "Коллекции",
      // "Shots"
    ],
    menu_hide_items: [
      "Персоны",
      "Фильтр",
      "Коллекции",
      "Shots"
    ]
  }

  function init() {
    console.log('Menu Plugin', 'Configuration plugin loaded, version:', config.version);
    Storage.set('menu_sort', config.menu_sort_items);
    Storage.set('menu_hide', config.menu_hide_items);
    console.log('Menu Plugin', 'All configurations applied successfully');
  }

  if (window.appready) {
    init();
  } else {
    Lampa.Listener.follow('app', function (event) {
      if (event.type === 'ready') {
        init();
      }
    });
  }

})();
