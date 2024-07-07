import { scheduleCallback as Scheduler_scheduleCallback } from "./Scheduler";
import { createWorkInProgress } from "./ReactFiber";
import { beginWork } from "./ReactFiberBeginWork";
import { completeWork } from "./ReactFiberCompleteWork";
import { NoFlags, MutationMask } from "./ReactFiberFlags";
import { commitMutationEffects } from "./ReactFiberCommitWork";

let workInProgress = null;

export function scheduleUpdateOnFiber(root) {
  ensureRootIsScheduled(root);
}

function ensureRootIsScheduled(root) {
  Scheduler_scheduleCallback(performConcurrentWorkOnRoot.bind(null, root));
}

function commitRootImpl(root) {
  const { finishedWork } = root;
  const subtreeHasEffects =
    (finishedWork.subtreeFlags & MutationMask) !== NoFlags;
  const rootHasEffect = (finishedWork.flags & MutationMask) !== NoFlags;
  if (subtreeHasEffects || rootHasEffect) {
    commitMutationEffects(root, finishedWork);
  }
  root.current = finishedWork;
}

function commitRoot(root) {
  commitRootImpl(root);
}

function finishConcurrentRender(root) {
  commitRoot(root);
}

function performConcurrentWorkOnRoot(root) {
  // TODO: 这里先使用 sync render, 在 react 中如果低更新超时会使用 sync render 否则会使用 concurrent render
  renderRootSync(root);

  const finishedWork = root.current.alternate;
  root.finishedWork = finishedWork;
  finishConcurrentRender(root);
}

function prepareFreshStack(root) {
  workInProgress = createWorkInProgress(root.current, null);
  return workInProgress;
}

function renderRootSync(root) {
  prepareFreshStack(root);
  workLoopSync();
}

function workLoopSync() {
  // 在同步模式下会不停地协调当前的工作 fiber
  // TODO: 后面会讲到 concurrent 模式下的协调, 和同步模式逻辑一样只不过可以中断, 异步地协调
  while (workInProgress !== null) {
    performUnitOfWork(workInProgress);
  }
}

/**
 * 协调 unitOfWork fiber 节点的子 fiber, 协调完成 unitOfWork 之后再协调 unitOfWork.child 即 第一个子 fiber,
 * @param {*} unitOfWork
 */
function performUnitOfWork(unitOfWork) {
  const current = unitOfWork.alternate;
  const next = beginWork(current, unitOfWork);
  unitOfWork.memoizedProps = unitOfWork.pendingProps;
  if (next === null) {
    // 当某个节点没有后代节点时 '完成当前的工作单元' 即 completeUnitOfWork 从英文上理解即可
    completeUnitOfWork(unitOfWork);
  } else {
    workInProgress = next;
  }
}

function completeUnitOfWork(unitOfWork) {
  let completedWork = unitOfWork;
  do {
    const current = completedWork.alternate;
    const returnFiber = completedWork.return;

    completeWork(current, completedWork);

    const siblingFiber = completedWork.sibling;
    // 如果当前完成的 fiber 有右兄弟节点 siblingFiber, 那么将当前的工作 fiber 置为 siblingFiber
    if (siblingFiber !== null) {
      workInProgress = siblingFiber;
      return;
    }
    // 如果当前完成的 fiber 没有右兄弟节点, 说明父 fiber 下的后代节点都已经完成了, 那么去完成父 fiber
    completedWork = returnFiber;
    workInProgress = completedWork;
  } while (completedWork !== null);
}
