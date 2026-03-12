(function () {
  'use strict';

  var Listener = Lampa.Listener;

  var config = {
    version: '3.0.0',
  };

  function init() {
    console.log('NoTrailers', 'Configuration plugin loaded, version:', config.version);

    Listener.follow('full', function (e) {
      if (e.type === 'complite') {
        try {
          var trailerElement = e.object.activity.render().find('.view--trailer');

          if (trailerElement && trailerElement.length) {
            trailerElement.remove();
            console.log('NoTrailers', 'Trailer button removed successfully');
          } else {
            console.log('NoTrailers', 'Trailer button not found');
          }
        } catch (error) {
          console.error('NoTrailers', 'Error hiding trailer button:', error.message);
        }
      }
    });

    console.log('NoTrailers', 'Hide trailer button initialized');
  }

  init();

})();
