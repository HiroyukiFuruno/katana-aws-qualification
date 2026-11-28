import { imageSlot } from '../images/catalog';
import { ImageSlot } from '../images/ImageSlot';

export function ProviderIcon({ providerId }: { providerId: string }) {
  return (
    <ImageSlot
      id={imageSlot('auth', 'provider', providerId)}
      fallback={
        <span aria-hidden="true" className="account-provider-icon account-provider-icon-fallback" />
      }
    />
  );
}
