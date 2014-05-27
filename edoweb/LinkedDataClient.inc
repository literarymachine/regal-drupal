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

  private static $__triple_store = null;

  /*
   * Load an entity from the API.
   *
   * @param $entity
   *   The drupal entity to load data into
   */
  public function load($entity) {
    if (is_null(self::$__triple_store)) {
      $rdf_model = $this->getRDF(_edoweb_expand_curie($entity->remote_id));
    } else {
      $rdf_model = self::$__triple_store;
    }
    $rdf_parser = new LibRDF_Parser('rdfxml');
    _edoweb_storage_entity_deserialize_rdf($entity, "$rdf_model", $rdf_parser);
  }

  /*
   * Load the RDF for a linked data resource
   */
  public function getRDF($resource_uri, $loaded_uris = 0) {

    if ('rpb:' == substr(_edoweb_compact_uri($resource_uri), 0, 4)
        || 'nwbib:' == substr(_edoweb_compact_uri($resource_uri), 0, 6))
    {
      $rdf_parser = new LibRDF_Parser('turtle');
    } else {
      $rdf_parser = new LibRDF_Parser('rdfxml');
    }
    $rdf_model = new LibRDF_Model(new LibRDF_Storage());

    // Prevent recursion
    if ($loaded_uris > 1) {
      return $rdf_model;
    }

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

    try {
      $rdf_model->loadStatementsFromString($rdf_parser, $rdf_data);
    } catch (LibRDF_Error $e) {
      watchdog('edoweb', 'Unable to retrieve Linked Data for @uri',
        array('@uri' => $resource_uri)
      );
    }

    if ('dnb:' == substr(_edoweb_compact_uri($resource_uri), 0, 4)) {
      $ontology_model = new LibRDF_Model(new LibRDF_Storage());
      $ontology_model->loadStatementsFromUri(
        $rdf_parser, 'file://' . __DIR__ . '/gnd.rdf'
      );
      $rdfs_reasoner = new LibRDF_Reasoner('rdfs');
      $rdf_model->inferStatements($rdfs_reasoner, $ontology_model);
    }

    // Workaround for dct:hasVesion in DDC
    if ('ddc:' == substr(_edoweb_compact_uri($resource_uri), 0, 4)) {
      $version_uri = new LibRDF_URINode($resource_uri . '2009/03/about.de');
      $version_stmts = $rdf_model->findStatements(
        $version_uri, null, null
      );
      foreach ($version_stmts as $version_stmt) {
        $rdf_model->addStatement(
          new LibRDF_Statement(
            new LibRDF_URINode($resource_uri),
            $version_stmt->getPredicate(),
            $version_stmt->getObject()
          )
        );
      }
    }

    $OWL = new LibRDF_NS('http://www.w3.org/2002/07/owl#');
    $equivalent_resources = $rdf_model->getTargets(
      new LibRDF_URINode($resource_uri), $OWL->sameAs
    );
    foreach ($equivalent_resources as $equivalent_resource) {
      $same_as_rdf = $this->getRDF(
        $equivalent_resource->getValue(), ++$loaded_uris
      );
      foreach ($same_as_rdf as $stmt) {
        if ($stmt->getSubject()->isEqual($equivalent_resource)) {
          $subject = new LibRDF_URINode($resource_uri);
        } else {
          $subject = $stmt->getSubject();
        }
        $rdf_model->addStatement(new LibRDF_Statement(
          $subject, $stmt->getPredicate(), $stmt->getObject()
        ));
      }
    }

    return $rdf_model;

  }

  public static function setTripleStore($triple_store) {
    self::$__triple_store = $triple_store;
  }

  public static function getTripleStore() {
    return self::$__triple_store;
  }

}

