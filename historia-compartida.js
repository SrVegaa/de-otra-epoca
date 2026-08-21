const URL = 'https://bgfauwszjpmztgpcoobq.supabase.co';
const KEY = 'sb_publishable_E4GqF4Hj5GGYfmG7-Wor6Q_0QgjYND0';
const headers = { apikey: KEY };
const id = new URLSearchParams(location.search).get('id');

const title = document.querySelector('#shared-title');
const author = document.querySelector('#shared-author');
const body = document.querySelector('#shared-body');
const photos = document.querySelector('#shared-photos');
const comments = document.querySelector('#shared-comments');
const chapter = document.querySelector('#shared-chapter');
const navigation = document.querySelector('#shared-navigation');


async function buildNavigation() {
  const staticStories = [
    { title: 'La lapicera de diez colores', href: 'lapicera-diez-colores.html' },
    { title: 'Agosto, tiempo de volantines', href: 'volantines.html' },
    { title: 'Amores en la edad del pavo', href: 'amores-edad-del-pavo.html' },
    { title: 'El silbido de mi viejo', href: 'silbido-de-mi-viejo.html' },
    { title: 'El 21 de septiembre', href: '21-de-septiembre.html' }
  ];
  const response = await fetch(
    URL + '/rest/v1/stories?status=eq.approved&select=id,title,source_kind,story_number,published_at',
    { headers }
  );
  if (!response.ok) return;
  const records = await response.json();
  const official = records.filter(item => item.source_kind === 'official').sort((a,b) => (a.story_number || 999) - (b.story_number || 999));
  const readers = records.filter(item => item.source_kind !== 'official').sort((a,b) => new Date(a.published_at) - new Date(b.published_at));
  const dynamic = [...official, ...readers].map(item => ({
    id: item.id,
    title: item.title.replace(/\.$/, ''),
    href: 'historia-compartida.html?id=' + encodeURIComponent(item.id)
  }));
  const sequence = [...staticStories, ...dynamic];
  const current = sequence.findIndex(item => item.id === id);
  if (current < 0) return;
  navigation.replaceChildren();
  const previous = sequence[current - 1];
  const next = sequence[current + 1];
  const left = document.createElement('a');
  if (previous) { left.href = previous.href; left.textContent = '← Anterior: ' + previous.title; }
  else { left.href = 'historias.html'; left.textContent = '← Volver al índice'; }
  const right = document.createElement('a');
  if (next) { right.href = next.href; right.textContent = 'Siguiente: ' + next.title + ' →'; }
  else { right.href = 'historias.html'; right.textContent = 'Volver al índice →'; }
  navigation.append(left, right);
  navigation.hidden = false;
}

(async () => {
  try {
    if (!id) throw new Error();

    const fields = 'title,body,author_mode,author_name,photo_paths,slug,source_kind,story_number';
    const response = await fetch(
      `${URL}/rest/v1/stories?id=eq.${encodeURIComponent(id)}&status=eq.approved&select=${fields}`,
      { headers }
    );

    if (!response.ok) throw new Error();
    const [story] = await response.json();
    if (!story) throw new Error();

    document.title = `${story.title} — De Otra Época`;
    title.textContent = story.title;
    if (story.source_kind === 'official' && story.story_number) chapter.textContent = `Historia ${String(story.story_number).padStart(2, '0')}`;
    author.textContent = `Autor: ${
      story.author_mode === 'anonymous' || !story.author_name
        ? 'Anónimo'
        : story.author_name
    }`;

    story.body
      .split(/\n+/)
      .filter(Boolean)
      .forEach((text) => {
        const paragraph = document.createElement('p');
        paragraph.textContent = text;
        body.appendChild(paragraph);
      });

    (story.photo_paths || []).forEach((path) => {
      const image = document.createElement('img');
      image.src = `${URL}/storage/v1/object/public/story-published/${path}`;
      image.alt = `Fotografía de ${story.title}`;
      image.loading = 'lazy';
      photos.appendChild(image);
    });

    const backdropImage = photos.querySelector('img');
    if (backdropImage) {
      const safeSource = backdropImage.src.replace(/"/g, '\\"');
      document.body.style.setProperty('--story-backdrop', 'url("' + safeSource + '")');
      document.body.classList.add('story-image-backdrop');
    }

    await buildNavigation();

    comments.dataset.comments = story.slug || `lector-${id}`;
    comments.hidden = false;

    const communityScript = document.createElement('script');
    communityScript.src = 'comunidad.js?v=6';
    document.body.appendChild(communityScript);
  } catch {
    title.textContent = 'Esta historia no está disponible';
    body.textContent = 'Puede estar pendiente de revisión o haber sido retirada.';
  }
})();
