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
   * Common behaviours
   */
  Drupal.behaviors.edoweb = {
    attach: function (context, settings) {
      var home_href = Drupal.settings.basePath + 'resource';
      if (document.location.pathname == home_href && '' != document.location.search) {
        var query_params = [];
        var all_params = document.location.search.substr(1).split('&');
        $.each(all_params, function(i, param) {
          if ('query[0][facets]' == param.substr(0, 16)) {
            query_params.push(param);
          }
        });
        if (query_params) {
          sessionStorage.setItem('edoweb_search', '?' + query_params.join('&'));
        }
      } else if (document.location.pathname == home_href) {
        sessionStorage.removeItem('edoweb_search');
      }
      if (search = sessionStorage.getItem('edoweb_search')) {
        $('a[href="' + home_href + '"]').attr('href', home_href + search);
        if ('resource' == Drupal.settings.edoweb.site_frontpage) {
          $('a[href="/"]').attr('href', home_href + search);
        }
      }
    }
  }

  /**
   * Edoweb helper functions
   */
  Drupal.edoweb = {

    /**
     * URI to CURIE
     */
    compact_uri: function(uri) {
      var namespaces = Drupal.settings.edoweb.namespaces;
      for (prefix in namespaces) {
        if (uri.indexOf(namespaces[prefix]) == 0) {
          var local_part = uri.substring(namespaces[prefix].length);
          return prefix + ':' + local_part;
        }
      }
    },

    expand_curie: function(curie) {
      var namespaces = Drupal.settings.edoweb.namespaces;
      var curie_parts = curie.split(':');
      for (prefix in namespaces) {
        if (prefix == curie_parts[0]) {
          return namespaces[prefix] + curie_parts[1];
        }
      }
    },

    /**
     * Pending AJAX requests
     */
    pending_requests: [],

    /**
     * Function loads a tabular view for a list of linked entities
     */
    entity_table: function(field_items, operations) {
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
          Drupal.edoweb.entity_list('edoweb_basic', curies, columns).onload = function () {
            if (this.status == 200) {
              var result_table = $(this.responseText).find('table');
              result_table.find('a[data-curie][data-target-bundle]').each(function() {
                Drupal.edoweb.entity_label($(this));
              });
              result_table.removeClass('sticky-enabled');
              result_table.tablesorter({sortList: [[1,1]]});
              //TODO: check interference with tree navigation block
              //Drupal.attachBehaviors(result_table);
              container.hide();
              container.after(result_table);
              for (label in operations) {
                operations[label](result_table);
              }
              Drupal.edoweb.hideEmptyTableColumns(result_table);
              Drupal.edoweb.hideTableHeaders(result_table);
            }
            throbber.remove();
          };
        }
      });
    },

    /**
     * Function returns an entities label.
     */
    entity_label: function(element) {
      var entity_type = 'edoweb_basic';
      var entity_id = element.attr('data-curie');
      if (cached_label = sessionStorage.getItem(entity_id)) {
        element.text(cached_label);
      } else {
        $.get(Drupal.settings.basePath + 'edoweb_entity_label/' + entity_type + '/' + entity_id).onload = function() {
          var label = this.status == 200 ? this.responseText : entity_id;
          if (this.status == 200) {
            sessionStorage.setItem(entity_id, label);
          }
          element.text(label);
        };
      }
    },

    /**
     * Function returns an entities label.
     */
    entity_list: function(entity_type, entity_curies, columns) {
      return $.get(Drupal.settings.basePath + 'edoweb_entity_list/' + entity_type + '?' + $.param({'ids': entity_curies, 'columns': columns}));
    },

    /**
     * Hides table columns that do not contain any data
     */
    hideEmptyTableColumns: function(table) {
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
    },

    /**
     * Hide the th of a table
     */
    hideTableHeaders: function(table) {
      if (!(table.parent().hasClass('field-name-field-edoweb-struct-child'))
          && !(table.hasClass('sticky-enabled'))
          && !(table.closest('form').length))
          {
        table.find('thead').hide();
      }
    },

    blockUIMessage: {
      message: '<div class="ajax-progress"><div class="throbber">&nbsp;</div></div> Bitte warten...'
    }

  }

  // AJAX navigation, if possible
  if (window.history && history.pushState) {
    Drupal.edoweb.navigateTo = function(href) {
      var throbber = $('<div class="ajax-progress"><div class="throbber">&nbsp;</div></div>');
      $('#content').html(throbber);
      $.get(href, function(data, textStatus, jqXHR) {
        throbber.remove();
        var html = $(data);
        Drupal.attachBehaviors(html);
        $('#content').replaceWith(html.find('#content'));
        $('#breadcrumb').replaceWith(html.find('#breadcrumb'));
        document.title = html.filter('title').text();
        $('.edoweb-tree li.active').removeClass('active');
        $('.edoweb-tree li>a[href="' + location.pathname + '"]').closest('li').addClass('active');
      });
    };
    if (!this.attached) {
      history.replaceState({tree: true}, null, document.location);
      window.addEventListener("popstate", function(e) {
        if (e.state && e.state.tree) {
          Drupal.edoweb.navigateTo(location.pathname);
          Drupal.edoweb.refreshTree();
        }
      });
      this.attached = true;
    }
  } else {
    Drupal.edoweb.navigateTo = function(href) {
      window.location = href;
    };
  }

})(jQuery);
