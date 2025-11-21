<?php
header('Access-Control-Allow-Origin: *');
header('Content-Type: text/html; charset=utf-8');

$source = $_GET['source'] ?? null;
$urlParam = $_GET['url'] ?? null;
$session = $_GET['phpsessid'] ?? '';

$allowedSources = [
    'premium' => 'https://rumedia.io/media/admin-cp/manage-songs?check_pro=1',
    'singles' => 'https://rumedia.io/media/admin-cp/manage-songs?check=1',
];

$target = $urlParam ?: ($source && isset($allowedSources[$source]) ? $allowedSources[$source] : '');

if (!$target) {
    http_response_code(400);
    echo json_encode(['error' => 'Missing target url']);
    exit;
}

if (strpos($target, 'https://rumedia.io/media/admin-cp/manage-songs') !== 0) {
    http_response_code(403);
    echo json_encode(['error' => 'Forbidden target']);
    exit;
}

$headers = [
    'User-Agent: Mozilla/5.0',
];

if ($session) {
    $headers[] = 'Cookie: PHPSESSID=' . $session;
}

$ch = curl_init($target);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);

$response = curl_exec($ch);

if ($response === false) {
    http_response_code(500);
    echo json_encode(['error' => curl_error($ch)]);
} else {
    echo $response;
}

curl_close($ch);
