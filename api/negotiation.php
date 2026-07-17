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
    $toUserId = $input->getString("toUserId");
    $type = $input->getString("type");
    $data = $input->getString("data");

    $roomDir = "data/rooms/$roomCode";

    //find current user data file
    $userFileName = $roomDir . "/$userId.json";
    $userFile = file_exists($userFileName) ? json_decode(file_get_contents($userFileName), true) : [];

    $userFile["peers"][$toUserId][$type] = $data;

    file_put_contents($userFileName, json_encode($userFile, JSON_PRETTY_PRINT));
}