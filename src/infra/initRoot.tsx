import { Root, createRoot } from 'react-dom/client';
import sdk from '../utils/sdk';

const createAppContainer = () => {
  const container = document.createElement('div');
  container.id = 'app';
  Object.assign(container.style, {
    width: '100%',
    height: '100%',
  });
  return container;
};

const setBodyStyles = () => {
  if (!document.body) {
    console.warn('document.body is not available yet');
    return false;
  }
  Object.assign(document.body.style, {
    color: 'var(--semi-color-text-0)',
    backgroundColor: 'transparent',
  });
  return true;
};

const checkBodyReady = () =>
  new Promise((resolve) => {
    let ready = false;
    while (!ready) {
      console.log(document.readyState, !!document.body);
      if (
        ['complete', 'interactive'].includes(document.readyState) &&
        document.body
      ) {
        ready = true;
      }
    }
    resolve(true);
  });

const container = createAppContainer();
let root: Root | null = null;

const initRoot = async () => {
  try {
    console.log('start checkBodyReady');
    await checkBodyReady();
    console.log('start setBodyStyles');
    if (!setBodyStyles()) {
      // 如果第一次失败，等待一小段时间重试
      await new Promise((resolve) => setTimeout(resolve, 100));
      setBodyStyles();
    }
    document.body.appendChild(container);
    if (!root) {
      root = createRoot(container);
    }
    await sdk.utils.overwriteThemeForSemiUI();
    const ctx = await sdk.Context.load();
    document.body.setAttribute('theme-mode', ctx?.colorScheme || 'light');
    console.log('root is ready');
    return root;
  } catch (error) {
    console.error('Initialization failed:', error);
    throw error;
  }
};

export { container };

export default initRoot;
