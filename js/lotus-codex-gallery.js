(() => {
  'use strict';

  const links = [...document.querySelectorAll('[data-lotus-art]')];
  if (!links.length || typeof HTMLDialogElement === 'undefined') return;

  const dialog = document.createElement('dialog');
  if (typeof dialog.showModal !== 'function') return;

  dialog.className = 'lotus-art-dialog';
  dialog.setAttribute('aria-label', 'Codex artwork');
  dialog.innerHTML = `
    <div class="dialog-top"><button class="dialog-close" type="button" autofocus>Close artwork</button></div>
    <img alt="">
    <p aria-live="polite"></p>
    <div class="actions">
      <button class="button secondary" type="button">Previous artwork</button>
      <button class="button secondary" type="button">Next artwork</button>
    </div>`;
  document.body.append(dialog);

  const image = dialog.querySelector('img');
  const caption = dialog.querySelector('p');
  const close = dialog.querySelector('.dialog-close');
  const controls = dialog.querySelector('.actions');
  const [previous, next] = controls.querySelectorAll('button');
  controls.hidden = links.length < 2;
  let index = 0;
  let opener;

  function showArtwork(position) {
    index = (position + links.length) % links.length;
    const link = links[index];
    image.src = link.href;
    image.alt = link.querySelector('img').alt;
    const description = link.closest('figure').querySelector('figcaption').textContent.trim();
    caption.textContent = links.length > 1 ? `${description} (${index + 1} of ${links.length})` : description;
  }

  links.forEach((link, position) => {
    link.setAttribute('aria-haspopup', 'dialog');
    link.addEventListener('click', (event) => {
      if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      opener = link;
      showArtwork(position);
      dialog.showModal();
    });
  });

  close.addEventListener('click', () => dialog.close());
  previous.addEventListener('click', () => showArtwork(index - 1));
  next.addEventListener('click', () => showArtwork(index + 1));
  dialog.addEventListener('keydown', (event) => {
    if (controls.hidden) return;
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault();
      showArtwork(index + (event.key === 'ArrowLeft' ? -1 : 1));
    }
  });
  dialog.addEventListener('close', () => opener?.focus());
})();
