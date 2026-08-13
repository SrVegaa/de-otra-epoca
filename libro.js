document.querySelectorAll('.story-link').forEach((link) => {
  link.addEventListener('click', (event) => {
    if (event.metaKey || event.ctrlKey || event.shiftKey) return;
    event.preventDefault();
    const destination = link.href;
    document.getElementById('book').classList.add('is-opening');
    window.setTimeout(() => { window.location.href = destination; }, 820);
  });
});
