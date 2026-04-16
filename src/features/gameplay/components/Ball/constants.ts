import { Hit } from "@shared/constants/hitTypes";

export const hitDistances: Record<Hit, number> = {
  [Hit.Single]: 120,
  [Hit.Double]: 200,
  [Hit.Triple]: 280,
  [Hit.Homerun]: 400,
  [Hit.Walk]: 0,
  [Hit.HitByPitch]: 0,
};
