const MINUTES_PER_HOUR = 60;
const HOURS_PER_DAY = 24;

type ScheduledCourse = {
  modules: readonly {
    lessons: readonly { durationMinutes: number }[];
  }[];
};

export function courseDurationMinutes(course: ScheduledCourse): number {
  return course.modules.reduce(
    (total, module) =>
      module.lessons.reduce(
        (subtotal, lesson) => subtotal + lesson.durationMinutes,
        total,
      ),
    0,
  );
}

export function programDuration(program: {
  targetDuration: number;
  targetUnit: 'DAYS' | 'HOURS';
  courses: readonly { course: ScheduledCourse }[];
}) {
  const totalDurationMinutes = program.courses.reduce(
    (total, { course }) => total + courseDurationMinutes(course),
    0,
  );
  const minutesPerUnit =
    program.targetUnit === 'DAYS'
      ? HOURS_PER_DAY * MINUTES_PER_HOUR
      : MINUTES_PER_HOUR;
  const targetDurationMinutes = program.targetDuration * minutesPerUnit;

  return {
    totalDurationMinutes,
    targetDurationMinutes,
    exceedsTarget: totalDurationMinutes > targetDurationMinutes,
  };
}
