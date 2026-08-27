import { createClient } from 'npm:@supabase/supabase-js@2.110.5';

const EXPO_SEND_URL = 'https://exp.host/--/api/v2/push/send';
const EXPO_RECEIPTS_URL = 'https://exp.host/--/api/v2/push/getReceipts';
const RESEND_EMAILS_URL = 'https://api.resend.com/emails';
const MAX_SEND_ATTEMPTS = 5;
const MAX_RECEIPT_ATTEMPTS = 5;
const MAX_EMAIL_ATTEMPTS = 5;

type ClaimedDelivery = {
  delivery_id: string;
  push_token_id: string;
  expo_push_token: string;
  title: string;
  body: string;
  route: string;
  notification_id: string;
  attempt_number: number;
};

type Ticket = {
  status: 'ok' | 'error';
  id?: string;
  message?: string;
  details?: { error?: string };
};

type Receipt = {
  status: 'ok' | 'error';
  message?: string;
  details?: { error?: string };
};

type TicketedDelivery = {
  id: string;
  push_token_id: string;
  expo_ticket_id: string;
  receipt_attempts: number;
};

type ClaimedVerificationEmail = {
  delivery_id: string;
  verification_request_id: string;
  provider_owner_id: string;
  provider_name: string;
  owner_email: string;
  business_registration: string;
  license_number: string;
  evidence_summary: string;
  submitted_at: string;
  attempt_number: number;
};

function getSecretKey() {
  const direct = Deno.env.get('SUPABASE_SECRET_KEY') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (direct) return direct;

  const serialized = Deno.env.get('SUPABASE_SECRET_KEYS');
  if (!serialized) return null;

  try {
    const keys = JSON.parse(serialized) as Record<string, unknown>;
    return Object.values(keys).find((value): value is string => typeof value === 'string') ?? null;
  } catch {
    return null;
  }
}

function secureEqual(left: string, right: string) {
  const leftBytes = new TextEncoder().encode(left);
  const rightBytes = new TextEncoder().encode(right);
  const length = Math.max(leftBytes.length, rightBytes.length);
  let difference = leftBytes.length ^ rightBytes.length;

  for (let index = 0; index < length; index += 1) {
    difference |= (leftBytes[index] ?? 0) ^ (rightBytes[index] ?? 0);
  }

  return difference === 0;
}

function errorText(value: unknown) {
  if (value instanceof Error) return value.message.slice(0, 500);
  return String(value).slice(0, 500);
}

function retryTime(attemptNumber: number) {
  const delayMinutes = Math.min(15, 2 ** Math.max(0, attemptNumber - 1));
  return new Date(Date.now() + delayMinutes * 60_000).toISOString();
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  })[character] ?? character);
}

Deno.serve(async (request) => {
  if (request.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 });
  }

  const dispatchSecret = Deno.env.get('PUSH_DISPATCH_SECRET') ?? '';
  const suppliedSecret = request.headers.get('x-push-dispatch-secret') ?? '';
  if (dispatchSecret.length < 32 || !secureEqual(dispatchSecret, suppliedSecret)) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const secretKey = getSecretKey();
  if (!supabaseUrl || !secretKey) {
    console.error('Push worker is missing its Supabase server configuration.');
    return Response.json({ error: 'Worker is not configured' }, { status: 503 });
  }

  let mode: 'dispatch' | 'receipts' | 'emails' | 'both' = 'both';
  try {
    const payload = await request.json().catch(() => ({}));
    if (
      payload.mode === 'dispatch' ||
      payload.mode === 'receipts' ||
      payload.mode === 'emails' ||
      payload.mode === 'both'
    ) {
      mode = payload.mode;
    }
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const supabase = createClient(supabaseUrl, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const updateDelivery = async (deliveryId: string, values: Record<string, unknown>) => {
    const { error } = await supabase.from('push_deliveries').update(values).eq('id', deliveryId);
    if (error) throw error;
  };

  const disableToken = async (pushTokenId: string) => {
    const { error } = await supabase
      .from('push_tokens')
      .update({ enabled: false })
      .eq('id', pushTokenId);
    if (error) throw error;
  };

  const updateVerificationEmail = async (
    deliveryId: string,
    values: Record<string, unknown>
  ) => {
    const { error } = await supabase
      .from('verification_admin_email_deliveries')
      .update(values)
      .eq('id', deliveryId);
    if (error) throw error;
  };

  const dispatch = async () => {
    const { data, error } = await supabase.rpc('claim_push_deliveries', { p_limit: 100 });
    if (error) throw error;

    const deliveries = (data ?? []) as ClaimedDelivery[];
    if (!deliveries.length) return { claimed: 0, ticketed: 0, retried: 0, failed: 0 };

    const messages = deliveries.map((delivery) => ({
      to: delivery.expo_push_token,
      title: delivery.title,
      body: delivery.body,
      sound: 'default',
      channelId: 'account-updates',
      data: {
        route: delivery.route,
        notificationId: delivery.notification_id,
      },
    }));

    let tickets: Ticket[];
    try {
      const response = await fetch(EXPO_SEND_URL, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(messages),
        signal: AbortSignal.timeout(15_000),
      });

      if (!response.ok) throw new Error(`Expo Push Service returned HTTP ${response.status}`);
      const payload = await response.json() as { data?: Ticket[] | Ticket; errors?: unknown[] };
      tickets = Array.isArray(payload.data) ? payload.data : payload.data ? [payload.data] : [];
    } catch (sendError) {
      const message = errorText(sendError);
      await Promise.all(deliveries.map((delivery) =>
        updateDelivery(delivery.delivery_id, {
          state: delivery.attempt_number >= MAX_SEND_ATTEMPTS ? 'failed' : 'pending',
          available_at: retryTime(delivery.attempt_number),
          error_code: 'ExpoServiceUnavailable',
          error_message: message,
        })
      ));
      return {
        claimed: deliveries.length,
        ticketed: 0,
        retried: deliveries.filter((item) => item.attempt_number < MAX_SEND_ATTEMPTS).length,
        failed: deliveries.filter((item) => item.attempt_number >= MAX_SEND_ATTEMPTS).length,
      };
    }

    let ticketed = 0;
    let retried = 0;
    let failed = 0;

    for (const [index, delivery] of deliveries.entries()) {
      const ticket = tickets[index];
      if (ticket?.status === 'ok' && ticket.id) {
        ticketed += 1;
        await updateDelivery(delivery.delivery_id, {
          state: 'ticketed',
          expo_ticket_id: ticket.id,
          sent_at: new Date().toISOString(),
          next_receipt_check_at: new Date(Date.now() + 15 * 60_000).toISOString(),
          error_code: '',
          error_message: '',
        });
        continue;
      }

      const code = ticket?.details?.error ?? 'MissingPushTicket';
      const message = ticket?.message ?? 'Expo did not return a push ticket for this message.';
      if (code === 'DeviceNotRegistered') await disableToken(delivery.push_token_id);

      const shouldRetry = !ticket && delivery.attempt_number < MAX_SEND_ATTEMPTS;
      if (shouldRetry) retried += 1;
      else failed += 1;

      await updateDelivery(delivery.delivery_id, {
        state: shouldRetry ? 'pending' : 'failed',
        available_at: retryTime(delivery.attempt_number),
        error_code: code,
        error_message: message.slice(0, 500),
      });
    }

    return { claimed: deliveries.length, ticketed, retried, failed };
  };

  const reconcileReceipts = async () => {
    const { data, error } = await supabase
      .from('push_deliveries')
      .select('id, push_token_id, expo_ticket_id, receipt_attempts')
      .eq('state', 'ticketed')
      .lte('next_receipt_check_at', new Date().toISOString())
      .order('next_receipt_check_at', { ascending: true })
      .limit(300);
    if (error) throw error;

    const deliveries = (data ?? []) as TicketedDelivery[];
    if (!deliveries.length) return { checked: 0, delivered: 0, waiting: 0, failed: 0 };

    let receipts: Record<string, Receipt> = {};
    try {
      const response = await fetch(EXPO_RECEIPTS_URL, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ids: deliveries.map((item) => item.expo_ticket_id) }),
        signal: AbortSignal.timeout(15_000),
      });
      if (!response.ok) throw new Error(`Expo receipt service returned HTTP ${response.status}`);
      const payload = await response.json() as { data?: Record<string, Receipt> };
      receipts = payload.data ?? {};
    } catch (receiptError) {
      const message = errorText(receiptError);
      await Promise.all(deliveries.map((delivery) =>
        updateDelivery(delivery.id, {
          receipt_attempts: delivery.receipt_attempts + 1,
          next_receipt_check_at: new Date(Date.now() + 5 * 60_000).toISOString(),
          error_code: 'ReceiptServiceUnavailable',
          error_message: message,
        })
      ));
      return { checked: deliveries.length, delivered: 0, waiting: deliveries.length, failed: 0 };
    }

    let delivered = 0;
    let waiting = 0;
    let failed = 0;

    for (const delivery of deliveries) {
      const receipt = receipts[delivery.expo_ticket_id];
      if (!receipt) {
        const receiptAttempts = delivery.receipt_attempts + 1;
        const exhausted = receiptAttempts >= MAX_RECEIPT_ATTEMPTS;
        if (exhausted) failed += 1;
        else waiting += 1;

        await updateDelivery(delivery.id, {
          state: exhausted ? 'failed' : 'ticketed',
          receipt_attempts: receiptAttempts,
          next_receipt_check_at: new Date(Date.now() + 5 * 60_000).toISOString(),
          checked_at: exhausted ? new Date().toISOString() : null,
          error_code: exhausted ? 'ReceiptUnavailable' : '',
          error_message: exhausted
            ? 'Expo did not return a receipt before the retry window expired.'
            : '',
        });
        continue;
      }

      if (receipt.status === 'ok') {
        delivered += 1;
        await updateDelivery(delivery.id, {
          state: 'delivered',
          receipt_attempts: delivery.receipt_attempts + 1,
          checked_at: new Date().toISOString(),
          error_code: '',
          error_message: '',
        });
        continue;
      }

      failed += 1;
      const code = receipt.details?.error ?? 'PushReceiptError';
      if (code === 'DeviceNotRegistered') await disableToken(delivery.push_token_id);
      await updateDelivery(delivery.id, {
        state: 'failed',
        receipt_attempts: delivery.receipt_attempts + 1,
        checked_at: new Date().toISOString(),
        error_code: code,
        error_message: (receipt.message ?? 'Expo rejected the notification.').slice(0, 500),
      });
    }

    return { checked: deliveries.length, delivered, waiting, failed };
  };

  const dispatchVerificationEmails = async () => {
    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    if (!resendApiKey) {
      return {
        configured: false,
        message: 'Set RESEND_API_KEY to enable verification request emails.',
      };
    }

    const adminEmail = Deno.env.get('VERIFICATION_ADMIN_EMAIL') ?? 'stevenoueiss11@gmail.com';
    const fromEmail = Deno.env.get('VERIFICATION_FROM_EMAIL') ?? 'BeyBridge <onboarding@resend.dev>';
    const adminRoute = Deno.env.get('BEYBRIDGE_ADMIN_URL') ?? 'beybridge://admin';
    const { data, error } = await supabase.rpc('claim_verification_admin_emails', {
      p_limit: 25,
    });
    if (error) throw error;

    const deliveries = (data ?? []) as ClaimedVerificationEmail[];
    let sent = 0;
    let retried = 0;
    let failed = 0;

    for (const delivery of deliveries) {
      const providerName = delivery.provider_name.trim() || 'Provider';
      const businessRegistration = delivery.business_registration.trim() || 'Not provided';
      const licenseNumber = delivery.license_number.trim() || 'Not provided';
      const submittedAt = new Date(delivery.submitted_at).toLocaleString('en', {
        dateStyle: 'medium',
        timeStyle: 'short',
        timeZone: 'Asia/Beirut',
      });

      try {
        const response = await fetch(RESEND_EMAILS_URL, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${resendApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: fromEmail,
            to: [adminEmail],
            reply_to: delivery.owner_email || undefined,
            subject: `Verification request: ${providerName}`.slice(0, 180),
            text: [
              `${providerName} submitted a provider verification request.`,
              '',
              `Submitted: ${submittedAt} (Beirut time)`,
              `Provider account: ${delivery.owner_email || delivery.provider_owner_id}`,
              `Business registration: ${businessRegistration}`,
              `License number: ${licenseNumber}`,
              '',
              'Evidence summary:',
              delivery.evidence_summary,
              '',
              `Open the BeyBridge admin dashboard: ${adminRoute}`,
              `Request ID: ${delivery.verification_request_id}`,
            ].join('\n'),
            html: `
              <h2>Provider verification request</h2>
              <p><strong>${escapeHtml(providerName)}</strong> submitted evidence for review.</p>
              <ul>
                <li><strong>Submitted:</strong> ${escapeHtml(submittedAt)} (Beirut time)</li>
                <li><strong>Provider account:</strong> ${escapeHtml(delivery.owner_email || delivery.provider_owner_id)}</li>
                <li><strong>Business registration:</strong> ${escapeHtml(businessRegistration)}</li>
                <li><strong>License number:</strong> ${escapeHtml(licenseNumber)}</li>
              </ul>
              <h3>Evidence summary</h3>
              <p>${escapeHtml(delivery.evidence_summary).replace(/\n/g, '<br>')}</p>
              <p><a href="${escapeHtml(adminRoute)}">Open the BeyBridge admin dashboard</a></p>
              <p style="color:#666;font-size:12px">Request ID: ${escapeHtml(delivery.verification_request_id)}</p>
            `,
          }),
          signal: AbortSignal.timeout(15_000),
        });

        const responseBody = await response.json().catch(() => ({})) as {
          id?: string;
          message?: string;
        };
        if (!response.ok) {
          throw new Error(responseBody.message ?? `Resend returned HTTP ${response.status}`);
        }

        sent += 1;
        await updateVerificationEmail(delivery.delivery_id, {
          state: 'sent',
          sent_at: new Date().toISOString(),
          provider_message_id: responseBody.id ?? '',
          error_message: '',
        });
      } catch (emailError) {
        const shouldRetry = delivery.attempt_number < MAX_EMAIL_ATTEMPTS;
        if (shouldRetry) retried += 1;
        else failed += 1;

        await updateVerificationEmail(delivery.delivery_id, {
          state: shouldRetry ? 'pending' : 'failed',
          available_at: retryTime(delivery.attempt_number),
          error_message: errorText(emailError),
        });
      }
    }

    return { configured: true, claimed: deliveries.length, sent, retried, failed };
  };

  try {
    const result: Record<string, unknown> = {};
    if (mode === 'dispatch' || mode === 'both') result.dispatch = await dispatch();
    if (mode === 'receipts' || mode === 'both') result.receipts = await reconcileReceipts();
    if (mode === 'emails' || mode === 'both') {
      result.verificationEmails = await dispatchVerificationEmails();
    }
    return Response.json(result);
  } catch (workerError) {
    console.error('Push worker failed:', errorText(workerError));
    return Response.json({ error: 'Push worker failed' }, { status: 500 });
  }
});
