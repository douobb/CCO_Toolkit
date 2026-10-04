import { describe, expect, it } from 'vitest';

import { buttonVariants } from './button';

describe('button foundation', () => {
  it('keeps variants on semantic tokens and component dimensions', () => {
    const defaultButton = buttonVariants({ size: 'lg' });
    const outlinedIcon = buttonVariants({ variant: 'outline', size: 'icon' });

    expect(defaultButton).toContain('bg-primary');
    expect(defaultButton).toContain('h-[var(--cco-button-height-lg)]');
    expect(outlinedIcon).toContain('border-input');
    expect(outlinedIcon).toContain('size-[var(--cco-button-icon-size)]');
  });
});
