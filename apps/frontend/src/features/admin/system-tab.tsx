import { useQuery } from '@tanstack/react-query';
import type { SystemInfoDto } from '@kdp/shared';
import { api } from '@/lib/api-client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';

const INFO_ROWS: Array<{ key: keyof Omit<SystemInfoDto, 'aiUsage'>; label: string }> = [
  { key: 'nodeEnv', label: 'Environment' },
  { key: 'aiProvider', label: 'AI provider' },
  { key: 'imageProvider', label: 'Image provider' },
  { key: 'storageProvider', label: 'Storage provider' },
];

export function SystemTab() {
  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'system-info'],
    queryFn: () => api.get<SystemInfoDto>('/admin/system-info'),
  });

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Configuration</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {isLoading ? (
            <Skeleton className="h-24 w-full" />
          ) : (
            INFO_ROWS.map(({ key, label }) => (
              <div key={key} className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{label}</span>
                <Badge variant="secondary">{data?.[key]}</Badge>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">AI usage (platform-wide)</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          {isLoading ? (
            <Skeleton className="h-5 w-40" />
          ) : (
            <p>
              ${data?.aiUsage.totalCostUsd.toFixed(2)} spent across {data?.aiUsage.totalCalls} calls
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
