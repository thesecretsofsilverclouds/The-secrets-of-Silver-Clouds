// Optional creator feedback: no vote is sent until the reader presses submit.
// Poll answers never enter an observe request or the shared world.
export function createReaderFeedback({ root, fetcher = globalThis.fetch, storage, crypto = globalThis.crypto } = {}) {
  if (!root) return null;
  if (storage === undefined) { try { storage = globalThis.localStorage; } catch {} }
  const doc = root.ownerDocument, body = root.querySelector('.reader-feedback-body');
  const key = 'silver-clouds-reader-feedback';
  let saved = {}, catalog = null, loading = false, busy = false;
  try { saved = JSON.parse(storage?.getItem(key) || '{}') || {}; } catch {}
  const validToken = value => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
  let voterToken = validToken(saved.voterToken) ? saved.voterToken : null;
  const validAnswers = (answers, poll) => answers && typeof answers === 'object' && !Array.isArray(answers)
    && Object.keys(answers).every(id => poll.questions.some(q => q.id === id && q.options.some(option => option.id === answers[id])))
    && poll.questions.every(q => !q.required || typeof answers[q.id] === 'string');
  const node = (tag, text, className) => {
    const item = doc.createElement(tag); if (text != null) item.textContent = text;
    if (className) item.className = className; return item;
  };
  function paint(summary) {
    const form = node('form'), description = node('p', summary.description, 'secondary');
    const selects = new Map();
    for (const question of summary.questions) {
      const label = node('label', question.prompt), select = node('select');
      select.id = `reader-feedback-${question.id}`; label.htmlFor = select.id;
      select.name = question.id; select.required = question.required;
      const empty = node('option', question.required ? 'Choose one…' : 'No preference'); empty.value = '';
      select.append(empty);
      for (const option of question.options) {
        const item = node('option', option.label); item.value = option.id; select.append(item);
      }
      if (saved.pollId === summary.pollId && question.options.some(option => option.id === saved.answers?.[question.id]))
        select.value = saved.answers[question.id];
      form.append(label, select); selects.set(question.id, select);
    }
    const controls = node('div', null, 'reader-feedback-actions');
    const submit = node('button', saved.pollId === summary.pollId ? 'Update feedback' : 'Send feedback'); submit.type = 'submit';
    const show = node('button', 'See reader priorities'); show.type = 'button';
    const status = node('p', '', 'secondary'); status.setAttribute('role', 'status');
    const results = node('div', null, 'reader-feedback-results'); results.hidden = true;
    function paintResults(data) {
      const rows = [node('p', `${data.totalBallots} ${data.totalBallots === 1 ? 'response' : 'responses'} so far.`)];
      for (const question of data.questions) {
        const list = node('ul');
        for (const option of question.options.filter(option => option.count > 0).sort((a, b) => b.count - a.count))
          list.append(node('li', `${option.label} · ${option.count}`));
        rows.push(node('h4', question.prompt), question.totalResponses ? list : node('p', 'No votes yet.', 'secondary'));
      }
      results.replaceChildren(...rows);
    }
    paintResults(summary);
    show.addEventListener('click', () => { results.hidden = !results.hidden; show.textContent = results.hidden ? 'See reader priorities' : 'Hide reader priorities'; });
    form.addEventListener('submit', async event => {
      event.preventDefault(); if (busy || !form.reportValidity()) return;
      const answers = Object.fromEntries([...selects].filter(([, select]) => select.value).map(([id, select]) => [id, select.value]));
      let retained = saved;
      try {
        // Another tab may have voted since this form was opened.
        let current = null; try { current = JSON.parse(storage?.getItem(key) || '{}'); } catch {}
        if (validToken(current?.voterToken)) { voterToken = current.voterToken; retained = current; }
        voterToken ??= crypto.randomUUID();
      }
      catch { status.textContent = 'Feedback is unavailable in this browser. Please try again later.'; return; }
      // Retain this identity even if the response is lost, so retry is idempotent.
      try { storage?.setItem(key, JSON.stringify({ ...retained, voterToken })); } catch {}
      busy = true; submit.disabled = true; status.textContent = 'Saving your feedback…';
      try {
        const response = await fetcher('/api/feedback', { method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pollId: catalog.pollId, voterToken, answers }), signal: AbortSignal.timeout(10_000) });
        if (!response.ok) {
          status.textContent = response.status === 429 ? 'Please wait a little before changing your feedback again.'
            : 'Your feedback could not be saved. Please try again.'; return;
        }
        const result = await response.json();
        if (result.ballot?.pollId !== catalog.pollId || result.summary?.pollId !== catalog.pollId
          || !validAnswers(result.ballot.answers, catalog)
          || Object.keys(result.ballot.answers).length !== Object.keys(answers).length
          || Object.entries(answers).some(([id, choice]) => result.ballot.answers[id] !== choice)) throw new Error('Invalid response');
        saved = { voterToken, pollId: catalog.pollId, answers: result.ballot.answers };
        try { storage?.setItem(key, JSON.stringify(saved)); } catch {}
        catalog = result.summary; paintResults(catalog); results.hidden = false;
        show.textContent = 'Hide reader priorities'; submit.textContent = 'Update feedback';
        status.textContent = 'Thank you — your feedback is saved. You can change it later.';
      } catch { status.textContent = 'Your feedback could not be saved. Please try again.'; }
      finally { busy = false; submit.disabled = false; }
    });
    controls.append(submit, show); form.append(controls, status);
    body.replaceChildren(description, form, results,
      node('p', 'One editable response per browser. No name or email needed. Votes guide future development.', 'secondary reader-feedback-note'));
    catalog = summary;
  }
  async function load() {
    if (catalog || loading) return;
    loading = true; body.setAttribute('aria-busy', 'true'); body.replaceChildren(node('p', 'Loading the reader poll…', 'secondary'));
    try {
      const response = await fetcher('/api/feedback', { cache: 'no-store', signal: AbortSignal.timeout(10_000) });
      if (!response.ok) throw new Error('Feedback unavailable');
      const result = await response.json();
      if (typeof result.pollId !== 'string' || !Array.isArray(result.questions)) throw new Error('Invalid poll');
      paint(result);
    } catch {
      const retry = node('button', 'Try loading the poll again'); retry.type = 'button'; retry.addEventListener('click', load);
      body.replaceChildren(node('p', 'The reader poll is unavailable just now.', 'secondary'), retry);
    } finally { loading = false; body.removeAttribute('aria-busy'); }
  }
  root.addEventListener('toggle', () => { if (root.open) void load(); });
  return { load };
}
if (typeof document !== 'undefined') createReaderFeedback({ root: document.querySelector('#reader-feedback') });
