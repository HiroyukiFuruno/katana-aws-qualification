import { usePreferences } from '../../preferences';

export function DashboardPagePicker({
  page,
  pages,
  onChange,
  chart = false,
}: {
  page: number;
  pages: number;
  onChange: (page: number) => void;
  chart?: boolean;
}) {
  const { t } = usePreferences();
  if (pages <= 1) return null;
  return (
    <label className="dashboard-viz-pagination">
      {t(chart ? 'dashboardChartPage' : 'dashboardTablePage')}
      <select value={page} onChange={(event) => onChange(Number(event.currentTarget.value))}>
        {Array.from({ length: pages }, (_, index) => String(index + 1)).map((label) => (
          <option key={label} value={Number(label) - 1}>
            {label} / {pages}
          </option>
        ))}
      </select>
    </label>
  );
}
