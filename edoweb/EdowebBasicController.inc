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

class EdowebBasicController extends EntityAPIController {

  private $__entity_loaded = array();

  /**
   * Load an edoweb_basic entity.
   */
  public function load($remote_ids = array(), $conditions = array(), $rdf_model = null) {
    $cached_entities = $this->cacheGet($remote_ids, $conditions);
    $entities = array();
    foreach ($remote_ids as $remote_id) {
      if (array_key_exists($remote_id, $cached_entities)) {
        $entities[$remote_id] = $cached_entities[$remote_id];
      } else {
        $api = new EdowebAPIClient();
        if ($entity = $api->load($remote_id, $rdf_model)) {
          $entities[$remote_id] = $entity;
          $this->cacheSet(array($remote_id => $entities[$remote_id]));
        }
      }
    }
    return $entities;
  }

  public function clearCache($remote_id) {
  }

  public function createFromRdf($subject_uri, $rdf_model) {
    // FIXME: Properly handle namespaces at loading level
    $remote_id = _edoweb_compact_uri($subject_uri);
    $bundle_type = _edoweb_bundle_type_from_rdf($remote_id, $rdf_model);
    $entity = parent::create(
      array(
        'remote_id' => $remote_id,
        'bundle_type' => $bundle_type,
      )
    );
    $rdf_parser = new LibRDF_Parser('rdfxml');
    _edoweb_storage_entity_deserialize_rdf(
      $entity, "$rdf_model", $rdf_parser
    );
    return $entity;
  }

  /**
   * Saves the custom fields using drupal_write_record()
   * Storage of attached fields is handled by a custom
   * field storage (module edoweb_storage).
   */
  public function save($entity) {

    $invocation = isset($entity->remote_id)
     ? 'entity_update' : 'entity_insert';

    // If our entity has no owner, set current user.
    if (empty($entity->uid)) {
      global $user;
      $entity->uid = $user->uid;
    }
    // Invoke hook_entity_presave().
    module_invoke_all('entity_presave', $entity, 'edoweb_basic');

    // Save local record
    $api = new EdowebAPIClient();
    $api->save($entity);

    // Invoke either hook_entity_update() or hook_entity_insert().
    module_invoke_all($invocation, $entity, 'edoweb_basic');
    return $entity;

  }

  /**
   * Delete a single entity.
   *
   * Really a convenience function for delete_multiple().
   */
  public function delete($entity) {
    $this->delete_multiple(array($entity));
  }

  /**
   * Delete one or more edoweb_basic entities.
   *
   * @param $entities
   *   An array of entities
   */
  public function delete_multiple($entities) {
    if (!empty($entities)) {
      try {
        foreach ($entities as $entity) {
          // Invoke hook_entity_delete().
          module_invoke_all('entity_delete', $entity, 'edoweb_basic');
          $api = new EdowebAPIClient();
          $api->delete($entity);
        }
      } catch (Exception $e) {
        watchdog_exception('edoweb', $e);
        throw $e;
      }
    }
  }

}

