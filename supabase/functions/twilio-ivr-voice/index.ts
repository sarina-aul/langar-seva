import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.108.1'
import { sendTwilioSms } from '../_shared/twilio.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const SMS_TEMPLATES: Record<string, string> = {
  english:
    'Langar Seva: We received your meal request. A coordinator will call you soon to confirm your address.',
  punjabi:
    'Langar Seva: Asi tuhada langar request receive kar liya. Coordinator jald tuhade address di pushti lai call karega.',
  hindi:
    'Langar Seva: Humne aapki langar request receive kar li. Coordinator jald aapke address ki pushti ke liye call karenge.',
}

function xmlResponse(twiml: string, status = 200): Response {
  return new Response(twiml, {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'text/xml',
    },
  })
}

function baseUrl(request: Request): string {
  const url = new URL(request.url)
  return `${url.origin}${url.pathname}`
}

function twilioSay(text: string, language?: string): string {
  if (language) {
    return `<Say language="${language}">${text}</Say>`
  }
  return `<Say>${text}</Say>`
}

function langCode(lang: string): string {
  if (lang === 'pa') return 'pa-IN'
  if (lang === 'hi') return 'hi-IN'
  return 'en-US'
}

function languagePref(lang: string): 'english' | 'punjabi' | 'hindi' {
  if (lang === 'pa') return 'punjabi'
  if (lang === 'hi') return 'hindi'
  return 'english'
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const url = new URL(request.url)
  const step = url.searchParams.get('step') ?? 'lang'
  const lang = url.searchParams.get('lang') ?? 'en'
  const phoneOverride = url.searchParams.get('phone')
  const actionBase = baseUrl(request)

  if (request.method !== 'POST') {
    return xmlResponse('<Response><Say>Method not allowed.</Say></Response>', 405)
  }

  const form = await request.formData()
  const digits = form.get('Digits')?.toString() ?? ''
  const from = form.get('From')?.toString() ?? ''
  const callSid = form.get('CallSid')?.toString() ?? ''

  if (step === 'lang') {
    const selected = digits === '2' ? 'pa' : digits === '3' ? 'hi' : 'en'
    const menuUrl = `${actionBase}?step=menu&lang=${selected}`
    return xmlResponse(`<Response>
      ${twilioSay('Press 1 to request langar delivery.', langCode(selected))}
      <Gather action="${menuUrl}" numDigits="1" timeout="5">
        ${twilioSay('Press 1 to request langar delivery.', langCode(selected))}
      </Gather>
      ${twilioSay('We did not receive your selection. Goodbye.', langCode(selected))}
    </Response>`)
  }

  if (step === 'menu') {
    if (digits !== '1') {
      return xmlResponse(`<Response>${twilioSay('Goodbye.', langCode(lang))}</Response>`)
    }

    const callerPhone = from && !from.includes('anonymous') ? from : phoneOverride
    if (!callerPhone) {
      const gatherUrl = `${actionBase}?step=complete&lang=${lang}`
      return xmlResponse(`<Response>
        <Gather action="${gatherUrl}" numDigits="10" timeout="10">
          ${twilioSay('Please enter your 10 digit phone number.', langCode(lang))}
        </Gather>
      </Response>`)
    }

    const completeUrl = `${actionBase}?step=complete&lang=${lang}&phone=${encodeURIComponent(callerPhone)}`
    return xmlResponse(`<Response><Redirect method="POST">${completeUrl}</Redirect></Response>`)
  }

  if (step === 'complete') {
    const phone = phoneOverride ?? (digits.length >= 10 ? digits : from)
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    if (!supabaseUrl || !serviceKey) {
      return xmlResponse(`<Response>${twilioSay('System unavailable. Please try again later.', langCode(lang))}</Response>`, 500)
    }

    const supabase = createClient(supabaseUrl, serviceKey)
    const pref = languagePref(lang)

    const { data: recipientId, error } = await supabase.rpc('create_ivr_pending_recipient', {
      p_phone: phone,
      p_language: pref,
      p_call_sid: callSid,
    })

    if (error || !recipientId) {
      return xmlResponse(`<Response>${twilioSay('We could not save your request. Please try again later.', langCode(lang))}</Response>`)
    }

    const smsBody = SMS_TEMPLATES[pref] ?? SMS_TEMPLATES.english
    try {
      await sendTwilioSms(phone, smsBody)
      await supabase.rpc('mark_ivr_sms_status', { p_recipient_id: recipientId, p_status: 'sent' })
    } catch (smsError) {
      console.error('[ivr] SMS failed', smsError)
      await supabase.rpc('mark_ivr_sms_status', { p_recipient_id: recipientId, p_status: 'failed' })
    }

    return xmlResponse(`<Response>
      ${twilioSay('Thank you. Your request has been received. A coordinator will call you to confirm your address.', langCode(lang))}
    </Response>`)
  }

  return xmlResponse(`<Response>
    <Gather action="${actionBase}?step=lang" numDigits="1" timeout="5">
      ${twilioSay('Welcome to Langar Seva. Press 1 for English. Press 2 for Punjabi. Press 3 for Hindi.')}
    </Gather>
  </Response>`)
})
