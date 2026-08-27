import { type ComponentType } from 'react';
import { isRunningInExpoGo } from 'expo';

import ProviderMapFallback, { type ProviderMapProps } from './provider-map-fallback';

type NativeMapComponent = ComponentType<ProviderMapProps>;

const expoGo = isRunningInExpoGo();
let NativeMap: NativeMapComponent | null = null;

if (!expoGo) {
  try {
    // Keep the module in Metro's main bundle. A dynamic import creates a remote
    // chunk that can time out when a physical device reconnects to Metro.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    NativeMap = require('./provider-map-maplibre').default as NativeMapComponent;
  } catch (error: unknown) {
    console.warn('MapLibre map module could not be loaded.', error);
  }
}

export default function ProviderMap(props: ProviderMapProps) {
  if (expoGo) {
    return (
      <ProviderMapFallback
        {...props}
        description="The interactive MapLibre map requires the BeyBridge development build. Expo Go can still browse and select every service location below."
      />
    );
  }

  if (!NativeMap) {
    return (
      <ProviderMapFallback
        {...props}
        description="This installed BeyBridge build does not include MapLibre yet. Install the latest development build to enable the interactive map."
      />
    );
  }

  return <NativeMap {...props} />;
}
