import {
  IconCar,
  IconToolsKitchen2,
  IconHeartbeat,
  IconBeach,
  IconHome,
  IconDots,
} from '@tabler/icons-react';
import type { Category } from '../types/expense';

const ICON_MAP: Record<Category, React.FC<{ size?: number }>> = {
  Car: IconCar,
  Food: IconToolsKitchen2,
  Health: IconHeartbeat,
  Holidays: IconBeach,
  Home: IconHome,
  Various: IconDots,
};

export function CategoryIcon({ category, size = 16 }: { category: string; size?: number }) {
  const Icon = ICON_MAP[category as Category];
  if (!Icon) return null;
  return <Icon size={size} />;
}
