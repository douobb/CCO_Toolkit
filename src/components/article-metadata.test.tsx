import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import {
  ArticleMetadata,
  isArticleMetadataContentPath,
} from './article-metadata';

const zhLabels = {
  author: '作者',
  published: '發布日期',
  updated: '更新日期',
};

const enLabels = {
  author: 'Author',
  published: 'Published',
  updated: 'Updated',
};

describe('ArticleMetadata', () => {
  it('完整顯示作者、發布日期與更新日期，並保留 ISO dateTime', () => {
    const markup = renderToStaticMarkup(
      <ArticleMetadata
        author="Synthetic Author"
        date="2042-02-03"
        updated={new Date('2042-02-05T00:00:00.000Z')}
        locale="zh-tw"
        labels={zhLabels}
      />,
    );

    expect(markup).toContain('data-article-metadata=""');
    expect(markup).toContain('作者');
    expect(markup).toContain('Synthetic Author');
    expect(markup).toContain('發布日期');
    expect(markup).toContain('更新日期');
    expect(markup).toContain('dateTime="2042-02-03"');
    expect(markup).toContain('dateTime="2042-02-05"');
    expect(markup).toContain('2042年2月3日');
    expect(markup).toContain('2042年2月5日');
  });

  it.each([
    ['author', { date: '2042-02-03', updated: '2042-02-05' }, '作者'],
    ['date', { author: 'Synthetic Author', updated: '2042-02-05' }, '發布日期'],
    ['updated', { author: 'Synthetic Author', date: '2042-02-03' }, '更新日期'],
  ] as const)('author、date、updated 可各自省略（缺少 %s）', (_missing, props, absentLabel) => {
    const markup = renderToStaticMarkup(
      <ArticleMetadata
        {...props}
        locale="zh-tw"
        labels={zhLabels}
      />,
    );

    expect(markup).toContain('data-article-metadata=""');
    expect(markup).not.toContain(absentLabel);
  });

  it('所有欄位缺省時 render null', () => {
    expect(
      renderToStaticMarkup(
        <ArticleMetadata locale="zh-tw" labels={zhLabels} />,
      ),
    ).toBe('');
  });

  it('依 locale 顯示自然繁中與英文日期', () => {
    const zhMarkup = renderToStaticMarkup(
      <ArticleMetadata date="2042-03-04" locale="zh-tw" labels={zhLabels} />,
    );
    const enMarkup = renderToStaticMarkup(
      <ArticleMetadata date="2042-03-04" locale="en" labels={enLabels} />,
    );

    expect(zhMarkup).toContain('2042年3月4日');
    expect(enMarkup).toContain('March 4, 2042');
    expect(zhMarkup).toContain('dateTime="2042-03-04"');
    expect(enMarkup).toContain('dateTime="2042-03-04"');
  });

  it.each([
    [['guides'], true],
    [['guides', 'index'], true],
    [['tools'], true],
    [['tools', 'search-reward'], true],
    [['tools', 'helper-overview'], true],
    [['blog', 'website'], false],
    [['about', 'contributing'], false],
    [['recommendations'], false],
    [['other', 'page'], false],
    [[], false],
  ] as const)('依內容區段判定是否顯示文章 metadata：%j', (slugs, expected) => {
    expect(isArticleMetadataContentPath(slugs)).toBe(expected);
  });
});
