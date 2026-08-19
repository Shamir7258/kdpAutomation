import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { createApp } from '../../app.js';
import { clearTestDb, startTestDb, stopTestDb } from '../../test/mongo-test-utils.js';
import { promptTemplateService } from '../prompt-templates/prompt-template.service.js';
import { UserModel } from '../auth/user.model.js';

let app: Express;

beforeAll(async () => {
  await startTestDb();
  await promptTemplateService.seedDefaults();
  app = createApp();
});
afterEach(async () => {
  await clearTestDb();
  await promptTemplateService.seedDefaults();
});
afterAll(async () => {
  await stopTestDb();
});

async function registerAdmin(email: string): Promise<{ token: string; userId: string }> {
  const registerRes = await request(app)
    .post('/api/auth/register')
    .send({ email, password: 'Sup3rSecret!', name: 'Admin' });
  const userId = registerRes.body.data.user.id as string;
  await UserModel.updateOne({ email }, { role: 'admin' });
  const loginRes = await request(app).post('/api/auth/login').send({ email, password: 'Sup3rSecret!' });
  return { token: loginRes.body.data.accessToken as string, userId };
}

async function registerUser(email: string): Promise<{ token: string; userId: string }> {
  const res = await request(app).post('/api/auth/register').send({ email, password: 'Sup3rSecret!', name: 'User' });
  return { token: res.body.data.accessToken as string, userId: res.body.data.user.id as string };
}

describe('Admin routes', () => {
  it('requires admin role for every admin route', async () => {
    const { token } = await registerUser('admin-plain@example.com');
    const results = await Promise.all([
      request(app).get('/api/admin/users').set('Authorization', `Bearer ${token}`),
      request(app).get('/api/admin/validation-rules').set('Authorization', `Bearer ${token}`),
      request(app).get('/api/admin/system-info').set('Authorization', `Bearer ${token}`),
    ]);
    for (const res of results) expect(res.status).toBe(403);
  });

  it('lists users with role/disabled/projectCount', async () => {
    const { token } = await registerAdmin('admin-list@example.com');
    await registerUser('admin-list-other@example.com');

    const res = await request(app).get('/api/admin/users').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThanOrEqual(2);
    const other = res.body.data.find((u: { email: string }) => u.email === 'admin-list-other@example.com');
    expect(other.role).toBe('user');
    expect(other.disabled).toBe(false);
    expect(other.projectCount).toBe(0);
  });

  it("disables another user's account, and that account can no longer log in", async () => {
    const { token: adminToken } = await registerAdmin('admin-disable@example.com');
    const { userId: targetId } = await registerUser('admin-disable-target@example.com');

    const patchRes = await request(app)
      .patch(`/api/admin/users/${targetId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ disabled: true });
    expect(patchRes.status).toBe(200);
    expect(patchRes.body.data.disabled).toBe(true);

    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin-disable-target@example.com', password: 'Sup3rSecret!' });
    expect(loginRes.status).toBe(403);
  });

  it('prevents an admin from disabling or demoting their own account', async () => {
    const { token, userId } = await registerAdmin('admin-self@example.com');

    const disableSelf = await request(app)
      .patch(`/api/admin/users/${userId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ disabled: true });
    expect(disableSelf.status).toBe(400);

    const demoteSelf = await request(app)
      .patch(`/api/admin/users/${userId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ role: 'user' });
    expect(demoteSelf.status).toBe(400);
  });

  it('promotes a user to admin', async () => {
    const { token: adminToken } = await registerAdmin('admin-promote@example.com');
    const { userId: targetId } = await registerUser('admin-promote-target@example.com');

    const res = await request(app)
      .patch(`/api/admin/users/${targetId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ role: 'admin' });
    expect(res.status).toBe(200);
    expect(res.body.data.role).toBe('admin');
  });

  it('lists the registered validation rules', async () => {
    const { token } = await registerAdmin('admin-rules@example.com');
    const res = await request(app).get('/api/admin/validation-rules').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThanOrEqual(10);
    expect(res.body.data.some((r: { id: string }) => r.id === 'metadata-exists')).toBe(true);
  });

  it('reports system info without leaking secrets', async () => {
    const { token } = await registerAdmin('admin-sysinfo@example.com');
    const res = await request(app).get('/api/admin/system-info').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.aiProvider).toBe('mock');
    expect(res.body.data.imageProvider).toBe('mock');
    expect(res.body.data.storageProvider).toBeDefined();
    expect(res.body.data.aiUsage).toEqual({ totalCostUsd: expect.any(Number), totalCalls: expect.any(Number) });
    expect(JSON.stringify(res.body.data)).not.toContain('JWT_SECRET');
    expect(res.body.data.jwtSecret).toBeUndefined();
  });
});
