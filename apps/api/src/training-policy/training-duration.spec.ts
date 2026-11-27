import { courseDurationMinutes, programDuration } from './training-duration';

describe('training duration', () => {
  it.each([
    ['HOURS', 60],
    ['DAYS', 1440],
  ] as const)('warns only above the %s target', (targetUnit, targetMinutes) => {
    const lesson = { durationMinutes: targetMinutes };
    const course = { modules: [{ lessons: [lesson] }] };
    const program = { targetDuration: 1, targetUnit, courses: [{ course }] };

    expect(programDuration(program)).toEqual({
      totalDurationMinutes: targetMinutes,
      targetDurationMinutes: targetMinutes,
      exceedsTarget: false,
    });

    lesson.durationMinutes += 1;
    expect(programDuration(program)).toEqual({
      totalDurationMinutes: targetMinutes + 1,
      targetDurationMinutes: targetMinutes,
      exceedsTarget: true,
    });
  });

  it('uses the current lessons and course membership for every calculation', () => {
    const lesson = { durationMinutes: 40 };
    const course = { modules: [{ lessons: [lesson] }, { lessons: [] }] };
    const otherCourse = { modules: [{ lessons: [{ durationMinutes: 20 }] }] };
    const target = { targetDuration: 2, targetUnit: 'HOURS' } as const;
    const first = { ...target, courses: [{ course }, { course: otherCourse }] };
    const second = { ...target, courses: [{ course }] };

    expect(courseDurationMinutes(course)).toBe(40);
    expect(programDuration(first).totalDurationMinutes).toBe(60);
    expect(programDuration(second).totalDurationMinutes).toBe(40);

    course.modules[1].lessons.push({ durationMinutes: 15 });
    expect(courseDurationMinutes(course)).toBe(55);
    expect(programDuration(first).totalDurationMinutes).toBe(75);
    expect(programDuration(second).totalDurationMinutes).toBe(55);

    course.modules[0].lessons.pop();
    first.courses.pop();
    expect(courseDurationMinutes(course)).toBe(15);
    expect(programDuration(first).totalDurationMinutes).toBe(15);
    expect(programDuration(second).totalDurationMinutes).toBe(15);
  });
});
