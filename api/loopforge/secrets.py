from __future__ import annotations

import base64
import hashlib
import hmac
import os


class SecretCipher:
    def __init__(self, key: str) -> None:
        self._key = hashlib.sha256(key.encode("utf-8")).digest()

    def encrypt(self, value: str | None) -> str | None:
        if value is None:
            return None
        nonce = os.urandom(16)
        plaintext = value.encode("utf-8")
        ciphertext = _xor_stream(plaintext, self._key, nonce)
        signature = hmac.new(self._key, nonce + ciphertext, hashlib.sha256).digest()
        return base64.urlsafe_b64encode(nonce + signature + ciphertext).decode("ascii")

    def decrypt(self, value: str | None) -> str | None:
        if value is None:
            return None
        raw = base64.urlsafe_b64decode(value.encode("ascii"))
        nonce = raw[:16]
        signature = raw[16:48]
        ciphertext = raw[48:]
        expected = hmac.new(self._key, nonce + ciphertext, hashlib.sha256).digest()
        if not hmac.compare_digest(signature, expected):
            raise ValueError("Encrypted secret signature mismatch")
        return _xor_stream(ciphertext, self._key, nonce).decode("utf-8")


def _xor_stream(data: bytes, key: bytes, nonce: bytes) -> bytes:
    output = bytearray()
    counter = 0
    while len(output) < len(data):
        block = hashlib.sha256(key + nonce + counter.to_bytes(4, "big")).digest()
        output.extend(block)
        counter += 1
    return bytes(item ^ mask for item, mask in zip(data, output))
