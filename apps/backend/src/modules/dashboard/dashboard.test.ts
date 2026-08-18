import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { createApp } from '../../app.js';
import { clearTestDb, startTestDb, stopTestDb } from '../../test/mongo-test-utils.js';

let app: Express;

beforeAll(async () => {
  await startTestDb();
  app = createApp();
});
afterEach(async () => {
  await clearTestDb();
});
afterAll(async () => {
  await stopTestDb();
});

describe('GET /api/dashboard/stats', () => {
  it('requires authentication', async () => {
    const res = await request(app).get('/api/dashboard/stats');
    expect(res.status).toBe(401);
  });

  it('reflects project counts for the authenticated user only', async () => {
    const ownerRes = await request(app)
      .post('/api/auth/register')
      .send({ email: 'stats-owner@example.com', password: 'Sup3rSecret!', name: 'Owner' });
    const ownerToken = ownerRes.body.data.accessToken as string;

    const otherRes = await request(app)
      .post('/api/auth/register')
      .send({ email: 'stats-other@example.com', password: 'Sup3rSecret!', name: 'Other' });
    const otherToken = otherRes.body.data.accessToken as string;

    await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ name: 'Owner Project', bookType: 'journal', niche: 'fitness' });
    await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${otherToken}`)
      .send({ name: 'Other Project', bookType: 'journal', niche: 'cooking' });

    const res = await request(app).get('/api/dashboard/stats').set('Authorization', `Bearer ${ownerToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.totalProjects).toBe(1);
    expect(res.body.data.draftBooks).toBe(1);
    expect(res.body.data.recentProjects).toHaveLength(1);
    expect(res.body.data.recentProjects[0].name).toBe('Owner Project');
  });
});
