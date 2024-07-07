export function setValueForStyles(node, styles) {
  const style = node.style;
  for (let styleName in styles) {
    if (!styles.hasOwnProperty(styleName)) {
      continue;
    }
    // 这里 react 会根据 styleName 在需要主动加上 'px' 的地方自动加上 'px', 比如 width: 100, 会被转成 width: '100px', 这也是为什么我们能直接使用 width: 100 的原因, 说实话这点比 vue 方便
    // 这里省略这个逻辑直接取 styleValue
    const styleValue = styles[styleName];
    style[styleName] = styleValue;
  }
}
