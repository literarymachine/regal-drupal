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

  Drupal.behaviors.edoweb_tree = {
    attached: false,
    attach: function (context, settings) {

      // Init tree
      $('.edoweb-tree ul', context).hide();
      $('.edoweb-tree li', context).toggleClass('collapsed');

      // Sort tree
      $('.edoweb-tree ul', context).each(function() {
        $(this).children('li').sort(sort_desc).appendTo($(this));
      });

      // AJAX navigation
      var navigateTo;
      if (window.history && history.pushState) {
        navigateTo = function(href) {
          var throbber = $('<div class="ajax-progress"><div class="throbber">&nbsp;</div></div>')
          $('#content', context).html(throbber);
          $.get(href, function(data, textStatus, jqXHR) {
            throbber.remove();
            var html = $(data);
            Drupal.attachBehaviors(html);
            var breadcrumb = html.find('#breadcrumb');
            $('#content', context).replaceWith(html.find('#content'));
            $('#breadcrumb', context).replaceWith(html.find('#breadcrumb'));
            document.title = html.filter('title').text();
          });
        };
        if (!this.attached) {
          window.addEventListener("popstate", function(e) {
            if (e.state && e.state.tree) {
              navigateTo(location.pathname);
              $('.edoweb-tree li.active', context).removeClass('active');
              $('.edoweb-tree li>a[href="' + location.pathname + '"]').closest('li').addClass('active');
              refreshInsert();
            } else {
              document.location = location;
            }
          });
          this.attached = true;
        }
      } else {
        navigateTo = function(href) {
          window.location = href;
        };
      }

      $('.edoweb-tree li', context).each(function() {

          // Expand / collapse tree
        $(this).click(function(e) {
          if (e.target != this) return true;
          $(this).children('div').children('ul').toggle();
          $(this).toggleClass('expanded collapsed');
          // Fix FF behaviour that selects text of subordinate lists
          // on expansion
          if (window.getSelection && window.getSelection().removeAllRanges) {
            window.getSelection().removeAllRanges();
          }
          return false;
        });

        // Shorten the link captions
        var link = $(this).children('a:eq(0)');
        if (link.text().length > 40) {
          link.attr('title', link.text());
          link.text(link.text().substr(0, 40) + '...');
        }

        // Navigate via AJAX
        link.click(function() {
          history.pushState({tree: true}, null, link.attr('href'));
          navigateTo(link.attr('href'));
          $('.edoweb-tree li.active', context).removeClass('active');
          link.closest('li').addClass('active');
          refreshInsert();
          return false;
        });

        // Cut button
        var cut_button = $('<a href="#" title="[Ausschneiden]"><span class="octicon octicon-diff-removed" /></a>');
        cut_button.bind('click', function() {
          var entity_id = decodeURIComponent(
            link.attr('href').split('/').pop()
          );
          var entity_bundle = link.attr('data-bundle');
          localStorage.setItem('cut_entity_id', entity_id);
          localStorage.setItem('cut_entity_bundle', entity_bundle);
          refreshInsert(context);
          return false;
        });

        // Group actions in toolbox
        var actions = $(this).children('a[data-target-bundle]').add(cut_button);
        actions.hide();
        var toolbox = $('<div class="edoweb-tree-toolbox octicon octicon-gear"></div>')
          .css('cursor', 'pointer')
          .css('padding-left', '0.3em')
          .hover(
            function() {
              $(this).children().css('display', 'inline');
            },
            function() {
              $(this).children().hide();
            }
          );
        toolbox.append(actions);
        $(this).children('a').last().after(toolbox);
      });

      // Init insert positions
      refreshInsert(context);

    }
  };

  var UIButtons = [];
  var refreshInsert = function (context) {
    $('.edoweb-tree li.active', context).parents('ul').show();
    $('.edoweb-tree li.active', context).addClass('expanded');
    $('.edoweb-tree li.active', context).removeClass('collapsed');
    $('.edoweb-tree li.active', context).parents('li').addClass('expanded');
    $('.edoweb-tree li.active', context).parents('li').removeClass('collapsed');
    $('.edoweb-tree li.active', context).children('div').children('ul').show();
    $.each(UIButtons, function(i, button) {
      button.remove();
    });
    UIButtons = [];
    var entity_id = localStorage.getItem('cut_entity_id');
    var entity_bundle = localStorage.getItem('cut_entity_bundle');
    if (entity_id && entity_bundle) {
      $('.edoweb-tree li', context).each(function() {
        var insert_position = $(this).children('div.item-list').children('ul');
        if (insert_position.length == 0) {
          insert_position = $('<ul />');
          $(this).append($('<div class="item-list"></div>').append(insert_position));
        }
        var target_bundles = [];
        $(this).children('.edoweb-tree-toolbox').children('a[data-target-bundle]').each(function(i) {
          target_bundles[i] = $(this).attr('data-target-bundle');
        });
        if (target_bundles.indexOf(entity_bundle) != -1) {
          var insert_button = $('<a href="#" title="[Einfügen]"><span class="octicon octicon-diff-added" /></a>');
          insert_button.bind('click', function() {
            var target_struct_url = Drupal.settings.basePath + 'resource/' + entity_id + '/structure';
            var target_parent_id = decodeURIComponent(
              $(this).closest('li').find('a:eq(0)').attr('href').split('/').pop()
            );
            var throbber = $('<div class="ajax-progress"><div class="throbber">&nbsp;</div></div>')
            $(this).replaceWith(throbber);
            var post_data = [{name: 'parent_id', value: target_parent_id}];
            $.post(target_struct_url, post_data, function(data, textStatus, jqXHR) {
              throbber.remove();
              localStorage.removeItem('cut_entity_id');
              localStorage.removeItem('cut_entity_bundle');
              // Find element that was moved
              $('.edoweb-tree li').each(function() {
                var element_id = decodeURIComponent(
                  $(this).find('a:eq(0)').attr('href').split('/').pop()
                );
                if (element_id == entity_id) {
                  insert_position.append($(this));
                  // Sort elements
                  $(this).siblings('li').add($(this)).sort(sort_desc).appendTo($(this).closest('ul'));
                  return false;
                }
              });

              refreshInsert(context);
            });
            return false;
          });
          UIButtons.push(insert_button);
          insert_button.hide();
          $(this).children('.edoweb-tree-toolbox').append(insert_button);
        }
      });
    }
  }

  var sort_asc = function(a, b) {
    return ($(b).text()) < ($(a).text()) ? 1 : -1;
  }

  var sort_desc = function(a, b) {
    return ($(b).text()) > ($(a).text()) ? 1 : -1;
  }

})(jQuery);

