/* Direct email is prepared on the visitor's device. Nothing is sent by this module. */
import {validateApplication} from './model.mjs';
import {PERMISSION_TEXT} from './email-adapter.mjs';

export const WEBMAIL_URL_LIMIT = 8000;

export function prepareEmailDraft(application, file, recipient) {
  if (recipient !== 'thesecretsofsilverclouds@gmail.com') throw new Error('The submission inbox is unavailable.');
  const book = application?.publicListing;
  if (!book || Object.keys(validateApplication({
    ...book, email:application.privateContact?.email,
    independent:application.rights?.independent, permission:application.rights?.permissionToDisplay
  },file)).length) throw new Error('Please preview a complete application first.');
  if (application.cover.name !== file.name || application.cover.size !== file.size || application.cover.type !== file.type) throw new Error('Your cover changed. Preview your application again.');
  const shortTitle = Array.from(book.title.replace(/[\r\n]/g,' ')).slice(0,40).join('');
  const subject = `Animantasy author application: ${shortTitle}`;
  const text = [
    'ANIMANTASY AUTHOR SHOWCASE — APPLICATION',
    `Book: ${book.title}`, `Author / pen name: ${book.author}`,
    `Contact email (private): ${application.privateContact.email}`,
    `Description:\n${book.description}`, `Genre tags: ${book.tags.join(', ')}`,
    `Reading format: ${book.format}`, `Book / sample link: ${book.bookUrl}`,
    `Author website: ${book.authorUrl || 'Not provided'}`, `Author bio:\n${book.bio}`,
    `Anime / manga influences:\n${book.influences}`,
    'Independent author / authorised representative: Confirmed',
    `Permission to display:\n${PERMISSION_TEXT}`,
    `Permission version: ${application.rights.permissionVersion}`,
    `Cover to attach: ${file.name}`,
    'For manual editorial review. No automatic publication or guarantee of a listing.'
  ].join('\n\n');
  // Keep the mailto short: long prefilled bodies can be truncated by email apps.
  const body = 'Hello Silent Silver,\n\nI would like to submit my book to the Animantasy Author Showcase.\n\n[Paste the complete application below, or attach the saved application text file. Please also attach your book cover before sending.]\n\n';
  const mailto = `mailto:${recipient}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  // Webmail compose pages open in the browser, so they work even when no email app is set up.
  // They can carry the whole application; very long ones fall back to the short paste note.
  const webBody = `Hello Silent Silver,\n\nI would like to submit my book to the Animantasy Author Showcase.\n\n[Please attach your book cover (${file.name}) before sending.]\n\n${text}`;
  const webmail = (base, params) => {
    const url = message => `${base}?${new URLSearchParams(params(message))}`;
    return url(webBody).length <= WEBMAIL_URL_LIMIT ? url(webBody) : url(body);
  };
  const gmail = webmail('https://mail.google.com/mail/', message => ({view:'cm', fs:'1', to:recipient, su:subject, body:message}));
  const outlook = webmail('https://outlook.live.com/mail/0/deeplink/compose', message => ({to:recipient, subject, body:message}));
  const slug = book.title.normalize('NFKC').replace(/[^\p{L}\p{N}]+/gu,'-').replace(/^-|-$/g,'').slice(0,60) || 'book';
  return {recipient,subject,text,mailto,gmail,outlook,filename:`animantasy-application-${slug}.txt`,sent:false};
}
