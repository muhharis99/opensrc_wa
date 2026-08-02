<?php

declare(strict_types=1);

final class OpenSrcWa
{
    public function __construct(
        private readonly string $baseUrl,
        private readonly string $apiKey,
    ) {
    }

    /** @return array<string, mixed> */
    public function sendText(string $sessionId, string $to, string $text, string $idempotencyKey): array
    {
        $payload = json_encode([
            'session_id' => $sessionId,
            'to' => $to,
            'text' => $text,
            'idempotency_key' => $idempotencyKey,
        ], JSON_THROW_ON_ERROR);

        $context = stream_context_create([
            'http' => [
                'method' => 'POST',
                'header' => "Content-Type: application/json\r\nX-API-Key: {$this->apiKey}\r\n",
                'content' => $payload,
                'timeout' => 10,
                'ignore_errors' => true,
            ],
        ]);
        $response = file_get_contents($this->baseUrl . '/api/v1/messages/text', false, $context);
        if ($response === false) {
            throw new RuntimeException('Gateway tidak dapat dihubungi.');
        }
        /** @var array<string, mixed> $decoded */
        $decoded = json_decode($response, true, flags: JSON_THROW_ON_ERROR);
        if (($decoded['success'] ?? false) !== true) {
            throw new RuntimeException((string) ($decoded['error']['message'] ?? 'Gateway error'));
        }
        return $decoded;
    }
}
