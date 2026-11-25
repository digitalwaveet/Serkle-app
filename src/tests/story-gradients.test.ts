import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  DEFAULT_STORY_GRADIENT,
  STORY_GRADIENTS,
  findStoryGradientByCss,
  gradientLineForAngle,
} from '../lib/storyGradients.ts';

test('story gradient presets provide multiple unique gradients with valid CSS', () => {
  assert.ok(STORY_GRADIENTS.length >= 8);
  const ids = new Set(STORY_GRADIENTS.map((g) => g.id));
  const cssValues = new Set(STORY_GRADIENTS.map((g) => g.css));
  assert.equal(ids.size, STORY_GRADIENTS.length);
  assert.equal(cssValues.size, STORY_GRADIENTS.length);

  for (const gradient of STORY_GRADIENTS) {
    assert.ok(gradient.name.trim().length > 0);
    assert.ok(gradient.stops.length >= 2);
    assert.match(gradient.css, /^linear-gradient\(\d+deg,/);
    assert.equal(findStoryGradientByCss(gradient.css), gradient);
  }
  assert.equal(DEFAULT_STORY_GRADIENT, STORY_GRADIENTS[0]);
  assert.equal(findStoryGradientByCss('unknown'), undefined);
  assert.equal(findStoryGradientByCss(undefined), undefined);
});

test('gradientLineForAngle matches standard CSS linear-gradient directions', () => {
  const toTop = gradientLineForAngle(0, 1080, 1920);
  assert.ok(Math.abs(toTop.x0 - 540) < 1e-6);
  assert.ok(Math.abs(toTop.y0 - 1920) < 1e-6);
  assert.ok(Math.abs(toTop.x1 - 540) < 1e-6);
  assert.ok(Math.abs(toTop.y1 - 0) < 1e-6);

  const toRight = gradientLineForAngle(90, 1080, 1920);
  assert.ok(Math.abs(toRight.x0 - 0) < 1e-6);
  assert.ok(Math.abs(toRight.y0 - 960) < 1e-6);
  assert.ok(Math.abs(toRight.x1 - 1080) < 1e-6);
  assert.ok(Math.abs(toRight.y1 - 960) < 1e-6);

  const diag = gradientLineForAngle(135, 1080, 1920);
  assert.ok(diag.x0 < 540 && diag.y0 < 960);
  assert.ok(diag.x1 > 540 && diag.y1 > 960);
});
