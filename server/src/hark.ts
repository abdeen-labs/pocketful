import type { HarkConfig } from "./config";

export type HarkDelivery = { sent: true } | { sent: false; error: string };

/** Hark caps notification titles at 80 characters. */
const TITLE_MAX = 80;
const BODY = "Tap to add to Apple Wallet";
const TIMEOUT_MS = 10_000;

/** A 2xx with `accepted_count` 0 means no device took the notification. */
async function acceptedNowhere(res: Response): Promise<string | undefined> {
  try {
    const body = (await res.json()) as { accepted_count?: unknown; message?: unknown };
    if (body?.accepted_count !== 0) return undefined;
    return typeof body.message === "string" && body.message
      ? body.message
      : "no device accepted the notification";
  } catch {
    return undefined;
  }
}

async function errorMessage(res: Response): Promise<string | undefined> {
  try {
    const body = (await res.json()) as { error?: { message?: unknown } };
    const message = body?.error?.message;
    return typeof message === "string" && message ? message : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Send the download link through Hark. Resolves to `undefined` when Hark is
 * not configured; never throws — a failed delivery is a result, not an error.
 */
export async function deliverPass(
  hark: HarkConfig | undefined,
  title: string,
  passUrl: string
): Promise<HarkDelivery | undefined> {
  if (!hark) return undefined;
  let result: HarkDelivery;
  try {
    const res = await fetch(`${hark.url}/notifications`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${hark.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        title: title.slice(0, TITLE_MAX),
        body: BODY,
        pass_url: passUrl,
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (res.ok) {
      const rejection = await acceptedNowhere(res);
      result = rejection ? { sent: false, error: rejection } : { sent: true };
    } else {
      const message = await errorMessage(res);
      result = {
        sent: false,
        error: `Hark responded ${res.status}${message ? `: ${message}` : ""}`,
      };
    }
  } catch (err) {
    const detail =
      err instanceof Error && err.name === "TimeoutError"
        ? `timed out after ${TIMEOUT_MS / 1000}s`
        : err instanceof Error
          ? err.message
          : String(err);
    result = { sent: false, error: `Hark request failed: ${detail}` };
  }
  if (!result.sent) {
    console.error(`Hark delivery failed for "${title}": ${result.error}`);
  }
  return result;
}
