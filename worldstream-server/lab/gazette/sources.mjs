// The public-information boundary.
//
// This is the part of the Gazette Engine that protects canon, and it is the
// same idea as the Moment Engine's anti-telepathy rail applied one level up.
// Worldstream knows what happened. The Gazette knows only what somebody would
// have told a reporter, and those are different facts.
//
// The consequence is the best thing about the whole subsystem: the paper can be
// *wrong*. Not wrong in the sense of the simulation breaking — wrong in the
// sense that a real newspaper is wrong, reporting the account it was given by
// the institution that had a reason to give it. The reader knows better than
// the paper does, which is dramatic irony that costs nothing to generate and
// cannot leak a reveal, because the leak would have to come from a source and
// the sources are enumerated here.

export const SOURCE_KINDS = Object.freeze({
  visible_event: { trust: 5, attribution: null, needs: 'public' },
  eyewitness: { trust: 3, attribution: 'Witnesses reported', needs: 'public' },
  borough_statement: { trust: 4, attribution: 'The borough said', needs: 'institutional' },
  meu_notice: { trust: 4, attribution: 'The MEU has confirmed', needs: 'institutional' },
  order_statement: { trust: 3, attribution: 'The Holy Order says', needs: 'institutional' },
  mi6_statement: { trust: 4, attribution: 'MI6 confirmed', needs: 'institutional' },
  anonymous: { trust: 2, attribution: 'A source who asked not to be named told the Gazette', needs: 'any' },
  rumour: { trust: 1, attribution: 'It is being said in the borough', needs: 'any' },
  another_paper: { trust: 2, attribution: 'The evening papers carried', needs: 'any' },
  public_record: { trust: 5, attribution: 'Records show', needs: 'public' },
});

// Which institution would speak to which kind of event. An event with no
// institutional owner gets eyewitnesses and rumour, which is exactly why the
// strangest things in the city are the worst reported.
const OWNER = Object.freeze({
  ARCANE_SURGE: 'meu_notice',
  MINOR_ANOMALY: 'meu_notice',
  UNEASE: null,
  INCIDENT: 'mi6_statement',
  AFTERMATH: 'borough_statement',
  WEATHER_DISRUPTION: 'borough_statement',
  INSTITUTION_NOTICE: 'borough_statement',
  FACTION_STATUS: 'order_statement',
});

/**
 * What the Gazette can actually say it knows about an event.
 *
 * @returns {{sources:object[], confidence:number, canName:string[], mustHedge:boolean}}
 */
export function sourcesFor(event, { factions = {}, seed = '' } = {}) {
  const sources = [];
  // Anything published is, by definition, something the city could see.
  if (event.visibility === 'public') sources.push({ kind: 'visible_event',
    ...SOURCE_KINDS.visible_event, text: event.publicDescription });

  const owner = OWNER[event.type];
  if (owner) {
    // An institution under pressure talks less, and what it says is thinner.
    const pressed = owner === 'order_statement' ? factions.order === 'active_in_city'
      : owner === 'mi6_statement' ? factions.mi6 === 'elevated'
        : owner === 'meu_notice' ? factions.arcane === 'high' : false;
    if (!pressed) sources.push({ kind: owner, ...SOURCE_KINDS[owner] });
    else sources.push({ kind: 'anonymous', ...SOURCE_KINDS.anonymous, because: `${owner} declined` });
  }
  if (event.participants?.length) sources.push({ kind: 'eyewitness', ...SOURCE_KINDS.eyewitness });
  if (!sources.length) sources.push({ kind: 'rumour', ...SOURCE_KINDS.rumour });

  const confidence = Math.max(...sources.map(source => source.trust));

  // Who may be named. A public figure acting publicly may be named; a private
  // person may not, and a child never. This is a newspaper convention that
  // happens to also be the exact rail that keeps Emily out of the paper.
  const canName = (event.participants ?? []).filter(who => NAMEABLE_BY_PRESS.has(who));

  return { sources, confidence, canName, mustHedge: confidence <= 2 };
}

// Who the Gazette is allowed to print. Institutions and their public officers.
// Emily is deliberately absent: a borough paper does not name a child in a
// park, which means the funniest possible headline is also the one it can never
// run, and the reader gets to notice the absence.
export const NAMEABLE_BY_PRESS = new Set(['henderson', 'davis']);

/** The hedge a claim has to carry given its best source. */
export function hedgeFor(confidence) {
  if (confidence >= 5) return null;
  if (confidence >= 4) return 'confirmed';
  if (confidence >= 3) return 'reported';
  return 'unconfirmed';
}
