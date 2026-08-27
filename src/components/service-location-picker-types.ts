import type { Coordinates } from '@/hooks/use-user-location';

export type ServiceLocationSelection = {
  coordinates: Coordinates;
  address: string;
};

export type ServiceLocationPickerProps = {
  visible: boolean;
  initialCoordinates: Coordinates | null;
  initialAddress: string;
  onClose: () => void;
  onConfirm: (selection: ServiceLocationSelection) => void;
};
