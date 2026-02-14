import { Table2, Layers, Rows3, Database } from "lucide-react";
import { useUIStore } from "../../stores/uiStore";
import { useProjectStore } from "../../stores/projectStore";
import { Modal } from "../ui";
import { cn } from "../../lib/utils";

export function SchemaInfoModal() {
  const { schemaInfoModal, closeSchemaInfoModal } = useUIStore();
  const schemas = useProjectStore((state) => state.schemas);

  const schema = schemas.find((s) => s.name === schemaInfoModal.schema);

  if (!schema) {
    return (
      <Modal
        open={schemaInfoModal.isOpen}
        onClose={closeSchemaInfoModal}
        title="Schema Info"
      >
        <p className="text-sm text-[var(--text-muted)]">Schema not found.</p>
      </Modal>
    );
  }

  const tableCount = schema.tables.length;
  const totalRows = schema.tables.reduce(
    (sum, t) => sum + (t.rowCount ?? 0),
    0
  );
  const tablesWithRows = schema.tables
    .filter((t) => t.rowCount !== undefined && t.rowCount !== null)
    .sort((a, b) => (b.rowCount ?? 0) - (a.rowCount ?? 0));

  return (
    <Modal
      open={schemaInfoModal.isOpen}
      onClose={closeSchemaInfoModal}
      title={`Schema: ${schema.name}`}
    >
      <div className="space-y-5">
        {/* Summary stats */}
        <div className="grid grid-cols-3 gap-3">
          <StatCard
            icon={<Table2 className="w-4 h-4" />}
            label="Tables"
            value={tableCount.toLocaleString()}
            color="text-[var(--accent)]"
          />
          <StatCard
            icon={<Rows3 className="w-4 h-4" />}
            label="Total Rows"
            value={formatNumber(totalRows)}
            color="text-green-400"
          />
          <StatCard
            icon={<Database className="w-4 h-4" />}
            label="Schema"
            value={schema.name}
            color="text-[var(--warning)]"
          />
        </div>

        {/* Tables list */}
        {tableCount > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Layers className="w-4 h-4 text-[var(--text-muted)]" />
              <span className="text-sm font-medium text-[var(--text-secondary)]">
                Tables ({tableCount})
              </span>
            </div>
            <div className="border border-[var(--border-color)] rounded-lg overflow-hidden">
              <div className="max-h-64 overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-[var(--bg-tertiary)]">
                    <tr>
                      <th className="text-left px-3 py-2 text-[var(--text-muted)] font-medium">
                        Name
                      </th>
                      <th className="text-right px-3 py-2 text-[var(--text-muted)] font-medium">
                        Rows
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {tablesWithRows.map((table) => (
                      <tr
                        key={table.name}
                        className="border-t border-[var(--border-color)] hover:bg-[var(--bg-tertiary)] transition-colors"
                      >
                        <td className="px-3 py-1.5">
                          <div className="flex items-center gap-2">
                            <Table2 className="w-3.5 h-3.5 text-[var(--accent)] shrink-0" />
                            <span className="text-[var(--text-primary)] truncate">
                              {table.name}
                            </span>
                          </div>
                        </td>
                        <td className="px-3 py-1.5 text-right text-[var(--text-secondary)] tabular-nums">
                          {(table.rowCount ?? 0).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                    {schema.tables
                      .filter(
                        (t) => t.rowCount === undefined || t.rowCount === null
                      )
                      .sort((a, b) => a.name.localeCompare(b.name))
                      .map((table) => (
                        <tr
                          key={table.name}
                          className="border-t border-[var(--border-color)] hover:bg-[var(--bg-tertiary)] transition-colors"
                        >
                          <td className="px-3 py-1.5">
                            <div className="flex items-center gap-2">
                              <Table2 className="w-3.5 h-3.5 text-[var(--accent)] shrink-0" />
                              <span className="text-[var(--text-primary)] truncate">
                                {table.name}
                              </span>
                            </div>
                          </td>
                          <td className="px-3 py-1.5 text-right text-[var(--text-muted)]">
                            --
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {tableCount === 0 && (
          <p className="text-sm text-[var(--text-muted)] text-center py-4">
            This schema has no tables.
          </p>
        )}
      </div>
    </Modal>
  );
}

function StatCard({
  icon,
  label,
  value,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  color: string;
}) {
  return (
    <div className="bg-[var(--bg-tertiary)] rounded-lg p-3 border border-[var(--border-color)]">
      <div className={cn("flex items-center gap-1.5 mb-1", color)}>
        {icon}
        <span className="text-xs font-medium">{label}</span>
      </div>
      <div className="text-lg font-semibold text-[var(--text-primary)] truncate">
        {value}
      </div>
    </div>
  );
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}
