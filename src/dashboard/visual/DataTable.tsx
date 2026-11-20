import { type ReactNode, useState } from 'react';
import { DashboardPagePicker } from './PagePicker';

export type DashboardTableColumn = { id: string; label: string; numeric?: boolean };
export type DashboardTableRow = { id: string; cells: Record<string, ReactNode> };
export function DashboardDataTable({
  columns,
  rows,
  caption,
}: {
  columns: readonly DashboardTableColumn[];
  rows: readonly DashboardTableRow[];
  caption: string;
}) {
  const [requested, setRequested] = useState(0);
  const pages = Math.max(1, Math.ceil(rows.length / 10));
  const page = Math.min(requested, pages - 1);
  return (
    <div className="dashboard-viz-data">
      <table className="dashboard-viz-table">
        <caption>{caption}</caption>
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column.id} scope="col">
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.slice(page * 10, (page + 1) * 10).map((row) => (
            <tr key={row.id}>
              {columns.map((column, index) =>
                index === 0 ? (
                  <th key={column.id} scope="row">
                    {row.cells[column.id]}
                  </th>
                ) : (
                  <td
                    key={column.id}
                    data-label={column.label}
                    className={column.numeric ? 'dashboard-viz-numeric' : undefined}
                  >
                    {row.cells[column.id]}
                  </td>
                ),
              )}
            </tr>
          ))}
        </tbody>
      </table>
      <DashboardPagePicker page={page} pages={pages} onChange={setRequested} />
    </div>
  );
}
