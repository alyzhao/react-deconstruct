import { setInitialProperties } from "./ReactDOMComponent";

export function shouldSetTextContent(type, props) {
  return (
    type === "textarea" ||
    type === "noscript" ||
    typeof props.children === "string" ||
    typeof props.children === "number" ||
    (typeof props.dangerouslySetInnerHTML === "object" &&
      props.dangerouslySetInnerHTML !== null &&
      props.dangerouslySetInnerHTML.__html != null)
  );
}

/**
 * 将 child 这个 DOM 节点 append 到 parent 这个 DOM 节点上
 * @param {domElement} parent
 * @param {domElement} child
 */
export const appendInitialChild = (parent, child) => {
  parent.appendChild(child);
};

export function createElement(type, props) {
  // 源码中还有其他逻辑, 比如确定当前的 ownerDocument, 针对 script, select, web component 有额外逻辑
  // 这里省略, 本质上就是通过 document.createElement 创建 DOM
  return document.createElement(type);
}

/**
 * 根据 HostComponent fiber 创建 DOM 实例
 * @param {*} type fiber.type 也就是 DOM 标签
 * @param {*} props fiber.pendingProps 最新的属性
 * @param {*} internalInstanceHandle 当前的工作 fiber
 * @returns
 */
export const createInstance = (type, props, internalInstanceHandle) => {
  const domElement = createElement(type, props);
  return domElement;
};

export const createTextInstance = (content) => document.createTextNode(content);

/**
 * 根据 props 处理 style children 等属性, 将他们设置到 domElement 上
 * @param {*} domElement
 * @param {*} type
 * @param {*} props
 */
export function finalizeInitialChildren(domElement, type, props) {
  setInitialProperties(domElement, type, props);
}

export function appendChild(parentInstance, child) {
  parentInstance.appendChild(child);
}

export function insertBefore(parentInstance, child, beforeChild) {
  parentInstance.insertBefore(child, beforeChild);
}
