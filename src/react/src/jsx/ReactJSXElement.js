import hasOwnProperty from 'shared/hasOwnProperty';
import { REACT_ELEMENT_TYPE } from 'shared/ReactSymbols';

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

export function jsxDEV(type, config, maybeKey) {
  let propName;

  const props = {};

  let key = null;
  let ref = null;

  if (maybeKey !== undefined) {
    key = '' + maybeKey;
  }

  if (hasValidateKey(config)) {
    key = '' + config.key;
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

  return ReactElement(
    type, key, ref, props,
  );
}
