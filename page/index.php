<?php

use Gt\Http\Response;

function go(
    Response $response
) {
    $response->redirect(generateRoomCode());
}

function generateRoomCode() {
    $number = random_int(100000000, 999999999);
    return implode('-', str_split((string) $number, 3));
}