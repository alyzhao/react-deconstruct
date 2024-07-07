本文主要介绍了整个 `React` 如何将 `JSX` 转换成 `ReactElement` 也就是虚拟 DOM, 再通过 `ReactElement` 在协调阶段构造 `fiber` 树, 创建 `DOM` 实例, 标记 `fiber` 的 `flags` 副作用标记, 并在 `commit` 阶段将 `fiber` 树上的 `DOM` 插入到容器节点中, 从而完成初次挂载。配合[仓库代码](https://github.com/alyzhao/react-deconstruct)食用体验更佳！

## 从 JSX 到 ReactElement

在开发 React 应用时, 我们使用 `JSX` 来开发, 比如下面的 `JSX` 代码

```jsx
const worldRef = {};

const App = (
  <h1 title="hello world">
    hello{" "}
    <span
      style={{ color: "cyan" }}
      className="barClass"
      key="wordKey"
      ref={worldRef}
    >
      world
    </span>
  </h1>
);
```

那么为了能够运行这段`JSX`, 首先得使用 [@babel/plugin-transform-react-jsx
](https://babeljs.io/docs/babel-plugin-transform-react-jsx) 编译成 js, 在我们平时开发 React 项目时也会通过 `babel` 编译。也可以通过在线的 [babel repl](https://babeljs.io/repl) 进行编译, 编译后的结果如下:

```js
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
const worldRef = {};
const App = /*#__PURE__*/ _jsxs("h1", {
  title: "hello world",
  children: [
    "hello ",
    /*#__PURE__*/ _jsx(
      "span",
      {
        style: {
          color: "cyan",
        },
        className: "barClass",
        ref: worldRef,
        children: "world",
      },
      "word"
    ),
  ],
});
```

通过上面编译的代码, 我们发现实际上 `JSX` 中每个节点会被编译成 `jsx(type, config, maybeKey)` 的形式, 其中的 `jsx` 方法是 `react/jsx-runtime` 这个文件中导出的方法, 在运行时, react 会通过 `jsx` 这个方法将 `JSX` 转换成 `ReactElement` 也就是 React 元素即虚拟 DOM。我们发现 `jsx(type, config, maybeKey)` 中的 type 实际上就是原生 DOM 的标签或者是函数组件, `config` 由属性和 `children`组成, `maybeKey` 则是节点的显式的 `key`, `jsx` 方法的实现如下:

```js
// 这里从 share 包中引入的 hasOwnProperty 实际上就是 Object.hasOwnProperty
import hasOwnProperty from "shared/hasOwnProperty";
// 这里引入的值实际上就是 Symbol.for('react.element')
import { REACT_ELEMENT_TYPE } from "shared/ReactSymbols";

const RESERVED_PROPS = {
  key: true,
  ref: true,
};

function hasValidateRef(config) {
  return config.ref !== undefined;
}

function hasValidateKey(config) {
  return config.key !== undefined;
}

function ReactElement(type, key, ref, props) {
  const element = {
    $$typeof: REACT_ELEMENT_TYPE,
    type: type,
    key: key,
    ref: ref,
    props: props,
  };

  return element;
}

export function jsx(type, config, maybeKey) {
  let propName;

  const props = {};

  let key = null;
  let ref = null;

  // 这里确定 ReactElement 的 key 时看上去判断了两次有点多此一举
  // 但是 react 代码的注释里说了一种情况就是在 <div {...props} key="Hi"> 如果 props 中也有一个 key
  // 比如 props 是  { key: Ho }, 但是 babel 并不能区分 props 中的 key, 编译后的 maybeKey 仍然是 Hi
  // 所以需要判断两次, 判断 maybeKey 和判断 props 中的 key, 当然我们也可以看到 props 中的 key 优先级更高
  if (maybeKey !== undefined) {
    key = "" + maybeKey;
  }

  if (hasValidateKey(config)) {
    key = "" + config.key;
  }

  if (hasValidateRef(config)) {
    ref = config.ref;
  }

  for (propName in config) {
    if (
      hasOwnProperty.call(config, propName) &&
      !RESERVED_PROPS.hasOwnProperty(propName)
    ) {
      props[propName] = config[propName];
    }
  }

  return ReactElement(type, key, ref, props);
}
```

整个 `jsx` 函数实际上就是将编译后的 `JSX` 转换成 `ReactElement`, 为此 `jsx` 做了这么几件事:

- 根据 `maybeKey` 和 `config` 中的 `key` 确定最终的 `key`
- 根据 `config` 中的 `ref` 确定 `ref`
- 从 `props` 中排除保留的关键字 `key` 和 `ref`, 这也是我们在 props 中拿不到 `key` 和 `ref` 的原因 + 最终根据 `key, ref, type, props` 来创建 `ReactElement` 对象

## 从 createRoot 说起

通常我们在根节点渲染 `React` 组件我们要使用 [createRoot](https://zh-hans.react.dev/reference/react-dom/client/createRoot), 类似以下代码:

```jsx
import { createRoot } from "react-dom/client";

const root = createRoot(document.getElementById("root"));
root.render(<App />);
```

`createRoot` 函数最终在 `react/dom/src/client/ReactDOMRoot.js` 中实现:

```js
import { createContainer } from "react-reconciler/src/ReactFiberReconciler";

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
```

可以看到 `createRoot` 函数返回 `ReactDOMRoot` 的实例, 这个实例上有一个 `_internalRoot` 属性指向 `createContainer` 函数返回的 `FiberRootNode` 实例。`createContainer` 方法的实现如下:

```js
import { createFiberRoot } from "./ReactFiberRoot";

export function createContainer(containerInfo) {
  return createFiberRoot(containerInfo);
}
```

这其中的 `createFiberRoot` 方法实现如下:

```js
import { createHostRootFiber } from "./ReactFiber";
import { initializeUpdateQueue } from "./ReactFiberClassUpdateQueue";

function FiberRootNode(containerInfo) {
  this.containerInfo = containerInfo;
  this.current = null;
}

export function createFiberRoot(containerInfo) {
  const root = new FiberRootNode(containerInfo);

  const uninitializedFiber = createHostRootFiber(); // 创建根 fiber 也就是 RootFiber
  root.current = uninitializedFiber;
  uninitializedFiber.stateNode = root;

  initializeUpdateQueue(uninitializedFiber);

  return root;
}
```

这里使用 `initializeUpdateQueue` 在 rootFiber 上初始化了一个 `updateQueue`

```js
import { NoLanes } from "./ReactFiberLane";

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
```

`ReactDOMRoot` 和 `FiberRootNode` 以及 `RootFiber` 的关系如下:

![ReactDOMRoot](./diagrams/ReactDomRoot.svg)

`reactDOMRoot` 的 `_internalRoot` 指向 `fiberRootNode` 实例, `fiberRootNode` 的 `current` 属性指向 `RootFiber`, `RootFiber` 的 `stateNode` 又指向 `fiberRootNode`

可以注意到在创建 `uninitializedFiber` (其实就是 `RootFiber` 即根 `fiber`) 时使用的是 `createHostRootFiber` 函数, 最终 `createHostRootFiber` 会调用 `createFiber` 这个工厂方法来创建 `fiber`

```js
import { HostRoot } from "./ReactWorkTags";
import { NoFlags } from "./ReactFiberFlags";
import { NoLanes } from "./ReactFiberLane";

function FiberNode(tag, pendingProps, key) {
  // 和DOM实例相关的属性, 可以理解为从 ReactElement 转换成 Fiber 时, 会将 ReactElement 中的属性赋值给 fiber 实例
  this.tag = tag; // 不同 ReactElement 中的类型, 对应不同的 tag, 比如函数组件 FunctionComponent = 0, 原生DOM对应的 tag 是 HostComponent = 5
  this.key = key;
  this.elementType = null;
  this.type = null; //  不同类型(不同tag)的 fiber type 有所区别, 如果是原生 DOM 节点, 那么就是标签, 如果是函数组件则是函数组件本身
  this.stateNode = null; // 不同类型(不同tag)的 fiber 该属性不同, 对于原生DOM节点来说, 该属性是对应的DOM

  // 这些属性可以理解为 fiber 数据结构所需要的指针
  // fiber 是一个链表, 但是又区别于普通的单链表, 可以认为 fiber 链表实现了 ReactElement 中的树结构
  // 即可以实现父子节点的关系, 也可以实现兄弟节点之间的关系, 简单来说就是链表+树的结合
  // 一个 fiber 节点可能有以下指针
  this.return = null; // 指向父fiber
  this.child = null; // 指向第一个子节点
  this.sibling = null; // 指向右边的兄弟节点
  this.index = 0; // 在父节点的 children 中的索引, 在 dom-diff 时使用

  this.ref = null; // ref 这个很好理解

  // 以下属性可以理解为在 fiber 上存储的数据
  // 比如函数组件中能够实现状态就是通过这些存储的数据来实现的, 试想一下如果没有一个地方存储状态, 函数组件在运行时一切状态都会被重置
  // 所以一定有一个地方会存储这些状态, 在每次组件重新render, 也就是运行函数组件时会从状态存储的地方获取状态, 那么这些状态或者说数据就是存储在 fiber 上
  this.pendingProps = pendingProps; // 组件即将应用的属性, 也就是在组件更新时, 传递进来的新属性, react 会用此属性来重新渲染组件
  this.memoizedProps = null; // 当前组件已经应用的属性, 在组件更新时会通过 pendingProps 和 memoizedProps 来对比, 如果不相同则更新组件, 并且在更新完成后将 pendingProps 赋值给 memoizedProps
  this.updateQueue = null; // 一个对象, 其中的 shared 属性指向一个循环链表, 不同类型(不同tag)的 fiber 该指针不同, 对于函数组件来说, 这个循环链表是由 useEffect 和 useLayoutEffect 组成的 effect 循环链表
  this.memoizedState = null; // 不同类型(不同tag)的 fiber 该指针不同, 对于函数组件来说指向 hooks 链表, 每个函数组件的 hooks 会按照执行顺序加入到这个单链表中, 因此 hooks 不能在条件语句中执行否则顺序会乱
  this.dependencies = null;

  // 处理副作用
  this.flags = NoFlags; // 标识当前 fiber 节点是否有副作用需要提交, 这里的副作用指的是该节点是否需要被创建成真实 DOM 此时的 flags 是 Placement, 同样的还有更新 Update, 删除 Deletion 等等, 值得一提的是 react 在这里使用的都是二进制数, 为什么这么使用在下面会介绍
  this.subtreeFlags = NoFlags; // 后代节点是否有副作用需要提交, react 18中处理 fiber 副作用的方式和以前不同, 18 中后代节点的副作用 flags 会被合并到父节点上
  this.deletions = null; // 需要被删除的子节点

  // 优先级相关, 并发模式下, react 会优先处理高优先级的更新, 比如离散事件(用户点击, input onChange事件等)触发的更新
  this.lanes = NoLanes;
  this.childLanes = NoLanes;

  // react 使用双缓冲技术来优化 fiber 树, 当前构建的每个 fiber 节点会指向老的 fiber 也就是当前页面上渲染的界面所对应的 fiber, 一方面 diff 时可以很方便的拿到老的节点, 另一方面对于可以复用的节点, 可以直接修改属性, 节约内存空间。在 fiber 构建完成并且提交之后 currentFiber 指针会指向新的 fiber 来表示当前界面上渲染的 fiber 树
  this.alternate = null; // 新旧 fiber 会相互指向
}

const createFiber = function (tag, pendingProps, key) {
  return new FiberNode(tag, pendingProps, key);
};

export function createHostRootFiber() {
  return createFiber(HostRoot, null, null);
}
```

`createFiber` 方法会初始化 `FiberNode` 实例, `createFiber` 方法也是 `React` 中创建所有 `Fiber` 的工厂方法, 通过观察 `FiberNode` 上的实例属性, 我们可以将 `fiber` 上的属性分为几类:

**和 DOM 实例相关的属性:**

- `tag`: 不同 `ReactElement` 中的类型, 对应不同的 tag, 比如函数组件 `FunctionComponent = 0`, 原生 DOM 对应的 tag 是 `HostComponent = 5`
- `key`: 从 `ReactElement` 获取的属性, 在 `dom-diff` 时使用
- `elementType`: 标识 `ReactElement` 类型, 数据类型是 `Symbol`
- `type`: 不同 ReactElement, type 有所区别, 如果是原生 DOM 节点, 那么就是标签, 如果是函数组件则是函数组件本身
- `stateNode`: 不同类型(不同 tag)的 fiber 该属性不同, 对于原生 DOM 节点来说, 该属性是对应的 DOM

**表示数据结构的相关属性:**

- `return`: 指向父 fiber
- `child`: 指向第一个子节点
- `sibling`: 指向右边的兄弟节点
- `index`: 在父节点的 children 中的索引, 在 dom-diff 时使用
- `alternate`: react 使用双缓冲技术来优化 fiber 树, 当前构建的每个 fiber 节点会指向老的 fiber 也就是当前页面上渲染的界面所对应的 fiber, 一方面 diff 时可以很方便的拿到老的节点, 另一方面对于可以复用的节点, 可以直接修改属性, 节约内存空间。在 fiber 构建完成并且提交之后 currentFiber 指针会指向新的 fiber 来表示当前界面上渲染的 fiber 树

> fiber 是一个链表, 但是又区别于普通的单链表, 可以认为 fiber 链表实现了 ReactElement 中的树结构, 即可以实现父子节点的关系, 也可以实现兄弟节点之间的关系, 简单来说就是链表+树的结合

**用于存储数据的相关属性:**

- `pendingProps`: 组件即将应用的属性, 也就是在组件更新时, 传递进来的新属性, react 会用此属性来重新渲染组件
- `memoizedProps`: 当前组件已经应用的属性, 在组件更新时会通过 pendingProps 和 memoizedProps 来对比, 如果不相同则更新组件, 并且在更新完成后将 pendingProps 赋值给 memoizedProps
- `updateQueue`: 一个对象, 其中的 shared 属性指向一个循环链表, 不同类型(不同 tag)的 fiber 该指针不同, 对于函数组件来说, 这个循环链表是由 useEffect 和 useLayoutEffect 组成的 effect 循环链表
- `memoizedState`: 不同类型(不同 tag)的 fiber 该指针不同, 对于函数组件来说指向 hooks 链表, 每个函数组件的 hooks 会按照执行顺序加入到这个单链表中, 因此 hooks 不能在条件语句中执行否则顺序会乱

> 函数组件中能够实现状态就是通过这些存储的数据来实现的, 试想一下如果没有一个地方存储状态, 函数组件在运行时一切状态都会被重置, 所以一定有一个地方会存储这些状态, 在每次组件重新 render, 也就是运行函数组件时会从状态存储的地方获取状态, 那么这些状态或者说数据就是存储在 fiber 上

**副作用和优先级相关属性**

- `flags`: 标识当前 fiber 节点是否有副作用需要提交, 这里的副作用指的是该节点是否需要被创建成真实 DOM 此时的 flags 是 Placement, 同样的还有更新 Update, 删除 Deletion 等等, 值得一提的是 react 在这里使用的都是二进制数, 这在进行 flags 合并以及判断是否包含某个特定 flag 使用 `|` 和 `&` 会非常方便, 我会单独出一期介绍 `React` 中位运算的用法
- `subtreeFlags`: 后代节点是否有副作用需要提交, react 18 中处理 fiber 副作用的方式和以前不同, 18 中后代节点的副作用 flags 会被合并到父节点上
- `deletions`: 需要被删除的子节点
- `lanes`: 优先级, 数字越小优先级也高, 并发模式下, react 会优先处理高优先级的更新, 比如离散事件(用户点击, input onChange 事件等)触发的更新, 后面我们会讲到
- `childLanes`: 后代节点优先级

## 从 ReactElement 到 Fiber

在回到 `ReactDOMRoot` 原型上的 `render` 方法, 该方法负责将我们的组件, 也就是 `ReactElement` 渲染出来, 其中 `render` 方法调用了 `react-reconciler` 中的 `updateContainer` 函数, 在 `react-reconciler` 中 `react` 会从 `rootFiber` 出发将整个虚拟 DOM 树转换成 fiber 树

```js
import { createContainer } from "react-reconciler/src/ReactFiberReconciler";

ReactDOMRoot.prototype.render = function (children) {
  const root = this._internalRoot;
  updateContainer(children, root, null, null);
};
```

其中 `updateContainer` 的实现如下, `updateContainer` 实际上就是创建了一个 `update`, 该 `update` 的 `payload` 是 `{ element }` 也就是传入 `render` 函数的 `ReactElement`, 接着将 `update` 入队, 最后使用 `scheduleUpdateOnFiber` 在 `rootFiber` 上调度协调子 `fiber`

```js
import { createUpdate, enqueueUpdate } from "./ReactFiberClassUpdateQueue";
import { scheduleUpdateOnFiber } from "./ReactFiberWorkLoop";

export function updateContainer(element, container) {
  const current = container.current;
  const update = createUpdate();
  update.payload = { element };
  const root = enqueueUpdate(current, update);
  if (root !== null) {
    scheduleUpdateOnFiber(root, current);
  }
}
```

在 `ReactFiberClassUpdateQueue.js` 中, 更新队列的创建和入队实现为如下:

```js
export const UpdateState = 0;

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
```

最后使用 `markUpdateLaneFromFiberToRoot` 来获取 `fiberRootNode`

```js
export function markUpdateLaneFromFiberToRoot(sourceFiber) {
  let node = sourceFiber;
  let parent = sourceFiber.return;
  while (parent !== null) {
    node = parent;
    parent = parent.return;
  }
  if (node.tag === HostRoot) {
    const root = node.stateNode;
    return root;
  }
  return null;
}
```

在入队更新之后, 会调用 `scheduleUpdateOnFiber(root, current)` 函数来调度协调 fiber 树,

```js
// react-reconciler/src/ReactFiberWorkLoop.js
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

function performConcurrentWorkOnRoot(root) {
  // TODO: 这里先使用 sync render, 在 react 中如果低更新超时会使用 sync render 否则会使用 concurrent render
  renderRootSync(root);

  const finishedWork = root.current.alternate;
  root.finishedWork = finishedWork;
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
```

其中的 `Scheduler_scheduleCallback` 函数涉及到 `scheduler` 包中的内容, 后面会单独讲, 简单来说就是将 `Scheduler_scheduleCallback(callback)` 中的 `callback` 添加到宏任务队列, 具体的调度逻辑会在后面的内容中介绍。在这里也就是说下一次的调度中会执行 `performConcurrentWorkOnRoot.bind(null, root)` 这个函数。

`performConcurrentWorkOnRoot` 在同步模式下会调用 `renderRootSync`, 在 `reconcile` 阶段并发和同步模式下的逻辑类似, 只不过并发模式可以中断, 这里先按照同步模式来梳理逻辑, 后面会讲到并发模式下的 `reconcile`。接着会调用 `prepareFreshStack` 函数从 `fiberRootNode` 中拿到 `rootFiber` 并根据 `rootFiber` 创建一个 `workInProgress fiber`, `workInProgress` 标识当前正在构建的 `fiber`, 它从 `createWorkInProgress(current, pendingProps)` 中创建

```js
/**
 * 根据当前页面中正在渲染的 fiber, 构建新的 fiber, 比如一次 setState 调用之后需要更新
 * 那么 current 就是旧的 fiber, pendingProps 时这次更新所带来的新的组件属性
 * @param {Fiber} current 当前页面中渲染的 fiber
 * @param {*} pendingProps 最新的 props
 * @returns
 */
export function createWorkInProgress(current, pendingProps) {
  // 这里使用双缓冲, 因为最多只需要两个版本的树, 一个是正在浏览器中渲染的 fiber 树, 一个是正在构建的 fiber 树
  // 双缓冲的好处在于可以避免分配额外对象, 还能够在需要时额外回收他们
  let workInProgress = current.alternate; // 试图去使用 current fiber 的 alternate 对象
  if (workInProgress === null) {
    // 页面在初次挂载时 current.alternate 为 null, 所以需要根据 current fiber 创建一个 workInProgress fiber
    workInProgress = createFiber(current.tag, pendingProps, current.key);
    workInProgress.type = current.type;
    workInProgress.stateNode = current.stateNode;
    // 创建完成之后 alternate 指针相互指向
    workInProgress.alternate = current;
    current.alternate = workInProgress;
  } else {
    // 如果 current.alternate 有值, 说明不是初次挂载而是更新, 那么直接复用 alternate 对象, 修改相关属性即可
    // 也就是使用双缓冲的好处之一避免分配额外对象
    workInProgress.pendingProps = pendingProps;
    workInProgress.type = current.type;
    workInProgress.flags = NoFlags;
    workInProgress.subtreeFlags = NoFlags;
  }
  workInProgress.child = current.child;
  workInProgress.memoizedProps = current.memoizedProps;
  workInProgress.memoizedState = current.memoizedState;
  workInProgress.updateQueue = current.updateQueue;
  workInProgress.sibling = current.sibling;
  workInProgress.index = current.index;
  return workInProgress;
}
```

初次挂载时会根据传入的 `current fiber` 使用 `createFiber()` 函数创建一个 `fiber`, 并使用 `alternate` 指针相互引用。

再回到 `src/react-reconciler/src/ReactFiberWorkLoop.js` 这个文件中会定义一个 `workInProgress` 变量, 再在创建完成 `workInProgress` 之后, 会将创建的 workInProgress 赋值给 `workInProgress` 变量, 并且通过 `workLoopSync` 这个循环不停地执行 `performUnitOfWork(workInProgress)` 函数来协调 `workInProgress` 的 `children` 也就是根据 `children` 这个 `ReactElement` 来构建 `fiber` 树。

```js
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
```

在 `react-reconciler/src/ReactFiberBeginWork.js` 中 `beginWork` 会根据 `workInProgress` 的 `tag` 属性来分别处理不同 `fiber` 节点 `children` 的协调:

```js
// react-reconciler/src/ReactFiberBeginWork.js

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
    // 如果没有老的 fiber, 说明当前这个 nextChildren 是新加入进来的
    workInProgress.child = mountChildFibers(workInProgress, null, nextChildren);
  } else {
    // 如果有老的 fiber, 在协调 rootFiber 时一定是走这儿
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
```

这里处理了 `HostRoot` 和 `HostComponent` 的情况, 即根 `fiber` 和原生节点, 在执行 `updateHostRoot()` 时会执行 `processUpdateQueue` 来依次处理 `fiber.updateQueue` 中的 `update`, 也就是从 `update.shared.pending.next` 出发, 遍历整个链表合并 `update.payload`, 最终会将合并后的 `newState` 赋值给 `workInProgress.memoizedState`, 所以 `rootFiber.memoizedState` 就是 `{ element }` 对象, 其中的 `element` 是 `reactDOMRoot.render` 方法执行传入的 `ReactElement`

最后会调用 `reconcileChildren(current, workInProgress, nextChildren)` 方法来最终协调 `rootFiber` 的子节点, 其中这个 `nextChildren` 就是 `rootFiber.memoizedState.element`, `reconcileChildren` 会走第二个分支, 因为当前 `rootFiber.current` 是存在的, 所以最终会执行 `reconcileChildFibers` 函数来协调 `children`, `reconcileChildFibers` 会返回协调完成的第一个 child 对应的 `fiber`, 并将 `workInProgress.child` 指向第一个子 `fiber`

```js
// react-reconciler/src/ReactChildFiber.js
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
```

在 `reconcileChildFibers` 函数中会根据 `newChild` 这个 `ReactElement` 的类型分别进行处理, 如果是一个单节点的话会走 `reconcileSingleElement`, 在这个函数中通过 `createFiberFromElement` 方法来创建 `fiber`

```js
// react-reconciler/src/ReactFiber.js

export function createFiberFromElement(element) {
  const { type, key } = element;
  const pendingProps = element.props;
  const fiber = createFiberFromTypeAndProps(type, key, pendingProps);
  return fiber;
}

export function createFiberFromTypeAndProps(type, key, pendingProps) {
  let fiberTag = IndeterminateComponent;
  if (typeof type === "function") {
    if (shouldConstruct(type)) {
      fiberTag = ClassComponent;
    }
  } else if (typeof type === "string") {
    fiberTag = HostComponent;
  } else {
    getTag: switch (type) {
      case REACT_FRAGMENT_TYPE:
        return createFiberFromFragment(pendingProps.children, key);
      // ... 根据 type 创建对应的 fiber, 这里省略其他类型

      default: {
        if (typeof type === "object" && type !== null) {
          switch (type.$$typeof) {
            case REACT_PROVIDER_TYPE:
              fiberTag = ContextProvider;
              break getTag;
            // ... 根据 $$typeof 属性确定 fiber 的 tag, 这里省略其他情况
          }
        }
      }
    }
  }

  const fiber = createFiber(fiberTag, pendingProps, key);
  fiber.elementType = type;
  fiber.type = type;

  return fiber;
}
```

在创建 `fiber` 的过程中会根据 `ReactElement` 的 `type` 来确定 `fiber.tag` 的值, 最终还是通过 `createFiber` 这个工厂方法来创建 `fiber`。在单节点的虚拟 `DOM` 创建完成 `fiber` 之后会把 `fiber.return` 指针指向父 `fiber`, 处理单节点时最后会执行 `placeSingleChild` 方法将 `fiber.flags` 打上 `Placement` 的标记, 也就是说该 `fiber` 上有 `DOM` 节点需要被添加, 在 `commit` 提交阶段会将这个 `DOM` 添加到父容器上

如果 `newChild` 是一个数组的话会执行 `reconcileChildrenArray` 来构建子 `fiber`, 在 `reconcileChildrenArray` 中会根据 `newChild` 这个虚拟`DOM`数组中的子元素来分别创建 `fiber`, 并将创建的 `fiber.return` 指向父 `fiber`, 并且将 `fiber.sibling` 指向右兄弟节点, 并且将 `fiber.flags` 打上 `Placement` 的标记。

至此, `beginWork` 协调完成当前 `workInProgress` 的子 `fiber` 之后, 会返回第一个子 `fiber` 如果第一个子 `fiber` 存在的话会将这个 `childFiber` 赋值给 `workInProgress`, 接着在 `workLoopSync` 中再去协调 `childFiber` 的后代节点, 直到有一个 `fiber` 没有后代节点时会执行 `completeUnitOfWork(unitOfWork)` 来完成这个 `fiber`

```js
// react-reconciler/src/ReactFiberCompleteWork.js

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
```

在 `completeWork` 中会执行 `bubbleProperties(workInProgress)` 根据 `fiber.tag` 处理不同的逻辑, 其中对于 `rootFiber` 的话会将后代节点的 `flags` 合并到自己的 `subtreeFlags` 上。

如果是原生节点的话会执行 `createInstance(type, newProps, workInProgress)` 来创建实例, 并且执行 `appendAllChildren(instance, workInProgress)` 方法将子 `fiber` 的 `DOM` 实例挂载到新创建的实例上, 在处理 `appendAllChildren` 时需要处理 `fiber` 是一个函数组件的情况, 需要向下找 `child` 属性直到找到原生 `DOM` 节点然后 `append` 到新创建的父 `DOM` 节点

```js
// react-reconciler/src/ReactFiberCompleteWork.js
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
```

在创建 `DOM` 时本质上是通过, `document.createElement` 来创建的:

```js
// react-dom/src/client/ReactDOMHostConfig.js
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
```

最后将 `workInProgress.stateNode` 设置为创建的 `DOM` 实例, 再根据 `props` 来设置 `DOM` 上的属性即可

在完成当前的工作单元 `workInProgress` 之后, 会去判断 `workInProgress` 是否有 `sibling` 如果有的话将 `workInProgress` 设置为 `workInProgress.sibling` 接着再去协调新的 `workInProgress` 的 `children`。如果`workInProgress`没有 `sibling` 那么会执行 `completeWork(returnFiber)` 完成父 `fiber` 也就是创建父 `fiber` 的 `DOM` 实例, 并将父 `fiber` 下子 `fiber` 的 `DOM` 实例挂载到父 `fiber` 所对应的 `DOM` 实例上

这样当 `workLoopSync` 执行完毕之后, 整个 `fiber` 树也就构建好了, 此时 `rootFiber.child` 也就指向了从 `ReactElement` 生成的 `fiber` 树中的第一个子 `fiber`, 并且他们的实例都已经创建完成, 并且`DOM` 属性都已经设置正确。

## 从 Fiber 到浏览器绘制

`React` 主要分为两个阶段 `Rendering` 和 `commit` 也就是 `React的渲染阶段` 和 `提交阶段`, 其中 `Rendering` 也可称为 `Reconciliation` 协调阶段, 也就是运行组件, 通过 `ReactElement` 生成 `fiber`, 并且协调 `children` 生成子 `fiber` 最终生成整棵 `fiber` 树, 上面我们已经完成了整个 `Reconciliation` 阶段, 接下来需要 `commit` 也就是将生成的 `DOM` 插入到 `root` 容器中(初次挂载)

在 `performConcurrentWorkOnRoot` 方法中我们会执行 `finishConcurrentRender` 方法来进行 `commit`

```js
// react-reconciler/src/ReactFiberWorkLoop.js
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
```

最终 `commitMutationEffects` 会调用 `commitMutationEffectsOnFiber` 来提交

```js
// react-reconciler/src/ReactFiberCommitWork.js
import { HostRoot, HostComponent, HostText } from "./ReactWorkTags";
import { MutationMask, Placement } from "./ReactFiberFlags";
import { insertBefore, appendChild } from "./ReactFiberHostConfig";

export function commitMutationEffects(root, finishedWork) {
  commitMutationEffectsOnFiber(finishedWork, root);
}

function recursivelyTraverseMutationEffects(root, parentFiber) {
  if (parentFiber.subtreeFlags & MutationMask) {
    let { child } = parentFiber;
    while (child !== null) {
      commitMutationEffectsOnFiber(child, root);
      child = child.sibling;
    }
  }
}

function isHostParent(fiber) {
  return fiber.tag === HostComponent || fiber.tag === HostRoot;
}

function getHostParentFiber(fiber) {
  let parent = fiber.return;
  while (parent !== null) {
    if (isHostParent(parent)) {
      return parent;
    }
    parent = parent.return;
  }
  return parent;
}

function insertOrAppendPlacementNode(node, before, parent) {
  const { tag } = node;
  const isHost = tag === HostComponent || tag === HostText;
  if (isHost) {
    const { stateNode } = node;
    if (before) {
      insertBefore(parent, stateNode, before);
    } else {
      appendChild(parent, stateNode);
    }
  } else {
    const { child } = node;
    if (child !== null) {
      insertOrAppendPlacementNode(child, before, parent);
      let { sibling } = child;
      while (sibling !== null) {
        insertOrAppendPlacementNode(sibling, before, parent);
        sibling = sibling.sibling;
      }
    }
  }
}

function getHostSibling(fiber) {
  let node = fiber;
  siblings: while (true) {
    while (node.sibling === null) {
      if (node.return === null || isHostParent(node.return)) {
        return null;
      }
      node = node.return;
    }
    node.sibling.return = node.return;
    node = node.sibling;
    while (node.tag !== HostComponent && node.tag !== HostText) {
      if (node.flags & Placement) {
        continue siblings;
      } else {
        node.child.return = node;
        node = node.child;
      }
    }
    // Check if this host node is stable or about to be placed.
    if (!(node.flags & Placement)) {
      return node.stateNode;
    }
  }
}

function commitPlacement(finishedWork) {
  const parentFiber = getHostParentFiber(finishedWork);

  switch (parentFiber.tag) {
    case HostComponent: {
      const parent = parentFiber.stateNode;
      const before = getHostSibling(finishedWork);
      insertOrAppendPlacementNode(finishedWork, before, parent);
      break;
    }
    case HostRoot: {
      const parent = parentFiber.stateNode.containerInfo;
      const before = getHostSibling(finishedWork);
      insertOrAppendPlacementNode(finishedWork, before, parent);
      break;
    }
    default:
      break;
  }
}

function commitReconciliationEffects(finishedWork) {
  const { flags } = finishedWork;
  if (flags & Placement) {
    commitPlacement(finishedWork);
    finishedWork.flags &= ~Placement;
  }
}

export function commitMutationEffectsOnFiber(finishedWork, root) {
  switch (finishedWork.tag) {
    case HostRoot:
    case HostComponent:
    case HostText: {
      recursivelyTraverseMutationEffects(root, finishedWork);
      commitReconciliationEffects(finishedWork);
      break;
    }
    default: {
      break;
    }
  }
}
```

可以看到整个提交的过程其实就是深度优先提交每一个 `fiber`, 如果 `flag.Placement` 有值那么就通过 `commitPlacement()` 来进行提交, 在初次挂载阶段只有 `rootFiber.child` 的 `flags` 是 `Placement` 因为前面协调子 `fiber` 时除了 `rootFiber` 走的都是 `mountChildFibers`, 所以这里其实只需要将 `rootFiber.child` 对应的 `DOM append` 到根容器上即可, 即调用 `appendChild` 这个原生 DOM api 添加节点即可

至此初次节点的挂载的 `commit` 阶段已经完成, 接着交给浏览器进行绘制, 这样整个 DOM 就渲染出来了

> 仓库的代码在 [react-deconstruct](https://github.com/alyzhao/react-deconstruct) 这儿, 后续会持续对照 `react` 源码实现功能, 并且丰富文档中的图表, 欢迎点个 star!
