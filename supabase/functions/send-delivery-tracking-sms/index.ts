import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.108.1'
import { normalizeOrigin, sendTwilioSms } from '../_shared/twilio.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface RequestBody {
  routeRecipientId?: string
  origin?: string
}

interface RouteStopResponse {
  recipient_id: string
  recipients: {
    name: string
    phone: string | null
    contact_pref: 'phone' | 'text' | 'either' | null
  } | null
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  })
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405)
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')
  const authorization = request.headers.get('Authorization')

  if (!supabaseUrl || !supabaseAnonKey || !authorization) {
    return jsonResponse({ error: 'Function is not configured for authenticated sending.' }, 500)
  }

  const body = (await request.json()) as RequestBody
  if (!body.routeRecipientId) {
    return jsonResponse({ error: 'routeRecipientId is required.' }, 400)
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: authorization,
      },
    },
  })

  const { data: linkData, error: linkError } = await supabase.rpc('create_delivery_tracking_link', {
    p_route_recipient_id: body.routeRecipientId,
  })

  if (linkError || !linkData?.[0]?.tracking_token) {
    return jsonResponse({ error: linkError?.message ?? 'Could not create tracking link.' }, 400)
  }

  const { data: stopData, error: stopError } = await supabase
    .from('dispatch_route_recipients')
    .select('recipient_id, recipients ( name, phone, contact_pref )')
    .eq('id', body.routeRecipientId)
    .single()

  if (stopError || !stopData) {
    return jsonResponse({ error: stopError?.message ?? 'Could not load recipient for this stop.' }, 400)
  }

  const stop = stopData as RouteStopResponse
  const recipient = stop.recipients
  if (!recipient?.phone || !['text', 'either'].includes(recipient.contact_pref ?? '')) {
    await supabase.from('delivery_notifications').insert({
      route_recipient_id: body.routeRecipientId,
      recipient_id: stop.recipient_id,
      event_type: 'tracking_link_sent',
      status: 'skipped',
      error: 'Recipient does not have SMS contact preference.',
    })
    return jsonResponse({ error: 'Recipient does not have SMS contact preference.' }, 400)
  }

  const trackingUrl = `${normalizeOrigin(body.origin)}/track/${linkData[0].tracking_token}`
  const message = `Langar Seva delivery update: track your delivery here ${trackingUrl}`

  try {
    const providerMessageId = await sendTwilioSms(recipient.phone, message)
    await supabase.rpc('mark_delivery_tracking_link_sent', {
      p_route_recipient_id: body.routeRecipientId,
      p_provider_message_id: providerMessageId === 'logged' ? null : providerMessageId,
    })

    return jsonResponse({
      ok: true,
      mode: providerMessageId === 'logged' ? 'logged' : 'sent',
      trackingUrl,
      providerMessageId,
    })
  } catch (error) {
    await supabase.from('delivery_notifications').insert({
      route_recipient_id: body.routeRecipientId,
      recipient_id: stop.recipient_id,
      event_type: 'tracking_link_sent',
      status: 'failed',
      error: error instanceof Error ? error.message : 'SMS send failed.',
    })
    return jsonResponse({ error: 'SMS send failed.' }, 502)
  }
})
