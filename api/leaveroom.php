<?php

use GT\Input\Input;
use Gt\Session\Session;
use GT\Ulid\Ulid;

function go(
    Input $input,
    Session $session,
)
{
    $userId = $session->get("userId");
    if (!$userId) {
        $userId = new Ulid("USER");
        $session->set("userId", $userId);
    }

    $roomCode = $input->get("roomCode");
    $roomDir = "data/rooms/$roomCode";

    //find current user data file
    $userFileName = $roomDir . "/$userId.json";
    unlink($userFileName);
}