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

  Drupal.behaviors.edoweb = {
    attach: function (context, settings) {
      //window.onbeforeunload = function(e) {
      //  return "Sie bearbeiten zur Zeit einen Eintrag.";
      //};
      //$('a').click(function(e) {
      //  window.onbeforeunload = function(){};
      //});
      //$('form').submit(function(e) {
      //  window.onbeforeunload = function(){};
      //});
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

      var additional_fields = $('<select><option>Feld hinzufügen</option></select>').change(function() {
        var instance = Drupal.settings.edoweb.fields[$(this).val()].instance;
        var field = createField(instance);
        $('#content .field', context).last().after(field);
        $(this).find('option:selected').remove();
      });

      $.each(Drupal.settings.edoweb.fields, function(index, value) {
        var option = $('<option />').text(value['instance']['label']).val(index);
        additional_fields.append(option);
      });
      $('#content', context).prepend(additional_fields);

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

      function createField(instance) {
        console.log(instance);
        var field = $('<div class="field"><div class="field-label">' + instance['label'] + ':&nbsp;</div></div>');
        var field_items = $('<div class="field-items" />');
        field.append(field_items);
        switch (instance['widget']['type']) {
          case 'text_textarea':
          case 'text_textfield':
            field_items.append(createTextInput(instance));
            var add_button = $('<a href="#">+</a>')
              .bind('click', function() {
                $(this).before(createTextInput(instance));
                return false;
              }).css('float', 'right');
            field_items.append(add_button);
            break;
          case 'edoweb_autocomplete_widget':
            var add_button = $('<a href="#">+</a>')
              .bind('click', function() {
                $(this).before(createLinkInput(instance));
                return false;
              }).css('float', 'right');
            field_items.append(add_button);
            break
        }
        return field;
      }

      function createTextInput(instance) {
        var input = $('<div class="field-item" />')
          .attr('property', instance['settings']['predicates'].join(' '));
        enableTextInput(input);
        return input;
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

      function createLinkInput(instance) {
        var input = $('<div class="field-item" />')
          .attr('rel', instance['settings']['predicates'].join(' '));
        enableLinkInput(input);
        return input;
      }

      function enableLinkInput(field) {
        var uri = prompt('URI', 'http://example.org/1');
        var link = $('<a />').attr('href', uri).text(uri);
        field.append(link);
      }

      $.each($('.field', context), function() {
        var field = $(this);
        var field_name = getFieldName(field);
        var instance = Drupal.settings.edoweb.fields[field_name]['instance'];
        switch (instance['widget']['type']) {
          case 'text_textarea':
          case 'text_textfield':
            field.find('.field-items').each(function() {
              enableTextInput($(this).find('.field-item'));
              var add_button = $('<a href="#">+</a>')
                .bind('click', function() {
                  $(this).before(createTextInput(instance));
                  return false;
                }).css('float', 'right');
              $(this).append(add_button);
            });
            break;
          case 'edoweb_autocomplete_widget':
            field.find('.field-items').each(function() {
              //enableLinkInput($(this).find('.field-item'));
              var add_button = $('<a href="#">+</a>')
                .bind('click', function() {
                  $(this).before(createLinkInput(instance));
                  return false;
                }).css('float', 'right');
              $(this).append(add_button);
            });
            break;
        }
      });

      var submit_button = $('<button>Speichern</button>').bind('click', function() {
        var post_data = $('#content', context).rdf().databank.dump({format:'application/rdf+xml', serialize: true});
        $.post('', post_data, function(data, textStatus, jqXHR) {
          console.log(data);
        });
      });
      $('#content', context).prepend(submit_button);

    }
  };

})(jQuery);
