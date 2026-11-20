import { type KeyboardEvent, type ReactNode, useId } from 'react';

export type DashboardTab = { id: string; label: string };

export function DashboardTabs({
  label,
  tabs,
  selected,
  onSelect,
  children,
}: {
  label: string;
  tabs: readonly DashboardTab[];
  selected: string;
  onSelect: (id: string) => void;
  children: ReactNode;
}) {
  const prefix = useId();
  const panelId = `${prefix}-panel`;

  function moveFocus(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const offsets = { ArrowLeft: -1, ArrowRight: 1 };
    let target: number;
    switch (event.key) {
      case 'Home':
        target = 0;
        break;
      case 'End':
        target = tabs.length - 1;
        break;
      case 'ArrowLeft':
      case 'ArrowRight':
        target = (index + offsets[event.key] + tabs.length) % tabs.length;
        break;
      default:
        return;
    }
    event.preventDefault();
    const id = tabs[target].id;
    onSelect(id);
    document.getElementById(`${prefix}-${id}`)?.focus();
  }

  return (
    <>
      <div className="dashboard-tabs" role="tablist" aria-label={label}>
        {tabs.map((tab, index) => (
          <button
            key={tab.id}
            id={`${prefix}-${tab.id}`}
            type="button"
            role="tab"
            aria-controls={`${panelId}-${tab.id}`}
            aria-selected={selected === tab.id}
            tabIndex={selected === tab.id ? 0 : -1}
            onClick={() => onSelect(tab.id)}
            onKeyDown={(event) => moveFocus(event, index)}
          >
            {tab.label}
          </button>
        ))}
      </div>
      {tabs.map((tab) => (
        <div
          key={tab.id}
          className="dashboard-tab-panel"
          id={`${panelId}-${tab.id}`}
          role="tabpanel"
          aria-labelledby={`${prefix}-${tab.id}`}
          hidden={selected !== tab.id}
        >
          {selected === tab.id && children}
        </div>
      ))}
    </>
  );
}
