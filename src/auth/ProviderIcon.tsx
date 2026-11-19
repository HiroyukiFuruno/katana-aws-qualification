type Props = { providerId: string };

function iconSource(providerId: string) {
  switch (providerId) {
    case 'github':
      return '/auth/github.svg';
    case 'google':
      return '/auth/google.svg';
    case 'microsoft':
      return '/auth/microsoft.svg';
    case 'facebook':
      return '/auth/facebook.svg';
    default:
      return undefined;
  }
}

export function ProviderIcon({ providerId }: Props) {
  const source = iconSource(providerId);
  return source ? (
    <img aria-hidden="true" className="account-provider-icon" src={source} alt="" />
  ) : (
    <span aria-hidden="true" className="account-provider-icon account-provider-icon-fallback" />
  );
}
