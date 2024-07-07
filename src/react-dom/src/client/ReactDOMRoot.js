import {
  createContainer,
  updateContainer,
} from "react-reconciler/src/ReactFiberReconciler";

/**
 * react 使用该方法在根容器上渲染 ReactElement
 * @param {*} children
 */
ReactDOMRoot.prototype.render = function (children) {
  const root = this._internalRoot;
  updateContainer(children, root, null, null);
};

function ReactDOMRoot(internalRoot) {
  this._internalRoot = internalRoot;
}

/**
 *
 * @param {DOMElement} container 根节点
 * @returns
 */
export function createRoot(container) {
  const root = createContainer(container);
  return new ReactDOMRoot(root);
}
