import defaultMdxComponents from 'fumadocs-ui/mdx';
import type { MDXComponents } from 'mdx/types';
import type { ComponentProps } from 'react';
import {
  Callout,
  DataTable,
  GameDataVersionTable,
  Formula,
  GameDataReference,
  GameTerm,
  Image,
  ToolEmbed,
} from './content';

function MarkdownTable(props: ComponentProps<'table'>) {
  const Table = defaultMdxComponents.table;
  return <Table {...props} data-markdown-table="" />;
}

function ArticleH1({ className, ...props }: ComponentProps<'h1'>) {
  const Heading = defaultMdxComponents.h1;
  return (
    <Heading
      {...props}
      className={[className, 'site-article-heading'].filter(Boolean).join(' ')}
      data-site-article-heading=""
    />
  );
}

function ArticleH2({ className, ...props }: ComponentProps<'h2'>) {
  const Heading = defaultMdxComponents.h2;
  return (
    <Heading
      {...props}
      className={[className, 'site-article-heading'].filter(Boolean).join(' ')}
      data-site-article-heading=""
    />
  );
}

function ArticleH3({ className, ...props }: ComponentProps<'h3'>) {
  const Heading = defaultMdxComponents.h3;
  return (
    <Heading
      {...props}
      className={[className, 'site-article-heading'].filter(Boolean).join(' ')}
      data-site-article-heading=""
    />
  );
}

export function getMDXComponents(
  components?: MDXComponents,
  options: { articleHeadings?: boolean } = {},
) {
  return {
    ...defaultMdxComponents,
    table: MarkdownTable,
    Callout,
    DataTable,
    GameDataVersionTable,
    Formula,
    GameDataReference,
    GameTerm,
    Image,
    ToolEmbed,
    ...(options.articleHeadings
      ? { h1: ArticleH1, h2: ArticleH2, h3: ArticleH3 }
      : {}),
    ...components,
  } satisfies MDXComponents;
}

export const useMDXComponents = getMDXComponents;

declare global {
  type MDXProvidedComponents = ReturnType<typeof getMDXComponents>;
}
