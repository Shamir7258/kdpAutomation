import { listBookTypeDefinitions, type BookContentTier } from '@kdp/shared';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

const TIER_BADGE_VARIANT: Record<BookContentTier, 'secondary' | 'warning' | 'success'> = {
  low: 'secondary',
  medium: 'warning',
  high: 'success',
};

// Static catalog, bundled client-side — no fetch, no loading state.
const BOOK_TYPES = listBookTypeDefinitions();

export function BookTypesTab() {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
      {BOOK_TYPES.map((bt) => (
        <Card key={bt.id}>
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between gap-2">
              <CardTitle className="text-base">{bt.label}</CardTitle>
              <Badge variant={TIER_BADGE_VARIANT[bt.tier]}>{bt.tier}</Badge>
            </div>
            <CardDescription>{bt.description}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex flex-wrap gap-1.5">
              <Badge variant={bt.supportsOutline ? 'outline' : 'secondary'}>
                {bt.supportsOutline ? 'Supports outline' : 'No outline'}
              </Badge>
              <Badge variant={bt.supportsChapters ? 'outline' : 'secondary'}>
                {bt.supportsChapters ? 'Supports chapters' : 'No chapters'}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              Typically {bt.typicalPageRange[0]}–{bt.typicalPageRange[1]} pages
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
