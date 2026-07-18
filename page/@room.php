<?php

use GT\Dom\Document;
use GT\Routing\Path\DynamicPath;

function go(
    DynamicPath $path,
	Document $document
) {
    $roomCode = $path->get();
    $document->querySelector("title")->innerHTML = $roomCode . " - Call by Concert";
}

