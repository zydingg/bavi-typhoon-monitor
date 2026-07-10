import { render, screen } from '@testing-library/react';
import { test, expect } from 'vitest';
import { App } from './App.js';

test('labels an empty response as no active typhoon', () => {
  render(
    <App
      initialSnapshot={{
        status: 'empty',
        selected: null,
        storms: [],
        source: 'Zhejiang Typhoon Portal',
      }}
    />,
  );

  expect(screen.getByText('当前暂无活动台风')).toBeTruthy();
});
