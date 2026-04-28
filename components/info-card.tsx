import { ComponentType } from 'react';
import { Card } from './ui/card';
import { CardContent } from './ui/card';

export default function InfoCard({
  icon: Icon,
  label,
  value,
  sub,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: string;
  sub?: string | React.ReactNode;
}) {
  return (
    <Card className="border-border/50 bg-card/70">
      <CardContent className="flex items-start gap-3 py-1">
        <div className="rounded-lg bg-primary/10 p-2 text-primary">
          <Icon className="size-4" />
        </div>
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="mt-1 truncate font-mono text-lg font-semibold">
            {value}
          </p>
          {sub && <p className="mt-1 text-xs text-muted-foreground">{sub}</p>}
        </div>
      </CardContent>
    </Card>
  );
}
