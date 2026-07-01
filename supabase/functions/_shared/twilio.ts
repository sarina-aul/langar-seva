export async function sendTwilioSms(to: string, body: string): Promise<string> {
  const accountSid = Deno.env.get('TWILIO_ACCOUNT_SID')
  const authToken = Deno.env.get('TWILIO_AUTH_TOKEN')
  const from = Deno.env.get('TWILIO_FROM_NUMBER')

  if (!accountSid || !authToken || !from) {
    console.log(`[twilio] SMS provider not configured. Would send to ${to}: ${body}`)
    return 'logged'
  }

  const response = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
    {
      method: 'POST',
      headers: {
        Authorization: `Basic ${btoa(`${accountSid}:${authToken}`)}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        From: from,
        To: to,
        Body: body,
      }),
    },
  )

  if (!response.ok) {
    throw new Error(`Twilio send failed with ${response.status}`)
  }

  const payload = (await response.json()) as { sid?: string }
  return payload.sid ?? 'sent'
}

export function normalizeOrigin(origin: string | undefined): string {
  if (!origin) return 'http://localhost:5173'
  return origin.endsWith('/') ? origin.slice(0, -1) : origin
}
