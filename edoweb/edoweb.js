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
        var template = $(Drupal.settings.edoweb.fields[$(this).val()], context);
        fieldEditable(template);
        $('#content .field', context).last().after(template);
        $(this).find('option:selected').remove();
      });

      $.each(Drupal.settings.edoweb.fields, function(index, value) {
        var template = $(value);
        if (! $('#content .' + template.attr('class').split(' ').join('.'), context).length) {
          var option = $('<option />').text(template.find('.field-label').text()).val(index);
          additional_fields.append(option);
        }
      });
      $('#content', context).prepend(additional_fields);

      fieldEditable($('.field', context));

      function fieldEditable(fields) {
        fields.find('.field-items').filter(function() {return $(this).find('.field-item[property]').length}).each(function() {
          $(this).find('.field-item')
            .attr('contenteditable', true)
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
          var add_button = $('<a href="#">+</a>')
            .bind('click', function() {
              var input = $(this).prev().clone(true).text('').toggleClass('even odd');
              $(this).before(input);
              return false;
            }).css('float', 'right');
          $(this).append(add_button);
        });
        fields.find('.field-items').filter(function() {return $(this).find('.field-item[rel]').length}).each(function() {
          //$(this).find('.field-item')
          //  .attr('contenteditable', true)
          //  .css('border', '1px solid grey')
          //  .css('margin-top', '0.3em')
          //  .css('padding', '0.1em')
          //  .keydown(function(e) {
          //    var target = $(e.target);
          //    if (e.keyCode == 8 && ! target.text().length && target.siblings('.field-item').length) {
          //      $(this).remove();
          //      return false;
          //    }
          //  });
          var add_button = $('<a href="#">+</a>')
            .bind('click', function() {
              var input = $(this).prev().clone(true).text('').toggleClass('even odd');
              var uri = prompt('URI', 'http://example.org/1');
              var link = $('<a />').attr('href', uri).text(uri);
              input.append(link);
              $(this).before(input);
              return false;
            }).css('float', 'right');
          $(this).append(add_button);
        });
      }

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
