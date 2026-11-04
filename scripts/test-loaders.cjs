const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const { clsx } = require('clsx');
const { twMerge } = require('tailwind-merge');
const root = path.resolve(__dirname, '..');

// Render the actual components without requiring a browser or contacting the backend.
function loadComponent(file, overrides = {}) {
  const source = fs.readFileSync(path.join(root, file), 'utf8');
  const js = ts.transpileModule(source, { compilerOptions: {
    jsx: ts.JsxEmit.React, module: ts.ModuleKind.CommonJS,
    esModuleInterop: true, target: ts.ScriptTarget.ES2020,
  }}).outputText;
  const module = { exports: {} };
  vm.runInNewContext(js, { module, exports: module.exports, require: id => {
    if (id.endsWith('.css')) return {};
    if (id === '@/lib/utils') return { cn: (...values) => twMerge(clsx(values)) };
    return overrides[id] || require(id);
  }});
  return module.exports;
}
const shared = loadComponent('src/components/ui/SerkleLoader.tsx');
const legacy = loadComponent('src/components/ui/VideoLoader.tsx', { './SerkleLoader': shared });
const render = (component, props) => renderToStaticMarkup(React.createElement(component, props));

test('wordmark has six ordered letters and one accessible status label', () => {
  const html = render(shared.SerkleLoader, { label: 'Uploading file', showText: true });
  assert.match(html, /role="status"/);
  assert.match(html, /aria-label="Uploading file"/);
  assert.equal((html.match(/class="serkle-loader__letter"/g) || []).length, 6);
  assert.equal([...html.matchAll(/--letter-index:\d">(\w)<\/span>/g)].map(m => m[1]).join(''), 'SERKLE');
  assert.match(html, /aria-hidden="true"/);
  assert.doesNotMatch(html, /<video|<img/);
});
test('all sizes, resting state and caller colors are supported', () => {
  for (const size of ['xs','sm','md','lg','xl']) assert.match(render(shared.SerkleLoader, {size}), new RegExp(`serkle-loader--${size}`));
  const html = render(shared.SerkleLoader, {pulse:false, className:'text-current'});
  assert.match(html, /serkle-loader--still/);
  assert.match(html, /text-current/);
  assert.doesNotMatch(html, /text-primary/);
});
test('legacy media and button loaders render wordmarks without video downloads', () => {
  const html = render(legacy.VideoLoader, {dark:true, fullscreen:true, label:'Buffering', sublabel:'Please wait'});
  assert.match(html, /aria-label="Buffering"/);
  assert.match(html, /fixed inset-0/);
  assert.match(html, /Please wait/);
  assert.doesNotMatch(html, /<video|loading-animation.mp4/);
  assert.match(render(legacy.InlineVideoLoader, {}), /serkle-loader--xs/);
});
test('reduced motion disables letter movement, using only opacity and transforms otherwise', () => {
  const css = fs.readFileSync(path.join(root, 'src/components/ui/SerkleLoader.css'), 'utf8');
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)[\s\S]*animation: none/);
  assert.match(css, /animation-delay: calc\(var\(--letter-index\) \* 90ms\)/);
  assert.doesNotMatch(css, /filter:|box-shadow:|background-position:/);
});

// Mock data boundaries, not StoriesBar itself: exercise its actual rendering branches.
const sampleUser = { id: 'self', name: 'Test User', initials: 'TU', avatarColor: '#713a20' };
const peerUser = { id: 'peer', name: 'Sample Friend', initials: 'SF', avatarColor: '#713a20' };
const ownPlaceholder = { id: 'own-placeholder', user: sampleUser, image: '', isOwn: true };
const peerStory = { id: 'peer-story', user: peerUser, image: '/test-story.jpg', isOwn: false };
const peerGroup = { ...peerStory, allStories: [peerStory] };
function storyHarness(stories, loading = false, authLoading = false) {
  let cursor = 0;
  const state = [];
  const noOp = () => null;
  const passThrough = ({children}) => React.createElement('div', null, children);
  const Viewer = () => null;
  const Creator = () => null;
  const component = loadComponent('src/components/StoriesBar.tsx', {
    react: {...React, useState: initial => {
      const index = cursor++;
      if (!(index in state)) state[index] = initial;
      return [state[index], next => {state[index] = next;}];
    }},
    '@/components/ui/SerkleLoader': shared,
    '@/contexts/UserContext': {useUser: () => ({user: sampleUser, isLoading: authLoading})},
    '@/hooks/useStoryPersistence': {useStoryPersistence: () => [stories, noOp, loading, noOp]},
    '@/contexts/NavigationContext': {useNavigation: () => ({pushModalState: noOp})},
    '@/components/ui/avatar': {Avatar: passThrough, AvatarFallback: passThrough, AvatarImage: noOp},
    './story/StoryErrorBoundary': {StoryErrorBoundary: passThrough},
    './StoryViewer': Viewer, './CreateStoryModal': Creator, './live/WebRTCLiveViewer': noOp,
  }).default;
  const draw = () => {cursor = 0; return component({});};
  return {draw, Viewer, Creator};
}
function elements(tree) {
  if (!React.isValidElement(tree)) return [];
  return [tree, ...React.Children.toArray(tree.props.children).flatMap(elements)];
}
test('stories show a loader only while the initial empty request is pending', () => {
  for (const [loading, authLoading] of [[true,false],[false,true]]) {
    const html = renderToStaticMarkup(storyHarness([], loading, authLoading).draw());
    assert.match(html, /aria-label="Loading stories"/);
  }
  assert.doesNotMatch(renderToStaticMarkup(storyHarness([], false).draw()), /Loading stories/);
});
test('loaded stories and the add-story tile replace the loader, also during refresh', () => {
  for (const loading of [false, true]) {
    const html = renderToStaticMarkup(storyHarness([ownPlaceholder, peerGroup], loading).draw());
    assert.match(html, /aria-label="Add your story"/);
    assert.match(html, /aria-label="View Sample Friend&#x27;s story"/);
    assert.match(html, /Sample/);
    assert.doesNotMatch(html, /Loading stories/);
  }
});
test('story click opens the viewer with fetched stories; own empty tile opens creation', () => {
  const harness = storyHarness([ownPlaceholder, peerGroup]);
  let nodes = elements(harness.draw());
  nodes.find(n => n.props['aria-label'] === "View Sample Friend's story").props.onClick();
  nodes = elements(harness.draw());
  const viewer = nodes.find(n => n.type === harness.Viewer);
  assert.equal(viewer.props.isOpen, true);
  assert.equal(viewer.props.stories[0].id, peerStory.id);
  assert.equal(viewer.props.initialIndex, 0);
  nodes.find(n => n.props['aria-label'] === 'Add your story').props.onKeyDown({key:'Enter', preventDefault: () => {}});
  assert.equal(elements(harness.draw()).find(n => n.type === harness.Creator).props.isOpen, true);
});
