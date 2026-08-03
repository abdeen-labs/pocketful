import { ApnsClient, Notification } from "apns2";
import type { Config } from "./config";
import { deleteRegistrationsByPushToken, pushTokensForSerial } from "./db";

// Wallet pass-update pushes: empty payload, topic = pass type identifier,
// production APNs only (sandbox never delivers pass pushes).

export interface PushResult {
  sent: number;
  failed: number;
  /** Registrations removed because APNs reported the token dead. */
  pruned: number;
  skipped?: string;
}

const DEAD_TOKEN_REASONS = new Set([
  "BadDeviceToken",
  "Unregistered",
  "DeviceTokenNotForTopic",
]);

let client: ApnsClient | undefined;

function getClient(config: Config): ApnsClient | undefined {
  if (!config.apns) return undefined;
  if (!client) {
    client = new ApnsClient({
      team: config.teamIdentifier,
      keyId: config.apns.keyId,
      signingKey: config.apns.key,
      defaultTopic: config.passTypeIdentifier,
    });
  }
  return client;
}

/** Tell every device registered for this serial that a new pass is available. */
export async function pushPassUpdate(
  config: Config,
  serialNumber: string
): Promise<PushResult> {
  const apns = getClient(config);
  if (!apns) {
    return {
      sent: 0,
      failed: 0,
      pruned: 0,
      skipped:
        "APNS_KEY_ID/APNS_KEY_BASE64 are not configured — devices will not " +
        "be notified and will only refresh on their own schedule",
    };
  }

  const tokens = pushTokensForSerial(serialNumber);
  const result: PushResult = { sent: 0, failed: 0, pruned: 0 };
  for (const token of tokens) {
    try {
      await apns.send(new Notification(token, {}));
      result.sent += 1;
    } catch (err) {
      const reason =
        typeof err === "object" && err !== null && "reason" in err
          ? String((err as { reason: unknown }).reason)
          : "";
      if (DEAD_TOKEN_REASONS.has(reason)) {
        result.pruned += deleteRegistrationsByPushToken(token);
      } else {
        result.failed += 1;
        console.error(
          `APNs push failed for serial ${serialNumber}: ${
            reason || (err instanceof Error ? err.message : String(err))
          }`
        );
      }
    }
  }
  return result;
}
