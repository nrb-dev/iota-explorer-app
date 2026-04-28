import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function ValidatorNotFound() {
  return (
    <main className="min-h-screen pt-28">
      <section className="mx-auto w-full max-w-2xl px-4 pb-20">
        <Card>
          <CardHeader>
            <CardTitle>Validator not found</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-muted-foreground">
            <p>
              This address is not part of the current IOTA active validator set.
            </p>
            <Button nativeButton={false} render={<Link href="/validators" />}>
              Back to validators
            </Button>
          </CardContent>
        </Card>
      </section>
    </main>
  );
}
