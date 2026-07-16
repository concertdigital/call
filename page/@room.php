<?php

use GT\Routing\Path\DynamicPath;

function go(
    DynamicPath $path,
	\GT\Dom\Document $document
) {
    $roomCode = $path->get();

    $document->querySelector("title")->innerHTML = $roomCode . " - Call by Concert";
}

