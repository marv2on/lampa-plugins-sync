(function() {
    'use strict';

    // Список плагинов для блокировки
    var blockedPlugins = [

    ];

    // Перехватываем putScriptAsync
    if (window.Lampa && window.Lampa.Utils && window.Lampa.Utils.putScriptAsync) {
        var originalPutScriptAsync = window.Lampa.Utils.putScriptAsync;
        
        window.Lampa.Utils.putScriptAsync = function(urls, onLoad, onError, onFinally, async) {
            // Если urls это массив
            if (Array.isArray(urls)) {
                // Фильтруем заблокированные плагины
                urls = urls.filter(function(url) {
                    var isBlocked = blockedPlugins.some(function(blocked) {
                        return url.indexOf(blocked) !== -1;
                    });
                    
                    if (isBlocked) {
                        console.log('[Block Plugins] Заблокирован плагин:', url);
                        return false;
                    }
                    return true;
                });
            }
            
            // Вызываем оригинальную функцию с отфильтрованным списком
            return originalPutScriptAsync.call(this, urls, onLoad, onError, onFinally, async);
        };
        
        console.log('[Block Plugins] Плагин активирован. Заблокированы:', blockedPlugins);
    }

    // Также перехватываем putScript на всякий случай
    if (window.Lampa && window.Lampa.Utils && window.Lampa.Utils.putScript) {
        var originalPutScript = window.Lampa.Utils.putScript;
        
        window.Lampa.Utils.putScript = function(urls, onLoad, onError, onFinally, async) {
            // Если urls это массив
            if (Array.isArray(urls)) {
                // Фильтруем заблокированные плагины
                urls = urls.filter(function(url) {
                    var isBlocked = blockedPlugins.some(function(blocked) {
                        return url.indexOf(blocked) !== -1;
                    });
                    
                    if (isBlocked) {
                        console.log('[Block Plugins] Заблокирован плагин:', url);
                        return false;
                    }
                    return true;
                });
            }
            
            // Вызываем оригинальную функцию с отфильтрованным списком
            return originalPutScript.call(this, urls, onLoad, onError, onFinally, async);
        };
    }

})();
