import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { ProjectDto } from '@kdp/shared';
import { ProjectCard } from './project-card';
import { api } from '@/lib/api-client';
import { toast } from '@/components/ui/use-toast';

vi.mock('@/lib/api-client', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api-client')>('@/lib/api-client');
  return {
    ...actual,
    api: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn(), put: vi.fn() },
  };
});

vi.mock('@/components/ui/use-toast', () => ({ toast: vi.fn() }));

const project: ProjectDto = {
  id: 'proj-1',
  userId: 'user-1',
  organizationId: null,
  name: 'My Cookbook',
  bookType: 'low-content',
  niche: 'vegan recipes',
  targetAudience: 'home cooks',
  language: 'en',
  status: 'draft',
  workflowStatus: {},
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  archivedAt: null,
};

function renderCard(overrides: Partial<ProjectDto> = {}) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <ProjectCard project={{ ...project, ...overrides }} />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('ProjectCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the project name, book type, and status', () => {
    renderCard();
    expect(screen.getByRole('link', { name: 'My Cookbook' })).toHaveAttribute('href', '/projects/proj-1');
    expect(screen.getByText('draft')).toBeInTheDocument();
    expect(screen.getByText('vegan recipes')).toBeInTheDocument();
  });

  it('opens the rename dialog prefilled with the current name', async () => {
    const user = userEvent.setup();
    renderCard();
    await user.click(screen.getByRole('button', { name: /rename/i }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByLabelText('Project name')).toHaveValue('My Cookbook');
  });

  it('duplicates the project via POST /projects/:id/duplicate', async () => {
    vi.mocked(api.post).mockResolvedValue(project);
    const user = userEvent.setup();
    renderCard();
    await user.click(screen.getByRole('button', { name: /duplicate/i }));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/projects/proj-1/duplicate'));
  });

  it('archives an active project and shows "Restore" once archived', async () => {
    vi.mocked(api.post).mockResolvedValue(project);
    const user = userEvent.setup();
    renderCard();
    await user.click(screen.getByRole('button', { name: /^archive$/i }));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/projects/proj-1/archive'));
  });

  it('restores an already-archived project', async () => {
    vi.mocked(api.post).mockResolvedValue(project);
    const user = userEvent.setup();
    renderCard({ archivedAt: '2026-02-01T00:00:00.000Z' });
    await user.click(screen.getByRole('button', { name: /restore/i }));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/projects/proj-1/restore'));
  });

  it('deletes only after the confirm dialog is accepted', async () => {
    vi.mocked(api.delete).mockResolvedValue(undefined);
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    const user = userEvent.setup();
    renderCard();
    await user.click(screen.getByRole('button', { name: /delete/i }));
    expect(confirmSpy).toHaveBeenCalledWith('Delete "My Cookbook"? This can be undone by an admin.');
    await waitFor(() => expect(api.delete).toHaveBeenCalledWith('/projects/proj-1'));
  });

  it('does not delete when the confirm dialog is dismissed', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    const user = userEvent.setup();
    renderCard();
    await user.click(screen.getByRole('button', { name: /delete/i }));
    expect(api.delete).not.toHaveBeenCalled();
  });

  it('shows an error toast when duplicate fails', async () => {
    vi.mocked(api.post).mockRejectedValue(new Error('network down'));
    const user = userEvent.setup();
    renderCard();
    await user.click(screen.getByRole('button', { name: /duplicate/i }));
    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith(
        expect.objectContaining({ variant: 'destructive', title: 'Could not duplicate project' }),
      ),
    );
  });
});
