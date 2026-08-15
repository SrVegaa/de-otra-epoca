const book = document.getElementById('book');

function restoreCover() {
  if (!book) return;
  book.classList.remove('is-opening');
  book.style.animation = 'none';
  void book.offsetHeight;
  book.style.animation = '';
}

window.addEventListener('pageshow', () => {
  restoreCover();
  window.requestAnimationFrame(restoreCover);
});
window.addEventListener('pagehide', restoreCover);
window.addEventListener('popstate', restoreCover);
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) restoreCover();
});

document.querySelectorAll('.story-link').forEach((link) => {
  link.addEventListener('click', (event) => {
    if (event.metaKey || event.ctrlKey || event.shiftKey) return;
    event.preventDefault();
    const destination = link.href;
    if (book) book.classList.add('is-opening');
    window.setTimeout(() => { window.location.href = destination; }, 820);
  });
});
