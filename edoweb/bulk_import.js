/**
 * Copyright 2013 hbz NRW (http://www.hbz-nrw.de/)
 *
 * This file is part of regal-drupal.
 *
 * regal-drupal is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * regal-drupal is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with regal-drupal.  If not, see <http://www.gnu.org/licenses/>.
 */

(function($) {

  Drupal.behaviors.bulk_import = {
    attach: function (context, settings) {
      $('div.form-item-from').hide();
      $('div.form-item-to').hide();
      var from = 0;
      var to = 10;
      $('form#edoweb-bulk-import-form').submit(function(event) {
        var message = $('<div />').addClass('messages warning');
        $("form#edoweb-bulk-import-form").after(message);
        $('input#edit-from').val(from);
        $('input#edit-to').val(to);
        message.html('<p>Fetching entities ' + from + ' until ' + to + '</p>');
        $.post($(this).attr('action'), $(this).serialize(), function(json) {
          message.removeClass('warning').addClass('status');
          if (json.length > 0) {
            message.html('<p>Imported ' + json.join(', ') + '</p>');
            from += 10;
            to += 10;
            $('form#edoweb-bulk-import-form').submit();
          } else {
            message.html('<p>Done!</p>');
          }
        }, 'json');
        return false;
      });
    }
  };

})(jQuery);

