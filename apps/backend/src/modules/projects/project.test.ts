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

async function registerAndGetToken(email: string): Promise<string> {
  const res = await request(app)
    .post('/api/auth/register')
    .send({ email, password: 'Sup3rSecret!', name: 'Test User' });
  return res.body.data.accessToken as string;
}

const validProject = {
  name: 'Beginner Fitness Journal',
  bookType: 'journal',
  niche: 'fitness for beginners',
  targetAudience: 'adults new to exercise',
  language: 'en',
};

describe('Project CRUD', () => {
  it('rejects unauthenticated requests', async () => {
    const res = await request(app).get('/api/projects');
    expect(res.status).toBe(401);
  });

  it('creates and fetches a project scoped to the owner', async () => {
    const token = await registerAndGetToken('owner@example.com');

    const createRes = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${token}`)
      .send(validProject);
    expect(createRes.status).toBe(201);
    expect(createRes.body.data.status).toBe('DRAFT');
    expect(createRes.body.data.workflowStatus.RESEARCH).toBe('pending');

    const id = createRes.body.data.id as string;
    const getRes = await request(app).get(`/api/projects/${id}`).set('Authorization', `Bearer ${token}`);
    expect(getRes.status).toBe(200);
    expect(getRes.body.data.name).toBe(validProject.name);
  });

  it('rejects invalid bookType with 400', async () => {
    const token = await registerAndGetToken('owner2@example.com');
    const res = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...validProject, bookType: 'not_a_real_type' });
    expect(res.status).toBe(400);
  });

  it('prevents one user from reading another user’s project', async () => {
    const ownerToken = await registerAndGetToken('owner3@example.com');
    const intruderToken = await registerAndGetToken('intruder@example.com');

    const createRes = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send(validProject);
    const id = createRes.body.data.id as string;

    const res = await request(app).get(`/api/projects/${id}`).set('Authorization', `Bearer ${intruderToken}`);
    expect(res.status).toBe(404);
  });

  it('renames a project', async () => {
    const token = await registerAndGetToken('rename@example.com');
    const createRes = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${token}`)
      .send(validProject);
    const id = createRes.body.data.id as string;

    const patchRes = await request(app)
      .patch(`/api/projects/${id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Renamed Journal' });
    expect(patchRes.status).toBe(200);
    expect(patchRes.body.data.name).toBe('Renamed Journal');
  });

  it('duplicates a project', async () => {
    const token = await registerAndGetToken('dup@example.com');
    const createRes = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${token}`)
      .send(validProject);
    const id = createRes.body.data.id as string;

    const dupRes = await request(app)
      .post(`/api/projects/${id}/duplicate`)
      .set('Authorization', `Bearer ${token}`);
    expect(dupRes.status).toBe(201);
    expect(dupRes.body.data.name).toBe(`${validProject.name} (Copy)`);
    expect(dupRes.body.data.id).not.toBe(id);
  });

  it('archives then restores a project, honoring includeArchived in list', async () => {
    const token = await registerAndGetToken('archive@example.com');
    const createRes = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${token}`)
      .send(validProject);
    const id = createRes.body.data.id as string;

    const archiveRes = await request(app)
      .post(`/api/projects/${id}/archive`)
      .set('Authorization', `Bearer ${token}`);
    expect(archiveRes.body.data.status).toBe('ARCHIVED');

    const hiddenList = await request(app).get('/api/projects').set('Authorization', `Bearer ${token}`);
    expect(hiddenList.body.data.total).toBe(0);

    const visibleList = await request(app)
      .get('/api/projects?includeArchived=true')
      .set('Authorization', `Bearer ${token}`);
    expect(visibleList.body.data.total).toBe(1);

    const restoreRes = await request(app)
      .post(`/api/projects/${id}/restore`)
      .set('Authorization', `Bearer ${token}`);
    expect(restoreRes.body.data.status).toBe('DRAFT');
    expect(restoreRes.body.data.archivedAt).toBeNull();
  });

  it('excludes archived projects when includeArchived=false is passed explicitly (not just omitted)', async () => {
    // Regression test: the frontend always sends `includeArchived=false` explicitly
    // rather than omitting the param. z.coerce.boolean() would coerce the *string*
    // "false" to `true` (JS Boolean("false") === true), silently leaking archived
    // projects into the default view — caught via a real browser walkthrough.
    const token = await registerAndGetToken('explicit-false@example.com');
    const createRes = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${token}`)
      .send(validProject);
    const id = createRes.body.data.id as string;
    await request(app).post(`/api/projects/${id}/archive`).set('Authorization', `Bearer ${token}`);

    const res = await request(app)
      .get('/api/projects?includeArchived=false')
      .set('Authorization', `Bearer ${token}`);
    expect(res.body.data.total).toBe(0);
  });

  it('soft-deletes a project so it no longer appears or resolves', async () => {
    const token = await registerAndGetToken('delete@example.com');
    const createRes = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${token}`)
      .send(validProject);
    const id = createRes.body.data.id as string;

    const deleteRes = await request(app).delete(`/api/projects/${id}`).set('Authorization', `Bearer ${token}`);
    expect(deleteRes.status).toBe(200);

    const getRes = await request(app).get(`/api/projects/${id}`).set('Authorization', `Bearer ${token}`);
    expect(getRes.status).toBe(404);
  });

  it('filters by status and bookType', async () => {
    const token = await registerAndGetToken('filter@example.com');
    await request(app).post('/api/projects').set('Authorization', `Bearer ${token}`).send(validProject);
    await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...validProject, name: 'A Puzzle Book', bookType: 'puzzle_book' });

    const res = await request(app)
      .get('/api/projects?bookType=puzzle_book')
      .set('Authorization', `Bearer ${token}`);
    expect(res.body.data.total).toBe(1);
    expect(res.body.data.items[0].bookType).toBe('puzzle_book');
  });
});
