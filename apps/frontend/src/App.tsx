import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '@/lib/query-client';
import { AuthProvider } from '@/features/auth/auth-context';
import { ProtectedRoute, GuestRoute } from '@/routes/protected-route';
import { AppShell } from '@/components/layout/app-shell';
import { LoginPage } from '@/features/auth/login-page';
import { RegisterPage } from '@/features/auth/register-page';
import { DashboardPage } from '@/features/dashboard/dashboard-page';
import { ProjectsListPage } from '@/features/projects/projects-list-page';
import { ProjectDetailPage } from '@/features/projects/project-detail-page';
import { SettingsPage } from '@/features/settings/settings-page';
import { ComingSoonPage } from '@/features/coming-soon/coming-soon-page';
import { BookEditorPage } from '@/features/editor/book-editor-page';
import { Toaster } from '@/components/ui/toaster';

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route element={<GuestRoute />}>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />
            </Route>

            <Route element={<ProtectedRoute />}>
              <Route element={<AppShell />}>
                <Route path="/" element={<DashboardPage />} />
                <Route path="/projects" element={<ProjectsListPage />} />
                <Route path="/projects/:id" element={<ProjectDetailPage />} />
                <Route path="/interior" element={<ComingSoonPage title="Interior" phase="Phase 7" />} />
                <Route path="/cover" element={<ComingSoonPage title="Cover" phase="Phase 8" />} />
                <Route path="/metadata" element={<ComingSoonPage title="Metadata" phase="Phase 6" />} />
                <Route path="/validation" element={<ComingSoonPage title="Validation" phase="Phase 9" />} />
                <Route path="/exports" element={<ComingSoonPage title="Exports" phase="Phase 10" />} />
                <Route path="/settings" element={<SettingsPage />} />
              </Route>
              {/* Full-screen focused editor — deliberately outside AppShell (no sidebar/topbar chrome). */}
              <Route path="/projects/:id/editor/:chapterId/:sectionId" element={<BookEditorPage />} />
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
          <Toaster />
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
