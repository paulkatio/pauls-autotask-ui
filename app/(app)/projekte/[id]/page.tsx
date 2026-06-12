import {
  ProjectDetailContent,
  projectMetadata,
} from "@/components/projects/project-detail-content";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return projectMetadata(Number(id));
}

export default async function ProjectDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  return <ProjectDetailContent projectId={Number(id)} tabParam={sp.tab} />;
}
