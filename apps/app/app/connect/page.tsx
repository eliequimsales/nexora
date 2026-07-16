import type { Metadata } from 'next';
import { ConnectMvp } from '@/components/modules/connect/ConnectMvp';

export const metadata: Metadata = {
  title: 'Nexora Connect',
  description: 'Nexora Connect encontra dinheiro parado na carteira de clientes e mostra a proxima acao.',
};

export default function ConnectPage() {
  return <ConnectMvp />;
}
