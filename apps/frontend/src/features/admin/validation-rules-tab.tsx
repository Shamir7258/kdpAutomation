import { useQuery } from '@tanstack/react-query';
import type { ValidationRuleDto } from '@kdp/shared';
import { api } from '@/lib/api-client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

// Mirrors ValidationPanel's CATEGORY_LABELS — kept as a plain Record here (rather than importing
// FindingCategory) since this registry can include rule categories beyond the four finding
// categories a per-project validation report groups by.
const CATEGORY_LABELS: Record<string, string> = {
  metadata: 'Metadata',
  content: 'Content',
  interior: 'Interior',
  cover: 'Cover',
};

export function ValidationRulesTab() {
  const rulesQuery = useQuery({
    queryKey: ['admin', 'validation-rules'],
    queryFn: () => api.get<ValidationRuleDto[]>('/admin/validation-rules'),
  });

  if (rulesQuery.isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-32 w-full" />
        ))}
      </div>
    );
  }

  const rulesByCategory = new Map<string, ValidationRuleDto[]>();
  for (const rule of rulesQuery.data ?? []) {
    const list = rulesByCategory.get(rule.category) ?? [];
    list.push(rule);
    rulesByCategory.set(rule.category, list);
  }

  return (
    <div className="space-y-4">
      {rulesByCategory.size === 0 && (
        <div className="rounded-lg border border-dashed p-12 text-center text-sm text-muted-foreground">
          No validation rules registered.
        </div>
      )}

      {Array.from(rulesByCategory.entries()).map(([category, rules]) => (
        <Card key={category}>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{CATEGORY_LABELS[category] ?? category}</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-1.5">
              {rules.map((rule) => (
                <li key={rule.id} className="flex items-baseline gap-2 text-sm">
                  <span>{rule.label}</span>
                  <span className="text-xs text-muted-foreground">{rule.id}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
