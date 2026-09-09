import test from 'node:test';
import assert from 'node:assert/strict';
import { readingSurface, tagsFor, analyse } from '../scripts/audit-new-viewer.mjs';
const e = {id:'a',type:'CONVERSATION',occurredAt:1,location:'mi6',participants:['goaden','ashai'],register:'prose',description:'Headline.',prose:'Prose.',lines:[{who:'goaden',text:'Hello.'}]};
test('audit Reading View precedence matches prose/dialogue, accepted scene, short routine',()=>{
  assert.deepEqual(readingSurface(e),['Prose.','Hello.']);
  assert.deepEqual(readingSurface({...e,cinematic:{scene:{openingNarration:'Opening.',beats:[{line:'Scene dialogue.'}],closingNarration:'End.'}}}),['Opening.','Scene dialogue.','End.']);
  assert.deepEqual(readingSurface({...e,readerWeight:1}),['Headline.']);
  assert.deepEqual(readingSurface({...e,register:'ticker'}),['Headline.']);
});
test('repeats count occurrences beyond first, not all members; masks are a separate conservative proxy',()=>{
  const rows=[{...e,prose:'Goaden ate.',lines:[]},{...e,id:'b',occurredAt:2,prose:'Goaden ate.',lines:[]},{...e,id:'c',occurredAt:3,prose:'Ashai ate.',lines:[]}];
  const w=analyse(rows,rows,0,86_400_000);
  assert.equal(w.exactSentences.total,3);assert.equal(w.exactSentences.unique,2);assert.equal(w.exactSentences.repeatedOccurrences,1);
  assert.equal(w.structuralSentences.unique,1);assert.equal(w.structuralSentences.repeatedOccurrences,2);
  const punctuation=analyse([{...e,prose:'...',lines:[]}],[e],0,86_400_000);
  assert.equal(punctuation.openings.total,0,'non-word fragments cannot supply four-token openings');
});
test('routine and authored prose are not the same measure; author approval remains unknown',()=>{
  const meal={...e,type:'MEAL_BEGIN',lines:[]};
  assert.ok(tagsFor(meal).includes('routine'));assert.ok(!tagsFor(meal).includes('authored_prose'));
  const w=analyse([e],[e],0,86_400_000);assert.equal(w.authorReviewSample[0].keep,null);assert.equal(w.authorReviewSample[0].worthSurfacing,null);
});
