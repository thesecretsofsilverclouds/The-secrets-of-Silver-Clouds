/* Native multipart delivery keeps FormSubmit's confirmation/CAPTCHA flow intact.
   No request is made here. The UI posts only after the applicant clicks Send. */
import {validateApplication} from './model.mjs';

export const PERMISSION_TEXT = 'I own or have permission to share this cover and text, and permit the Animantasy Showcase to display them with my author name and book links if selected. You retain ownership.';

export function emailDeliveryAvailable(settings, origin) {
  const email = settings?.email;
  if (settings?.mode !== 'live' || !email?.enabled || !email?.verified || !email?.deliveryVerified) return false;
  try {
    const endpoint = new URL(email.endpoint);
    return origin === 'https://thesecretsofsilverclouds.com' &&
      endpoint.origin === 'https://formsubmit.co' && !endpoint.search && !endpoint.hash &&
      !endpoint.username && !endpoint.password && /^\/[a-zA-Z0-9@._-]+$/.test(endpoint.pathname);
  } catch { return false; }
}

export function prepareEmailSubmission(application, file, settings, origin) {
  if (!emailDeliveryAvailable(settings, origin)) throw new Error('Email submissions are not open. Your application has not been sent.');
  const book = application.publicListing;
  const errors = validateApplication({
    ...book, email:application.privateContact?.email,
    independent:application.rights?.independent, permission:application.rights?.permissionToDisplay
  },file);
  if (Object.keys(errors).length) throw new Error('Please check the application and cover before sending.');
  if (application.cover.name !== file.name || application.cover.size !== file.size || application.cover.type !== file.type) throw new Error('The selected cover changed. Preview the application again.');
  return {
    action: settings.email.endpoint,
    fields: {
      _subject: `Animantasy submission: ${book.title.replace(/[\r\n]/g,' ')}`,
      _template: 'table',
      _next: `${settings.canonicalUrl}#submission-received`,
      _url: settings.canonicalUrl,
      _replyto: application.privateContact.email,
      email: application.privateContact.email,
      name: book.author,
      message: [
        `Book: ${book.title}`, `Author: ${book.author}`, `Description: ${book.description}`,
        `Genres: ${book.tags.join(', ')}`, `Reading format: ${book.format}`,
        `Book link: ${book.bookUrl}`, `Author website: ${book.authorUrl || 'Not provided'}`,
        `Author bio: ${book.bio}`, `Anime/manga influences: ${book.influences}`,
        `Display permission: ${PERMISSION_TEXT}`, `Permission version: ${application.rights.permissionVersion}`,
        'Status: Pending manual review. No automatic publication.'
      ].join('\n\n'),
      'Book title': book.title,
      'Book description': book.description,
      'Genre tags': book.tags.join(', '),
      'Reading format': book.format,
      'Book link': book.bookUrl,
      'Author website': book.authorUrl || 'Not provided',
      'Author bio': book.bio,
      'Anime and manga influences': book.influences,
      'Independent author confirmation': 'Yes',
      'Permission to display': PERMISSION_TEXT,
      'Permission version': application.rights.permissionVersion,
      'Permission confirmed at': new Date().toISOString(),
      'Review status': 'Pending manual review — not approved or published',
      'Application version': String(application.schemaVersion)
    },
    fileField: 'attachment'
  };
}

export function createEmailForm(packet, coverInput, documentRef = document) {
  const delivery = documentRef.createElement('form');
  delivery.method = 'POST'; delivery.enctype = 'multipart/form-data';
  delivery.action = packet.action; delivery.hidden = true;
  for (const [name,value] of Object.entries(packet.fields)) {
    const input = documentRef.createElement('input');
    input.type = 'hidden'; input.name = name; input.value = value;
    delivery.append(input);
  }
  coverInput.name = packet.fileField;
  delivery.append(coverInput);
  return delivery;
}
