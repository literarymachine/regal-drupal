<?php

class EdowebAPIClient implements EdowebAPIClientInterface {

  /*
   * The URL of the Edoweb API
   */
  private $__edoweb_api_host = 'orthos.hbz-nrw.de';

  /**
   * The username for the Edoweb API
   *
   */
  private $__edoweb_api_user = 'fedoraAdmin';

  /**
   * The password for the Edoweb API
   *
   */
  private $__edoweb_api_pass = 'fedoraAdmin1';

  /*
   * Load an entity from the API.
   *
   * @param $entity
   *   The drupal entity to load data into
   */
  public function load($entity) {
    $http_url = sprintf(
      'http://%s:%s@%s/monograph/edoweb:%s/metadata',
      $this->__edoweb_api_user,
      $this->__edoweb_api_pass,
      $this->__edoweb_api_host,
      $entity->remote_id
    );
    $http_response = $this->_http_get($http_url);
    $rdf_subject = new LibRDF_URINode("uuid:{$entity->remote_id}");
    $rdf_data = $http_response->data;
    $rdf_parser = new LibRDF_Parser('ntriples');
    _edoweb_storage_entity_deserialize_rdf($entity, $rdf_subject, $rdf_data, $rdf_parser);
  }

  /*
   * Save an entity to the API
   *
   * @param $entity
   *   The drupal entity to store data from
   *
   */
  public function save($entity) {

    // Create resource
    $http_url = sprintf(
      'http://%s:%s@%s/monograph/edoweb:%s',
      $this->__edoweb_api_user,
      $this->__edoweb_api_pass,
      $this->__edoweb_api_host,
      $entity->remote_id
    );
    $http_response = $this->_http_put($http_url);

    // Send metadata
    $http_post_data = _edoweb_storage_entity_serialize_ntriples($entity);
    $http_url = sprintf(
      'http://%s:%s@%s/monograph/edoweb:%s/metadata',
      $this->__edoweb_api_user,
      $this->__edoweb_api_pass,
      $this->__edoweb_api_host,
      $entity->remote_id
    );
    $http_response = $this->_http_post($http_url, $http_post_data);
  }

  protected function _http_put($request_url, $request_body = '') {
    $http_options = array(
      'method' => 'PUT',
      'data' => $request_body,
    );
    return _edoweb_http_request($request_url, $http_options);
  }

  protected function _http_post($request_url, $request_body = '') {
    $http_options = array(
      'method' => 'POST',
      'data' => $request_body,
      'headers' => array('Content-Type' => 'text/plain'),
    );
    return _edoweb_http_request($request_url, $http_options);
  }

  protected function _http_get($request_url) {
    $http_options = array(
      'method' => 'GET',
    );
    return _edoweb_http_request($request_url, $http_options);
  }

}

