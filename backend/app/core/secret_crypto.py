from __future__ import annotations

import base64
import hashlib
import hmac
import os

ENC_PREFIX = "enc:v1:"
_SALT_SIZE = 16
_NONCE_SIZE = 16
_TAG_SIZE = 32
_PBKDF2_ROUNDS = 200_000


def encrypt_text(*, plaintext: str, secret_key: str) -> str:
    raw = plaintext.encode("utf-8")
    salt = os.urandom(_SALT_SIZE)
    nonce = os.urandom(_NONCE_SIZE)
    enc_key, mac_key = _derive_keys(secret_key=secret_key, salt=salt)
    keystream = _keystream(key=enc_key, nonce=nonce, size=len(raw))
    ciphertext = _xor_bytes(raw, keystream)
    tag = hmac.new(mac_key, b"v1" + salt + nonce + ciphertext, hashlib.sha256).digest()
    payload = salt + nonce + ciphertext + tag
    encoded = base64.urlsafe_b64encode(payload).decode("ascii")
    return f"{ENC_PREFIX}{encoded}"


def decrypt_text(*, payload: str, secret_key: str) -> str:
    if not payload.startswith(ENC_PREFIX):
        return payload

    encoded = payload[len(ENC_PREFIX) :]
    blob = base64.urlsafe_b64decode(encoded.encode("ascii"))
    if len(blob) < (_SALT_SIZE + _NONCE_SIZE + _TAG_SIZE):
        raise ValueError("Encrypted payload is malformed")

    salt = blob[:_SALT_SIZE]
    nonce = blob[_SALT_SIZE : _SALT_SIZE + _NONCE_SIZE]
    tag = blob[-_TAG_SIZE:]
    ciphertext = blob[_SALT_SIZE + _NONCE_SIZE : -_TAG_SIZE]

    enc_key, mac_key = _derive_keys(secret_key=secret_key, salt=salt)
    expected = hmac.new(mac_key, b"v1" + salt + nonce + ciphertext, hashlib.sha256).digest()
    if not hmac.compare_digest(expected, tag):
        raise ValueError("Encrypted payload integrity check failed")

    keystream = _keystream(key=enc_key, nonce=nonce, size=len(ciphertext))
    plaintext = _xor_bytes(ciphertext, keystream)
    return plaintext.decode("utf-8")


def is_encrypted(value: str) -> bool:
    return value.startswith(ENC_PREFIX)


def _derive_keys(*, secret_key: str, salt: bytes) -> tuple[bytes, bytes]:
    material = hashlib.pbkdf2_hmac(
        "sha256",
        secret_key.encode("utf-8"),
        salt,
        _PBKDF2_ROUNDS,
        dklen=64,
    )
    return material[:32], material[32:]


def _keystream(*, key: bytes, nonce: bytes, size: int) -> bytes:
    blocks: list[bytes] = []
    counter = 0
    while sum(len(block) for block in blocks) < size:
        counter_bytes = counter.to_bytes(8, byteorder="big", signed=False)
        block = hmac.new(key, nonce + counter_bytes, hashlib.sha256).digest()
        blocks.append(block)
        counter += 1
    return b"".join(blocks)[:size]


def _xor_bytes(left: bytes, right: bytes) -> bytes:
    return bytes(a ^ b for a, b in zip(left, right))

