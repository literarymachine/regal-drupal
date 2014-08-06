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

class EdowebAPIClient implements EdowebAPIClientInterface {

  /*
   * The URL of the Edoweb API
   */
  private $__edoweb_api_host;

  /**
   * The username for the Edoweb API
   *
   */
  private $__edoweb_api_user;

  /**
   * The password for the Edoweb API
   *
   */
  private $__edoweb_api_pass;

  public function __construct() {
    // Fetch credentials from drupal settings
    $this->__edoweb_api_host = variable_get('edoweb_api_host');
    $this->__edoweb_api_user = variable_get('edoweb_api_user');
    $this->__edoweb_api_pass = variable_get('edoweb_api_password');
  }

  /*
   * Load an entity from the API.
   *
   * @param $entity
   *   The drupal entity to load data into
   */
  public function load($entity) {
    $linkedDataClient = new LinkedDataClient();
    return $linkedDataClient->load($entity);
  }

  public function getTransformers($entity) {
    $http_url = sprintf(
      'http://%s:%s@%s/resource/%s.regal',
      $this->__edoweb_api_user,
      $this->__edoweb_api_pass,
      $this->__edoweb_api_host,
      $entity->remote_id
    );

    $http_response = $this->_http_get($http_url, 'application/json');
    if (200 != $http_response->code) {
      watchdog('edoweb_storage', 'Unable to load resource @id from @api.',
        array(
          '@id' => $entity->remote_id,
          '@api' => variable_get('edoweb_api_host'),
        )
      );
      return FALSE;
    }
    return json_decode($http_response->data)->transformer;
  }

  public function addURN($entity) {
    list($namespace, $id) = explode(':', $entity->remote_id);
    $snid = 'hbz:929:02';
    $http_url = sprintf(
      'http://%s:%s@%s/utils/addUrn?namespace=%s&id=%s&snid=%s',
      $this->__edoweb_api_user,
      $this->__edoweb_api_pass,
      $this->__edoweb_api_host,
      $namespace,
      $id,
      $snid
    );

    $http_response = $this->_http_post($http_url);
    if (200 != $http_response->code) {
      watchdog('edoweb_storage', 'Unable to generate URN for @id on @api.',
        array(
          '@id' => $entity->remote_id,
          '@api' => variable_get('edoweb_api_host'),
        )
      );
      return FALSE;
    }
    return TRUE;
  }

  /*
   * Save an entity to the API
   *
   * @param $entity
   *   The drupal entity to store data from
   *
   */
  public function save($entity) {

    // Local entities are stored in the file system
    $this->saveResource($entity);
    // Store attached files first, as entity metadata has to be
    // updated with corresponding new file URIs
    $this->saveFiles($entity);
    $this->saveMetadata($entity);
  }

  public function saveMetadata($entity) {
    // Send metadata
    $http_post_data = _edoweb_storage_entity_serialize_ntriples(
      $entity, array('descriptive')
    );
    header("Content-Type: text/plain");
//    die( $http_post_data );
    $http_url = sprintf(
      'http://%s:%s@%s/resource/%s/metadata',
      $this->__edoweb_api_user,
      $this->__edoweb_api_pass,
      $this->__edoweb_api_host,
      $entity->remote_id
    );
    $http_response = $this->_http_post($http_url, $http_post_data);
    if (200 != $http_response->code) {
      watchdog('edoweb_storage', 'Unable to save metadata for @id to @api.',
        array(
          '@id' => $entity->remote_id,
          '@api' => variable_get('edoweb_api_host'),
        )
      );
      return FALSE;
    }
    return TRUE;
  }

  public function saveFiles($entity) {
    $http_url = sprintf(
      'http://%s:%s@%s/resource/%s/data',
      $this->__edoweb_api_user,
      $this->__edoweb_api_pass,
      $this->__edoweb_api_host,
      $entity->remote_id
    );
    if (property_exists($entity, 'field_edoweb_datastream')
        && isset($entity->field_edoweb_datastream[LANGUAGE_NONE][0]['value'])) {
      $file_url = $entity->field_edoweb_datastream[LANGUAGE_NONE][0]['value'];
    }
    if (isset($file_url) && 'public://' == substr($file_url, 0, 9)) {
      $file_name = $entity->field_edoweb_label[LANGUAGE_NONE][0]['value'];
      $file_mime = $entity->field_edoweb_filetype[LANGUAGE_NONE][0]['value'];
      $file_path = drupal_realpath($file_url);
      if ($this->_http_multipart_put("$http_url", $file_path, $file_mime, $file_name)) {
        unset($entity->field_edoweb_datastream[LANGUAGE_NONE][0]);
        unlink($file_path);
      } else {
        watchdog('edoweb_storage', 'Unable to upload file to API');
        return FALSE;
      }
    }
    return TRUE;
  }

  public function saveResource($entity, $transformers = null) {
    // Create resource
    $http_url = sprintf(
      'http://%s:%s@%s/resource/%s',
      $this->__edoweb_api_user,
      $this->__edoweb_api_pass,
      $this->__edoweb_api_host,
      $entity->remote_id
    );

    $data = array();
    $data['type'] = $entity->bundle_type;
    if ($transformers) $data['transformer'] = $transformers;

    $parents = field_get_items('edoweb_basic', $entity, 'field_edoweb_struct_parent');
    if (FALSE !== $parents) {
      $data['parentPid'] = $parents[0]['value'];
    }

    $http_response = $this->_http_put($http_url, json_encode($data), 'application/json');
    if (200 != $http_response->code) {
      watchdog('edoweb_storage', 'Unable to save @id to @api.',
        array(
          '@id' => $entity->remote_id,
          '@api' => variable_get('edoweb_api_host'),
        )
      );
      return FALSE;
    }
    return TRUE;
  }

  /*
   * Delete an entity via the API
   *
   * @param $entity
   *   The drupal entity to delete
   *
   */
  public function delete($entity) {
    // Delete resource
    $http_url = sprintf(
      'http://%s:%s@%s/resource/%s',
      $this->__edoweb_api_user,
      $this->__edoweb_api_pass,
      $this->__edoweb_api_host,
      $entity->remote_id
    );

    $http_response = $this->_http_delete($http_url);
    if (200 != $http_response->code) {
      watchdog('edoweb_storage', 'Unable to delete @id from @api.',
        array(
          '@id' => $entity->remote_id,
          '@api' => variable_get('edoweb_api_host'),
        )
      );
      return;
    }
  }

  /*
   * Import an entity based on its remote id.
   */
  public function importEntity($remote_id, $import_mode = 'overwrite') {

    if (is_null(LinkedDataClient::getTripleStore())) {
      $linkedDataClient = new LinkedDataClient();
      $http_url = _edoweb_expand_curie($remote_id);
      $repository_data = $linkedDataClient->getRDF($http_url);
    } else {
      $repository_data = LinkedDataClient::getTripleStore();
    }

    // Import the entity itself
    $entity = entity_get_controller('edoweb_basic')->createFromRdf(
      $remote_id, $repository_data
    );

    // Get local ID in case of overwriting
    if ('overwrite' == $import_mode) {
      $local_id = db_select('edoweb_basic')
        ->condition('remote_id', $remote_id, '=')
        ->fields('edoweb_basic', array('local_id'))
        ->execute()
        ->fetchField();
      $entity->local_id = $local_id;
    }
    $entity->created = time();
    $primary_keys = $entity->local_id ? 'local_id' : array();

    // Directly write out the entity record bypassing the controller to
    // prevent needlessly writing objects back to the API
    try {
      drupal_write_record('edoweb_basic', $entity, $primary_keys);
      watchdog('edoweb_storage', 'Imported @id.',
        array(
          '@id' => $remote_id,
        )
      );
    } catch (PDOException $e) {
      watchdog('edoweb_storage', 'Failed to import @id.',
        array(
          '@id' => $remote_id,
        )
      );
      return FALSE;
    }

    return TRUE;

  }

  /*
   * Import entities of a given bundle type.
   */
  public function import(
    $bundle_type,
    $import_mode = 'overwrite',
    $source = 'repo',
    $from = 0,
    $until = 10
  ){
    // Build resource list url
    $http_url = sprintf(
      'http://%s:%s@%s/resource?type=%s&getListingFrom=%s&from=%s&until=%s',
      $this->__edoweb_api_user,
      $this->__edoweb_api_pass,
      $this->__edoweb_api_host,
      $bundle_type,
      $source,
      $from,
      $until
    );

    // Fetch resource list
    $http_response = $this->_http_get($http_url, 'application/json');
    if ((200 != $http_response->code) || !isset($http_response->data)) {
      watchdog('edoweb_storage', 'Unable to fetch resource listing from @api.',
        array(
          '@api' => variable_get('edoweb_api_host'),
        )
      );
      return;
    }

    // Wipe existing records if requested
    if (('clear' == $import_mode) && (0 == $from)) {
      // Delete entity records
      $num_deleted = db_delete('edoweb_basic')
        ->condition('bundle_type', $bundle_type)
        ->execute();
      drupal_set_message("Deleted $num_deleted resources of type $bundle_type.");
    }

    // Process resource list
    $data = json_decode($http_response->data);
    $resource_list = property_exists($data, 'list') ? $data->list : array();
    foreach ($resource_list as $remote_id) {
      $this->importEntity($remote_id, $import_mode);
    }
    if ((count($resource_list) == 10)) {
      $this->import(
        $bundle_type, $import_mode, $source, $from + 10, $until + 10
      );
    }
  }

  public function index($entity) {
    // Index resource
    $http_url = sprintf(
      'http://%s:%s@%s/utils/index/%s?type=%s',
      $this->__edoweb_api_user,
      $this->__edoweb_api_pass,
      $this->__edoweb_api_host,
      $entity->remote_id,
      $entity->bundle_type
    );

    $http_response = $this->_http_post($http_url);
    if (200 != $http_response->code) {
      watchdog('edoweb_storage', 'Unable to index @id on @api.',
        array(
          '@id' => $entity->remote_id,
          '@api' => variable_get('edoweb_api_host'),
        )
      );
      return FALSE;
    }
    return TRUE;
  }

  public function query(EntityFieldQuery $efq) {
    static $query_count = 0;
    $page = pager_find_page($query_count);
    $efq->pager_num = $query_count;

    if (isset($efq->tags['elasticsearch'])) {
      $results = $this->_query_elasticsearch($efq, $page);
    } else if (isset($efq->tags['lobid'])) {
      $results = $this->_query_lobid($efq, $page);
    }

    $results_per_page = variable_get('edoweb_storage_results_per_page', 10);
    pager_default_initialize($results['hits'], $results_per_page, $query_count);
    $query_count++;
    return $results;
  }

  protected function _query_lobid(EntityFieldQuery $efq, $page = 0) {
    $lobid_host = variable_get('edoweb_lobid_host');
    $term = str_replace(
      ' ', '+', $efq->metaData['term']
    );
    $endpoint = $efq->metaData['endpoint'];
    $parameter = $efq->metaData['parameter'];

    $results_per_page = variable_get('edoweb_storage_results_per_page', 10);
    $from = array_key_exists('start', $efq->range)
      ? $efq->range['start']
      : $page * $results_per_page;
    $size = array_key_exists('length', $efq->range)
      ? $efq->range['length']
      : $results_per_page;
    $type = array_key_exists('type', $efq->metaData)
      ? $efq->metaData['type']
      : null;

    $http_url = sprintf(
      'http://%s/%s?%s=%s&from=%s&size=%s',
      $lobid_host, $endpoint, $parameter, urlencode($term), $from, $size
    );

    if ($type) {
      $bundle_infos = field_info_bundles(EDOWEB_ENTITY_TYPE);
      $bundle_info = $bundle_infos[$type];
      $rdf_types = array();
      foreach ($bundle_info['rdf_mapping']['rdftype'] as $rdf_type) {
        $rdf_types[] = _edoweb_expand_curie($rdf_type);
      }
      $http_url .= '&type=' . urlencode(implode(',', $rdf_types));
    }

    $http_response = $this->_http_get(
      $http_url, 'text/plain'
    );

    if (200 != $http_response->code || !isset($http_response->data)) {
      watchdog('edoweb_storage', 'Unable to execute query on @api.',
        array(
          '@api' => $lobid_host,
        )
      );
      return FALSE;
    }
    $rdf_parser = new LibRDF_Parser('ntriples');
    $rdf_model = new LibRDF_Model(new LibRDF_Storage());

    try {
      $rdf_model->loadStatementsFromString(
        $rdf_parser,
        $http_response->data
      );
    } catch (LibRDF_Error $e) {
      return FALSE;
    }

    $ontology_model = new LibRDF_Model(new LibRDF_Storage());
    $ontology_model->loadStatementsFromUri(
      new LibRDF_Parser('rdfxml'), 'file://' . __DIR__ . '/../edoweb/gnd.rdf'
    );
    $rdfs_reasoner = new LibRDF_Reasoner('rdfs');
    $rdf_model->inferStatements($rdfs_reasoner, $ontology_model);

    // Retrieve hit count
    $search_total_results = new LibRDF_URINode(
      'http://sindice.com/vocab/search#totalResults'
    );
    try {
      //FIXME: why does query URL as subject not work?
      //$hits = $rdf_model->getTarget(
      //  new LibRDF_URINode($http_url), $search_total_results
      //)->getValue();
      $hits = $rdf_model->findStatements(
        null, $search_total_results, null
      )->current()->getObject()->getValue();
    } catch (LibRDF_LookupError $e) {
      $hits = 0;
    }
    $results = array(
      'hits' => $hits
    );

    // Retrieve primary topics, i.e. actual result resources
    $foaf_primary_topic = new LibRDF_URINode(
      'http://xmlns.com/foaf/0.1/primaryTopic'
    );
    $primary_topics = $rdf_model->findStatements(
      null, $foaf_primary_topic, null
    );

    LinkedDataClient::setTripleStore($rdf_model);
    foreach ($primary_topics as $primary_topic) {
      $remote_id = $primary_topic->getObject()->getValue();
      $entity = entity_get_controller('edoweb_basic')->createFromRdf(
        $remote_id, $rdf_model
      );
      $results[EDOWEB_ENTITY_TYPE][$remote_id] = $entity;
    }
    return $results;
  }

  protected function _query_elasticsearch(EntityFieldQuery $efq, $page = 0) {
    // Search resources
    $http_url = sprintf(
      'http://%s:%s@%s/search/%s/_search',
      $this->__edoweb_api_user,
      $this->__edoweb_api_pass,
      $this->__edoweb_api_host,
      variable_get('edoweb_api_namespace')
    );
    $query = $this->_efq_to_es($efq, $page);

    $http_response = $this->_http_post(
      $http_url, $query, 'application/json'
    );

    if (200 != $http_response->code || !isset($http_response->data)) {
      watchdog('edoweb_storage', 'Unable to execute query on @api.',
        array(
          '@api' => variable_get('edoweb_api_host'),
        )
      );
      return FALSE;
    }

    $json_response = json_decode($http_response->data);
    $hits = $json_response->hits;
    $facets = isset($json_response->facets)
      ? $json_response->facets : array();

    $results = array(
      'hits' => $hits->total,
      'facets' => $facets,
      EDOWEB_ENTITY_TYPE => array(),
    );
    $rdf_parser = new LibRDF_Parser('ntriples');
    foreach ($hits->hits as $hit) {
      // Parse results
      $rdf_model = new LibRDF_Model(new LibRDF_Storage());
      $options = array(
        'format' => 'application/nquads',
      );

      try {
        $context_url = $hit->_source->{'@context'};
        // Cache context file for performance
        if (!file_exists('/tmp/' . basename($context_url))) {
          file_put_contents(
            '/tmp/' . basename($context_url),
            file_get_contents($context_url)
          );
        }
        $hit->_source->{'@context'} = 'file:///tmp/' . basename($context_url);
        $rdf_ntriples = _edoweb_escape_utf8(
          jsonld_to_rdf($hit->_source, $options)
        );
      } catch(JsonLdException $e) {
        watchdog('edoweb_storage', 'Unable to parse JSON LD');
        return FALSE;
      }
      $rdf_model = new LibRDF_Model(new LibRDF_Storage());
      $rdf_model->loadStatementsFromString(
        $rdf_parser,
        $rdf_ntriples
      );
      // Identify primary resource
      $ore_describes = $rdf_model->findStatements(
        null,
        new LibRDF_URINode(
          "http://www.openarchives.org/ore/terms/describes"
        ),
        null
      )->current();
      // Create entity
      if ($ore_describes) {
        $remote_id = $ore_describes->getObject()->getValue();
        $entity = entity_get_controller('edoweb_basic')->createFromRdf(
          $remote_id, $rdf_model
        );
        $results[EDOWEB_ENTITY_TYPE][$remote_id] = $entity;
      }
    }
    return $results;
  }

  protected function _efq_to_es(EntityFieldQuery $efq, $page = 0) {
    $query = array();
    $results_per_page = variable_get('edoweb_storage_results_per_page', 10);
    $query['from'] = array_key_exists('start', $efq->range)
      ? $efq->range['start']
      : $page * $results_per_page;
    $query['size'] = array_key_exists('length', $efq->range)
      ? $efq->range['length']
      : $results_per_page;

    if (array_key_exists('term', $efq->metaData)) {
      $query['query']['filtered']['query']['query_string']['query']
        = $efq->metaData['term'];
    }

    if (array_key_exists('bundle', $efq->entityConditions)) {
      $target_bundles = $efq->entityConditions['bundle']['value'];
      if (!is_array($target_bundles)) {
        $target_bundles = array($target_bundles);
      }
      $query['query']['filtered']['filter']['bool']['must'][]['terms']["@graph.contentType.@value"]
        = array_values($target_bundles);
    }

    foreach($efq->propertyConditions as $property_condition) {
      // TODO: Handle via RDF mapping
      switch ($property_condition['column']) {
        case 'uid':
          $uids = $property_condition['value'];
          if (!is_array($uids)) {
            $uids = array($uids);
          }
          $query['query']['filtered']['filter']['bool']['must'][]['terms']
            ["@graph.creator.@value"] = $uids;
          break;
      }
    }

    foreach($efq->fieldConditions as $field_condition) {
      $bool_op = empty($field_condition['delta_group'])
        ? 'and' : $field_condition['delta_group'];
      $field_name = $field_condition['field']['field_name'];
      $json_ld_property = _field_name_to_jsonld_key($field_name);
      $field_value = $field_condition['value'];
      if ($bool_op == 'and') {
        $query['query']['filtered']['filter']['bool']['must'][]['term']["@graph.$json_ld_property.@value"] = "$field_value";
      } else if ($bool_op == 'or') {
        $query['query']['filtered']['filter']['bool']['should'][]['term']["@graph.$json_ld_property.@value"] = "$field_value";
      }
    }

    if (!isset($query['query'])) {
      $query['query'] = array("match_all" => new stdClass());
    }

    $query['sort'] = array();
    foreach($efq->order as $sort) {
      switch ($sort['type']) {
        case 'property':
          $property_name = $sort['specifier'];
          if ($property_name == 'updated') {
            $jsonld_property = 'modified';
          }
          break;
        case 'field':
          $field_name = $sort['specifier']['field']['field_name'];
          $jsonld_property = _field_name_to_jsonld_key($field_name);
          break;
        default:
          break;
      }
      $order = $sort['direction'];
      if ($jsonld_property) {
        $query['sort'][]["@graph.$jsonld_property.@value"] = array(
          'order' => $order,
          'ignore_unmapped' => TRUE,
        );
      }
    }

    $query['facets']['creator']['terms']['field']
      = '@graph.creator.@value';
    $query['facets']['contentType']['terms']['field']
      = '@graph.contentType.@value';
    $query['facets']['subject']['terms']['field']
      = '@graph.subject.@value';
    $query['facets']['issued']['terms']['field']
      = '@graph.issued.@value';
    return json_encode($query);
  }

  protected function _http_multipart_put($request_url, $file_path, $content_type = null, $file_name = null) {
    $data = array(
      'data' => "@$file_path",
      'type' => $content_type,
      'label' => $file_name,
      'checksum' => md5_file($file_path),
    );
    $ch = curl_init($request_url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_CUSTOMREQUEST, 'PUT');
    curl_setopt($ch, CURLOPT_POSTFIELDS, $data);
    curl_setopt($ch, CURLOPT_HTTPHEADER, array('Content-type: multipart/mixed'));
    $response = curl_exec($ch);
    $response_code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    if (417 == $response_code) {
      $admin_mail = variable_get('site_mail', ini_get('sendmail_from'));
      drupal_set_message(t("
        Beim Übertragen der Datei ist ein Problem aufgetreten. Bitte
        laden Sie die Datei erneut hoch. Sollte das Problem weiterhin
        bestehen, wenden Sie sich an <a href=\"mailto:$admin_mail\">
        $admin_mail</a>."), 'error'
      );
    } else if (curl_errno($ch) || 200 != $response_code) {
      watchdog('edoweb_storage', 'Error uploading file @file to @api.',
        array(
          '@file' => $file_path,
          '@api' => variable_get('edoweb_api_host'),
        )
      );
      return FALSE;
    } else {
      return TRUE;
    }
  }

  protected function _http_put($request_url, $request_body = '', $content_type='text/plain') {
    $http_options = array(
      'method' => 'PUT',
      'data' => $request_body,
      'headers' => array('Content-Type' => $content_type),
    );
    return _edoweb_http_request($request_url, $http_options);
  }

  protected function _http_post($request_url, $request_body = '', $content_type='text/plain') {
    $http_options = array(
      'method' => 'POST',
      'data' => $request_body,
      'headers' => array('Content-Type' => $content_type),
    );
    return _edoweb_http_request($request_url, $http_options);
  }

  protected function _http_get($request_url, $content_type = 'text/plain') {
    $http_options = array(
      'method' => 'GET',
      'headers' => array('Accept' => $content_type),
    );
    return _edoweb_http_request($request_url, $http_options);
  }

  protected function _http_delete($request_url) {
    $http_options = array(
      'method' => 'DELETE',
    );
    return _edoweb_http_request($request_url, $http_options);
  }

  protected function _http_head($request_url) {
    $http_options = array(
      'method' => 'HEAD',
    );
    return _edoweb_http_request($request_url, $http_options);
  }

}

