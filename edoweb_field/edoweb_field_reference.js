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

  Drupal.behaviors.edoweb_field_reference = {
    attach: function (context, settings) {
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

      // Tooltips
      $(context).find('form#edoweb-basic-form div.description').each(function() {
        var tooltip_icon = $('<img />')
          .attr('src', Drupal.settings.edoweb_field.basePath + '/tooltip.svg')
          .attr('title', $(this).text())
          .css('height', '1em');
        $(this).prevAll('label').append(tooltip_icon);
        $(this).remove();
      });

      // Attach lookup overlay to form
      var modal_overlay = $('<div />').dialog({
        position: 'center',
        autoOpen: false,
        modal: true,
        //resizable: false,
        width: 'auto'
      });

      $(context).find('.field-type-edoweb-ld-reference').each(function() {
        var source = $(this);
        // Prevent multiple behaviour attach
        if (source.hasClass('edoweb-field-behaviour-attached')) return false;
        source.addClass('edoweb-field-behaviour-attached');
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
          modal_overlay.html('<div />');
          refreshTable(modal_overlay, source);
          modal_overlay.dialog('open');
          return false;
        });
        source.find('label').append(button);
      });

      // Group lookup fieldsets by group name
      var field_groups = {};
      $(context).find('input.edoweb_autocomplete_widget[data-field-group]').each(function() {
        // Prevent multiple behaviour attach
        if ($(this).hasClass('edoweb-field-behaviour-attached')) return false;
        $(this).addClass('edoweb-field-behaviour-attached');
        var field_group = $(this).attr('data-field-group');
        var source_widget = $(this).closest('.field-widget-edoweb-autocomplete-widget');
        if (field_groups[field_group]) {
          field_groups[field_group].push(source_widget);
        } else {
          field_groups[field_group] = [source_widget];
        }
      });

      $.each(field_groups, function (field_group, source_widgets) {
        var insert_position = source_widgets[0].prev();
        var group_fieldset = $('<div><label>' + field_group + ': <select /></label></div>');
        var select = group_fieldset.find('select');
        select.change(function() {
          $.each(source_widgets, function(i, source_widget) {
            source_widget.hide();
            select.nextAll('span').hide();
          });
          $(select.nextAll('span').get(this.selectedIndex)).show();
          source_widgets[this.selectedIndex].show();
        });
        $.each(source_widgets, function(i, source_widget) {
          var focus_link = source_widget.find('a[name="focus"]').first();
          group_fieldset.find('select').append($('<option>' + source_widget.find('label').get(0).childNodes[0].data + '</option>'));
          if (focus_link.length > 0) {
            group_fieldset.prepend(focus_link);
            select.get(0).selectedIndex = i;
          }
          var meta = $('<span />');
          meta.append(source_widget.find('label img'));
          meta.append(source_widget.find('label a'));
          source_widget.find('label').remove();
          select.closest('label').append(meta.hide());
          group_fieldset.append(source_widget.hide());
        });
        insert_position.after(group_fieldset);
        $(select.nextAll('span').get(select.get(0).selectedIndex)).show();
        source_widgets[select.get(0).selectedIndex].show();
      });

      // Live search result updates
      var delay = (function(){
        var timer = 0;
        return function(callback, ms) {
          clearTimeout (timer);
          timer = setTimeout(callback, ms);
        };
      })();
      $(context).find('.edoweb_live_search').bind('keypress', function() {
        var trigger_button = $(this).parent().next('input');
        delay(function() {
          trigger_button.click();
        }, 300);
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
        console.log(status);
      },
      success: function(data, status, request) {
        var html = $(data);

        html.find('a[data-bundle]').each(function() {

          if (!('person' == this.getAttribute('data-bundle'))
              && !('corporate_body' == this.getAttribute('data-bundle')))
          {
            $(this).remove();
            return false;
          }

          $(this).bind('click', function(e) {
            var url = Drupal.settings.basePath + '?q=edoweb_entity_add/edoweb_basic/' + this.getAttribute('data-bundle');
            $.get(url, function(data) {
              var form = $(data);
              // TODO: implement unlimited nesting, i.e. allow modal
              // dialog over modal dialog
              form.find('.field-type-edoweb-ld-reference').remove();
              form.submit(function(e) {
                var post_data = $(this).serializeArray();
                // Need to set this manually so that Drupal detects the
                // proper triggering element!
                post_data.push({name: 'save', value: 'Save'})
                var form_url = $(this).attr('action');
                $.post(form_url, post_data, function(data, textStatus, jqXHR) {
                  var resource_uri = jqXHR.getResponseHeader('X-Edoweb-Entity');
                  container.dialog('close');
                  source.find('input.edoweb_autocomplete_widget').val(resource_uri);
                  source.find('input[type="submit"]').click();
                });
                return false;
              });
              container.html(form);
              Drupal.attachBehaviors(container);
            });
            return false;
          });
        });

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
              container.dialog('close');
              var resource_uri = row.children('td').first().children('a').first().text();
              source.find('input.edoweb_autocomplete_widget').val(resource_uri);
              source.find('input[type="submit"]').click();
              return false;
            });
        });

        Drupal.attachBehaviors(container);

      }
    });
  }

})(jQuery);

