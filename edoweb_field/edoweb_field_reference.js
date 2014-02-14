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
      $(context).find('fieldset.edoweb_ld_reference').find('a.fieldset-title').each(function(i, element) {
        var link = $(element).closest('fieldset').children('div.fieldset-wrapper').children('input[type=hidden]').get(0);
        if (link) {
          var throbber = $('<div class="ajax-progress"><div class="throbber">&nbsp;</div></div>')
          $(element).after(throbber);
          entity_render_view('edoweb_basic', link.value).onload = function () {
            if (this.status == 200) {
              var entity_view = $(this.responseText);
              $(element).text($.trim(entity_view.find('h2').text()) + ' (' + link.value + ')');
              var download_link = entity_view.find('div[property="regal:hasData"]').children('a').clone();
              if (download_link.get(0)) {
                var mime_type = entity_view.find('div[property="dc:format"]').text().split('/')[1];
                var icon = $('<img />')
                  .attr('src', Drupal.settings.edoweb_field.basePath + '/' + mime_type + '.svg')
                  .css('height', '1em');
                $(element).siblings(":last").after(download_link.text('Download ').append(icon));
              }
              $(link).replaceWith(entity_view);
              $(element).bind('click', function(event) {
                Drupal.attachBehaviors(entity_view);
                $(element).unbind(event);
              });
            }
            throbber.remove();
          };
        }
      });
    }
  };

})(jQuery);

