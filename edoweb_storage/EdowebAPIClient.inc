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
    // Fetch and add relations and files
    $http_url = sprintf(
      'http://%s:%s@%s/resource/%s',
      $this->__edoweb_api_user,
      $this->__edoweb_api_pass,
      $this->__edoweb_api_host,
      $entity->remote_id
    );
    $http_response = $this->_http_get($http_url, 'application/rdf+xml');
    if ((200 == $http_response->code) && isset($http_response->data)) {
      $wrapper = entity_metadata_wrapper(EDOWEB_ENTITY_TYPE, $entity);
      $repository_data = new LibRDF_Model(new LibRDF_Storage());
      $repository_data->loadStatementsFromString(
        new LibRDF_Parser('rdfxml'), $http_response->data
      );
      // Fetch and add non-descriptive fields
      $this->_attachUnmappedFields(
        $entity, $repository_data, array(
          'field_edoweb_struct_child',
          'field_edoweb_struct_parent',
          'field_edoweb_filesize',
        )
      );
      // FIXME: hardcoded URL for datastreams
      // TODO: decide on explicit rdf property for datastream links
      if (_edoweb_field_access($entity, array('field_edoweb_datastream'))) {
        $wrapper->field_edoweb_datastream =
          "http://{$this->__edoweb_api_host}/resource/{$entity->remote_id}/data";
      }
      // Load remaining (descriptive) metadata into fields
      $rdf_subject = _edoweb_storage_entity_get_uri($entity);
      $rdf_data = $http_response->data;
      $rdf_parser = new LibRDF_Parser('rdfxml');
      _edoweb_storage_entity_deserialize_rdf($entity, $rdf_subject, $rdf_data, $rdf_parser);
    } else {
      watchdog('edoweb_storage', 'Unable to load data for @id from @api.',
        array(
          '@id' => $entity->remote_id,
          '@api' => variable_get('edoweb_api_host'),
        )
      );
      return FALSE;
    }
    return TRUE;
  }

  protected function _attachUnmappedFields($entity, $data, $field_names) {
    foreach ($field_names as $field_name) {
      $this->_attachUnmappedField($entity, $data, $field_name);
    }
  }

  /*
   * Load the value for a field that is not mapped via hook_rdf_mapping
   * (currently all fields mapped there are written as descriptive
   * metadata, but some fields are not descriptive).
   * TODO: Implement metadata roles in hook_rdf_mapping
   */
  protected function _attachUnmappedField($entity, $data, $field_name) {
    $mapping = array(
      'field_edoweb_struct_parent' =>
        new LibRDF_URINode('http://purl.org/dc/terms/isPartOf'),
      'field_edoweb_struct_child' =>
        new LibRDF_URINode('http://purl.org/dc/terms/hasPart'),
      'field_edoweb_filesize' =>
        new LibRDF_URINode('http://downlode.org/Code/RDF/File_Properties/schema#size'),
    );

    // Fetch and add values
    $value_nodes = $data->getTargets(
      _get_rdf_subject($entity, $field_name),
      $mapping[$field_name]
    );
    $wrapper = entity_metadata_wrapper(EDOWEB_ENTITY_TYPE, $entity);
    LibRDF_LiteralNode::setPlainOutput(true);
    foreach ($value_nodes as $value_node) {
      if ($value_node instanceOf LibRDF_LiteralNode) {
        $value = "$value_node";
      } else {
        $remote_id = substr($value_node, 1, -1);
        $value = db_query(
          'SELECT local_id FROM {edoweb_basic} WHERE remote_id = :remote_id',
          array(':remote_id' => $remote_id)
        )->fetchField();
      }
      try {
        if ($wrapper->$field_name instanceOf EntityValueWrapper) {
          $wrapper->{$field_name} = $value;
        } else {
          $wrapper->{$field_name}[] = $value;
        }
      } catch (EntityMetadataWrapperException $e) {
        watchdog('edoweb_storage', 'Unable to attach data @data for @field_name to @entity_id.',
          array(
            '@data' => $value,
            '@field_name' => $field_name,
            '@entity_id' => $entity->remote_id,
          )
        );
      }
    }
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

    $this->saveResource($entity);
    // Store attached files first, as entity metadata has to be
    // updated with corresponding new file URIs
    $this->saveFiles($entity);
    $this->saveMetadata($entity);

  }

  public function saveMetadata($entity) {
    // Send metadata
    $http_post_data = _edoweb_storage_entity_serialize_ntriples($entity);
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
        $entity->field_edoweb_datastream[LANGUAGE_NONE][0]['value'] =
          "http://{$this->__edoweb_api_host}/resource/{$entity->remote_id}/data";
        unlink($file_path);
        cache_clear_all("field:edoweb_basic:{$entity->local_id}", 'cache_field');
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
      $local_id = $parents[0]['target_id'];
      $data['parentPid'] = _edoweb_storage_entity_get_remote_id($local_id);
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
  public function importEntity($remote_id, $import_mode = 'overwrite', $metadata_required = FALSE) {

    // Check for metadata
    $http_url = sprintf(
      'http://%s:%s@%s/resource/%s/metadata',
      $this->__edoweb_api_user,
      $this->__edoweb_api_pass,
      $this->__edoweb_api_host,
      $remote_id
    );
    $http_response = $this->_http_get($http_url);
    if (404 == $http_response->code && 1 == $metadata_required) {
      watchdog('edoweb_storage', 'Unable to import required metadata for @id from @api.',
        array(
          '@id' => $entity->remote_id,
          '@api' => variable_get('edoweb_api_host'),
        )
      );
      return FALSE;
    }

    // Import the entity itself
    $http_url = sprintf(
      'http://%s:%s@%s/resource/%s',
      $this->__edoweb_api_user,
      $this->__edoweb_api_pass,
      $this->__edoweb_api_host,
      $remote_id
    );
    $http_response = $this->_http_get($http_url, 'application/rdf+xml');
    if (200 != $http_response->code || !isset($http_response->data)) {
      watchdog('edoweb_storage', 'Unable to import @id from @api.',
        array(
          '@id' => $remote_id,
          '@api' => variable_get('edoweb_api_host'),
        )
      );
      return FALSE;
    }
    $repository_data = new LibRDF_Model(new LibRDF_Storage());
    $repository_data->loadStatementsFromString(
      new LibRDF_Parser('rdfxml'), $http_response->data
    );
    LibRDF_LiteralNode::setPlainOutput(true);
    $bundle_type = (string) $repository_data->getTarget(
      new LibRDF_URINode($remote_id),
      new LibRDF_URINode('http://hbz-nrw.de/regal#contentType')
    );
    $entity = entity_get_controller('edoweb_basic')->create($bundle_type);
    if ('overwrite' == $import_mode) {
      $local_id = db_select('edoweb_basic')
        ->condition('remote_id', $remote_id, '=')
        ->fields('edoweb_basic', array('local_id'))
        ->execute()
        ->fetchField();
      $entity->local_id = $local_id;
    }
    $entity->created = time();
    $entity->remote_id = $remote_id;
    $primary_keys = $entity->local_id ? 'local_id' : array();

    // Directly write out the entity record bypassing the controller to
    // prevent needlessly writing objects back to the API
    try {
      drupal_write_record('edoweb_basic', $entity, $primary_keys);
      drupal_set_message("Imported $remote_id.");
    } catch (PDOException $e) {
      drupal_set_message("Failed to import $remote_id.");
      return FALSE;
    }

    // TODO: Load entity so that it is cached.
    // $this->load($entity);

    // Fetch and add child relations.
    $children = $repository_data->getTargets(
      new LibRDF_URINode($entity->remote_id),
      new LibRDF_URINode('http://purl.org/dc/terms/hasPart')
    );
    foreach ($children as $child) {
      $remote_id = substr($child, 1, -1);
      $this->importEntity($remote_id, $import_mode, $metadata_required);
    }

    return TRUE;

  }

  /*
   * Import entities of a given bundle type.
   */
  public function import(
    $bundle_type,
    $import_mode = 'overwrite',
    $metadata_required = FALSE,
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
      $this->importEntity($remote_id, $import_mode, $metadata_required);
    }
    if ((count($resource_list) == 10)) {
      $this->import(
        $bundle_type, $import_mode, $metadata_required, $source, $from + 10, $until + 10
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
    // Search resources
    $http_url = sprintf(
      'http://%s:%s@%s:9200/edoweb/_search',
      $this->__edoweb_api_user,
      $this->__edoweb_api_pass,
      $this->__edoweb_api_host
    );
    $query = $this->_efq_to_es($efq);
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
    $hits = json_decode($http_response->data)->hits;
    $results_per_page = variable_get('edoweb_storage_results_per_page', 10);
    pager_default_initialize($hits->total, $results_per_page);
    $results = array();
    foreach ($hits->hits as $hit) {
      $graphs = $hit->_source->{'@graph'};
      foreach ($graphs as $graph) {
        if (property_exists($graph, 'http://hbz-nrw.de/regal#contentType')) {
          $type = $graph->{'http://hbz-nrw.de/regal#contentType'}[0]->{'@value'};
          $entity = new stdClass();
          $entity->bundle_type = $type;
          $entity->remote_id = $graph->{'@id'};
          $rdf_subject = new LibRDF_URINode($graph->{'@id'});
          $entity->local_id = _edoweb_storage_entity_get_id($rdf_subject);
          _edoweb_storage_entity_deserialize_jsonld(
            $entity, $rdf_subject, json_encode($graph)
          );
          $results['edoweb_basic'][$entity->local_id] = $entity;
        }
      }
    }
    return $results;
  }

  protected function _efq_to_es(EntityFieldQuery $efq) {
    $query = array();
    $page = pager_find_page();
    $results_per_page = variable_get('edoweb_storage_results_per_page', 10);
    $query['from'] = $results_per_page * $page;
    $query['size'] = $results_per_page;

    // Since all values are in fields, propertyConditions are used
    // for special queries such as fulltext search over all fields
    foreach($efq->propertyConditions as $property_condition) {
      switch ($property_condition['column']) {
        case '*':
          $query['query']['bool']['must'][]['query_string']['query'] = $property_condition['value'];
          break;
        case 'type':
          $query['query']['bool']['must'][]['field']["@graph.http://hbz-nrw.de/regal#contentType.@value"] = "\"file\"";
          break;
        default:
          break;
      }
    }

    $rdf_mapping = rdf_mapping_load(EDOWEB_ENTITY_TYPE);
    $rdf_namespaces = rdf_get_namespaces();
    foreach($efq->fieldConditions as $field_condition) {
      $field_name = $field_condition['field']['field_name'];
      $field_value = $field_condition['value'];
      // Special cases for unmapped structural fields
      switch ($field_name) {
        case 'field_edoweb_struct_parent':
          $field_property = 'http://purl.org/dc/terms/isPartOf';
          $value_type = 'id';
          break;
        case 'field_edoweb_struct_child':
          $field_property = 'http://purl.org/dc/terms/hasPart';
          $value_type = 'id';
        default:
          // Map field name to full property URI
          $curie = $rdf_mapping[$field_name]['predicates'][0];
          list($prefix, $local) = explode(':', $curie);
          $field_property = $rdf_namespaces[$prefix] . $local;
          $value_type =
            (isset($rdf_mapping['type']) && $rdf_mapping['type'] == 'rel') ? 'id' : 'value';
          break;
      }
      $query['query']['bool']['must'][]['field']["@graph.$field_property.@$value_type"] = "\"$field_value\"";
    }

    if (!isset($query['query'])) {
      $query['query'] = array("match_all" => new stdClass());
    }

    $query['sort'] = array();
    foreach($efq->order as $sort) {
      $fieldname = $sort['specifier'];
      $order = $sort['direction'];
      $query['sort'][]["@graph.$fieldname.@value"] = array(
        'order' => $order,
        'ignore_unmapped' => TRUE,
      );
    }
    return json_encode($query);
  }

  protected function _http_multipart_put($request_url, $file_path, $content_type = null, $file_name = null) {
    $data = array(
      'data' => "@$file_path",
      'type' => $content_type,
      'label' => $file_name,
    );
    $ch = curl_init($request_url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_CUSTOMREQUEST, 'PUT');
    curl_setopt($ch, CURLOPT_POSTFIELDS, $data);
    curl_setopt($ch, CURLOPT_HTTPHEADER, array('Content-type: multipart/mixed'));
    $response = curl_exec($ch);
    if (curl_errno($ch) && 1 == variable_get('edoweb_api_debug')) {
      drupal_set_message(curl_error($ch));
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

