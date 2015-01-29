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

  Drupal.behaviors.edoweb_view = {
    attach: function (context, settings) {

      $('.edoweb.entity.default', context).each(function() {
        // Load entities into table
        Drupal.edoweb.entity_table($(this).find('.field-type-edoweb-ld-reference .field-items'));
      });

      // Process result listing tables
      $('table', context).not('.field-multiple-table').each(function() {
        Drupal.edoweb.hideEmptyTableColumns($(this));
        Drupal.edoweb.hideTableHeaders($(this));
      });

      // Load entity-labels in facet list
      $(context).find('*[data-curie].facet').each(function() {
        Drupal.edoweb.entity_label($(this));
      });

      // Live search result updates
      var delay = (function() {
        var timer;
        return function(callback, ms) {
          clearTimeout (timer);
          timer = setTimeout(callback, ms);
        };
      })();
      $(context).find('.edoweb_live_search').bind('keyup', function() {
        var trigger_button = $(this).parent().nextAll('input[type=submit]');
        for (var i = 0; i < Drupal.edoweb.pending_requests.length; i++) {
          Drupal.edoweb.pending_requests[i].abort();
        }
        delay(function() {
          trigger_button.click();
        }, 1000);
      });

    }

  };

})(jQuery);
