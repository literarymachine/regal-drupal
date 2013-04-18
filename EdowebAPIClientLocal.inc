<?php

/*
 * An edoweb api client that acts on local files.
 */
class EdowebAPIClientLocal implements EdowebAPIClientInterface {

  /*
   * Load an entity from the API.
   *
   * @param $entity
   *   The drupal entity to load data into
   */
  public function load($entity) {
    $rdf_subject = _edoweb_storage_entity_get_uri($entity);
    $id = _edoweb_storage_entity_get_id($entity);
    $rdf_data = file_get_contents("/tmp/{$id}.ttl");
    $rdf_parser = new LibRDF_Parser('turtle');
    _edoweb_storage_entity_deserialize_rdf($entity, $rdf_subject, $rdf_data, $rdf_parser);
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
    $json = _edoweb_storage_entity_serialize_jsonld($entity);
    $rdf = _edoweb_storage_entity_serialize_turtle($entity);
    $id = _edoweb_storage_entity_get_id($entity);
    file_put_contents("/tmp/{$id}.ttl", $rdf);
    file_put_contents("/tmp/{$id}.json", $json);
    return TRUE;
  }

}
