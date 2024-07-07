import { createFiberRoot } from "./ReactFiberRoot";
import { createUpdate, enqueueUpdate } from "./ReactFiberClassUpdateQueue";
import { scheduleUpdateOnFiber } from "./ReactFiberWorkLoop";

export function createContainer(containerInfo) {
  return createFiberRoot(containerInfo);
}

/**
 * ReactDOMRoot 的 render 方法会调用此函数
 * @param {*} element 被 render 的 ReactElement
 * @param {*} container FiberRootNode 对象, { current: rootFiber, containerInfo: 根容器 }
 */
export function updateContainer(element, container) {
  const current = container.current;
  const update = createUpdate();
  update.payload = { element };
  const root = enqueueUpdate(current, update);
  if (root !== null) {
    scheduleUpdateOnFiber(root, current);
  }
}
