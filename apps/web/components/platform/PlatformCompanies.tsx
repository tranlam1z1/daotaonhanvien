'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button, EmptyState, Input, Table, Toast } from '../ui/controls';
import {
  Options,
  PlatformPanel,
  RequestState,
  SaveForm,
  SelectField,
} from './PlatformForms';
import { PlatformBilling } from './PlatformBilling';
import {
  companyStatus,
  message,
  moneyLabel,
  planCycles,
  platformRequest,
  usePlatformData,
  type Company,
  type Lead,
  type Plan,
} from './platform-data';

export function PlatformCompanies({ pilot }: { pilot?: string }) {
  const companies = usePlatformData<Company[]>('companies');
  const plans = usePlatformData<Plan[]>('plans');
  const router = useRouter();
  const [selected, setSelected] = useState<string>();
  const [editor, setEditor] = useState<Company | 'new'>();
  const [planEditor, setPlanEditor] = useState<Plan | 'new'>();
  const [notice, setNotice] = useState<{ text: string; error?: boolean }>();
  const [inviting, setInviting] = useState(false);
  const active = companies.data?.find((company) => company.id === selected);

  function closeEditor() {
    setEditor(undefined);
    if (pilot) router.replace('/ung-dung/doanh-nghiep');
  }

  async function saveCompany(data: object, company?: Company) {
    const result = company
      ? await platformRequest<{ id: string }>(
          'companies/' + company.id,
          'PATCH',
          data,
        )
      : await platformRequest<{ id: string; invitationSent: boolean }>(
          'companies',
          'POST',
          data,
        );
    const failed = 'invitationSent' in result && !result.invitationSent;
    setNotice({
      text: failed
        ? 'Đã tạo doanh nghiệp. Chưa gửi được email mời. Bạn có thể gửi lại trong trang chi tiết.'
        : company
          ? 'Đã lưu doanh nghiệp.'
          : 'Đã tạo doanh nghiệp và gửi email mời.',
      error: failed,
    });
    setSelected(result.id);
    companies.refresh();
    closeEditor();
  }

  return (
    <>
      <PlatformPanel title="Danh sách doanh nghiệp">
        <Button
          onClick={() => {
            if (pilot) router.replace('/ung-dung/doanh-nghiep');
            setEditor('new');
          }}
        >
          Tạo doanh nghiệp
        </Button>
        {!companies.data ? (
          <RequestState error={companies.error} />
        ) : companies.data.length ? (
          <Table
            caption="Doanh nghiệp"
            headers={['Doanh nghiệp', 'Mã đăng nhập', 'Trạng thái', 'Thao tác']}
          >
            {companies.data.map((company) => (
              <tr key={company.id}>
                <td className="min-w-32 break-words font-semibold">
                  {company.name}
                </td>
                <td className="break-all">{company.loginCode}</td>
                <td>{companyStatus[company.status]}</td>
                <td>
                  <Button
                    variant="secondary"
                    onClick={() => setSelected(company.id)}
                  >
                    Chi tiết
                  </Button>
                </td>
              </tr>
            ))}
          </Table>
        ) : (
          <EmptyState title="Chưa có doanh nghiệp" />
        )}
      </PlatformPanel>

      {pilot ? (
        <PilotCompanyForm
          key={pilot}
          id={pilot}
          onSave={saveCompany}
          onCancel={closeEditor}
        />
      ) : (
        editor && (
          <CompanyForm
            key={editor === 'new' ? 'new' : editor.id}
            company={editor === 'new' ? undefined : editor}
            onCancel={closeEditor}
            onSave={saveCompany}
          />
        )
      )}

      {active && (
        <PlatformPanel title={active.name}>
          <dl className="grid gap-3 break-words text-sm sm:grid-cols-2">
            <div>
              <dt className="font-semibold">Mã số thuế</dt>
              <dd>{active.taxCode || '—'}</dd>
            </div>
            <div>
              <dt className="font-semibold">Địa chỉ</dt>
              <dd>{active.address || '—'}</dd>
            </div>
            <div>
              <dt className="font-semibold">Người liên hệ</dt>
              <dd>{active.contactName || '—'}</dd>
            </div>
            <div>
              <dt className="font-semibold">Số điện thoại</dt>
              <dd>{active.contactPhone || '—'}</dd>
            </div>
          </dl>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="secondary"
              onClick={() => {
                if (pilot) router.replace('/ung-dung/doanh-nghiep');
                setEditor(active);
              }}
            >
              Sửa doanh nghiệp
            </Button>
            {active.canInvite && active.status === 'ACTIVE' && (
              <Button
                variant="secondary"
                disabled={inviting}
                onClick={async () => {
                  setInviting(true);
                  try {
                    await platformRequest(
                      'companies/' + active.id + '/invitation',
                      'POST',
                    );
                    setNotice({ text: 'Đã gửi email mời.' });
                  } catch (error) {
                    setNotice({ text: message(error), error: true });
                  } finally {
                    setInviting(false);
                  }
                }}
              >
                Gửi lại lời mời
              </Button>
            )}
          </div>
          <details key={active.id + active.status} className="space-y-2">
            <summary className="w-fit cursor-pointer font-semibold text-blue-700">
              {active.status === 'ACTIVE'
                ? 'Tạm ngừng doanh nghiệp'
                : 'Kích hoạt lại doanh nghiệp'}
            </summary>
            <SaveForm
              label="Xác nhận"
              onSave={async () => {
                const status =
                  active.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
                await platformRequest(
                  'companies/' + active.id + '/status',
                  'PATCH',
                  { status },
                );
                companies.refresh();
                setNotice({ text: 'Đã cập nhật trạng thái doanh nghiệp.' });
              }}
            >
              <p className="text-sm text-slate-700">
                {active.status === 'ACTIVE'
                  ? 'Tài khoản của doanh nghiệp sẽ mất quyền truy cập khi doanh nghiệp tạm ngừng.'
                  : 'Các tài khoản đang hoạt động có thể truy cập lại.'}
              </p>
            </SaveForm>
          </details>
          {plans.data ? (
            <PlatformBilling
              key={active.id}
              id={active.id}
              plans={plans.data}
              onSaved={(text) => setNotice({ text })}
            />
          ) : (
            <RequestState error={plans.error} />
          )}
        </PlatformPanel>
      )}

      <PlatformPanel title="Danh mục gói thuê bao">
        <Button onClick={() => setPlanEditor('new')}>Tạo gói</Button>
        {!plans.data ? (
          <RequestState error={plans.error} />
        ) : plans.data.length ? (
          <Table
            caption="Gói thuê bao"
            headers={[
              'Tên gói',
              'Tài khoản',
              'Dung lượng',
              'Giá',
              'Chu kỳ',
              'Thao tác',
            ]}
          >
            {plans.data.map((plan) => (
              <tr key={plan.id}>
                <td className="font-semibold">{plan.name}</td>
                <td>{plan.maxAccounts}</td>
                <td>{plan.storageGb} GB</td>
                <td className="whitespace-nowrap">{moneyLabel(plan.price)}</td>
                <td>{planCycles[plan.cycle]}</td>
                <td>
                  <Button
                    variant="secondary"
                    onClick={() => setPlanEditor(plan)}
                  >
                    Sửa
                  </Button>
                </td>
              </tr>
            ))}
          </Table>
        ) : (
          <EmptyState title="Chưa có gói thuê bao" />
        )}
        {planEditor && (
          <PlanForm
            key={planEditor === 'new' ? 'new' : planEditor.id}
            plan={planEditor === 'new' ? undefined : planEditor}
            onCancel={() => setPlanEditor(undefined)}
            onSave={async (data, plan) => {
              await platformRequest(
                plan ? 'plans/' + plan.id : 'plans',
                plan ? 'PATCH' : 'POST',
                data,
              );
              plans.refresh();
              setPlanEditor(undefined);
              setNotice({ text: 'Đã lưu gói thuê bao.' });
            }}
          />
        )}
      </PlatformPanel>
      {notice && (
        <Toast error={notice.error} onDismiss={() => setNotice(undefined)}>
          {notice.text}
        </Toast>
      )}
    </>
  );
}

type CompanyFormProps = {
  company?: Company;
  lead?: Lead;
  onSave: (data: object, company?: Company) => Promise<void>;
  onCancel: () => void;
};

function PilotCompanyForm({
  id,
  ...props
}: Pick<CompanyFormProps, 'onSave' | 'onCancel'> & { id: string }) {
  const lead = usePlatformData<Lead>('leads/' + encodeURIComponent(id));
  if (lead.data && !lead.data.tenantId)
    return <CompanyForm {...props} lead={lead.data} />;
  return (
    <PlatformPanel title="Chuyển đăng ký thành doanh nghiệp">
      <RequestState
        error={
          lead.data ? 'Đăng ký đã được chuyển thành doanh nghiệp.' : lead.error
        }
      />
      <Button variant="secondary" onClick={props.onCancel}>
        Quay lại
      </Button>
    </PlatformPanel>
  );
}

function CompanyForm({ company, lead, onSave, onCancel }: CompanyFormProps) {
  return (
    <PlatformPanel title={company ? 'Sửa doanh nghiệp' : 'Tạo doanh nghiệp'}>
      <SaveForm
        onSave={(data) => onSave({ ...data, leadId: lead?.id }, company)}
        label={company ? 'Lưu thay đổi' : 'Tạo và gửi lời mời'}
        onCancel={onCancel}
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <Input
            label="Tên doanh nghiệp"
            name="name"
            required
            maxLength={300}
            defaultValue={company?.name ?? lead?.companyName}
          />
          <Input
            label="Mã đăng nhập"
            name="loginCode"
            required
            maxLength={100}
            pattern="[A-Za-z0-9]+(?:-[A-Za-z0-9]+)*"
            defaultValue={company?.loginCode}
          />
          <Input
            label="Mã số thuế"
            name="taxCode"
            maxLength={30}
            defaultValue={company?.taxCode ?? ''}
          />
          <Input
            label="Địa chỉ"
            name="address"
            maxLength={500}
            defaultValue={company?.address ?? ''}
          />
          <Input
            label="Người liên hệ"
            name="contactName"
            maxLength={200}
            defaultValue={company?.contactName ?? lead?.fullName}
          />
          <Input
            label="Số điện thoại liên hệ"
            name="contactPhone"
            type="tel"
            maxLength={30}
            defaultValue={company?.contactPhone ?? lead?.phone}
          />
          {!company && (
            <>
              <Input
                label="Họ tên quản trị đầu tiên"
                name="adminName"
                required
                maxLength={200}
                defaultValue={lead?.fullName}
              />
              <Input
                label="Email quản trị đầu tiên"
                name="adminEmail"
                type="email"
                required
                maxLength={254}
              />
            </>
          )}
        </div>
      </SaveForm>
    </PlatformPanel>
  );
}

function PlanForm({
  plan,
  onSave,
  onCancel,
}: {
  plan?: Plan;
  onSave: (data: object, plan?: Plan) => Promise<void>;
  onCancel: () => void;
}) {
  return (
    <SaveForm
      onSave={(data) => onSave(data, plan)}
      onCancel={onCancel}
      label="Lưu gói"
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Input
          label="Tên gói"
          name="name"
          required
          maxLength={200}
          defaultValue={plan?.name}
        />
        <Input
          label="Số tài khoản tối đa"
          name="maxAccounts"
          type="number"
          min="1"
          step="1"
          required
          defaultValue={plan?.maxAccounts}
        />
        <Input
          label="Dung lượng (GB)"
          name="storageGb"
          type="number"
          min="1"
          step="1"
          required
          defaultValue={plan?.storageGb}
        />
        <Input
          label="Giá (đồng)"
          name="price"
          inputMode="decimal"
          required
          pattern="[0-9]{1,16}(?:\.[0-9]{1,2})?"
          defaultValue={plan?.price}
        />
        <SelectField label="Chu kỳ" name="cycle" defaultValue={plan?.cycle}>
          <Options labels={planCycles} />
        </SelectField>
      </div>
    </SaveForm>
  );
}
