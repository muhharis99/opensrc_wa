<?php

declare(strict_types=1);

$secret = getenv('OPEN_SRC_WA_WEBHOOK_SECRET') ?: '';
$body = file_get_contents('php://input') ?: '';
$timestamp = $_SERVER['HTTP_X_OPENSRC_WA_TIMESTAMP'] ?? '';
$deliveryId = $_SERVER['HTTP_X_OPENSRC_WA_DELIVERY'] ?? '';
$event = $_SERVER['HTTP_X_OPENSRC_WA_EVENT'] ?? '';
$provided = preg_replace('/^sha256=/', '', $_SERVER['HTTP_X_OPENSRC_WA_SIGNATURE'] ?? '') ?: '';
$expected = hash_hmac('sha256', $timestamp . '.' . $deliveryId . '.' . $event . '.' . $body, $secret);

if ($secret === '' || abs(time() - strtotime($timestamp)) > 300 || !hash_equals($expected, $provided)) {
    http_response_code(401);
    exit;
}

$dedupeFile = sys_get_temp_dir() . '/opensrc-wa-delivery-' . preg_replace('/[^a-zA-Z0-9-]/', '', $deliveryId);
if (is_file($dedupeFile)) {
    http_response_code(204);
    exit;
}
file_put_contents($dedupeFile, (string) time(), LOCK_EX);

$data = json_decode($body, true, flags: JSON_THROW_ON_ERROR);
// Simpan event ke database aplikasi secara idempotent berdasarkan delivery ID.
http_response_code(204);
