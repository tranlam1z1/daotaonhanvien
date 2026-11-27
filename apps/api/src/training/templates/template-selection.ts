import { onboardingRelease, type TemplateRelease } from './template-fixture';

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

function source(item: { id: string }, version: string): TemplateSource {
  return {
    sourceItemId: item.id,
    sourceVersion: version,
    customized: false,
  };
}

function copyLesson(lesson: Lesson, version: string) {
  return {
    name: lesson.name,
    durationMinutes: lesson.durationMinutes,
    type: lesson.type,
    body: lesson.body,
    templateSource: source(lesson, version),
  };
}

function copyModule(
  module: Module,
  version: string,
  lessons = module.lessons,
  withSource = true,
) {
  return {
    name: module.name,
    lessons: lessons.map((lesson) => copyLesson(lesson, version)),
    templateSource: withSource ? source(module, version) : null,
  };
}

function copyCourse(
  course: Course,
  version: string,
  modules = course.modules.map((module) => copyModule(module, version)),
  withSource = true,
) {
  return {
    name: course.name,
    description: course.description,
    modules,
    templateSource: withSource ? source(course, version) : null,
  };
}

export function selectTemplate(
  level: TemplateLevel,
  id: string,
  release: TemplateRelease = onboardingRelease,
) {
  const { program, version } = release;
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
        templateSource: source(program, version),
      },
      courses: courses.map((course) => copyCourse(course, version)),
    };
  }

  for (const course of program.courses) {
    if (level === 'course' && id === course.id) {
      return { program: null, courses: [copyCourse(course, version)] };
    }
    for (const module of course.modules) {
      if (level === 'module' && id === module.id) {
        return {
          program: null,
          courses: [
            copyCourse(course, version, [copyModule(module, version)], false),
          ],
        };
      }
      if (level === 'lesson') {
        const lesson = module.lessons.find((entry) => entry.id === id);
        if (lesson) {
          const moduleCopy = copyModule(module, version, [lesson], false);
          return {
            program: null,
            courses: [copyCourse(course, version, [moduleCopy], false)],
          };
        }
      }
    }
  }

  return null;
}
