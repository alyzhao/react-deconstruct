import { REACT_ELEMENT_TYPE } from "shared/ReactSymbols";
import isArray from "shared/isArray";
import { createFiberFromElement, createFiberFromText } from "./ReactFiber";
import { Placement } from "./ReactFiberFlags";

function createChildReconciler(shouldTrackSideEffects) {
  function reconcileSingleElement(returnFiber, currentFirstChild, element) {
    // 根据 ReactElement 创建 fiber, 返回创建的 fiber
    const created = createFiberFromElement(element);
    // 将 fiber.return 指针指向父 fiber
    created.return = returnFiber;
    return created;
  }

  /**
   * 根据是否需要追踪副作用来将 fiber 上的 flags 加上 Placement 副作用
   * @param {*} newFiber
   * @returns
   */
  function placeSingleChild(newFiber) {
    if (shouldTrackSideEffects) newFiber.flags |= Placement; // 这里使用位运算来将 flags 打上 Placement 的标签, 也就是说该 fiber 有需要被插入的节点
    // react 中大量使用了二进制数和位运算来处理 fiber 上的 flags, 后面会单独整理一篇 react 中使用位运算的优点
    return newFiber;
  }

  function reconcileSingleTextNode(returnFiber, currentFirstChild, content) {
    const created = createFiberFromText(textContent);
    created.return = returnFiber;
    return created;
  }

  /**
   * 根据 newChild 这个 ReactElement 的类型创建 fiber, 并将 return 指针指向父 fiber
   * @param {*} returnFiber
   * @param {*} newChild
   * @returns
   */
  function createChild(returnFiber, newChild) {
    if (
      (typeof newChild === "string" && newChild !== "") ||
      typeof newChild === "number"
    ) {
      // 如果是文本节点那么通过 createFiberFromText 创建 fiber
      const created = createFiberFromText("" + newChild);
      created.return = returnFiber;
      return created;
    }

    if (typeof newChild === "object" && newChild !== null) {
      switch (newChild.$$typeof) {
        case REACT_ELEMENT_TYPE: {
          // 如果是 ReactElement 元素则从 createFiberFromElement 创建 fiber
          const created = createFiberFromElement(newChild);
          created.return = returnFiber;
          return created;
        }
        default:
          break;
      }
    }
    return null;
  }

  function placeChild(newFiber, lastPlacedIndex, newIndex) {
    newFiber.index = newIndex; // 设置 index
    if (!shouldTrackSideEffects) return lastPlacedIndex;
    const current = newFiber.alternate;
    if (current !== null) {
      const oldIndex = current.index;
      if (oldIndex < lastPlacedIndex) {
        newFiber.flags |= Placement;
        return lastPlacedIndex;
      } else {
        return oldIndex;
      }
    } else {
      // 初次挂载时走这个分支, 新 fiber 有需要被添加的 dom 所以 flags 上需要添加 Placement 标记
      newFiber.flags |= Placement;
      return lastPlacedIndex;
    }
  }

  function updateSlot(returnFiber, newChild) {
    // TODO: 更新 fiber
  }

  function reconcileChildrenArray(returnFiber, currentFirstChild, newChildren) {
    let resultingFirstChild = null; // 根据 newChildren 构建的第一个 fiber
    let previousNewFiber = null; // 构建好的上一个 fiber, 在构建完成一个 fiber 之后要将 previousNewFiber.sibling 指向构建好的 fiber

    let oldFiber = currentFirstChild;
    let lastPlacedIndex = 0;
    let newIdx = 0;
    let nextOldFiber = null;

    // 如果是更新
    for (; oldFiber !== null && newIdx < newChildren.length; newIdx++) {
      // 根据老 fiber 的 index 和 newIdx 进行对比, 如果老 fiber 的 index 大于当前的 newIdx 说明当前构建的 fiber 没有老 fiber 需要重新创建
      if (oldFiber.index > newIdx) {
        nextOldFiber = oldFiber;
        oldFiber = null;
      } else {
        nextOldFiber = oldFiber.sibling;
      }

      const newFiber = updateSlot(returnFiber, newChildren[newIdx]);
      if (newFiber === null) {
        continue;
      }
      lastPlacedIndex = placeChild(newFiber, lastPlacedIndex, newIdx);
      if (previousNewFiber === null) {
        resultingFirstChild = newFiber;
      } else {
        previousNewFiber.sibling = newFiber;
      }
      previousNewFiber = newFiber;
      oldFiber = nextOldFiber;
    }

    // 如果是初次挂载, 第一次挂载时一定是走这个分支
    if (oldFiber === null) {
      for (; newIdx < newChildren.length; newIdx++) {
        const newFiber = createChild(returnFiber, newChildren[newIdx]);
        if (newFiber === null) {
          continue;
        }
        lastPlacedIndex = placeChild(newFiber, lastPlacedIndex, newIdx);
        if (previousNewFiber === null) {
          resultingFirstChild = newFiber;
        } else {
          previousNewFiber.sibling = newFiber;
        }
        previousNewFiber = newFiber;
      }
      return resultingFirstChild;
    }

    return resultingFirstChild;
  }

  /**
   * 协调 newChild 这里的 newChild 是指 ReactElement 也就是虚拟 dom, 实际上就是根据 newChild ReactElement 构建 fiber
   * 并且将构建出来的 childFiber.return 指向父 fiber, childFiber.sibling 指向右兄弟 fiber
   * @param {*} returnFiber 正在被构建的 workInProgress fiber, 也就是被构建的子 fiber 的父 fiber
   * @param {*} currentFirstChild 老的 fiber 的第一个子 fiber, 第一次挂在时为 null
   * @param {*} newChild ReactElement 虚拟 dom
   * @returns 返回第一个子 fiber
   */
  function reconcileChildFibers(returnFiber, currentFirstChild, newChild) {
    // 根据 newChild 的类型不同, 需要分别处理
    if (typeof newChild === "object" && newChild !== null) {
      switch (newChild.$$typeof) {
        // 如果是一个单节点,
        case REACT_ELEMENT_TYPE: {
          return placeSingleChild(
            reconcileSingleElement(returnFiber, currentFirstChild, newChild)
          );
        }
        default:
          break;
      }
      // 如果是一个数组的话 ps: 所以在调用 ReactDOMRoot.render 方法时也可以传入一个数组
      if (isArray(newChild)) {
        return reconcileChildrenArray(returnFiber, currentFirstChild, newChild);
      }
    }
    // 如果是 newChild 是一个文本
    if (typeof newChild === "string") {
      return placeSingleChild(
        reconcileSingleTextNode(returnFiber, currentFirstChild, newChild)
      );
    }
    return null;
  }

  return reconcileChildFibers;
}

export const reconcileChildFibers = createChildReconciler(true);

export const mountChildFibers = createChildReconciler(false);
