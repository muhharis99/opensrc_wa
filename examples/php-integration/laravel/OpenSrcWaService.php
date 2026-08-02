<?php

declare(strict_types=1);

namespace App\Services;

use Illuminate\Http\Client\PendingRequest;
use Illuminate\Support\Facades\Http;

final class OpenSrcWaService
{
    private function client(): PendingRequest
    {
        return Http::baseUrl((string) config('services.opensrc_wa.url'))
            ->withHeaders(['X-API-Key' => (string) config('services.opensrc_wa.key')])
            ->acceptJson()
            ->timeout(10)
            ->retry(2, 250, throw: false);
    }

    /** @return array<string, mixed> */
    public function sendText(string $sessionId, string $to, string $text, string $idempotencyKey): array
    {
        return $this->client()->post('/api/v1/messages/text', [
            'session_id' => $sessionId,
            'to' => $to,
            'text' => $text,
            'idempotency_key' => $idempotencyKey,
        ])->throw()->json();
    }
}
