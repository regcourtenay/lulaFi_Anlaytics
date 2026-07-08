import { createContext, useContext, useMemo, useState } from "react";

// Shared time/comparison/filter state consumed by every dashboard (SDD 7.4).
const FilterCtx = createContext(null);
export const useFilters = () => useContext(FilterCtx);

const DEFAULT = {
  preset: "last_30_days",
  compare: "previous_period",
  timeZone: "Africa/Johannesburg",
  granularity: "day",
  filters: {},
  providerRealmId: null, // admin drill target
};

export function FilterProvider({ children, defaultTimeZone }) {
  const [state, setState] = useState({ ...DEFAULT, timeZone: defaultTimeZone || DEFAULT.timeZone });
  const value = useMemo(() => ({
    ...state,
    set: (patch) => setState((s) => ({ ...s, ...patch })),
    setFilter: (dim, values) => setState((s) => {
      const filters = { ...s.filters };
      if (!values || values.length === 0) delete filters[dim];
      else filters[dim] = values;
      return { ...s, filters };
    }),
    clearFilters: () => setState((s) => ({ ...s, filters: {} })),
    toParams: () => ({
      preset: state.preset,
      compare: state.compare,
      timeZone: state.timeZone,
      granularity: state.granularity,
      filters: Object.keys(state.filters).length ? state.filters : undefined,
      providerRealmId: state.providerRealmId || undefined,
    }),
  }), [state]);
  return <FilterCtx.Provider value={value}>{children}</FilterCtx.Provider>;
}
