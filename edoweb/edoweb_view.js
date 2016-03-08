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

      $('.field-name-field-edoweb-collected-by').hide();
/*
      $('.edoweb.entity.default', context).each(function() {
        // Load entities into table
        Drupal.edoweb.entity_table($(this)
          .find('.field-type-edoweb-ld-reference:not(.field-name-field-edoweb-struct-child) .field-items')
        );
        Drupal.edoweb.entity_table($(this)
          .find('.field-type-edoweb-ld-reference.field-name-field-edoweb-struct-child .field-items'),
            null, 'compact'
        );
      });
*/
      // Process result listing tables
      $('table', context).not('.field-multiple-table').each(function() {
        Drupal.edoweb.hideEmptyTableColumns($(this));
        Drupal.edoweb.hideTableHeaders($(this));
      });

      // Load entity-labels in facet list
      $('a[data-curie]', context).add($('span[data-curie]', context)).not('.resolved').not('.edoweb.download').each(function() {
        Drupal.edoweb.entity_label($(this));
      });

      // Resolve last modified child object label
      Drupal.edoweb.last_modified_label(context);

      // Sort & load listnav
      $('ul.listnav', context).each(function() {
        var listnav = $(this);
        var listitems = listnav.children('li').get();
        listitems.sort(function(a, b) {
           return $(a).text().toUpperCase().localeCompare($(b).text().toUpperCase());
        })
        $.each(listitems, function(idx, itm) { listnav.append(itm); });
        $(this).listnav();
      });

    }

  };

})(jQuery);
