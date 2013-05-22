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
   * Puts the currently highlighted suggestion into the autocomplete field.
   */
  Drupal.jsAC.prototype.select = function (node) {
    this.input.value = $(node).data('autocompleteId');
    this.input.type = 'hidden';
    $(this.input).after('<input type="text" class="text-full form-text" size="60" maxlength="255" disabled value="' + $(node).data('autocompleteValue') + '" />');
  };

  /**
   * Hides the autocomplete suggestions.
   */
  Drupal.jsAC.prototype.hidePopup = function (keycode) {
    // Select item if the right key or mousebutton was pressed.
    if (this.selected && ((keycode && keycode != 46 && keycode != 8 && keycode != 27) || !keycode)) {
      this.input.value = $(this.selected).data('autocompleteId');
      this.input.type = 'hidden';
    }
    // Hide popup.
    var popup = this.popup;
    if (popup) {
      this.popup = null;
      $(popup).fadeOut('fast', function () { $(popup).remove(); });
    }
    this.selected = false;
    $(this.ariaLive).empty();
  };

  /**
   * Fills the suggestion popup with any matches received.
   */
  Drupal.jsAC.prototype.found = function (matches) {
    // If no value in the textfield, do not show the popup.
    if (!this.input.value.length) {
      return false;
    }

    // Prepare matches.
    var ul = $('<ul></ul>');
    var ac = this;
    for (key in matches) {
      $('<li></li>')
        .html($('<div></div>').html(matches[key]))
        .mousedown(function () { ac.select(this); })
        .mouseover(function () { ac.highlight(this); })
        .mouseout(function () { ac.unhighlight(this); })
        .data('autocompleteId', key)
        .data('autocompleteValue', matches[key])
        .appendTo(ul);
    }

    // Show popup with matches, if any.
    if (this.popup) {
      if (ul.children().length) {
        $(this.popup).empty().append(ul).show();
        $(this.ariaLive).html(Drupal.t('Autocomplete popup'));
      }
      else {
        $(this.popup).css({ visibility: 'hidden' });
        this.hidePopup();
      }
    }
  };

})(jQuery);
