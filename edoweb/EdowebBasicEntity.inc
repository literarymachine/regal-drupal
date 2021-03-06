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

class EdowebBasicEntity extends Entity {

  private $__source = null;

  public function __construct(array $values = array(), $entityType = NULL) {
    parent::__construct($values, $entityType);
    // Workaround for entity_js module which expects
    // bundle name in type property
    $this->type = $this->bundle();
  }

  protected function defaultUri() {
    if (isset($this->remote_id)) {
      return array(
        'path' => "resource/{$this->remote_id}",
      );
    }
  }

  public function url() {
    return url("resource/{$this->remote_id}", array('absolute' => TRUE));
  }

  public function identifier() {
    if (isset($this->remote_id) && _is_edoweb_entity($this)) {
      $remote_id = $this->remote_id;
    } else if (isset($this->remote_id)) {
      $remote_id = _edoweb_expand_curie($this->remote_id);
    } else {
      $remote_id = null;
    }
    return $remote_id;
  }

  public function internalIdentifier() {
    return isset($this->remote_id)
      ? $this->remote_id
      : null;
  }

  public function label() {
    $label_fields = array();

    switch ($this->bundle_type) {
      case 'monograph':
      case 'journal':
      case 'issue':
      case 'article':
      case 'collection':
      case 'volume':
      case 'file':
      case 'webpage':
      case 'version':
        $label_fields[] = 'field_edoweb_title';
        break;
      case 'person':
      case 'corporate_body':
      case 'subject':
      case 'event':
      case 'family':
      case 'work':
      case 'place':
      case 'authority_resource':
        $label_fields[] = 'field_gnd_name';
        break;
      default:
        $label_fields[] = 'field_edoweb_title';
        $label_fields[] = 'field_edoweb_label';
        break;
    }

    $wrapper = entity_metadata_wrapper('edoweb_basic', $this);
    $title_values = array();
    foreach ($label_fields as $label_field) {
      try {
        $title_value = $wrapper->$label_field->value();
        if ($title_value) $title_values[] = $title_value;
      } catch (EntityMetadataWrapperException $e) {
        // Field not available, ignore
      }
    }

    return (empty($title_values) && isset($this->remote_id))
      ? _edoweb_expand_curie($this->remote_id)
      : implode(' | ', $title_values);
  }

}
