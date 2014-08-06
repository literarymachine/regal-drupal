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
        var insert_position = source_widgets[0].prev();
        var group_fieldset = $('<fieldset><legend><select /></legend></fieldset>');
        group_fieldset.find('select').change(function() {
          group_fieldset.children('legend').children('img').hide();
          $(group_fieldset.children('legend').children('img').get(this.selectedIndex)).show();
          group_fieldset.children('div[class="fieldset-wrapper"]').hide();
          $(group_fieldset.children('div[class="fieldset-wrapper"]').get(this.selectedIndex)).show();
        });
        $.each(source_widgets, function(i, source_widget) {
          var focus_link = source_widget.find('a[name="focus"]').first();
          var content = source_widget.find('.fieldset-wrapper').first().hide();
          // Convert description div to tooltip
          var tooltip_content = content.find('div.fieldset-description').first();
          if (tooltip_content.length > 0) {
            var tooltip_icon = $('<img />')
              .attr('src', Drupal.settings.edoweb_field.basePath + '/tooltip.svg')
              .attr('title', tooltip_content.text())
              .css('height', '1em');
            group_fieldset.children('legend').append(tooltip_icon.hide());
            tooltip_content.remove();
          }
          group_fieldset.find('select').append($('<option>' + source_widget.find('legend').first().text() + '</option>'));
          if (focus_link.length > 0) {
            group_fieldset.prepend(focus_link);
            group_fieldset.find('select').get(0).selectedIndex = i;
          }
          group_fieldset.append(content);
          source_widget.remove();
        });
        insert_position.after(group_fieldset);
        $(group_fieldset.children('legend').children('img').get(group_fieldset.find('select').get(0).selectedIndex)).show();
        $(group_fieldset.children('div[class="fieldset-wrapper"]').get(group_fieldset.find('select').get(0).selectedIndex)).show();
      });
      window.location.hash = 'focus';
    }
  };

  Drupal.behaviors.edoweb_field_tooltips = {
    attach: function (context, settings) {
      $('form#edoweb-basic-form').find('div.description').each(function() {
        var tooltip_icon = $('<img />')
          .attr('src', Drupal.settings.edoweb_field.basePath + '/tooltip.svg')
          .attr('title', $(this).text())
          .css('height', '1em');
        $(this).prevAll('label').append(tooltip_icon);
        $(this).remove();
      });
      $('form#edoweb-basic-form').find('fieldset.form-wrapper').find('div.fieldset-description').each(function() {
        var tooltip_icon = $('<img />')
          .attr('src', Drupal.settings.edoweb_field.basePath + '/tooltip.svg')
          .attr('title', $(this).text())
          .css('height', '1em');
        $(this).parent().prevAll('legend').append(tooltip_icon);
        $(this).remove();
      });
    }
  };

})(jQuery);
