#!/usr/bin/env python3
"""Verify that a Chrome extension package is a correctly signed CRX3 file."""
from __future__ import annotations

import hashlib
import io
import json
import struct
import subprocess
import sys
import tempfile
import zipfile
from pathlib import Path


def read_varint(data: bytes, offset: int) -> tuple[int, int]:
    value = 0
    shift = 0
    while offset < len(data) and shift < 70:
        byte = data[offset]
        offset += 1
        value |= (byte & 0x7F) << shift
        if byte < 0x80:
            return value, offset
        shift += 7
    raise ValueError("Malformed protobuf varint")


def parse_protobuf(data: bytes) -> list[tuple[int, int, bytes | int]]:
    fields: list[tuple[int, int, bytes | int]] = []
    offset = 0
    while offset < len(data):
        tag, offset = read_varint(data, offset)
        number, wire_type = tag >> 3, tag & 7
        if number == 0:
            raise ValueError("Invalid protobuf field number 0")
        if wire_type == 0:
            value, offset = read_varint(data, offset)
        elif wire_type == 1:
            if offset + 8 > len(data):
                raise ValueError("Truncated fixed64 protobuf field")
            value = data[offset:offset + 8]
            offset += 8
        elif wire_type == 2:
            length, offset = read_varint(data, offset)
            if length < 0 or offset + length > len(data):
                raise ValueError("Truncated length-delimited protobuf field")
            value = data[offset:offset + length]
            offset += length
        elif wire_type == 5:
            if offset + 4 > len(data):
                raise ValueError("Truncated fixed32 protobuf field")
            value = data[offset:offset + 4]
            offset += 4
        else:
            raise ValueError(f"Unsupported protobuf wire type: {wire_type}")
        fields.append((number, wire_type, value))
    return fields


def one_bytes(fields: list[tuple[int, int, bytes | int]], number: int) -> bytes:
    matches = [v for n, w, v in fields if n == number and w == 2 and isinstance(v, bytes)]
    if len(matches) != 1:
        raise ValueError(f"Expected exactly one bytes field {number}, found {len(matches)}")
    return matches[0]


def verify(path: Path) -> None:
    raw = path.read_bytes()
    if len(raw) < 12 or raw[:4] != b"Cr24":
        raise ValueError("Package does not have the CRX magic header")

    version, header_size = struct.unpack_from("<II", raw, 4)
    if version != 3:
        raise ValueError(f"CRX version is {version}; Chrome requires a CRX3 package")
    if header_size == 0 or 12 + header_size >= len(raw):
        raise ValueError("Invalid CRX3 header size")

    header = raw[12:12 + header_size]
    archive = raw[12 + header_size:]
    header_fields = parse_protobuf(header)

    # CRX3 carries one or more asymmetric proofs in fields 1 and 2.
    proof_blobs = [
        value for number, wire, value in header_fields
        if number in (1, 2) and wire == 2 and isinstance(value, bytes)
    ]
    if not proof_blobs:
        raise ValueError("CRX3 header contains no asymmetric proof (CRX_REQUIRED_PROOF_MISSING)")

    signed_header_data = one_bytes(header_fields, 10000)
    signed_fields = parse_protobuf(signed_header_data)
    crx_id = one_bytes(signed_fields, 1)
    if len(crx_id) != 16:
        raise ValueError("CRX3 signed header has an invalid CRX ID")

    signed_payload = (
        b"CRX3 SignedData\x00"
        + struct.pack("<I", len(signed_header_data))
        + signed_header_data
        + archive
    )

    verified = False
    attempted = 0
    errors: list[str] = []
    with tempfile.TemporaryDirectory(prefix="jtg-crx-check-") as temp_dir:
        temp = Path(temp_dir)
        payload_file = temp / "signed-payload.bin"
        payload_file.write_bytes(signed_payload)

        for index, proof_blob in enumerate(proof_blobs, start=1):
            try:
                proof_fields = parse_protobuf(proof_blob)
                public_key_der = one_bytes(proof_fields, 1)
                signature = one_bytes(proof_fields, 2)
                # Prevent a mismatched key/header combination.
                if hashlib.sha256(public_key_der).digest()[:16] != crx_id:
                    errors.append(f"Proof {index}: public key does not match CRX ID")
                    continue

                public_der_file = temp / f"public-{index}.der"
                public_pem_file = temp / f"public-{index}.pem"
                signature_file = temp / f"signature-{index}.bin"
                public_der_file.write_bytes(public_key_der)
                signature_file.write_bytes(signature)

                convert = subprocess.run(
                    ["openssl", "pkey", "-pubin", "-inform", "DER", "-in", str(public_der_file), "-out", str(public_pem_file)],
                    capture_output=True, text=True,
                )
                if convert.returncode != 0:
                    errors.append(f"Proof {index}: invalid public key ({convert.stderr.strip()})")
                    continue

                attempted += 1
                check = subprocess.run(
                    ["openssl", "dgst", "-sha256", "-verify", str(public_pem_file), "-signature", str(signature_file), str(payload_file)],
                    capture_output=True, text=True,
                )
                if check.returncode == 0 and "Verified OK" in check.stdout:
                    verified = True
                    break
                errors.append(f"Proof {index}: signature verification failed")
            except (ValueError, OSError) as exc:
                errors.append(f"Proof {index}: {exc}")

    if not verified:
        detail = "; ".join(errors) if errors else "No usable proof found"
        raise ValueError(f"No valid CRX3 signature proof. {detail}")

    try:
        with zipfile.ZipFile(io.BytesIO(archive)) as bundle:
            manifest = json.loads(bundle.read("manifest.json").decode("utf-8"))
    except Exception as exc:
        raise ValueError(f"Signed CRX payload is not a valid extension ZIP: {exc}") from exc

    extension_version = manifest.get("version")
    if not extension_version:
        raise ValueError("CRX manifest has no extension version")

    print(f"CRX3 proof: valid (verified {attempted} proof(s))")
    print(f"Extension version: {extension_version}")
    print(f"CRX ID: {crx_id.hex()}")
    print(f"Package: {path.name} ({len(raw):,} bytes)")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Usage: verify_crx3.py <extension.crx>", file=sys.stderr)
        raise SystemExit(2)
    try:
        verify(Path(sys.argv[1]))
    except Exception as exc:
        print(f"CRX validation failed: {exc}", file=sys.stderr)
        raise SystemExit(1)
