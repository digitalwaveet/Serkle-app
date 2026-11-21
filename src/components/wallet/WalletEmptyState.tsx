interface WalletEmptyStateProps {
  title: string;
  description: string;
}

export function WalletEmptyState({ title, description }: WalletEmptyStateProps) {
  return (
    <div className="wallet-empty">
      <img
        className="wallet-empty-illustration"
        src="/illustrations/empty-wallet.svg"
        alt=""
        aria-hidden="true"
      />
      <h3>{title}</h3>
      <p>{description}</p>
    </div>
  );
}
