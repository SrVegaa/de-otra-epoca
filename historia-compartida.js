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

    comments.dataset.comments = story.slug || `lector-${id}`;
    comments.hidden = false;

    const communityScript = document.createElement('script');
    communityScript.src = 'comunidad.js?v=2';
    document.body.appendChild(communityScript);
  } catch {
    title.textContent = 'Esta historia no está disponible';
    body.textContent = 'Puede estar pendiente de revisión o haber sido retirada.';
  }
})();
