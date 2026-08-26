import { redirect } from 'next/navigation';

interface TasksPageProps {
  params: { slug: string };
}

export default function TasksPage({ params }: TasksPageProps) {
  redirect(`/${params.slug}/clientes`);
}
