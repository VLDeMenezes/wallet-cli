import crypto from "node:crypto";
import pc from "picocolors";

export type SupportedWebhookEvent =
  | "deposit.settled"
  | "transfer.settled"
  | "transfer.failed";

export interface WebhookOptions {
  url: string;
  secret: string;
  event: string;
  userId?: string;
  txId?: string;
  amount?: string;
  currency: string;
  reason?: string;
  headerName: string;
}

const SUPPORTED_EVENTS: SupportedWebhookEvent[] = [
  "deposit.settled",
  "transfer.settled",
  "transfer.failed",
];

function isSupportedEvent(event: string): event is SupportedWebhookEvent {
  return SUPPORTED_EVENTS.includes(event as SupportedWebhookEvent);
}

function buildPayload(
  options: WebhookOptions,
  eventId: string,
  timestamp: string,
) {
  const basePayload = {
    id: eventId,
    type: options.event,
    createdAt: timestamp,
    livemode: false,
  };

  switch (options.event) {
    case "deposit.settled":
      return {
        ...basePayload,
        data: {
          transactionId:
            options.txId ?? `tx_dep_${crypto.randomBytes(4).toString("hex")}`,
          userId: options.userId ?? "usr_demo_001",
          amount: Number(options.amount ?? "50.00"),
          currency: options.currency.toUpperCase(),
          status: "SETTLED",
          method: "SEPA_INSTANT",
        },
      };

    case "transfer.settled":
      return {
        ...basePayload,
        data: {
          transactionId:
            options.txId ?? `tx_trf_${crypto.randomBytes(4).toString("hex")}`,
          senderUserId: options.userId ?? "usr_demo_001",
          recipientUserId: "usr_demo_002",
          amount: Number(options.amount ?? "25.00"),
          currency: options.currency.toUpperCase(),
          status: "SETTLED",
        },
      };

    case "transfer.failed":
      return {
        ...basePayload,
        data: {
          transactionId:
            options.txId ?? `tx_err_${crypto.randomBytes(4).toString("hex")}`,
          senderUserId: options.userId ?? "usr_demo_001",
          amount: Number(options.amount ?? "120.00"),
          currency: options.currency.toUpperCase(),
          status: "FAILED",
          failureReason: options.reason ?? "INSUFFICIENT_FUNDS",
        },
      };

    default:
      throw new Error(`Evento no soportado: ${options.event}`);
  }
}

export function signPayload(
  rawBody: string,
  secret: string,
  timestamp: string,
): string {
  const signedContent = `${timestamp}.${rawBody}`;
  const digest = crypto
    .createHmac("sha256", secret)
    .update(signedContent, "utf8")
    .digest("hex");

  return `t=${timestamp},v1=${digest}`;
}

export async function runWebhook(options: WebhookOptions): Promise<void> {
  if (!isSupportedEvent(options.event)) {
    throw new Error(
      `Evento "${options.event}" no válido. Usa uno de: ${SUPPORTED_EVENTS.join(", ")}`,
    );
  }

  if (!options.secret) {
    throw new Error(
      "Falta el secreto HMAC. Pásalo con --secret o define WALLET_WEBHOOK_SECRET.",
    );
  }

  const eventId = `evt_${crypto.randomBytes(6).toString("hex")}`;
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const payload = buildPayload(options, eventId, timestamp);
  const rawBody = JSON.stringify(payload);
  const signature = signPayload(rawBody, options.secret, timestamp);

  console.log(
    pc.cyan(`Enviando webhook "${options.event}" a ${options.url}...`),
  );
  console.log(pc.dim(`Payload: ${rawBody}`));

  const response = await fetch(options.url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Webhook-Id": eventId,
      [options.headerName]: signature,
    },
    body: rawBody,
  });

  const responseText = await response.text();

  if (!response.ok) {
    throw new Error(
      `El endpoint respondió con ${response.status} ${response.statusText}: ${responseText}`,
    );
  }

  console.log(
    pc.green(`✔ Webhook entregado (${response.status} ${response.statusText})`),
  );
  if (responseText) {
    console.log(pc.dim(`Respuesta: ${responseText}`));
  }
}
