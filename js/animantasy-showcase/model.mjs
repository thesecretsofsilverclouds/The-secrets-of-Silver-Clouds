/* Pure catalog/application rules. No network, storage or browser dependencies. */
export const TAGS = Object.freeze([
  'Epic fantasy', 'Urban fantasy', 'Progression', 'Martial arts',
  'Supernatural', 'Found family', 'Team adventure', 'Elemental magic',
  'Family drama', 'Science fantasy', 'Romance'
]);
export const FORMATS = Object.freeze(['Standalone', 'Series opener', 'Series continuation']);
export const PERMISSION_VERSION = 'showcase-display-v1';

export function normalise(value) {
  return String(value ?? '').normalize('NFKD').replace(/\p{M}/gu, '').toLocaleLowerCase('en-GB').trim();
}

export function safeExternalUrl(value) {
  try {
    const url = new URL(String(value).trim());
    return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password ? url.href : null;
  } catch { return null; }
}

export function filterBooks(books, {query = '', tag = '', format = '', sort = 'curated'} = {}) {
  const words = normalise(query).split(/\s+/).filter(Boolean);
  const result = books.filter(book => book.status === 'published' &&
    (!tag || book.tags.includes(tag)) && (!format || book.format === format) &&
    words.every(word => normalise([book.title, book.author, book.description, book.influence, ...book.tags].join(' ')).includes(word)));
  if (sort === 'title') result.sort((a,b) => a.title.localeCompare(b.title, 'en-GB'));
  if (sort === 'author') result.sort((a,b) => a.author.localeCompare(b.author, 'en-GB'));
  return result;
}

export function validateApplication(value, file) {
  const errors = {};
  const required = {title:[2,160],author:[2,100],bio:[20,600],description:[40,900],influences:[40,1200],email:[5,254]};
  for (const [key,[min,max]] of Object.entries(required)) {
    const text = String(value[key] ?? '').trim();
    if (text.length < min || text.length > max) errors[key] = `Use ${min}–${max} characters.`;
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value.email ?? '').trim())) errors.email = 'Enter a valid contact email.';
  for (const key of ['bookUrl','authorUrl']) {
    if ((key === 'bookUrl' || String(value[key] ?? '').trim()) && (!safeExternalUrl(value[key]) || String(value[key]).length > 2048)) errors[key] = 'Use a complete http:// or https:// link, without a password (up to 2,048 characters).';
  }
  if (!FORMATS.includes(value.format)) errors.format = 'Choose the book’s reading format.';
  if (!Array.isArray(value.tags) || value.tags.length < 1 || value.tags.length > 3 || new Set(value.tags).size !== value.tags.length || value.tags.some(tag => !TAGS.includes(tag))) errors.tags = 'Choose one to three genre tags.';
  if (!value.independent) errors.independent = 'Confirm that this is an independent book and that you are its author or authorised representative.';
  if (!value.permission) errors.permission = 'Display permission is required for a future listing.';
  if (!file) errors.cover = 'Choose your book cover for the listing preview.';
  else if (!['image/jpeg','image/png','image/webp'].includes(file.type) || file.size < 1 || file.size > 5 * 1024 * 1024) errors.cover = 'Choose a JPG, PNG or WebP cover up to 5 MB.';
  return errors;
}

export function buildApplication(value, file) {
  const errors = validateApplication(value, file);
  if (Object.keys(errors).length) return {errors};
  return {
    schemaVersion: 1,
    status: 'draft-preview',
    publicListing: {
      title: value.title.trim(), author: value.author.trim(), bio: value.bio.trim(),
      description: value.description.trim(), influences: value.influences.trim(),
      tags: [...value.tags], format: value.format,
      bookUrl: safeExternalUrl(value.bookUrl), authorUrl: safeExternalUrl(value.authorUrl) || null
    },
    privateContact: {email: value.email.trim()},
    cover: {name: file.name, type: file.type, size: file.size},
    rights: {independent: true, permissionToDisplay: true, permissionVersion: PERMISSION_VERSION}
  };
}
