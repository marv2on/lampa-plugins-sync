(function () {
    'use strict';

    if (!window.Lampa) return;

    const KEY = 'anti_ru_enabled';

    const RU_PATTERNS = [
        'ru', 'rus', 'russian',
        'рус', 'русский'
    ];

    const UA_PATTERNS = [
        'ua', 'ukr', 'ukrainian',
        'укр', 'україн'
    ];

    function isRU(track) {
        const name = (track.label || track.lang || '').toLowerCase();
        return RU_PATTERNS.some(p => name.includes(p));
    }

    function isUA(track) {
        const name = (track.label || track.lang || '').toLowerCase();
        return UA_PATTERNS.some(p => name.includes(p));
    }

    function enabled() {
        return Lampa.Storage.get(KEY, true);
    }

    // 🔘 перемикач у налаштуваннях
    Lampa.Settings.add({
        title: 'Anti-RU',
        description: 'Прибирати RU озвучку та віддавати пріоритет UA',
        setting: {
            name: KEY,
            type: 'toggle',
            default: true
        }
    });

    // 🎧 обробка аудіодоріжок
    Lampa.Listener.follow('player_tracks', function (event) {
        if (!enabled()) return;
        if (!event || !event.tracks || !Array.isArray(event.tracks.audio)) return;

        event.tracks.audio = event.tracks.audio.filter(track => !isRU(track));

        const uaTrack = event.tracks.audio.find(isUA);
        if (uaTrack) {
            event.tracks.audio.forEach(t => t.selected = false);
            uaTrack.selected = true;
        }
    });

    console.log('🇺🇦 Anti-RU loaded');
})();