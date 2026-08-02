<?php

declare(strict_types=1);

final class OpenSrcWaClient
{
    public function __construct(
        private readonly string $baseUrl,
        private readonly string $apiKey,
        private readonly int $timeoutSeconds = 10,
    ) {
    }

    /** @return array<string, mixed> */
    public function createSession(string $sessionId): array
    {
        return $this->request('POST', '/api/v1/sessions', ['session_id' => $sessionId]);
    }

    /** @return array<string, mixed> */
    public function connect(string $sessionId): array
    {
        return $this->request('POST', '/api/v1/sessions/' . rawurlencode($sessionId) . '/connect');
    }

    /** @return array<string, mixed> */
    public function status(string $sessionId): array
    {
        return $this->request('GET', '/api/v1/sessions/' . rawurlencode($sessionId) . '/status');
    }

    /** @return array<string, mixed> */
    public function sendText(string $sessionId, string $to, string $text, string $idempotencyKey): array
    {
        return $this->request('POST', '/api/v1/messages/text', [
            'session_id' => $sessionId,
            'to' => $to,
            'text' => $text,
            'idempotency_key' => $idempotencyKey,
        ]);
    }

    /** @param array<string, mixed>|null $body
     *  @return array<string, mixed>
     */
    private function request(string $method, string $path, ?array $body = null): array
    {
        $curl = curl_init($this->baseUrl . $path);
        if ($curl === false) {
            throw new RuntimeException('Gagal menginisialisasi cURL.');
        }

        $headers = ['X-API-Key: ' . $this->apiKey, 'Accept: application/json'];
        if ($body !== null) {
            $headers[] = 'Content-Type: application/json';
            curl_setopt($curl, CURLOPT_POSTFIELDS, json_encode($body, JSON_THROW_ON_ERROR));
        }

        curl_setopt_array($curl, [
            CURLOPT_CUSTOMREQUEST => $method,
            CURLOPT_HTTPHEADER => $headers,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT => $this->timeoutSeconds,
        ]);

        $responseBody = curl_exec($curl);
        $status = (int) curl_getinfo($curl, CURLINFO_RESPONSE_CODE);
        $error = curl_error($curl);
        curl_close($curl);

        if ($responseBody === false) {
            throw new RuntimeException('Request gagal: ' . $error);
        }

        /** @var array<string, mixed> $decoded */
        $decoded = json_decode($responseBody, true, flags: JSON_THROW_ON_ERROR);
        if ($status < 200 || $status >= 300) {
            throw new RuntimeException('Gateway error HTTP ' . $status . ': ' . $responseBody);
        }
        return $decoded;
    }
}
