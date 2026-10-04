import type { ComponentPropsWithoutRef, CSSProperties, ReactNode } from 'react';

import { cn } from '@/lib/cn';

export type DataTableAlign = 'left' | 'center' | 'right';

export type DataTableColumn =
  | ReactNode
  | {
      id?: string;
      label: ReactNode;
      align?: DataTableAlign;
      width?: CSSProperties['width'];
    };

export type DataTableProps = Omit<ComponentPropsWithoutRef<'div'>, 'children'> & {
  columns: readonly DataTableColumn[];
  rows?: readonly (readonly ReactNode[])[];
  caption?: ReactNode;
  ariaLabel?: string;
  emptyMessage?: ReactNode;
  rowHeader?: boolean;
  stickyFirstColumn?: boolean;
  tableClassName?: string;
};

function getColumn(column: DataTableColumn) {
  if (column !== null && typeof column === 'object' && 'label' in column) {
    return column;
  }

  return { label: column };
}

function getAlignClass(align: DataTableAlign | undefined) {
  if (align === 'center') return 'text-center';
  if (align === 'right') return 'text-right';
  return 'text-left';
}

export function DataTable({
  columns,
  rows = [],
  caption,
  ariaLabel,
  emptyMessage = 'No data available.',
  rowHeader = false,
  stickyFirstColumn = true,
  tableClassName,
  className,
  ...props
}: DataTableProps) {
  const normalizedColumns = columns.map(getColumn);

  return (
    <div
      {...props}
      className={cn('not-prose my-6 overflow-x-auto rounded-xl border', className)}
    >
      <table
        aria-label={caption ? undefined : ariaLabel ?? 'Data table'}
        data-sticky-first-column={stickyFirstColumn ? undefined : 'false'}
        className={cn('min-w-full text-left text-sm', tableClassName)}
      >
        {caption ? (
          <caption className="border-b px-4 py-3 text-left font-medium text-fd-foreground">
            {caption}
          </caption>
        ) : null}
        {normalizedColumns.some((column) => column.width !== undefined) ? (
          <colgroup>
            {normalizedColumns.map((column, index) => (
              <col
                key={column.id ?? index}
                style={column.width !== undefined ? { width: column.width } : undefined}
              />
            ))}
          </colgroup>
        ) : null}
        <thead className="bg-fd-card">
          <tr className="border-b">
            {normalizedColumns.map((column, index) => (
              <th
                key={column.id ?? index}
                scope="col"
                className={cn(
                  'whitespace-nowrap px-4 py-3 font-medium text-fd-foreground',
                  getAlignClass(column.align),
                )}
              >
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-fd-border">
          {rows.length > 0 ? (
            rows.map((row, rowIndex) => (
              <tr key={rowIndex} className="align-top">
                {normalizedColumns.map((column, columnIndex) => {
                  const cell = row[columnIndex];
                  const cellClassName = cn(
                    'px-4 py-3 text-fd-muted-foreground',
                    getAlignClass(column.align),
                  );

                  return rowHeader && columnIndex === 0 ? (
                    <th key={column.id ?? columnIndex} scope="row" className={cn(cellClassName, 'font-medium text-fd-foreground')}>
                      {cell}
                    </th>
                  ) : (
                    <td key={column.id ?? columnIndex} className={cellClassName}>
                      {cell}
                    </td>
                  );
                })}
              </tr>
            ))
          ) : (
            <tr>
              <td
                colSpan={Math.max(normalizedColumns.length, 1)}
                className="px-4 py-6 text-center text-fd-muted-foreground"
              >
                {emptyMessage}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
