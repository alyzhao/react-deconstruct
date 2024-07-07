import { setValueForStyles } from "./CSSPropertyOperations";
import setTextContent from "./setTextContent";
import { setValueForProperty } from "./DOMPropertyOperations";

const CHILDREN = "children";
const STYLE = "style";

function setInitialDOMProperties(tag, domElement, nextProps) {
  for (const propKey in nextProps) {
    if (!nextProps.hasOwnProperty(propKey)) {
      continue;
    }
    const nextProp = nextProps[propKey];
    if (propKey === STYLE) {
      setValueForStyles(domElement, nextProp); // 设置  node.style 属性
    } else if (propKey === CHILDREN) {
      if (typeof nextProp === "string") {
        const canSetTextContent = tag !== "textarea" || nextProp !== "";
        if (canSetTextContent) {
          setTextContent(domElement, nextProp); // 如果 children 属性就是仅仅一个文本, 前面也说过不会为该文本创建 fiber, 在这里也是直接设置 domElement 的 textContent
        }
      } else if (typeof nextProp === "number") {
        setTextContent(domElement, "" + nextProp); // 和上面一样只不过需要转换成字符串
      }
    } else if (nextProp != null) {
      setValueForProperty(domElement, propKey, nextProp); // 调用 DOM 的 removeAttribute 和 setAttribute 方法来移除或者添加属性
    }
  }
}

/**
 * 将 props 中的属性正确地设置到 domElement 上
 * @param {*} domElement
 * @param {*} tag 这里的 tag 实际上是 fiber.type, 也就是原生 DOM 的标签, 这里为什么使用 tag 参数名应该是历史原因, 这部分代码在没有 fiber 之前就存在
 * @param {*} props
 */
export function setInitialProperties(domElement, tag, props) {
  setInitialDOMProperties(tag, domElement, props);
}
