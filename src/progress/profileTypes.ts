export type Profile = {
  earned: string[];
  answers: Record<string, number>;
  optionOrders: Record<string, number[]>;
  order: string[];
};

export const emptyProfile = (): Profile => ({ earned: [], answers: {}, optionOrders: {}, order: [] });
