// router.js — tiny hash router.
let handler = () => {};

export function go(path) {
  if (('#' + path) === location.hash) dispatch();
  else location.hash = path;
}

export function currentPath() {
  return (location.hash || '#/').slice(1);
}

export function onRoute(fn) { handler = fn; }

function dispatch() {
  const path = currentPath();
  const parts = path.replace(/^\//, '').split('/').filter(Boolean);
  handler({ path, parts });
  window.scrollTo(0, 0);
}

window.addEventListener('hashchange', dispatch);
export function startRouter() { if (!location.hash) location.hash = '/'; dispatch(); }
