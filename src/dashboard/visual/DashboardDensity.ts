import { createContext, useContext } from 'react';
import type { DashboardDensity } from '../ui/dashboardPresentation';

export const DashboardDensityContext = createContext<DashboardDensity>('standard');

export function useDashboardDensity() {
  return useContext(DashboardDensityContext);
}

export function dashboardChartPageSize(density: DashboardDensity) {
  return density === 'compact' ? 4 : 6;
}
