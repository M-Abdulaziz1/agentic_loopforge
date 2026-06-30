from __future__ import annotations

import csv
import re
from dataclasses import dataclass
from pathlib import Path

from api.loopforge.domain import DatasetColumn, DatasetProfile

_EMAIL_RE = re.compile(r"\b[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}\b")
_PHONE_RE = re.compile(r"(?:\+?\d[\d .-]{7,}\d)")
_PII_NAME_RE = re.compile(r"(^|_)(email|phone|mobile|name|full_name|first_name|last_name|ssn|id|identifier)($|_)", re.I)


@dataclass(frozen=True)
class UploadedPart:
    filename: str
    content: bytes
    name: str | None = None


def parse_multipart_upload(content_type: str, body: bytes) -> UploadedPart:
    boundary_token = "boundary="
    if boundary_token not in content_type:
        raise ValueError("Missing multipart boundary")
    boundary = content_type.split(boundary_token, 1)[1].split(";", 1)[0].strip().strip('"')
    delimiter = ("--" + boundary).encode("utf-8")
    filename: str | None = None
    file_content: bytes | None = None
    display_name: str | None = None

    for raw_part in body.split(delimiter):
        part = raw_part.removeprefix(b"\r\n")
        if not part or part in {b"--", b"--\r\n"}:
            continue
        if part.endswith(b"--\r\n"):
            part = part[:-4]
        elif part.endswith(b"--"):
            part = part[:-2]
        headers_raw, separator, content = part.partition(b"\r\n\r\n")
        if content.endswith(b"\r\n"):
            content = content[:-2]
        if not separator:
            continue
        headers = headers_raw.decode("latin-1")
        disposition = next((line for line in headers.split("\r\n") if line.lower().startswith("content-disposition:")), "")
        field_name = _disposition_value(disposition, "name")
        part_filename = _disposition_value(disposition, "filename")
        if field_name == "file" and part_filename:
            filename = Path(part_filename).name
            file_content = content
        elif field_name == "name":
            value = content.decode("utf-8", errors="replace").strip()
            display_name = value or None

    if filename is None or file_content is None:
        raise ValueError("Multipart upload must include file")
    return UploadedPart(filename=filename, content=file_content, name=display_name)


def profile_csv(path: Path) -> DatasetProfile:
    with path.open("r", encoding="utf-8-sig", newline="") as handle:
        reader = csv.DictReader(handle)
        if reader.fieldnames is None:
            fieldnames: list[str] = []
            rows: list[dict[str, str]] = []
        else:
            fieldnames = list(reader.fieldnames)
            rows = [dict(row) for row in reader]

    columns = [_profile_column(name, [str(row.get(name) or "") for row in rows]) for name in fieldnames]
    return DatasetProfile(row_count=len(rows), column_count=len(fieldnames), columns=columns)


def safe_dataset_filename(filename: str) -> str:
    name = Path(filename).name.replace(" ", "_")
    cleaned = re.sub(r"[^A-Za-z0-9._-]", "_", name)
    return cleaned or "dataset.csv"


def mask_pii_text(text: str) -> str:
    text = _EMAIL_RE.sub("[REDACTED_EMAIL]", text)
    return _PHONE_RE.sub("[REDACTED_PHONE]", text)


def _profile_column(name: str, values: list[str]) -> DatasetColumn:
    non_null = [value for value in values if value.strip()]
    pii_masked = _is_pii_column(name, non_null)
    sample_values = non_null[:5]
    if pii_masked:
        sample = [_mask_value(value, name) for value in sample_values]
    else:
        sample = [mask_pii_text(value) for value in sample_values]
        pii_masked = sample != sample_values
    return DatasetColumn(
        name=name,
        dtype=_infer_dtype(non_null),
        null_count=len(values) - len(non_null),
        unique_count=len(set(non_null)),
        sample=sample,
        pii_masked=pii_masked,
    )


def _is_pii_column(name: str, values: list[str]) -> bool:
    if _PII_NAME_RE.search(name):
        return True
    if any(_EMAIL_RE.search(value) or _PHONE_RE.search(value) for value in values):
        return True
    string_values = [value for value in values if _infer_dtype([value]) == "string"]
    return len(string_values) >= 20 and len(set(string_values)) / max(len(string_values), 1) > 0.9


def _mask_value(value: str, name: str) -> str:
    if _EMAIL_RE.search(value):
        return "[REDACTED_EMAIL]"
    if _PHONE_RE.search(value):
        return "[REDACTED_PHONE]"
    if "name" in name.lower():
        return "[REDACTED_NAME]"
    if "id" in name.lower() or "identifier" in name.lower():
        return "[REDACTED_ID]"
    return mask_pii_text(value) if mask_pii_text(value) != value else "[REDACTED_VALUE]"


def _infer_dtype(values: list[str]) -> str:
    if not values:
        return "string"
    try:
        for value in values:
            int(value)
        return "integer"
    except ValueError:
        pass
    try:
        for value in values:
            float(value)
        return "float"
    except ValueError:
        return "string"


def _disposition_value(header: str, key: str) -> str | None:
    match = re.search(rf'{key}="([^"]*)"', header)
    return match.group(1) if match else None
