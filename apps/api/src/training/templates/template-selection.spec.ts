import { selectTemplate } from './template-selection';

describe('published training template selection', () => {
  it('copies a program in source order and retains each copied item identity', () => {
    const selection = selectTemplate('program', 'onboarding')!;
    expect(selection.program?.templateSource).toEqual({
      sourceItemId: 'onboarding',
      sourceVersion: 'onboarding-1',
      customized: false,
    });
    expect(
      selection.courses.map((course) => course.templateSource?.sourceItemId),
    ).toEqual(['first-week', 'teamwork']);
    expect(
      selection.courses[0].modules.map(
        (module) => module.templateSource?.sourceItemId,
      ),
    ).toEqual(['before-starting', 'first-day']);
    expect(
      selection.courses[0].modules[0].lessons.map(
        (lesson) => lesson.templateSource.sourceItemId,
      ),
    ).toEqual(['work-tools', 'contact-person']);
  });

  it('copies only the selected course and its descendants', () => {
    const selection = selectTemplate('course', 'first-week')!;
    expect(selection.program).toBeNull();
    expect(selection.courses).toHaveLength(1);
    expect(selection.courses[0].templateSource?.sourceItemId).toBe(
      'first-week',
    );
    expect(selection.courses[0].modules).toHaveLength(2);
  });

  it('copies a single module with its ordered lessons', () => {
    const {
      courses: [course],
    } = selectTemplate('module', 'before-starting')!;
    expect(course.templateSource).toBeNull();
    expect(course.modules).toHaveLength(1);
    expect(course.modules[0].templateSource?.sourceItemId).toBe(
      'before-starting',
    );
    expect(
      course.modules[0].lessons.map(
        (lesson) => lesson.templateSource.sourceItemId,
      ),
    ).toEqual(['work-tools', 'contact-person']);
  });

  it('copies a single lesson without copying sibling content', () => {
    const {
      courses: [course],
    } = selectTemplate('lesson', 'contact-person')!;
    expect(course.templateSource).toBeNull();
    expect(course.modules).toHaveLength(1);
    expect(course.modules[0].templateSource).toBeNull();
    expect(
      course.modules[0].lessons.map(
        (lesson) => lesson.templateSource.sourceItemId,
      ),
    ).toEqual(['contact-person']);
  });

  it('rejects unknown source IDs and IDs at the wrong level', () => {
    expect(selectTemplate('module', 'work-tools')).toBeNull();
    expect(selectTemplate('lesson', 'unknown')).toBeNull();
  });

  it('returns independent values for each copy', () => {
    const first = selectTemplate('lesson', 'work-tools')!;
    first.courses[0].modules[0].lessons[0].body = 'Changed';
    first.courses[0].modules[0].lessons[0].templateSource.customized = true;
    const second = selectTemplate('lesson', 'work-tools')!;
    expect(second.courses[0].modules[0].lessons[0].body).not.toBe('Changed');
    expect(
      second.courses[0].modules[0].lessons[0].templateSource.customized,
    ).toBe(false);
  });
});
