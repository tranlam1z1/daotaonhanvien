import { expect, test, type APIRequestContext } from '@playwright/test';

const api = 'http://localhost:4000';
const origin = 'http://localhost:3000';
const password = process.env.SEED_PASSWORD ?? 'EduCore36Local!';

async function signIn(client: APIRequestContext, identifier: string) {
  const response = await client.post(api + '/auth/login', {
    headers: { Origin: origin },
    data: { identifier, password },
  });
  await expect(response).toBeOK();
}

test.describe('T23 learning at 360px', () => {
  test.skip(
    process.env.WORKSPACE_E2E !== 'true',
    'Requires a seeded PostgreSQL test database',
  );
  test.use({ viewport: { width: 360, height: 800 } });

  test('completes an assigned sequential course and submits the optional survey', async ({
    page,
    playwright,
  }) => {
    test.setTimeout(75_000);
    const headers = { Origin: origin };
    const admin = await playwright.request.newContext({
      extraHTTPHeaders: headers,
    });
    const reviewer = await playwright.request.newContext({
      extraHTTPHeaders: headers,
    });
    const name = 'Khóa học tuần tự ' + Date.now();
    try {
      await Promise.all([
        signIn(admin, 'adm@demo-a.example'),
        signIn(reviewer, 'pd@demo-a.example'),
      ]);
      const question = await admin.post(api + '/assessments/questions', {
        data: {
          topic: name,
          prompt: 'Câu hỏi cuối khóa',
          type: 'SINGLE_CHOICE',
          options: ['Phương án đúng', 'Phương án sai'],
          correctOptions: [1],
        },
      });
      await expect(question).toBeOK();
      const quiz = await admin.post(api + '/assessments/quizzes', {
        data: {
          name,
          selectionMode: 'FIXED',
          timeLimitMinutes: 5,
          passingScore: 70,
          maxAttempts: 2,
          shuffleQuestions: false,
          shuffleOptions: false,
          showAnswers: false,
          questionIds: [(await question.json()).id],
        },
      });
      await expect(quiz).toBeOK();
      const { id: quizId } = (await quiz.json()) as { id: string };
      const draft = await admin.post(api + '/training/editor/courses', {
        data: {
          name,
          description: '',
          modules: [
            {
              name: 'Bắt đầu',
              lessons: [
                ...['Bài thứ nhất', 'Bài thứ hai'].map((title) => ({
                  type: 'TEXT',
                  name: title,
                  durationMinutes: 5,
                  body: 'Nội dung ' + title,
                })),
                {
                  type: 'QUIZ',
                  name: 'Thi cuối khóa',
                  quizId,
                  durationMinutes: 5,
                },
              ],
            },
          ],
        },
      });
      await expect(draft).toBeOK();
      const { id, revision } = (await draft.json()) as {
        id: string;
        revision: number;
      };
      const submitted = await admin.post(
        api + '/training/editor/courses/' + id + '/workflow/submit',
        {
          data: { revision },
        },
      );
      await expect(submitted).toBeOK();
      const { reviewToken } = (await submitted.json()) as {
        reviewToken: string;
      };
      await expect(
        await reviewer.post(
          api + '/training/reviews/courses/' + id + '/approve',
          {
            data: { token: reviewToken },
          },
        ),
      ).toBeOK();

      const options = await admin.get(api + '/assignments/options');
      await expect(options).toBeOK();
      const { employees } = (await options.json()) as {
        employees: { id: string; employeeCode: string }[];
      };
      const learner = employees.find(
        ({ employeeCode }) => employeeCode === 'NV003',
      );
      expect(learner).toBeDefined();
      const dueDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
        .toISOString()
        .slice(0, 10);
      await expect(
        await admin.post(api + '/assignments', {
          data: {
            kind: 'course',
            targetId: id,
            userIds: [learner!.id],
            dueDate,
          },
        }),
      ).toBeOK();

      await signIn(page.request, 'nv2@demo-a.example');
      await page.goto('/ung-dung/hoc-tap');
      await expect(
        page.getByRole('heading', { name: 'Việc học của tôi' }),
      ).toBeVisible();
      const card = page.getByRole('listitem').filter({
        has: page.getByRole('heading', { name, exact: true }),
      });
      await card.getByRole('button', { name: 'Mở khóa học' }).click();
      const second = page.getByRole('button', { name: /^Bài thứ hai/ });
      await expect(second).toBeDisabled();
      await page.getByRole('button', { name: /^Bài thứ nhất/ }).click();
      await expect(
        page.getByText('Nội dung Bài thứ nhất', { exact: true }),
      ).toBeVisible();
      await page
        .getByRole('button', { name: 'Đã học xong', exact: true })
        .click();
      await expect(second).toBeEnabled();
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth),
      ).toBe(360);
      await page.getByRole('button', { name: 'Về danh sách' }).click();
      await expect(card).toContainText('33%');
      await page.reload();
      await card.getByRole('button', { name: 'Mở khóa học' }).click();
      await page.getByRole('button', { name: 'Tiếp tục học' }).click();
      await expect(
        page.getByText('Nội dung Bài thứ hai', { exact: true }),
      ).toBeVisible();
      await page
        .getByRole('button', { name: 'Đã học xong', exact: true })
        .click();
      await page.getByRole('button', { name: /^Thi cuối khóa/ }).click();
      await page.getByRole('button', { name: 'Bắt đầu làm bài' }).click();
      await page.getByRole('radio', { name: 'Phương án đúng' }).click();
      await expect(
        page.getByRole('radio', { name: 'Phương án đúng' }),
      ).toBeChecked();
      await page.getByRole('button', { name: 'Nộp bài' }).click();
      await expect(page.getByText('Lần 1 · 100% · Đạt')).toBeVisible();
      await page.getByRole('button', { name: 'Mở khảo sát tùy chọn' }).click();
      const survey = page
        .getByRole('heading', { name: 'Khảo sát chất lượng khóa học' })
        .locator('..');
      await expect(survey.getByRole('combobox')).toHaveCount(3);
      for (const field of await survey.getByRole('combobox').all())
        await field.selectOption('5');
      await survey.getByRole('button', { name: 'Gửi đánh giá' }).click();
      await expect(survey.getByText('Đã gửi đánh giá.')).toBeVisible();
      await page.getByRole('button', { name: 'Về danh sách' }).click();
      await expect(card).toContainText('Điểm kiểm tra cuối khóa 100%');
    } finally {
      await Promise.all([admin.dispose(), reviewer.dispose()]);
    }
  });
});
