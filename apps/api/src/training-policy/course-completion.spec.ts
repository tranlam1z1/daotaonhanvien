import {
  defaultCourseCompletion,
  updateCourseCompletion,
} from './course-completion';

describe('course completion configuration', () => {
  const organization = {
    completion: {
      lessonRequired: true,
      lessonPercent: 85,
      finalScoreRequired: true,
      finalScorePercent: 75,
      attemptLimitEnabled: true,
      maxAttempts: 4,
      practiceRequired: false,
    },
  };

  it('takes a snapshot of the organization defaults for each course', () => {
    const original = defaultCourseCompletion(organization);
    const other = defaultCourseCompletion(organization);
    expect(original).toEqual({ ...organization, learningMode: 'SEQUENTIAL' });

    const completion = {
      lessonRequired: false,
      lessonPercent: 90,
      finalScoreRequired: false,
      finalScorePercent: 80,
      attemptLimitEnabled: false,
      maxAttempts: 2,
      practiceRequired: true,
    };
    const changed = updateCourseCompletion(original, {
      completion,
      learningMode: 'FREE',
    });

    expect(changed).toEqual({ completion, learningMode: 'FREE' });
    expect(other).toEqual({ ...organization, learningMode: 'SEQUENTIAL' });
    expect(original).toEqual(other);
    expect(
      updateCourseCompletion(changed, { learningMode: 'SEQUENTIAL' }),
    ).toEqual({
      completion,
      learningMode: 'SEQUENTIAL',
    });
  });

  it.each([
    { completion: { lessonPercent: 101 } },
    { completion: { finalScorePercent: -1 } },
    { completion: { maxAttempts: 0 } },
    { completion: { practiceRequired: 'true' } },
    { completion: null },
    { learningMode: 'OTHER' },
  ])('rejects invalid input %j', (input) => {
    const current = defaultCourseCompletion(organization);
    expect(() => updateCourseCompletion(current, input)).toThrow();
  });
});
