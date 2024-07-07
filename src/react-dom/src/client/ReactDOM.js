import { createRoot as createRootImpl } from './ReactDOMRoot';

function createRoot(container) {
  return createRootImpl(container);
}

export {
  createRoot,
}
