import { redirect } from 'next/navigation';

interface FunilPageProps {
  params: { slug: string };
}

export default function FunilPage({ params }: FunilPageProps) {
  redirect(`/${params.slug}/clientes`);
}
