import { source } from '@/lib/source';
import { llms } from 'fumadocs-core/source';
import { withBasePathInMarkdown } from '@/lib/site-paths';

export const revalidate = false;

export function GET() {
  return new Response(withBasePathInMarkdown(llms(source).index()));
}
