import { BadRequestException } from '@nestjs/common';
import type { KnowledgeAudience } from '@prisma/client';
import { parseFragment, type DefaultTreeAdapterTypes } from 'parse5';

const uuid = /^[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}$/i;
export function idInput(value: unknown) {
  if (typeof value !== 'string' || !uuid.test(value))
    throw new BadRequestException('Mã tham chiếu không hợp lệ.');
  return value.toLowerCase();
}

export function object(value: unknown) {
  if (value === null || typeof value !== 'object' || Array.isArray(value))
    throw new BadRequestException('Dữ liệu không hợp lệ.');
  return value as Record<string, unknown>;
}

export function text(
  value: unknown,
  max: number,
  label: string,
  required = false,
) {
  if (value === undefined && !required) return '';
  if (
    typeof value !== 'string' ||
    value.length > max ||
    (required && !value.trim()) ||
    value.includes('\0')
  )
    throw new BadRequestException(label + ' không hợp lệ.');
  return value.trim();
}

function ids(value: unknown, max = 100) {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > max)
    throw new BadRequestException('Danh sách tham chiếu không hợp lệ.');
  return [...new Set(value.map(idInput))];
}

function optionalId(value: unknown) {
  return value == null || value === '' ? null : idInput(value);
}

export function reviewInput(body: unknown, reject = false) {
  const data = object(body);
  return {
    token: idInput(data.token),
    reason: reject ? text(data.reason, 2000, 'Lý do từ chối', true) : null,
  };
}

export function taxonomyInput(body: unknown, category: boolean) {
  const data = object(body);
  return {
    name: text(data.name, 160, 'Tên', true),
    parentId: category ? optionalId(data.parentId) : null,
  };
}

const formatting = new Set([
  'p',
  'div',
  'strong',
  'b',
  'em',
  'i',
  'ul',
  'ol',
  'li',
  'h2',
  'h3',
  'blockquote',
]);
const removed = new Set([
  'script',
  'style',
  'textarea',
  'option',
  'xmp',
  'iframe',
  'object',
  'template',
  'noscript',
  'noembed',
  'plaintext',
  'title',
]);

function renderSafeNode(
  node: DefaultTreeAdapterTypes.ChildNode,
  depth: number,
  plain: boolean,
): string {
  if (depth > 32) return '';
  if ('value' in node)
    return plain
      ? node.value
      : node.value
          .replaceAll('&', '&amp;')
          .replaceAll('<', '&lt;')
          .replaceAll('>', '&gt;');
  if (
    !('tagName' in node) ||
    node.namespaceURI !== 'http://www.w3.org/1999/xhtml' ||
    removed.has(node.tagName)
  )
    return '';
  if (node.tagName === 'br') return plain ? ' ' : '<br>';
  const children = node.childNodes
    .map((child) => renderSafeNode(child, depth + 1, plain))
    .join('');
  if (plain) {
    return /^(p|div|ul|ol|li|h2|h3|blockquote)$/.test(node.tagName)
      ? ' ' + children + ' '
      : children;
  }
  // Reconstruct formatting without ever copying attributes or raw markup.
  return formatting.has(node.tagName)
    ? '<' + node.tagName + '>' + children + '</' + node.tagName + '>'
    : children;
}

export function sanitizeKnowledgeHtml(html: string) {
  return parseFragment(html)
    .childNodes.map((node) => renderSafeNode(node, 0, false))
    .join('');
}

export function knowledgeText(html: string) {
  return parseFragment(html)
    .childNodes.map((node) => renderSafeNode(node, 0, true))
    .join('')
    .replace(/\s+/g, ' ')
    .trim();
}

export function readerFilters(query: Record<string, unknown>) {
  return {
    keyword: text(query.q, 200, 'Từ khóa').replace(/\s+/g, ' '),
    categoryId: optionalId(query.categoryId),
    tagId: optionalId(query.tagId),
    departmentId: optionalId(query.departmentId),
  };
}

export function httpsVideo(value: unknown) {
  const raw = text(value ?? '', 2048, 'Liên kết video');
  if (!raw) return null;
  try {
    const url = new URL(raw);
    if (
      !/^https:\/\//i.test(raw) ||
      url.protocol !== 'https:' ||
      url.username ||
      url.password
    )
      throw new Error();
    return url.href;
  } catch {
    throw new BadRequestException('Liên kết video phải là URL HTTPS hợp lệ.');
  }
}

export function draftInput(body: unknown) {
  const data = object(body);
  const { audience } = data;
  const departmentIds = ids(data.departmentIds);
  const positionIds = ids(data.positionIds);
  const validAudience =
    (audience === 'TENANT' && !departmentIds.length && !positionIds.length) ||
    (audience === 'DEPARTMENTS' &&
      departmentIds.length > 0 &&
      !positionIds.length) ||
    (audience === 'POSITIONS' &&
      positionIds.length > 0 &&
      !departmentIds.length);
  if (!validAudience)
    throw new BadRequestException('Vui lòng chọn đúng phạm vi truy cập.');
  const fileIds = ids(data.fileIds, 20);
  const videoFileId = optionalId(data.videoFileId);
  const videoUrl = httpsVideo(data.videoUrl);
  if (videoFileId && (videoUrl || fileIds.includes(videoFileId)))
    throw new BadRequestException(
      'Chọn một video tải lên hoặc một liên kết video.',
    );
  return {
    title: text(data.title, 200, 'Tiêu đề', true),
    summary: text(data.summary, 1000, 'Tóm tắt'),
    bodyHtml: sanitizeKnowledgeHtml(text(data.bodyHtml, 100_000, 'Nội dung')),
    categoryId: optionalId(data.categoryId),
    tagIds: ids(data.tagIds, 30),
    audience: audience as KnowledgeAudience,
    departmentIds,
    positionIds,
    fileIds,
    videoFileId,
    videoUrl,
  };
}
