<?php

//require_once dirname(__FILE__) . '/lib/LibRDF/LibRDF/LibRDF.php';
//require_once dirname(__FILE__) . '/lib/php-json-ld/jsonld.php';

interface EdowebAPIClientInterface {
  public function load($entity);
  public function save($entity);
}

/*************************
 * Edoweb helper functions
 *************************/

define('EDOWEB_ENTITY_TYPE', 'edoweb_basic');

function _edoweb_storage_entity_serialize_turtle($entity) {
  $rdf_subject = _edoweb_storage_entity_get_uri($entity);
  $rdf_serializer = new LibRDF_Serializer('turtle');
  return _edoweb_storage_entity_serialize_rdf($entity, $rdf_subject, $rdf_serializer);
}

function _edoweb_storage_entity_serialize_ntriples($entity) {
  $rdf_subject = _edoweb_storage_entity_get_uri($entity);
  $rdf_serializer = new LibRDF_Serializer('ntriples');
  return _edoweb_storage_entity_serialize_rdf($entity, $rdf_subject, $rdf_serializer);
}

function _edoweb_storage_entity_serialize_rdf($entity, $rdf_subject, $rdf_serializer) {
  $rdf_model = new LibRDF_Model(new LibRDF_Storage());
  $rdf_mapping = rdf_mapping_load(
    EDOWEB_ENTITY_TYPE, _edoweb_storage_entity_get_bundle($entity)
  );
  // First element contains the rdf:type definitions
  $rdf_type_predicate = new LibRDF_URINode(
    'http://www.w3.org/1999/02/22-rdf-syntax-ns#type'
  );
  foreach (array_shift($rdf_mapping) as $rdf_type_mapping) {
    $rdf_type_statement = new LibRDF_Statement(
      $rdf_subject, $rdf_type_predicate,
      new LibRDF_URINode(_edoweb_expand_curie($rdf_type_mapping))
    );
    $rdf_model->addStatement($rdf_type_statement);
  }

  $wrapper = entity_metadata_wrapper(EDOWEB_ENTITY_TYPE, $entity);
  // Following elements contain predicate mappings
  foreach ($rdf_mapping as $field_name => $field_mapping) {
    $rdf_predicate = new LibRDF_URINode(
      _edoweb_expand_curie($field_mapping['predicates'][0])
    );
    try {
      $items = $wrapper->{$field_name}->value();
    } catch (EntityMetadataWrapperException $e) {
      // Field is not available for this entity
      //drupal_set_message($e->getMessage(), 'error');
      continue;
    }
    if (!is_array($items)) $items = array($items);
    if (TRUE === empty($items)) continue;
    // Special case: handle file fields
    if ('field_edoweb_file' == $field_name) {
      foreach ($items as $item) {
        $file = file_load($item['fid']);
        $rdf_object = new LibRDF_URINode($file->uri);
        $rdf_statement = new LibRDF_Statement(
          $rdf_subject, $rdf_predicate, $rdf_object
        );
        $rdf_model->addStatement($rdf_statement);
      }
    } else {
      foreach ($items as $item) {
        if (isset($field_mapping['type'])
            and $field_mapping['type'] == 'rel') {
          if (is_object($item)) {
            $rdf_object = _edoweb_storage_entity_get_uri($item);
          } else {
            $rdf_object = new LibRDF_URINode($item);
          }
        } else {
          $rdf_object = new LibRDF_LiteralNode($item);
        }
        $rdf_statement = new LibRDF_Statement(
          $rdf_subject, $rdf_predicate, $rdf_object
        );
        $rdf_model->addStatement($rdf_statement);
      }
    }
  }
  foreach (rdf_get_namespaces() as $prefix => $namespace) {
    _edoweb_log("mapping: $prefix to $namespace\n");
    $rdf_serializer->setNamespace($namespace, $prefix);
  }
  return $rdf_model->serializeStatements($rdf_serializer);
}

function _edoweb_storage_entity_deserialize_rdf($entity, $rdf_subject, $rdf_data, $rdf_parser) {
  $rdf_mapping = rdf_mapping_load(
    EDOWEB_ENTITY_TYPE, _edoweb_storage_entity_get_bundle($entity)
  );
  $rdf_model = new LibRDF_Model(new LibRDF_Storage());
  $rdf_model->loadStatementsFromString($rdf_parser, $rdf_data);
  LibRDF_LiteralNode::setPlainOutput(true);

  // Skip first element, these are the rdf:type definitions
  unset($rdf_mapping[key($rdf_mapping)]);
  $wrapper = entity_metadata_wrapper(EDOWEB_ENTITY_TYPE, $entity);
  foreach ($rdf_mapping as $field_name => $mapping) {
    $rdf_predicate = new LibRDF_URINode(
      _edoweb_expand_curie($mapping['predicates'][0])
    );
    // Special case for file field
    if ('field_edoweb_file' == $field_name) {
      foreach ($rdf_model->getTargets($rdf_subject, $rdf_predicate) as $value) {
        $file_id = db_query(
          'SELECT fid FROM {file_managed} WHERE uri = :uri',
          array(':uri' => substr($value, 1, -1))
        )->fetchField();
        $file = file_load($file_id);
        $wrapper->{$field_name}[] = (array) $file;
      }
    } else {
      foreach ($rdf_model->getTargets($rdf_subject, $rdf_predicate) as $value) {
        try {
          if ($value instanceOf LibRDF_LiteralNode) {
            if ($wrapper->{$field_name} instanceOf EntityValueWrapper) {
              $wrapper->{$field_name} = (string) $value;
            } else {
              $wrapper->{$field_name}[] = (string) $value;
            }
          } else {
            //FIXME: hardcoded translation of uuid-uri to local id
            if ('<uuid:' === substr($value, 0, 6)) {
              $value = substr($value, strpos($value, ':') + 1, -1);
            } else {
              $value = substr($value, 1, -1);
            }
            if ($wrapper->{$field_name} instanceOf EntityValueWrapper) {
              $wrapper->{$field_name} = $value;
            } else {
              $wrapper->{$field_name}[] = $value;
            }
          }
          //drupal_set_message("Populated $field_name.");
        } catch (EntityMetadataWrapperException $e) {
          //drupal_set_message($e->getMessage(), 'error');
        }
      }
    }
  }
}

function _edoweb_storage_entity_get_uri($entity) {
  $entity_ids = entity_extract_ids(EDOWEB_ENTITY_TYPE, $entity);
  return new LibRDF_URINode("uuid:{$entity_ids[0]}");
}

function _edoweb_storage_entity_get_id($entity) {
  $entity_ids = entity_extract_ids(EDOWEB_ENTITY_TYPE, $entity);
  return $entity_ids[0];
}

function _edoweb_storage_entity_get_bundle($entity) {
  $entity_ids = entity_extract_ids(EDOWEB_ENTITY_TYPE, $entity);
  return $entity_ids[2];
}

function _edoweb_storage_entity_serialize_jsonld($entity) {
  $rdf_mapping = rdf_mapping_load(
    EDOWEB_ENTITY_TYPE, _edoweb_storage_entity_get_bundle($entity)
  );
  $jsonld_context = new stdClass();
  $rdf_namespaces = rdf_get_namespaces();
  foreach ($rdf_namespaces as $prefix => $uri) {
    $jsonld_context->{$prefix} = $uri;
  }
  _edoweb_storage_entity_get_uri($entity);
  $rdf_subject = _edoweb_storage_entity_get_uri($entity);
  $rdf_serializer = new LibRDF_Serializer('ntriples');
  $rdf_ntriples = _edoweb_storage_entity_serialize_rdf($entity, $rdf_subject, $rdf_serializer);
  $rdf_jsonld = jsonld_compact(jsonld_from_rdf($rdf_ntriples), $jsonld_context);
  return str_replace('\\/', '/', json_encode($rdf_jsonld));
}

function _edoweb_storage_entity_deserialize_jsonld($entity, $rdf_subject, $rdf_data) {
  $options = array();
  $options['format'] = 'application/nquads';
  $rdf_ntriples = jsonld_to_rdf(json_decode($rdf_data), $options);
  $rdf_parser = new LibRDF_Parser('ntriples');
  return _edoweb_storage_entity_deserialize_rdf($entity, $rdf_subject, $rdf_ntriples, $rdf_parser);
}

function _edoweb_log($message, $target='php://stderr') {
  // file_put_contents($target, $message);
}

function _edoweb_expand_curie($curie) {
  $rdf_namespaces = rdf_get_namespaces();
  list($curie_prefix, $curie_local) = explode(':', $curie);
  return $rdf_namespaces[$curie_prefix] . $curie_local;
}
