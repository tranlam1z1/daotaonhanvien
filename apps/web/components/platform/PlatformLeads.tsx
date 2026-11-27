'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Button, EmptyState, Input, Toast } from '../ui/controls';
import {
  NotesField,
  Options,
  PlatformPanel,
  RequestState,
  SaveForm,
  SelectField,
} from './PlatformForms';
import {
  dateLabel,
  leadStatus,
  platformRequest,
  usePlatformData,
  type Lead,
  type Staff,
} from './platform-data';

const sizes: Record<string, string> = {
  'under-30': 'Dưới 30 nhân sự',
  '30-100': 'Từ 30 đến 100 nhân sự',
  'over-100': 'Trên 100 nhân sự',
};

export function PlatformLeads() {
  const [filters, setFilters] = useState({
    status: '',
    search: '',
    assigneeId: '',
  });
  const query = new URLSearchParams(filters).toString();
  const result = usePlatformData<{ leads: Lead[]; staff: Staff[] }>(
    'leads?' + query,
  );
  const [editId, setEditId] = useState<string>();
  const [saved, setSaved] = useState(false);
  const staff = result.data?.staff;
  const [knownStaff, setKnownStaff] = useState<Staff[]>([]);
  if (staff && staff !== knownStaff) setKnownStaff(staff);

  return (
    <>
      <PlatformPanel title="Lọc đăng ký">
        <div className="grid gap-3 md:grid-cols-3">
          <Input
            label="Doanh nghiệp, người liên hệ hoặc điện thoại"
            name="search"
            type="search"
            maxLength={200}
            value={filters.search}
            onChange={(event) =>
              setFilters({ ...filters, search: event.target.value })
            }
          />
          <SelectField
            label="Trạng thái"
            name="status"
            value={filters.status}
            onChange={(event) =>
              setFilters({ ...filters, status: event.target.value })
            }
          >
            <option value="">Tất cả trạng thái</option>
            <Options labels={leadStatus} />
          </SelectField>
          <SelectField
            label="Người phụ trách"
            name="assigneeId"
            value={filters.assigneeId}
            onChange={(event) =>
              setFilters({ ...filters, assigneeId: event.target.value })
            }
          >
            <option value="">Tất cả người phụ trách</option>
            <option value="unassigned">Chưa phân công</option>
            <StaffOptions staff={knownStaff} />
          </SelectField>
        </div>
      </PlatformPanel>
      {!result.data ? (
        <RequestState error={result.error} />
      ) : result.data.leads.length ? (
        <ul className="space-y-3">
          {result.data.leads.map((lead) => (
            <li key={lead.id}>
              <PlatformPanel title={lead.companyName}>
                <div className="grid gap-3 break-words text-sm sm:grid-cols-2">
                  <div>
                    <p>
                      {lead.fullName} · {lead.jobTitle}
                    </p>
                    <p>
                      {lead.phone} ·{' '}
                      {sizes[lead.companySize] ?? lead.companySize}
                    </p>
                    <p>Ngày đăng ký: {dateLabel(lead.submittedAt)}</p>
                  </div>
                  <div>
                    <p className="font-semibold">{leadStatus[lead.status]}</p>
                    <p>
                      Phụ trách:{' '}
                      {knownStaff.find(({ id }) => id === lead.assigneeId)
                        ?.fullName ??
                        (lead.assigneeId
                          ? 'Tài khoản không hoạt động'
                          : 'Chưa phân công')}
                    </p>
                    {lead.notes && (
                      <p className="whitespace-pre-wrap break-words">
                        Ghi chú: {lead.notes}
                      </p>
                    )}
                  </div>
                </div>
                {editId === lead.id ? (
                  <SaveForm
                    label="Lưu đăng ký"
                    onCancel={() => setEditId(undefined)}
                    onSave={async (data) => {
                      await platformRequest('leads/' + lead.id, 'PATCH', data);
                      setEditId(undefined);
                      result.refresh();
                      setSaved(true);
                    }}
                  >
                    <div className="grid gap-3 sm:grid-cols-2">
                      <SelectField
                        label="Trạng thái đăng ký"
                        name="status"
                        defaultValue={lead.status}
                      >
                        <Options labels={leadStatus} />
                      </SelectField>
                      <SelectField
                        label="Phân công người phụ trách"
                        name="assigneeId"
                        defaultValue={lead.assigneeId ?? ''}
                      >
                        <option value="">Chưa phân công</option>
                        <StaffOptions staff={knownStaff} />
                      </SelectField>
                    </div>
                    <NotesField
                      label="Ghi chú"
                      name="notes"
                      defaultValue={lead.notes ?? ''}
                    />
                  </SaveForm>
                ) : (
                  <div className="flex flex-wrap items-center gap-3">
                    <Button
                      variant="secondary"
                      onClick={() => setEditId(lead.id)}
                    >
                      Cập nhật đăng ký
                    </Button>
                    {lead.tenantId ? (
                      <p className="text-sm font-semibold text-teal-800">
                        Đã chuyển thành doanh nghiệp
                      </p>
                    ) : (
                      <Link
                        href={
                          '/ung-dung/doanh-nghiep?pilot=' +
                          encodeURIComponent(lead.id)
                        }
                        className="inline-flex min-h-11 items-center font-semibold text-blue-700 hover:underline"
                      >
                        Chuyển thành doanh nghiệp
                      </Link>
                    )}
                  </div>
                )}
              </PlatformPanel>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState title="Không có đăng ký phù hợp" />
      )}
      {saved && (
        <Toast onDismiss={() => setSaved(false)}>Đã lưu đăng ký.</Toast>
      )}
    </>
  );
}

function StaffOptions({ staff }: { staff: Staff[] }) {
  return staff.map(({ id, fullName }) => (
    <option key={id} value={id}>
      {fullName}
    </option>
  ));
}
