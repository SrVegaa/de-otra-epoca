import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.111.0/+esm';

const SUPABASE_URL = 'https://bgfauwszjpmztgpcoobq.supabase.co';
const SUPABASE_KEY = 'sb_publishable_E4GqF4Hj5GGYfmG7-Wor6Q_0QgjYND0';
const PAGE_SIZE = 24;
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const grid = document.querySelector('#postales-grid');
const galleryStatus = document.querySelector('#postales-status');
const moreButton = document.querySelector('#load-more');
const uploadDialog = document.querySelector('#upload-dialog');
const photoDialog = document.querySelector('#photo-dialog');
const form = document.querySelector('#postcard-form');
const photoInput = document.querySelector('#postcard-image');
const descriptionInput = document.querySelector('#postcard-description');
const uploadStatus = document.querySelector('#upload-status');
const reactionButtons = new Map();
let offset = 0;
let currentPostcard = null;
let loading = false;
const visitStarted = Date.now();

function visitorToken() {
  try {
    let token = localStorage.getItem('deoe-postal-visitor');
    if (!token) {
      token = crypto.randomUUID();
      localStorage.setItem('deoe-postal-visitor', token);
    }
    return token;
  } catch {
    if (!window.__postalVisitor) window.__postalVisitor = crypto.randomUUID();
    return window.__postalVisitor;
  }
}

function cassetteIcon() {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', 'cassette-icon');
  svg.setAttribute('viewBox', '0 0 64 46');
  svg.setAttribute('aria-hidden', 'true');
  svg.innerHTML = '<path fill="#d99131" stroke="#6b3426" stroke-width="2.3" d="M7 3h50a4 4 0 0 1 4 4v32a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V7a4 4 0 0 1 4-4Z"/><path fill="#f5d691" stroke="#6b3426" stroke-width="1.7" d="M11 8h42v17H11z"/><path fill="#7b4031" d="M15 12h34v8H15z"/><circle cx="22" cy="16" r="3" fill="#f1ce81"/><circle cx="42" cy="16" r="3" fill="#f1ce81"/><path fill="#422a21" d="M18 29h28l6 9H12z"/><circle cx="25" cy="33" r="3.2" fill="#f1ce81"/><circle cx="39" cy="33" r="3.2" fill="#f1ce81"/><path stroke="#f9e2a9" stroke-width="1.5" d="M30 33h4"/>';
  return svg;
}

function makeReactionButton(postcard) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'cassette-reaction';
  button.setAttribute('aria-label', '¡Me acuerdo! Reaccionar a esta postal');
  button.setAttribute('aria-pressed', 'false');
  button.append(cassetteIcon());
  const phrase = document.createElement('span');
  phrase.textContent = '¡Me acuerdo!';
  const count = document.createElement('span');
  count.className = 'cassette-count';
  count.textContent = Number(postcard.reaction_count || 0).toLocaleString('es-AR');
  count.setAttribute('aria-label', `${postcard.reaction_count || 0} reacciones`);
  button.append(phrase, count);
  button.addEventListener('click', async () => toggleReaction(postcard.id, button));
  const list = reactionButtons.get(postcard.id) || [];
  list.push(button);
  reactionButtons.set(postcard.id, list);
  return button;
}

function updateReactionUI(id, reacted, count) {
  (reactionButtons.get(id) || []).forEach(button => {
    button.setAttribute('aria-pressed', reacted ? 'true' : 'false');
    button.classList.toggle('is-reacted', reacted);
    const counter = button.querySelector('.cassette-count');
    if (counter) {
      counter.textContent = Number(count || 0).toLocaleString('es-AR');
      counter.setAttribute('aria-label', `${count || 0} reacciones`);
    }
  });
}

async function toggleReaction(id, button) {
  if (button.disabled) return;
  button.disabled = true;
  try {
    const { data, error } = await supabase.functions.invoke('postcards', {
      body: { action: 'toggle', id, visitorToken: visitorToken() }
    });
    if (error) throw new Error(await functionErrorMessage(error, 'No pudimos guardar tu reacción.'));
    updateReactionUI(id, Boolean(data?.reacted), Number(data?.reaction_count || 0));
  } catch (error) {
    galleryStatus.textContent = error.message || 'No pudimos guardar tu reacción. Probá de nuevo.';
    galleryStatus.classList.add('is-error');
  } finally {
    button.disabled = false;
  }
}

function imageUrl(path) {
  return supabase.storage.from('postcards-published').getPublicUrl(path).data.publicUrl;
}

function openPhoto(postcard) {
  currentPostcard = postcard;
  const image = document.querySelector('#dialog-photo');
  image.src = imageUrl(postcard.published_image_path);
  image.alt = `Postal compartida por ${postcard.display_name || 'un visitante'}`;
  document.querySelector('#dialog-title').textContent = postcard.display_name || 'Un recuerdo compartido';
  document.querySelector('#dialog-description').textContent = postcard.description;
  document.querySelector('#dialog-year').textContent = postcard.approximate_year ? `Aproximadamente ${postcard.approximate_year}` : '';
  document.querySelector('#dialog-year').hidden = !postcard.approximate_year;
  document.querySelector('#dialog-author').textContent = 'Una postal de otra época';
  const old = photoDialog.querySelector('.dialog-reaction');
  const button = makeReactionButton(postcard);
  button.classList.add('dialog-reaction');
  old.replaceWith(button);
  const matching = (reactionButtons.get(postcard.id) || []).filter(el => el !== button);
  reactionButtons.set(postcard.id, [...matching, button]);
  const cardButton = grid.querySelector(`[data-postcard-id="${postcard.id}"] .cassette-reaction`);
  if (cardButton) button.setAttribute('aria-pressed', cardButton.getAttribute('aria-pressed') || 'false');
  photoDialog.showModal();
}

function renderPostcard(postcard, index) {
  const card = document.createElement('article');
  card.className = 'postcard';
  card.dataset.postcardId = postcard.id;
  card.style.setProperty('--tilt', `${[-0.65, 0.45, -0.25, 0.7][index % 4]}deg`);
  const imageButton = document.createElement('button');
  imageButton.className = 'postcard-photo-button';
  imageButton.type = 'button';
  imageButton.setAttribute('aria-label', `Ver en grande: ${postcard.description}`);
  const image = document.createElement('img');
  image.src = imageUrl(postcard.published_image_path);
  image.alt = postcard.description;
  image.loading = index < 8 ? 'eager' : 'lazy';
  image.decoding = 'async';
  imageButton.append(image);
  imageButton.addEventListener('click', () => openPhoto(postcard));
  const copy = document.createElement('div');
  copy.className = 'postcard-copy';
  const description = document.createElement('p');
  description.className = 'postcard-caption';
  description.textContent = postcard.description;
  const meta = document.createElement('div');
  meta.className = 'postcard-meta';
  const author = document.createElement('span');
  author.textContent = postcard.display_name || 'Un recuerdo compartido';
  const year = document.createElement('span');
  year.textContent = postcard.approximate_year || '';
  meta.append(author, year);
  copy.append(description, meta, makeReactionButton(postcard));
  card.append(imageButton, copy);
  return card;
}

async function loadReactionStates(items) {
  if (!items.length) return;
  try {
    const { data, error } = await supabase.functions.invoke('postcards', {
      body: { action: 'reaction-state', ids: items.map(item => item.id), visitorToken: visitorToken() }
    });
    if (error) return;
    const ids = new Set(data?.reactedIds || []);
    items.forEach(item => updateReactionUI(item.id, ids.has(item.id), item.reaction_count));
  } catch { /* Las reacciones siguen disponibles si esta consulta falla. */ }
}

async function loadPostcards() {
  if (loading) return;
  loading = true;
  moreButton.disabled = true;
  galleryStatus.classList.remove('is-error');
  try {
    const { data, error } = await supabase
      .from('postcards')
      .select('id,description,approximate_year,display_name,published_image_path,reaction_count,published_at')
      .eq('status', 'approved')
      .not('published_at', 'is', null)
      .order('published_at', { ascending: false })
      .range(offset, offset + PAGE_SIZE - 1);
    if (error) throw error;
    const items = data || [];
    items.forEach((item, index) => grid.append(renderPostcard(item, offset + index)));
    await loadReactionStates(items);
    offset += items.length;
    galleryStatus.textContent = offset ? '' : 'Todavía no hay postales publicadas. Podés compartir la primera.';
    moreButton.hidden = items.length < PAGE_SIZE;
  } catch (error) {
    galleryStatus.textContent = 'No pudimos cargar las postales. Revisá tu conexión e intentá de nuevo.';
    galleryStatus.classList.add('is-error');
  } finally {
    loading = false;
    moreButton.disabled = false;
  }
}

function setUploadMessage(message, kind = '') {
  uploadStatus.textContent = message;
  uploadStatus.className = `upload-status${kind ? ` ${kind}` : ''}`;
}

async function functionErrorMessage(error, fallback) {
  try {
    const response = error?.context;
    if (response instanceof Response) {
      const body = await response.clone().json();
      if (body?.error) return body.error;
    }
  } catch { /* Usamos el mensaje general del cliente si no hay cuerpo JSON. */ }
  return error?.message || fallback;
}

function showDialog(dialog) {
  if (typeof dialog.showModal === 'function') dialog.showModal();
  else dialog.setAttribute('open', '');
}

document.querySelector('#open-upload').addEventListener('click', () => {
  setUploadMessage('');
  showDialog(uploadDialog);
});
document.querySelectorAll('[data-close-dialog]').forEach(button => button.addEventListener('click', () => button.closest('dialog').close()));
document.querySelectorAll('dialog').forEach(dialog => dialog.addEventListener('click', event => {
  if (event.target === dialog) dialog.close();
}));
moreButton.addEventListener('click', loadPostcards);
descriptionInput.addEventListener('input', () => document.querySelector('#description-count').textContent = descriptionInput.value.length);

let previewObjectUrl = null;
photoInput.addEventListener('change', () => {
  const file = photoInput.files?.[0];
  const preview = document.querySelector('#upload-preview');
  if (previewObjectUrl) URL.revokeObjectURL(previewObjectUrl);
  previewObjectUrl = null;
  preview.hidden = !file;
  if (!file) return;
  document.querySelector('#file-label').textContent = file.name;
  previewObjectUrl = URL.createObjectURL(file);
  document.querySelector('#preview-image').src = previewObjectUrl;
  setUploadMessage('');
});

function decodeImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => { URL.revokeObjectURL(url); resolve(image); };
    image.onerror = () => { URL.revokeObjectURL(url); reject(new Error('El navegador no pudo abrir esta imagen. Probá con JPG, PNG o WebP.')); };
    image.src = url;
  });
}

async function optimizeImage(file) {
  if (!file || !file.type.startsWith('image/')) throw new Error('Elegí una imagen válida.');
  if (file.size > 20 * 1024 * 1024) throw new Error('La foto original no puede superar los 20 MB.');
  const image = await decodeImage(file);
  const maxDimension = 1800;
  const scale = Math.min(1, maxDimension / Math.max(image.naturalWidth, image.naturalHeight));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
  const context = canvas.getContext('2d', { alpha: false });
  context.fillStyle = '#fff';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  const toBlob = quality => new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', quality));
  let optimized = await toBlob(.86);
  if (!optimized) throw new Error('No pudimos optimizar la foto en este dispositivo.');
  if (optimized.size > 2.5 * 1024 * 1024) optimized = await toBlob(.76);
  if (!optimized || optimized.size > 2.5 * 1024 * 1024) throw new Error('La foto sigue siendo muy pesada. Probá con otra imagen.');
  return new File([optimized], 'postal.jpg', { type: 'image/jpeg', lastModified: Date.now() });
}

form.addEventListener('submit', async event => {
  event.preventDefault();
  const button = form.querySelector('[type="submit"]');
  const formData = new FormData(form);
  const name = String(formData.get('name') || '').trim();
  const description = String(formData.get('description') || '').trim();
  const year = String(formData.get('year') || '').trim();
  if (!name || !description || !formData.get('consent')) return setUploadMessage('Completá tu nombre, la descripción y la confirmación de permiso.', 'error');
  if (description.length > 200) return setUploadMessage('La descripción puede tener hasta 200 caracteres.', 'error');
  if (year && (!/^\d{4}$/.test(year) || Number(year) < 1900 || Number(year) > 2100)) return setUploadMessage('Escribí un año aproximado válido o dejalo vacío.', 'error');
  if (formData.get('website')) return;
  if (Date.now() - visitStarted < 2500) return setUploadMessage('Esperá un momento y volvé a enviar la foto.', 'error');
  button.disabled = true;
  setUploadMessage('Preparando la fotografía…');
  try {
    const optimized = await optimizeImage(photoInput.files?.[0]);
    const payload = new FormData();
    payload.set('action', 'submit');
    payload.set('visitorToken', visitorToken());
    payload.set('name', name);
    payload.set('description', description);
    payload.set('year', year);
    payload.set('consent', 'true');
    payload.set('website', String(formData.get('website') || ''));
    payload.set('elapsedMs', String(Date.now() - visitStarted));
    payload.set('image', optimized, 'postal.jpg');
    setUploadMessage('Enviando tu recuerdo para revisión…');
    const { data, error } = await supabase.functions.invoke('postcards', { body: payload });
    if (error) throw new Error(data?.error || await functionErrorMessage(error, 'No pudimos enviar la fotografía.'));
    if (!data?.ok) throw new Error(data?.error || 'No pudimos enviar la fotografía.');
    form.reset();
    document.querySelector('#file-label').textContent = 'Elegí una fotografía';
    document.querySelector('#description-count').textContent = '0';
    document.querySelector('#upload-preview').hidden = true;
    if (previewObjectUrl) URL.revokeObjectURL(previewObjectUrl);
    previewObjectUrl = null;
    setUploadMessage('¡Listo! La postal quedó pendiente de aprobación. Cuando la aprobemos, va a aparecer en la galería.', 'success');
  } catch (error) {
    setUploadMessage(error.message || 'No pudimos enviar la foto. Probá nuevamente.', 'error');
  } finally {
    button.disabled = false;
  }
});

loadPostcards();
