type TemplateLesson = {
  id: string;
  name: string;
  durationMinutes: number;
  type: 'TEXT';
  body: string;
};

type TemplateModule = {
  id: string;
  name: string;
  lessons: readonly TemplateLesson[];
};

type TemplateCourse = {
  id: string;
  name: string;
  description: string;
  modules: readonly TemplateModule[];
};

type TemplateProgram = {
  id: string;
  name: string;
  description: string;
  audience: string;
  type: 'ONBOARDING';
  targetDuration: number;
  targetUnit: 'HOURS';
  courses: readonly TemplateCourse[];
};

type TemplateRelease = {
  version: string;
  program: TemplateProgram;
};

// Published Phase 1 fixture. Identity is independent of both position and display text.
export const onboardingRelease: TemplateRelease = {
  version: 'onboarding-1',
  program: {
    id: 'onboarding',
    name: 'Hội nhập nhân viên mới',
    description: 'Giới thiệu công việc và cách phối hợp trong tuần đầu tiên.',
    audience: 'Nhân viên mới',
    type: 'ONBOARDING',
    targetDuration: 2,
    targetUnit: 'HOURS',
    courses: [
      {
        id: 'first-week',
        name: 'Tuần làm việc đầu tiên',
        description: 'Chuẩn bị và trao đổi với người phụ trách.',
        modules: [
          {
            id: 'before-starting',
            name: 'Chuẩn bị trước khi bắt đầu',
            lessons: [
              {
                id: 'work-tools',
                name: 'Công cụ làm việc',
                durationMinutes: 15,
                type: 'TEXT',
                body: 'Kiểm tra tài khoản và thiết bị được cấp theo hướng dẫn của doanh nghiệp.',
              },
              {
                id: 'contact-person',
                name: 'Người hỗ trợ',
                durationMinutes: 10,
                type: 'TEXT',
                body: 'Xác nhận người hỗ trợ và kênh liên lạc khi cần trợ giúp.',
              },
            ],
          },
          {
            id: 'first-day',
            name: 'Ngày làm việc đầu tiên',
            lessons: [
              {
                id: 'first-meeting',
                name: 'Buổi trao đổi đầu tiên',
                durationMinutes: 20,
                type: 'TEXT',
                body: 'Trao đổi với quản lý về công việc, mục tiêu tuần đầu và lịch phản hồi.',
              },
            ],
          },
        ],
      },
      {
        id: 'teamwork',
        name: 'Phối hợp trong nhóm',
        description: 'Thống nhất cách chia sẻ thông tin trong công việc.',
        modules: [
          {
            id: 'communication',
            name: 'Trao đổi công việc',
            lessons: [
              {
                id: 'progress-update',
                name: 'Cập nhật tiến độ',
                durationMinutes: 15,
                type: 'TEXT',
                body: 'Nêu việc đã hoàn thành, trở ngại và bước tiếp theo khi báo cáo tiến độ.',
              },
            ],
          },
        ],
      },
    ],
  },
};
