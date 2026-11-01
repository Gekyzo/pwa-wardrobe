import { direction, slideTo, slideBack, historyStep, detailAlone } from '#sections';
import { visibleSections } from '#modules';
import { ui, off, render, scroller, guardClick } from '#ui/context';
import { checkVersion } from '#ui/update';
import { showNavButton } from '#ui/dust';

// Lets the content of the new section come in from the side that it is on in the navigation.
const enter = (way) => {
  scroller.classList.remove('enter-next', 'enter-previous');
  if (!way) return;
  // The read of the width starts the animation again when a change follows another one.
  void scroller.offsetWidth;
  scroller.classList.add(way > 0 ? 'enter-next' : 'enter-previous');
};

export const setView = (view) => {
  if (view === ui.view) return;
  const way = direction(ui.view, view, visibleSections(off));
  Object.assign(ui, { view, garmentId: null, combination: null });
  scroller.scrollTop = 0;
  render();
  enter(way);
  if (view === 'settings') checkVersion();
};

// The random panel of Wardrobe is no detail (WAR-9): it has no history entry.
const detailOpen = () => ui.garmentId !== null || ui.combination !== null;

const closeDetail = () => {
  Object.assign(ui, { garmentId: null, detailImage: null, combination: null });
  render();
  enter(-1);
};

// An open detail has an entry of the history, so that the Back of the phone, the slide from the
// edge too, closes it instead of the app (NAV-7). `leaving` is true from a `history.back()` of the
// app until its `popstate`, which then closes nothing.
let leaving = false;
export const syncHistory = () => {
  if (leaving) return;
  const step = historyStep(detailOpen(), history.state?.detail === true);
  if (step === 'push') history.pushState({ ...history.state, detail: true }, '');
  else if (step === 'back') {
    leaving = true;
    history.back();
  }
};

export const renderNav = () => {
  const sections = visibleSections(off);
  // A section of a module that went off sends the view to the first one that is on.
  if (!sections.includes(ui.view)) ui.view = sections[0];
  document.querySelectorAll('.nav-item').forEach((button) => {
    showNavButton(button, sections.includes(button.dataset.view));
    if (button.dataset.view === ui.view) button.setAttribute('aria-current', 'page');
    else button.removeAttribute('aria-current');
  });
};

export const bind = () => {
  // A child of the content that shows later must not come in from a side.
  scroller.addEventListener('animationend', (event) => {
    if (event.animationName === 'enter') scroller.classList.remove('enter-next', 'enter-previous');
  });
  document.querySelectorAll('.nav-item').forEach((button) => {
    button.addEventListener('click', () => setView(button.dataset.view));
  });
  // A horizontal slide changes the section (NAV-2). A text field keeps its drag for the selection.
  let sectionSlide = null;
  document.addEventListener('pointerdown', (event) => {
    sectionSlide = null;
    if (!event.isPrimary || event.button !== 0 || ui.sheetOpen || ui.onboarding !== null) return;
    if (!event.target.closest('.app-header, main') || event.target.closest('input, textarea, select')) return;
    sectionSlide = { pointerId: event.pointerId, x: event.clientX, y: event.clientY };
  });
  document.addEventListener('pointerup', (event) => {
    if (sectionSlide?.pointerId !== event.pointerId) return;
    const [dx, dy] = [event.clientX - sectionSlide.x, event.clientY - sectionSlide.y];
    sectionSlide = null;
    // A detail that shows alone closes on a slide to the right (NAV-3).
    const open = { garment: ui.garmentId !== null, combination: ui.combination !== null };
    if (slideBack(dx, dy, detailAlone(open, matchMedia('(min-width: 840px)').matches))) {
      guardClick();
      closeDetail();
      return;
    }
    const view = slideTo(ui.view, dx, dy, visibleSections(off));
    if (!view) return;
    // The click that follows a slide must not press the button below the finger.
    guardClick();
    setView(view);
  });
  document.addEventListener('pointercancel', () => {
    sectionSlide = null;
  });
  window.addEventListener('popstate', () => {
    if (leaving) {
      leaving = false;
      // A detail that opened before the `popstate` gets its entry now.
      syncHistory();
    } else if (detailOpen()) closeDetail();
  });
};
