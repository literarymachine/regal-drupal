<?php

//require_once dirname(__FILE__) . '/lib/LibRDF/LibRDF/LibRDF.php';
//require_once dirname(__FILE__) . '/lib/php-json-ld/jsonld.php';

interface EdowebAPIClientInterface {
  public function load($entity);
  public function save($entity);
}

