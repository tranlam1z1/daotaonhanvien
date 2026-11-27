import { onboardingRelease } from './template-fixture';

export type TemplateLevel = 'program' | 'course' | 'module' | 'lesson';

export type TemplateSource = {
  sourceItemId: string;
  sourceVersion: string;
  customized: boolean;
};

type Program = typeof onboardingRelease.program;
type Course = Program['courses'][number];
type Module = Course['modules'][number];
type Lesson = Module['lessons'][number];

function source(item: { id: string }): TemplateSource {
  return {
    sourceItemId: item.id,
    sourceVersion: onboardingRelease.version,
    customized: false,
  };
}

function copyLesson(lesson: Lesson) {
  return {
    name: lesson.name,
    durationMinutes: lesson.durationMinutes,
    type: lesson.type,
    body: lesson.body,
    templateSource: source(lesson),
  };
}

function copyModule(
  module: Module,
  lessons = module.lessons,
  withSource = true,
) {
  return {
    name: module.name,
    lessons: lessons.map(copyLesson),
    templateSource: withSource ? source(module) : null,
  };
}

function copyCourse(
  course: Course,
  modules = course.modules.map((module) => copyModule(module)),
  withSource = true,
) {
  return {
    name: course.name,
    description: course.description,
    modules,
    templateSource: withSource ? source(course) : null,
  };
}

export function selectTemplate(level: TemplateLevel, id: string) {
  const program = onboardingRelease.program;
  if (level === 'program' && id === program.id) {
    const {
      name,
      description,
      audience,
      type,
      targetDuration,
      targetUnit,
      courses,
    } = program;
    return {
      program: {
        name,
        description,
        audience,
        type,
        targetDuration,
        targetUnit,
        templateSource: source(program),
      },
      courses: courses.map((course) => copyCourse(course)),
    };
  }

  for (const course of program.courses) {
    if (level === 'course' && id === course.id) {
      return { program: null, courses: [copyCourse(course)] };
    }
    for (const module of course.modules) {
      if (level === 'module' && id === module.id) {
        return {
          program: null,
          courses: [copyCourse(course, [copyModule(module)], false)],
        };
      }
      if (level === 'lesson') {
        const lesson = module.lessons.find((entry) => entry.id === id);
        if (lesson) {
          const moduleCopy = copyModule(module, [lesson], false);
          return {
            program: null,
            courses: [copyCourse(course, [moduleCopy], false)],
          };
        }
      }
    }
  }

  return null;
}
