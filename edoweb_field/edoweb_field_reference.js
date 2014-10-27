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
  function entity_label(element) {
    var entity_type = 'edoweb_basic';
    var entity_id = element.attr('data-curie');
    if (cached_label = localStorage.getItem(entity_id)) {
      element.text(cached_label);
    } else {
      $.get(Drupal.settings.basePath + 'edoweb_entity_label/' + entity_type + '/' + entity_id).onload = function() {
        var label = this.status == 200 ? this.responseText : entity_id;
        if (this.status == 200) {
          localStorage.setItem(entity_id, label);
        }
        element.text(label);
      };
    }
  }

  /**
   * Function returns an entities label.
   */
  function entity_list(entity_type, entity_curies, columns) {
    return $.get(Drupal.settings.basePath + 'edoweb_entity_list/' + entity_type + '?' + $.param({'ids': entity_curies, 'columns': columns}));
  }

  Drupal.behaviors.edoweb_field_reference = {
    attach: function (context, settings) {

      //TODO: Config to set one of the following three behaviours
      // Load entity into fieldset
      //$(context).find('fieldset.edoweb_ld_reference').find('a.fieldset-title').each(function(i, element) {
      //  var link = $(element).closest('fieldset').children('div.fieldset-wrapper').children('input[type=hidden]').get(0);
      //  if (link) {
      //    var throbber = $('<div class="ajax-progress"><div class="throbber">&nbsp;</div></div>')
      //    $(element).after(throbber);
      //    entity_render_view('edoweb_basic', link.value).onload = function () {
      //      if (this.status == 200) {
      //        var entity_view = $(this.responseText);
      //        $(element).text($.trim(entity_view.find('h2').text()) + ' (' + link.value + ')');
      //        var download_link = entity_view.find('div[property="regal:hasData"]').children('a').clone();
      //        if (download_link.get(0)) {
      //          var mime_type = entity_view.find('div[property="dc:format"]').text().split('/')[1];
      //          var icon = $('<img />')
      //            .attr('src', Drupal.settings.edoweb_field.basePath + '/' + mime_type + '.svg')
      //            .css('height', '1em');
      //          $(element).siblings(":last").after(download_link.text('Download ').append(icon));
      //        }
      //        $(link).replaceWith(entity_view);
      //        $(element).bind('click', function(event) {
      //          Drupal.attachBehaviors(entity_view);
      //          $(element).unbind(event);
      //        });
      //      }
      //      throbber.remove();
      //    };
      //  }
      //});

      $(context).find('table').not('.field-multiple-table').each(function() {
        hideEmptyTableColumns($(this));
        hideTableHeaders($(this));
      });

      // Load entities into table
      //$(context).find('.field-type-edoweb-ld-reference .field-items').each(function() {
      //  var container = $(this);
      //  var curies = [];
      //  container.find('a[data-curie]').each(function() {
      //    curies.push(this.getAttribute('data-curie'));
      //  });
      //  var columns = container.find('a[data-target-bundle]')
      //    .attr('data-target-bundle')
      //    .split(' ')[0];
      //  if (curies.length > 0) {
      //    var throbber = $('<div class="ajax-progress"><div class="throbber">&nbsp;</div></div>')
      //    container.before(throbber);
      //    entity_list('edoweb_basic', curies, columns).onload = function () {
      //      if (this.status == 200) {
      //        var result_table = $(this.responseText).find('table');
      //        result_table.find('a[data-curie][data-target-bundle]').each(function() {
      //          entity_label($(this));
      //        });
      //        result_table.removeClass('sticky-enabled');
      //        result_table.tablesorter({sortList: [[1,1]]});
      //        //TODO: check interference with tree navigation block
      //        //Drupal.attachBehaviors(result_table);
      //        container.replaceWith(result_table);
      //        hideEmptyTableColumns(result_table);
      //        hideTableHeaders(result_table);
      //      }
      //      throbber.remove();
      //    };
      //  }
      //});

      // Load entity-labels in facet list
      $(context).find('*[data-curie].facet').each(function() {
        entity_label($(this));
      });

      // Modify hrefs to point to local data
      $(context).find('a[data-curie]').not('.facet').each(function() {
        var href = Drupal.settings.basePath + 'resource/' + $(this).attr('data-curie');
        $(this).attr('href', href);
      })

      // Tooltips
      //$(context).find('form#edoweb-basic-form div.description').each(function() {
      //  var tooltip_icon = $('<img />')
      //    .attr('src', Drupal.settings.edoweb_field.basePath + '/tooltip.svg')
      //    .attr('title', $(this).text())
      //    .css('height', '1em');
      //  $(this).prevAll('label').append(tooltip_icon);
      //  $(this).remove();
      //});

      // Attach lookup overlay to form
      var modal_overlay = $('<div />').dialog({
        position: [($(window).width() / 2) - (760 / 2), 15],
        autoOpen: false,
        modal: true,
        //resizable: false,
        width: 760
      });

      $(context).find('form .field-name-field-edoweb-identifier-ht').each(function() {
        var source = $(this);
        // Open lookup overlay
        var button = $('<a href="#"> [+]</a>').click(function(e) {
          modal_overlay.html('<div />');
          importTable(modal_overlay, source);
          modal_overlay.dialog('open');
          return false;
        });
        var tooltip_icon = $('<img />')
          .attr('src', Drupal.settings.edoweb_field.basePath + '/tooltip.svg')
          .attr('title', 'Import metadata')
          .css('height', '1em');
        source.find('label').append(tooltip_icon);
        source.find('label').append(button);
      });

      $(context).find('form .field-type-edoweb-ld-reference')
//        .filter(function() {return !($(this).find('input[data-field-group]').length)})
        .each(function() {
        var source = $(this);
        var columns = source
          .find('input[data-target-bundle]')
          .attr('data-target-bundle')
          .split(' ')[0];
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

        var throbber = $('<div class="ajax-progress"><div class="throbber">&nbsp;</div></div>')
        $(source).before(throbber);
        entity_list('edoweb_basic', curies, columns).onload = function () {
          if (this.status == 200) {
            var result_table = $(this.responseText).find('table');
            result_table.find('a[data-curie][data-target-bundle]').each(function() {
              entity_label($(this));
            });
            result_table.find('tbody > tr').each(function() {
              var row = $(this);
              $(this).children('td').last()
                .append('<button>Entfernen</button>')
                .bind('click', function(event) {
                  source.find('input[data-curie="' + row.attr('data-curie') + '"]').val('');
                  row.remove();
                  return false;
                });
            });
            result_table.removeClass('sticky-enabled');
            result_table.tablesorter({sortList: [[1,1]]});
            //TODO: check interference with tree navigation block
            //Drupal.attachBehaviors(result_table);
            source.append(result_table);
            if (curies.length > 0) {
              hideEmptyTableColumns(result_table);
              hideTableHeaders(result_table);
            } else {
              var cols = result_table.find('th').length;

              result_table.find('tbody')
                .append($('<tr />').append($('<td colspan="' + cols + '" />').append(
                $(source).find('.edoweb_autocomplete_widget_note').parent()
              )));
            }
          }
          throbber.remove();
        };

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
      //var field_groups = {};
      //$(context).find('input.edoweb_autocomplete_widget[data-field-group]').each(function() {
      //  // Prevent multiple behaviour attach
      //  if ($(this).hasClass('edoweb-field-behaviour-attached')) return false;
      //  $(this).addClass('edoweb-field-behaviour-attached');
      //  var field_group = $(this).attr('data-field-group');
      //  var source_widget = $(this).closest('.field-widget-edoweb-autocomplete-widget');
      //  if (field_groups[field_group]) {
      //    field_groups[field_group].push(source_widget);
      //  } else {
      //    field_groups[field_group] = [source_widget];
      //  }
      //});

      //$.each(field_groups, function (field_group, source_widgets) {
      //  var insert_position = source_widgets[0].prev();
      //  // FIXME: make label configurable
      //  var field_group_label = "Mitwirkende";
      //  var group_fieldset = $('<fieldset><legend>' + field_group_label + ' </legend><div class="fieldset-wrapper"><label><select /></label></div></fieldset>');
      //  var select = group_fieldset.find('select');
      //  select.change(function() {
      //    $.each(source_widgets, function(i, source_widget) {
      //      source_widget.hide();
      //      select.nextAll('span').hide();
      //    });
      //    $(select.nextAll('span').get(this.selectedIndex)).show();
      //    source_widgets[this.selectedIndex].show();
      //  });
      //  $.each(source_widgets, function(i, source_widget) {
      //    var focus_link = source_widget.find('a[name="focus"]').first();
      //    group_fieldset.find('select').append($('<option>' + source_widget.find('label').get(0).childNodes[0].data + '</option>'));
      //    if (focus_link.length > 0) {
      //      group_fieldset.prepend(focus_link);
      //      select.get(0).selectedIndex = i;
      //    }
      //    var meta = $('<span />');
      //    meta.append(source_widget.find('label img'));
      //    meta.append(source_widget.find('label a'));
      //    source_widget.find('label').remove();
      //    select.closest('label').append(meta.hide());
      //    group_fieldset.find('div.fieldset-wrapper').append(source_widget.hide());
      //  });
      //  insert_position.after(group_fieldset);
      //  $(select.nextAll('span').get(select.get(0).selectedIndex)).show();
      //  source_widgets[select.get(0).selectedIndex].show();
      //});

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
        for (var i = 0; i < pending_requests.length; i++) {
          pending_requests[i].abort();
        }
        delay(function() {
          trigger_button.click();
        }, 1000);
      });

      if ($('#edoweb-basic-form').length) {
        window.location.hash = 'focus';
      }
    }

  };

  var pending_requests = [];
  function importTable(container, source, page, sort, order, term, type) {
    if(!page) page = 0;
    if(!sort) sort = '';
    if(!order) order = '';
    if(!term) term = '';
    if(!type) type = '';

    var bundle_name = source.closest('form[data-bundle]').attr('data-bundle');
    var qurl = Drupal.settings.basePath + '?q=edoweb/search/' + bundle_name;

    var params = {
      page: page,
      sort: sort,
      order: order,
      'query[0][term]': term,
      'query[0][type]': type,
    };

    var throbber = $('<div class="ajax-progress"><div class="throbber">&nbsp;</div></div>')
    container.find('input[type="text"]').after(throbber);

    var request = jQuery.ajax({
      cache: false,
      url: qurl,
      data: params,
      dataType: 'text',
      error: function(request, status, error) {
        throbber.remove();
        //console.log(status);
      },
      success: function(data, status, request) {
        throbber.remove();
        var html = $(data);
        html.find('a[data-bundle]').remove();

        var type_selector = html.find('input[type=radio]');
        if (type_selector.length == 1) {
          type_selector.parent().hide();
        }
        type_selector.bind('change', function() {
          $(this).closest('form').find('input[name="op"]').click();
        });

        container.html(html);

        container.find('input[name="op"]').click(function() {
          var term = container.find('input[type="text"]').val();
          var target_type = $(this).closest('form').find('input[type=radio]:checked').first().val();
          importTable(container, source, null, null, null, term, target_type);
          return false;
        });

        container.find('th a')
          .add(container.find('.pager-item a'))
          .add(container.find('.pager-first a'))
          .add(container.find('.pager-previous a'))
          .add(container.find('.pager-next a'))
          .add(container.find('.pager-last a'))
            .click(function(el, a, b, c) {
              var url = jQuery.url(el.currentTarget.getAttribute('href'));
              var target_type = container.find('input[type=radio]:checked').first().val();
              importTable(container, source, url.param('page'), url.param('sort'), url.param('order'), url.param('query[0][term]'), target_type);
              return (false);
            });

        container.find('.sticky-enabled > tbody > tr').each(function() {
          var row = jQuery(this);
          jQuery(this).children('td').last()
            .append('<button>Importieren</button>')
            .bind('click', function(event) {
              container.dialog('close');
              var resource_uri = row.children('td').first().children('a').first().text();
              window.onbeforeunload = function(){};
              window.location.replace(window.location.pathname + '?source=' + resource_uri);
              return false;
            });
        });

        hideEmptyTableColumns(container.find('.sticky-enabled'));
        hideTableHeaders(container.find('.sticky-enabled'));
        Drupal.attachBehaviors(container);

      }
    });
    pending_requests.push(request);
  }

  function refreshTable(container, source, page, sort, order, term, type) {
    if(!page) page = 0;
    if(!sort) sort = '';
    if(!order) order = '';
    if(!term) term = '';
    if(!type) type = '';

    var bundle_name = source.find('input.edoweb_autocomplete_widget').attr('data-bundle');
    var field_name = source.find('input.edoweb_autocomplete_widget').attr('data-field');
    var qurl = Drupal.settings.basePath + '?q=edoweb/search/' + bundle_name + '/' + field_name;
    var params = {
      page: page,
      sort: sort,
      order: order,
      'query[0][term]': term,
      'query[0][type]': type,
    };

    var throbber = $('<div class="ajax-progress"><div class="throbber">&nbsp;</div></div>')
    container.find('input[type="text"]').after(throbber);

    var request = jQuery.ajax({
      cache: false,
      url: qurl,
      data: params,
      dataType: 'text',
      error: function(request, status, error) {
        throbber.remove();
        //console.log(status);
      },
      success: function(data, status, request) {
        throbber.remove();
        var html = $(data);

        html.find('a[data-bundle]').each(function() {
          if (!('person' == this.getAttribute('data-bundle'))
              && !('corporate_body' == this.getAttribute('data-bundle')))
          {
            $(this).remove();
          }

          $(this).bind('click', function(e) {
            var url = Drupal.settings.basePath + '?q=edoweb_entity_add/edoweb_basic/' + this.getAttribute('data-bundle');
            $.get(url, function(data) {
              var form = $(data);
              // TODO: implement unlimited nesting, i.e. allow modal
              // dialog over modal dialog
              form.find('.field-type-edoweb-ld-reference').remove();
              form.submit(function(e) {
                var throbber = $('<div class="ajax-progress"><div class="throbber">&nbsp;</div></div>')
                form.append(throbber);
                var post_data = $(this).serializeArray();
                // Need to set this manually so that Drupal detects the
                // proper triggering element!
                post_data.push({name: 'finish', value: 'Fertigstellen'})
                var form_url = $(this).attr('action');
                $.post(form_url, post_data, function(data, textStatus, jqXHR) {
                  throbber.remove();
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

        var type_selector = html.find('input[type=radio]');
        if (type_selector.length == 1) {
          type_selector.parent().hide();
        }
        type_selector.bind('change', function() {
          $(this).closest('form').find('input[name="op"]').click();
        });

        container.html(html);

        container.find('a[data-curie][data-target-bundle]').each(function() {
          entity_label($(this));
        });

        container.find('input[name="op"]').click(function() {
          var term = container.find('input[type="text"]').val();
          var target_type = $(this).closest('form').find('input[type=radio]:checked').first().val();
          refreshTable(container, source, null, null, null, term, target_type);
          return false;
        });

        container.find('th a')
          .add(container.find('.pager-item a'))
          .add(container.find('.pager-first a'))
          .add(container.find('.pager-previous a'))
          .add(container.find('.pager-next a'))
          .add(container.find('.pager-last a'))
            .click(function(el, a, b, c) {
              var target_type = container.find('input[type=radio]:checked').first().val();
              var url = jQuery.url(el.currentTarget.getAttribute('href'));
              refreshTable(container, source, url.param('page'), url.param('sort'), url.param('order'), url.param('query[0][term]'), target_type);
              return (false);
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

        hideEmptyTableColumns(container.find('.sticky-enabled'));
        hideTableHeaders(container.find('.sticky-enabled'));
        Drupal.attachBehaviors(container);

      }
    });
    pending_requests.push(request);
  }

  function hideEmptyTableColumns(table) {
    // Hide table columns that do not contain any data
    table.find('th').each(function(i) {
      var remove = 0;
      var tds = $(this).parents('table').find('tr td:nth-child(' + (i + 1) + ')')
      tds.each(function(j) { if ($(this).text() == '') remove++; });
      if (remove == (table.find('tr').length - 1)) {
          $(this).hide();
          tds.hide();
      }
    });
    // Hide the first table column which contains the ID,
    // move the link to the first visible column
    table.find('th').eq(0).hide();
    table.find('tr[data-curie]').each(function() {
      $(this).find('td').eq(0).hide();
      if ($(this).parents('.ui-dialog').length) {
        var link = $(this).find('td').eq(0).find('a').attr('href');
        var target = "_blank";
      } else {
        var link = Drupal.settings.basePath + 'resource/' + $(this).attr('data-curie');
        var target = "_self";
      }
      var content = $(this).find('td:visible').first().html();
      var link_text = $(content).text() ? content : link;
      $(this).find('td:visible').first().html($('<a target="' + target + '" href="' + link + '">' + link_text + '</a>'));
    });
  }

  function hideTableHeaders(table) {
    if (!(table.parent().hasClass('field-name-field-edoweb-struct-child'))
        && !(table.hasClass('sticky-enabled'))
        && !(table.closest('form').length))
        {
      table.find('thead').hide();
    }
  }

})(jQuery);

