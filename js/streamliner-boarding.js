/* Progressive doorway enhancement. Every destination is also an ordinary link. */
(() => {
  'use strict';
  const doorway = document.querySelector('#maintenance-carriage');
  if (!doorway) return;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let curiousTimer = 0, closeTimer = 0, leaveTimer = 0, visible = false;
  const intro = document.querySelector('.sc-lore-actions');
  if (intro && !intro.querySelector('a[href="#maintenance-carriage"]')) {
    const invitation = document.createElement('a');
    invitation.href = '#maintenance-carriage';
    invitation.className = 'sc-lore-nav-link sc-lore-read';
    invitation.textContent = 'Step aboard ↓';
    intro.prepend(invitation);
  }
  const stop = () => {
    clearTimeout(curiousTimer); clearTimeout(closeTimer);
    doorway.classList.remove('sc-boarding-visible','sc-boarding-curious');
  };
  const lookAgain = () => {
    if (!visible || document.hidden || reduced.matches) return;
    doorway.classList.add('sc-boarding-curious');
    closeTimer = setTimeout(() => doorway.classList.remove('sc-boarding-curious'), 4200);
    curiousTimer = setTimeout(lookAgain, 22000);
  };
  const sync = () => {
    stop();
    if (!visible || document.hidden || reduced.matches) return;
    doorway.classList.add('sc-boarding-visible');
    curiousTimer = setTimeout(lookAgain, 1400);
  };
  const observer = new IntersectionObserver(entries => {
    visible = entries[0].isIntersecting; sync();
  }, {threshold:.12});
  observer.observe(doorway);
  document.addEventListener('visibilitychange',sync);
  reduced.addEventListener('change',sync);
  doorway.querySelector('.sc-boarding-enter').addEventListener('click',event => {
    if (event.defaultPrevented || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || reduced.matches) return;
    event.preventDefault();
    const destination=event.currentTarget.href;
    clearTimeout(leaveTimer);
    document.body.classList.add('sc-boarding-leaving');
    leaveTimer=setTimeout(()=>location.assign(destination),460);
  });
  window.addEventListener('pagehide',()=>{stop();clearTimeout(leaveTimer);document.body.classList.remove('sc-boarding-leaving');});
  window.addEventListener('pageshow',()=>{document.body.classList.remove('sc-boarding-leaving');sync();});
})();
