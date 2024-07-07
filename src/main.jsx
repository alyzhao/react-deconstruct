import { createRoot } from 'react-dom/client';

function Counter(props) {
  const decrease = () => {};
  const increase = () => {};
  return (
    <div>
      <button onClick={decrease}>-</button>
      <input value={props.value} placeholder="value"></input>
      <button onClick={increase}>+</button>
    </div>
  );
}

const worldRef = {}

const App = (
  <h1 title="hello world">
    hello <span style={{ color: "cyan" }} className="barClass" key="word" ref={worldRef}>world</span>
  </h1>
);

const root = createRoot(document.getElementById('root'));

root.render(App);
