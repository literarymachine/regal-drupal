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

  // AJAX navigation
  if (window.history && history.pushState) {
    Drupal.navigateTo = function(href) {
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
          Drupal.navigateTo(location.pathname);
          Drupal.refreshTree();
        }
      });
      this.attached = true;
    }
  } else {
    Drupal.navigateTo = function(href) {
      window.location = href;
    };
  }

  var findTargetBundles = function(bundle, callback, processed) {
    if (!processed) processed = [];
    var fields = Drupal.settings.edoweb.fields[bundle];
    if (fields && 'field_edoweb_struct_child' in fields) {
      for (target_bundle in fields['field_edoweb_struct_child']['instance']['settings']['handler_settings']['target_bundles']) {
        if (processed.indexOf(target_bundle) == -1) {
          callback(target_bundle);
          processed.push(target_bundle);
          findTargetBundles(target_bundle, callback, processed);
        }
      }
    }
  }

  Drupal.behaviors.edoweb_tree = {
    attached: false,
    attach: function (context, settings) {

      // Attach clipboard
      var clipboard = $('<div id="edoweb-tree-clipboard" />');
      $('.edoweb-tree', context).closest('div.item-list').before(clipboard);

      findTargetBundles($('.edoweb-tree>li>a', context).attr('data-bundle'), function(bundle) {
        var link = $('<a />')
          .attr('href', Drupal.settings.basePath + 'resource/add/' + target_bundle)
          .text(Drupal.settings.basePath + 'resource/add/' + target_bundle)
          .bind('click', function() {
            history.pushState({tree: true}, null, $(this).attr('href'));
            Drupal.navigateTo($(this).attr('href'));
            return false;
          });
        clipboard.before(link);
      });

      $('.edoweb-tree li', context).each(function() {

        var list_element = $(this);
        var link = list_element.children('a:eq(0)');
        var entity_id = decodeURIComponent(
          link.attr('href').split('/').pop()
        );

        // Expand / collapse tree
        $(this).click(function(e) {
          if (e.target != this) return true;
          if ($(this).hasClass('collapsed')) {
            loadTree(entity_id, list_element);
          } else {
            $(this).children('div.item-list').remove();
          }
          $(this).toggleClass('expanded collapsed');
          // Fix FF behaviour that selects text of subordinate lists
          // on expansion
          if (window.getSelection && window.getSelection().removeAllRanges) {
            window.getSelection().removeAllRanges();
          }
          return false;
        });

        // Shorten the link captions
        if (link.text().length > 40) {
          link.attr('title', link.text());
          link.text(link.text().substr(0, 40) + '...');
        }

        // Navigate via AJAX
        link.click(function() {
          history.pushState({tree: true}, null, link.attr('href'));
          Drupal.navigateTo(link.attr('href'));
          $('.edoweb-tree li.active', context).removeClass('active');
          link.closest('li').addClass('active');
          Drupal.refreshTree();
          return false;
        });

        // Find possible actions
        var actions = $(this).children('a[data-target-bundle]');
        if (Drupal.settings.actionAccess) {
          // Cut button
          var cut_button = $('<a href="#" title="[Ausschneiden]"><span class="octicon octicon-diff-removed" /></a>');
          cut_button.bind('click', function() {
            entity_load_json('edoweb_basic', entity_id).onload = function() {
              localStorage.setItem('cut_entity', this.responseText);
              Drupal.refreshTree();
            };
            return false;
          });
          actions = actions.add(cut_button);
        }

        if (actions.length > 0) {
          // Group actions in toolbox
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
        }
      });

      // Init insert positions
      Drupal.refreshTree();

    }
  };

  var loadTree = function(entity_id, target, callback) {
    var url = Drupal.settings.basePath + 'resource/' + entity_id + '/structure';
    $.get(url).onload = function() {
      var data = $(this.responseText);
      Drupal.attachBehaviors(data);
      var replacement = data.children('ul').children('li');
      target.replaceWith(replacement);
      Drupal.refreshTree();
      if (callback) callback();
    };
  };

  var UIButtons = [];
  var expandTree = function(tree) {
    tree.parents('ul').show();
    tree.addClass('expanded');
    tree.removeClass('collapsed');
    tree.parents('li').addClass('expanded');
    tree.parents('li').removeClass('collapsed');
    tree.children('div').children('ul').show();
  }

  Drupal.refreshTree = function () {
    $('.edoweb-tree a').removeClass('edoweb-tree-cut-item');
    $('.edoweb-tree div.edoweb-tree-toolbox').removeClass('edoweb-tree-insert');
    $('#edoweb-tree-clipboard').empty();
    expandTree($('.edoweb-tree li.active'));
    $.each(UIButtons, function(i, button) {
      button.remove();
    });
    UIButtons = [];
    var cut_entity = JSON.parse(localStorage.getItem('cut_entity'));
    if (cut_entity) {
      var entity_id = cut_entity.remote_id;
      var entity_bundle = cut_entity.bundle_type;
      var entity_label = cut_entity.remote_id;
      var clipboard_item = $('<div class="edoweb-tree-clipboard-item"><p>' + entity_label + '</p></div>');
      var clipboard_cancel = $('<span class="octicon octicon-diff-modified"></span>').click(function() {
        localStorage.removeItem('cut_entity');
        Drupal.refreshTree();
      });
      $('#edoweb-tree-clipboard').html(clipboard_item.find('p').append(clipboard_cancel));
      $('.edoweb-tree a[href="/resource/' + encodeURIComponent(entity_id) + '"]')
        .addClass('edoweb-tree-cut-item')
        .closest('li').find('a[data-bundle]').addClass('edoweb-tree-cut-item');

      $('.edoweb-tree li').each(function() {
        var insert_position = $(this).children('div.item-list').children('ul');
        if (insert_position.length == 0) {
          insert_position = $('<ul />');
          $(this).append($('<div class="item-list"></div>').append(insert_position));
        }

        var bundle_fields = Drupal.settings.edoweb.fields[$(this).children('a[data-bundle]').attr('data-bundle')];
        var target_bundles = [];
        if (bundle_fields && 'field_edoweb_struct_child' in bundle_fields) {
          var target_bundles = Object.keys(bundle_fields
            ['field_edoweb_struct_child']
            ['instance']['settings']
            ['handler_settings']['target_bundles']);
        }

        if (target_bundles.indexOf(entity_bundle) != -1) {
          var insert_button = $('<a href="#" title="[Einfügen]"><span class="octicon octicon-diff-added" /></a>');
          insert_button.hide();
          $(this).children('.edoweb-tree-toolbox').append(insert_button);
          insert_button.bind('click', function() {
            var throbber = $('<div class="ajax-progress"><div class="throbber">&nbsp;</div></div>')
            $('#edoweb-tree-clipboard p>span').replaceWith(throbber);
            var target_struct_url = Drupal.settings.basePath + 'resource/' + entity_id + '/structure';
            var target_parent_url = $(this).closest('li').find('a:eq(0)').attr('href');
            var target_parent_id = decodeURIComponent(target_parent_url.split('/').pop());

            localStorage.removeItem('cut_entity');
            $('.edoweb-tree a.edoweb-tree-cut-item').closest('li').remove();
            var inserted_item = $('<li />');
            insert_position.prepend(inserted_item);
            var list = $(this).closest('li').children('div.item-list');
            loadTree(entity_id, inserted_item, function() {
              $.post(target_struct_url, {'parent_id': target_parent_id}, function(data, textStatus, jqXHR) {
                console.log(data);
                var ordered_children = [];
                list.children('ul').children('li').children('a').each(function() {
                  ordered_children.push(decodeURIComponent($(this).attr('href').split('/').pop()));
                });
                $.post(target_parent_url + '/structure', {'parts': ordered_children}, function(data, textStatus, jqXHR) {
                  console.log(data);
                });
                throbber.remove();
              });
            });
            return false;
          });
          UIButtons.push(insert_button);
          $(this).children('.edoweb-tree-toolbox').addClass('edoweb-tree-insert');
        }
      });
    }
  }

})(jQuery);

