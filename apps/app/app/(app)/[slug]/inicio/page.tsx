import { HomeActions } from '@/components/modules/home/HomeActions';

interface InicioPageProps {
  params: { slug: string };
}

export default function InicioPage({ params }: InicioPageProps) {
  return <HomeActions slug={params.slug} />;
}
