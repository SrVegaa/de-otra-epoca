import { createClient } from 'npm:@supabase/supabase-js@2.111.0';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_SERVICE_KEY')!;
const ADMIN_ID = 'f5de4699-d26e-4b10-9c75-fea1dcb44c52';
const BUCKET_PENDING = 'postcards-pending';
const BUCKET_PUBLISHED = 'postcards-published';
const HASH_SECRET = SERVICE_KEY;
const service = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });

const permittedOrigins = new Set([
  'https://deotraepoca.com',
  'https://www.deotraepoca.com',
  'https://srvegaa.github.io',
  'http://localhost:5173',
  'http://127.0.0.1:5500'
]);

function headersFor(origin: string | null): HeadersInit {
  const headers: Record<string, string> = {
    'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Max-Age': '86400',
    'Cache-Control': 'no-store',
    'Content-Type': 'application/json; charset=utf-8',
    'Vary': 'Origin'
  };
  if (origin && (permittedOrigins.has(origin) || origin.endsWith('.github.io'))) headers['Access-Control-Allow-Origin'] = origin;
  return headers;
}

function respond(body: unknown, status = 200, origin: string | null = null) {
  return new Response(JSON.stringify(body), { status, headers: headersFor(origin) });
}

async function digest(value: string): Promise<string> {
  const data = new TextEncoder().encode(`${HASH_SECRET}\0${value}`);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(hash)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}

function remoteIp(req: Request): string {
  return req.headers.get('cf-connecting-ip') || req.headers.get('x-real-ip') || req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
}

function cleanVisitorToken(value: unknown): string {
  if (typeof value !== 'string' || value.length < 16 || value.length > 128 || !/^[a-zA-Z0-9-]+$/.test(value)) {
    throw new Error('No pudimos validar esta visita. Actualizá la página e intentá de nuevo.');
  }
  return value;
}

async function rateLimit(value: string, action: string, maximum: number, seconds: number) {
  const key = await digest(value);
  const { data, error } = await service.rpc('consume_postcard_rate_limit', {
    p_bucket_key: key,
    p_action: action,
    p_max_requests: maximum,
    p_window_seconds: seconds
  });
  if (error) throw new Error('No pudimos validar el envío. Probá nuevamente en unos minutos.');
  if (data !== true) throw new Error(action === 'submit' ? 'Ya recibimos varios envíos desde esta conexión. Probá de nuevo más tarde.' : 'Esperá un momento antes de volver a reaccionar.');
}

function matchesImage(bytes: Uint8Array, type: string): boolean {
  if (type === 'image/jpeg') return bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (type === 'image/png') return bytes.length > 8 && [137,80,78,71,13,10,26,10].every((value, index) => bytes[index] === value);
  if (type === 'image/webp') return bytes.length > 12 && String.fromCharCode(...bytes.slice(0,4)) === 'RIFF' && String.fromCharCode(...bytes.slice(8,12)) === 'WEBP';
  return false;
}

function getAccessToken(req: Request): string | null {
  const value = req.headers.get('authorization') || '';
  return value.match(/^Bearer\s+(.+)$/i)?.[1] || null;
}

async function requireAdmin(req: Request): Promise<void> {
  const token = getAccessToken(req);
  if (!token) throw new Error('Iniciá sesión como administrador.');
  const authClient = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await authClient.auth.getUser(token);
  if (error || data.user?.id !== ADMIN_ID) throw new Error('No tenés permiso para administrar postales.');
}

async function submitPostcard(req: Request, form: FormData) {
  const name = String(form.get('name') || '').trim();
  const description = String(form.get('description') || '').trim();
  const yearText = String(form.get('year') || '').trim();
  const consent = String(form.get('consent') || '') === 'true';
  const visitor = cleanVisitorToken(form.get('visitorToken'));
  const elapsedMs = Number(form.get('elapsedMs') || 0);
  const image = form.get('image');

  if (String(form.get('website') || '').trim()) throw new Error('No pudimos recibir este envío.');
  if (elapsedMs < 2500) throw new Error('Esperá un momento y volvé a enviar la foto.');
  if (!consent) throw new Error('Confirmá que tenés permiso para compartir la foto.');
  if (!name || name.length > 60 || !description || description.length > 200) throw new Error('Revisá el nombre y la descripción.');
  const year = yearText ? Number(yearText) : null;
  if (yearText && (!Number.isInteger(year) || year! < 1900 || year! > 2100)) throw new Error('Escribí un año válido o dejalo vacío.');
  if (!(image instanceof File)) throw new Error('Elegí una fotografía para enviar.');
  if (image.size < 16 || image.size > 4 * 1024 * 1024) throw new Error('La foto optimizada debe pesar hasta 4 MB.');
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(image.type)) throw new Error('El archivo debe ser una imagen JPG, PNG o WebP válida.');
  const imageBuffer = await image.arrayBuffer();
  const bytes = new Uint8Array(imageBuffer);
  if (!matchesImage(bytes, image.type)) throw new Error('El contenido del archivo no coincide con el formato de imagen declarado.');

  const ip = remoteIp(req);
  const ipIdentity = ip === 'unknown' ? `visitor:${visitor}` : `ip:${ip}`;
  await rateLimit(ipIdentity, 'submit', 5, 60 * 60);
  await rateLimit(`visitor:${visitor}`, 'submit-visitor', 3, 60 * 60);

  const path = `incoming/${crypto.randomUUID()}.${image.type.split('/')[1]}`;
  const { error: uploadError } = await service.storage.from(BUCKET_PENDING).upload(path, imageBuffer, {
    contentType: image.type,
    cacheControl: '3600',
    upsert: false
  });
  if (uploadError) throw new Error('No pudimos guardar la foto. Probá nuevamente.');

  const { data, error } = await service.from('postcards').insert({
    display_name: name,
    description,
    approximate_year: year,
    image_path: path,
    consent: true,
    status: 'pending'
  }).select('id').single();
  if (error) {
    await service.storage.from(BUCKET_PENDING).remove([path]);
    throw new Error('No pudimos registrar el recuerdo. Probá nuevamente.');
  }
  return { ok: true, id: data.id };
}

async function handleReactionState(body: Record<string, unknown>, req: Request) {
  const visitor = cleanVisitorToken(body.visitorToken);
  if (!Array.isArray(body.ids) || body.ids.length > 100) throw new Error('No pudimos consultar las reacciones.');
  const ids = body.ids.filter((id): id is string => typeof id === 'string' && /^[0-9a-f-]{36}$/i.test(id));
  const visitorHash = await digest(`visitor:${visitor}`);
  const { data, error } = await service.rpc('postcard_reaction_states', {
    p_postcard_ids: ids,
    p_visitor_hash: visitorHash
  });
  if (error) throw new Error('No pudimos consultar las reacciones.');
  return { ok: true, reactedIds: (data || []).map((row: { postcard_id: string }) => row.postcard_id) };
}

async function handleToggle(body: Record<string, unknown>, req: Request) {
  const visitor = cleanVisitorToken(body.visitorToken);
  if (typeof body.id !== 'string' || !/^[0-9a-f-]{36}$/i.test(body.id)) throw new Error('Postal no disponible.');
  const ip = remoteIp(req);
  const ipIdentity = ip === 'unknown' ? `visitor:${visitor}` : `ip:${ip}`;
  await rateLimit(ipIdentity, 'reaction', 40, 60 * 60);
  const visitorHash = await digest(`visitor:${visitor}`);
  const { data: reacted, error: toggleError } = await service.rpc('toggle_postcard_reaction', {
    p_postcard_id: body.id,
    p_visitor_hash: visitorHash
  });
  if (toggleError) throw new Error('Postal no disponible.');
  const { data, error } = await service.from('postcards').select('reaction_count').eq('id', body.id).single();
  if (error) throw new Error('No pudimos actualizar la reacción.');
  return { ok: true, reacted: Boolean(reacted), reaction_count: data.reaction_count };
}

async function adminAction(body: Record<string, unknown>, req: Request) {
  await requireAdmin(req);
  const action = String(body.action || '');
  const id = String(body.id || '');
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new Error('Postal no disponible.');

  const { data: postcard, error: readError } = await service.from('postcards').select('*').eq('id', id).maybeSingle();
  if (readError || !postcard) throw new Error('No encontramos esa postal.');

  if (action === 'approve') {
    if (postcard.status === 'approved') return { ok: true };
    const extension = postcard.image_path.split('.').pop() || 'jpg';
    const targetPath = `approved/${id}.${extension}`;
    const { error: copyError } = await service.storage.from(BUCKET_PENDING).copy(postcard.image_path, targetPath, { destinationBucket: BUCKET_PUBLISHED });
    if (copyError && !String(copyError.message).toLowerCase().includes('already')) throw new Error('No pudimos publicar la fotografía.');
    const now = new Date().toISOString();
    const { error: updateError } = await service.from('postcards').update({
      status: 'approved',
      published_image_path: targetPath,
      reviewed_at: now,
      published_at: now
    }).eq('id', id);
    if (updateError) {
      await service.storage.from(BUCKET_PUBLISHED).remove([targetPath]);
      throw new Error('No pudimos publicar la postal.');
    }
    await service.storage.from(BUCKET_PENDING).remove([postcard.image_path]);
    return { ok: true };
  }

  if (action === 'reject') {
    const { error } = await service.from('postcards').update({ status: 'rejected', published_image_path: null, reviewed_at: new Date().toISOString(), published_at: null }).eq('id', id);
    if (error) throw new Error('No pudimos rechazar la postal.');
    if (postcard.published_image_path) {
      const { error: removalError } = await service.storage.from(BUCKET_PUBLISHED).remove([postcard.published_image_path]);
      if (removalError) throw new Error('Postal rechazada, pero la foto no se pudo retirar del almacenamiento. Probá eliminarla desde el panel.');
    }
    return { ok: true };
  }

  if (action === 'delete') {
    const { error: pendingRemovalError } = await service.storage.from(BUCKET_PENDING).remove([postcard.image_path]);
    if (pendingRemovalError) throw new Error('No pudimos eliminar la foto pendiente.');
    if (postcard.published_image_path) {
      const { error: publishedRemovalError } = await service.storage.from(BUCKET_PUBLISHED).remove([postcard.published_image_path]);
      if (publishedRemovalError) throw new Error('No pudimos retirar la foto publicada.');
    }
    const { error } = await service.from('postcards').delete().eq('id', id);
    if (error) throw new Error('No pudimos eliminar la postal.');
    return { ok: true };
  }

  if (action === 'edit') {
    const description = String(body.description || '').trim();
    const displayName = String(body.display_name || '').trim();
    const yearValue = body.approximate_year === '' || body.approximate_year === null ? null : Number(body.approximate_year);
    if (!description || description.length > 200 || !displayName || displayName.length > 60) throw new Error('Revisá la descripción y el nombre.');
    if (yearValue !== null && (!Number.isInteger(yearValue) || yearValue < 1900 || yearValue > 2100)) throw new Error('El año no es válido.');
    const { error } = await service.from('postcards').update({ description, display_name: displayName, approximate_year: yearValue }).eq('id', id);
    if (error) throw new Error('No pudimos guardar los cambios.');
    return { ok: true };
  }
  throw new Error('Acción administrativa no disponible.');
}

Deno.serve(async req => {
  const origin = req.headers.get('origin');
  if (req.method === 'OPTIONS') return new Response('ok', { headers: headersFor(origin) });
  if (req.method !== 'POST') return respond({ ok: false, error: 'Método no permitido.' }, 405, origin);
  const contentLength = Number(req.headers.get('content-length') || 0);
  if (contentLength > 5 * 1024 * 1024 + 64 * 1024) return respond({ ok: false, error: 'La foto supera el tamaño permitido.' }, 413, origin);
  try {
    const contentType = req.headers.get('content-type') || '';
    if (contentType.includes('multipart/form-data')) {
      const form = await req.formData();
      if (String(form.get('action') || '') !== 'submit') return respond({ ok: false, error: 'Solicitud no válida.' }, 400, origin);
      return respond(await submitPostcard(req, form), 200, origin);
    }
    const body = await req.json() as Record<string, unknown>;
    if (body.action === 'toggle') return respond(await handleToggle(body, req), 200, origin);
    if (body.action === 'reaction-state') return respond(await handleReactionState(body, req), 200, origin);
    if (body.action === 'approve' || body.action === 'reject' || body.action === 'delete' || body.action === 'edit') {
      return respond(await adminAction(body, req), 200, origin);
    }
    return respond({ ok: false, error: 'Acción no disponible.' }, 400, origin);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Ocurrió un error.';
    const status = message.includes('Iniciá sesión') || message.includes('permiso') ? 403 : message.includes('varios envíos') || message.includes('Esperá un momento antes') ? 429 : 400;
    return respond({ ok: false, error: message }, status, origin);
  }
});
