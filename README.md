## 解构 react

在阅读 `react 18.3` 源码的过程中, 我想着能够出一系列的文档和代码实践, 能够帮助自己梳理 `react` 核心逻辑, 并且能够帮助那些想要了解 `react` 原理的朋友理解 `react` 的实现原理

每一次的提交会对应一份文档, 文档还在整理中, 可以根据 `commit message` 阅读对应的文档

> 该工程在实现了 `react` 的核心逻辑的基础上, 会持续地补充一些容错处理, 更多 Api 的实现, 并且在持续更新中, 对于更详细的文档也在整理中

### 运行

安装依赖:

```bash
npm install
```

本地调试:

```bash
npm run dev
```

打开浏览器的 `http://localhost:5173/`

**enjoy!🥳**

### 阅读指南

在阅读文档的过程中, 可以通过 `git log` 找到和文档同名的 `commit` 并且切换到该 `commit` 从而调试代码

- [解构 React Fiber](./articles/解构React%20Fiber.md), 完成 `Rendering` 阶段也就是 `fiber` 树的构建, 并且完成 `commit` 阶段将 `fiber` 树中的 `DOM` 插入到根容器中, 从而完成第一次挂载
