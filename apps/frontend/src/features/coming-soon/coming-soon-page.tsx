import { Card, CardContent } from '@/components/ui/card';

export function ComingSoonPage({ title, phase }: { title: string; phase: string }) {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      <Card>
        <CardContent className="p-12 text-center text-sm text-muted-foreground">
          {title} lands in <span className="font-medium text-foreground">{phase}</span> — see PLAN.md for the full
          roadmap.
        </CardContent>
      </Card>
    </div>
  );
}
