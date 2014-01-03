<?php
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

class LinkedDataClient {

  /*
   * Load an entity from the API.
   *
   * @param $entity
   *   The drupal entity to load data into
   */
  public function load($entity, $resource_uri) {
    $rdf_model = $this->getRDF($resource_uri);
    $rdf_subject = new LibRDF_URINode($resource_uri);
    $rdf_parser = new LibRDF_Parser('rdfxml');
    _edoweb_storage_entity_deserialize_rdf($entity, $rdf_subject, "$rdf_model", $rdf_parser);
  }

  /*
   * Load the RDF for a linked data resource
   */
  public function getRDF($resource_uri) {
    $http_options = array(
      'method' => 'GET',
      'headers' => array('Accept' => 'application/rdf+xml'),
    );
    $http_response = _edoweb_http_request($resource_uri, $http_options);
    if ((200 == $http_response->code) && isset($http_response->data)) {
      $rdf_data = $http_response->data;
    } else {
      $rdf_data = '';
    }
    $rdf_parser = new LibRDF_Parser('rdfxml');
    $rdf_model = new LibRDF_Model(new LibRDF_Storage());
    try {
      $rdf_model->loadStatementsFromString($rdf_parser, $rdf_data);
    } catch (LibRDF_Error $e) {
      watchdog('edoweb', 'Unable to retrieve Linked Data for @uri',
        array('@uri' => $resource_uri)
      );
    }
    return $rdf_model;
  }

}

