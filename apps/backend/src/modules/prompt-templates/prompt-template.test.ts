import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { createApp } from '../../app.js';
import { clearTestDb, startTestDb, stopTestDb } from '../../test/mongo-test-utils.js';
import { promptTemplateService } from './prompt-template.service.js';
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

async function registerAdmin(email: string): Promise<string> {
  await request(app).post('/api/auth/register').send({ email, password: 'Sup3rSecret!', name: 'Admin' });
  await UserModel.updateOne({ email }, { role: 'admin' });
  const loginRes = await request(app).post('/api/auth/login').send({ email, password: 'Sup3rSecret!' });
  return loginRes.body.data.accessToken as string;
}

async function registerUser(email: string): Promise<string> {
  const res = await request(app).post('/api/auth/register').send({ email, password: 'Sup3rSecret!', name: 'User' });
  return res.body.data.accessToken as string;
}

describe('Prompt template admin CRUD', () => {
  it('requires admin role — a plain user is forbidden', async () => {
    const token = await registerUser('template-plain@example.com');
    const res = await request(app).get('/api/prompt-templates').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  it('lists the seeded default template', async () => {
    const token = await registerAdmin('template-list@example.com');
    const res = await request(app).get('/api/prompt-templates').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.some((t: { name: string }) => t.name === 'BOOK_IDEA_GENERATOR')).toBe(true);
  });

  it('creates a new template', async () => {
    const token = await registerAdmin('template-create@example.com');
    const res = await request(app)
      .post('/api/prompt-templates')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'CUSTOM_TEMPLATE',
        description: 'A custom template',
        systemPrompt: 'You are helpful.',
        userPrompt: 'Do {{thing}}.',
        variables: ['thing'],
      });
    expect(res.status).toBe(201);
    expect(res.body.data.version).toBe(1);
    expect(res.body.data.active).toBe(true);
  });

  it('rejects creating a template with a duplicate name', async () => {
    const token = await registerAdmin('template-dup@example.com');
    await request(app)
      .post('/api/prompt-templates')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'DUP', systemPrompt: 'x', userPrompt: 'y' });
    const res = await request(app)
      .post('/api/prompt-templates')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'DUP', systemPrompt: 'x', userPrompt: 'y' });
    expect(res.status).toBe(409);
  });

  it('updates a template and bumps its version', async () => {
    const token = await registerAdmin('template-update@example.com');
    const createRes = await request(app)
      .post('/api/prompt-templates')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'EDITABLE', systemPrompt: 'x', userPrompt: 'y' });
    const id = createRes.body.data.id as string;

    const updateRes = await request(app)
      .patch(`/api/prompt-templates/${id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ userPrompt: 'updated prompt', active: false });
    expect(updateRes.status).toBe(200);
    expect(updateRes.body.data.userPrompt).toBe('updated prompt');
    expect(updateRes.body.data.active).toBe(false);
    expect(updateRes.body.data.version).toBe(2);
  });
});
