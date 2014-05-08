function refreshTable(id, page, sort, order, term) {
  if(!page) page = 0;
  if(!sort) sort = '';
  if(!order) order = '';
  if(!term) term = '';

  var bundle_name = jQuery(id).attr('data-bundle');
  var field_name = jQuery(id).attr('data-field');
  var qurl = Drupal.settings.basePath + '?q=edoweb/search';

  jQuery.ajax({
    cache: false,
    url: qurl,
    data: {page: page, sort: sort, order: order, 'query[0][term]': term},
    dataType: 'text',
    error: function(request, status, error) {
      alert(status);
    },
    success: function(data, status, request) {
      var html = data;

      jQuery(id).html(html);

      jQuery(id + ' th a')
        .add(id + ' .pager-item a')
        .add(id + ' .pager-first a')
        .add(id + ' .pager-previous a')
        .add(id + ' .pager-next a')
        .add(id + ' .pager-last a')
          .click(function(el, a, b, c) {
            var url = jQuery.url(el.currentTarget.getAttribute('href'));
            refreshTable(id, url.param('page'), url.param('sort'), url.param('order'), url.param('query[0][term]'));
            return (false);
          });

      jQuery(id + ' input[name="op"]').click(function() {
        var term = jQuery(id + ' input[type="text"]').val();
        refreshTable(id, null, null, null, term);
        return false;
      });

      //jQuery(id).next('div').children('input.edoweb_autocomplete_widget').hide();
      //jQuery(id).next('div').next('input').hide();
      jQuery(id + ' .sticky-enabled > tbody > tr').each(function() {
        var row = jQuery(this);
        jQuery(this).children('td').last()
          .append('<button>Hinzufügen</button>')
          .bind('click', function(event) {
            var resource_uri = row.children('td').first().children('a').first().text();
            jQuery(id).next('div').children('input.edoweb_autocomplete_widget').val(resource_uri);
            jQuery(id).next('div').next('input').click();
            return false;
          });
      });

      Drupal.attachBehaviors(jQuery(id));

    }
  });
}

function initializeTable(id) {
  jQuery(document).ready(function() {
    refreshTable(id);
  });
}
