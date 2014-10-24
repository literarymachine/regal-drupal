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

  function compact_uri(uri) {
    var namespaces = Drupal.settings.edoweb.namespaces;
    for (prefix in namespaces) {
      if (uri.indexOf(namespaces[prefix]) == 0) {
        break;
      }
    }
    var local_part = uri.substring(namespaces[prefix].length);
    return prefix + ':' + local_part;
  }

  Drupal.behaviors.edoweb = {
    attach: function (context, settings) {
      var home_href = Drupal.settings.basePath + 'resource';
      if (document.location.pathname == home_href && '' != document.location.search) {
        localStorage.setItem('edoweb_search', document.location.search);
      }
      if (search = localStorage.getItem('edoweb_search')) {
        $('a[href="' + home_href + '"]').attr('href', home_href + search);
      }
      $('input#edit-delete').bind('click', function() {
        return confirm('Möchten Sie den Eintrag unwideruflich löschen?');
      });

      // Attach lookup overlay to page
      var modal_overlay = $('<div />').dialog({
        position: [($(window).width() / 2) - (760 / 2), 15],
        autoOpen: false,
        modal: true,
        //resizable: false,
        width: '80%'
      });

      $('.edoweb.entity', context).each(function() {
        var bundle = $(this).attr('data-entity-bundle');
        var entity = $(this);
        var additional_fields = $('<select><option>Feld hinzufügen</option></select>').change(function() {
          var instance = Drupal.settings.edoweb.fields[bundle][$(this).val()].instance;
          var field = createField(instance);
          activateFields(field, bundle);
          entity.find('.content').prepend(field);
          $(this).find('option:selected').remove();
        });
        $.each(Drupal.settings.edoweb.fields[bundle], function(index, value) {
          var instance = value['instance'];
          var field_class = getFieldClassName(instance);
          var existing_items = entity.find('.' + field_class);
          if (! existing_items.length && instance['required']) {
            var field = createField(instance);
            entity.find('.content').prepend(field);
          } else if (! existing_items.length) {
            var option = $('<option />').text(instance['label']).val(index);
            additional_fields.append(option);
          }
        });
        entity.before(additional_fields);

        var submit_button = $('<button>Speichern</button>').bind('click', function() {
          var post_data = entity.rdf().databank.dump({format:'application/rdf+xml', serialize: true});
          $.post('', post_data, function(data, textStatus, jqXHR) {
            console.log(data);
          });
        });
        entity.before(submit_button);

        var import_button = $('<button>Importieren</button>').bind('click', function() {
          instance = {'bundle': bundle, 'field_name': ''}
          modal_overlay.html('<div />');
          refreshTable(modal_overlay, null, null, null, null, null, instance, function(uri) {
            entity_render_view('edoweb_basic', compact_uri(uri)).onload = function() {
              var entity_content = $(this.responseText).find('.content');
              var page_title = $(this.responseText).find('h2').text();
              Drupal.attachBehaviors(entity_content);
              activateFields(entity_content.find('.field'), bundle);
              entity.find('.content').replaceWith(entity_content);
              $('#page-title', context).text(page_title);
            };
          });
          modal_overlay.dialog('open');
          return false;
        });
        entity.before(import_button);
        activateFields(entity.find('.field'), bundle);
      });

      function getFieldName(field) {
        var cls = field.attr('class').split(' ');
        var field_name;
        $.each(cls, function(i, v) {
          if (v.indexOf('field-name-') == 0) {
            field_name = v.slice(11).replace(/-/g, '_');
          }
        });
        return field_name;
      }

      function getFieldClassName(instance) {
        var field_name = instance['field_name'];
        return 'field-name-' + field_name.replace(/_/g, '-');
      }

      function createField(instance) {
        var cls = 'field-name-' + instance['field_name'].replace(/_/g, '-');
        var field = $('<div class="field ' + cls + '"><div class="field-label">' + instance['label'] + ':&nbsp;</div><div class="field-items" /></div>');
        return field;
      }

      function createTextInput(instance, target) {
        var input = $('<div class="field-item" />')
          .attr('property', instance['settings']['predicates'].join(' '));
        enableTextInput(input);
        target.append(input);
      }

      function enableTextInput(field) {
        field.attr('contenteditable', true)
          .css('border', '1px solid grey')
          .css('margin-top', '0.3em')
          .css('padding', '0.1em')
          .keydown(function(e) {
            var target = $(e.target);
            if (e.keyCode == 8 && ! target.text().length && target.siblings('.field-item').length) {
              $(this).remove();
              return false;
            }
          });
      }

      function createLinkInput(instance, target) {
        modal_overlay.html('<div />');
        refreshTable(modal_overlay, null, null, null, null, null, instance, function(uri) {
          var input = $('<div class="field-item" />')
            .attr('rel', instance['settings']['predicates'].join(' '));
          var target_bundles = instance['settings']['handler_settings']['target_bundles'];
          for (target_bundle in target_bundles) break;
          var link = $('<a />').attr('href', uri).text(uri)
            .attr('data-target-bundle', target_bundle)
            .attr('data-curie', compact_uri(uri))
            .attr('resource', compact_uri(uri));
          input.append(link);
          target.append(input);
          entity_table(target);
        });
        modal_overlay.dialog('open');
      }

      function activateFields(fields, bundle) {
        $.each(fields, function() {
          var field = $(this);
          var field_name = getFieldName(field);
          var instance = Drupal.settings.edoweb.fields[bundle][field_name]['instance'];
          switch (instance['widget']['type']) {
            case 'text_textarea':
            case 'text_textfield':
            case 'number':
              field.find('.field-items').each(function() {
                if ($(this).find('.field-item').length) {
                  enableTextInput($(this).find('.field-item'));
                } else {
                  createTextInput(instance, $(this));
                }
                if ((instance['settings']['cardinality'] == -1)
                    || ($(this).find('.field-item').length < instance['settings']['cardinality'])) {
                  var add_button = $('<a href="#">+</a>')
                    .bind('click', function() {
                      createTextInput(instance, $(this).siblings('.field-items'));
                      return false;
                    }).css('float', 'right');
                  $(this).after(add_button);
                }
              });
              break;
            case 'edoweb_autocomplete_widget':
              field.find('.field-items').each(function() {
                if ((instance['settings']['cardinality'] == -1)
                    || ($(this).find('.field-item').length < instance['settings']['cardinality'])) {
                  var items = $(this);
                  var add_button = $('<a href="#">+</a>')
                    .bind('click', function() {
                      createLinkInput(instance, $(this).siblings('.field-items'));
                      return false;
                    }).css('float', 'right');
                  $(this).after(add_button);
                }
              });
              break;
          }
        });
      }

    }
  };

  Drupal.behaviors.edoweb_field_reference = {
    attach: function (context, settings) {

      $(context).find('table').not('.field-multiple-table').each(function() {
        hideEmptyTableColumns($(this));
        hideTableHeaders($(this));
      });

      // Load entities into table
      entity_table($(context).find('.field-type-edoweb-ld-reference .field-items'));

      // Load entity-labels in facet list
      $(context).find('*[data-curie].facet').each(function() {
        entity_label($(this));
      });

      // Modify hrefs to point to local data
      // TODO: rewrite links on click
      //$(context).find('a[data-curie]').not('.facet').each(function() {
      //  var href = Drupal.settings.basePath + 'resource/' + $(this).attr('data-curie');
      //  $(this).attr('href', href);
      //})

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

    }

  };

  /**
   * Function loads a tabular view for a list of linked entities
   */
  function entity_table(field_items) {
    field_items.each(function() {
      var container = $(this);
      var curies = [];
      container.find('a[data-curie]').each(function() {
        curies.push(this.getAttribute('data-curie'));
      });
      var columns = container.find('a[data-target-bundle]')
        .attr('data-target-bundle')
        .split(' ')[0];
      if (curies.length > 0) {
        container.siblings('table').remove();
        var throbber = $('<div class="ajax-progress"><div class="throbber">&nbsp;</div></div>')
        container.before(throbber);
        entity_list('edoweb_basic', curies, columns).onload = function () {
          if (this.status == 200) {
            var result_table = $(this.responseText).find('table');
            result_table.find('a[data-curie][data-target-bundle]').each(function() {
              entity_label($(this));
            });
            result_table.removeClass('sticky-enabled');
            result_table.tablesorter({sortList: [[1,1]]});
            //TODO: check interference with tree navigation block
            //Drupal.attachBehaviors(result_table);
            container.hide();
            container.after(result_table);
            hideEmptyTableColumns(result_table);
            hideTableHeaders(result_table);
          }
          throbber.remove();
        };
      }
    });
  }

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

  var pending_requests = [];
  function refreshTable(container, page, sort, order, term, type, instance, callback) {
    if(!page) page = 0;
    if(!sort) sort = '';
    if(!order) order = '';
    if(!term) term = '';
    if(!type) type = '';

    var bundle_name = instance['bundle'];
    var field_name = instance['field_name'];

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
                  //FIXME: hardcoded URL prefix
                  callback('http://api.localhost/resource/' + resource_uri);
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
          refreshTable(container, null, null, null, term, target_type, instance, callback);
          return false;
        });

        container.find('th a').add('ul.pager a')
          .click(function(el, a, b, c) {
            var target_type = container.find('input[type=radio]:checked').first().val();
            var url = jQuery.url(el.currentTarget.getAttribute('href'));
            refreshTable(container, url.param('page'), url.param('sort'), url.param('order'), url.param('query[0][term]'), target_type, instance, callback);
            return false;
          });

        container.find('.sticky-enabled > tbody > tr').each(function() {
          var row = jQuery(this);
          jQuery(this).children('td').last()
            .append('<button>Übernehmen</button>')
            .bind('click', function(event) {
              container.dialog('close');
              var resource_uri = row.children('td').first().children('a').first().attr('href');
              callback(resource_uri);
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
