import { HostRoot } from "./ReactWorkTags";
import { NoFlags } from "./ReactFiberFlags";
import { NoLanes } from "./ReactFiberLane";
import {
  IndeterminateComponent,
  ClassComponent,
  HostComponent,
  ContextProvider,
  Fragment,
  HostText,
} from "./ReactWorkTags";

function FiberNode(tag, pendingProps, key) {
  // 实例属性, 可以理解为从 ReactElement 转换成 Fiber 时, 会将 ReactElement 中的属性赋值给 fiber 实例
  this.tag = tag; // 不同 ReactElement 中的类型, 对应不同的 tag, 比如函数组件 FunctionComponent = 0, 原生DOM对应的 tag 是 HostComponent = 5
  this.key = key;
  this.elementType = null; // 直接复制 ReactElement.type 到了此属性
  this.type = null; // 通常情况下和 elementType 相同
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
  this.updateQueue = null; // 一个对象, 其中的 shared.pending 属性指向一个循环链表, 不同类型(不同tag)的 fiber 该指针不同, 对于函数组件来说, 这个循环链表是由 useEffect 和 useLayoutEffect 组成的 effect 循环链表
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

/**
 * 判断是否是类组件
 * @param {Function} Component
 * @returns
 */
function shouldConstruct(Component) {
  const prototype = Component.prototype;
  return !!(prototype && prototype.isReactComponent);
}

export function createFiberFromFragment(elements, key) {
  const fiber = createFiber(Fragment, elements, key);
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

export function createFiberFromElement(element) {
  const { type, key } = element;
  const pendingProps = element.props;
  const fiber = createFiberFromTypeAndProps(type, key, pendingProps);
  return fiber;
}

export function createFiberFromText(content) {
  const fiber = createFiber(HostText, content, null);
  return fiber;
}
