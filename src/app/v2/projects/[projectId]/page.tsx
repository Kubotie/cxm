import { ProjectDetailView } from './detail-view';

export default async function V2ProjectDetailPage({ params }: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  return <ProjectDetailView projectId={projectId} />;
}
