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
    $userId = (string)$session->get("userId");
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

    $peers = [];
    foreach ($users as $otherUserId => $otherUser) {
        $peer = [];

        if ($otherUserId > $userId) {
            //we are offerer
            $peer["role"] = "offerer";

            //check for answer
            if (isset($otherUser["peers"][$userId]["answer"])) {
                $peer["answer"] = $otherUser["peers"][$userId]["answer"];
            }
            if (isset($otherUser["peers"][$userId]["offer"])) {
                $peer["offer"] = $otherUser["peers"][$userId]["offer"];
            }
        } else {
            //we are receiver
            $peer["role"] = "receiver";

            //check for offer
            if (isset($otherUser["peers"][$userId]["offer"])) {
                $peer["offer"] = $otherUser["peers"][$userId]["offer"];
            }
            if (isset($otherUser["peers"][$userId]["answer"])) {
                $peer["answer"] = $otherUser["peers"][$userId]["answer"];
            }
        }

        $peers[$otherUserId] = $peer;
    }
    $userFile["peers"] = $peers;

    //build room data
    $room = [
        "code" => $roomCode,
        "participants" => count($users) + 1,
        "me" => $userFile,
        "others" => $peers,
    ];

    $userFile["lastSeen"] = new DateTime()->format("Y-m-d H:i:s");
    file_put_contents($userFileName, json_encode($userFile, JSON_PRETTY_PRINT));

    //clean up disconnected clients
    foreach ($users as $user) {
        $lastSeen = new DateTime($user["lastSeen"]);
        $now = new DateTime();

        if ($lastSeen < $now->modify('-2 seconds')) {
            unlink($roomDir . "/{$user["id"]}.json");
        }
    }

    $json->set("room", $room);
}
