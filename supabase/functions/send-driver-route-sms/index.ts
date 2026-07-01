import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.108.1'
import { normalizeOrigin, sendTwilioSms } from '../_shared/twilio.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface RequestBody {
  routeId?: string
  origin?: string
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
  if (!body.routeId) {
    return jsonResponse({ error: 'routeId is required.' }, 400)
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authorization } },
  })

  const { data: linkData, error: linkError } = await supabase.rpc('create_driver_route_link', {
    p_route_id: body.routeId,
  })

  if (linkError || !linkData?.[0]?.route_token) {
    return jsonResponse({ error: linkError?.message ?? 'Could not create driver route link.' }, 400)
  }

  const { data: routeData, error: routeError } = await supabase
    .from('dispatch_routes')
    .select('route_name, sevadars ( name, phone )')
    .eq('id', body.routeId)
    .single()

  if (routeError || !routeData) {
    return jsonResponse({ error: routeError?.message ?? 'Could not load route.' }, 400)
  }

  const sevadar = (routeData as { sevadars?: { name: string; phone: string | null } | null }).sevadars
  if (!sevadar?.phone) {
    return jsonResponse({ error: 'Sevadar phone number is required to send the route link.' }, 400)
  }

  const routeUrl = `${normalizeOrigin(body.origin)}/driver/route/${linkData[0].route_token}`
  const message = `Langar Seva route: ${routeData.route_name}. Open your stops here: ${routeUrl}`

  try {
    const providerMessageId = await sendTwilioSms(sevadar.phone, message)
    await supabase.rpc('mark_driver_route_link_sent', {
      p_route_id: body.routeId,
      p_provider_message_id: providerMessageId === 'logged' ? null : providerMessageId,
    })

    return jsonResponse({
      ok: true,
      mode: providerMessageId === 'logged' ? 'logged' : 'sent',
      routeUrl,
      providerMessageId,
    })
  } catch (error) {
    return jsonResponse(
      {
        error: error instanceof Error ? error.message : 'SMS send failed.',
        routeUrl,
      },
      502,
    )
  }
})
