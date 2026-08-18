import type { BadgeProps } from '@/components/ui/badge';

export const STATUS_BADGE_VARIANT: Record<string, NonNullable<BadgeProps['variant']>> = {
  DRAFT: 'secondary',
  RESEARCHING: 'outline',
  PLANNING: 'outline',
  GENERATING: 'outline',
  EDITING: 'outline',
  DESIGNING: 'outline',
  VALIDATING: 'warning',
  READY: 'success',
  FAILED: 'destructive',
  ARCHIVED: 'secondary',
};
