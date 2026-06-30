from __future__ import annotations

import csv
import re
from dataclasses import dataclass
from pathlib import Path

from api.loopforge.domain import DatasetColumn, DatasetProfile

_EMAIL_RE = re.compile(r"\b[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}\b")
_PHONE_RE = re.compile(r"(?:\+?\d[\d .-]{7,}\d)")
_PII_NAME_RE = re.compile(r"(^|_)(email|phone|mobile|name|full_name|first_name|last_name|ssn|id|identifier)($|_)", re.I)
_UNIQUE_TRACK_LIMIT = 10_000


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


@dataclass
class _ColumnStats:
    null_count: int = 0
    non_null_count: int = 0
    unique_values: set[str] | None = None
    sample: list[str] | None = None
    all_int: bool = True
    all_float: bool = True
    has_pii_value: bool = False
    unique_overflow: bool = False

    def __post_init__(self) -> None:
        self.unique_values = set()
        self.sample = []

    def observe_unique(self, value: str) -> None:
        if value in self.unique_values:
            return
        if len(self.unique_values) < _UNIQUE_TRACK_LIMIT:
            self.unique_values.add(value)
            return
        self.unique_overflow = True


def profile_csv(path: Path) -> DatasetProfile:
    with path.open("r", encoding="utf-8-sig", newline="") as handle:
        reader = csv.DictReader(handle)
        if reader.fieldnames is None:
            return DatasetProfile(row_count=0, column_count=0, columns=[])

        fieldnames = list(reader.fieldnames)
        stats = {name: _ColumnStats() for name in fieldnames}
        row_count = 0
        for row in reader:
            row_count += 1
            for name in fieldnames:
                value = str(row.get(name) or "")
                column = stats[name]
                if not value.strip():
                    column.null_count += 1
                    continue
                column.non_null_count += 1
                column.observe_unique(value)
                if len(column.sample) < 5:
                    column.sample.append(value)
                if not _can_parse_int(value):
                    column.all_int = False
                if not _can_parse_float(value):
                    column.all_float = False
                if _EMAIL_RE.search(value) or _PHONE_RE.search(value):
                    column.has_pii_value = True

    columns = [_profile_column_from_stats(name, stats[name]) for name in fieldnames]
    return DatasetProfile(row_count=row_count, column_count=len(fieldnames), columns=columns)


def safe_dataset_filename(filename: str) -> str:
    name = Path(filename).name.replace(" ", "_")
    cleaned = re.sub(r"[^A-Za-z0-9._-]", "_", name)
    return cleaned or "dataset.csv"


def mask_pii_text(text: str) -> str:
    text = _EMAIL_RE.sub("[REDACTED_EMAIL]", text)
    return _PHONE_RE.sub("[REDACTED_PHONE]", text)


def _profile_column_from_stats(name: str, stats: _ColumnStats) -> DatasetColumn:
    unique_count = stats.non_null_count if stats.unique_overflow else len(stats.unique_values or set())
    sample_values = stats.sample or []
    pii_masked = _is_pii_column_from_stats(name, stats, unique_count)
    if pii_masked:
        sample = [_mask_value(value, name) for value in sample_values]
    else:
        sample = [mask_pii_text(value) for value in sample_values]
        pii_masked = sample != sample_values
    return DatasetColumn(
        name=name,
        dtype=_infer_dtype_from_stats(stats),
        null_count=stats.null_count,
        unique_count=unique_count,
        sample=sample,
        pii_masked=pii_masked,
    )


def _is_pii_column_from_stats(name: str, stats: _ColumnStats, unique_count: int) -> bool:
    if _PII_NAME_RE.search(name):
        return True
    if stats.has_pii_value:
        return True
    if stats.non_null_count >= 20 and not stats.all_int and not stats.all_float:
        if stats.unique_overflow:
            return True
        return unique_count / max(stats.non_null_count, 1) > 0.9
    return False


def _infer_dtype_from_stats(stats: _ColumnStats) -> str:
    if stats.non_null_count == 0:
        return "string"
    if stats.all_int:
        return "integer"
    if stats.all_float:
        return "float"
    return "string"


def _can_parse_int(value: str) -> bool:
    try:
        int(value)
        return True
    except ValueError:
        return False


def _can_parse_float(value: str) -> bool:
    try:
        float(value)
        return True
    except ValueError:
        return False

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


def _disposition_value(header: str, key: str) -> str | None:
    match = re.search(rf'{key}="([^"]*)"', header)
    return match.group(1) if match else None
