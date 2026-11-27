import 'reflect-metadata';
import 'dotenv/config';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import { hash } from 'argon2';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { AppModule } from '../app.module';
import { webOrigin } from '../auth/auth-policy';
import { LeadInfrastructure } from '../leads/leads.infrastructure';
import { TenantDatabase } from '../tenant/tenant-database';
import {
  createTenantFixture,
  removeTenantFixture,
} from '../testing/tenant-fixture';

const integration =
  process.env.TENANT_INTEGRATION_TEST === 'true' ? describe : describe.skip;
const password = 'TestPassword36!';

integration('T11 knowledge drafts', () => {
  const root = new PrismaClient();
  let app: INestApplication;
  let own: Awaited<ReturnType<typeof createTenantFixture>>;
  let other: typeof own;
  let secondaryDepartment: string;
  let admin: string;
  let otherAdmin: string;
  let trainer: string;
  let employee: string;

  function api(
    method: 'get' | 'post' | 'patch' | 'delete',
    route: string,
    cookie = admin,
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

  async function file(
    tenantId: string,
    createdBy: string,
    contentType = 'application/pdf',
  ) {
    const id = randomUUID();
    return root.fileObject.create({
      data: {
        id,
        tenantId,
        createdBy,
        contentType,
        name: 'Tệp T11',
        sizeBytes: 42n,
        storageKey: tenantId + '/' + id,
      },
    });
  }

  const draft = (data: Record<string, unknown> = {}) => ({
    title: 'Kiến thức T11',
    summary: 'Tóm tắt',
    bodyHtml: '<p>Nội dung <strong>đậm</strong></p>',
    audience: 'TENANT',
    ...data,
  });

  beforeAll(async () => {
    const passwordHash = await hash(password);
    own = await createTenantFixture(root, passwordHash);
    other = await createTenantFixture(root, passwordHash);
    const department = await root.department.create({
      data: { tenantId: own.tenantId, name: 'Khác' },
    });
    secondaryDepartment = department.id;
    await root.userRole.create({
      data: {
        tenantId: own.tenantId,
        userId: own.users[2].id,
        role: 'PTDT',
        departmentIds: [own.department.id],
      },
    });
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(LeadInfrastructure)
      .useValue({})
      .compile();
    app = module.createNestApplication();
    await app.init();
    [admin, otherAdmin, trainer, employee] = await Promise.all([
      login(own.users[0].email),
      login(other.users[0].email),
      login(own.users[2].email),
      login(own.users[1].email),
    ]);
  });

  afterAll(async () => {
    try {
      for (const fixture of [own, other]) {
        if (!fixture) continue;
        const where = { tenantId: fixture.tenantId };
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

  it('manages a category tree and tags and blocks moving a category below itself or a descendant', async () => {
    const prefix = '/editor/catalog/';
    const parent = (
      await api('post', prefix + 'categories')
        .send({ name: 'Quy trình' })
        .expect(201)
    ).body.id;
    const child = (
      await api('post', prefix + 'categories')
        .send({ name: 'Vận hành', parentId: parent })
        .expect(201)
    ).body.id;
    const tag = (
      await api('post', prefix + 'tags')
        .send({ name: 'Thẻ' })
        .expect(201)
    ).body.id;
    await api('patch', prefix + 'categories/' + parent)
      .send({ name: 'Vòng lặp', parentId: child })
      .expect(400);
    await api('patch', prefix + 'categories/' + child)
      .send({ name: 'Vòng lặp', parentId: child })
      .expect(400);
    await api('delete', prefix + 'categories/' + parent).expect(409);
    await api('patch', prefix + 'categories/' + child)
      .send({ name: 'Vận hành mới', parentId: parent })
      .expect(200);
    await api('patch', prefix + 'tags/' + tag)
      .send({ name: 'Thẻ mới' })
      .expect(200);
    const list = (await api('get', '/editor').expect(200)).body;
    expect(list.categories).toContainEqual({
      id: child,
      name: 'Vận hành mới',
      parentId: parent,
    });
    expect(list.tags).toContainEqual({ id: tag, name: 'Thẻ mới' });
    await api('delete', prefix + 'categories/' + child).expect(200);
    await api('delete', prefix + 'tags/' + tag).expect(200);
  });

  it('saves and reopens a draft with taxonomy, attachments and scope, and allows only linked downloads', async () => {
    const categoryId = (
      await api('post', '/editor/catalog/categories')
        .send({ name: 'Cẩm nang' })
        .expect(201)
    ).body.id;
    const tagId = (
      await api('post', '/editor/catalog/tags')
        .send({ name: 'Nội bộ' })
        .expect(201)
    ).body.id;
    const pdf = await file(own.tenantId, own.users[0].id);
    const video = await file(own.tenantId, own.users[0].id, 'video/mp4');
    const unlinked = await file(own.tenantId, own.users[1].id);
    const input = draft({
      categoryId,
      tagIds: [tagId],
      audience: 'DEPARTMENTS',
      departmentIds: [own.department.id],
      fileIds: [pdf.id],
      videoFileId: video.id,
      status: 'PUBLISHED',
    });
    const saved = (await api('post', '/editor/drafts').send(input).expect(201))
      .body;
    const route = '/editor/drafts/' + saved.itemId;
    const reopened = (await api('get', route).expect(200)).body;
    expect(reopened).toMatchObject({
      categoryId,
      tagIds: [tagId],
      audience: 'DEPARTMENTS',
      departmentIds: [own.department.id],
      attachments: expect.arrayContaining([
        {
          video: false,
          file: { id: pdf.id, name: pdf.name, contentType: pdf.contentType },
        },
        {
          video: true,
          file: {
            id: video.id,
            name: video.name,
            contentType: video.contentType,
          },
        },
      ]),
    });
    await api('get', route + '/files/' + unlinked.id).expect(404);
    await api('get', route + '/files/' + pdf.id, employee).expect(403);
    await api('get', '/read/' + saved.itemId, employee).expect(404);
    await api('get', '/read/' + saved.itemId).expect(404);
    await api('delete', '/editor/catalog/categories/' + categoryId).expect(409);
    await api('delete', '/editor/catalog/tags/' + tagId).expect(409);
    await api('patch', route)
      .send({
        ...input,
        videoFileId: null,
        videoUrl: 'https://example.test/video',
        audience: 'POSITIONS',
        departmentIds: [],
        positionIds: [own.position.id],
      })
      .expect(200);
    expect((await api('get', route).expect(200)).body).toMatchObject({
      audience: 'POSITIONS',
      positionIds: [own.position.id],
      videoUrl: 'https://example.test/video',
      attachments: [{ video: false }],
    });
    await api('patch', route)
      .send({ ...input, fileIds: [unlinked.id] })
      .expect(400);
    await api('patch', route)
      .send({ ...input, videoFileId: pdf.id, fileIds: [] })
      .expect(400);
  });

  it('prevents editing outside a scoped PTDT grant and keeps drafts out of the reader API', async () => {
    const allowed = draft({
      audience: 'DEPARTMENTS',
      departmentIds: [own.department.id],
    });
    const restricted = (
      await api('post', '/editor/drafts').send(draft()).expect(201)
    ).body;
    const mixed = (
      await api('post', '/editor/drafts')
        .send({
          ...allowed,
          departmentIds: [own.department.id, secondaryDepartment],
        })
        .expect(201)
    ).body;
    await api('post', '/editor/drafts', trainer).send(draft()).expect(403);
    await api('post', '/editor/drafts', trainer)
      .send({ ...allowed, departmentIds: [secondaryDepartment] })
      .expect(403);
    await api('post', '/editor/drafts', trainer)
      .send({
        ...allowed,
        departmentIds: [own.department.id, secondaryDepartment],
      })
      .expect(403);
    const created = (
      await api('post', '/editor/drafts', trainer).send(allowed).expect(201)
    ).body;
    const list = (await api('get', '/editor', trainer).expect(200)).body;
    expect(list.departments).toEqual([
      { id: own.department.id, name: own.department.name },
    ]);
    const draftIds = list.drafts.map(
      ({ itemId }: { itemId: string }) => itemId,
    );
    expect(draftIds).toContain(created.itemId);
    expect(draftIds).not.toContain(restricted.itemId);
    expect(draftIds).not.toContain(mixed.itemId);
    await api('patch', '/editor/drafts/' + restricted.itemId, trainer)
      .send(allowed)
      .expect(404);
    await api('patch', '/editor/drafts/' + created.itemId, trainer)
      .send(draft())
      .expect(403);
    await api('patch', '/editor/drafts/' + created.itemId, trainer)
      .send({ ...allowed, title: 'Sửa trong phạm vi' })
      .expect(200);
    await api('post', '/editor/catalog/categories', trainer)
      .send({ name: 'Không được phép' })
      .expect(403);
    await api('get', '/editor', employee).expect(403);
    await api('get', '/editor/drafts/' + created.itemId, employee).expect(403);
    await api('get', '/read/' + created.itemId, employee).expect(404);

    // A published fixture represents the read boundary. T11 exposes no publish action.
    await root.knowledgeVersion.updateMany({
      where: { itemId: created.itemId },
      data: { status: 'PUBLISHED' },
    });
    await api('get', '/read/' + created.itemId, employee).expect(200);
    await root.knowledgeVersion.updateMany({
      where: { itemId: created.itemId },
      data: { departmentIds: [secondaryDepartment] },
    });
    await api('get', '/read/' + created.itemId, employee).expect(404);
    await api('patch', '/editor/drafts/' + created.itemId, trainer)
      .send(allowed)
      .expect(404);
  });

  it('isolates editor, reader, file links and taxonomy across tenants', async () => {
    const category = (
      await api('post', '/editor/catalog/categories', otherAdmin)
        .send({ name: 'Danh mục B' })
        .expect(201)
    ).body;
    const tag = (
      await api('post', '/editor/catalog/tags', otherAdmin)
        .send({ name: 'Thẻ B' })
        .expect(201)
    ).body;
    const foreign = await file(other.tenantId, other.users[0].id);
    const created = (
      await api('post', '/editor/drafts', otherAdmin)
        .send(
          draft({
            categoryId: category.id,
            tagIds: [tag.id],
            fileIds: [foreign.id],
          }),
        )
        .expect(201)
    ).body;
    const route = '/editor/drafts/' + created.itemId;
    await api('get', route).expect(404);
    await api('patch', route).send(draft()).expect(404);
    await api('get', route + '/files/' + foreign.id).expect(404);
    await api('get', '/read/' + created.itemId).expect(404);
    for (const [kind, id] of [
      ['categories', category.id],
      ['tags', tag.id],
    ]) {
      await api('patch', '/editor/catalog/' + kind + '/' + id)
        .send({ name: 'Sửa chéo' })
        .expect(404);
      await api('delete', '/editor/catalog/' + kind + '/' + id).expect(404);
    }
    await api('post', '/editor/catalog/categories')
      .send({ name: 'Con', parentId: category.id })
      .expect(400);
    const invalidReferences = [
      { categoryId: category.id },
      { tagIds: [tag.id] },
      { fileIds: [foreign.id] },
      { audience: 'DEPARTMENTS', departmentIds: [other.department.id] },
      { audience: 'POSITIONS', positionIds: [other.position.id] },
    ];
    const target = (
      await api('post', '/editor/drafts')
        .send(draft({ tenantId: other.tenantId }))
        .expect(201)
    ).body;
    await api('get', '/editor/drafts/' + target.itemId, otherAdmin).expect(404);
    for (const value of invalidReferences) {
      await api('post', '/editor/drafts').send(draft(value)).expect(400);
      await api('patch', '/editor/drafts/' + target.itemId)
        .send(draft(value))
        .expect(400);
    }
    const editor = (
      await api('get', '/editor?tenantId=' + other.tenantId).expect(200)
    ).body;
    expect(editor.categories).not.toContainEqual(category);
    expect(editor.tags).not.toContainEqual(tag);
    expect(
      editor.drafts.some(
        ({ itemId }: { itemId: string }) => itemId === created.itemId,
      ),
    ).toBe(false);

    await app.get(TenantDatabase).run(own.tenantId, async () => {
      expect(
        await app
          .get(TenantDatabase)
          .client.knowledgeAttachment.findMany({
            where: { fileId: foreign.id },
          }),
      ).toEqual([]);
      expect(
        await app
          .get(TenantDatabase)
          .client.knowledgeVersion.findMany({
            where: { itemId: created.itemId },
          }),
      ).toEqual([]);
    });
  });

  it('filters draft rich text on save and rejects unsafe video links', async () => {
    const html =
      '<p onclick="window.t11=1"><strong>An toàn</strong><img src=x onerror="window.t11=1"></p><script>window.t11=1</script><svg><foreignObject><p>ẩn</p></foreignObject></svg><a href="javascript:void(0)">chữ</a>';
    const response = await api('post', '/editor/drafts')
      .send(draft({ bodyHtml: html }))
      .expect(201);
    expect(response.body.bodyHtml).toBe('<p><strong>An toàn</strong></p>chữ');
    const persisted = await root.knowledgeVersion.findFirstOrThrow({
      where: { itemId: response.body.itemId },
    });
    expect(persisted.bodyHtml).toBe(response.body.bodyHtml);
    expect(
      (await api('get', '/editor/drafts/' + response.body.itemId).expect(200))
        .body.bodyHtml,
    ).toBe(response.body.bodyHtml);
    await api('post', '/editor/drafts')
      .send(draft({ videoUrl: 'javascript:void(0)' }))
      .expect(400);
  });
});
