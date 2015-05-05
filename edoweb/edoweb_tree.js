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
    attach: function (context, settings) {

      Drupal.settings.edoweb.entity = decodeURIComponent(
        window.location.pathname.replace(Drupal.settings.basePath, '').split('/')[1]
      );

      $('form#edoweb-basic-admin fieldset#edit-actions div.fieldset-wrapper', context).append(
        $('<input type="submit" id="edit-cut" value="In die Ablage laden" class="form-submit" />')
        .bind('click', {entity_id: Drupal.settings.edoweb.entity}, Drupal.edoweb.cut_item)
      );

      // Attach clipboard
      var clipboard = $('<div id="edoweb-tree-clipboard" style="height: 2.5em;" />');
      $('.edoweb-tree', context).closest('div.item-list').before(clipboard);

      var menu = $('<div id="edoweb-tree-menu" />');
      clipboard.before(menu);

      if (Drupal.settings.actionAccess) {
        findTargetBundles($('.edoweb-tree>li>a', context).attr('data-bundle'), function(bundle) {
          var link = $('<a />')
            .attr('href', Drupal.settings.basePath + 'resource/add/' + target_bundle)
            .attr('data-bundle', target_bundle)
            .text(Drupal.t('Add ' + target_bundle))
            .bind('click', function() {
              history.pushState({tree: true}, null, $(this).attr('href'));
              Drupal.edoweb.navigateTo($(this).attr('href'));
              return false;
            });
          menu.append(link);
        });
      }

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
            var throbber = $('<div class="ajax-progress"><div class="throbber">&nbsp;</div></div>');
            $(this).find('div.edoweb-tree-toolbox').after(throbber);
            loadTree(entity_id, list_element, function() {
              throbber.remove();
            });
            $(this).toggleClass('expanded collapsed');
          } else if ($(this).hasClass('expanded')) {
            $(this).children('div.item-list').remove();
            $(this).toggleClass('expanded collapsed');
          }
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
          Drupal.edoweb.navigateTo(link.attr('href'));
          $('.edoweb-tree li.active', context).removeClass('active');
          link.closest('li').addClass('active');
          Drupal.edoweb.refreshTree();
          return false;
        });

        if (Drupal.settings.actionAccess) {
          // Group actions in toolbox
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
          $(this).children('a').last().after(toolbox);
        }
      });

      // Init insert positions
      Drupal.edoweb.refreshTree();

    }
  };

  Drupal.edoweb.cut_item = function(e) {
    entity_id = e.data.entity_id;
    entity_load_json('edoweb_basic', entity_id).onload = function() {
      localStorage.setItem('cut_entity', this.responseText);
      Drupal.edoweb.refreshTree();
    };
    return false;
  }

  var loadTree = function(entity_id, target, callback) {
    var url = Drupal.settings.basePath + 'resource/' + entity_id + '/structure';
    $.get(url).onload = function() {
      var data = $(this.responseText);
      Drupal.attachBehaviors(data);
      var replacement = data.children('ul').children('li');
      target.replaceWith(replacement);
      Drupal.edoweb.refreshTree();
      if (callback) callback();
    };
  };

  var UIButtons = [];

  Drupal.edoweb.refreshTree = function () {
    $('.edoweb-tree a').removeClass('edoweb-tree-cut-item');
    $('.edoweb-tree div.edoweb-tree-toolbox').removeClass('edoweb-tree-insert');
    $('#edoweb-tree-clipboard').empty();
    $.each(UIButtons, function(i, button) {
      button.remove();
    });
    UIButtons = [];
    var cut_entity;
    try {
      cut_entity = JSON.parse(localStorage.getItem('cut_entity'));
    } catch(e) {
      localStorage.removeItem('cut_entity');
    }
    if (cut_entity) {
      var entity_id = cut_entity.remote_id;
      var entity_bundle = cut_entity.bundle_type;
      var entity_label = cut_entity.remote_id;
      var clipboard_item = $('<div class="edoweb-tree-clipboard-item"><span data-curie="' + entity_id + '">' + entity_label + '</span></div>');
      var clipboard_cancel = $('<span class="octicon octicon-diff-modified"></span>').click(function() {
        localStorage.removeItem('cut_entity');
        Drupal.edoweb.refreshTree();
      });
      Drupal.edoweb.entity_label(clipboard_item.find('span[data-curie]'));
      $('#edoweb-tree-clipboard').html(clipboard_item.append(clipboard_cancel));
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

        // Possible insert positions are as a child of the current entry
        // or as a sibling of the children of the current entry
        if (target_bundles.indexOf(entity_bundle) != -1) {
          var insert_button = $('<a href="#" title="[Unterhalb dieser Ebene einfügen]"><span class="octicon octicon-diff-added" /></a>');
          insert_button.hide();
          $(this).children('.edoweb-tree-toolbox').append(insert_button);
          UIButtons.push(insert_button);
          insert_button.bind('click', function() {
            $.blockUI(Drupal.edoweb.blockUIMessage);
            var list_item = $(this).closest('li');
            var throbber = $('<div class="ajax-progress"><div class="throbber">&nbsp;</div></div>')
            $('#edoweb-tree-clipboard p>span').replaceWith(throbber);
            var target_struct_url = Drupal.settings.basePath + 'resource/' + entity_id + '/structure';
            var target_parent_url = list_item.find('a:eq(0)').attr('href');
            var target_parent_id = decodeURIComponent(target_parent_url.split('/').pop());

            localStorage.removeItem('cut_entity');
            $('.edoweb-tree a.edoweb-tree-cut-item').closest('li').remove();
            var inserted_item = $('<li />');
            insert_position.prepend(inserted_item);
            loadTree(entity_id, inserted_item, function() {
              $.post(target_struct_url, {'parent_id': target_parent_id}, function(data, textStatus, jqXHR) {
                console.log(data);
                saveStructure(list_item, function() {$.unblockUI()});
                throbber.remove();
              });
            });
            return false;
          });
          $(this).children('.edoweb-tree-toolbox').addClass('edoweb-tree-insert');

          $(this).children('div.item-list')
            .children('ul')
            .children('li')
            .children('.edoweb-tree-toolbox')
            .each(function() {
              var list_item = $(this).closest('li');
              var self_uri = decodeURIComponent(list_item.find('a:eq(0)').attr('href').split('/').pop());
              if (self_uri == entity_id) {
                return true;
              }
              var insert_button = $('<a href="#" title="[Auf gleicher Ebene einfügen]"><span class="octicon octicon-move-right" /></a>');
              insert_button.hide();
              $(this).append(insert_button);
              $(this).addClass('edoweb-tree-insert');
              UIButtons.push(insert_button);
              insert_button.bind('click', function() {
                $.blockUI(Drupal.edoweb.blockUIMessage);
                var throbber = $('<div class="ajax-progress"><div class="throbber">&nbsp;</div></div>')
                $('#edoweb-tree-clipboard p>span').replaceWith(throbber);
                var target_struct_url = Drupal.settings.basePath + 'resource/' + entity_id + '/structure';
                var target_parent_url = list_item.parent().closest('li').find('a:eq(0)').attr('href');
                var target_parent_id = decodeURIComponent(target_parent_url.split('/').pop());

                localStorage.removeItem('cut_entity');
                $('.edoweb-tree a.edoweb-tree-cut-item').closest('li').remove();
                var inserted_item = $('<li />');
                list_item.after(inserted_item);
                loadTree(entity_id, inserted_item, function() {
                  $.post(target_struct_url, {'parent_id': target_parent_id}, function(data, textStatus, jqXHR) {
                    console.log(data);
                    saveStructure(list_item.parent().closest('li'), function() {$.unblockUI()});
                    throbber.remove();
                  });
                });
                return false;
              });
            });
        }
      });
    } else {
      $('.edoweb-tree li').each(function() {
        var list_element = $(this);
        var link = list_element.children('a:eq(0)');
        if (link.length == 0) return true;
        var entity_id = decodeURIComponent(
          link.attr('href').split('/').pop()
        );
        if ($(this).parent().closest('li').length > 0) {
          // Cut button
          var cut_button = $('<a href="#" title="[Ausschneiden]"><span class="octicon octicon-diff-removed" /></a>');
          cut_button.hide();
          UIButtons.push(cut_button);
          $(this).children('.edoweb-tree-toolbox').append(cut_button);
          cut_button.bind('click', {entity_id: entity_id}, Drupal.edoweb.cut_item);
        }
      });
    }

    if (Drupal.settings.actionAccess) {

      $('.edoweb-tree li').each(function() {

        // Move down button
        if ($(this).next('li').length > 0) {
          var up_button = $('<a href="#" title="[Runter]"><span class="octicon octicon-chevron-down" /></a>');
          up_button.hide();
          UIButtons.push(up_button);
          $(this).children('.edoweb-tree-toolbox').append(up_button);
          up_button.bind('click', function() {
            $.blockUI(Drupal.edoweb.blockUIMessage);
            var item = $(this).closest('li');
            var next = item.next('li');
            if (next.length > 0) {
              next.after(item);
              saveStructure(item.parent().closest('li'), function() {$.unblockUI();});
              Drupal.edoweb.refreshTree();
            }
            return false;
          });
        }

        // Move up button
        if ($(this).prev('li').length > 0) {
          var down_button = $('<a href="#" title="[Hoch]"><span class="octicon octicon-chevron-up" /></a>');
          down_button.hide();
          UIButtons.push(down_button);
          $(this).children('.edoweb-tree-toolbox').append(down_button);
          down_button.bind('click', function() {
            $.blockUI(Drupal.edoweb.blockUIMessage);
            var item = $(this).closest('li');
            var prev = item.prev('li');
            if (prev.length > 0) {
              prev.before(item);
              saveStructure(item.parent().closest('li'), function() {$.unblockUI();});
              Drupal.edoweb.refreshTree();
            }
            return false;
          });
        }

        // Hide toolbox if empty
        if ($(this).children('.edoweb-tree-toolbox').children().length == 0) {
          $(this).children('.edoweb-tree-toolbox').hide();
        } else {
          $(this).children('.edoweb-tree-toolbox').show();
        }

      });

    }

  }

  var saveStructure = function(list_item, callback) {
    var ordered_children = [];
    var list = list_item.children('div.item-list');
    var target_parent_url = list_item.find('a:eq(0)').attr('href');
    list.children('ul').children('li').children('a[data-bundle]').each(function() {
      ordered_children.push(decodeURIComponent($(this).attr('href').split('/').pop()));
    });
    $.post(target_parent_url + '/structure', {'parts': ordered_children}, function(data, textStatus, jqXHR) {
      console.log(data);
      if (callback) callback();
    });
  }

})(jQuery);

