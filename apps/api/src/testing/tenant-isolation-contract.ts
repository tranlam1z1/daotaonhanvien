/** Reuse this contract for every future tenant-owned model/API adapter. */
export function tenantIsolationContract(
  name: string,
  access: () => {
    ownId: string;
    foreignId: string;
    run: (work: () => Promise<unknown>) => Promise<unknown>;
    list: () => Promise<{ id: string }[]>;
    find: (id: string) => Promise<unknown>;
    update: (id: string) => Promise<unknown>;
    remove: (id: string) => Promise<unknown>;
    createForeign: () => Promise<unknown>;
  },
) {
  describe(`AC-01: ${name}`, () => {
    it('unfiltered Prisma query returns own data and hides foreign data', async () => {
      const a = access();
      const rows = (await a.run(a.list)) as { id: string }[];
      expect(rows.map((row) => row.id)).toContain(a.ownId);
      expect(rows.map((row) => row.id)).not.toContain(a.foreignId);
    });
    it('foreign ID lookup returns null', async () => {
      const a = access();
      expect(await a.run(() => a.find(a.foreignId))).toBeNull();
    });
    it('cannot update or delete a known foreign ID', async () => {
      const a = access();
      await expect(a.run(() => a.update(a.foreignId))).rejects.toMatchObject({
        code: 'P2025',
      });
      await expect(a.run(() => a.remove(a.foreignId))).rejects.toMatchObject({
        code: 'P2025',
      });
    });
    it('database rejects inserting a foreign tenant row', async () => {
      const a = access();
      // PostgreSQL BEFORE triggers can reject role links before RLS WITH CHECK.
      await expect(a.run(a.createForeign)).rejects.toThrow(
        /row-level security|Role user must belong to the same tenant/,
      );
    });
  });
}
