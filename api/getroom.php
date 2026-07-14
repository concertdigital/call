<?php

use GT\Input\Input;
use GT\Json\Schema\JSONDocument;
use Gt\Session\Session;
use GT\Ulid\Ulid;

function go(
    JSONDocument $json,
    Input $input,
    Session $session,
)
{
    $userId = $session->get("userId");
    if (!$userId) {
        $userId = new Ulid("USER");
        $session->set("userId", $userId);
    }

    $roomCode = $input->getString('code');

    //find room data or create it if it doesn't exist
    $roomDir = "data/rooms/$roomCode";

    if (!is_dir($roomDir)) {
        mkdir($roomDir, 0777, true);
    }

    //find current user data file
    $userFileName = $roomDir . "/$userId.json";
    $userFile = file_exists($userFileName) ? json_decode(file_get_contents($userFileName), true) : [];
    $userFile["id"] = (string)$userId;


    //find other user files
    $users = [];
    foreach (glob($roomDir . "/*.json") as $file) {
        $fileUserId = basename($file, '.json');

        // Ignore current user
        if ($fileUserId == $userId) {
            continue;
        }

        $users[$fileUserId] = json_decode(
            file_get_contents($file),
            true
        );
    }

    //right now we're only going to support one other user, but soon we will expand this
    foreach ($users as $otherUserId => $otherUser) {
        if ($otherUserId > $userId) {
            //we are offerer
            $userFile["role"] = "offerer";

            if ($input->getString("offer")) {
                $userFile["offer"] = json_decode($input->getString("offer"));
            }

        } else {
            //we are receiver
            $userFile["role"] = "receiver";

            if ($input->getString("answer")) {
                $userFile["answer"] = json_decode($input->getString("answer"));
            }
        }
    }

    //build room data
    $room = [
        "code" => $roomCode,
        "participants" => count($users) + 1,
        "me" => $userFile,
        "others" => $users,
    ];

    $userFile["lastSeen"] = new DateTime()->format("Y-m-d H:i:s");
    file_put_contents($userFileName, json_encode($userFile, JSON_PRETTY_PRINT));

    //clean up disconnected clients
    foreach ($users as $user) {
        $lastSeen = new DateTime($user["lastSeen"]);
        $now = new DateTime();

        if ($lastSeen < $now->modify('-5 seconds')) {
            unlink($roomDir . "/{$user["id"]}.json");
        }
    }

    $json->set("room", $room);
}