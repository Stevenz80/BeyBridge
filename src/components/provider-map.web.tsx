import ProviderMapFallback, { type ProviderMapProps } from './provider-map-fallback';

export default function ProviderMap(props: ProviderMapProps) {
  return (
    <ProviderMapFallback
      {...props}
      description="The interactive map is available in a configured Android or iOS build. You can still select any service location below."
    />
  );
}
