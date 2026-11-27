import 'reflect-metadata';
import 'dotenv/config';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Prisma, PrismaClient } from '@prisma/client';
import { hash } from 'argon2';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { KnowledgeModule } from './knowledge.module';
import { webOrigin } from '../auth/auth-policy';
import { ObjectStorage } from '../files/object-storage';

import { TenantDatabase } from '../tenant/tenant-database';
import {
  createTenantFixture,
  removeTenantFixture,
} from '../testing/tenant-fixture';

const integration =
  process.env.TENANT_INTEGRATION_TEST === 'true' ? describe : describe.skip;
const password = 'TestPassword36!';

integration('T13 knowledge library and archive', () => {
  const root = new PrismaClient();
  const signDownload = jest.fn().mockResolvedValue({
    url: 'https://storage.example.test/attachment',
    expiresIn: 300,
  });
  let app: INestApplication;
  let own: Awaited<ReturnType<typeof createTenantFixture>>;
  let other: typeof own;
  let admin: string;
  let employee: string;
  let trainer: string;

  function api(
    method: 'get' | 'patch' | 'post' | 'delete',
    route: string,
    cookie = employee,
  ) {
    return request(app.getHttpServer())
      [method]('/knowledge' + route)
      .set('Origin', webOrigin())
      .set('Cookie', cookie);
  }

  async function login(identifier: string) {
    const logged = await request(app.getHttpServer())
      .post('/auth/login')
      .set('Origin', webOrigin())
      .send({ identifier, password })
      .expect(204);
    return logged.headers['set-cookie'][0].split(';')[0] as string;
  }

  async function createVersion(
    fixture: typeof own,
    status: Prisma.KnowledgeVersionUncheckedCreateInput['status'],
    data: Partial<Prisma.KnowledgeVersionUncheckedCreateInput> = {},
  ) {
    const {
      tenantId,
      users: [author],
    } = fixture;
    const itemId =
      data.itemId ??
      (
        await root.knowledgeItem.create({
          data: { tenantId, createdBy: author.id },
        })
      ).id;
    return root.knowledgeVersion.create({
      data: {
        tenantId,
        itemId,
        createdBy: author.id,
        status,
        reviewToken: status === 'IN_REVIEW' ? randomUUID() : null,
        title: 'Vận hành',
        summary: '',
        bodyHtml: '',
        audience: 'TENANT',
        ...data,
      },
    });
  }

  async function attach(
    version: Awaited<ReturnType<typeof createVersion>>,
    fixture = own,
  ) {
    const id = randomUUID();
    const file = await root.fileObject.create({
      data: {
        id,
        tenantId: fixture.tenantId,
        createdBy: fixture.users[0].id,
        name: 'Quy trình.pdf',
        contentType: 'application/pdf',
        sizeBytes: 42n,
        storageKey: fixture.tenantId + '/' + id,
      },
    });
    await root.knowledgeAttachment.create({
      data: {
        tenantId: fixture.tenantId,
        versionId: version.id,
        fileId: file.id,
      },
    });
    return file;
  }

  beforeAll(async () => {
    const passwordHash = await hash(password);
    own = await createTenantFixture(root, passwordHash);
    other = await createTenantFixture(root, passwordHash);
    await root.userRole.create({
      data: {
        tenantId: own.tenantId,
        userId: own.users[2].id,
        role: 'PTDT',
        departmentIds: [own.department.id],
      },
    });
    const module = await Test.createTestingModule({
      imports: [KnowledgeModule],
    })
      .overrideProvider(ObjectStorage)
      .useValue({ signDownload })
      .compile();
    app = module.createNestApplication();
    await app.init();
    [admin, employee, trainer] = await Promise.all([
      login(own.users[0].email),
      login(own.users[1].email),
      login(own.users[2].email),
    ]);
  });

  afterAll(async () => {
    try {
      for (const fixture of [own, other]) {
        if (!fixture) continue;
        const where = { tenantId: fixture.tenantId };
        await root.trainingCourse.deleteMany({ where });
        await root.knowledgeAttachment.deleteMany({ where });
        await root.knowledgeVersion.deleteMany({ where });
        await root.knowledgeItem.deleteMany({ where });
        await root.knowledgeCategory.deleteMany({ where });
        await root.knowledgeTag.deleteMany({ where });
        await root.fileObject.deleteMany({ where });
        await removeTenantFixture(root, fixture.tenantId);
      }
    } finally {
      await app?.close();
      await root.$disconnect();
    }
  });

  it('searches visible published title, summary and rendered text with taxonomy and department filters', async () => {
    const tenantId = own.tenantId;
    const category = await root.knowledgeCategory.create({
      data: { tenantId, name: 'Vận hành' },
    });
    const tag = await root.knowledgeTag.create({
      data: { tenantId, name: 'Bảo trì' },
    });
    const fields = {
      categoryId: category.id,
      tagIds: [tag.id],
      audience: 'DEPARTMENTS' as const,
      departmentIds: [own.department.id],
    };
    const title = await createVersion(own, 'PUBLISHED', {
      ...fields,
      title: 'Bảo trì',
    });
    const summary = await createVersion(own, 'PUBLISHED', {
      ...fields,
      summary: 'Bảo trì',
    });
    const body = await createVersion(own, 'PUBLISHED', {
      ...fields,
      bodyHtml: '<p>Bảo <strong>trì</strong> &amp; kiểm tra</p>',
    });
    await createVersion(own, 'DRAFT', {
      ...fields,
      itemId: body.itemId,
      revision: 2,
      title: 'Bản mới chưa duyệt',
    });
    await createVersion(own, 'PUBLISHED', {
      ...fields,
      tagIds: [],
      title: 'Bảo trì',
    });
    await createVersion(own, 'PUBLISHED', {
      ...fields,
      categoryId: null,
      title: 'Bảo trì',
    });
    await createVersion(own, 'PUBLISHED', { title: 'Bảo trì' });
    await createVersion(other, 'PUBLISHED', { title: 'Bảo trì' });
    const params = {
      q: 'BẢO TRÌ',
      categoryId: category.id,
      tagId: tag.id,
      departmentId: own.department.id,
    };
    const result = await api('get', '/read')
      .query({ ...params, tenantId: other.tenantId })
      .expect(200);
    expect(
      result.body.articles
        .map(({ itemId }: { itemId: string }) => itemId)
        .sort(),
    ).toEqual([title.itemId, summary.itemId, body.itemId].sort());
    const literal = await api('get', '/read')
      .query({ ...params, q: 'trì & kiểm' })
      .expect(200);
    expect(literal.body.articles).toEqual([
      expect.objectContaining({ itemId: body.itemId }),
    ]);
    for (const q of ['strong', 'Bản mới chưa duyệt']) {
      const response = await api('get', '/read')
        .query({ ...params, q })
        .expect(200);
      expect(response.body.articles).toEqual([]);
    }
    expect(
      (
        await api('get', '/read')
          .query({ ...params, departmentId: other.department.id })
          .expect(200)
      ).body.articles,
    ).toEqual([]);
    await api('get', '/read').query({ tagId: 'invalid' }).expect(400);
  });

  it('makes approval visible immediately on the list and by ID', async () => {
    const query = { q: 'Nghiệm thu tức thời' };
    const pending = await createVersion(own, 'IN_REVIEW', {
      title: query.q,
      createdBy: own.users[2].id,
    });
    const path = '/read/' + pending.itemId;
    expect(
      (await api('get', '/read').query(query).expect(200)).body.articles,
    ).toEqual([]);
    await api('get', path).expect(404);
    await api('post', '/reviews/' + pending.id + '/approve', admin)
      .send({ token: pending.reviewToken })
      .expect(200);
    expect(
      (await api('get', '/read').query(query).expect(200)).body.articles,
    ).toEqual([expect.objectContaining({ itemId: pending.itemId })]);
    await api('get', path).expect(200);
  });

  it('checks published status, audience and exact version links for direct reader requests', async () => {
    signDownload.mockClear();
    const outside = await root.department.create({
      data: { tenantId: own.tenantId, name: 'Ngoài phạm vi' },
    });
    const allowed = await createVersion(own, 'PUBLISHED', {
      audience: 'POSITIONS',
      positionIds: [own.position.id],
    });
    const linked = await attach(allowed);
    const hidden = [
      await createVersion(own, 'DRAFT'),
      await createVersion(own, 'IN_REVIEW'),
      await createVersion(own, 'ARCHIVED'),
      await createVersion(own, 'PUBLISHED', {
        audience: 'DEPARTMENTS',
        departmentIds: [outside.id],
      }),
      await createVersion(other, 'PUBLISHED'),
    ];
    for (const version of hidden) {
      const file = await attach(
        version,
        version.tenantId === own.tenantId ? own : other,
      );
      await api('get', '/read/' + version.itemId).expect(404);
      await api('get', '/read/' + version.itemId + '/files/' + file.id).expect(
        404,
      );
      await api('get', '/read/' + allowed.itemId + '/files/' + file.id).expect(
        404,
      );
    }
    const response = await api('get', '/read/' + allowed.itemId).expect(200);
    expect(response.body.attachments).toEqual([
      {
        video: false,
        file: {
          id: linked.id,
          name: linked.name,
          contentType: linked.contentType,
        },
      },
    ]);
    expect(signDownload).not.toHaveBeenCalled();
    await api('get', '/read/' + allowed.itemId + '/files/' + linked.id).expect(
      200,
    );
    expect(signDownload).toHaveBeenCalledWith(
      expect.objectContaining({ storageKey: linked.storageKey }),
    );
  });

  it('archives and restores the same scoped revision, retains history and blocks permanent deletion', async () => {
    const older = await createVersion(own, 'PUBLISHED', {
      title: 'Hướng dẫn cũ',
    });
    const active = await createVersion(own, 'PUBLISHED', {
      itemId: older.itemId,
      revision: 2,
      title: 'Hướng dẫn hiện tại',
      audience: 'DEPARTMENTS',
      departmentIds: [own.department.id],
    });
    const attached = await attach(active);
    const review = await createVersion(own, 'IN_REVIEW', {
      itemId: active.itemId,
      revision: 3,
    });
    const tenantId = own.tenantId;
    const course = await root.trainingCourse.create({
      data: { tenantId, name: 'Khóa học giữ tham chiếu', description: '' },
    });
    const module = await root.trainingModule.create({
      data: { tenantId, courseId: course.id, name: 'Nội dung', position: 0 },
    });
    const lesson = await root.trainingLesson.create({
      data: {
        tenantId,
        moduleId: module.id,
        name: 'Đọc tri thức',
        position: 0,
        durationMinutes: 10,
        type: 'KNOWLEDGE',
        knowledgeId: active.itemId,
      },
    });
    const foreign = await createVersion(other, 'PUBLISHED');
    const readPath = '/read/' + active.itemId;
    const editor = '/editor/publications/';
    const article = editor + active.itemId;
    const foreignArticle = editor + foreign.itemId;
    const history = article + '/history';
    const olderHistory = history + '/' + older.id;
    const currentHistory = history + '/' + active.id;

    await api('patch', article + '/archive').expect(403);
    await api('patch', foreignArticle + '/archive', admin).expect(404);
    await api('patch', foreignArticle + '/restore', admin).expect(404);
    await api('get', foreignArticle + '/history', admin).expect(404);
    await api('get', foreignArticle + '/history/' + foreign.id, admin).expect(
      404,
    );
    await api(
      'get',
      foreignArticle + '/history/' + foreign.id + '/files/' + attached.id,
      admin,
    ).expect(404);
    expect(
      (await api('get', editor.slice(0, -1), admin).expect(200)).body,
    ).not.toContainEqual(expect.objectContaining({ itemId: foreign.itemId }));
    await api('get', olderHistory, trainer).expect(404);
    await api('get', history + '/' + review.id, admin).expect(404);
    expect((await api('get', readPath).expect(200)).body.title).toBe(
      active.title,
    );

    await api('patch', article + '/archive', trainer).expect(200);
    await api('patch', article + '/archive', trainer).expect(200);
    await api('get', readPath).expect(404);
    await api('get', readPath + '/files/' + attached.id).expect(404);
    expect(
      (await api('get', '/read').query({ q: 'Hướng dẫn' }).expect(200)).body
        .articles,
    ).toEqual([]);
    await api('get', history).expect(403);
    expect(
      (await api('get', history, admin).expect(200)).body.map(
        ({ id }: { id: string }) => id,
      ),
    ).toEqual([active.id, older.id]);
    expect((await api('get', olderHistory, admin).expect(200)).body.title).toBe(
      older.title,
    );
    await api('get', currentHistory + '/files/' + attached.id, trainer).expect(
      200,
    );
    await api('delete', article, admin).expect(404);
    expect(
      await root.trainingLesson.findFirst({
        where: { id: lesson.id },
        select: { knowledgeId: true },
      }),
    ).toEqual({ knowledgeId: active.itemId });
    await expect(
      root.$transaction(async (tx) => {
        await tx.knowledgeVersion.deleteMany({
          where: { tenantId: own.tenantId, itemId: active.itemId },
        });
        await tx.knowledgeItem.delete({ where: { id: active.itemId } });
      }),
    ).rejects.toMatchObject({ code: 'P2003' });
    const database = app.get(TenantDatabase);
    await expect(
      database.run(own.tenantId, async () => {
        await database.client.knowledgeItem.delete({
          where: { id: active.itemId },
        });
      }),
    ).rejects.toThrow(/permission denied/i);

    await api('patch', article + '/restore', trainer).expect(200);
    expect((await api('get', readPath).expect(200)).body.title).toBe(
      active.title,
    );
    await api('get', readPath + '/files/' + attached.id).expect(200);
    expect(
      (await api('get', '/read').query({ q: 'Hướng dẫn' }).expect(200)).body
        .articles,
    ).toEqual([
      expect.objectContaining({ itemId: active.itemId, title: active.title }),
    ]);
    expect(
      await root.knowledgeVersion.findUnique({ where: { id: review.id } }),
    ).toMatchObject({ status: 'IN_REVIEW' });
    expect(
      await root.knowledgeVersion.findUnique({ where: { id: older.id } }),
    ).toMatchObject({ status: 'PUBLISHED' });
  });
});
