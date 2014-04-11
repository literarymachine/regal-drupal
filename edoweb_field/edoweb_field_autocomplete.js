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
  jQuery.fn.extend({
    propAttr: $.fn.prop || $.fn.attr
  });
  Drupal.behaviors.edoweb_field_autocomplete = {
    attach: function (context, settings) {
      window.location.hash = 'focus';
      $('.edoweb_autocomplete_widget').each(function(index, element) {
        var field_name = $(this).attr('class').split(/\s+/)[1];
        var bundle_name = $(this).attr('class').split(/\s+/)[2];
        $(this).autocomplete({
          source: Drupal.settings.basePath + 'edoweb/autocomplete/' + bundle_name + '/' + field_name,
          minLength: 2,
          select: function(event, ui) {
            var search_input = $('input[name="edoweb_autocomplete_widget[' + field_name + '][search]"]');
            var search_button = $('input[name="edoweb_autocomplete_widget_' + field_name + '_submit"]');
            search_input.val(ui.item.label);
            search_button.trigger('click');
            return false;
          }
        });
      });

      // Group lookup fieldsets by group name
      var field_groups = {};
      $('fieldset[data-field-group]').each(function() {
        var field_group = $(this).attr('data-field-group');
        var source_widget = $(this).closest('.field-widget-edoweb-autocomplete-widget');
        if (field_groups[field_group]) {
          field_groups[field_group].push(source_widget);
        } else {
          field_groups[field_group] = [source_widget];
        }
      });

      $.each(field_groups, function (field_group, source_widgets) {
        var selected = 0;
        var tabbed_area = $('<div id="tabs-' + field_group + '"><ul /></div>');
        tabbed_area.addClass('field-widget-tabs');
        $.each(source_widgets, function(i, source_widget) {
          var tab_content = $('<div id="tabs-' + field_group + '-' + i + '" />');
          var focus_link = source_widget.find('a[name="focus"]').first();
          if (focus_link.length > 0) {
            tab_content.append(focus_link);
            selected = i;
          }
          tab_content.append(source_widget.find('.fieldset-wrapper').first());
          tabbed_area.append(tab_content);
          tabbed_area.children('ul').append($('<li><a href="#tabs-' + field_group + '-' + i + '">' + source_widget.find('legend').first().text() + '</a></li>'));
        });
        source_widgets[0].replaceWith(tabbed_area);
        $('#tabs-' + field_group).tabs({ selected: selected });
      });
      $('.field-widget-edoweb-autocomplete-widget').remove();
    }
  };

})(jQuery);
