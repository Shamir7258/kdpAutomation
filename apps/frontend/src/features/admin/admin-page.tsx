import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { UsersTab } from './users-tab';
import { TemplatesTab } from './templates-tab';
import { BookTypesTab } from './book-types-tab';
import { ValidationRulesTab } from './validation-rules-tab';
import { SystemTab } from './system-tab';

export function AdminPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Admin</h1>
        <p className="text-sm text-muted-foreground">
          Manage users, prompt templates, and view platform configuration.
        </p>
      </div>

      <Tabs defaultValue="users">
        <TabsList>
          <TabsTrigger value="users">Users</TabsTrigger>
          <TabsTrigger value="templates">Templates</TabsTrigger>
          <TabsTrigger value="book-types">Book Types</TabsTrigger>
          <TabsTrigger value="validation-rules">Validation Rules</TabsTrigger>
          <TabsTrigger value="system">System</TabsTrigger>
        </TabsList>
        <TabsContent value="users">
          <UsersTab />
        </TabsContent>
        <TabsContent value="templates">
          <TemplatesTab />
        </TabsContent>
        <TabsContent value="book-types">
          <BookTypesTab />
        </TabsContent>
        <TabsContent value="validation-rules">
          <ValidationRulesTab />
        </TabsContent>
        <TabsContent value="system">
          <SystemTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
