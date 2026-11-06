/* Displays the assessment gift and preserves its one-time guardian naming. */
(() => {
  'use strict';
  const factions = {
    D: { name: "Demon's Legion", href: '/demons-legion' },
    O: { name: 'The Order', href: '/the-order' },
    C: { name: 'The Church', href: '/the-church' },
    M: { name: 'MI6', href: '/mi6' },
    R: { name: 'Ragnorir', href: '/ragnorir' }
  };
  // Exact basenames used by the existing assessment; never load saved arbitrary URLs.
  const knownArtwork = new Set([
    'Arcane_Staff_Library_Anime.webp',
    'Axe_Of_Frozen_Nordic_Magic.webp',
    'Baby_Unicorn_Meadow_Prance.webp',
    'Bio_Horror_Celestial_Hammer.webp',
    'Celestial_Forge_Hammer.webp',
    'Celestial_Kawaii_Rainbow_Sword_Garden.webp',
    'Celestial_Mace_Agony_Chamber.webp',
    'Celestial_Magic_Wand_Night_Realm.webp',
    'Celestial_Reaper_Scythe_Necropolis.webp',
    'Celestial_Trident_Underwater_Palace.webp',
    'Chirping_Baby_Phoenix_Crystal_Nest.webp',
    'Corrupted_Forest_Guardian.webp',
    'Cosmic_Arcane_Staff.webp',
    'Cosmic_Creation_Scythe.webp',
    'Cosmic_Gravity_Hammer_Anime.webp',
    'Cosmic_Nebula_Serpent_Medium_Shot.webp',
    'Cosmic_Stag_Enchanted_Meadow.webp',
    'Crystal_Dragon_Cavern_Technomagic_Wonder.webp',
    'Crystal_Rainbow_Fox_Cavern.webp',
    'Cursed_Celestial_Sword_Void.webp',
    'Cursed_Spirit_Tomb_Chamber.webp',
    'Cute_Pastel_Dragon_Garden.webp',
    'Cyber_Phoenix_Digital_Rebirth.webp',
    'Cyber_Wolf_Techno_Tribal_Urban.webp',
    'Divine_Longsword_Cathedral_Ascension.webp',
    'Divine_Oceanic_Trident_Technomagic_Illustration.webp',
    'Divine_Technomagic_Longsword_Space.webp',
    'Dreamy_Celestial_Hammer.webp',
    'Eldritch_Void_Entity_Realm.webp',
    'Enchanted_Bow_Forest_Glade.webp',
    'Entropy_Orb_Cosmic_Library.webp',
    'Ethereal_Light_Elemental_Celestial_Temple.webp',
    'Ethereal_Volcanic_Phoenix_Rise.webp',
    'Forest_Plant_Spirit_Glade.webp',
    'Ignar_the_Consumed.webp',
    'Majestic_Storm_Elemental_Amidst_Sky.webp',
    'Mystic_Chakrams_Temple_Spin.webp',
    'Nightmare_Demon_Fantasy_Realm.webp',
    'Ocular_Necromantic_Staff_Bio_Horror.webp',
    'Phantom_Bow_Haunted_Archery.webp',
    'Primordial_Temporal_Staff.webp',
    'Primordial_Void_Bow_Nexus.webp',
    'Radiant_Convergence.webp',
    'Shadow_Wolf_Graveyard_Moonlight.webp',
    'Shadow_Wraith_Cathedral_Technomagic_Anime.webp',
    'Skeletal_Technomage_Sentinel_Graveyard.webp',
    'Soul_Harvest_Scythe_Anime_Technomagic.webp',
    'Storm_Blade_Divine_Longsword.webp',
    'Storm_Hammer_Divine_Might.webp',
    'The_Arbiters_Face.webp',
    'The_Ashen_Familiar.webp',
    'The_Attendant.webp',
    'The_Bleeding_Throne.webp',
    'The_Burning_Crowned.webp',
    'The_Conductors_Key.webp',
    'The_Endless_Grind.webp',
    'The_First_Infernal.webp',
    'The_First_Proclamation.webp',
    'The_Gentle_Void.webp',
    'The_Hollow_Warren.webp',
    'The_In_Between.webp',
    'The_Long_Judgment.webp',
    'The_Maker_Left.webp',
    'The_Null_Hatchling.webp',
    'The_Petal_Between.webp',
    'The_Pleased_Watcher.webp',
    'The_Quiet_Descent.webp',
    'The_Silver_Born.webp',
    'The_Small_Reaping.webp',
    'The_Small_Summoning.webp',
    'The_Smiling_Storm.webp',
    'The_Sovereign_Seal.webp',
    'The_Storm_Heir.webp',
    'The_Threshold_Soft.webp',
    'The_Unending_Stride.webp',
    'The_Unread.webp',
    'The_Verdant_Plague.webp',
    'The_Verdant_Witness.webp',
    'brain-chip.webp'
  ]);
  const get = id => document.getElementById(id);
  const empty = get('gift-empty');
  const saved = get('gift-saved');
  const notice = get('gift-notice');
  const loading = get('gift-loading');
  const renameButton = get('gift-rename-button');
  const renameForm = get('gift-rename-form');
  const renameInput = get('gift-rename-input');
  const renameStatus = get('gift-rename-status');
  let displayedGift = null;

  function renameMessage(message) {
    renameStatus.textContent = message;
    renameStatus.hidden = !message;
  }

  function closeRename() {
    renameForm.hidden = true;
    renameButton.setAttribute('aria-expanded', 'false');
  }

  renameButton.addEventListener('click', () => {
    if (!displayedGift || displayedGift.guardianRenamed) return;
    renameInput.value = displayedGift.creature.name;
    renameForm.hidden = false;
    renameButton.setAttribute('aria-expanded', 'true');
    renameMessage('');
    renameInput.focus();
    renameInput.select();
  });
  get('gift-rename-cancel').addEventListener('click', () => {
    closeRename();
    renameMessage('');
    renameButton.focus();
  });
  renameForm.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
      event.preventDefault();
      closeRename();
      renameMessage('');
      renameButton.focus();
    }
  });
  renameForm.addEventListener('submit', event => {
    event.preventDefault();
    const name = renameInput.value.trim();
    if (!name || name.length > 40) {
      renameMessage('Enter a name between 1 and 40 characters.');
      renameInput.focus();
      return;
    }
    // Read the latest record, preserving other fields and changes from other tabs.
    let latest;
    try { latest = JSON.parse(localStorage.getItem('fateGift')); }
    catch {
      renameMessage('Your name could not be saved. Your gift has been left unchanged.');
      return;
    }
    if (!displayedGift || !giftItem(latest?.creature) || !giftItem(latest?.weapon)
        || latest.faction !== displayedGift.faction
        || latest.creature.file !== displayedGift.creature.file
        || latest.creature.name !== displayedGift.creature.name
        || latest.guardianRenamed) {
      renderSavedGift();
      renameMessage('Your saved gift changed. Review it before choosing a name.');
      return;
    }
    latest.creature.name = name;
    latest.guardianRenamed = true;
    try { localStorage.setItem('fateGift', JSON.stringify(latest)); }
    catch {
      renameMessage('Your name could not be saved. Your gift has been left unchanged.');
      return;
    }
    renderSavedGift();
    renameMessage('Your guardian’s name is saved.');
    get('gift-creature-name').setAttribute('tabindex', '-1');
    get('gift-creature-name').focus();
  });

  function artworkPath(file) {
    if (typeof file !== 'string') return null;
    // Earlier gifts saved PNG names or a relative directory prefix.
    const filename = file.split('/').pop().replace(/\.png$/i, '.webp');
    return knownArtwork.has(filename) ? '/gift-assets/' + filename : null;
  }

  function giftItem(item) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return null;
    const src = artworkPath(item.file);
    if (!src || typeof item.name !== 'string' || !item.name.trim()) return null;
    return { src, name: item.name, lore: typeof item.lore === 'string' ? item.lore : '' };
  }

  function showEmpty(message = '') {
    displayedGift = null;
    closeRename();
    renameButton.hidden = true;
    loading.hidden = true;
    saved.hidden = true;
    empty.hidden = false;
    get('gift-intro-copy').textContent = 'A faction to stand with. A guardian beside you. A Holy Item of your own.';
    notice.textContent = message;
    notice.hidden = !message;
  }

  function showItem(kind, item) {
    get('gift-' + kind + '-name').textContent = item.name;
    get('gift-' + kind + '-lore').textContent = item.lore;
    const artwork = get('gift-' + kind + '-art');
    const link = get('gift-' + kind + '-art-link');
    const imageNote = get('gift-' + kind + '-image-note');
    artwork.hidden = false;
    imageNote.hidden = true;
    artwork.alt = item.name;
    artwork.onerror = () => {
      artwork.hidden = true;
      imageNote.hidden = false;
      link.removeAttribute('href');
      link.querySelector('.gift-full-label').hidden = true;
    };
    link.querySelector('.gift-full-label').hidden = false;
    link.href = item.src;
    link.setAttribute('aria-label', 'View the full artwork for ' + item.name);
    artwork.src = item.src;
  }

  function renderSavedGift() {
    let raw;
    try { raw = localStorage.getItem('fateGift'); }
    catch {
      showEmpty('This browser is not allowing access to saved gifts. If you have already claimed yours, return in the browser where you completed the assessment.');
      return;
    }
    if (!raw) { showEmpty(); return; }
    let gift;
    try { gift = JSON.parse(raw); }
    catch {
      showEmpty('Your saved gift could not be read. It has been left unchanged. If you claimed it elsewhere, try that browser and site.');
      return;
    }
    const creature = giftItem(gift?.creature);
    const weapon = giftItem(gift?.weapon);
    const faction = gift && typeof gift.faction === 'string' && Object.hasOwn(factions, gift.faction) ? factions[gift.faction] : null;
    if (!creature || !weapon || !faction) {
      showEmpty('We could not display all the details of your saved gift. It has been left unchanged. If you claimed it elsewhere, try that browser and site.');
      return;
    }
    showItem('creature', creature);
    showItem('weapon', weapon);
    displayedGift = gift;
    closeRename();
    renameMessage('');
    renameButton.hidden = Boolean(gift.guardianRenamed);
    get('gift-allegiance-title').textContent = faction.name;
    get('gift-faction-link').href = faction.href;
    get('gift-intro-copy').textContent = 'The guardian and Holy Item revealed by your Faction Assessment, together in your shrine.';
    loading.hidden = true;
    empty.hidden = true;
    notice.hidden = true;
    saved.hidden = false;
  }

  renderSavedGift();
  window.addEventListener('storage', event => {
    if (event.key === 'fateGift' || event.key === null) renderSavedGift();
  });
})();
