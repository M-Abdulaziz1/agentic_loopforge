import { afterEach, expect, test, vi } from "vitest";
import { ApiError, apiFetch } from "./client";

afterEach(() => vi.restoreAllMocks());

test("returns parsed JSON on success", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(JSON.stringify({ id: "g1" }), { status: 200 })),
  );
  await expect(apiFetch<{ id: string }>("/api/goals/g1")).resolves.toEqual({ id: "g1" });
});

test("throws ApiError on non-2xx", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(JSON.stringify({ detail: "nope" }), { status: 404 })),
  );
  await expect(apiFetch("/api/x")).rejects.toBeInstanceOf(ApiError);
});
