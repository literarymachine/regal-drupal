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

  /**
   * Function returns an entities label.
   */
  function entity_label(entity_type, entity_id) {
    return (function ($) {
      return $.get(Drupal.settings.basePath + 'edoweb_entity_label/' + entity_type + '/' + entity_id);
    })(jQuery);
  }

  /**
   * Function returns an entities label.
   */
  function entity_list(entity_type, entity_curies) {
    return $.get(Drupal.settings.basePath + 'edoweb_entity_list/' + entity_type + '?' + $.param({ids: entity_curies}));
  }

  var attached = false;
  Drupal.behaviors.edoweb_field_reference = {
    attach: function (context, settings) {
      if (attached) return;
      attached = true;
      // Load entity into fieldset
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

      // Load labels for Linked Data References
      $(context).find('a[data-curie]').each(function() {
        var link = $(this);
        entity_label('edoweb_basic', link.attr('data-curie')).onload = function() {
          if (this.status == 200) {
            link.text(this.responseText);
          }
        };
      });

      // Attach lookup overlay to form
      var lookup_overlay = $('<div />').dialog({
        autoOpen: false,
        //resizable: false,
        width: 'auto'
      });

      $(context).find('.field-type-edoweb-ld-reference').each(function() {
        var source = $(this);
        // Hide input elements
        source.find('input.edoweb_autocomplete_widget').hide();
        source.find('input[type="submit"]').hide();
        // Hide value elements, display AJAX entity list
        var curies = [];
        source.find('input[data-curie]').each(function() {
          var input = $(this);
          var curie = input.attr('data-curie');
          input.hide();
          if (curie != '') curies.push(curie);
        });

        if (curies.length > 0) {
          var throbber = $('<div class="ajax-progress"><div class="throbber">&nbsp;</div></div>')
          $(source).append(throbber);
          entity_list('edoweb_basic', curies).onload = function () {
            if (this.status == 200) {
              var result_table = $(this.responseText);
              result_table.find('tbody > tr').each(function() {
                var row = $(this);
                $(this).children('td').last()
                  .append('<button>Entfernen</button>')
                  .bind('click', function(event) {
                    source.find('input[data-curie="' + row.attr('data-curie') + '"]').val('');
                    if (row.next().length == 0 && row.prev().length == 0) {
                      row.closest('table').remove();
                    } else {
                      row.remove();
                    }
                    return false;
                  });
              });
              source.append(result_table);
              throbber.remove();
            }
          };
        }

        // Open lookup overlay
        var button = $('<a href="#"> [+]</a>').click(function(e) {
          lookup_overlay.html('<div />');
          refreshTable(lookup_overlay, source);
          lookup_overlay.dialog('open');
          return false;
        });
        source.find('label').append(button);
      });
    }
  };

function refreshTable(container, source, page, sort, order, term) {
  if(!page) page = 0;
  if(!sort) sort = '';
  if(!order) order = '';
  if(!term) term = '';

  var bundle_name = source.find('input.edoweb_autocomplete_widget').attr('data-bundle');
  var field_name = source.find('input.edoweb_autocomplete_widget').attr('data-field');
  var qurl = Drupal.settings.basePath + '?q=edoweb/search/' + bundle_name + '/' + field_name;

  jQuery.ajax({
    cache: false,
    url: qurl,
    data: {page: page, sort: sort, order: order, 'query[0][term]': term},
    dataType: 'text',
    error: function(request, status, error) {
      alert(status);
    },
    success: function(data, status, request) {
      var html = data;

      container.html(html);

      container.find('th a')
        .add(container.find('.pager-item a'))
        .add(container.find('.pager-first a'))
        .add(container.find('.pager-previous a'))
        .add(container.find('.pager-next a'))
        .add(container.find('.pager-last a'))
          .click(function(el, a, b, c) {
            var url = jQuery.url(el.currentTarget.getAttribute('href'));
            refreshTable(container, source, url.param('page'), url.param('sort'), url.param('order'), url.param('query[0][term]'));
            return (false);
          });

      container.find('input[name="op"]').click(function() {
        var term = container.find('input[type="text"]').val();
        refreshTable(container, source, null, null, null, term);
        return false;
      });

      container.find('.sticky-enabled > tbody > tr').each(function() {
        var row = jQuery(this);
        jQuery(this).children('td').last()
          .append('<button>Hinzufügen</button>')
          .bind('click', function(event) {
            var resource_uri = row.children('td').first().children('a').first().text();
            source.find('input.edoweb_autocomplete_widget').val(resource_uri);
            source.find('input[type="submit"]').click();
            container.dialog('close');
            return false;
          });
      });

      Drupal.attachBehaviors(container);

    }
  });
}

})(jQuery);

