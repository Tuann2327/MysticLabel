
export type LayoutType = 'standard' | 'large';
export type AppTab = 'grid' | 'import';

export interface OrderItem {
  id: string; // Internal unique ID for React keys
  orderNumber: string;
  productTitle: string;
  size: string;
}

export interface LabelConfig {
  id: string;
  name: string;
  rows: number;
  cols: number;
  options: string[];
}

export const LAYOUT_CONFIGS: Record<LayoutType, LabelConfig> = {
  standard: {
    id: 'standard',
    name: 'Small Format (8x20)',
    rows: 20,
    cols: 8,
    options: ['1ml', '3ml']
  },
  large: {
    id: 'large',
    name: 'Large Format (3x10)',
    rows: 10,
    cols: 3,
    options: ['5ml', '10ml']
  }
};
