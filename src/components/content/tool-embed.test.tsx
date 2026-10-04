import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { ToolEmbed } from './tool-embed';

const linkClassName =
  'not-prose block rounded-xl no-underline hover:no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fd-ring focus-visible:ring-offset-2';
const titleClassName =
  'mt-2 text-lg font-semibold tracking-tight group-hover:underline group-hover:underline-offset-4';

describe('ToolEmbed', () => {
  it('internal Link 退出 prose 連結樣式並保留標題 hover 底線', () => {
    const markup = renderToStaticMarkup(
      <ToolEmbed href="/tools/example" title="Example Tool" />,
    );

    expect(markup).toContain(`class="${linkClassName}"`);
    expect(markup).toContain(`class="${titleClassName}"`);
    expect(markup).not.toContain('target="_blank"');
    expect(markup).not.toContain('rel="noreferrer noopener"');
  });

  it('external a 使用相同根節點 class 並保留 target/rel 行為', () => {
    const markup = renderToStaticMarkup(
      <ToolEmbed href="https://example.com/tool" title="Example Tool" />,
    );

    expect(markup).toContain(`class="${linkClassName}"`);
    expect(markup).toContain(`class="${titleClassName}"`);
    expect(markup).toContain('target="_blank"');
    expect(markup).toContain('rel="noreferrer noopener"');
  });
});
