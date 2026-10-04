import Link from 'next/link';
import { notFound } from 'next/navigation';

import {
  formatBlogDate,
  getBlogDate,
  getBlogDateTime,
  getBlogListItems,
  getBlogPageUrl,
} from '@/lib/blog';
import { isLocale } from '@/lib/i18n';
import { getMessages } from '@/lib/translations';
import { SitePageTitle } from '@/components/site-page-title';

export const dynamicParams = false;

export default async function BlogIndexPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();

  const messages = getMessages(lang).blogPage;
  const posts = getBlogListItems(lang);

  return (
    <div className="flex flex-1 flex-col">
      <div className="mx-auto w-full max-w-5xl flex-1 px-6 py-12 sm:px-10 sm:py-16">
        <header className="max-w-3xl">
          <p className="mb-3 text-sm font-medium text-fd-muted-foreground">
            {messages.eyebrow}
          </p>
          <SitePageTitle className="text-4xl font-bold tracking-tight sm:text-5xl">
            {messages.title}
          </SitePageTitle>
          <p className="mt-5 text-lg text-fd-muted-foreground">{messages.description}</p>
        </header>

        {posts.length > 0 ? (
          <div className="mt-10 @container">
            <div className="grid min-w-0 gap-4 @min-[30rem]:grid-cols-2 @min-[48rem]:grid-cols-3">
            {posts.map((post) => {
              const page = post.page;
              const href = post.kind === 'unavailable' ? getBlogPageUrl(lang, page) : page.url;
              const date = getBlogDate(page);
              const author = page.data.author;

              return (
              <Link
                key={href}
                href={href}
                className="group block h-full rounded-xl border bg-fd-card transition-colors hover:bg-fd-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fd-ring focus-visible:ring-offset-2 motion-reduce:transition-none"
              >
                <article className="flex h-full flex-col p-5 sm:p-6">
                  {date || author ? (
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-fd-muted-foreground">
                      {date ? (
                        <time dateTime={getBlogDateTime(page)}>
                          {messages.date} {formatBlogDate(page, lang)}
                        </time>
                      ) : null}
                      {date && author ? <span aria-hidden="true">·</span> : null}
                      {author ? <span>{messages.author}：{author}</span> : null}
                    </div>
                  ) : null}
                  {post.kind === 'unavailable' ? (
                    <span className="mt-4 w-fit rounded-md border border-dashed px-2 py-1 text-xs text-fd-muted-foreground">
                      {messages.translationUnavailable}
                    </span>
                  ) : null}
                  <h2 className="mt-4 text-xl font-semibold tracking-tight group-hover:underline group-hover:underline-offset-4">
                    {page.data.title}
                  </h2>
                  <p className="mt-3 text-sm leading-6 text-fd-muted-foreground">
                    {page.data.description}
                  </p>
                  {page.data.tags.length > 0 ? (
                    <div className="mt-5 flex flex-wrap gap-2 text-xs text-fd-muted-foreground">
                      {page.data.tags.map((tag) => (
                        <span key={tag} className="rounded-md border px-2 py-1">
                          {tag}
                        </span>
                      ))}
                    </div>
                  ) : null}
                  <span className="mt-auto pt-6 text-sm font-medium text-fd-foreground">
                    {post.kind === 'unavailable'
                      ? messages.openUntranslated
                      : messages.readMore}{' '}
                    <span aria-hidden="true">→</span>
                  </span>
                </article>
              </Link>
              );
            })}
            </div>
          </div>
        ) : (
          <div className="mt-10 rounded-xl border border-dashed bg-fd-card p-6 text-fd-muted-foreground">
            {messages.empty}
          </div>
        )}
      </div>
    </div>
  );
}
