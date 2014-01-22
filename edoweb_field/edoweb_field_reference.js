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

  Drupal.behaviors.edoweb_field_reference = {
    attach: function (context, settings) {
      $(context).find('fieldset.edoweb_ld_reference').find('a.fieldset-title').bind('click', function(event) {
        var title = event.target;
        var link = $(title).closest('fieldset').children('div.fieldset-wrapper').children('input[type=hidden]').get(0);
        if (link) {
          var throbber = $('<div class="ajax-progress"><div class="throbber">&nbsp;</div></div>')
          $(title).after(throbber);
          entity_render_view('edoweb_basic', link.value).onload = function () {
            if (this.status == 200) {
              var entity_view = $(this.responseText);
              $(link).replaceWith(entity_view);
              Drupal.attachBehaviors(entity_view);
            }
            throbber.remove();
          };
        }
      });
    }
  };

})(jQuery);

