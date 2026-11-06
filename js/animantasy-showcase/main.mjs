import {TAGS, filterBooks, buildApplication, safeExternalUrl} from './model.mjs';
import {submissionAdapter} from './preview-adapter.mjs';
import {emailDeliveryAvailable, prepareEmailSubmission, createEmailForm} from './email-adapter.mjs';
import {prepareEmailDraft} from './email-draft.mjs';

const $ = selector => document.querySelector(selector);
const catalog = JSON.parse($('#showcase-catalog').textContent);
const settings = JSON.parse($('#showcase-settings').textContent);
const emailIsOpen = emailDeliveryAvailable(settings, location.origin);
const books = catalog.books.filter(book => book.status === 'published');
const cards = new Map([...document.querySelectorAll('[data-book-id]')].map(card => [card.dataset.bookId,card]));
const grid = $('#book-grid');
const filters = $('#directory-filters');
let coverUrl = null;
let chosenCover = null;
let spotlightIndex = 0;
let pendingApplication = null;
let applicationDownloadUrl = null;

function node(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text != null) element.textContent = text;
  return element;
}
function bookLink(book, className, label) {
  const link = node('a', className, label);
  link.href = safeExternalUrl(book.bookUrl) || '#directory';
  link.target = '_blank'; link.rel = 'noopener noreferrer';
  return link;
}
function tags(items) {
  const list = node('div','tags');
  items.forEach(tag => list.append(node('span','',tag)));
  return list;
}
function image(book) {
  const img = node('img');
  img.src = book.cover;
  img.alt = `${book.title} book cover`;
  img.width = book.coverWidth || 400; img.height = book.coverHeight || 600;
  return img;
}
function updateDirectory() {
  const result = filterBooks(books, {
    query: $('#book-search').value, tag: $('#genre-filter').value,
    format: $('#format-filter').value, sort: $('#book-sort').value
  });
  const ids = new Set(result.map(book => book.id));
  cards.forEach((card,id) => { card.hidden = !ids.has(id); });
  result.forEach(book => grid.append(cards.get(book.id)));
  $('#result-count').textContent = `${result.length} of ${books.length} reading picks${result.length === 1 ? ' matches' : ' match'}`;
  $('#empty-state').hidden = result.length !== 0;
  grid.hidden = result.length === 0;
  $('#clear-filters').disabled = !$('#book-search').value && !$('#genre-filter').value && !$('#format-filter').value && $('#book-sort').value === 'curated';
}
function resetFilters() { filters.reset(); updateDirectory(); }
for (const tag of [...new Set(books.flatMap(book => book.tags))].sort()) {
  const option = node('option','',tag); option.value = tag; $('#genre-filter').append(option);
}
filters.addEventListener('submit',event => event.preventDefault());
filters.addEventListener('input',updateDirectory);
filters.addEventListener('change',updateDirectory);
$('#clear-filters').addEventListener('click',resetFilters);
$('#empty-reset').addEventListener('click',() => { resetFilters(); $('#book-search').focus(); });
filters.hidden = false;
$('.result-line').hidden = false;
updateDirectory();

const spotlights = catalog.spotlightIds.map(id => books.find(book => book.id === id)).filter(Boolean);
function renderSpotlight() {
  const book = spotlights[spotlightIndex];
  if (!book) return;
  const art = node('div','spotlight-cover'); art.append(image(book));
  const copy = node('div','spotlight-copy');
  copy.append(node('p','eyebrow','INDEPENDENT AUTHOR · READING PICK'),node('h3','',book.author),
    node('p','spotlight-book',book.title),node('p','spotlight-text',book.spotlight),
    tags(book.tags),bookLink(book,'text-link',`Explore ${book.title} ↗`));
  $('[data-spotlight]').replaceChildren(art,copy);
  $('#spotlight-position').textContent = `${spotlightIndex+1} / ${spotlights.length}`;
}
function moveSpotlight(step) { spotlightIndex = (spotlightIndex + step + spotlights.length) % spotlights.length; renderSpotlight(); }
$('#spotlight-prev').addEventListener('click',() => moveSpotlight(-1));
$('#spotlight-next').addEventListener('click',() => moveSpotlight(1));
$('.spotlight-controls').hidden = spotlights.length < 2;
renderSpotlight();

const form = $('#author-form');
const coverInput = $('#application-cover');
const coverInputHome = coverInput.parentElement;
const coverInputFollowing = coverInput.nextSibling;
let activeDeliveryForm = null;
const preview = $('#application-preview');
TAGS.forEach(tag => {
  const label = node('label','tag-choice');
  const checkbox = node('input'); checkbox.type = 'checkbox'; checkbox.name = 'tags'; checkbox.value = tag;
  label.append(checkbox,document.createTextNode(tag)); $('#application-tags').append(label);
});
function clearErrors() {
  form.querySelectorAll('.field-error').forEach(item => { item.textContent = ''; });
  form.querySelectorAll('[aria-invalid]').forEach(item => item.removeAttribute('aria-invalid'));
  $('#application-status').textContent = '';
}
function showErrors(errors) {
  let first;
  for (const [name,message] of Object.entries(errors)) {
    $(`#error-${name}`).textContent = message;
    const control = form.elements.namedItem(name);
    const element = control instanceof RadioNodeList ? control[0] : control;
    if (element) { element.setAttribute('aria-invalid','true'); first ||= element; }
  }
  const count = Object.keys(errors).length;
  $('#application-status').textContent = `Check ${count} ${count === 1 ? 'field' : 'fields'} before previewing. Nothing has been sent.`;
  first?.focus();
}
function releaseCover() {
  releaseEmailDraft();
  pendingApplication = null;
  $('#preview-card').replaceChildren(); preview.hidden = true;
  if (coverUrl) URL.revokeObjectURL(coverUrl);
  coverUrl = null; chosenCover = null;
  $('#selected-cover').removeAttribute('src');
  $('.cover-selection').hidden = true;
  $('#cover-name').textContent = '';
}
function releaseEmailDraft() {
  if (applicationDownloadUrl) URL.revokeObjectURL(applicationDownloadUrl);
  applicationDownloadUrl = null;
  $('#direct-email-controls').hidden = true;
  $('#application-email-text').value = '';
  $('#open-email-draft').removeAttribute('href');
  $('#open-gmail').removeAttribute('href');
  $('#open-outlook').removeAttribute('href');
  $('#save-application').removeAttribute('href');
  $('#direct-email-status').textContent = '';
}
function renderEmailDraft(application) {
  releaseEmailDraft();
  if (!settings.email?.directEmailFallback) return;
  const draft = prepareEmailDraft(application,chosenCover,settings.email.recipient);
  $('#application-email-text').value = draft.text;
  $('#open-email-draft').href = draft.mailto;
  $('#open-gmail').href = draft.gmail;
  $('#open-outlook').href = draft.outlook;
  applicationDownloadUrl = URL.createObjectURL(new Blob([draft.text],{type:'text/plain;charset=utf-8'}));
  $('#save-application').href = applicationDownloadUrl;
  $('#save-application').download = draft.filename;
  $('#cover-reminder').textContent = `Attach your cover: ${chosenCover.name}`;
  $('#direct-email-status').textContent = 'Opening a draft does not send it. You send the email yourself, so you keep a copy.';
  $('#direct-email-controls').hidden = false;
}
$('#copy-application').addEventListener('click',async () => {
  const text = $('#application-email-text');
  try {
    await navigator.clipboard.writeText(text.value);
    $('#direct-email-status').textContent = 'Application copied. Paste it into your email and attach your cover before sending.';
  } catch {
    text.focus(); text.select();
    $('#direct-email-status').textContent = 'Select and copy the application text, or save it as a file to attach to your email.';
  }
});
$('#open-email-draft').addEventListener('click',() => {
  $('#direct-email-status').textContent = 'Your email app may open a draft. Paste the application or attach its saved text file, attach your cover, then send. Nothing has been sent by this page.';
});
for (const id of ['#open-gmail','#open-outlook']) $(id).addEventListener('click',() => {
  $('#direct-email-status').textContent = `A ready-made email should open in a new tab. Attach your cover (${chosenCover?.name || 'your cover image'}), then press send. Nothing has been sent by this page.`;
});
coverInput.addEventListener('change',async () => {
  releaseCover();
  const file = coverInput.files[0];
  $('#error-cover').textContent = '';
  coverInput.removeAttribute('aria-invalid');
  if (!file) return;
  if (!['image/jpeg','image/png','image/webp'].includes(file.type) || file.size > 5*1024*1024 || !file.size) {
    coverInput.value = ''; showErrors({cover:'Choose a JPG, PNG or WebP cover up to 5 MB.'}); return;
  }
  const candidate = URL.createObjectURL(file);
  const img = new Image(); img.src = candidate;
  try {
    await img.decode();
    // A later selection/reset must not resurrect an earlier file.
    if (coverInput.files[0] !== file) { URL.revokeObjectURL(candidate); return; }
    if (img.naturalWidth < 100 || img.naturalHeight < 100 || img.naturalWidth * img.naturalHeight > 40000000) throw new Error('dimensions');
    coverUrl = candidate; chosenCover = file;
    $('#selected-cover').src = coverUrl; $('#cover-name').textContent = file.name;
    $('.cover-selection').hidden = false;
  } catch {
    URL.revokeObjectURL(candidate);
    if (coverInput.files[0] !== file) return;
    coverInput.value = ''; showErrors({cover:'Choose a readable image, at least 100 × 100 pixels and under 40 megapixels.'});
  }
});
$('#remove-cover').addEventListener('click',() => { coverInput.value = ''; releaseCover(); coverInput.focus(); });
function formValue() {
  const data = new FormData(form);
  return {...Object.fromEntries(data), tags:data.getAll('tags'), independent:data.has('independent'), permission:data.has('permission')};
}
function renderApplication(application) {
  const book = {...application.publicListing,cover:coverUrl};
  const card = node('article','book-card');
  const art = node('div','book-art'); art.append(image(book));
  const body = node('div','book-body');
  body.append(node('p','book-kicker',`${book.format} · your draft`),node('h3','',book.title),node('p','book-author',book.author),
    node('p','book-description',book.description),tags(book.tags),bookLink(book,'book-link','Visit your book link ↗'));
  card.append(art,body);
  $('#preview-card').replaceChildren(card);
  $('#preview-bio').textContent = book.bio;
  $('#preview-influences').textContent = book.influences;
  $('#email-delivery-controls').hidden = !emailIsOpen;
  renderEmailDraft(application);
  preview.hidden = false; preview.focus();
  preview.scrollIntoView({block:'start',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth'});
}
async function previewApplication() {
  clearErrors(); preview.hidden = true;
  const application = buildApplication(formValue(),chosenCover);
  if (application.errors) { showErrors(application.errors); return; }
  const result = await submissionAdapter.preview(application);
  pendingApplication = result.application;
  renderApplication(result.application);
  $('#application-status').textContent = emailIsOpen ? 'Your listing preview is ready. Check the details, then send for editorial review.' : settings.email?.directEmailFallback ? 'Your listing preview is ready. Open it in Gmail or Outlook below, attach your cover and send. Nothing has been sent or published.' : 'Your local preview is ready. Nothing was sent, saved or published.';
}
$('#preview-application').addEventListener('click',previewApplication);
form.addEventListener('submit',event => { event.preventDefault(); previewApplication(); });
form.addEventListener('input',() => {
  if (pendingApplication) $('#application-status').textContent = 'Details changed. Preview again to update your email.';
  preview.hidden = true; pendingApplication = null; releaseEmailDraft();
});
form.addEventListener('reset',() => { releaseCover(); clearErrors(); });
window.addEventListener('pagehide',releaseCover);
window.addEventListener('pageshow',() => {
  if (coverInput.parentElement === coverInputHome) {
    // Back/forward cache: pagehide released the cover, but the browser kept the file in the input.
    if (coverInput.files.length && !chosenCover) coverInput.dispatchEvent(new Event('change'));
    return;
  }
  coverInputHome.insertBefore(coverInput,coverInputFollowing);
  coverInput.name = 'cover'; coverInput.value = '';
  activeDeliveryForm?.remove(); activeDeliveryForm = null;
  $('#send-application').disabled = false;
  releaseCover();
  $('#application-status').textContent = 'Welcome back. Choose your cover and preview the application again before sending.';
});
$('#application-fields').disabled = false;

if (emailIsOpen) {
  $('#submission-mode-notice').replaceChildren(node('strong','','Free author submissions'),node('p','','Preview your listing, then send your application and cover for editorial review. Nothing is published automatically.'));
  $('#permission-help').textContent = 'You retain ownership. Display permission applies only if your book is selected.';
  $('.preview-notice').textContent = 'Check your details, then send for review when you are ready.';
  if (location.hash === '#submission-received') $('#submission-received').hidden = false;
}
$('#send-application').addEventListener('click',() => {
  try {
    if (!pendingApplication) throw new Error('Preview your current application before sending.');
    const packet = prepareEmailSubmission(pendingApplication, chosenCover, settings, location.origin);
    const delivery = createEmailForm(packet, coverInput);
    activeDeliveryForm = delivery;
    // Move the genuine chosen-file input so multipart POST works on mobile too.
    document.body.append(delivery);
    $('#send-application').disabled = true;
    HTMLFormElement.prototype.submit.call(delivery);
  } catch (error) {
    $('#application-status').textContent = error.message;
    $('#application-status').focus();
  }
});
