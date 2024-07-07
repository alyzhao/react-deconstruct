import { NoLanes } from "./ReactFiberLane";
import { markUpdateLaneFromFiberToRoot } from "./ReactFiberConcurrentUpdates";
import assign from "shared/assign";

export const UpdateState = 0;

export function initializeUpdateQueue(fiber) {
  const queue = {
    baseState: fiber.memoizedState,
    firstBaseUpdate: null,
    lastBaseUpdate: null,
    shared: {
      pending: null,
      interleaved: null,
      lanes: NoLanes,
    },
    effects: null,
  };
  fiber.updateQueue = queue;
}

export function createUpdate(eventTime, lane) {
  const update = {
    eventTime,
    lane,

    tag: UpdateState,
    payload: null,
    callback: null,

    next: null,
  };
  return update;
}

/**
 * 在 fiber 的 updateQueue.shared.pending 上入队更新
 * @param {*} fiber
 * @param {*} update
 * @returns
 */
export function enqueueUpdate(fiber, update) {
  const updateQueue = fiber.updateQueue;

  const sharedQueue = updateQueue.shared;

  const pending = sharedQueue.pending;
  // 构造循环链表, pending 永远指向最后一个更新
  if (pending === null) {
    update.next = update;
  } else {
    update.next = pending.next;
    pending.next = update;
  }
  updateQueue.shared.pending = update;
  return markUpdateLaneFromFiberToRoot(fiber);
}

function getStateFromUpdate(update, prevState) {
  switch (update.tag) {
    case UpdateState: {
      const { payload } = update;
      const partialState = payload;
      // assign 就是 Object.assign
      // 如果是更新那么就是合并属性
      return assign({}, prevState, partialState);
    }
    default:
      return prevState;
  }
}

export function processUpdateQueue(workInProgress) {
  const queue = workInProgress.updateQueue;
  const pendingQueue = queue.shared.pending;
  if (pendingQueue !== null) {
    queue.shared.pending = null;
    const lastPendingUpdate = pendingQueue;
    const firstPendingUpdate = lastPendingUpdate.next;
    lastPendingUpdate.next = null;
    let newState = workInProgress.memoizedState;
    let update = firstPendingUpdate;
    while (update) {
      newState = getStateFromUpdate(update, newState);
      update = update.next;
    }
    // 所以如果是 RootFiber 的话, memoizedState 就是 { element: AppReactElement } 对象
    // 这个 AppReactElement 是在 ReactDOMRoot.render 方法传入的 ReactElement
    workInProgress.memoizedState = newState;
  }
}
