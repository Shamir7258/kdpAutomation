import { useQuery } from '@tanstack/react-query';
import { AlertCircle, AlertTriangle, CheckCircle2, RefreshCw } from 'lucide-react';
import { FINDING_CATEGORIES, type FindingCategory, type ValidationFindingDto, type ValidationReportDto } from '@kdp/shared';
import { api, ApiError } from '@/lib/api-client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';

const CATEGORY_LABELS: Record<FindingCategory, string> = {
  metadata: 'Metadata',
  content: 'Content',
  interior: 'Interior',
  cover: 'Cover',
};

export function ValidationPanel({ projectId }: { projectId: string }) {
  const validationQuery = useQuery({
    queryKey: ['projects', projectId, 'validation'],
    queryFn: () => api.get<ValidationReportDto>(`/projects/${projectId}/validation`),
    retry: false,
  });

  const report = validationQuery.data;
  const errorCount = report?.findings.filter((f) => f.severity === 'error').length ?? 0;

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <CardTitle className="text-base">Validation</CardTitle>
          <CardDescription>
            A preflight checklist against KDP's requirements — not a guarantee of approval, always do a final manual
            review before publishing.
          </CardDescription>
        </div>
        <Button
          size="sm"
          variant="outline"
          disabled={validationQuery.isFetching}
          onClick={() => validationQuery.refetch()}
        >
          <RefreshCw className="h-3.5 w-3.5" />
          {validationQuery.isFetching ? 'Checking…' : 'Re-check'}
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {validationQuery.isLoading && <Skeleton className="h-40 w-full" />}

        {validationQuery.isError && (
          <p className="text-sm text-destructive">
            {validationQuery.error instanceof ApiError ? validationQuery.error.message : 'Something went wrong.'}
          </p>
        )}

        {report && (
          <>
            {report.readyToPublish ? (
              <div className="flex items-center gap-2 rounded-md border bg-emerald-50 p-3 dark:bg-emerald-950/20">
                <Badge variant="success">Ready to publish</Badge>
                <span className="text-sm text-muted-foreground">No blocking issues found.</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 rounded-md border bg-destructive/10 p-3">
                <Badge variant="destructive">Not ready</Badge>
                <span className="text-sm text-muted-foreground">
                  {errorCount} blocking {errorCount === 1 ? 'issue' : 'issues'} must be resolved before publishing.
                </span>
              </div>
            )}

            <div className="space-y-4">
              {FINDING_CATEGORIES.map((category) => (
                <CategorySection
                  key={category}
                  label={CATEGORY_LABELS[category]}
                  findings={report.findings.filter((f) => f.category === category)}
                />
              ))}
            </div>

            <p className="text-xs text-muted-foreground">
              Last checked {new Date(report.checkedAt).toLocaleString()}
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function CategorySection({ label, findings }: { label: string; findings: ValidationFindingDto[] }) {
  return (
    <div className="space-y-1.5">
      <p className="text-sm font-medium">{label}</p>
      {findings.length === 0 ? (
        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
          No issues
        </div>
      ) : (
        <ul className="space-y-1.5">
          {findings.map((finding) => (
            <li key={finding.ruleId} className="flex items-start gap-1.5 text-sm">
              {finding.severity === 'error' ? (
                <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-destructive" />
              ) : (
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
              )}
              <span className="text-muted-foreground">{finding.message}</span>
              <Badge variant={finding.severity === 'error' ? 'destructive' : 'warning'} className="ml-auto shrink-0">
                {finding.severity}
              </Badge>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
