/* Soul Sips friends pilot: URL-fragment data only. No requests, storage or analytics.
 * This codec validates structure; a share link is not proof of identity or authority.
 * Configure with approved content metadata before reading or writing a recipe.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(root);
  else root.SoulSipProtocol = factory(root);
}(typeof globalThis !== 'undefined' ? globalThis : this, function (root) {
  'use strict';
  var VERSION = 1;
  var LIMITS = Object.freeze({ nameCharacters: 24, ingredients: 2, totalParts: 4,
    drinkBytes: 1024, tokenCharacters: 1366, hashCharacters: 2745, baseCharacters: 2048 });
  // Legacy approved track slugs include 34 characters; unknown IDs still fail the menu allowlist.
  var ID = /^[a-z][a-z0-9-]{0,63}$/;
  var KEYS = ['v', 'glass', 'ingredients', 'seasoning', 'stirred', 'bottom', 'track', 'from', 'to'];
  // Permanent wire IDs. Never renumber/reuse an existing code or derive these
  // from menu order. Append unused codes for future content; a new incompatible
  // registry requires a new binary registry version. Unknown versions fail safely.
  var REGISTRY = {
    "version": 1,
    "glass": {
      "1": "crystal-shot",
      "2": "misted-glass",
      "3": "glowing-vial",
      "4": "bone-glass",
      "5": "celestial-tankard",
      "6": "duskkin-tankard"
    },
    "ingredients": {
      "1": "nostalgia",
      "2": "joy",
      "3": "love",
      "4": "glory",
      "5": "sadness",
      "6": "anger",
      "7": "homecoming",
      "8": "courage",
      "9": "serenity",
      "10": "passion",
      "11": "melancholy",
      "12": "mischief",
      "13": "curiosity",
      "14": "loneliness",
      "15": "envy",
      "16": "fear",
      "17": "despair",
      "18": "inside-joke",
      "19": "three-am-call",
      "20": "knows-too-much",
      "21": "owes-me-money",
      "22": "same-argument-again",
      "23": "saved-me-slightly",
      "24": "still-here",
      "25": "should-have-called",
      "26": "knew-you-before",
      "27": "comfortable-silence",
      "28": "growing-apart",
      "29": "would-help-you-move",
      "30": "proud-quietly",
      "31": "started-as-rivals",
      "32": "never-said-thanks",
      "33": "laughing-when-we-shouldnt",
      "34": "one-brain-cell",
      "35": "the-group-chat",
      "36": "emotional-support-idiot",
      "37": "bad-influence",
      "38": "left-on-read",
      "39": "the-voice-note",
      "40": "your-round",
      "41": "no-context",
      "42": "same-bad-decision",
      "43": "designated-adult",
      "44": "borrowed-hoodie",
      "45": "still-on-mute",
      "46": "walk-you-home",
      "47": "knows-my-order",
      "48": "emergency-contact",
      "49": "brought-snacks",
      "50": "for-legal-reasons",
      "51": "found-you-anyway"
    },
    "seasoning": {
      "1": "clarity",
      "2": "warmth",
      "3": "depth",
      "4": "intensity",
      "5": "bloom",
      "6": "pure"
    },
    "bottom": {
      "1": "sorry",
      "2": "miss-you",
      "3": "thank-you",
      "4": "was-wrong",
      "5": "you-were-wrong",
      "6": "proud-of-you",
      "7": "come-home",
      "8": "call-me",
      "9": "still-think-about-it",
      "10": "love-you",
      "11": "you-saved-me",
      "12": "just-a-drink",
      "13": "favourite-idiot",
      "14": "your-idea",
      "15": "keeping-hoodie",
      "16": "counts-as-replying",
      "17": "your-round-next",
      "18": "delete-voice-note",
      "19": "dont-tell-group-chat",
      "20": "heard-karaoke",
      "21": "brain-cell-back",
      "22": "same-time-next-week",
      "23": "stop-being-sensible",
      "24": "not-sentimental",
      "25": "like-me-with-you",
      "26": "made-it-easier",
      "27": "never-a-burden",
      "28": "glad-it-was-you",
      "29": "still-pick-you",
      "30": "dont-have-to-be-funny",
      "31": "noticed-it-mattered",
      "32": "kept-your-seat",
      "33": "boring-bits-too",
      "34": "miss-doing-nothing",
      "35": "more-than-a-drink",
      "36": "just-company"
    },
    "track": {
      "1": "im-trouble",
      "2": "epic-british-anime-fight-scene-music",
      "3": "be-my-friend",
      "4": "redwings",
      "5": "dunk-no-jutsu",
      "6": "cute-to-the-core",
      "7": "impact-drop-1",
      "8": "impact-drop",
      "9": "second-looks-good-on-you",
      "10": "urban-jungle",
      "11": "little-shadow",
      "12": "redline"
    }
  };
  Object.keys(REGISTRY).forEach(function (key) { if (key !== 'version') Object.freeze(REGISTRY[key]); });
  Object.freeze(REGISTRY);
  var registryCodes = {};
  ['glass', 'ingredients', 'seasoning', 'bottom', 'track'].forEach(function (type) {
    registryCodes[type] = new Map(Object.keys(REGISTRY[type]).map(function (code) { return [REGISTRY[type][code], Number(code)]; }));
  });
  // Unix minutes: 1970-01-01 through 2099-12-31. These are decorative, untrusted
  // invitation metadata, not proof of identity/time and never an expiry deadline.
  var MAX_POURED_AT = 68374079;

  var approved = null;
  var MESSAGES = Object.freeze({
    CONFIG: 'The drinks menu is not ready yet. Please try again shortly.',
    INVALID: 'This drink link is incomplete or has been changed. Please ask for a fresh pour.',
    NAME: 'Use up to 24 letters, spaces, and single internal hyphens or apostrophes, or leave it blank.',
    REGISTRY: 'This drink needs a newer invitation. Please refresh the bar.',
    SIZE: 'This drink link is too long. Please ask for a fresh pour.',
    BASE: 'This page cannot create a share link here.'
  });
  function ProtocolError(code) {
    this.name = 'SoulSipProtocolError'; this.code = code;
    this.message = MESSAGES[code] || MESSAGES.INVALID;
    if (Error.captureStackTrace) Error.captureStackTrace(this, ProtocolError);
  }
  ProtocolError.prototype = Object.create(Error.prototype);
  ProtocolError.prototype.constructor = ProtocolError;
  function fail(code) { throw new ProtocolError(code || 'INVALID'); }
  function plain(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
    var prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
  }
  function exact(value, keys) {
    if (!plain(value)) return false;
    var own = Reflect.ownKeys(value);
    return own.length === keys.length && own.every(function (key) {
      var descriptor = Object.getOwnPropertyDescriptor(value, key);
      return typeof key === 'string' && keys.indexOf(key) !== -1 && descriptor && 'value' in descriptor;
    });
  }
  function denseIngredients(value) {
    if (!Array.isArray(value) || value.length < 1 || value.length > LIMITS.ingredients) return false;
    var keys = Reflect.ownKeys(value);
    return keys.length === value.length + 1 && keys.every(function (key) {
      var descriptor = Object.getOwnPropertyDescriptor(value, key);
      return (key === 'length' || typeof key === 'string' && /^(0|1)$/.test(key) && Number(key) < value.length)
        && descriptor && 'value' in descriptor;
    });
  }
  function listIds(list) {
    if (!Array.isArray(list) || !list.length) fail('CONFIG');
    var result = new Set();
    list.forEach(function (item) {
      var id = typeof item === 'string' ? item : plain(item) ? item.id : null;
      if (typeof id !== 'string' || !ID.test(id) || result.has(id)) fail('CONFIG');
      result.add(id);
    });
    return result;
  }
  function configure(content) {
    if (!plain(content)) fail('CONFIG');
    var lists = content.allowlists;
    var next;
    if (plain(lists)) {
      next = { glass: listIds(lists.glass), ingredients: listIds(lists.ingredients),
        seasoning: listIds(lists.seasoning), bottom: listIds(lists.bottom), track: listIds(lists.track) };
    } else {
      var ingredientRows = content.ingredients;
      if (!Array.isArray(ingredientRows)) ingredientRows = (content.feelings || []).concat(content.regulars || []);
      next = { glass: listIds(content.glasses), ingredients: listIds(ingredientRows),
        seasoning: listIds(content.seasonings), bottom: listIds(content.bottoms), track: listIds(content.tracks) };
    }
    // Never retain the caller's mutable arrays, objects or labels.
    approved = next;
    return api;
  }
  function ready() {
    if (!approved && root && root.SoulSipContent) configure(root.SoulSipContent);
    if (!approved) fail('CONFIG');
  }
  function normalizeName(value) {
    if (typeof value !== 'string') fail('NAME');
    // Controls, line separators and format characters must not disappear during trimming.
    if (value.length > 256 || /[^\p{L}\p{M}\p{Zs}'’\-]/u.test(value)) fail('NAME');
    var name = value.normalize('NFC').replace(/\p{Zs}+/gu, ' ').trim();
    if (Array.from(name).length > LIMITS.nameCharacters
      || name && !/^(?:\p{L}[\p{L}\p{M}]*(?:[-'’]\p{L}[\p{L}\p{M}]*)*)(?: \p{L}[\p{L}\p{M}]*(?:[-'’]\p{L}[\p{L}\p{M}]*)*)*$/u.test(name)) fail('NAME');
    return name;
  }
  function known(type, id) {
    if (typeof id !== 'string' || !ID.test(id) || !approved[type].has(id)) fail('INVALID');
    return id;
  }
  function canonical(input) {
    ready();
    if (!exact(input, KEYS) || input.v !== VERSION || typeof input.stirred !== 'boolean'
      || !denseIngredients(input.ingredients)) fail('INVALID');
    var total = 0, seen = new Set();
    var ingredients = input.ingredients.map(function (item) {
      if (!exact(item, ['id', 'parts']) || !Number.isSafeInteger(item.parts)
        || item.parts < 1 || item.parts > LIMITS.totalParts) fail('INVALID');
      var id = known('ingredients', item.id);
      if (seen.has(id)) fail('INVALID');
      seen.add(id); total += item.parts;
      return { id: id, parts: item.parts };
    });
    if (total < 1 || total > LIMITS.totalParts) fail('INVALID');
    return { v: VERSION, glass: known('glass', input.glass), ingredients: ingredients,
      seasoning: known('seasoning', input.seasoning), stirred: input.stirred,
      bottom: known('bottom', input.bottom), track: known('track', input.track),
      from: normalizeName(input.from), to: normalizeName(input.to) };
  }
  function publicError(error) {
    var code = error instanceof ProtocolError ? error.code : 'INVALID';
    return { code: code, message: MESSAGES[code] || MESSAGES.INVALID };
  }
  function validateDrink(input) {
    try { return { ok: true, value: canonical(input) }; }
    catch (error) { return { ok: false, error: publicError(error) }; }
  }
  function utf8(text) { return new TextEncoder().encode(text); }
  function toBase64(bytes) {
    if (typeof Buffer !== 'undefined') return Buffer.from(bytes).toString('base64');
    var binary = ''; bytes.forEach(function (byte) { binary += String.fromCharCode(byte); });
    return root.btoa(binary);
  }
  function fromBase64(encoded) {
    if (typeof Buffer !== 'undefined') return new Uint8Array(Buffer.from(encoded, 'base64'));
    var binary = root.atob(encoded), bytes = new Uint8Array(binary.length);
    for (var i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    return bytes;
  }
  function encodeDrink(input) {
    var value = canonical(input), bytes = utf8(JSON.stringify(value));
    if (bytes.length > LIMITS.drinkBytes) fail('SIZE');
    return toBase64(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  function decodeDrink(token) {
    ready();
    if (typeof token !== 'string' || token.length > LIMITS.tokenCharacters) fail('SIZE');
    if (!token || !/^[A-Za-z0-9_-]+$/.test(token) || token.length % 4 === 1) fail('INVALID');
    try {
      var padded = token.replace(/-/g, '+').replace(/_/g, '/');
      padded += '='.repeat((4 - padded.length % 4) % 4);
      var bytes = fromBase64(padded);
      if (bytes.length > LIMITS.drinkBytes) fail('SIZE');
      var parsed = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
      var value = canonical(parsed);
      // Reject duplicate JSON keys, extra fields, alternate byte encodings,
      // normalization tricks, whitespace and unrecognized nested structures.
      if (encodeDrink(value) !== token) fail('INVALID');
      return value;
    } catch (error) {
      if (error instanceof ProtocolError) throw error;
      fail('INVALID');
    }
  }
  function base64url(bytes) {
    return toBase64(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  function compactCode(type, id) {
    var code = registryCodes[type].get(id);
    if (!Number.isInteger(code) || code < 1 || code > 255) fail('REGISTRY');
    return code;
  }
  function compactId(type, code) {
    if (!Number.isInteger(code) || !Object.hasOwn(REGISTRY[type], code)) fail('INVALID');
    return known(type, REGISTRY[type][code]);
  }
  function compactDrink(drink) {
    var first = drink.ingredients[0], second = drink.ingredients[1];
    // Fixed 11-byte layout: format, registry, flags, vessel, two (ID,parts)
    // pairs, seasoning, bottom line, track. Names and timestamps are separate.
    return base64url(new Uint8Array([2, REGISTRY.version,
      (drink.stirred ? 1 : 0) | (second ? 2 : 0), compactCode('glass', drink.glass),
      compactCode('ingredients', first.id), first.parts,
      second ? compactCode('ingredients', second.id) : 0, second ? second.parts : 0,
      compactCode('seasoning', drink.seasoning), compactCode('bottom', drink.bottom), compactCode('track', drink.track)]));
  }
  function expandCompact(token, from, to) {
    ready();
    if (typeof token !== 'string' || token.length !== 15 || !/^[A-Za-z0-9_-]{15}$/.test(token)) fail('INVALID');
    var padded = token.replace(/-/g, '+').replace(/_/g, '/') + '=';
    var bytes;
    try { bytes = fromBase64(padded); } catch (error) { fail('INVALID'); }
    if (bytes.length !== 11 || bytes[0] !== 2 || bytes[1] !== REGISTRY.version || bytes[2] > 3) fail('INVALID');
    var ingredients = [{ id: compactId('ingredients', bytes[4]), parts: bytes[5] }];
    if (bytes[2] & 2) ingredients.push({ id: compactId('ingredients', bytes[6]), parts: bytes[7] });
    else if (bytes[6] !== 0 || bytes[7] !== 0) fail('INVALID');
    var drink = canonical({ v: VERSION, glass: compactId('glass', bytes[3]), ingredients: ingredients,
      seasoning: compactId('seasoning', bytes[8]), stirred: Boolean(bytes[2] & 1),
      bottom: compactId('bottom', bytes[9]), track: compactId('track', bytes[10]), from: from, to: to });
    // Reject alternate unused base64 bits as well as malformed binary flags.
    if (compactDrink(drink) !== token) fail('INVALID');
    return drink;
  }
  function canonicalMeta(meta) {
    if (meta === undefined || meta === null) return null;
    if (!exact(meta, ['pouredAt', 'kind']) || !Number.isSafeInteger(meta.pouredAt)
      || meta.pouredAt < 0 || meta.pouredAt > MAX_POURED_AT
      || !['drink', 'empty-return'].includes(meta.kind)) fail('INVALID');
    return { pouredAt: meta.pouredAt, kind: meta.kind };
  }
  function encode(drink, previous, meta) {
    var value = canonical(drink), earlier = previous === undefined || previous === null ? null : canonical(previous);
    var context = canonicalMeta(meta), fields = ['s=' + compactDrink(value)];
    if (value.from) fields.push('from=' + encodeURIComponent(value.from));
    if (value.to) fields.push('to=' + encodeURIComponent(value.to));
    if (earlier) {
      fields.push('p=' + compactDrink(earlier));
      if (earlier.from) fields.push('pf=' + encodeURIComponent(earlier.from));
      if (earlier.to) fields.push('pt=' + encodeURIComponent(earlier.to));
    }
    if (context) {
      fields.push('at=' + context.pouredAt.toString(36));
      if (context.kind === 'empty-return') fields.push('kind=empty-return');
    }
    var fragment = '#' + fields.join('&');
    if (fragment.length > LIMITS.hashCharacters) fail('SIZE');
    return fragment;
  }
  function readCompactHash(hash) {
    var fields = new Map(), allowed = new Set(['s', 'from', 'to', 'p', 'pf', 'pt', 'at', 'kind']);
    for (var pair of hash.slice(1).split('&')) {
      var equals = pair.indexOf('=');
      if (equals < 1) fail('INVALID');
      var key = pair.slice(0, equals), raw = pair.slice(equals + 1), value;
      if (!allowed.has(key) || fields.has(key)) fail('INVALID');
      try { value = decodeURIComponent(raw.replace(/\+/g, ' ')); } catch (error) { fail('INVALID'); }
      fields.set(key, value);
    }
    if (!fields.get('s') || fields.has('pf') && !fields.has('p') || fields.has('pt') && !fields.has('p')) fail('INVALID');
    var drink = expandCompact(fields.get('s'), fields.get('from') || '', fields.get('to') || '');
    var earlier = fields.has('p') ? expandCompact(fields.get('p'), fields.get('pf') || '', fields.get('pt') || '') : null;
    var meta = null;
    if (fields.has('kind') && !fields.has('at')) fail('INVALID');
    if (fields.has('at')) {
      var at = fields.get('at');
      if (!/^[0-9a-z]{1,6}$/.test(at)) fail('INVALID');
      var pouredAt = parseInt(at, 36);
      if (pouredAt.toString(36) !== at) fail('INVALID');
      meta = canonicalMeta({ pouredAt: pouredAt, kind: fields.has('kind') ? fields.get('kind') : 'drink' });
    }
    return { ok: true, drink: drink, previous: earlier, meta: meta };
  }
  function parseHash(hash) {
    try {
      if (typeof hash !== 'string') fail('INVALID');
      if (hash.length > LIMITS.hashCharacters) fail('SIZE');
      if (!hash || hash === '#') return { ok: true, drink: null, previous: null, meta: null };
      // Preserve the original strict v1 JSON invitation and previous-round format.
      if (hash.startsWith('#d=')) {
        var match = /^#d=([A-Za-z0-9_-]+)(?:&p=([A-Za-z0-9_-]+))?$/.exec(hash);
        if (!match) fail('INVALID');
        return { ok: true, drink: decodeDrink(match[1]), previous: match[2] ? decodeDrink(match[2]) : null, meta: null };
      }
      if (!hash.startsWith('#s=')) fail('INVALID');
      return readCompactHash(hash);
    } catch (error) { return { ok: false, error: publicError(error) }; }
  }
  function buildLink(drink, options) {
    options = options || {};
    var base = options.base === undefined && root.location ? root.location.href : options.base;
    if (typeof base !== 'string' || !base || base.length > LIMITS.baseCharacters) fail('BASE');
    var url;
    try { url = new URL(base); } catch (error) { fail('BASE'); }
    if (!['http:', 'https:', 'file:'].includes(url.protocol) || url.username || url.password) fail('BASE');
    url.search = ''; url.hash = encode(drink, options.previous, options.meta);
    return url.href;
  }
  var api = Object.freeze({ version: VERSION, compactVersion: 2, registry: REGISTRY, limits: LIMITS, configure: configure,
    normalizeName: normalizeName, validateDrink: validateDrink, encodeDrink: encodeDrink,
    decodeDrink: decodeDrink, encode: encode, parseHash: parseHash, buildLink: buildLink,
    ProtocolError: ProtocolError });
  return api;
}));
