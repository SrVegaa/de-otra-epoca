const book = document.getElementById('book');

function restoreCover() {
  if (book) book.classList.remove('is-opening');
}

window.addEventListener('pageshow', restoreCover);
window.addEventListener('pagehide', restoreCover);

document.querySelectorAll('.story-link').forEach((link) => {
  link.addEventListener('click', (event) => {
    if (event.metaKey || event.ctrlKey || event.shiftKey) return;
    event.preventDefault();
    const destination = link.href;
    if (book) book.classList.add('is-opening');
    window.setTimeout(() => { window.location.href = destination; }, 820);
  });
});
