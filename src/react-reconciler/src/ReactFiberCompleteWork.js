import {
  appendInitialChild,
  createInstance,
  createTextInstance,
  finalizeInitialChildren,
} from "./ReactFiberHostConfig";
import { HostComponent, HostRoot, HostText } from "./ReactWorkTags";
import { NoFlags } from "./ReactFiberFlags";

/**
 * 将所有后代节点的 flags 合并到自己的额 subtreeFlags 上
 */
function bubbleProperties(completedWork) {
  let subtreeFlags = NoFlags;
  let child = completedWork.child;
  // 从第一个 childFiber 出发将所有 childFiber 的 subtreeFlags 和 flags 都合并到 completedWork.subtreeFlags 上
  while (child !== null) {
    subtreeFlags |= child.subtreeFlags;
    subtreeFlags |= child.flags;
    child = child.sibling;
  }
  completedWork.subtreeFlags |= subtreeFlags;
}

/**
 * 创建完 fiber 对应的 DOM 节点之后, 需要将子 fiber 的 DOM 节点 append 到 DOM 节点上
 * 这里需要处理一个特殊情况, 如果 fiber.child 是一个函数组件对应的 fiber 那么需要在 fiber.child.child 上找到原生 DOM 并且 append 到 parent 上
 * @param {*} parent
 * @param {*} workInProgress
 * @returns
 */
function appendAllChildren(parent, workInProgress) {
  let node = workInProgress.child;
  while (node !== null) {
    // 如果是原生DOM节点, 直接添加到父DOM节点上
    if (node.tag === HostComponent || node.tag === HostText) {
      appendInitialChild(parent, node.stateNode);
    } else if (node.child !== null) {
      // 如果 node 不是原生 DOM 节点, 比如是一个函数组件对应的 fiber, 那么会向下查找 child, 找到函数组件 fiber 对应的真实 DOM
      node.child.return = node;
      node = node.child;
      continue;
    }
    if (node === workInProgress) {
      return;
    }
    while (node.sibling === null) {
      // 如果该 fiber 下只有一个原生节点, 那么 appendAllChildren 的任务就完成了
      if (node.return === null || node.return === workInProgress) {
        return;
      }
      // 否则的话说明当前的 node.return 是一个函数组件 fiber, 需要去把这个 函数组件 fiber 的右兄弟节点也 append 到 parent 上
      node = node.return;
    }
    node.sibling.return = node.return;
    // 将 node.sibling 对应的 DOM 节点 append 到 parent 上
    node = node.sibling;
  }
}

/**
 * 完成当前工作 fiber 即 workInProgress, 也就是根据 fiber 的类型创建真实 DOM
 * @param {*} current 当前 workInProgress fiber 所对应的老 fiber
 * @param {*} workInProgress 等待被完成的 fiber
 */
export function completeWork(current, workInProgress) {
  const newProps = workInProgress.pendingProps;
  switch (workInProgress.tag) {
    // 处理 rootFiber 的完成
    case HostRoot:
      bubbleProperties(workInProgress); // 将后代 fiber 节点的 flags 合并到 workInProgress.subtreeFlags
      break;

    // 处理原生 DOM 节点的完成
    case HostComponent: {
      const { type } = workInProgress;
      // TODO: 处理更新逻辑
      const instance = createInstance(type, newProps, workInProgress); // 根据 type 创建真实 DOM
      appendAllChildren(instance, workInProgress); // 将该 fiber 下的所有子 fiber 对应的真实 DOM append 到 instance 上

      workInProgress.stateNode = instance; // 将 fiber.stateNode 设置为创建的原生 DOM

      finalizeInitialChildren(instance, type, newProps); // 根据 props 上的属性设置 instance DOM 实例上的属性

      bubbleProperties(workInProgress); // 将后代 fiber 节点的 flags 合并到 workInProgress.subtreeFlags
      break;
    }

    // 处理文本节点
    case HostText: {
      const newText = newProps;
      workInProgress.stateNode = createTextInstance(newText); // 使用 document.createTextNode 创建 TextNode
      bubbleProperties(workInProgress); // 同上合并 flags
      break;
    }
    default:
      break;
  }
}
