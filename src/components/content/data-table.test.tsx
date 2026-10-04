import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { DataTable } from './data-table';

describe('DataTable', () => {
  it('keeps configured table and column widths while the first column is sticky by default', () => {
    const markup = renderToStaticMarkup(
      <DataTable
        tableClassName="min-w-[70rem] table-fixed"
        rowHeader
        columns={[
          { label: 'Input type', width: '10rem' },
          { label: 'Purpose', width: '16rem' },
          { label: 'Desktop', width: '22rem' },
          { label: 'Mobile', width: '22rem' },
        ]}
        rows={[[
          'Primary inputs',
          'Frequently adjusted values',
          'Main tool area',
          'Main tool area',
        ]]}
      />,
    );

    expect(markup).toContain('overflow-x-auto');
    expect(markup).toContain('min-w-[70rem]');
    expect(markup).toContain('table-fixed');
    expect(markup).not.toContain('data-sticky-first-column="false"');
    expect(markup).toContain('<th scope="row"');
    expect(markup).toContain('style="width:10rem"');
    expect(markup).toContain('style="width:16rem"');
    expect(markup).toContain('style="width:22rem"');
  });

  it('keeps default table sizing when no custom widths are provided', () => {
    const markup = renderToStaticMarkup(
      <DataTable columns={['Input type']} rows={[['Primary inputs']]} />,
    );

    expect(markup).toContain('class="min-w-full text-left text-sm"');
    expect(markup).not.toContain('<colgroup>');
    expect(markup).not.toContain('data-sticky-first-column="false"');
  });

  it('supports explicitly disabling the shared sticky first column', () => {
    const markup = renderToStaticMarkup(
      <DataTable stickyFirstColumn={false} columns={['Input type']} rows={[]} />,
    );

    expect(markup).toContain('data-sticky-first-column="false"');
    expect(markup).toContain('colSpan="1"');
  });

  it('keeps an empty multi-column message spanning the full table', () => {
    const markup = renderToStaticMarkup(
      <DataTable columns={['Input type', 'Purpose']} rows={[]} />,
    );

    expect(markup).toContain('colSpan="2"');
    expect(markup).not.toContain('data-sticky-first-column="false"');
  });
});
