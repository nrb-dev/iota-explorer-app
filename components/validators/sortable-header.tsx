import { ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';

export type SortDir = 'asc' | 'desc';

export function SortableHeader<T extends string>({
  label,
  field,
  currentField,
  currentDir,
  onSort,
  align = 'left',
}: {
  label: string;
  field: T;
  currentField: T;
  currentDir: SortDir;
  onSort: (f: T) => void;
  align?: 'left' | 'right';
}) {
  const isActive = field === currentField;
  return (
    <button
      onClick={() => onSort(field)}
      className={`inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wider transition-colors hover:text-foreground ${
        align === 'right' ? 'ml-auto' : ''
      } ${isActive ? 'text-primary' : 'text-muted-foreground'}`}
    >
      {label}
      {isActive ? (
        currentDir === 'asc' ? (
          <ArrowUp className="h-3 w-3" />
        ) : (
          <ArrowDown className="h-3 w-3" />
        )
      ) : (
        <ArrowUpDown className="h-3 w-3 opacity-40" />
      )}
    </button>
  );
}
