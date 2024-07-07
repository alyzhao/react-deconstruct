import {
  HostRoot,
  HostComponent,
  HostText,
  IndeterminateComponent,
} from "./ReactWorkTags";
import { processUpdateQueue } from "./ReactFiberClassUpdateQueue";
import { mountChildFibers, reconcileChildFibers } from "./ReactChildFiber";
import { shouldSetTextContent } from "./ReactFiberHostConfig";

/**
 * 协调 children 这里的 children 是指 ReactElement 也就是虚拟 dom, 实际上就是根据 children ReactElement 构建 fiber
 * @param {*} current 当前页面中正在渲染的 fiber, 也就是老的 fiber
 * @param {*} workInProgress 重新构建的 fiber
 * @param {*} nextChildren ReactElement 虚拟 dom
 */
function reconcileChildren(current, workInProgress, nextChildren) {
  if (current === null) {
    // 如果没有老的 fiber 的话, 不需要追踪副作用, 因为这个 fiber 一定是新加的, 需要创建 DOM instance
    // 并且在协调的时候已经把这个 DOM instance 给添加到了父 fiber 的 DOM 上了, 不需要加上 PlaceMent flag 避免在提交阶段重复地 append
    workInProgress.child = mountChildFibers(workInProgress, null, nextChildren);
  } else {
    // 如果有老的 fiber, 那么这是一次更新 或者是在第一次挂载时协调 rootFiber 那么会走到这儿
    // reconcileChildFibers 会追踪副作用, 在提交阶段的话会提交这些副作用, 比如添加节点
    // reconcileChildFibers 调用结束时, 构建出来的 childFiber.return 指向父 fiber 即 workInProgress, childFiber.sibling 指向右兄弟 fiber
    // 最后将 workInProgress.child 指向 reconcileChildFibers 返回的第一个子 fiber, fiber 链表就串起来
    workInProgress.child = reconcileChildFibers(
      workInProgress,
      current.child,
      nextChildren
    );
  }
}

/**
 * 从根 fiber 即 rootFiber, 拿到最新的需要被 render 的 ReactElement 并且协调子节点的 fiber, 也就是创建子 fiber
 * @param {*} current 当前页面中正在渲染的 fiber, 也就是老的 fiber
 * @param {*} workInProgress 重新构建的 fiber 即正在构建的 fiber
 * @returns
 */
function updateHostRoot(current, workInProgress) {
  processUpdateQueue(workInProgress);
  // 此时 RootFiber.memoizedState 是 { element: AppReactElement } 对象
  // 这个 AppReactElement 是在 ReactDOMRoot.render 方法传入的 ReactElement
  const nextState = workInProgress.memoizedState;
  const nextChildren = nextState.element; // 那么这个 nextChildren 就是需要被渲染的 ReactElement

  // 协调后代节点, 也就是根据后代节点的 ReactElement 构造 fiber, 并且建立正确的 return sibling 指针
  reconcileChildren(current, workInProgress, nextChildren);
  // 返回第一个子 fiber
  return workInProgress.child;
}

/**
 * 协调原生 DOM 节点下的子节点, 根据 props.children 拿到子 ReactElement 构建子节点的 fiber
 * @param {*} current 当前页面中正在渲染的 fiber, 也就是老的 fiber
 * @param {*} workInProgress 重新构建的 fiber 即正在构建的 fiber
 * @returns
 */
function updateHostComponent(current, workInProgress) {
  const { type } = workInProgress;
  const nextProps = workInProgress.pendingProps;
  let nextChildren = nextProps.children;
  // 这里 React 进行了优化, 如果 nextProps.children 是一个字符串或者数字的话 即 workInProgress 对应的后代节点是一个文本节点, 那么不会协调 workInProgress 的后代节点 即不会创建单文本节点的 fiber
  const isDirectTextChild = shouldSetTextContent(type, nextProps);
  if (isDirectTextChild) {
    nextChildren = null;
  }
  reconcileChildren(current, workInProgress, nextChildren);
  return workInProgress.child;
}

/**
 *
 * @param {*} current 当前页面中正在渲染的 fiber, 也就是老的 fiber
 * @param {*} workInProgress 重新构建的 fiber
 * @returns 返回第一个子 fiber
 */
export function beginWork(current, workInProgress) {
  switch (workInProgress.tag) {
    // rootFiber
    case HostRoot:
      return updateHostRoot(current, workInProgress);
    // 原生 DOM 节点
    case HostComponent:
      return updateHostComponent(current, workInProgress);

    // TODO: 函数组件我们会放到后面的 hooks 中一并讲
    case IndeterminateComponent:
    default:
      return null;
  }
}
